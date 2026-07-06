import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase";
import type { User, VierDifficulty } from "../../types";
import { DRINK_ICONS, DrinkPiece } from "./drinkIcons";

const DIFFICULTIES: { id: VierDifficulty; label: string; description: string; emoji: string }[] = [
  { id: "ROOKIE",     label: "Rookie",     description: "Macht häufig Fehler – gut zum Üben",  emoji: "😅" },
  { id: "SNIPER",     label: "Sniper",     description: "85% richtige Züge – fordert aber fair", emoji: "🎯" },
  { id: "BOSS_LEVEL", label: "Boss Level", description: "Fast unbesiegbar – alles oder nichts",  emoji: "💀" },
];

export default function VierSettingsScreen() {
  const [drinkId, setDrinkId] = useState("lager");
  const [difficulty, setDifficulty] = useState<VierDifficulty>("SNIPER");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const navigate = useNavigate();
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid) return;
    getDoc(doc(db, "users", uid)).then((snap) => {
      if (snap.exists()) {
        const u = snap.data() as User;
        setDrinkId(u.preferredVierDrinkId ?? "lager");
        setDifficulty(u.preferredVierDifficulty ?? "SNIPER");
      }
    });
  }, [uid]);

  async function handleSave() {
    if (!uid) return;
    setSaving(true);
    await updateDoc(doc(db, "users", uid), {
      preferredVierDrinkId: drinkId,
      preferredVierDifficulty: difficulty,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="screen" style={{ gap: 20, paddingTop: 16 }}>
      <div className="flex items-center" style={{ gap: 8 }}>
        <button className="btn btn-outline btn-sm" onClick={() => navigate(-1)}>‹ Zurück</button>
        <h2 style={{ flex: 1, fontSize: 20 }}>Vier4Bier Einstellungen</h2>
        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving} style={{ background: "#C2410C", borderColor: "#C2410C" }}>
          {saving ? "…" : "Speichern"}
        </button>
      </div>

      {/* Difficulty */}
      <div className="flex flex-col gap-2">
        <div className="card-title" style={{ paddingLeft: 4 }}>KI-Schwierigkeit</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {DIFFICULTIES.map((d) => (
            <button
              key={d.id}
              onClick={() => setDifficulty(d.id)}
              style={{
                background: difficulty === d.id ? "rgba(194,65,12,0.15)" : "var(--surface)",
                border: `2px solid ${difficulty === d.id ? "#C2410C" : "var(--border)"}`,
                borderRadius: "var(--radius-sm)",
                padding: "14px 16px",
                cursor: "pointer",
                display: "flex", alignItems: "center", gap: 14,
                textAlign: "left",
                transition: "all 0.15s",
              }}
            >
              <span style={{ fontSize: 26 }}>{d.emoji}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", marginBottom: 2 }}>{d.label}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{d.description}</div>
              </div>
              {difficulty === d.id && (
                <span style={{ marginLeft: "auto", color: "#C2410C", fontSize: 18 }}>✓</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Drink */}
      <div className="flex flex-col gap-2">
        <div className="card-title" style={{ paddingLeft: 4 }}>Lieblingsgetränk</div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 0 }}>
          Wird in der Lobby vorausgewählt.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {DRINK_ICONS.map((drink) => (
            <button
              key={drink.id}
              onClick={() => setDrinkId(drink.id)}
              style={{
                background: drinkId === drink.id ? `${drink.color}33` : "var(--surface)",
                border: `2px solid ${drinkId === drink.id ? drink.color : "var(--border)"}`,
                borderRadius: "var(--radius-sm)",
                padding: "12px 8px",
                cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                transition: "all 0.15s",
              }}
            >
              <DrinkPiece drinkId={drink.id} size={44} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-sub)" }}>{drink.name}</span>
            </button>
          ))}
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
