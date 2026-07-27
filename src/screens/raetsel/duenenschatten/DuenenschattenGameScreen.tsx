import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  generateHitori, createHitoriState, toggleMark, setMark, getHint,
  serializeHitoriState, deserializeHitoriState,
  type HitoriDifficulty, type HitoriState, type CellMark,
} from "./duenenschattenLogic";
import { savePuzzle, generateSaveId, deletePuzzleSave, getBestTime, recordBestTime, formatElapsed } from "../../../puzzleSave";

interface LocationState {
  difficulty: HitoriDifficulty;
  seed: number;
  saveId?: string;
  savedState?: string;
  elapsedSeconds?: number;
}

const ACCENT = "#fbbf24";

export default function DuenenschattenGameScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const locState = (location.state ?? {}) as LocationState;

  const difficulty = locState.difficulty ?? "mittel";
  const seed = locState.seed ?? Date.now();
  const saveIdRef = useRef<string>(locState.saveId ?? generateSaveId());

  const puzzleRef = useRef(generateHitori(difficulty, seed));
  const puzzle = puzzleRef.current;

  const [gs, setGs] = useState<HitoriState>(() => {
    if (locState.savedState) {
      return deserializeHitoriState(puzzle, locState.savedState);
    }
    return createHitoriState(puzzle);
  });

  const [elapsed, setElapsed] = useState(locState.elapsedSeconds ?? 0);
  const [running, setRunning] = useState(true);
  const [showWin, setShowWin] = useState(false);
  const [showQuit, setShowQuit] = useState(false);
  const [hintCell, setHintCell] = useState<[number, number] | null>(null);
  const bestTime = getBestTime("duenenschatten", "standard", difficulty);

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
      recordBestTime("duenenschatten", "standard", difficulty, elapsed);
      deletePuzzleSave(saveIdRef.current);
      setShowWin(true);
    }
  }, [gs.solved]);

  // Auto-save
  useEffect(() => {
    if (gs.solved || showWin) return;
    savePuzzle({
      id: saveIdRef.current,
      gameType: "duenenschatten",
      variant: "standard",
      difficulty,
      seed,
      puzzleState: serializeHitoriState(gs),
      startedAt: Date.now(),
      elapsedSeconds: elapsed,
    });
  }, [gs.marks]);

  const handleCellTap = useCallback((r: number, c: number) => {
    if (gs.solved) return;
    setHintCell(null);
    setGs(prev => toggleMark(prev, r, c));
  }, [gs.solved]);

  const handleLongPress = useCallback((r: number, c: number) => {
    if (gs.solved) return;
    setHintCell(null);
    setGs(prev => setMark(prev, r, c, prev.marks[r][c] === "dot" ? "white" : "dot"));
  }, [gs.solved]);

  const handleHint = () => {
    const cell = getHint(gs);
    if (!cell) return;
    const [r, c] = cell;
    setHintCell([r, c]);
    const correct: CellMark = puzzle.solution[r][c] ? "black" : "white";
    setGs(prev => setMark(prev, r, c, correct));
  };

  const { size, grid } = puzzle;
  const cellSize = Math.min(Math.floor((Math.min(window.innerWidth, 460) - 40) / size), 56);

  return (
    <div className="screen" style={{ gap: 0, paddingTop: 0, userSelect: "none" }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, var(--surface) 0%, var(--surface2) 100%)`,
        padding: "14px 16px",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <button onClick={() => { setRunning(false); setShowQuit(true); }} style={backBtnStyle}>‹</button>
        <span style={{ fontSize: 24 }}>◼</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase" }}>
            DünenSchatten
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
            {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} · {size}×{size}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Zeit</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT, fontVariantNumeric: "tabular-nums" }}>
            {formatElapsed(elapsed)}
          </div>
        </div>
      </div>

      {/* Rules reminder */}
      <div style={{ padding: "8px 16px", fontSize: 11, color: "var(--text-muted)", lineHeight: 1.4, background: "var(--surface)" }}>
        Tippen = schwärzen · Nochmal = leer · Lang tippen = Kreis (sicher weiß) · Keine Duplikate in Zeile/Spalte
      </div>

      {/* Grid */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 16px" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${size}, ${cellSize}px)`,
          gap: 2,
        }}>
          {grid.map((row, r) =>
            row.map((num, c) => {
              const mark = gs.marks[r][c];
              const conflict = gs.conflicts[r][c];
              const isHint = hintCell?.[0] === r && hintCell?.[1] === c;

              let bg = "var(--surface)";
              let textColor = "var(--text)";
              let border = "1px solid var(--border)";
              let opacity = 1;

              if (mark === "black") {
                bg = "#1a1a2e";
                textColor = "#1a1a2e"; // number hidden
                border = "1px solid #333";
              } else if (mark === "dot") {
                bg = "var(--surface)";
                textColor = ACCENT;
              }

              if (conflict && mark !== "black") {
                border = `2px solid var(--danger)`;
                bg = "rgba(239,68,68,0.12)";
              }
              if (conflict && mark === "black") {
                border = `2px solid var(--danger)`;
              }
              if (isHint) border = `2px solid ${ACCENT}`;

              return (
                <HitoriCell
                  key={`${r}-${c}`}
                  num={num}
                  mark={mark}
                  cellSize={cellSize}
                  bg={bg}
                  textColor={textColor}
                  border={border}
                  opacity={opacity}
                  onTap={() => handleCellTap(r, c)}
                  onLongPress={() => handleLongPress(r, c)}
                />
              );
            })
          )}
        </div>
      </div>

      {/* Bottom controls */}
      <div style={{
        padding: "12px 16px 24px",
        display: "flex", gap: 10, justifyContent: "center",
        background: "var(--surface)", borderTop: "1px solid var(--border)",
      }}>
        <button onClick={() => { setRunning(r => !r); }} style={controlBtnStyle(running ? "var(--primary)" : "var(--accent)")}>
          {running ? "⏸ Pause" : "▶ Weiter"}
        </button>
        <button onClick={handleHint} style={controlBtnStyle(ACCENT)}>
          💡 Hinweis
        </button>
        <button onClick={() => { setRunning(false); setShowQuit(true); }} style={controlBtnStyle("var(--danger)")}>
          ✕ Abbruch
        </button>
      </div>

      {/* Win overlay */}
      {showWin && (
        <div style={overlayStyle}>
          <div style={dialogStyle}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🏆</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", marginBottom: 4 }}>Gelöst!</div>
            <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 16 }}>
              Zeit: <strong style={{ color: ACCENT }}>{formatElapsed(elapsed)}</strong>
              {bestTime && elapsed < bestTime && (
                <span style={{ color: "var(--success)", marginLeft: 8 }}>⭐ Neue Bestzeit!</span>
              )}
            </div>
            <button onClick={() => navigate(-1)} style={{ ...controlBtnStyle("var(--primary)"), width: "100%", padding: "14px 0" }}>
              Zurück zur Lobby
            </button>
          </div>
        </div>
      )}

      {/* Quit dialog */}
      {showQuit && (
        <div style={overlayStyle}>
          <div style={dialogStyle}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🏖️</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text)", marginBottom: 20 }}>Spiel beenden?</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button onClick={() => { setRunning(true); setShowQuit(false); }} style={{ ...controlBtnStyle("var(--surface2)"), padding: "13px 0" }}>
                Weiterspielen
              </button>
              <button onClick={() => navigate(-1)} style={{ ...controlBtnStyle(ACCENT), padding: "13px 0" }}>
                💾 Speichern & Beenden
              </button>
              <button onClick={() => { deletePuzzleSave(saveIdRef.current); navigate(-1); }} style={{ ...controlBtnStyle("var(--danger)"), padding: "13px 0" }}>
                ✕ Beenden ohne Speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── HitoriCell component ──────────────────────────────────────────────────────

function HitoriCell({
  num, mark, cellSize, bg, textColor, border, opacity, onTap, onLongPress,
}: {
  num: number; mark: CellMark; cellSize: number; bg: string; textColor: string;
  border: string; opacity: number; onTap: () => void; onLongPress: () => void;
}) {
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onPointerDown = () => {
    pressTimer.current = setTimeout(() => { pressTimer.current = null; onLongPress(); }, 400);
  };
  const onPointerUp = () => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; onTap(); }
  };
  const onPointerLeave = () => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
  };

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      style={{
        width: cellSize, height: cellSize,
        background: bg,
        border,
        borderRadius: 4,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer",
        position: "relative",
        opacity,
        transition: "background 0.1s",
        touchAction: "none",
      }}
    >
      {mark !== "black" && (
        <span style={{
          fontSize: Math.max(cellSize * 0.38, 12),
          fontWeight: 800,
          color: textColor,
          lineHeight: 1,
        }}>
          {num}
        </span>
      )}
      {mark === "dot" && (
        <div style={{
          position: "absolute", bottom: 4, right: 4,
          width: Math.max(cellSize * 0.2, 6), height: Math.max(cellSize * 0.2, 6),
          borderRadius: "50%",
          background: ACCENT,
          opacity: 0.8,
        }} />
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const backBtnStyle: React.CSSProperties = {
  width: 36, height: 36, flexShrink: 0,
  background: "var(--surface2)", border: "1px solid var(--border)",
  borderRadius: 10, cursor: "pointer", fontSize: 20,
  display: "flex", alignItems: "center", justifyContent: "center",
  color: "var(--text)",
};

const controlBtnStyle = (color: string): React.CSSProperties => ({
  padding: "10px 16px",
  background: color + "22",
  border: `1px solid ${color}55`,
  borderRadius: 10, cursor: "pointer",
  fontSize: 13, fontWeight: 700,
  color: color,
});

const overlayStyle: React.CSSProperties = {
  position: "fixed", inset: 0,
  background: "rgba(0,0,0,0.7)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 100,
};

const dialogStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 20,
  padding: "28px 24px",
  maxWidth: 320, width: "90%",
  textAlign: "center",
};
