import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase";

const VIOLET = "#7c3aed";

export default function MeermauSettingsScreen() {
  const navigate = useNavigate();
  const uid = auth.currentUser?.uid ?? "";

  const [reverseOn9, setReverseOn9] = useState(false);
  const [stopperOn8, setStopperOn8] = useState(false);
  const [wildOn10, setWildOn10] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!uid) return;
    getDoc(doc(db, "users", uid)).then(snap => {
      if (!snap.exists()) return;
      const d = snap.data();
      if (d.meermauReverseOn9 !== undefined) setReverseOn9(d.meermauReverseOn9);
      if (d.meermauStopperOn8 !== undefined) setStopperOn8(d.meermauStopperOn8);
      if (d.meermauWildOn10 !== undefined) setWildOn10(d.meermauWildOn10);
    });
  }, [uid]);

  async function handleSave() {
    setSaving(true);
    await updateDoc(doc(db, "users", uid), {
      meermauReverseOn9: reverseOn9,
      meermauStopperOn8: stopperOn8,
      meermauWildOn10: wildOn10,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="screen">
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #3b0764 0%, #7c3aed 100%)",
        padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, marginBottom: 8,
      }}>
        <button onClick={() => navigate(-1)} style={{
          background: "none", border: "none", color: "white", fontSize: 20, cursor: "pointer", padding: 4,
        }}>←</button>
        <div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", letterSpacing: 1, textTransform: "uppercase" }}>MEERMAU</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "white" }}>⚙️ Einstellungen</div>
        </div>
      </div>

      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
            Sonderregeln
          </div>
          <div style={{ fontSize: 12, color: "var(--text-sub)", marginBottom: 16 }}>
            Gelten für KI- und Online-Spiele gleichermaßen.
          </div>

          <ToggleRow
            label="9 kehrt Richtung um"
            sublabel="Eine gespielte 9 dreht die Spielrichtung um (links ↔ rechts)."
            value={reverseOn9}
            onChange={setReverseOn9}
          />

          <div style={{ height: 1, background: "var(--border)", margin: "12px 0" }} />

          <ToggleRow
            label="8 stoppt Ziehzwang"
            sublabel="Eine 8 kann auf eine 7 gespielt werden und neutralisiert den Ziehzwang."
            value={stopperOn8}
            onChange={setStopperOn8}
          />

          <div style={{ height: 1, background: "var(--border)", margin: "12px 0" }} />

          <ToggleRow
            label="10 als Wunschkarte"
            sublabel="Eine 10 wirkt wie ein Bube: beliebige Farbe wünschen."
            value={wildOn10}
            onChange={setWildOn10}
          />
        </div>

        <button
          className="btn"
          onClick={handleSave}
          disabled={saving}
          style={{
            background: saved ? "#22c55e" : VIOLET,
            color: "white", padding: "14px", fontSize: 15, fontWeight: 700,
            border: "none", transition: "background 0.2s",
          }}
        >
          {saving ? "Speichere…" : saved ? "✓ Gespeichert" : "Einstellungen speichern"}
        </button>
      </div>
    </div>
  );
}

function ToggleRow({ label, sublabel, value, onChange }: {
  label: string; sublabel: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div
      style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}
      onClick={() => onChange(!value)}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{label}</div>
        <div style={{ fontSize: 12, color: "var(--text-sub)", marginTop: 3 }}>{sublabel}</div>
      </div>
      <div style={{
        width: 44, height: 24, borderRadius: 12, flexShrink: 0, marginTop: 2,
        background: value ? "#7c3aed" : "var(--border)",
        position: "relative", transition: "background 0.2s",
      }}>
        <div style={{
          position: "absolute", top: 3, left: value ? 23 : 3,
          width: 18, height: 18, borderRadius: "50%", background: "white",
          transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
        }} />
      </div>
    </div>
  );
}
