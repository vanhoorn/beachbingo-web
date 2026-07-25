import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase";
import type { SpDifficulty } from "./strandraeuberLogic";

const SP_COLOR = "#e11d48";
const SP_DIM   = "rgba(225,29,72,0.12)";

export default function StrandraeuberSettingsScreen() {
  const navigate = useNavigate();
  const uid = auth.currentUser?.uid ?? "";

  const [difficulty, setDifficulty] = useState<SpDifficulty>("SNIPER");
  const [rounds, setRounds]         = useState(3);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);

  useEffect(() => {
    if (!uid) return;
    getDoc(doc(db, "users", uid)).then((snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      if (d.preferredStrandraeuberDifficulty) setDifficulty(d.preferredStrandraeuberDifficulty);
      if (d.preferredStrandraeuberRounds)     setRounds(d.preferredStrandraeuberRounds);
    });
  }, [uid]);

  async function handleSave() {
    setSaving(true);
    await updateDoc(doc(db, "users", uid), {
      preferredStrandraeuberDifficulty: difficulty,
      preferredStrandraeuberRounds: rounds,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="screen">
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, #7a0f27 0%, ${SP_COLOR} 100%)`,
        padding: "12px 16px",
        display: "flex", alignItems: "center", gap: 12, marginBottom: 8,
      }}>
        <button onClick={() => navigate(-1)} style={{
          background: "none", border: "none", color: "white", fontSize: 20, cursor: "pointer", padding: 4,
        }}>←</button>
        <div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", letterSpacing: 1, textTransform: "uppercase" }}>STRANDRÄUBER</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "white" }}>⚙️ Einstellungen</div>
        </div>
      </div>

      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {/* KI Stärke */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Standard-KI-Stärke</div>
          <div style={{ display: "flex", gap: 8 }}>
            {([["ROOKIE", "🌊 Rookie"], ["SNIPER", "🎯 Sniper"], ["BOSS_LEVEL", "💪 Boss"]] as [SpDifficulty, string][]).map(([val, label]) => (
              <button key={val} onClick={() => setDifficulty(val)} style={{
                flex: 1, padding: "10px 6px", borderRadius: 8, fontSize: 12,
                border: `1px solid ${difficulty === val ? SP_COLOR : "var(--border)"}`,
                background: difficulty === val ? SP_DIM : "var(--surface2)",
                color: difficulty === val ? SP_COLOR : "var(--text-sub)",
                fontWeight: difficulty === val ? 700 : 400, cursor: "pointer",
              }}>{label}</button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 10, lineHeight: 1.5 }}>
            <b>Rookie:</b> Zieht immer erste Karte, mischt nie.<br />
            <b>Sniper:</b> Zieht zufällige Karte, mischt manchmal.<br />
            <b>Boss:</b> Mischt immer, zieht zufällige Karte.
          </div>
        </div>

        {/* Rundenanzahl */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Standard-Rundenanzahl</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[1, 3, 5].map(n => (
              <button key={n} onClick={() => setRounds(n)} style={{
                flex: 1, padding: "10px 6px", borderRadius: 8, fontSize: 13,
                border: `1px solid ${rounds === n ? SP_COLOR : "var(--border)"}`,
                background: rounds === n ? SP_DIM : "var(--surface2)",
                color: rounds === n ? SP_COLOR : "var(--text-sub)",
                fontWeight: rounds === n ? 700 : 400, cursor: "pointer",
              }}>{n === 1 ? "1 Runde" : `${n} Runden`}</button>
            ))}
          </div>
        </div>

        {/* Audio hint */}
        <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
          Musik & Soundeffekte →{" "}
          <button onClick={() => navigate("/profile")} style={{
            background: "none", border: "none", color: SP_COLOR, cursor: "pointer", padding: 0, fontSize: 12,
          }}>Profil-Einstellungen</button>
        </div>

        <button
          className="btn"
          onClick={handleSave}
          disabled={saving}
          style={{
            background: saved ? "#22c55e" : SP_COLOR,
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
