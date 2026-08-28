import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { doc, onSnapshot, updateDoc, addDoc, collection } from "firebase/firestore";
import { auth, db } from "../../../firebase";
import { shipCells, GRID } from "./kuestenkriegBattleLogic";
import type { PlacedShip } from "./kuestenkriegBattleLogic";
import type { KriegOnlineGame } from "../../../types";

const ACCENT = "#fb7185";
const CELL = Math.max(30, Math.min(40, Math.floor((Math.min(window.innerWidth, 520) - 70) / GRID)));

const KK_CONSTELLATION_NAMES = [
  "Korallenflotte|Sandburgbataillon", "SprottenGirls|DorschBabys",
  "PalmenBoys|SchlauchbootMatrosen", "Wattjäger|Muschelsammler",
  "Möwenpiraten|Krakenflüsterer", "Brandungsreiter|Sandkastenkapitäne",
  "Tintenfischbande|Strandwächter", "Nordseeadler|Wattwurmbrigade",
  "Barrakuda-Crew|Seepferdchen-Staffel", "Wellenreiter|Sanddünenkommando",
  "Heringsjäger|Austernretter", "Salzwasserwölfe|Bademeister-Union",
  "Kormorantruppe|Strandkorbverteidiger", "Anker-Asse|Flaggen-Flatterer",
  "Neptunsgarde|Strandräuber-Koalition", "Krabbenklau-Clan|Muschelpiraten",
  "Tiefseebande|Flachlandmatrosen", "Sturmflut-Staffel|Sandburg-Söldner",
  "Möwenkönige|Plastikenten-Piraten", "Blauwal-Brigade|Minigolf-Miliz",
  "Sardellen-Syndrom|Lachs-Legion", "Schaumkronen-Crew|Treibholz-Truppe",
  "Quallen-Quartier|Sonnencrème-Söldner", "Brandungs-Barbaren|Wellenbrecher",
  "Ebbe-Allianz|Flut-Front",
];

function constellationTitle(uid1: string, uid2: string): string {
  const sorted = [uid1, uid2].sort();
  const key = sorted.join("|");
  let hash = 0n;
  for (const c of key) hash = (hash * 31n + BigInt(c.charCodeAt(0))) & 0x7FFFFFFFFFFFFFFFn;
  const idx = Number(hash % 25n);
  const pair = KK_CONSTELLATION_NAMES[idx].split("|");
  return Number((hash / 25n) % 2n) === 0 ? `${pair[0]} vs. ${pair[1]}` : `${pair[1]} vs. ${pair[0]}`;
}

interface LocState { gameCode: string }
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

function isShipSunk(ship: PlacedShip, shots: string[]): boolean {
  return shipCells(ship).every(([r, c]) => {
    const v = shots[r * GRID + c];
    return v === "hit" || v === "sunk";
  });
}

function computeShot(
  flatShots: string[],
  r: number,
  c: number,
  opponentFleet: PlacedShip[],
): { newShots: string[]; winner: boolean } {
  const idx = r * GRID + c;
  const newShots = [...flatShots];

  const hitShip = opponentFleet.find(s =>
    shipCells(s).some(([sr, sc]) => sr === r && sc === c)
  );

  if (hitShip) {
    newShots[idx] = "hit";
    const sunkNow = shipCells(hitShip).every(([sr, sc]) => {
      const i = sr * GRID + sc;
      return newShots[i] === "hit" || newShots[i] === "sunk";
    });
    if (sunkNow) {
      shipCells(hitShip).forEach(([sr, sc]) => { newShots[sr * GRID + sc] = "sunk"; });
    }
  } else {
    newShots[idx] = "miss";
  }

  const winner = opponentFleet.every(s =>
    shipCells(s).every(([sr, sc]) => newShots[sr * GRID + sc] === "sunk")
  );
  return { newShots, winner };
}

export default function KuestenkriegOnlineBattleScreen() {
  const navigate = useNavigate();
  const { gameCode } = (useLocation().state ?? {}) as LocState;
  const uid = auth.currentUser?.uid ?? "";

  const [game, setGame] = useState<KriegOnlineGame | null>(null);
  const [lastMsg, setLastMsg] = useState<string | null>(null);
  const [shooting, setShooting] = useState(false);

  useEffect(() => {
    if (!gameCode) return;
    const unsub = onSnapshot(doc(db, "kuestenkriegGames", gameCode), snap => {
      if (!snap.exists()) return;
      const g = { gameId: snap.id, ...snap.data() } as KriegOnlineGame;
      setGame(g);
    });
    return () => unsub();
  }, [gameCode]);

  if (!game) {
    return (
      <div className="screen" style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 36 }}>⚓</div>
        <div style={{ color: "var(--text-muted)", marginTop: 8 }}>Lade…</div>
      </div>
    );
  }

  const oppId = game.playerIds.find(id => id !== uid) ?? "";
  const myFleet = (game.players[uid]?.fleet ?? []) as PlacedShip[];
  const oppFleet = (game.players[oppId]?.fleet ?? []) as PlacedShip[];

  const myShots = game.shots[uid] ?? Array(GRID * GRID).fill("unknown");
  const oppShots = game.shots[oppId] ?? Array(GRID * GRID).fill("unknown");

  const isMyTurn = game.turn === uid && game.status === "RUNNING";
  const isOver = game.status === "FINISHED";
  const iWon = game.winner === uid;
  const oppName = game.players[oppId]?.displayName ?? "Gegner";

  const myRemainingCells = myFleet
    .filter(s => !isShipSunk(s, oppShots))
    .reduce((sum, s) => sum + s.size, 0);
  const oppRemainingCells = oppFleet
    .filter(s => !isShipSunk(s, myShots))
    .reduce((sum, s) => sum + s.size, 0);

  const handleShoot = async (r: number, c: number) => {
    if (!isMyTurn || shooting || isOver) return;
    const idx = r * GRID + c;
    if (myShots[idx] !== "unknown") return;
    setShooting(true);

    const { newShots, winner } = computeShot([...myShots], r, c, oppFleet);

    const hit = newShots[idx] !== "miss";
    const sunk = newShots[idx] === "sunk" || (hit && !oppFleet.find(s =>
      shipCells(s).some(([sr, sc]) => sr === r && sc === c) && !isShipSunk(s, newShots)
    ));

    setLastMsg(
      sunk ? `${String.fromCharCode(65 + c)}${r + 1} — Versenkt! 💥`
        : hit ? `${String.fromCharCode(65 + c)}${r + 1} — Treffer! 🎯`
          : `${String.fromCharCode(65 + c)}${r + 1} — Wasser!`
    );
    setTimeout(() => setLastMsg(null), 2500);

    const update: Record<string, unknown> = {
      [`shots.${uid}`]: newShots,
      turn: winner ? uid : hit ? uid : oppId,
    };
    if (winner) {
      update.winner = uid;
      update.status = "FINISHED";
    }
    await updateDoc(doc(db, "kuestenkriegGames", gameCode), update);
    if (winner) {
      const myName = game.players[uid]?.displayName ?? "";
      const myAvatar = game.players[uid]?.avatarUrl ?? "";
      const oppAvatar = game.players[oppId]?.avatarUrl ?? "";
      void addDoc(collection(db, "kuestenkriegResults"), {
        gameCode,
        winnerId: uid,
        loserId: oppId,
        playerIds: [uid, oppId],
        playerNames: [myName, oppName],
        playerAvatars: [myAvatar, oppAvatar],
        shotsFiredByWinner: newShots.filter(s => s !== "unknown").length,
        shotsFiredByLoser: (game.shots[oppId] ?? []).filter(s => s !== "unknown").length,
        constellationTitle: constellationTitle(uid, oppId),
        mode: "online",
        createdAt: Date.now(),
      });
    }
    setShooting(false);
  };

  // My grid (opponent's shots on my fleet)
  const myGrid = Array.from({ length: GRID }, (_, r) =>
    Array.from({ length: GRID }, (_, c): CellView => {
      const shot = oppShots[r * GRID + c];
      if (shot === "hit")  return "hit";
      if (shot === "sunk") return "sunk";
      if (shot === "miss") return "miss";
      const hasShip = myFleet.some(s =>
        shipCells(s).some(([sr, sc]) => sr === r && sc === c) && !isShipSunk(s, oppShots)
      );
      return hasShip ? "myship" : "unknown";
    })
  );

  // Enemy grid (my shots on opponent's fleet — don't reveal ships)
  const enemyGrid = Array.from({ length: GRID }, (_, r) =>
    Array.from({ length: GRID }, (_, c): CellView => myShots[r * GRID + c] as CellView)
  );

  const headerText = isOver
    ? iWon ? "🏆 Sieg!" : "💀 Niederlage!"
    : shooting ? "Schuss…"
    : isMyTurn ? "Dein Schuss 🎯"
    : `${oppName} schießt…`;

  return (
    <div className="screen" style={{ gap: 0, paddingTop: 0 }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, var(--surface) 0%, var(--surface2) 100%)", padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={() => navigate("/raetsel/kuestenkrieg/lobby", { replace: true })} style={backBtn}>‹</button>
        <span style={{ fontSize: 24 }}>⚓</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5 }}>KÜSTENKRIEG · ONLINE</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{headerText}</div>
        </div>
        <div style={{ textAlign: "right", fontSize: 11, color: "var(--text-muted)" }}>
          <div>Du: {myRemainingCells} ❤️</div>
          <div>{oppName}: {oppRemainingCells} 💀</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px 8px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Message */}
        {lastMsg && (
          <div style={{ background: ACCENT + "22", border: `1px solid ${ACCENT}55`, borderRadius: 10, padding: "10px 14px", textAlign: "center", fontSize: 14, fontWeight: 700, color: ACCENT }}>
            {lastMsg}
          </div>
        )}
        {!isMyTurn && !isOver && !lastMsg && (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>
            {oppName} ist am Zug…
          </div>
        )}

        {/* Enemy grid — player shoots here */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, textAlign: "center" }}>
            {oppName}s Gewässer{isMyTurn && !isOver && <span style={{ color: ACCENT }}> ← Tippen!</span>}
          </div>
          {GridView(enemyGrid, handleShoot, isMyTurn && !isOver && !shooting)}
        </div>

        {/* My grid */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, textAlign: "center" }}>
            Dein Gewässer
          </div>
          {GridView(myGrid, () => {}, false)}
        </div>

        {/* Game over */}
        {isOver && (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "20px", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>{iWon ? "🏆" : "💀"}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text)", marginBottom: 4 }}>
              {iWon ? "Du hast gewonnen!" : `${oppName} hat gewonnen!`}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
              {iWon ? "Alle feindlichen Schiffe versenkt!" : "Deine Flotte wurde vernichtet!"}
            </div>
            <button
              onClick={() => navigate("/raetsel/kuestenkrieg/lobby", { replace: true })}
              style={{ width: "100%", padding: "14px", background: ACCENT, border: "none", borderRadius: 12, cursor: "pointer", fontSize: 15, fontWeight: 800, color: "#0a1628" }}
            >
              Zurück zur Lobby
            </button>
          </div>
        )}
      </div>
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
