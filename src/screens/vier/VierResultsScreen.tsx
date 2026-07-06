import { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase";
import type { VierGame } from "../../types";
import { DrinkPiece } from "./drinkIcons";

const TEAM_NAMES = [
  "Die Strandpiraten", "Die Wellenreiter", "Die Muschelsammler",
  "Die Korallenritter", "Die Neptun-Crew", "Die Gezeitenbande",
  "Die Krakenbrüder", "Das Sturmsegel-Kollektiv", "Die Palmenwächter",
  "Die Tintenfisch-Allianz", "Die Goldflossen-Gang", "Die Meeresgötter",
  "Die Sandsturm-Fraktion", "Die Delphin-Division", "Die Seestern-Society",
  "Die Brandungshelden", "Die Lagune-Legenden", "Die Tiefseepiraten",
  "Die Mondgezeitengang", "Die Schatzinsel-Bande", "Die Seemanns-Gilde",
  "Die Haiflosse-Fraktion", "Die Perlensucher", "Die Riffwächter",
  "Die Salzwasser-Söldner",
];

function teamName(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) & 0x7fffffff;
  return TEAM_NAMES[hash % TEAM_NAMES.length];
}

function rankEmoji(rank: number, isLast: boolean, total: number): string {
  if (rank === 0) return "🥇";
  if (rank === 1 && total > 2) return "🥈";
  if (rank === 2 && total > 3) return "🥉";
  if (isLast && total > 2) return "🦀";
  return `${rank + 1}.`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

interface PlayerStat {
  userId: string;
  displayName: string;
  avatarUrl: string;
  drinkId: string;
  wins: number;
  draws: number;
  played: number;
}

interface VierTeam {
  key: string;
  name: string;
  isSolo: boolean;
  playerStats: PlayerStat[];
  games: VierGame[];
}

function buildTeams(games: VierGame[]): VierTeam[] {
  const map = new Map<string, { players: Map<string, PlayerStat>; games: VierGame[] }>();
  for (const g of games) {
    const key = [...g.playerIds].sort().join("|");
    if (!map.has(key)) map.set(key, { players: new Map(), games: [] });
    const entry = map.get(key)!;
    entry.games.push(g);
    for (const p of g.players) {
      if (!entry.players.has(p.userId)) {
        entry.players.set(p.userId, {
          userId: p.userId, displayName: p.displayName, avatarUrl: p.avatarUrl,
          drinkId: p.drinkId, wins: 0, draws: 0, played: 0,
        });
      }
      const stat = entry.players.get(p.userId)!;
      stat.played++;
      if (g.isDraw) stat.draws++;
      else if (p.userId === g.winnerId) stat.wins++;
    }
  }
  return Array.from(map.entries())
    .map(([key, { players, games }]) => ({
      key,
      name: teamName(key),
      isSolo: players.size === 1,
      playerStats: Array.from(players.values()).sort((a, b) => b.wins - a.wins || b.played - a.played),
      games: games.sort((a, b) => b.createdAt - a.createdAt),
    }))
    .sort((a, b) => b.games.length - a.games.length);
}

export default function VierResultsScreen() {
  const [teams, setTeams] = useState<VierTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, "vierGames"),
      where("playerIds", "array-contains", uid),
      where("status", "==", "FINISHED"),
    );
    getDocs(q)
      .then((snap) => {
        const games = snap.docs
          .map((d) => ({ gameId: d.id, ...d.data() } as VierGame))
          .sort((a, b) => b.createdAt - a.createdAt);
        setTeams(buildTeams(games));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [uid]);

  return (
    <div className="screen" style={{ gap: 16, paddingTop: 16 }}>
      <div className="flex items-center" style={{ gap: 12 }}>
        <button className="btn btn-outline btn-sm" onClick={() => navigate(-1)}>‹ Zurück</button>
        <h2 style={{ fontSize: 20 }}>Vier4Bier Ergebnisse 🏆</h2>
      </div>

      {loading ? (
        <div className="text-center" style={{ paddingTop: 60 }}>
          <div style={{ fontSize: 40 }}>⏳</div>
        </div>
      ) : teams.length === 0 ? (
        <div className="text-center" style={{ paddingTop: 60 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🍺</div>
          <div style={{ fontWeight: 600, fontSize: 17, marginBottom: 6 }}>Noch keine Ergebnisse</div>
          <div style={{ fontSize: 14, color: "var(--text-muted)" }}>Beende ein Spiel, um es hier zu sehen.</div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {teams.map((team) => {
            const total = team.playerStats.length;
            const lastGame = team.games[0];
            const lastWinner = lastGame && !lastGame.isDraw
              ? lastGame.players.find((p) => p.userId === lastGame.winnerId)
              : null;
            return (
              <div key={team.key} className="card" style={{ padding: "20px" }}>
                {/* Team Header */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontWeight: 800, fontSize: 17, color: "#C2410C" }}>
                    {team.isSolo ? "🤖" : "🍺"} {team.isSolo ? "Solo vs KI" : team.name}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 3, display: "flex", gap: 10 }}>
                    <span>{team.games.length} {team.games.length === 1 ? "Spiel" : "Spiele"}</span>
                    {lastGame && <span>· Zuletzt: {formatDate(lastGame.createdAt)}</span>}
                  </div>
                </div>

                {/* Leaderboard */}
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {team.playerStats.map((p, rank) => {
                    const isLast = rank === total - 1;
                    const winPct = p.played > 0 ? Math.round((p.wins / p.played) * 100) : 0;
                    const isMe = p.userId === uid;
                    const isFirst = rank === 0;
                    return (
                      <div
                        key={p.userId}
                        style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "10px 0",
                          borderTop: rank > 0 ? "1px solid var(--border)" : "none",
                        }}
                      >
                        <span style={{ width: 26, textAlign: "center", fontSize: 18, flexShrink: 0 }}>
                          {team.isSolo ? "🧑" : rankEmoji(rank, isLast, total)}
                        </span>
                        <DrinkPiece drinkId={p.drinkId} size={28} />
                        <span style={{
                          flex: 1, fontSize: 14,
                          fontWeight: isMe ? 700 : isFirst ? 600 : 400,
                          color: isFirst && !team.isSolo ? "#C2410C" : "var(--text)",
                        }}>
                          {p.displayName}{isMe ? " 👤" : ""}
                        </span>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: isFirst ? "#C2410C" : "var(--primary)" }}>
                            {p.wins} Siege
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                            {p.played} Sp · {p.draws > 0 ? `${p.draws} Unent. · ` : ""}{winPct}%
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Last game detail */}
                {lastGame && (
                  <div style={{
                    marginTop: 12, padding: "10px 12px",
                    background: "var(--surface2)", borderRadius: "var(--radius-sm)",
                    fontSize: 13, color: "var(--text-muted)",
                    display: "flex", alignItems: "center", gap: 8,
                  }}>
                    {lastWinner
                      ? <DrinkPiece drinkId={lastWinner.drinkId} size={22} />
                      : <span style={{ fontSize: 18 }}>🤝</span>
                    }
                    <span>
                      Letztes Spiel: <strong style={{ color: "var(--text)" }}>
                        {lastGame.isDraw ? "Unentschieden" : lastWinner ? `${lastWinner.displayName} hat gewonnen` : "Spiel beendet"}
                      </strong>
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
