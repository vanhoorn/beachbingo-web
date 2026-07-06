import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase";
import type { PongDifficulty, User } from "../../types";

function SettingsOption({ selected, onClick, title, description }: {
  selected: boolean; onClick: () => void; title: string; description: string;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: selected ? "rgba(249,115,22,0.12)" : "var(--surface)",
        border: `1.5px solid ${selected ? "var(--coral)" : "var(--border)"}`,
        borderRadius: "var(--radius)",
        padding: "16px 20px",
        cursor: "pointer",
        transition: "border-color 0.15s, background 0.15s",
      }}
    >
      <div className="flex items-center" style={{ gap: 12, marginBottom: 4 }}>
        <div style={{
          width: 18, height: 18, borderRadius: "50%",
          border: `2px solid ${selected ? "var(--coral)" : "var(--text-muted)"}`,
          background: selected ? "var(--coral)" : "transparent",
          flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {selected && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff" }} />}
        </div>
        <span style={{ fontWeight: 600, fontSize: 15 }}>{title}</span>
      </div>
      <div style={{ fontSize: 13, color: "var(--text-muted)", paddingLeft: 30 }}>{description}</div>
    </div>
  );
}

export default function PongSettingsScreen() {
  const [difficulty, setDifficulty] = useState<PongDifficulty>("ROOKIE");
  const [scoreLimit, setScoreLimit] = useState(7);
  const [paddles, setPaddles] = useState<2 | 3 | 4>(2);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const navigate = useNavigate();
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid) return;
    getDoc(doc(db, "users", uid)).then((snap) => {
      if (snap.exists()) {
        const u = snap.data() as User;
        setDifficulty(u.preferredPongDifficulty ?? "ROOKIE");
        setScoreLimit(u.preferredPongScoreLimit ?? 7);
        setPaddles(u.preferredPongPaddles ?? 2);
      }
    });
  }, [uid]);

  async function handleSave() {
    if (!uid) return;
    setSaving(true);
    await updateDoc(doc(db, "users", uid), {
      preferredPongDifficulty: difficulty,
      preferredPongScoreLimit: scoreLimit,
      preferredPongPaddles: paddles,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="screen" style={{ gap: 20, paddingTop: 16 }}>
      <div className="flex items-center" style={{ gap: 8 }}>
        <button className="btn btn-outline btn-sm" onClick={() => navigate(-1)}>‹ Zurück</button>
        <h2 style={{ flex: 1, fontSize: 20 }}>BeachVolley Einstellungen</h2>
        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving} style={{ background: "var(--coral)", borderColor: "var(--coral)" }}>
          {saving ? "…" : "Speichern"}
        </button>
      </div>

      <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
        Diese Einstellungen werden beim Öffnen der Lobby als Standardwerte übernommen.
      </p>

      {/* Paddles */}
      <div className="flex flex-col gap-2">
        <div className="card-title" style={{ paddingLeft: 4 }}>Standard-Paddles</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {([2, 3, 4] as const).map((n) => (
            <div
              key={n}
              onClick={() => setPaddles(n)}
              style={{
                background: paddles === n ? "rgba(249,115,22,0.12)" : "var(--surface)",
                border: `1.5px solid ${paddles === n ? "var(--coral)" : "var(--border)"}`,
                borderRadius: "var(--radius-sm)",
                padding: "14px 8px",
                cursor: "pointer",
                textAlign: "center",
                transition: "all 0.15s",
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 800, color: paddles === n ? "var(--coral)" : "var(--text)" }}>{n}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Paddles</div>
            </div>
          ))}
        </div>
      </div>

      {/* KI-Schwierigkeit */}
      <div className="flex flex-col gap-2">
        <div className="card-title" style={{ paddingLeft: 4 }}>KI-Schwierigkeit</div>
        <SettingsOption
          selected={difficulty === "ROOKIE"}
          onClick={() => setDifficulty("ROOKIE")}
          title="🌊 Rookie"
          description="Langsam, macht Fehler — ideal zum Aufwärmen."
        />
        <SettingsOption
          selected={difficulty === "SNIPER"}
          onClick={() => setDifficulty("SNIPER")}
          title="🎯 Sniper"
          description="Schnell, trifft meistens — eine echte Herausforderung."
        />
        <SettingsOption
          selected={difficulty === "BOSS_LEVEL"}
          onClick={() => setDifficulty("BOSS_LEVEL")}
          title="💪 Boss Level"
          description="Unerbittlich — viel Spaß 😈"
        />
      </div>

      {/* Score-Limit */}
      <div className="card">
        <div className="card-title">Standard Score-Limit</div>
        <div className="flex items-center justify-between">
          <button
            className="btn btn-surface btn-sm"
            style={{ width: 44, fontSize: 22 }}
            onClick={() => setScoreLimit((v) => Math.max(1, v - 1))}
          >−</button>
          <div style={{ textAlign: "center" }}>
            <span style={{ fontSize: 28, fontWeight: 700 }}>{scoreLimit}</span>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Punkte</div>
          </div>
          <button
            className="btn btn-surface btn-sm"
            style={{ width: 44, fontSize: 22 }}
            onClick={() => setScoreLimit((v) => Math.min(21, v + 1))}
          >+</button>
        </div>
      </div>

      {saved && (
        <div style={{
          background: "rgba(34,197,94,0.12)", border: "1px solid var(--success)",
          borderRadius: "var(--radius-sm)", padding: "10px 16px",
          color: "var(--success)", fontSize: 14, textAlign: "center",
        }}>
          ✓ Einstellungen gespeichert
        </div>
      )}

    </div>
  );
}
