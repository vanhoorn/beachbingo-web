import { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import type { GameResult } from "../types";

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
  wins: number;
  played: number;
}

interface BingoTeam {
  key: string;
  name: string;
  playerStats: PlayerStat[];
  results: GameResult[];
}

function buildTeams(results: GameResult[]): BingoTeam[] {
  const map = new Map<string, { players: Map<string, PlayerStat>; results: GameResult[] }>();
  for (const r of results) {
    const key = [...r.playerIds].sort().join("|");
    if (!map.has(key)) map.set(key, { players: new Map(), results: [] });
    const entry = map.get(key)!;
    entry.results.push(r);
    for (let i = 0; i < r.playerIds.length; i++) {
      const pid = r.playerIds[i];
      if (!entry.players.has(pid)) {
        entry.players.set(pid, {
          userId: pid,
          displayName: r.playerNames?.[i] ?? "?",
          avatarUrl: r.playerAvatars?.[i] ?? "🏄",
          wins: 0, played: 0,
        });
      }
      const stat = entry.players.get(pid)!;
      stat.played++;
      if (pid === r.winnerId) stat.wins++;
    }
  }
  return Array.from(map.entries())
    .map(([key, { players, results }]) => ({
      key,
      name: teamName(key),
      playerStats: Array.from(players.values()).sort((a, b) => b.wins - a.wins || b.played - a.played),
      results: results.sort((a, b) => b.finishedAt - a.finishedAt),
    }))
    .sort((a, b) => b.results.length - a.results.length);
}

export default function ResultsScreen() {
  const [teams, setTeams] = useState<BingoTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, "gameResults"), where("playerIds", "array-contains", uid));
    getDocs(q).then((snap) => {
      const results = snap.docs
        .map((d) => ({ resultId: d.id, ...d.data() } as GameResult))
        .sort((a, b) => b.finishedAt - a.finishedAt);
      setTeams(buildTeams(results));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [uid]);

  return (
    <div className="screen" style={{ gap: 16, paddingTop: 16 }}>
      <div className="flex items-center" style={{ gap: 12 }}>
        <button className="btn btn-outline btn-sm" onClick={() => navigate("/lobby", { replace: true })}>‹ Zurück</button>
        <h2 style={{ fontSize: 20 }}>BeachBingo Ergebnisse 🏆</h2>
      </div>

      {loading ? (
        <div className="text-center" style={{ paddingTop: 60 }}>
          <div style={{ fontSize: 40 }}>⏳</div>
        </div>
      ) : teams.length === 0 ? (
        <div className="text-center" style={{ paddingTop: 60 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🏖️</div>
          <div style={{ fontWeight: 600, fontSize: 17, marginBottom: 6 }}>Noch keine Ergebnisse</div>
          <div style={{ fontSize: 14, color: "var(--text-muted)" }}>Beende ein Spiel, um es hier zu sehen.</div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {teams.map((team) => {
            const total = team.playerStats.length;
            const lastGame = team.results[0];
            return (
              <div key={team.key} className="card" style={{ padding: "20px" }}>
                {/* Team Header */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontWeight: 800, fontSize: 17, color: "var(--accent)" }}>
                    🌊 {team.name}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 3, display: "flex", gap: 10 }}>
                    <span>{team.results.length} {team.results.length === 1 ? "Spiel" : "Spiele"}</span>
                    {lastGame && <span>· Zuletzt: {formatDate(lastGame.finishedAt)}</span>}
                  </div>
                </div>

                {/* Leaderboard */}
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {team.playerStats.map((p, rank) => {
                    const isLast = rank === total - 1;
                    const winPct = p.played > 0 ? Math.round((p.wins / p.played) * 100) : 0;
                    const isMe = p.userId === uid;
                    const isFirst = rank === 0;
                    return (
                      <div
                        key={p.userId}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "10px 0",
                          borderTop: rank > 0 ? "1px solid var(--border)" : "none",
                        }}
                      >
                        <span style={{ width: 26, textAlign: "center", fontSize: 18, flexShrink: 0 }}>
                          {rankEmoji(rank, isLast, total)}
                        </span>
                        <span style={{ fontSize: 24, flexShrink: 0 }}>{p.avatarUrl}</span>
                        <span style={{
                          flex: 1, fontSize: 14,
                          fontWeight: isMe ? 700 : isFirst ? 600 : 400,
                          color: isFirst ? "var(--accent)" : "var(--text)",
                        }}>
                          {p.displayName}{isMe ? " 👤" : ""}
                        </span>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: isFirst ? "var(--accent)" : "var(--primary)" }}>
                            {p.wins} Siege
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                            {p.played} Spiele · {winPct}%
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Last game detail */}
                {lastGame && (
                  <div style={{
                    marginTop: 12,
                    padding: "10px 12px",
                    background: "var(--surface2)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: 13,
                    color: "var(--text-muted)",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}>
                    <span style={{ fontSize: 18 }}>{lastGame.winnerAvatar}</span>
                    <span>Letztes Spiel: <strong style={{ color: "var(--text)" }}>{lastGame.winnerName}</strong> hat gewonnen · {lastGame.drawnNumbersCount} Zahlen</span>
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
