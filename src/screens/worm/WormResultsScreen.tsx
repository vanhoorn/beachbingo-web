import { useLocation, useNavigate } from "react-router-dom";

const WORM_GREEN = "#22c55e";

interface ResultsState {
  score: number;
  length: number;
  difficulty: string;
  controlMode: string;
  highScore: number;
  newHighScore: boolean;
}

const DIFF_LABEL: Record<string, string> = {
  ROOKIE:     "🌊 Rookie",
  SNIPER:     "🎯 Sniper",
  BOSS_LEVEL: "💪 Boss Level",
};

export default function WormResultsScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as ResultsState | null;

  const score        = state?.score        ?? 0;
  const length       = state?.length       ?? 3;
  const difficulty   = state?.difficulty   ?? "ROOKIE";
  const controlMode  = state?.controlMode  ?? "BUTTONS";
  const highScore    = state?.highScore    ?? 0;
  const newHighScore = state?.newHighScore ?? false;

  return (
    <div className="screen" style={{ gap: 24, paddingTop: 32, alignItems: "center" }}>
      <div style={{ fontSize: 64 }}>🪱</div>

      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>
          Spiel beendet
        </div>
        <div style={{ fontSize: 28, fontWeight: 800 }}>Wattwurm</div>
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, width: "100%" }}>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: WORM_GREEN }}>{score}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Punkte</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "var(--primary)" }}>{length}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Länge</div>
        </div>
      </div>

      <div className="card" style={{ width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
          🏆 Rekord {DIFF_LABEL[difficulty]}
        </div>
        <div style={{ fontSize: 32, fontWeight: 800, color: "var(--accent)" }}>{highScore > 0 ? highScore : "—"}</div>
        {highScore > 0 && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Punkte</div>}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
        <button
          className="btn btn-primary"
          onClick={() => navigate("/worm/game", { state: { difficulty, controlMode } })}
          style={{ background: WORM_GREEN, borderColor: WORM_GREEN }}
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
