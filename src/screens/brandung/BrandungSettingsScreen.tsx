import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase";

const TEAL = "#0d9488";

export default function BrandungSettingsScreen() {
  const navigate = useNavigate();
  const uid = auth.currentUser?.uid ?? "";

  const [newCardsOnAllPass, setNewCardsOnAllPass] = useState(true);
  const [passingForbidden, setPassingForbidden] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!uid) return;
    getDoc(doc(db, "users", uid)).then(snap => {
      if (!snap.exists()) return;
      const d = snap.data();
      if (d.brandungNewCardsOnAllPass !== undefined) setNewCardsOnAllPass(d.brandungNewCardsOnAllPass);
      if (d.brandungPassingForbidden !== undefined) setPassingForbidden(d.brandungPassingForbidden);
    });
  }, [uid]);

  async function handleSave() {
    setSaving(true);
    await updateDoc(doc(db, "users", uid), {
      brandungNewCardsOnAllPass: newCardsOnAllPass,
      brandungPassingForbidden: passingForbidden,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="screen">
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #064e47 0%, #0d9488 100%)",
        padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, marginBottom: 8,
      }}>
        <button onClick={() => navigate(-1)} style={{
          background: "none", border: "none", color: "white", fontSize: 20, cursor: "pointer", padding: 4,
        }}>←</button>
        <div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", letterSpacing: 1, textTransform: "uppercase" }}>BRANDUNG</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "white" }}>⚙️ Einstellungen</div>
        </div>
      </div>

      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
            Spielregeln
          </div>
          <div style={{ fontSize: 12, color: "var(--text-sub)", marginBottom: 16 }}>
            Gelten für KI- und Online-Spiele gleichermaßen.
          </div>

          <ToggleRow
            label="Neue Tischkarten beim Schieben"
            sublabel="Wenn alle Spieler passen, kommen 3 neue Karten auf den Tisch."
            value={newCardsOnAllPass}
            onChange={setNewCardsOnAllPass}
          />

          <div style={{ height: 1, background: "var(--border)", margin: "12px 0" }} />

          <ToggleRow
            label="Schieben verboten"
            sublabel="Kein Spieler darf passen. Jede Runde muss getauscht oder geklopft werden."
            value={passingForbidden}
            onChange={setPassingForbidden}
          />
        </div>

        <div className="card" style={{ padding: 16, background: "rgba(13,148,136,0.06)", border: "1px solid rgba(13,148,136,0.2)" }}>
          <div style={{ fontSize: 12, color: TEAL, fontWeight: 600, marginBottom: 6 }}>Spielziel</div>
          <div style={{ fontSize: 12, color: "var(--text-sub)", lineHeight: 1.6 }}>
            Jeder Spieler hat 3 Leben (🌊). Wer am Ende einer Runde die wenigsten Punkte hat,
            verliert 1 Leben. Der letzte Überlebende gewinnt!
          </div>
          <div style={{ fontSize: 12, color: "var(--text-sub)", marginTop: 8, lineHeight: 1.6 }}>
            <b style={{ color: "var(--text)" }}>Punkte:</b> gleiche Farbe addieren — max. 31 (A+K+10 gleiche Farbe).
            Drei gleiche Werte zählen 30½. Drei Asse = 🔥 FEUER! Alle anderen verlieren sofort 1 Leben.
          </div>
        </div>

        <button
          className="btn"
          onClick={handleSave}
          disabled={saving}
          style={{
            background: saved ? "#22c55e" : TEAL,
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
        background: value ? TEAL : "var(--border)",
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
