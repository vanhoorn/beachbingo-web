import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { useLocation, useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase";

const RED = "#dc2626";

interface ResultsState {
  score: number;
  level: number;
}

export default function StrandturmResultsScreen() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const state     = location.state as ResultsState | null;
  const score     = state?.score ?? 0;
  const level     = state?.level ?? 1;

  const [highScore, setHighScore]   = useState<number | null>(null);
  const [bestLevel, setBestLevel]   = useState<number | null>(null);
  const [newHighScore, setNewHS]    = useState(false);
  const [newBestLevel, setNewBL]    = useState(false);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    getDoc(doc(db, "users", uid)).then((snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setHighScore(d.strandturmHighScore ?? 0);
        setBestLevel(d.strandturmBestLevel ?? 0);
        setNewHS(score > 0 && score >= (d.strandturmHighScore ?? 0));
        setNewBL(level > (d.strandturmBestLevel ?? 0));
      }
    });
  }, [score, level]);

  const isKillScreen = level >= 22;

  return (
    <div className="screen" style={{ gap: 24, paddingTop: 32, alignItems: "center" }}>
      <div style={{ fontSize: 64 }}>{isKillScreen ? "💀" : "🗼"}</div>

      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>
          {isKillScreen ? "Kill Screen erreicht!" : "Spiel beendet"}
        </div>
        <div style={{ fontSize: 28, fontWeight: 800 }}>Strandturm</div>
        {isKillScreen && (
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.5 }}>
            Level 22 – der berüchtigte Kill Screen 💀<br />
            Timer-Überlauf macht das Spiel unvollendbar.
          </div>
        )}
      </div>

      {(newHighScore || newBestLevel) && (
        <div style={{
          background: "rgba(245,158,11,0.15)",
          border: "1.5px solid var(--accent)",
          borderRadius: "var(--radius)",
          padding: "14px 24px",
          textAlign: "center", width: "100%",
        }}>
          <div style={{ fontSize: 28 }}>🏆</div>
          <div style={{ fontWeight: 800, fontSize: 16, color: "var(--accent)", marginTop: 4 }}>
            {newHighScore && newBestLevel ? "Neuer Rekord & Level!" : newHighScore ? "Neuer Punkterekord!" : "Neues Höchstlevel!"}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, width: "100%" }}>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: RED }}>{score}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Punkte</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "var(--primary)" }}>Lv. {level}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Erreicht</div>
        </div>
      </div>

      {highScore !== null && (
        <div className="card" style={{ width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
            🏆 Persönlicher Rekord
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "var(--accent)" }}>{highScore}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Punkte · Höchstes Level: {bestLevel}
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
        <button
          className="btn btn-primary"
          style={{ background: RED, borderColor: RED }}
          onClick={() => navigate("/strandturm/lobby")}
        >
          🔄 Nochmal spielen
        </button>
        <button className="btn btn-outline" onClick={() => navigate("/home")}>
          🏠 Zurück zum Menü
        </button>
      </div>
    </div>
  );
}
