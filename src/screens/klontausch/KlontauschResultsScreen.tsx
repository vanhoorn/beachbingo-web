import { useNavigate } from "react-router-dom";

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
  targets?: Record<string, string[]>;
}

const TEAM_NAMES = [
  "Die Kopftauscher", "Die Klonfabrik", "Die Doppelgänger-Liga",
  "Die Verwechslungskünstler", "Die Ersatzteil-Bande", "Die Figurenschmuggler",
  "Die Motiv-Mixer", "Die Karikaturen-Crew", "Die Gliedmaßen-Gilde",
  "Die Zusammenwürfler", "Die Chaos-Schneiderei", "Die Wackelfiguren-Werkstatt",
  "Die Umbau-Kommission", "Die Flickwerk-Fraktion", "Die Neuzusammensetzer",
  "Die Silhouetten-Society",
];

function randomTeamName(): string {
  return TEAM_NAMES[Math.floor(Math.random() * TEAM_NAMES.length)];
}

export default function KlontauschResultsScreen() {
  const navigate   = useNavigate();
  const resultRaw  = sessionStorage.getItem("klontauschResult");

  if (!resultRaw) {
    return (
      <div className="screen" style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ fontSize: 42 }}>🃏</div>
        <div style={{ marginTop: 12, color: "var(--text-sub)" }}>Keine Ergebnisse vorhanden.</div>
        <button className="btn" style={{ marginTop: 20, background: KT_COLOR, color: "white" }}
          onClick={() => navigate("/klontausch/lobby", { replace: true })}>Neue Runde</button>
      </div>
    );
  }

  const result: KlonResult = JSON.parse(resultRaw);
  const winner = result.players.find(p => p.userId === result.winnerId);
  const others = result.players.filter(p => p.userId !== result.winnerId)
    .sort((a, b) => a.cardCount - b.cardCount);

  const teamName = randomTeamName();

  return (
    <div className="screen">
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, #3b0764 0%, ${KT_COLOR} 100%)`,
        padding: "12px 16px",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <button onClick={() => navigate("/home", { replace: true })} style={{
          background: "none", border: "none", color: "white", fontSize: 20, cursor: "pointer", padding: 4,
        }}>←</button>
        <div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", letterSpacing: 1, textTransform: "uppercase" }}>KLONTAUSCH</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "white" }}>🃏 Ergebnis</div>
        </div>
      </div>

      <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Winner card */}
        {winner && (
          <div style={{
            background: KT_DIM, border: `1px solid ${KT_COLOR}55`,
            borderRadius: "var(--radius)", padding: "24px", textAlign: "center",
          }}>
            <div style={{ fontSize: 64 }}>🏆</div>
            <div style={{ fontSize: 24, marginTop: 4 }}>{winner.avatarUrl}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "white", marginTop: 6 }}>
              {winner.displayName}
            </div>
            <div style={{ fontSize: 14, color: KT_COLOR, marginTop: 4, fontWeight: 600 }}>
              hat alle Zielfiguren komplett!
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
              Team: {teamName}
            </div>
          </div>
        )}

        {/* Standings */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Endwertung</div>

          {/* Winner first */}
          {winner && (
            <div style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "12px 14px", borderRadius: 10,
              background: KT_DIM, border: `1px solid ${KT_COLOR}44`,
            }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: KT_COLOR, minWidth: 28, textAlign: "center" }}>1.</div>
              <span style={{ fontSize: 24 }}>{winner.avatarUrl}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{winner.displayName}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Alle Zielfiguren gesammelt</div>
              </div>
              <div style={{ fontSize: 18 }}>🏆</div>
            </div>
          )}

          {/* Others sorted by fewest cards remaining */}
          {others.map((p, i) => (
            <div key={p.userId} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "12px 14px", borderRadius: 10,
              background: "var(--surface)", border: "1px solid var(--border)",
            }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-muted)", minWidth: 28, textAlign: "center" }}>
                {i + 2}.
              </div>
              <span style={{ fontSize: 24 }}>{p.avatarUrl}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{p.displayName}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {p.cardCount} Karte{p.cardCount !== 1 ? "n" : ""} auf der Hand
                </div>
              </div>
              <div style={{ fontSize: 16 }}>🃏</div>
            </div>
          ))}
        </div>

        {/* Action buttons */}
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
      </div>
    </div>
  );
}
