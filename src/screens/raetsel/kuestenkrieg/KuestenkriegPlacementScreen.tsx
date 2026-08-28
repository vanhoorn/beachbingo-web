import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { auth, db } from "../../../firebase";
import {
  FLEET_DEFS, GRID, canPlaceShip, placeShipOnGrid,
  type PlacedShip, type AiMode,
} from "./kuestenkriegBattleLogic";
import type { KriegOnlineGame } from "../../../types";

const ACCENT = "#fb7185";
const GRID_SIZE = GRID;

interface LocState {
  aiMode?: AiMode;
  mode?: "online" | "ki";
  gameCode?: string;
}

export default function KuestenkriegPlacementScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { aiMode, mode, gameCode } = (location.state ?? {}) as LocState;
  const uid = auth.currentUser?.uid ?? "";
  const isOnline = mode === "online";

  const [fleet, setFleet] = useState<PlacedShip[]>([]);
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const [horiz, setHoriz] = useState(true);
  const [hoverCell, setHoverCell] = useState<[number, number] | null>(null);
  const [waiting, setWaiting] = useState(false);
  const unsubRef = useRef<(() => void) | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => { unsubRef.current?.(); }, []);

  const currentDef = FLEET_DEFS[activeIdx];
  const placed = fleet.length;
  const allPlaced = placed === FLEET_DEFS.length;

  const getGrid = useCallback((): boolean[][] => {
    const g: boolean[][] = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(false));
    fleet.forEach(s => placeShipOnGrid(g, s.row, s.col, s.size, s.horiz));
    return g;
  }, [fleet]);

  const handleCellClick = (r: number, c: number) => {
    if (allPlaced) return;
    const g = getGrid();
    if (canPlaceShip(g, r, c, currentDef.size, horiz)) {
      const newShip: PlacedShip = { id: activeIdx, size: currentDef.size, row: r, col: c, horiz, sunk: false };
      setFleet(prev => [...prev, newShip]);
      setActiveIdx(prev => prev + 1);
    }
  };

  const removeLastShip = () => {
    if (fleet.length === 0) return;
    setFleet(prev => prev.slice(0, -1));
    setActiveIdx(prev => Math.max(0, prev - 1));
  };

  const randomize = () => {
    const g: boolean[][] = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(false));
    const newFleet: PlacedShip[] = [];
    FLEET_DEFS.forEach((def, id) => {
      for (let attempt = 0; attempt < 300; attempt++) {
        const h = Math.random() < 0.5;
        const r = Math.floor(Math.random() * GRID_SIZE);
        const c = Math.floor(Math.random() * GRID_SIZE);
        if (canPlaceShip(g, r, c, def.size, h)) {
          placeShipOnGrid(g, r, c, def.size, h);
          newFleet.push({ id, size: def.size, row: r, col: c, horiz: h, sunk: false });
          break;
        }
      }
    });
    setFleet(newFleet);
    setActiveIdx(newFleet.length);
  };

  const startGame = async () => {
    if (!isOnline) {
      navigate("/raetsel/kuestenkrieg/battle", { state: { fleet, aiMode } });
      return;
    }
    if (!gameCode || !uid) return;
    setWaiting(true);

    const emptyShots = Array(GRID_SIZE * GRID_SIZE).fill("unknown");

    await updateDoc(doc(db, "kuestenkriegGames", gameCode), {
      [`players.${uid}.fleet`]: fleet,
      [`players.${uid}.fleetReady`]: true,
    });

    const unsub = onSnapshot(doc(db, "kuestenkriegGames", gameCode), snap => {
      if (!snap.exists()) return;
      const g = { gameId: snap.id, ...snap.data() } as KriegOnlineGame;

      // Check if both players are ready and we need to start the game
      const allReady = g.playerIds.length === 2 && g.playerIds.every(id => g.players[id]?.fleetReady);

      if (allReady && g.status === "PLACEMENT") {
        // Both ready — start the battle (any client can trigger this, idempotent)
        updateDoc(doc(db, "kuestenkriegGames", gameCode), {
          status: "RUNNING",
          turn: g.adminId,
          shots: Object.fromEntries(g.playerIds.map(id => [id, emptyShots])),
        }).catch(() => {});
      }

      if (g.status === "RUNNING") {
        unsub();
        unsubRef.current = null;
        navigate("/raetsel/kuestenkrieg/online-battle", { state: { gameCode } });
      }
    });
    unsubRef.current = unsub;
  };

  // Compute cell states
  const occupiedGrid = getGrid();

  const previewCells = new Set<string>();
  const previewValid = hoverCell && !allPlaced
    ? canPlaceShip(occupiedGrid, hoverCell[0], hoverCell[1], currentDef.size, horiz)
    : false;
  if (hoverCell && !allPlaced) {
    for (let i = 0; i < currentDef.size; i++) {
      const pr = hoverCell[0] + (horiz ? 0 : i);
      const pc = hoverCell[1] + (horiz ? i : 0);
      if (pr >= 0 && pr < GRID_SIZE && pc >= 0 && pc < GRID_SIZE) {
        previewCells.add(`${pr},${pc}`);
      }
    }
  }

  const CELL = 32;

  const cellFromTouch = (clientX: number, clientY: number): [number, number] | null => {
    const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    if (!el) return null;
    const raw = el.dataset.cell ?? el.parentElement?.dataset.cell;
    if (!raw) return null;
    const [r, c] = raw.split(",").map(Number);
    return r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE ? [r, c] : null;
  };

  return (
    <div className="screen" style={{ gap: 0, paddingTop: 0 }}>
      <div style={{ background: "linear-gradient(135deg, var(--surface) 0%, var(--surface2) 100%)", padding: "16px 20px", display: "flex", alignItems: "center", gap: 14 }}>
        <button onClick={() => navigate("/raetsel/kuestenkrieg/lobby", { replace: true })} style={backBtn}>‹</button>
        <span style={{ fontSize: 28 }}>⚓</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>KÜSTENKRIEG</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text)" }}>
            Schiffe setzen{isOnline && <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 8 }}>— Online</span>}
          </div>
        </div>
        <div style={{ textAlign: "right", fontSize: 13, color: "var(--text-muted)" }}>{placed}/{FLEET_DEFS.length} gesetzt</div>
      </div>

      {waiting ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 32 }}>
          <div style={{ fontSize: 48 }}>⚓</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text)" }}>Flotte einsatzbereit!</div>
          <div style={{ fontSize: 14, color: "var(--text-muted)", textAlign: "center" }}>Warte auf Gegner…</div>
          <div style={{ display: "flex", gap: 4 }}>
            {[0, 1, 2].map(i => (
              <div
                key={i}
                style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: ACCENT,
                  animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                }}
              />
            ))}
          </div>
          <style>{`@keyframes pulse { 0%,80%,100%{opacity:0.3;transform:scale(0.8)} 40%{opacity:1;transform:scale(1.2)} }`}</style>
        </div>
      ) : (
        <div style={{ padding: "16px 16px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Ship selector */}
          {!allPlaced && (
            <div style={{ background: "var(--surface)", border: `1px solid ${ACCENT}55`, borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Jetzt setzen</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 20 }}>{currentDef.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{currentDef.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Länge {currentDef.size}</div>
                </div>
                <button
                  onClick={() => setHoriz(h => !h)}
                  style={{ padding: "8px 14px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700, color: "var(--text)" }}
                >
                  {horiz ? "↔ Horizontal" : "↕ Vertikal"}
                </button>
              </div>
            </div>
          )}

          {/* Grid */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div
              ref={gridRef}
              onTouchMove={e => { if (allPlaced) return; const t = e.touches[0]; setHoverCell(cellFromTouch(t.clientX, t.clientY)); }}
              onTouchEnd={() => setHoverCell(null)}
              onTouchCancel={() => setHoverCell(null)}
            >
              <div style={{ display: "flex", marginLeft: 22, marginBottom: 2 }}>
                {Array.from({ length: GRID_SIZE }, (_, i) => (
                  <div key={i} style={{ width: CELL, fontSize: 10, color: "var(--text-muted)", textAlign: "center", fontWeight: 700 }}>
                    {String.fromCharCode(65 + i)}
                  </div>
                ))}
              </div>
              {Array.from({ length: GRID_SIZE }, (_, r) => (
                <div key={r} style={{ display: "flex", alignItems: "center" }}>
                  <div style={{ width: 20, fontSize: 10, color: "var(--text-muted)", textAlign: "right", paddingRight: 2, fontWeight: 700 }}>{r + 1}</div>
                  {Array.from({ length: GRID_SIZE }, (_, c) => {
                    const key = `${r},${c}`;
                    const isOccupied = occupiedGrid[r][c];
                    const isPreview = previewCells.has(key);
                    let bg = "var(--surface)";
                    if (isOccupied) bg = ACCENT + "88";
                    else if (isPreview) bg = previewValid ? ACCENT + "44" : "#ef444444";
                    return (
                      <div
                        key={c}
                        data-cell={`${r},${c}`}
                        onClick={() => handleCellClick(r, c)}
                        onTouchStart={() => { if (!allPlaced) setHoverCell([r, c]); }}
                        onMouseEnter={() => setHoverCell([r, c])}
                        onMouseLeave={() => setHoverCell(null)}
                        style={{ width: CELL, height: CELL, background: bg, border: "1px solid var(--border)", cursor: allPlaced ? "default" : "pointer", boxSizing: "border-box" }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={removeLastShip}
              disabled={fleet.length === 0}
              style={{ flex: 1, padding: "12px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, cursor: fleet.length === 0 ? "default" : "pointer", fontSize: 13, fontWeight: 700, color: "var(--text-muted)", opacity: fleet.length === 0 ? 0.4 : 1 }}
            >
              ⌫ Rückgängig
            </button>
            <button
              onClick={randomize}
              style={{ flex: 1, padding: "12px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 700, color: "var(--text)" }}
            >
              🎲 Zufällig
            </button>
          </div>

          {/* Fleet checklist */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {FLEET_DEFS.map((def, i) => (
              <div
                key={i}
                style={{
                  padding: "6px 10px",
                  background: i < placed ? ACCENT + "22" : "var(--surface)",
                  border: `1px solid ${i < placed ? ACCENT + "55" : i === activeIdx && !allPlaced ? ACCENT : "var(--border)"}`,
                  borderRadius: 8, fontSize: 12,
                  color: i < placed ? ACCENT : "var(--text-muted)",
                  fontWeight: i === activeIdx && !allPlaced ? 800 : 500,
                }}
              >
                {def.emoji} {def.name}
              </div>
            ))}
          </div>

          {/* Start button */}
          <button
            onClick={allPlaced ? startGame : undefined}
            disabled={!allPlaced}
            style={{
              padding: "16px", background: allPlaced ? ACCENT : "var(--surface)", border: "none",
              borderRadius: 14, cursor: allPlaced ? "pointer" : "default",
              fontSize: 16, fontWeight: 800, color: allPlaced ? "#0a1628" : "var(--text-muted)",
              opacity: allPlaced ? 1 : 0.5, transition: "all 0.2s",
            }}
          >
            {allPlaced
              ? isOnline ? "⚓ Bereit!" : "⚓ Auf ins Gefecht!"
              : `Noch ${FLEET_DEFS.length - placed} Schiff${FLEET_DEFS.length - placed !== 1 ? "e" : ""} platzieren`}
          </button>
        </div>
      )}
    </div>
  );
}

const backBtn: React.CSSProperties = {
  width: 40, height: 40, flexShrink: 0, background: "var(--surface2)",
  border: "1px solid var(--border)", borderRadius: 12, cursor: "pointer",
  fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text)",
};
