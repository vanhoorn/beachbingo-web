import { useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  FLEET_DEFS, GRID, canPlaceShip, placeShipOnGrid,
  type PlacedShip, type AiMode,
} from "./kuestenkriegBattleLogic";

const ACCENT = "#fb7185";

interface LocState {
  aiMode?: AiMode;
}

export default function KuestenkriegPlacementScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { aiMode } = (location.state ?? {}) as LocState;

  const [fleet, setFleet] = useState<PlacedShip[]>([]);
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const [horiz, setHoriz] = useState(true);
  const [hoverCell, setHoverCell] = useState<[number, number] | null>(null);

  const currentDef = FLEET_DEFS[activeIdx];
  const placed = fleet.length;
  const allPlaced = placed === FLEET_DEFS.length;

  const getGrid = useCallback((): boolean[][] => {
    const g: boolean[][] = Array.from({ length: GRID }, () => Array(GRID).fill(false));
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
    const g: boolean[][] = Array.from({ length: GRID }, () => Array(GRID).fill(false));
    const newFleet: PlacedShip[] = [];
    FLEET_DEFS.forEach((def, id) => {
      for (let attempt = 0; attempt < 300; attempt++) {
        const h = Math.random() < 0.5;
        const r = Math.floor(Math.random() * GRID);
        const c = Math.floor(Math.random() * GRID);
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

  const startGame = () => {
    navigate("/raetsel/kuestenkrieg/battle", { state: { fleet, aiMode } });
  };

  // Compute cell states
  const occupiedGrid = getGrid();

  // Preview ship placement
  const previewCells = new Set<string>();
  const previewValid = hoverCell && !allPlaced
    ? canPlaceShip(occupiedGrid, hoverCell[0], hoverCell[1], currentDef.size, horiz)
    : false;
  if (hoverCell && !allPlaced) {
    for (let i = 0; i < currentDef.size; i++) {
      const pr = hoverCell[0] + (horiz ? 0 : i);
      const pc = hoverCell[1] + (horiz ? i : 0);
      if (pr >= 0 && pr < GRID && pc >= 0 && pc < GRID) {
        previewCells.add(`${pr},${pc}`);
      }
    }
  }

  const CELL = 32;

  return (
    <div className="screen" style={{ gap: 0, paddingTop: 0 }}>
      <div style={{ background: "linear-gradient(135deg, var(--surface) 0%, var(--surface2) 100%)", padding: "16px 20px", display: "flex", alignItems: "center", gap: 14 }}>
        <button onClick={() => navigate(-1)} style={backBtn}>‹</button>
        <span style={{ fontSize: 28 }}>⚓</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>KÜSTENKRIEG</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text)" }}>Schiffe setzen</div>
        </div>
        <div style={{ textAlign: "right", fontSize: 13, color: "var(--text-muted)" }}>
          {placed}/{FLEET_DEFS.length} gesetzt
        </div>
      </div>

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
          <div>
            {/* Column labels */}
            <div style={{ display: "flex", marginLeft: 22, marginBottom: 2 }}>
              {Array.from({ length: GRID }, (_, i) => (
                <div key={i} style={{ width: CELL, fontSize: 10, color: "var(--text-muted)", textAlign: "center", fontWeight: 700 }}>
                  {String.fromCharCode(65 + i)}
                </div>
              ))}
            </div>
            {Array.from({ length: GRID }, (_, r) => (
              <div key={r} style={{ display: "flex", alignItems: "center" }}>
                <div style={{ width: 20, fontSize: 10, color: "var(--text-muted)", textAlign: "right", paddingRight: 2, fontWeight: 700 }}>
                  {r + 1}
                </div>
                {Array.from({ length: GRID }, (_, c) => {
                  const key = `${r},${c}`;
                  const isOccupied = occupiedGrid[r][c];
                  const isPreview = previewCells.has(key);
                  let bg = "var(--surface)";
                  if (isOccupied) bg = ACCENT + "88";
                  else if (isPreview) bg = previewValid ? ACCENT + "44" : "#ef444444";
                  return (
                    <div
                      key={c}
                      onClick={() => handleCellClick(r, c)}
                      onMouseEnter={() => setHoverCell([r, c])}
                      onMouseLeave={() => setHoverCell(null)}
                      style={{
                        width: CELL, height: CELL,
                        background: bg,
                        border: "1px solid var(--border)",
                        cursor: allPlaced ? "default" : "pointer",
                        boxSizing: "border-box",
                      }}
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
                borderRadius: 8,
                fontSize: 12,
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
          onClick={startGame}
          disabled={!allPlaced}
          style={{
            padding: "16px", background: allPlaced ? ACCENT : "var(--surface)", border: "none",
            borderRadius: 14, cursor: allPlaced ? "pointer" : "default",
            fontSize: 16, fontWeight: 800, color: allPlaced ? "#0a1628" : "var(--text-muted)",
            opacity: allPlaced ? 1 : 0.5, transition: "all 0.2s",
          }}
        >
          {allPlaced ? "⚓ Auf ins Gefecht!" : `Noch ${FLEET_DEFS.length - placed} Schiff${FLEET_DEFS.length - placed !== 1 ? "e" : ""} platzieren`}
        </button>
      </div>
    </div>
  );
}

const backBtn: React.CSSProperties = {
  width: 40, height: 40, flexShrink: 0, background: "var(--surface2)",
  border: "1px solid var(--border)", borderRadius: 12, cursor: "pointer",
  fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text)",
};
