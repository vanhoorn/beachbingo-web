import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  createBattleState, playerShoot, aiShoot, shipCells, countRemainingCells,
  serializeBattleState, deserializeBattleState,
  type PlacedShip, type BattleState, type AiMode,
} from "./kuestenkriegBattleLogic";
import { GRID, FLEET_DEFS } from "./kuestenkriegBattleLogic";
import { savePuzzle, generateSaveId, deletePuzzleSave } from "../../../puzzleSave";
import { GameSaveQuitDialog } from "../../../components/GameHudBar";

const ACCENT = "#fb7185";
const CELL = Math.max(30, Math.min(40, Math.floor((Math.min(window.innerWidth, 520) - 70) / GRID)));

interface LocState {
  fleet: PlacedShip[];
  aiMode: AiMode;
  resumeSaveId?: string;
  resumeState?: string;
}

type CellView = "unknown" | "miss" | "hit" | "sunk" | "myship";

function cellColor(v: CellView): string {
  switch (v) {
    case "miss":   return "#1e3050";
    case "hit":    return "#ef444488";
    case "sunk":   return "#ef4444cc";
    case "myship": return ACCENT + "88";
    default:       return "var(--surface)";
  }
}

function cellLabel(v: CellView): string {
  switch (v) {
    case "miss": return "•";
    case "hit":  return "●";
    case "sunk": return "✕";
    default: return "";
  }
}

export default function KuestenkriegBattleScreen() {
  const navigate = useNavigate();
  const { fleet, aiMode, resumeSaveId, resumeState } = (useLocation().state ?? {}) as LocState;
  const saveIdRef = useRef<string>(resumeSaveId ?? generateSaveId());
  const startedAtRef = useRef(Date.now());
  const stateRef = useRef<BattleState>(
    resumeState
      ? (deserializeBattleState(resumeState) ?? createBattleState(fleet ?? [], aiMode ?? "matrose"))
      : createBattleState(fleet ?? [], aiMode ?? "matrose"),
  );
  const [gs, setGs] = useState<BattleState>(stateRef.current);
  const [aiThinking, setAiThinking] = useState(false);
  const [lastHit, setLastHit] = useState<string | null>(null);
  const [showQuit, setShowQuit] = useState(false);

  useEffect(() => {
    if (gs.turn === "ai" && !gs.gameOver) {
      setAiThinking(true);
      const delay = aiMode === "admiral" ? 900 : aiMode === "kapitaen" ? 700 : 500;
      const timer = setTimeout(() => {
        const next = aiShoot(gs, aiMode);
        stateRef.current = next;
        setGs(next);
        setAiThinking(false);
        // detect what AI hit
        for (let r = 0; r < GRID; r++) {
          for (let c = 0; c < GRID; c++) {
            if (next.playerGrid[r][c] !== gs.playerGrid[r][c]) {
              const res = next.playerGrid[r][c];
              if (res === "hit" || res === "sunk") setLastHit(`${String.fromCharCode(65+c)}${r+1} — Treffer!`);
              else setLastHit(`${String.fromCharCode(65+c)}${r+1} — Wasser!`);
              setTimeout(() => setLastHit(null), 2000);
            }
          }
        }
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [gs.turn, gs.gameOver]);

  useEffect(() => {
    if (gs.gameOver) {
      deletePuzzleSave(saveIdRef.current);
    } else {
      savePuzzle({
        id: saveIdRef.current,
        gameType: "kuestenkrieg_ki",
        variant: aiMode ?? "matrose",
        difficulty: "ki",
        seed: 0,
        puzzleState: serializeBattleState(gs),
        startedAt: startedAtRef.current,
        elapsedSeconds: 0,
      });
    }
  }, [gs]);

  const handlePlayerShoot = (r: number, c: number) => {
    if (gs.turn !== "player" || gs.gameOver || aiThinking) return;
    if (gs.aiGrid[r][c] !== "unknown") return;
    const next = playerShoot(gs, r, c);
    stateRef.current = next;
    setGs(next);
  };

  // Build display grids
  const myGrid = Array.from({ length: GRID }, (_, r) =>
    Array.from({ length: GRID }, (_, c): CellView => {
      const myShip = gs.playerFleet.some(s => shipCells(s).some(([sr, sc]) => sr === r && sc === c) && !s.sunk);
      const shot = gs.playerGrid[r][c];
      if (shot === "hit")  return "hit";
      if (shot === "sunk") return "sunk";
      if (shot === "miss") return "miss";
      if (myShip) return "myship";
      return "unknown";
    })
  );

  const enemyGrid = Array.from({ length: GRID }, (_, r) =>
    Array.from({ length: GRID }, (_, c): CellView => gs.aiGrid[r][c] as CellView)
  );

  const myRemaining  = countRemainingCells(gs.playerFleet);
  const aisRemaining = countRemainingCells(gs.aiFleet);

  return (
    <div className="screen" style={{ gap: 0, paddingTop: 0 }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, var(--surface) 0%, var(--surface2) 100%)", padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={() => setShowQuit(true)} style={backBtn}>‹</button>
        <span style={{ fontSize: 24 }}>⚓</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5 }}>KÜSTENKRIEG</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
            {gs.gameOver
              ? gs.winner === "player" ? "🏆 Sieg!" : "💀 Niederlage!"
              : aiThinking
              ? "KI denkt nach…"
              : gs.turn === "player"
              ? "Dein Schuss 🎯"
              : "KI ist am Zug…"}
          </div>
        </div>
        <div style={{ textAlign: "right", fontSize: 11, color: "var(--text-muted)" }}>
          <div>Du: {myRemaining} ❤️</div>
          <div>KI: {aisRemaining} 💀</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px 8px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* AI notification */}
        {lastHit && (
          <div style={{ background: ACCENT + "22", border: `1px solid ${ACCENT}55`, borderRadius: 10, padding: "10px 14px", textAlign: "center", fontSize: 14, fontWeight: 700, color: ACCENT }}>
            KI: {lastHit}
          </div>
        )}

        {/* Enemy grid (player shoots here) */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, textAlign: "center" }}>
            Gegnerisches Gewässer {gs.turn === "player" && !gs.gameOver && <span style={{ color: ACCENT }}> ← Tippen!</span>}
          </div>
          {GridView(enemyGrid, (r, c) => handlePlayerShoot(r, c), gs.turn === "player" && !gs.gameOver && !aiThinking)}
        </div>

        {/* Player grid */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, textAlign: "center" }}>
            Dein Gewässer
          </div>
          {GridView(myGrid, () => {}, false)}
        </div>

        {/* Fleet status */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
          {gs.aiFleet.map((ship, i) => (
            <div
              key={i}
              style={{
                padding: "4px 8px",
                background: ship.sunk ? "#ef444422" : ACCENT + "11",
                border: `1px solid ${ship.sunk ? "#ef444455" : ACCENT + "44"}`,
                borderRadius: 6,
                fontSize: 11,
                color: ship.sunk ? "#ef4444" : ACCENT,
                textDecoration: ship.sunk ? "line-through" : "none",
              }}
            >
              {FLEET_DEFS[ship.id]?.emoji} {FLEET_DEFS[ship.id]?.name}
            </div>
          ))}
        </div>

        {/* Game over */}
        {gs.gameOver && (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "20px", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>{gs.winner === "player" ? "🏆" : "💀"}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text)", marginBottom: 4 }}>
              {gs.winner === "player" ? "Du hast gewonnen!" : "KI hat gewonnen!"}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
              {gs.winner === "player" ? `Alle feindlichen Schiffe versenkt!` : "Deine Flotte wurde vernichtet!"}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => navigate("/raetsel/kuestenkrieg/lobby")}
                style={{ flex: 1, padding: "12px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 700, color: "var(--text)" }}
              >
                Lobby
              </button>
              <button
                onClick={() => navigate(-1)}
                style={{ flex: 1, padding: "12px", background: ACCENT, border: "none", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 800, color: "#0a1628" }}
              >
                Nochmal!
              </button>
            </div>
          </div>
        )}
      </div>
      {showQuit && (
        <GameSaveQuitDialog
          emoji="⚓"
          onContinue={() => setShowQuit(false)}
          onSaveAndQuit={() => navigate("/raetsel/kuestenkrieg/lobby")}
          onQuitWithoutSave={() => { deletePuzzleSave(saveIdRef.current); navigate("/raetsel/kuestenkrieg/lobby"); }}
        />
      )}
    </div>
  );
}

function GridView(
  grid: CellView[][],
  onCell: (r: number, c: number) => void,
  clickable: boolean
): React.ReactElement {
  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <div>
        <div style={{ display: "flex", marginLeft: 22, marginBottom: 2 }}>
          {Array.from({ length: GRID }, (_, i) => (
            <div key={i} style={{ width: CELL, fontSize: 9, color: "var(--text-muted)", textAlign: "center", fontWeight: 700 }}>
              {String.fromCharCode(65 + i)}
            </div>
          ))}
        </div>
        {grid.map((row, r) => (
          <div key={r} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ width: 20, fontSize: 9, color: "var(--text-muted)", textAlign: "right", paddingRight: 2, fontWeight: 700 }}>{r + 1}</div>
            {row.map((v, c) => (
              <div
                key={c}
                onClick={() => onCell(r, c)}
                style={{
                  width: CELL, height: CELL,
                  background: cellColor(v),
                  border: "1px solid var(--border)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: clickable && v === "unknown" ? "pointer" : "default",
                  fontSize: 10, fontWeight: 800,
                  color: v === "miss" ? "var(--text-muted)" : v === "hit" || v === "sunk" ? "#fff" : "",
                  boxSizing: "border-box",
                  transition: "background 0.15s",
                }}
              >
                {cellLabel(v)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

const backBtn: React.CSSProperties = {
  width: 36, height: 36, flexShrink: 0, background: "var(--surface2)",
  border: "1px solid var(--border)", borderRadius: 10, cursor: "pointer",
  fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text)",
};
