import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  generateStrandoku, createStrandokuState, selectCell, enterNumber, eraseCell,
  getStrandokuHint, serializeStrandokuState, deserializeStrandokuState,
  getBoxDimensions, sameBox, getCageForCell, getRegionColor, getSamuraiLocalPos,
  type StrandokuVariant, type StrandokuDifficulty, type StrandokuState, type StrandokuPuzzle,
} from "./strandokuLogic";
import { savePuzzle, generateSaveId, deletePuzzleSave, getBestTime, recordBestTime, formatElapsed } from "../../../puzzleSave";

interface LocationState {
  variant: StrandokuVariant;
  difficulty: StrandokuDifficulty;
  seed: number;
  saveId?: string;
  savedState?: string;
  elapsedSeconds?: number;
}

const ACCENT = "#38bdf8";
const VARIANT_GAME_TYPES: Record<StrandokuVariant, string> = {
  classic: "strandoku_classic", mega12: "strandoku_mega12", mega16: "strandoku_mega16",
  irregular: "strandoku_irregular", diagonal: "strandoku_diagonal",
  killer: "strandoku_killer", samurai: "strandoku_samurai",
};

export default function StrandokuGameScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const locState = (location.state ?? {}) as LocationState;

  const variant = locState.variant ?? "classic";
  const difficulty = locState.difficulty ?? "mittel";
  const seed = locState.seed ?? Date.now();
  const saveIdRef = useRef<string>(locState.saveId ?? generateSaveId());
  const gameType = VARIANT_GAME_TYPES[variant];

  const [puzzle, setPuzzle] = useState<StrandokuPuzzle | null>(null);
  const [gs, setGs] = useState<StrandokuState | null>(null);
  const [elapsed, setElapsed] = useState(locState.elapsedSeconds ?? 0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const p = generateStrandoku(variant, difficulty, seed);
    const state = locState.savedState
      ? deserializeStrandokuState(p, locState.savedState)
      : createStrandokuState(p);
    setPuzzle(p);
    setGs(state);
    setElapsed(locState.elapsedSeconds ?? 0);
    setRunning(true);
  }, [seed]);
  const [noteMode, setNoteMode] = useState(false);
  const [showWin, setShowWin] = useState(false);
  const [showQuit, setShowQuit] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const bestTime = getBestTime(gameType, variant, difficulty);

  useEffect(() => {
    if (!running || gs?.solved) return;
    const id = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(id);
  }, [running, gs?.solved]);

  useEffect(() => {
    if (gs?.solved && !showWin) {
      setRunning(false);
      recordBestTime(gameType, variant, difficulty, elapsed);
      deletePuzzleSave(saveIdRef.current);
      setShowWin(true);
    }
  }, [gs?.solved]);

  useEffect(() => {
    if (!gs || gs.solved || showWin) return;
    savePuzzle({
      id: saveIdRef.current, gameType: "strandoku", variant, difficulty, seed,
      puzzleState: serializeStrandokuState(gs), startedAt: Date.now(), elapsedSeconds: elapsed,
    });
  }, [gs?.board]);

  const handleCellTap = useCallback((r: number, c: number) => {
    setGs(prev => prev ? selectCell(prev, r, c) : prev);
  }, []);

  const handleNumber = useCallback((n: number) => {
    setGs(prev => prev ? enterNumber(prev, n, noteMode) : prev);
  }, [noteMode]);

  const handleHint = () => {
    if (!gs || !puzzle) return;
    const cell = getStrandokuHint(gs);
    if (!cell) return;
    const [r, c] = cell;
    setGs(prev => {
      if (!prev) return prev;
      const s1 = selectCell(prev, r, c);
      return enterNumber(s1, puzzle.solution[r][c], false);
    });
  };

  if (!puzzle || !gs) {
    return (
      <div className="screen" style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔢</div>
          <div style={{ fontSize: 14, color: "var(--text-muted)" }}>Rätsel wird generiert…</div>
        </div>
      </div>
    );
  }

  const { size } = puzzle;
  const isSamurai = puzzle.isSamurai;

  // Large grids (mega12/mega16/Samurai) break out of the 520px .screen cap to fill the screen
  const isLargeGrid = size > 9;
  // .screen padding: 16px L+R = 32px; board container padding: 8px L+R = 16px; total = 48px horizontal overhead
  // Subtract 4 more for the 2px grid border on each side so grid+border never exceeds available space
  const availW = Math.max(160, isLargeGrid ? window.innerWidth - 48 : Math.min(window.innerWidth, 520) - 48);
  const availH = Math.max(160, window.innerHeight - 210);
  const cellPx = Math.max(10, Math.floor((Math.min(availW, availH) - 4) / size));

  const { bw, bh } = getBoxDimensions(size);
  // Samurai uses values 1-9 regardless of grid size (21×21 canvas, but 9×9 sub-grids)
  const numPad = isSamurai
    ? [1,2,3,4,5,6,7,8,9]
    : size <= 9 ? Array.from({ length: size }, (_, i) => i + 1)
    : size === 12 ? [1,2,3,4,5,6,7,8,9,10,11,12]
    : Array.from({ length: size }, (_, i) => i + 1);

  const sel = gs.selected;

  // Determine highlighted cells
  const isHighlighted = (r: number, c: number): boolean => {
    if (!sel) return false;
    const [sr, sc] = sel;
    if (r === sr && c === sc) return false;
    if (r === sr || c === sc) return true;
    if (!isSamurai && sameBox(r, c, sr, sc, size)) return true;
    return false;
  };

  const isSameNumber = (r: number, c: number): boolean => {
    if (!sel) return false;
    const selNum = gs.board[sel[0]][sel[1]];
    return selNum !== 0 && gs.board[r][c] === selNum;
  };

  return (
    <div className="screen" style={{ gap: 0, paddingTop: 0, userSelect: "none", ...(isLargeGrid && { maxWidth: "none" }) }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, var(--surface) 0%, var(--surface2) 100%)",
        padding: "12px 16px", display: "flex", alignItems: "center", gap: 10,
      }}>
        <button onClick={() => { setRunning(false); setShowQuit(true); }} style={backBtn}>‹</button>
        <span style={{ fontSize: 22 }}>🔢</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase" }}>
            Strandoku · {variant === "classic" ? "9×9" : variant === "mega12" ? "12×12" : variant === "mega16" ? "16×16" : variant.charAt(0).toUpperCase() + variant.slice(1)}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
            {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Zeit</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: ACCENT, fontVariantNumeric: "tabular-nums" }}>{formatElapsed(elapsed)}</div>
        </div>
      </div>

      {/* Board */}
      <div style={{ display: "flex", justifyContent: "center", padding: "8px 8px 0" }}>
        <div style={{ overflowX: "auto" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: `repeat(${size}, ${cellPx}px)`,
            border: "2px solid var(--text-muted)",
          }}>
            {puzzle.grid.map((row, r) =>
              row.map((_, c) => {
                if (isSamurai && puzzle.solution[r][c] === -1) {
                  return (
                    <div key={`${r}-${c}`} style={{ width: cellPx, height: cellPx, background: "var(--bg)" }} />
                  );
                }

                const isGiven = puzzle.given[r][c];
                const val = gs.board[r][c];
                const isSelected = sel?.[0] === r && sel?.[1] === c;
                const isHi = isHighlighted(r, c);
                const isSameNum = isSameNumber(r, c);
                const hasError = gs.errors[r][c];
                const cage = getCageForCell(puzzle, r, c);
                const cellNotes = gs.notes[r][c];

                // Border logic: thicker at box boundaries; for Samurai use local sub-grid position
                const samLoc = isSamurai ? getSamuraiLocalPos(r, c) : null;
                const borderRight = isSamurai
                  ? (samLoc ? ((samLoc[1] + 1) % 3 === 0 ? "2px solid var(--text-muted)" : "1px solid var(--border)") : "none")
                  : ((c + 1) % bw === 0 && c < size - 1 ? "2px solid var(--text-muted)" : "1px solid var(--border)");
                const borderBottom = isSamurai
                  ? (samLoc ? ((samLoc[0] + 1) % 3 === 0 ? "2px solid var(--text-muted)" : "1px solid var(--border)") : "none")
                  : ((r + 1) % bh === 0 && r < size - 1 ? "2px solid var(--text-muted)" : "1px solid var(--border)");
                const borderLeft = isSamurai && samLoc && samLoc[1] === 0 ? "2px solid var(--text-muted)" : undefined;
                const borderTop  = isSamurai && samLoc && samLoc[0] === 0 ? "2px solid var(--text-muted)" : undefined;

                let bg = "var(--surface)";
                if (puzzle.variant === "irregular" && puzzle.regions) {
                  bg = getRegionColor(puzzle.regions[r][c]);
                }
                if (puzzle.variant === "killer" && cage) {
                  // cage color from sum hash
                  const colors = ["#0ea5e922","#f59e0b22","#22c55e22","#ec489922","#8b5cf622","#06b6d422"];
                  bg = colors[cage.cells[0][0] * 9 + cage.cells[0][1] % colors.length];
                }
                if (isSelected) bg = ACCENT + "44";
                else if (isSameNum) bg = ACCENT + "22";
                else if (isHi) bg = "var(--surface2)";

                const isTopLeftOfCage = cage && cage.cells[0][0] === r && cage.cells[0][1] === c;

                return (
                  <div
                    key={`${r}-${c}`}
                    onClick={() => handleCellTap(r, c)}
                    style={{
                      width: cellPx, height: cellPx,
                      background: bg,
                      borderRight, borderBottom, borderLeft, borderTop,
                      position: "relative",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer",
                    }}
                  >
                    {/* Killer cage sum */}
                    {isTopLeftOfCage && (
                      <span style={{
                        position: "absolute", top: 1, left: 2,
                        fontSize: Math.max(cellPx * 0.22, 7),
                        color: "var(--text-muted)", fontWeight: 700, lineHeight: 1,
                      }}>{cage.sum}</span>
                    )}

                    {val !== 0 ? (
                      <span style={{
                        fontSize: Math.max(cellPx * 0.52, 11),
                        fontWeight: isGiven ? 800 : 600,
                        color: hasError ? "var(--danger)" : isGiven ? "var(--text)" : ACCENT,
                      }}>
                        {size <= 9 ? val : val <= 9 ? val : String.fromCharCode(64 + val - 9)}
                      </span>
                    ) : cellNotes.size > 0 ? (
                      <div style={{
                        display: "grid",
                        gridTemplateColumns: `repeat(${isSamurai || size <= 9 ? 3 : Math.ceil(Math.sqrt(size))}, 1fr)`,
                        width: "100%", height: "100%",
                        padding: 1,
                      }}>
                        {Array.from({ length: isSamurai ? 9 : size }, (_, i) => (
                          <span key={i} style={{
                            fontSize: Math.max(Math.floor(cellPx * 0.30), 8),
                            color: cellNotes.has(i + 1) ? ACCENT : "transparent",
                            textAlign: "center", lineHeight: 1.1,
                          }}>{i + 1}</span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Number pad + controls */}
      <div style={{ background: "var(--surface)", borderTop: "1px solid var(--border)", padding: "10px 12px 24px" }}>
        {/* Numpad */}
        <div style={{
          display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "center", marginBottom: 10,
        }}>
          {numPad.map(n => (
            <button
              key={n}
              onClick={() => handleNumber(n)}
              style={{
                width: Math.min(Math.floor((window.innerWidth - 48) / numPad.length), 44),
                height: 42,
                background: "var(--surface2)",
                border: "1px solid var(--border)",
                borderRadius: 8, cursor: "pointer",
                fontSize: 16, fontWeight: 700, color: "var(--text)",
              }}
            >
              {isSamurai || size <= 9 ? n : n <= 9 ? n : String.fromCharCode(64 + n - 9)}
            </button>
          ))}
        </div>

        {/* Controls row */}
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <button onClick={() => setGsErase()} style={ctrlBtn("var(--text-muted)")}>⌫</button>
          <button
            onClick={() => setNoteMode(m => !m)}
            style={ctrlBtn(noteMode ? ACCENT : "var(--text-muted)")}
          >
            ✏️
          </button>
          <button onClick={handleHint} style={ctrlBtn(ACCENT)}>💡</button>
          <button onClick={() => { setRunning(false); setShowHelp(true); }} style={ctrlBtn("var(--text-muted)")}>?</button>
          <button onClick={() => setRunning(r => !r)} style={ctrlBtn("var(--primary)")}>
            {running ? "⏸" : "▶"}
          </button>
          <button onClick={() => { setRunning(false); setShowQuit(true); }} style={ctrlBtn("var(--danger)")}>✕</button>
        </div>
      </div>

      {showWin && (
        <div style={overlayStyle}>
          <div style={dialogStyle}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🏆</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", marginBottom: 4 }}>Gelöst!</div>
            <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 16 }}>
              Zeit: <strong style={{ color: ACCENT }}>{formatElapsed(elapsed)}</strong>
              {bestTime && elapsed < bestTime && <span style={{ color: "var(--success)", marginLeft: 8 }}>⭐ Neue Bestzeit!</span>}
            </div>
            <button onClick={() => navigate(-1)} style={{ ...ctrlBtn("var(--primary)"), width: "100%", padding: "14px 0" }}>
              Zurück zur Lobby
            </button>
          </div>
        </div>
      )}

      {showHelp && (
        <div style={overlayStyle}>
          <div style={{ ...dialogStyle, textAlign: "left", maxWidth: 360 }}>
            <div style={{ fontSize: 24, marginBottom: 4, textAlign: "center" }}>🔢 Strandoku</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT, marginBottom: 12, textAlign: "center" }}>{variant === "samurai" ? "Samurai-Sudoku" : variant === "killer" ? "Killer-Sudoku" : variant === "diagonal" ? "Diagonal-Sudoku" : variant === "irregular" ? "Irregular-Sudoku" : variant === "mega12" ? "12×12 Sudoku" : variant === "mega16" ? "16×16 Sudoku" : "Classic Sudoku"}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.55 }}>
              <div>🔢 Fülle das Gitter so, dass jede Zeile, Spalte {variant === "classic" || variant === "diagonal" || variant === "killer" || variant === "irregular" ? "und jedes 3×3-Feld" : variant === "mega12" ? "und jedes 3×4-Feld" : variant === "mega16" ? "und jedes 4×4-Feld" : "und jedes Sub-Gitter"} jede Zahl genau einmal enthält.</div>
              {variant === "killer" && <div>➕ Die Zahlen in jedem Käfig müssen die angegebene Summe ergeben. Keine Zahl darf sich im Käfig wiederholen.</div>}
              {variant === "diagonal" && <div>↗ Zusätzlich müssen auch beide Hauptdiagonalen jede Zahl einmal enthalten.</div>}
              {variant === "irregular" && <div>🔷 Statt quadratischer Boxen gibt es unregelmäßig geformte Regionen — jede Region muss jede Zahl einmal enthalten.</div>}
              {variant === "samurai" && <div>🏯 Fünf überlappende 9×9-Sudokus. Die Ecken teilen sich gemeinsame 3×3-Felder.</div>}
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 8, fontSize: 12 }}>Tippe eine Zelle → dann eine Zahl. Hinweis-Modus: Notizen für mehrere Kandidaten eintragen.</div>
            </div>
            <button onClick={() => { setShowHelp(false); setRunning(true); }} style={{ ...ctrlBtn(ACCENT), width: "100%", padding: "12px 0", marginTop: 20, textAlign: "center" }}>
              Verstanden!
            </button>
          </div>
        </div>
      )}

      {showQuit && (
        <div style={overlayStyle}>
          <div style={dialogStyle}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🏖️</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text)", marginBottom: 20 }}>Spiel beenden?</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button onClick={() => { setRunning(true); setShowQuit(false); }} style={{ ...ctrlBtn("var(--surface2)"), padding: "13px 0" }}>Weiterspielen</button>
              <button onClick={() => navigate(-1)} style={{ ...ctrlBtn(ACCENT), padding: "13px 0" }}>💾 Speichern & Beenden</button>
              <button onClick={() => { deletePuzzleSave(saveIdRef.current); navigate(-1); }} style={{ ...ctrlBtn("var(--danger)"), padding: "13px 0" }}>✕ Beenden ohne Speichern</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function setGsErase() { setGs(prev => prev ? eraseCell(prev) : prev); }
}

const backBtn: React.CSSProperties = {
  width: 36, height: 36, flexShrink: 0, background: "var(--surface2)",
  border: "1px solid var(--border)", borderRadius: 10, cursor: "pointer",
  fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text)",
};
const ctrlBtn = (color: string): React.CSSProperties => ({
  padding: "9px 14px", background: color + "22", border: `1px solid ${color}55`,
  borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700, color,
});
const overlayStyle: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
};
const dialogStyle: React.CSSProperties = {
  background: "var(--surface)", border: "1px solid var(--border)",
  borderRadius: 20, padding: "28px 24px", maxWidth: 320, width: "90%", textAlign: "center",
};
