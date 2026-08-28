import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "../../firebase";

const KT_COLOR = "#8B5CF6";
const KT_DIM   = "rgba(139,92,246,0.12)";

interface KlonResultPlayer {
  userId: string;
  displayName: string;
  avatarUrl: string;
  cardCount: number;
}

interface KlonResult {
  winnerId: string;
  winnerName: string;
  winnerAvatar: string;
  players: KlonResultPlayer[];
}

interface KlonHistoryEntry {
  winnerId: string;
  winnerName: string;
  winnerAvatar: string;
  playerIds: string[];
  players: { userId: string; displayName: string; avatarUrl: string }[];
  teamName: string;
  mode: string;
  difficulty: string;
  createdAt: number;
}

interface KlonPlayerStat { wins: number; played: number; }
interface KlonTeam {
  key: string;
  teamName: string;
  playerStats: Map<string, KlonPlayerStat>;
  playerList: { userId: string; displayName: string; avatarUrl: string }[];
  games: KlonHistoryEntry[];
}

function buildTeams(games: KlonHistoryEntry[]): KlonTeam[] {
  const map = new Map<string, KlonHistoryEntry[]>();
  for (const g of games) {
    const key = [...g.playerIds].sort().join("|");
    const existing = map.get(key);
    if (existing) existing.push(g);
    else map.set(key, [g]);
  }
  const teams: KlonTeam[] = [];
  for (const [key, gs] of map.entries()) {
    const statsMap = new Map<string, KlonPlayerStat>();
    for (const g of gs) {
      for (const pid of g.playerIds) {
        const s = statsMap.get(pid) ?? { wins: 0, played: 0 };
        s.played++;
        if (pid === g.winnerId) s.wins++;
        statsMap.set(pid, { ...s });
      }
    }
    teams.push({
      key,
      teamName: gs[0].teamName,
      playerStats: statsMap,
      playerList: gs[0].players,
      games: gs,
    });
  }
  return teams.sort((a, b) => (b.games[0]?.createdAt ?? 0) - (a.games[0]?.createdAt ?? 0));
}

function fmtDate(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getFullYear()).slice(2)}`;
}

export default function KlontauschResultsScreen() {
  const navigate = useNavigate();
  const uid = auth.currentUser?.uid ?? "";
  const resultRaw = sessionStorage.getItem("klontauschResult");
  const [teams, setTeams] = useState<KlonTeam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    const q = query(collection(db, "klontauschResults"), where("playerIds", "array-contains", uid));
    const unsub = onSnapshot(q, snap => {
      const entries: KlonHistoryEntry[] = snap.docs.map(d => {
        const data = d.data();
        return {
          winnerId:    data.winnerId ?? "",
          winnerName:  data.winnerName ?? "",
          winnerAvatar: data.winnerAvatar ?? "🃏",
          playerIds:   data.playerIds ?? [],
          players:     (data.players ?? []) as KlonHistoryEntry["players"],
          teamName:    data.teamName ?? "",
          mode:        data.mode ?? "",
          difficulty:  data.difficulty ?? "",
          createdAt:   data.createdAt ?? 0,
        };
      }).sort((a, b) => b.createdAt - a.createdAt);
      setTeams(buildTeams(entries));
      setLoading(false);
    });
    return () => unsub();
  }, [uid]);

  const result: KlonResult | null = resultRaw ? JSON.parse(resultRaw) : null;
  const winner = result?.players.find(p => p.userId === result.winnerId);
  const others = result?.players.filter(p => p.userId !== result?.winnerId)
    .sort((a, b) => a.cardCount - b.cardCount) ?? [];

  return (
    <div className="screen">
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, #3b0764 0%, ${KT_COLOR} 100%)`,
        padding: "12px 16px", display: "flex", alignItems: "center", gap: 12,
      }}>
        <button onClick={() => navigate("/home", { replace: true })}
          style={{ background: "none", border: "none", color: "white", fontSize: 20, cursor: "pointer", padding: 4 }}>
          ←
        </button>
        <div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", letterSpacing: 1, textTransform: "uppercase" }}>KLONTAUSCH</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "white" }}>🃏 Ergebnisse</div>
        </div>
      </div>

      <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ── Letztes Spiel ────────────────────────────────────────────────── */}
        {result && winner && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase",
              letterSpacing: 1.2, marginBottom: 10 }}>Letztes Spiel</div>

            <div style={{ background: KT_DIM, border: `1px solid ${KT_COLOR}55`,
              borderRadius: "var(--radius)", padding: "20px 16px", textAlign: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 52 }}>🏆</div>
              <div style={{ fontSize: 22, marginTop: 4 }}>{winner.avatarUrl}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "white", marginTop: 6 }}>{winner.displayName}</div>
              <div style={{ fontSize: 13, color: KT_COLOR, marginTop: 4, fontWeight: 600 }}>
                hat alle Zielfiguren komplett!
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[winner, ...others].map((p, i) => {
                const isWin = p.userId === result.winnerId;
                return (
                  <div key={p.userId} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "10px 14px", borderRadius: 10,
                    background: isWin ? KT_DIM : "var(--surface)",
                    border: `1px solid ${isWin ? KT_COLOR + "44" : "var(--border)"}`,
                  }}>
                    <div style={{ fontSize: 18, fontWeight: 800, minWidth: 24, textAlign: "center",
                      color: isWin ? KT_COLOR : "var(--text-muted)" }}>{i + 1}.</div>
                    <span style={{ fontSize: 22 }}>{p.avatarUrl}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{p.displayName}</div>
                      {!isWin && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {p.cardCount} Karte{p.cardCount !== 1 ? "n" : ""} auf der Hand
                      </div>}
                    </div>
                    {isWin && <div style={{ fontSize: 16 }}>🏆</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Actions ─────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-outline" style={{ flex: 1 }}
            onClick={() => navigate("/home", { replace: true })}>
            🏠 Home
          </button>
          <button className="btn" style={{ flex: 2, background: KT_COLOR, color: "white", fontWeight: 700 }}
            onClick={() => navigate("/klontausch/lobby", { replace: true })}>
            Nochmal spielen 🃏
          </button>
        </div>

        {/* ── Spielstatistik ───────────────────────────────────────────────── */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase",
            letterSpacing: 1.2, marginBottom: 10 }}>Spielstatistik</div>

          {loading && (
            <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "20px 0", fontSize: 13 }}>
              Lade...
            </div>
          )}

          {!loading && teams.length === 0 && (
            <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "20px 0", fontSize: 13 }}>
              Noch keine Spielhistorie vorhanden.
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {teams.map(team => (
              <div key={team.key} style={{
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: "var(--radius)", padding: "14px 16px",
              }}>
                {/* Team header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{team.teamName}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {team.games.length} Spiel{team.games.length !== 1 ? "e" : ""}
                  </div>
                </div>

                {/* Player stats */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {team.playerList.map(p => {
                    const s = team.playerStats.get(p.userId);
                    if (!s) return null;
                    const isMe = p.userId === uid;
                    return (
                      <div key={p.userId} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "8px 10px", borderRadius: 8,
                        background: isMe ? KT_DIM : "var(--surface2)",
                      }}>
                        <span style={{ fontSize: 20 }}>{p.avatarUrl}</span>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{p.displayName}</span>
                          {isMe && <span style={{ fontSize: 11, color: KT_COLOR, marginLeft: 6 }}>(Du)</span>}
                        </div>
                        <div style={{ fontSize: 12, color: s.wins > 0 ? "#d4a017" : "var(--text-muted)",
                          fontWeight: s.wins > 0 ? 700 : 400 }}>
                          {s.wins} / {s.played} Siege
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Last 3 games */}
                {team.games.length > 0 && (
                  <>
                    <div style={{ borderTop: "1px solid var(--border)", margin: "10px 0 8px" }} />
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 }}>
                      Letzte Spiele
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {team.games.slice(0, 3).map((g, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-sub)" }}>
                            <span>🏆</span>
                            <span>{g.winnerAvatar} {g.winnerName}</span>
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{fmtDate(g.createdAt)}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}
