import { useNavigate } from "react-router-dom";

const SP_COLOR = "#e11d48";
const SP_DIM   = "rgba(225,29,72,0.12)";

interface SpResultPlayer {
  userId: string;
  displayName: string;
  avatarUrl: string;
  score: number;
}

interface SpResult {
  players: SpResultPlayer[];
  totalRounds: number;
  loserUserId: string | null;
}

export default function StrandraeuberResultsScreen() {
  const navigate  = useNavigate();
  const resultRaw = sessionStorage.getItem("spResult");

  if (!resultRaw) {
    return (
      <div className="screen" style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ fontSize: 42 }}>🦹</div>
        <div style={{ marginTop: 12, color: "var(--text-sub)" }}>Keine Ergebnisse vorhanden.</div>
        <button className="btn" style={{ marginTop: 20, background: SP_COLOR, color: "white" }}
          onClick={() => navigate("/strandraeuber/lobby", { replace: true })}>Neue Runde</button>
      </div>
    );
  }

  const result: SpResult = JSON.parse(resultRaw);
  const sorted = [...result.players].sort((a, b) => b.score - a.score);
  const overallLoser = sorted[0];
  const overallWinners = sorted.filter(p => p.score === sorted[sorted.length - 1].score && p.score < (overallLoser?.score ?? 0));

  return (
    <div className="screen">
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, #7a0f27 0%, ${SP_COLOR} 100%)`,
        padding: "12px 16px",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <button onClick={() => navigate("/home", { replace: true })} style={{
          background: "none", border: "none", color: "white", fontSize: 20, cursor: "pointer", padding: 4,
        }}>←</button>
        <div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", letterSpacing: 1, textTransform: "uppercase" }}>STRANDRÄUBER</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "white" }}>🦹 Ergebnis</div>
        </div>
      </div>

      <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Loser announcement */}
        {overallLoser && (
          <div style={{
            background: SP_DIM, border: `1px solid ${SP_COLOR}55`,
            borderRadius: "var(--radius)", padding: "20px", textAlign: "center",
          }}>
            <div style={{ fontSize: 60 }}>🦹</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "white", marginTop: 8 }}>
              {overallLoser.displayName}
            </div>
            <div style={{ fontSize: 14, color: SP_COLOR, marginTop: 4, fontWeight: 600 }}>
              hält den Strandräuber! ({overallLoser.score} × 🦹)
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
              {result.totalRounds} Runde{result.totalRounds !== 1 ? "n" : ""} gespielt
            </div>
          </div>
        )}

        {/* Standings */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Gesamtwertung</div>
          {sorted.map((p, rank) => {
            const isLoser   = p.userId === overallLoser?.userId;
            const isWinner  = overallWinners.some(w => w.userId === p.userId);
            return (
              <div key={p.userId} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 14px", borderRadius: 10,
                background: isLoser ? SP_DIM : isWinner ? "rgba(34,197,94,0.08)" : "var(--surface)",
                border: `1px solid ${isLoser ? SP_COLOR + "44" : isWinner ? "rgba(34,197,94,0.3)" : "var(--border)"}`,
              }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: isLoser ? SP_COLOR : "var(--text-muted)", minWidth: 28, textAlign: "center" }}>
                  {rank + 1}.
                </div>
                <span style={{ fontSize: 24 }}>{p.avatarUrl}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{p.displayName}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {p.score === 0 ? "Kein Strandräuber!" : `${p.score} Strandräuber`}
                  </div>
                </div>
                <div style={{ fontSize: 18 }}>
                  {p.score === 0 ? "✅" : "🦹".repeat(Math.min(p.score, 5))}
                  {p.score > 5 ? `+${p.score - 5}` : ""}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => navigate("/home", { replace: true })}>🏠 Home</button>
          <button className="btn" style={{ flex: 2, background: SP_COLOR, color: "white", fontWeight: 700 }}
            onClick={() => navigate("/strandraeuber/lobby", { replace: true })}>
            Nochmal spielen 🦹
          </button>
        </div>
      </div>
    </div>
  );
}
