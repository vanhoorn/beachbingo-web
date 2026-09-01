import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  generateHashi, createHashiState, toggleBridge, applyHint, serializeHashiState,
  deserializeHashiState, islandBridgeSum, type HashiDifficulty, type HashiState,
} from "./inselbrueckeLogic";
import { savePuzzle, generateSaveId, deletePuzzleSave, getBestTime, recordBestTime, formatElapsed } from "../../../puzzleSave";
import { GameHudBar, GameSaveQuitDialog } from "../../../components/GameHudBar";
import GameRulesModal from "../../../components/GameRulesModal";
import { GAME_RULES } from "../../../gameRules";
import { audioManager } from "../../../audio/AudioManager";

interface LocationState {
  difficulty: HashiDifficulty;
  seed: number;
  saveId?: string;
  savedState?: string;
  elapsedSeconds?: number;
}

const ACCENT = "#4ade80";

export default function InselbrueckeGameScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const locState = (location.state ?? {}) as LocationState;

  const difficulty = locState.difficulty ?? "mittel";
  const seed = locState.seed ?? Date.now();
  const saveIdRef = useRef<string>(locState.saveId ?? generateSaveId());

  const puzzleRef = useRef(generateHashi(difficulty, seed));
  const puzzle = puzzleRef.current;

  const [gs, setGs] = useState<HashiState>(() => {
    if (locState.savedState) return deserializeHashiState(puzzle, locState.savedState);
    return createHashiState(puzzle);
  });

  const [elapsed, setElapsed] = useState(locState.elapsedSeconds ?? 0);
  const [running, setRunning] = useState(true);
  const [showWin, setShowWin] = useState(false);
  const [showQuit, setShowQuit] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const bestTime = getBestTime("inselbruecke", "standard", difficulty);

  useEffect(() => {
    audioManager.startMusic("raetsel");
    return () => audioManager.stopMusic();
  }, []);

  useEffect(() => {
    if (!running || gs.solved) return;
    const id = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(id);
  }, [running, gs.solved]);

  useEffect(() => {
    if (gs.solved && !showWin) {
      setRunning(false);
      recordBestTime("inselbruecke", "standard", difficulty, elapsed);
      deletePuzzleSave(saveIdRef.current);
      setShowWin(true);
    }
  }, [gs.solved]);

  useEffect(() => {
    if (gs.solved || showWin) return;
    savePuzzle({
      id: saveIdRef.current, gameType: "inselbruecke", variant: "standard",
      difficulty, seed, puzzleState: serializeHashiState(gs),
      startedAt: Date.now(), elapsedSeconds: elapsed,
    });
  }, [gs.bridges]);

  const handleIslandTap = useCallback((islandId: number) => {
    if (gs.solved) return;
    if (selected === null) {
      setSelected(islandId);
    } else if (selected === islandId) {
      setSelected(null);
    } else {
      // Try to add bridge
      setGs(prev => toggleBridge(prev, selected, islandId));
      setSelected(null);
    }
  }, [gs.solved, selected]);

  const handleHint = () => {
    setGs(prev => applyHint(prev));
  };

  const { gridSize, islands } = puzzle;
  const availH = Math.max(200, window.innerHeight - 220);
  const availW = Math.min(window.innerWidth, 520) - 64; // .screen 16px + container 16px each side
  const CELL_SIZE = Math.max(28, Math.floor(Math.min(availW, availH) / gridSize));
  const svgSize = gridSize * CELL_SIZE;

  // Build bridge SVG lines
  const bridgeLines: React.ReactElement[] = [];
  gs.bridges.forEach((b, idx) => {
    const ia = islands.find(i => i.id === b.from)!;
    const ib = islands.find(i => i.id === b.to)!;
    const x1 = ia.col * CELL_SIZE + CELL_SIZE / 2;
    const y1 = ia.row * CELL_SIZE + CELL_SIZE / 2;
    const x2 = ib.col * CELL_SIZE + CELL_SIZE / 2;
    const y2 = ib.row * CELL_SIZE + CELL_SIZE / 2;

    if (b.count === 1) {
      bridgeLines.push(
        <line key={`b${idx}`} x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={ACCENT} strokeWidth={3} strokeLinecap="round" />
      );
    } else {
      // Double bridge: two parallel lines
      const isHoriz = ia.row === ib.row;
      const offset = 4;
      const [ox, oy] = isHoriz ? [0, offset] : [offset, 0];
      bridgeLines.push(
        <g key={`b${idx}`}>
          <line x1={x1 - ox} y1={y1 - oy} x2={x2 - ox} y2={y2 - oy}
            stroke={ACCENT} strokeWidth={2.5} strokeLinecap="round" />
          <line x1={x1 + ox} y1={y1 + oy} x2={x2 + ox} y2={y2 + oy}
            stroke={ACCENT} strokeWidth={2.5} strokeLinecap="round" />
        </g>
      );
    }
  });

  const containerWidth = Math.min(availW, svgSize);

  return (
    <div className="screen" style={{ gap: 0, paddingTop: 0, userSelect: "none" }}>
      {/* Header */}
      <GameHudBar
        paused={false}
        onPauseToggle={() => {}}
        showPause={false}
        onQuit={() => { setRunning(false); setShowQuit(true); }}
      >
        <span style={{ fontSize: 24 }}>🌉</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase" }}>Inselbrücke</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} · {gridSize}×{gridSize}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Zeit</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT, fontVariantNumeric: "tabular-nums" }}>{formatElapsed(elapsed)}</div>
        </div>
      </GameHudBar>

      <div style={{ padding: "6px 16px", fontSize: 11, color: "var(--text-muted)", background: "var(--surface)" }}>
        Tippe eine Insel, dann eine andere → Brücke. Nochmal = 2 Brücken. Dreimal = entfernen.
      </div>

      {/* SVG Grid */}
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
        <div style={{ overflowX: "auto", maxWidth: "100%" }}>
          <svg
            width={Math.min(containerWidth, svgSize)}
            height={svgSize * (Math.min(containerWidth, svgSize) / svgSize)}
            viewBox={`0 0 ${svgSize} ${svgSize}`}
            style={{ display: "block" }}
          >
            {/* Grid dots */}
            {Array.from({ length: gridSize }, (_, r) =>
              Array.from({ length: gridSize }, (_, c) => (
                <circle key={`d${r}-${c}`}
                  cx={c * CELL_SIZE + CELL_SIZE / 2}
                  cy={r * CELL_SIZE + CELL_SIZE / 2}
                  r={1.5}
                  fill="var(--border)"
                />
              ))
            )}

            {/* Bridges */}
            {bridgeLines}

            {/* Islands */}
            {islands.map(island => {
              const cx = island.col * CELL_SIZE + CELL_SIZE / 2;
              const cy = island.row * CELL_SIZE + CELL_SIZE / 2;
              const sum = islandBridgeSum(gs.bridges, island.id);
              const isSelected = selected === island.id;
              const isDone = sum === island.value;
              const isOver = sum > island.value;

              const fillColor = isOver ? "#ef4444" : isDone ? ACCENT + "33" : "var(--surface)";
              const strokeColor = isSelected ? ACCENT : isOver ? "#ef4444" : isDone ? ACCENT : "var(--text-muted)";
              const radius = CELL_SIZE * 0.38;

              return (
                <g key={island.id} style={{ cursor: "pointer" }}
                  onClick={() => handleIslandTap(island.id)}>
                  <circle cx={cx} cy={cy} r={radius}
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={isSelected ? 3 : 2}
                  />
                  <text x={cx} y={cy + 1}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize={radius * 0.95}
                    fontWeight="800"
                    fill={isOver ? "#ef4444" : isDone ? ACCENT : "var(--text)"}
                  >
                    {island.value}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Bottom controls */}
      <div style={{
        flexShrink: 0,
        padding: "12px 16px 24px", display: "flex", gap: 10, justifyContent: "center",
        background: "var(--surface)", borderTop: "1px solid var(--border)",
      }}>
        <button onClick={() => setRunning(r => !r)} style={ctrlBtn(running ? "var(--primary)" : "var(--accent)")}>
          {running ? "⏸" : "▶"}
        </button>
        <button onClick={handleHint} style={ctrlBtn(ACCENT)}>💡</button>
        <button onClick={() => { setRunning(false); setShowHelp(true); }} style={ctrlBtn("var(--text-muted)")}>?</button>
        <button onClick={() => { setRunning(false); setShowQuit(true); }} style={ctrlBtn("var(--danger)")}>✕</button>
      </div>

      {showWin && (
        <div style={overlayStyle}>
          <div style={dialogStyle}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🏆</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", marginBottom: 4 }}>Alle Brücken gebaut!</div>
            <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 16 }}>
              Zeit: <strong style={{ color: ACCENT }}>{formatElapsed(elapsed)}</strong>
              {bestTime && elapsed < bestTime && <span style={{ color: "var(--success)", marginLeft: 8 }}>⭐ Neue Bestzeit!</span>}
            </div>
            <button onClick={() => navigate("/raetsel/inselbruecke/lobby", { replace: true })} style={{ ...ctrlBtn("var(--primary)"), width: "100%", padding: "14px 0" }}>
              Zurück zur Lobby
            </button>
          </div>
        </div>
      )}

      {showHelp && GAME_RULES["inselbruecke"] && (
        <GameRulesModal rule={GAME_RULES["inselbruecke"]} onClose={() => { setShowHelp(false); setRunning(true); }} />
      )}

      {showQuit && (
        <GameSaveQuitDialog
          emoji="🏖️"
          onContinue={() => { setRunning(true); setShowQuit(false); }}
          onSaveAndQuit={() => navigate("/raetsel/inselbruecke/lobby", { replace: true })}
          onQuitWithoutSave={() => { deletePuzzleSave(saveIdRef.current); navigate("/raetsel/inselbruecke/lobby", { replace: true }); }}
        />
      )}
    </div>
  );
}

const ctrlBtn = (color: string): React.CSSProperties => ({
  padding: "10px 16px", background: color + "22", border: `1px solid ${color}55`,
  borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 700, color,
});
const overlayStyle: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
};
const dialogStyle: React.CSSProperties = {
  background: "var(--surface)", border: "1px solid var(--border)",
  borderRadius: 20, padding: "28px 24px", maxWidth: 320, width: "90%", textAlign: "center",
};
