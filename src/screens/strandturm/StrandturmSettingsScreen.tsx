import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase";
import type { User } from "../../types";

const RED = "#dc2626";
const ADMIN_UID = "oliWTLaCLydkhHl9qF9XZWvSi322";

function ModeOption({ selected, onClick, title, description }: {
  selected: boolean; onClick: () => void; title: string; description: string;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: selected ? "rgba(220,38,38,0.12)" : "var(--surface)",
        border: `1.5px solid ${selected ? RED : "var(--border)"}`,
        borderRadius: "var(--radius)",
        padding: "14px 18px",
        cursor: "pointer",
        display: "flex", alignItems: "center", gap: 12,
        transition: "border-color 0.15s, background 0.15s",
      }}
    >
      <div style={{
        width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
        border: `2px solid ${selected ? RED : "var(--text-muted)"}`,
        background: selected ? RED : "transparent",
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

export default function StrandturmSettingsScreen() {
  const [controlMode, setControlMode] = useState<"BUTTONS" | "TOUCH" | "SPLIT">("BUTTONS");
  const [startLevel, setStartLevel] = useState(1);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const navigate = useNavigate();
  const uid = auth.currentUser?.uid;
  const isAdmin = uid === ADMIN_UID;

  useEffect(() => {
    if (!uid) return;
    getDoc(doc(db, "users", uid)).then((snap) => {
      if (snap.exists()) {
        const u = snap.data() as User;
        setControlMode(u.preferredStrandturmControlMode ?? "BUTTONS");
        setStartLevel((u as any).strandturmStartLevel ?? 1);
      }
    });
  }, [uid]);

  async function handleSave() {
    if (!uid) return;
    setSaving(true);
    const updates: Record<string, unknown> = { preferredStrandturmControlMode: controlMode };
    if (isAdmin) updates.strandturmStartLevel = startLevel;
    await updateDoc(doc(db, "users", uid), updates);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="screen" style={{ gap: 20, paddingTop: 16 }}>
      <div className="flex items-center" style={{ gap: 8 }}>
        <button className="btn btn-outline btn-sm" onClick={() => navigate(-1)}>‹ Zurück</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>STRANDTURM</div>
          <h2 style={{ fontSize: 20 }}>⚙️ Einstellungen</h2>
        </div>
        <button
          className="btn btn-sm"
          style={{ background: RED, color: "#fff", border: "none" }}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "…" : "Speichern"}
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <div className="card-title" style={{ paddingLeft: 4 }}>Steuerung</div>
        <ModeOption
          selected={controlMode === "BUTTONS"}
          onClick={() => setControlMode("BUTTONS")}
          title="🔲 Klassisch"
          description="D-Pad mittig unter dem Spielfeld: ◄ ▲ ► und ▼ zum Klettern"
        />
        <ModeOption
          selected={controlMode === "SPLIT"}
          onClick={() => setControlMode("SPLIT")}
          title="✌️ Zwei-Händig"
          description="◄ ► links · ▲ ▼ rechts – ideal zum Spielen mit zwei Daumen"
        />
        <ModeOption
          selected={controlMode === "TOUCH"}
          onClick={() => setControlMode("TOUCH")}
          title="👆 Touch-Zonen"
          description="Linke Hälfte = Links · Rechte Hälfte = Rechts · Tap oben = Springen"
        />
      </div>

      {isAdmin && (
        <div className="flex flex-col gap-2">
          <div className="card-title" style={{ paddingLeft: 4, color: "#f59e0b" }}>🔧 Admin</div>
          <div className="card" style={{ border: "1.5px solid rgba(245,158,11,0.4)", background: "rgba(245,158,11,0.06)" }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: "#f59e0b", marginBottom: 10 }}>Startlevel (nur für Tests)</div>
            <div style={{ display: "flex", gap: 8 }}>
              {[1, 2, 3, 4].map((lvl) => {
                const labels = ["", "🏗️ Level 1", "🏭 Level 2", "🛗 Level 3", "🔩 Level 4"];
                const selected = startLevel === lvl;
                return (
                  <button
                    key={lvl}
                    onClick={() => setStartLevel(lvl)}
                    style={{
                      flex: 1, padding: "10px 4px", borderRadius: "var(--radius-sm)", cursor: "pointer",
                      fontSize: 12, fontWeight: selected ? 700 : 400, lineHeight: 1.4,
                      background: selected ? "rgba(245,158,11,0.18)" : "var(--surface)",
                      border: `1.5px solid ${selected ? "#f59e0b" : "var(--border)"}`,
                      color: selected ? "#f59e0b" : "var(--text-muted)",
                      transition: "all 0.15s",
                    }}
                  >
                    {labels[lvl]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.7 }}>
        <div style={{ fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>Steuerung im Detail</div>
        <div><strong style={{ color: "var(--text)" }}>Laufen:</strong> ◄ / ► drücken</div>
        <div><strong style={{ color: "var(--text)" }}>Springen:</strong> ▲ drücken (auf dem Boden)</div>
        <div><strong style={{ color: "var(--text)" }}>Leiter hoch:</strong> ▲ an der Leiter halten</div>
        <div><strong style={{ color: "var(--text)" }}>Leiter runter:</strong> ▼ auf der Plattform über Leiter</div>
      </div>

      <div className="card" style={{ fontSize: 13, color: "var(--text-muted)" }}>
        💡 Musik & Soundeffekte findest du in den{" "}
        <span
          style={{ color: RED, cursor: "pointer" }}
          onClick={() => navigate("/settings")}
        >
          allgemeinen Einstellungen
        </span>
        .
      </div>

      {saved && (
        <div style={{
          background: "rgba(34,197,94,0.12)", border: "1px solid var(--success)",
          borderRadius: "var(--radius-sm)", padding: "10px 16px",
          color: "var(--success)", fontSize: 14, textAlign: "center",
        }}>
          ✓ Gespeichert
        </div>
      )}
    </div>
  );
}
