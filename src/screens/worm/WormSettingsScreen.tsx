import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase";
import type { WormDifficulty, User } from "../../types";

const WORM_GREEN = "#22c55e";

function SettingsOption({ selected, onClick, title, description }: {
  selected: boolean; onClick: () => void; title: string; description: string;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: selected ? "rgba(34,197,94,0.12)" : "var(--surface)",
        border: `1.5px solid ${selected ? WORM_GREEN : "var(--border)"}`,
        borderRadius: "var(--radius)",
        padding: "14px 18px",
        cursor: "pointer",
        transition: "border-color 0.15s, background 0.15s",
        display: "flex", alignItems: "center", gap: 12,
      }}
    >
      <div style={{
        width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
        border: `2px solid ${selected ? WORM_GREEN : "var(--text-muted)"}`,
        background: selected ? WORM_GREEN : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {selected && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff" }} />}
      </div>
      <div>
        <div style={{ fontWeight: 600, fontSize: 15 }}>{title}</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{description}</div>
      </div>
    </div>
  );
}

export default function WormSettingsScreen() {
  const [difficulty, setDifficulty] = useState<WormDifficulty>("ROOKIE");
  const [controlMode, setControlMode] = useState<"BUTTONS" | "SWIPE">("BUTTONS");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const navigate = useNavigate();
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid) return;
    getDoc(doc(db, "users", uid)).then((snap) => {
      if (snap.exists()) {
        const u = snap.data() as User;
        setDifficulty(u.preferredWormDifficulty ?? "ROOKIE");
        setControlMode(u.preferredWormControlMode ?? "BUTTONS");
      }
    });
  }, [uid]);

  async function handleSave() {
    if (!uid) return;
    setSaving(true);
    await updateDoc(doc(db, "users", uid), {
      preferredWormDifficulty: difficulty,
      preferredWormControlMode: controlMode,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="screen" style={{ gap: 20, paddingTop: 16 }}>
      {/* Header */}
      <div className="flex items-center" style={{ gap: 8 }}>
        <button className="btn btn-outline btn-sm" onClick={() => navigate(-1)}>‹ Zurück</button>
        <h2 style={{ flex: 1, fontSize: 20 }}>Wattwurm Einstellungen</h2>
        <button
          className="btn btn-primary btn-sm"
          onClick={handleSave}
          disabled={saving}
          style={{ background: WORM_GREEN, borderColor: WORM_GREEN }}
        >
          {saving ? "…" : "Speichern"}
        </button>
      </div>

      <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
        Diese Einstellungen werden beim Start als Standardwerte übernommen.
      </p>

      {/* Difficulty */}
      <div className="flex flex-col gap-2">
        <div className="card-title" style={{ paddingLeft: 4 }}>Schwierigkeit</div>
        <SettingsOption
          selected={difficulty === "ROOKIE"}
          onClick={() => setDifficulty("ROOKIE")}
          title="🌊 Rookie"
          description="150ms/Schritt · Wände töten · Ideal zum Starten"
        />
        <SettingsOption
          selected={difficulty === "SNIPER"}
          onClick={() => setDifficulty("SNIPER")}
          title="🎯 Sniper"
          description="100ms/Schritt · Wände töten · Echte Herausforderung"
        />
        <SettingsOption
          selected={difficulty === "BOSS_LEVEL"}
          onClick={() => setDifficulty("BOSS_LEVEL")}
          title="💪 Boss Level"
          description="65ms/Schritt · Wände = Teleport · Viel Spaß 😈"
        />
      </div>

      {/* Control mode */}
      <div className="flex flex-col gap-2">
        <div className="card-title" style={{ paddingLeft: 4 }}>🕹️ Steuerung</div>
        <SettingsOption
          selected={controlMode === "BUTTONS"}
          onClick={() => setControlMode("BUTTONS")}
          title="🔲 Buttons"
          description="Vier Pfeil-Buttons unter dem Spielfeld"
        />
        <SettingsOption
          selected={controlMode === "SWIPE"}
          onClick={() => setControlMode("SWIPE")}
          title="👆 Swipe"
          description="Auf dem Spielfeld wischen zum Lenken"
        />
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
