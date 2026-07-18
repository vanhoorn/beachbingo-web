import { useEffect, useState } from "react";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase";

const TEAL = "#0d9488";

interface BrandungResult {
  resultId: string;
  adminId: string;
  playerIds: string[];
  winnerId: string | null;
  rounds: number;
  finishedAt: number;
}

export default function BrandungResultsScreen() {
  const navigate = useNavigate();
  const uid = auth.currentUser?.uid ?? "";
  const [results, setResults] = useState<BrandungResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, "brandungResults"),
      where("playerIds", "array-contains", uid),
      orderBy("finishedAt", "desc"),
      limit(30),
    );
    getDocs(q).then(snap => {
      setResults(snap.docs.map(d => ({ resultId: d.id, ...d.data() }) as BrandungResult));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [uid]);

  const wins = results.filter(r => r.winnerId === uid).length;
  const total = results.length;

  return (
    <div className="screen">
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #064e47 0%, #0d9488 100%)",
        padding: "12px 16px", display: "flex", alignItems: "center", gap: 12,
      }}>
        <button onClick={() => navigate(-1)} style={{
          background: "none", border: "none", color: "white", fontSize: 20, cursor: "pointer", padding: 4,
        }}>←</button>
        <div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", letterSpacing: 1, textTransform: "uppercase" }}>BRANDUNG</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "white" }}>🏆 Ergebnisse</div>
        </div>
      </div>

      {/* Stats */}
      {total > 0 && (
        <div style={{ padding: "12px 16px", display: "flex", gap: 10 }}>
          <StatBox label="Gespielt" value={total} />
          <StatBox label="Gewonnen" value={wins} color={TEAL} />
          <StatBox label="Winrate" value={`${total > 0 ? Math.round((wins / total) * 100) : 0}%`} color={wins > total / 2 ? TEAL : undefined} />
        </div>
      )}

      <div style={{ padding: "0 16px", flex: 1, overflow: "auto" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)", fontSize: 14 }}>
            Lädt…
          </div>
        ) : results.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ fontSize: 48 }}>🌊</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", marginTop: 12 }}>Noch keine Spiele</div>
            <div style={{ fontSize: 13, color: "var(--text-sub)", marginTop: 6 }}>Spiel deine erste Runde Brandung!</div>
            <button className="btn" onClick={() => navigate("/brandung/lobby")}
              style={{ marginTop: 20, background: TEAL, color: "white", padding: "12px 28px" }}>
              Jetzt spielen
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {results.map(r => {
              const isWin = r.winnerId === uid;
              const date = new Date(r.finishedAt);
              const dateStr = date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
              const timeStr = date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
              return (
                <div key={r.resultId} className="card" style={{
                  padding: "12px 14px", display: "flex", alignItems: "center", gap: 12,
                  border: `1px solid ${isWin ? "rgba(13,148,136,0.3)" : "var(--border)"}`,
                  background: isWin ? "rgba(13,148,136,0.06)" : "var(--surface)",
                }}>
                  <div style={{ fontSize: 28 }}>{isWin ? "🏆" : "🌊"}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: isWin ? TEAL : "var(--text)" }}>
                      {isWin ? "Gewonnen!" : "Verloren"}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-sub)", marginTop: 2 }}>
                      {r.rounds} Runde{r.rounds !== 1 ? "n" : ""} · {r.playerIds.length} Spieler
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "right" }}>
                    <div>{dateStr}</div>
                    <div>{timeStr}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!loading && results.length > 0 && (
        <div style={{ padding: "12px 16px" }}>
          <button className="btn" onClick={() => navigate("/brandung/lobby")}
            style={{ width: "100%", background: TEAL, color: "white", padding: "13px" }}>
            Neue Runde 🌊
          </button>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="card" style={{ flex: 1, padding: "10px 8px", textAlign: "center" }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: color ?? "var(--text)" }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--text-sub)", marginTop: 2 }}>{label}</div>
    </div>
  );
}
