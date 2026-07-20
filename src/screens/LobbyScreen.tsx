import { useEffect, useState } from "react";
import { collection, doc, getDoc, onSnapshot, query, where, addDoc, updateDoc, arrayUnion, arrayRemove, deleteDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import type { BingoGame, User } from "../types";
import { BEACH_AVATARS } from "../types";
import GameRulesModal from "../components/GameRulesModal";
import { GAME_RULES } from "../gameRules";

function generateCard(): number[] {
  const cols: number[][] = [];
  const ranges = [[1,15],[16,30],[31,45],[46,60],[61,75]];
  for (let col = 0; col < 5; col++) {
    const [min, max] = ranges[col];
    const nums: number[] = [];
    while (nums.length < 5) {
      const n = Math.floor(Math.random() * (max - min + 1)) + min;
      if (!nums.includes(n)) nums.push(n);
    }
    cols.push(nums);
  }
  const flat: number[] = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      flat.push(cols[c][r]);
    }
  }
  flat[12] = 0;
  return flat;
}

export function flatToGrid(flat: number[]): number[][] {
  return Array.from({ length: 5 }, (_, r) => flat.slice(r * 5, r * 5 + 5));
}

function modeLabel(mode: string) {
  if (mode === "AUTO_MARK") return "🌊 Rookie";
  if (mode === "MANUAL_MARK") return "🎯 Sniper";
  if (mode === "MINI_BOSS_LEVEL") return "🔵 Mini Boss Level";
  return "💪 Boss Level";
}

export default function LobbyScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [games, setGames] = useState<BingoGame[]>([]);
  const [creating, setCreating] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const navigate = useNavigate();
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid) return;
    getDoc(doc(db, "users", uid)).then((snap) => {
      if (snap.exists()) setUser(snap.data() as User);
      setIsFavorite((snap.data()?.favoriteGames as string[] ?? []).includes("bingo"));
    });
  }, [uid]);

  async function toggleFavorite() {
    if (!uid) return;
    const next = !isFavorite;
    setIsFavorite(next);
    await updateDoc(doc(db, "users", uid), {
      favoriteGames: next ? arrayUnion("bingo") : arrayRemove("bingo"),
    });
  }

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, "games"), where("playerIds", "array-contains", uid));
    return onSnapshot(q, (snap) => {
      const gs = snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        if (data.players && !Array.isArray(data.players)) {
          data.players = Object.values(data.players as Record<string, unknown>);
        }
        return { gameId: d.id, ...data } as BingoGame;
      });
      setGames(gs.filter((g) => g.status !== "FINISHED").sort((a, b) => b.createdAt - a.createdAt));
    });
  }, [uid]);

  async function createGame() {
    if (!user || !uid) return;
    setCreating(true);
    try {
      const card = generateCard();
      const ref = await addDoc(collection(db, "games"), {
        adminId: uid,
        status: "LOBBY",
        gameMode: user.preferredGameMode || "AUTO_MARK",
        drawStyle: user.preferredDrawStyle || "INSTANT",
        players: { [uid]: { userId: uid, displayName: user.displayName, avatarUrl: user.avatarUrl, card: { grid: card, markedNumbers: [] as number[] }, hasBingo: false } },
        playerIds: [uid],
        drawnNumbers: [],
        currentNumber: null,
        drawAnimationActive: false,
        totalDrawCount: 0,
        eliminationInterval: user.bossLevelEliminationInterval || 5,
        eliminationPendingPlayerId: null,
        eliminationAnimationActive: false,
        eliminationPlayerName: null,
        eliminationPlayerAvatar: null,
        eliminationNumber: null,
        createdAt: Date.now(),
      });
      navigate(`/game/${ref.id}`);
    } finally {
      setCreating(false);
    }
  }

  async function deleteGame(e: React.MouseEvent, gameId: string) {
    e.stopPropagation();
    if (!confirm("Spiel wirklich löschen?")) return;
    await deleteDoc(doc(db, "games", gameId));
  }


  return (
    <div className="screen">
      {/* Zurück */}
      <button
        className="btn btn-outline btn-sm"
        style={{ alignSelf: "flex-start" }}
        onClick={() => navigate("/home")}
      >
        ‹ Spielauswahl
      </button>

      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, var(--primary-dark) 0%, #0a1f3c 100%)",
        borderRadius: "var(--radius)",
        padding: "20px",
        border: "1px solid var(--primary-dark)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div className="flex items-center" style={{ gap: 14 }}>
          <span style={{ fontSize: 40 }}>{user?.avatarUrl || "🏖️"}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, color: "#fff" }}>
              {user?.displayName || "…"}
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>
              {modeLabel(user?.preferredGameMode || "AUTO_MARK")}
            </div>
          </div>
        </div>
        <div className="flex" style={{ gap: 8 }}>
          <button
            className="btn btn-outline btn-sm"
            style={{ color: "rgba(255,255,255,0.8)", borderColor: "rgba(255,255,255,0.2)", width: 42, padding: 0, fontSize: 18 }}
            onClick={() => navigate("/results")}
            title="Ergebnisse"
          >🏆</button>
          <button
            className="btn btn-outline btn-sm"
            onClick={toggleFavorite}
            style={{ color: isFavorite ? "var(--accent)" : "rgba(255,255,255,0.8)", borderColor: isFavorite ? "var(--accent)" : "rgba(255,255,255,0.2)", width: 42, padding: 0, fontSize: 18 }}
          >
            {isFavorite ? "★" : "☆"}
          </button>
          <button
            className="btn btn-outline btn-sm"
            style={{ color: "rgba(255,255,255,0.8)", borderColor: "rgba(255,255,255,0.2)", width: 42, padding: 0, fontSize: 18 }}
            onClick={() => setShowRules(true)}
            title="Spielanleitung"
          ><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5" fill="currentColor"/></svg></button>
          <button
            className="btn btn-outline btn-sm"
            style={{ color: "rgba(255,255,255,0.8)", borderColor: "rgba(255,255,255,0.2)", width: 42, padding: 0, fontSize: 18 }}
            onClick={() => navigate("/settings")}
            title="Einstellungen"
          >⚙️</button>
        </div>
      </div>

      {/* Aktionen */}
      <div className="card flex flex-col gap-3">
        <h3>Spiel starten</h3>
        <button className="btn btn-accent" onClick={createGame} disabled={creating}>
          {creating ? "Erstelle Spiel…" : "🎲 Neues Spiel erstellen"}
        </button>
      </div>

      {/* Aktive Spiele */}
      {games.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="card-title" style={{ paddingLeft: 4 }}>Meine Spiele</div>
          {games.map((g) => (
            <div
              key={g.gameId}
              className="card flex items-center justify-between"
              style={{ cursor: "pointer", padding: "16px 20px" }}
              onClick={() => navigate(`/game/${g.gameId}`)}
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center" style={{ gap: 10 }}>
                  <span className={`badge ${g.status === "LOBBY" ? "badge-lobby" : "badge-running"}`}>
                    {g.status === "LOBBY" ? "Wartet" : "Läuft 🔥"}
                  </span>
                  <span style={{ fontSize: 14, color: "var(--text-sub)" }}>
                    {g.players.length} Spieler
                  </span>
                </div>
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  {modeLabel(g.gameMode)}
                </div>
              </div>
              <div className="flex items-center" style={{ gap: 8 }}>
                {g.adminId === uid && (
                  <button
                    className="btn btn-sm"
                    style={{
                      background: "transparent",
                      color: "var(--danger)",
                      border: "1px solid rgba(239,68,68,0.3)",
                      width: 34, height: 34, padding: 0, fontSize: 16,
                    }}
                    onClick={(e) => deleteGame(e, g.gameId)}
                    title="Spiel löschen"
                  >🗑️</button>
                )}
                <span style={{ color: "var(--primary)", fontSize: 24, lineHeight: 1 }}>›</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showRules && GAME_RULES["bingo"] && (
        <GameRulesModal rule={GAME_RULES["bingo"]} onClose={() => setShowRules(false)} />
      )}
      {/* hidden avatar ref */}
      <div style={{ display: "none" }}>{BEACH_AVATARS.map(a => a)}</div>
    </div>
  );
}
