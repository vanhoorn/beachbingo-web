import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase";

const RED = "#dc2626";

export default function StrandturmHighscoreScreen() {
  const [highScore, setHighScore] = useState<number | null>(null);
  const [bestLevel, setBestLevel] = useState<number | null>(null);
  const [loading, setLoading]     = useState(true);
  const navigate = useNavigate();
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid) return;
    getDoc(doc(db, "users", uid)).then((snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setHighScore(d.strandturmHighScore ?? 0);
        setBestLevel(d.strandturmBestLevel ?? 0);
      }
      setLoading(false);
    });
  }, [uid]);

  const hasScore = (highScore ?? 0) > 0;
  const isKillScreen = (bestLevel ?? 0) >= 22;

  return (
    <div className="screen" style={{ gap: 0, paddingTop: 0 }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "16px 16px 12px",
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
      }}>
        <button className="btn btn-outline btn-sm" onClick={() => navigate("/strandturm/lobby")}>‹ Zurück</button>
        <div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>STRANDTURM</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>🏆 Rekord</div>
        </div>
      </div>

      <div style={{ overflowY: "auto", flex: 1 }}>
        {/* Hero */}
        <div style={{
          background: `linear-gradient(135deg, rgba(220,38,38,0.15) 0%, ${BG} 100%)`,
          padding: "28px 20px", textAlign: "center",
        }}>
          <div style={{ fontSize: 64 }}>🗼</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#fbbf24", marginTop: 8 }}>
            Deine Bestleistung
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            Strandturm – Klettere so hoch wie möglich!
          </div>
        </div>

        <div style={{ padding: "24px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 32 }}>
              <span style={{ fontSize: 32 }}>🗼</span>
            </div>
          ) : hasScore ? (
            <>
              <div style={{
                background: `rgba(220,38,38,0.08)`,
                border: `2px solid rgba(220,38,38,0.5)`,
                borderRadius: "var(--radius)",
                padding: "20px 24px",
                textAlign: "center",
              }}>
                <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 6 }}>Höchste Punktzahl</div>
                <div style={{ fontSize: 42, fontWeight: 900, color: RED }}>{highScore}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Punkte</div>
              </div>

              <div style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: "18px 24px",
                textAlign: "center",
              }}>
                <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 6 }}>Höchstes Level</div>
                <div style={{ fontSize: 36, fontWeight: 900, color: "var(--primary)" }}>Lv. {bestLevel}</div>
                {isKillScreen && (
                  <div style={{ fontSize: 13, color: "#fbbf24", marginTop: 6, fontWeight: 700 }}>
                    💀 Kill Screen erreicht!
                  </div>
                )}
              </div>

              <div className="card" style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.7 }}>
                <div style={{ fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Tipp</div>
                {(bestLevel ?? 0) < 5
                  ? "Ab Level 5 erreichen Kokosnüsse ihre Höchstgeschwindigkeit. Bleib am Ball!"
                  : (bestLevel ?? 0) < 22
                  ? "Exzellent! Der Kill Screen liegt bei Level 22 — schaffst du es?"
                  : "Du hast den berüchtigten Kill Screen erreicht. Absolute Legende! 🏆"}
              </div>
            </>
          ) : (
            <div style={{
              textAlign: "center", padding: "40px 20px",
              color: "var(--text-muted)", fontSize: 15,
            }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🥥</div>
              Noch kein Spiel gespielt.<br />
              <span style={{ fontSize: 13 }}>Klettere deinen ersten Pier hoch!</span>
            </div>
          )}

          <button
            className="btn btn-primary"
            style={{ background: RED, borderColor: RED }}
            onClick={() => navigate("/strandturm/lobby")}
          >
            🎮 Spielen
          </button>
        </div>
      </div>
    </div>
  );
}

const BG = "#0a1628";
