import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  generateKakuro, createKakuroState, selectKakuroCell, enterKakuroNumber, eraseKakuroCell,
  getKakuroHint, serializeKakuroState, deserializeKakuroState,
  type KakuroDifficulty, type KakuroState,
} from "./wellensummeLogic";
import { savePuzzle, generateSaveId, deletePuzzleSave, getBestTime, recordBestTime, formatElapsed } from "../../../puzzleSave";
import { GameHudBar, GameSaveQuitDialog } from "../../../components/GameHudBar";
import GameRulesModal from "../../../components/GameRulesModal";
import { GAME_RULES } from "../../../gameRules";

interface LocationState {
  difficulty: KakuroDifficulty;
  seed: number;
  saveId?: string;
  savedState?: string;
  elapsedSeconds?: number;
}

const ACCENT = "#c084fc";

export default function WellensummeGameScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const locState = (location.state ?? {}) as LocationState;

  const difficulty = locState.difficulty ?? "mittel";
  const seed = locState.seed ?? Date.now();
  const saveIdRef = useRef<string>(locState.saveId ?? generateSaveId());

  const puzzleRef = useRef(generateKakuro(difficulty, seed));
  const puzzle = puzzleRef.current;

  const [gs, setGs] = useState<KakuroState>(() => {
    if (locState.savedState) return deserializeKakuroState(puzzle, locState.savedState);
    return createKakuroState(puzzle);
  });

  const [elapsed, setElapsed] = useState(locState.elapsedSeconds ?? 0);
  const [running, setRunning] = useState(true);
  const [showWin, setShowWin] = useState(false);
  const [showQuit, setShowQuit] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const bestTime = getBestTime("wellensumme", "standard", difficulty);

  useEffect(() => {
    if (!running || gs.solved) return;
    const id = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(id);
  }, [running, gs.solved]);

  useEffect(() => {
    if (gs.solved && !showWin) {
      setRunning(false);
      recordBestTime("wellensumme", "standard", difficulty, elapsed);
      deletePuzzleSave(saveIdRef.current);
      setShowWin(true);
    }
  }, [gs.solved]);

  useEffect(() => {
    if (gs.solved || showWin) return;
    savePuzzle({ id: saveIdRef.current, gameType: "wellensumme", variant: "standard", difficulty, seed, puzzleState: serializeKakuroState(gs), startedAt: Date.now(), elapsedSeconds: elapsed });
  }, [gs.board]);

  const handleHint = () => {
    const cell = getKakuroHint(gs);
    if (!cell) return;
    const [r, c] = cell;
    setGs(prev => {
      const s1 = selectKakuroCell(prev, r, c);
      return enterKakuroNumber(s1, puzzle.cells[r][c].solution!);
    });
  };

  const { size, cells } = puzzle;
  const availH = Math.max(200, window.innerHeight - 230);
  const maxW = Math.min((window.innerWidth > 640 ? window.innerWidth - 48 : Math.min(window.innerWidth, 520) - 48), availH);
  const cellPx = Math.floor(maxW / size);
  const fontSize = Math.max(cellPx * 0.28, 8);

  return (
    <div className="screen" style={{ gap: 0, paddingTop: 0, userSelect: "none" }}>
      {/* Header */}
      <GameHudBar
        paused={false}
        onPauseToggle={() => {}}
        showPause={false}
        onQuit={() => { setRunning(false); setShowQuit(true); }}
      >
        <span style={{ fontSize: 22 }}>➕</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase" }}>WellenSumme</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Zeit</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: ACCENT, fontVariantNumeric: "tabular-nums" }}>{formatElapsed(elapsed)}</div>
        </div>
      </GameHudBar>

      <div style={{ padding: "6px 16px", fontSize: 11, color: "var(--text-muted)", background: "var(--surface)" }}>
        Fülle die weißen Felder mit 1–9. Keine Wiederholung in einem Lauf. Zahl oben-rechts = senkrechte Summe, unten-links = waagerechte Summe.
      </div>

      {/* Grid */}
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "12px 8px" }}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${size}, ${cellPx}px)`, border: "2px solid var(--text-muted)" }}>
            {cells.map((row, r) =>
              row.map((cell, c) => {
                const isSelected = gs.selected?.[0] === r && gs.selected?.[1] === c;
                const val = gs.board[r][c];
                const hasErr = gs.errors[r][c];

                if (cell.isBlack) {
                  const hasDown = cell.downClue !== undefined;
                  const hasRight = cell.rightClue !== undefined;
                  return (
                    <div key={`${r}-${c}`} style={{ width: cellPx, height: cellPx, background: "#1a1a2e", border: "1px solid #333", position: "relative" }}>
                      {/* Diagonal divider */}
                      {(hasDown || hasRight) && (
                        <svg width={cellPx} height={cellPx} style={{ position: "absolute", inset: 0 }}>
                          {hasDown && hasRight && (
                            <line x1={0} y1={0} x2={cellPx} y2={cellPx} stroke="#555" strokeWidth={1} />
                          )}
                        </svg>
                      )}
                      {/* Down clue (top right) */}
                      {hasDown && (
                        <span style={{ position: "absolute", top: 2, right: 3, fontSize, color: "#94a3b8", fontWeight: 700, lineHeight: 1 }}>
                          {cell.downClue}
                        </span>
                      )}
                      {/* Right clue (bottom left) */}
                      {hasRight && (
                        <span style={{ position: "absolute", bottom: 2, left: 3, fontSize, color: "#94a3b8", fontWeight: 700, lineHeight: 1 }}>
                          {cell.rightClue}
                        </span>
                      )}
                    </div>
                  );
                }

                return (
                  <div
                    key={`${r}-${c}`}
                    onClick={() => setGs(prev => selectKakuroCell(prev, r, c))}
                    style={{
                      width: cellPx, height: cellPx,
                      background: isSelected ? ACCENT + "44" : hasErr ? "rgba(239,68,68,0.15)" : "var(--surface)",
                      border: `1px solid ${isSelected ? ACCENT : hasErr ? "var(--danger)" : "var(--border)"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ fontSize: cellPx * 0.5, fontWeight: 700, color: hasErr ? "var(--danger)" : "var(--text)" }}>
                      {val !== 0 ? val : ""}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Number pad */}
      <div style={{ flexShrink: 0, background: "var(--surface)", borderTop: "1px solid var(--border)", padding: "10px 12px 24px" }}>
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 8 }}>
          {[1,2,3,4,5,6,7,8,9].map(n => (
            <button key={n} onClick={() => setGs(prev => enterKakuroNumber(prev, n))} style={{ width: 40, height: 42, background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer", fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
              {n}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <button onClick={() => setGs(prev => eraseKakuroCell(prev))} style={ctrlBtn("var(--text-muted)")}>⌫</button>
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
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", marginBottom: 4 }}>Alle Summen stimmen!</div>
            <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 16 }}>
              Zeit: <strong style={{ color: ACCENT }}>{formatElapsed(elapsed)}</strong>
              {bestTime && elapsed < bestTime && <span style={{ color: "var(--success)", marginLeft: 8 }}>⭐ Neue Bestzeit!</span>}
            </div>
            <button onClick={() => navigate(-1)} style={{ ...ctrlBtn("var(--primary)"), width: "100%", padding: "14px 0" }}>Zurück zur Lobby</button>
          </div>
        </div>
      )}

      {showHelp && GAME_RULES["wellensumme"] && (
        <GameRulesModal rule={GAME_RULES["wellensumme"]} onClose={() => { setShowHelp(false); setRunning(true); }} />
      )}

      {showQuit && (
        <GameSaveQuitDialog
          emoji="🏖️"
          onContinue={() => { setRunning(true); setShowQuit(false); }}
          onSaveAndQuit={() => navigate(-1)}
          onQuitWithoutSave={() => { deletePuzzleSave(saveIdRef.current); navigate(-1); }}
        />
      )}
    </div>
  );
}


const ctrlBtn = (color: string): React.CSSProperties => ({ padding: "9px 14px", background: color + "22", border: `1px solid ${color}55`, borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700, color });
const overlayStyle: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 };
const dialogStyle: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 20, padding: "28px 24px", maxWidth: 320, width: "90%", textAlign: "center" };
