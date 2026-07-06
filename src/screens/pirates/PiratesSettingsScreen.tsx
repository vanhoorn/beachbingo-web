import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase";
import type { PiratesDifficulty, User } from "../../types";

function SettingsOption({ selected, onClick, title, description }: {
  selected: boolean; onClick: () => void; title: string; description: string;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: selected ? "rgba(168,85,247,0.12)" : "var(--surface)",
        border: `1.5px solid ${selected ? "#a855f7" : "var(--border)"}`,
        borderRadius: "var(--radius)",
        padding: "14px 18px",
        cursor: "pointer",
        transition: "border-color 0.15s, background 0.15s",
        display: "flex", alignItems: "center", gap: 12,
      }}
    >
      <div style={{
        width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
        border: `2px solid ${selected ? "#a855f7" : "var(--text-muted)"}`,
        background: selected ? "#a855f7" : "transparent",
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

const FIRE_RATE_LABELS: Record<number, string> = {
  1: "Sehr langsam", 2: "Langsam", 3: "Ruhig", 4: "Moderat", 5: "Mittel",
  6: "Flott", 7: "Schnell", 8: "Sehr schnell", 9: "Rasant", 10: "Maximum",
};

export default function PiratesSettingsScreen() {
  const [difficulty, setDifficulty] = useState<PiratesDifficulty>("ROOKIE");
  const [fireRate, setFireRate] = useState(5);
  const [controlMode, setControlMode] = useState<"BUTTONS" | "TOUCH">("BUTTONS");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const navigate = useNavigate();
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid) return;
    getDoc(doc(db, "users", uid)).then((snap) => {
      if (snap.exists()) {
        const u = snap.data() as User;
        setDifficulty(u.preferredPiratesDifficulty ?? "ROOKIE");
        setFireRate(u.preferredPiratesFireRate ?? 5);
        setControlMode(u.preferredPiratesControlMode ?? "BUTTONS");
      }
    });
  }, [uid]);

  async function handleSave() {
    if (!uid) return;
    setSaving(true);
    await updateDoc(doc(db, "users", uid), {
      preferredPiratesDifficulty: difficulty,
      preferredPiratesFireRate: fireRate,
      preferredPiratesControlMode: controlMode,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="screen" style={{ gap: 20, paddingTop: 16 }}>
      <div className="flex items-center" style={{ gap: 8 }}>
        <button className="btn btn-outline btn-sm" onClick={() => navigate(-1)}>‹ Zurück</button>
        <h2 style={{ flex: 1, fontSize: 20 }}>BeachPirates Einstellungen</h2>
        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving} style={{ background: "#a855f7", borderColor: "#a855f7" }}>
          {saving ? "…" : "Speichern"}
        </button>
      </div>

      <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
        Diese Einstellungen werden beim Start als Standardwerte übernommen.
      </p>

      {/* Schwierigkeit */}
      <div className="flex flex-col gap-2">
        <div className="card-title" style={{ paddingLeft: 4 }}>Schwierigkeit der Angreifer</div>
        <SettingsOption
          selected={difficulty === "ROOKIE"}
          onClick={() => setDifficulty("ROOKIE")}
          title="🌊 Rookie"
          description="Speed 1/30, Schießen 3/30 — ideal zum Starten"
        />
        <SettingsOption
          selected={difficulty === "SNIPER"}
          onClick={() => setDifficulty("SNIPER")}
          title="🎯 Sniper"
          description="Speed 5/30, Schießen 5/30 — echte Herausforderung"
        />
        <SettingsOption
          selected={difficulty === "BOSS_LEVEL"}
          onClick={() => setDifficulty("BOSS_LEVEL")}
          title="💪 Boss Level"
          description="Speed 8/30, Schießen 8/30 — viel Spaß 😈"
        />
      </div>

      {/* Schussrate */}
      <div className="card" style={{ gap: 14, display: "flex", flexDirection: "column" }}>
        <div>
          <div className="card-title">🔱 Schussrate des Oktopus</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
            Wie schnell schießt der Oktopus? (Dauerfeuer)
          </div>
        </div>
        <div className="flex items-center" style={{ gap: 14 }}>
          <button
            className="btn btn-surface btn-sm"
            style={{ width: 40, fontSize: 20, flexShrink: 0 }}
            onClick={() => setFireRate((v) => Math.max(1, v - 1))}
          >−</button>
          <div style={{ flex: 1 }}>
            <input
              type="range" min={1} max={10} value={fireRate}
              onChange={(e) => setFireRate(Number(e.target.value))}
              style={{ width: "100%", accentColor: "#a855f7" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
              <span>1</span><span>5</span><span>10</span>
            </div>
          </div>
          <button
            className="btn btn-surface btn-sm"
            style={{ width: 40, fontSize: 20, flexShrink: 0 }}
            onClick={() => setFireRate((v) => Math.min(10, v + 1))}
          >+</button>
        </div>
        <div style={{ textAlign: "center" }}>
          <span style={{ fontSize: 26, fontWeight: 800, color: "#a855f7" }}>{fireRate}</span>
          <span style={{ fontSize: 13, color: "var(--text-muted)", marginLeft: 8 }}>/ 10 — {FIRE_RATE_LABELS[fireRate]}</span>
        </div>
      </div>

      {/* Steuerung */}
      <div className="flex flex-col gap-2">
        <div className="card-title" style={{ paddingLeft: 4 }}>🕹️ Steuerung</div>
        <SettingsOption
          selected={controlMode === "BUTTONS"}
          onClick={() => setControlMode("BUTTONS")}
          title="🔲 Buttons"
          description="Zwei Buttons links/rechts zum Bewegen"
        />
        <SettingsOption
          selected={controlMode === "TOUCH"}
          onClick={() => setControlMode("TOUCH")}
          title="👆 Touch"
          description="Linke/rechte Seite des Spielfelds antippen zum Bewegen"
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
