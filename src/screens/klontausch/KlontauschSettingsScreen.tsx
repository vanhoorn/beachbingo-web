import { useNavigate } from "react-router-dom";

const KT_COLOR = "#8B5CF6";

export default function KlontauschSettingsScreen() {
  const navigate = useNavigate();

  return (
    <div className="screen">
      <div style={{
        background: "linear-gradient(135deg, #3b0764 0%, #8B5CF6 100%)",
        padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, marginBottom: 8,
      }}>
        <button onClick={() => navigate(-1)} style={{
          background: "none", border: "none", color: "white", fontSize: 20, cursor: "pointer", padding: 4,
        }}>←</button>
        <div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", letterSpacing: 1, textTransform: "uppercase" }}>Klontausch</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "white" }}>⚙️ Einstellungen</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
            Spielfiguren
          </div>
          <div style={{ fontSize: 12, color: "var(--text-sub)", marginBottom: 16 }}>
            Alle 38 Figuren im Überblick – schaut euch an, wer mitspielen kann.
          </div>
          <button
            onClick={() => navigate("/klontausch/gallery")}
            style={{
              width: "100%", padding: "12px 16px", borderRadius: 8, cursor: "pointer",
              border: `1px solid ${KT_COLOR}88`,
              background: "transparent", color: KT_COLOR,
              fontWeight: 700, fontSize: 14,
            }}
          >
            🖼️ Figurengalerie anzeigen
          </button>
        </div>

        <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", paddingTop: 4 }}>
          Musik &amp; Soundeffekte →{" "}
          <button onClick={() => navigate("/profile")} style={{
            background: "none", border: "none", color: KT_COLOR, cursor: "pointer", padding: 0, fontSize: 12,
          }}>Profil-Einstellungen</button>
        </div>
      </div>
    </div>
  );
}
