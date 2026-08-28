import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  generateBattleship, createBattleshipState, setShipMark,
  computeBattleshipErrors, getBattleshipHint,
  serializeBattleshipState, deserializeBattleshipState,
  type KriegDifficulty, type BattleshipState, type CellMark,
} from "./kuestenkriegLogic";
import { savePuzzle, generateSaveId, deletePuzzleSave, getBestTime, recordBestTime, formatElapsed } from "../../../puzzleSave";
import { GameHudBar, GameSaveQuitDialog } from "../../../components/GameHudBar";
import GameRulesModal from "../../../components/GameRulesModal";
import { GAME_RULES } from "../../../gameRules";

interface LocationState {
  difficulty: KriegDifficulty;
  seed: number;
  saveId?: string;
  savedState?: string;
  elapsedSeconds?: number;
}

const ACCENT = "#fb7185";

// Right-click / long-press threshold
const LONG_PRESS_MS = 400;

export default function KuestenkriegGameScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const locState = (location.state ?? {}) as LocationState;

  const difficulty = locState.difficulty ?? "mittel";
  const seed = locState.seed ?? Date.now();
  const saveIdRef = useRef<string>(locState.saveId ?? generateSaveId());

  const puzzleRef = useRef(generateBattleship(difficulty, seed));
  const puzzle = puzzleRef.current;

  const [gs, setGs] = useState<BattleshipState>(() => {
    if (locState.savedState) return deserializeBattleshipState(puzzle, locState.savedState);
    return createBattleshipState(puzzle);
  });

  const [elapsed, setElapsed] = useState(locState.elapsedSeconds ?? 0);
  const [running, setRunning] = useState(true);
  const [showWin, setShowWin] = useState(false);
  const [showQuit, setShowQuit] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  // active mark tool: "ship" or "water"
  const [tool, setTool] = useState<"ship" | "water">("ship");
  const bestTime = getBestTime("kuestenkrieg", "standard", difficulty);

  // Timer
  useEffect(() => {
    if (!running || gs.solved) return;
    const id = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(id);
  }, [running, gs.solved]);

  // Win detection
  useEffect(() => {
    if (gs.solved && !showWin) {
      setRunning(false);
      recordBestTime("kuestenkrieg", "standard", difficulty, elapsed);
      deletePuzzleSave(saveIdRef.current);
      setShowWin(true);
    }
  }, [gs.solved]);

  // Auto-save
  useEffect(() => {
    if (gs.solved || showWin) return;
    savePuzzle({
      id: saveIdRef.current,
      gameType: "kuestenkrieg",
      variant: "standard",
      difficulty,
      seed,
      puzzleState: serializeBattleshipState(gs),
      startedAt: Date.now(),
      elapsedSeconds: elapsed,
    });
  }, [gs.marks]);

  const errors = computeBattleshipErrors(gs);

  const handleHint = () => {
    const cell = getBattleshipHint(gs);
    if (!cell) return;
    const [r, c] = cell;
    const correctMark: CellMark = puzzle.solution[r][c] ? "ship" : "water";
    setGs(prev => setShipMark(prev, r, c, correctMark));
  };

  const handleCellClick = (r: number, c: number) => {
    if (puzzle.givenShip[r][c] || puzzle.givenWater[r][c]) return;
    setGs(prev => setShipMark(prev, r, c, prev.marks[r][c] === tool ? "unknown" : tool));
  };

  // Long-press to toggle water (alternative to tool selector)
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlePointerDown = (r: number, c: number) => {
    longPressRef.current = setTimeout(() => {
      setGs(prev => setShipMark(prev, r, c, prev.marks[r][c] === "water" ? "unknown" : "water"));
      longPressRef.current = null;
    }, LONG_PRESS_MS);
  };
  const handlePointerUp = (r: number, c: number) => {
    if (longPressRef.current !== null) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
      handleCellClick(r, c);
    }
  };
  const handlePointerLeave = () => {
    if (longPressRef.current !== null) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  };

  const { size } = puzzle;
  const LABEL_SIZE = 30;
  const availH = Math.max(200, window.innerHeight - 230);
  const maxBoardW = Math.min((window.innerWidth > 640 ? window.innerWidth - 48 : Math.min(window.innerWidth, 520) - 48), availH);
  const cellPx = Math.floor((maxBoardW - LABEL_SIZE) / size);
  const boardPx = cellPx * size + LABEL_SIZE;

  return (
    <div className="screen" style={{ gap: 0, paddingTop: 0, userSelect: "none" }}>
      {/* Header */}
      <GameHudBar
        paused={false}
        onPauseToggle={() => {}}
        showPause={false}
        onQuit={() => { setRunning(false); setShowQuit(true); }}
      >
        <span style={{ fontSize: 22 }}>⚓</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase" }}>Küstenkrieg</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Zeit</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: ACCENT, fontVariantNumeric: "tabular-nums" }}>{formatElapsed(elapsed)}</div>
        </div>
      </GameHudBar>

      {/* Info bar */}
      <div style={{ padding: "5px 16px", fontSize: 11, color: "var(--text-muted)", background: "var(--surface)" }}>
        Tippen = Schiff · Lang drücken = Wasser · Zahlen am Rand = Schiffsfelder pro Zeile/Spalte
      </div>

      {/* Board area */}
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "12px 8px" }}>
        <div style={{ width: boardPx }}>
          {/* Column clues row */}
          <div style={{ display: "flex", marginLeft: LABEL_SIZE }}>
            {puzzle.colClues.map((clue, c) => (
              <div
                key={c}
                style={{
                  width: cellPx, height: LABEL_SIZE,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: Math.max(cellPx * 0.38, 9), fontWeight: 800,
                  color: errors.cols[c] ? "var(--danger)" : "var(--text)",
                  background: "var(--bg)",
                }}
              >
                {clue}
              </div>
            ))}
          </div>

          {/* Grid rows */}
          {Array.from({ length: size }, (_, r) => (
            <div key={r} style={{ display: "flex" }}>
              {/* Row clue */}
              <div
                style={{
                  width: LABEL_SIZE, height: cellPx,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: Math.max(cellPx * 0.38, 9), fontWeight: 800,
                  color: errors.rows[r] ? "var(--danger)" : "var(--text)",
                  background: "var(--bg)",
                }}
              >
                {puzzle.rowClues[r]}
              </div>

              {/* Cells */}
              {Array.from({ length: size }, (_, c) => {
                const mark = gs.marks[r][c];
                const isGivenShip = puzzle.givenShip[r][c];
                const isGivenWater = puzzle.givenWater[r][c];
                const isGiven = isGivenShip || isGivenWater;

                let bg = "var(--surface)";
                if (isGivenShip || (mark === "ship")) bg = ACCENT + "44";
                if (isGivenWater || (mark === "water")) bg = "var(--surface2)";

                let borderColor = "var(--border)";
                if (mark === "ship" && !isGiven) borderColor = ACCENT;

                return (
                  <div
                    key={c}
                    onPointerDown={() => !isGiven && handlePointerDown(r, c)}
                    onPointerUp={() => !isGiven && handlePointerUp(r, c)}
                    onPointerLeave={handlePointerLeave}
                    style={{
                      width: cellPx, height: cellPx,
                      background: bg,
                      border: `1px solid ${borderColor}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: isGiven ? "default" : "pointer",
                      position: "relative",
                      touchAction: "none",
                    }}
                  >
                    {(mark === "ship" || isGivenShip) && (
                      <div style={{
                        width: cellPx * 0.6, height: cellPx * 0.6, borderRadius: "50%",
                        background: isGivenShip ? ACCENT : ACCENT + "cc",
                        flexShrink: 0,
                      }} />
                    )}
                    {(mark === "water" || isGivenWater) && (
                      <span style={{ fontSize: cellPx * 0.45, lineHeight: 1, opacity: isGivenWater ? 1 : 0.5 }}>~</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div style={{ flexShrink: 0, background: "var(--surface)", borderTop: "1px solid var(--border)", padding: "10px 12px 24px" }}>
        {/* Tool selector */}
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 8 }}>
          <button
            onClick={() => setTool("ship")}
            style={{ flex: 1, maxWidth: 160, padding: "10px 0", background: tool === "ship" ? ACCENT + "33" : "var(--surface2)", border: `1.5px solid ${tool === "ship" ? ACCENT : "var(--border)"}`, borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 700, color: tool === "ship" ? ACCENT : "var(--text-muted)" }}
          >
            🚢 Schiff
          </button>
          <button
            onClick={() => setTool("water")}
            style={{ flex: 1, maxWidth: 160, padding: "10px 0", background: tool === "water" ? "#38bdf833" : "var(--surface2)", border: `1.5px solid ${tool === "water" ? "#38bdf8" : "var(--border)"}`, borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 700, color: tool === "water" ? "#38bdf8" : "var(--text-muted)" }}
          >
            🌊 Wasser
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <button onClick={handleHint} style={ctrlBtn(ACCENT)}>💡</button>
          <button onClick={() => { setRunning(false); setShowHelp(true); }} style={ctrlBtn("var(--text-muted)")}>?</button>
          <button onClick={() => setRunning(r => !r)} style={ctrlBtn("var(--primary)")}>{running ? "⏸" : "▶"}</button>
          <button onClick={() => { setRunning(false); setShowQuit(true); }} style={ctrlBtn("var(--danger)")}>✕</button>
        </div>
      </div>

      {showWin && (
        <div style={overlayStyle}>
          <div style={dialogStyle}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🏆</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", marginBottom: 4 }}>Alle Schiffe gefunden!</div>
            <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 16 }}>
              Zeit: <strong style={{ color: ACCENT }}>{formatElapsed(elapsed)}</strong>
              {bestTime && elapsed < bestTime && <span style={{ color: "var(--success)", marginLeft: 8 }}>⭐ Neue Bestzeit!</span>}
            </div>
            <button onClick={() => navigate("/raetsel/kuestenkrieg/lobby", { replace: true })} style={{ ...ctrlBtn("var(--primary)"), width: "100%", padding: "14px 0" }}>Zurück zur Lobby</button>
          </div>
        </div>
      )}

      {showHelp && GAME_RULES["kuestenkrieg"] && (
        <GameRulesModal rule={GAME_RULES["kuestenkrieg"]} onClose={() => { setShowHelp(false); setRunning(true); }} />
      )}

      {showQuit && (
        <GameSaveQuitDialog
          emoji="⚓"
          onContinue={() => { setRunning(true); setShowQuit(false); }}
          onSaveAndQuit={() => navigate("/raetsel/kuestenkrieg/lobby", { replace: true })}
          onQuitWithoutSave={() => { deletePuzzleSave(saveIdRef.current); navigate("/raetsel/kuestenkrieg/lobby", { replace: true }); }}
        />
      )}
    </div>
  );
}


const ctrlBtn = (color: string): React.CSSProperties => ({ padding: "9px 14px", background: color + "22", border: `1px solid ${color}55`, borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700, color });
const overlayStyle: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 };
const dialogStyle: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 20, padding: "28px 24px", maxWidth: 320, width: "90%", textAlign: "center" };
