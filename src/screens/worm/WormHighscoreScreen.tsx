import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase";

const WORM_GREEN = "#22c55e";

const DIFFICULTIES = [
  { id: "ROOKIE",     emoji: "🌊", label: "Rookie",     sub: "Langsam · Wände töten" },
  { id: "SNIPER",     emoji: "🎯", label: "Sniper",     sub: "Mittel · Wände töten" },
  { id: "BOSS_LEVEL", emoji: "💪", label: "Boss Level", sub: "Schnell · Wände = Teleport" },
] as const;

export default function WormHighscoreScreen() {
  const [highScores, setHighScores] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid) return;
    getDoc(doc(db, "users", uid)).then((snap) => {
      if (snap.exists()) {
        setHighScores((snap.data().wormHighScores as Record<string, number>) ?? {});
      }
      setLoading(false);
    });
  }, [uid]);

  return (
    <div className="screen" style={{ gap: 0, paddingTop: 0 }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "16px 16px 12px",
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
      }}>
        <button className="btn btn-outline btn-sm" onClick={() => navigate("/worm/lobby")}>‹ Zurück</button>
        <div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>WATTWURM</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>🏆 Rekorde</div>
        </div>
      </div>

      <div style={{ overflowY: "auto", flex: 1 }}>
        {/* Hero */}
        <div style={{
          background: "linear-gradient(135deg, rgba(34,197,94,0.15) 0%, #0a1628 100%)",
          padding: "28px 20px",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 64 }}>🏆</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#fbbf24", marginTop: 8 }}>Deine Bestleistungen</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            Wattwurm – Alle Schwierigkeitsstufen
          </div>
        </div>

        <div style={{ padding: "24px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 32 }}>
              <span style={{ fontSize: 32 }}>🪱</span>
            </div>
          ) : (
            DIFFICULTIES.map(({ id, emoji, label, sub }) => {
              const score = highScores[id];
              const hasScore = score != null && score > 0;
              return (
                <div key={id} style={{
                  background: hasScore ? "rgba(34,197,94,0.08)" : "var(--surface)",
                  border: `${hasScore ? 2 : 1}px solid ${hasScore ? "rgba(34,197,94,0.5)" : "var(--border)"}`,
                  borderRadius: "var(--radius)",
                  padding: "18px 20px",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <span style={{ fontSize: 36 }}>{emoji}</span>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: hasScore ? "var(--text)" : "var(--text-muted)" }}>
                        {label}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                        {hasScore ? "Persönlicher Rekord" : sub}
                      </div>
                    </div>
                  </div>
                  {hasScore ? (
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 28, fontWeight: 800, color: "#fbbf24" }}>{score}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Punkte</div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 28, color: "var(--text-muted)", fontWeight: 700 }}>–</div>
                  )}
                </div>
              );
            })
          )}

          {/* Play CTA */}
          <button
            className="btn btn-primary"
            style={{ background: WORM_GREEN, borderColor: WORM_GREEN, marginTop: 8 }}
            onClick={() => navigate("/worm/lobby")}
          >
            🪱 Zur Lobby
          </button>
        </div>
      </div>
    </div>
  );
}
