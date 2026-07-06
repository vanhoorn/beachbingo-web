import { useLocation, useNavigate } from "react-router-dom";

interface ResultsState {
  score: number;
  wave: number;
  difficulty: string;
  highScore: number;
  newHighScore: boolean;
}

const DIFF_LABEL: Record<string, string> = {
  ROOKIE: "🌊 Rookie",
  SNIPER: "🎯 Sniper",
  BOSS_LEVEL: "💪 Boss Level",
};

export default function PiratesResultsScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as ResultsState | null;

  const score = state?.score ?? 0;
  const wave = state?.wave ?? 1;
  const difficulty = state?.difficulty ?? "ROOKIE";
  const highScore = state?.highScore ?? 0;
  const newHighScore = state?.newHighScore ?? false;

  return (
    <div className="screen" style={{ gap: 24, paddingTop: 32, alignItems: "center" }}>
      <div style={{ fontSize: 64 }}>🐙</div>

      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>
          Spiel beendet
        </div>
        <div style={{ fontSize: 28, fontWeight: 800 }}>BeachPirates</div>
        <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>{DIFF_LABEL[difficulty]}</div>
      </div>

      {newHighScore && (
        <div style={{
          background: "rgba(245,158,11,0.15)",
          border: "1.5px solid var(--accent)",
          borderRadius: "var(--radius)",
          padding: "14px 24px",
          textAlign: "center",
          width: "100%",
        }}>
          <div style={{ fontSize: 28 }}>🏆</div>
          <div style={{ fontWeight: 800, fontSize: 16, color: "var(--accent)", marginTop: 4 }}>Neuer Rekord!</div>
        </div>
      )}

      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr",
        gap: 12, width: "100%",
      }}>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#a855f7" }}>{score}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Punkte</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "var(--primary)" }}>{wave}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Welle</div>
        </div>
      </div>

      <div className="card" style={{ width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
          🏆 Rekord {DIFF_LABEL[difficulty]}
        </div>
        <div style={{ fontSize: 32, fontWeight: 800, color: "var(--accent)" }}>{highScore}</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Punkte</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
        <button
          className="btn btn-primary"
          onClick={() => navigate("/pirates/lobby")}
          style={{ background: "#a855f7", borderColor: "#a855f7" }}
        >
          🔄 Nochmal spielen
        </button>
        <button
          className="btn btn-outline"
          onClick={() => navigate("/home")}
        >
          🏠 Zurück zum Menü
        </button>
      </div>
    </div>
  );
}
