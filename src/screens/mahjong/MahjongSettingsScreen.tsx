import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase";
import type { MahjongDifficulty } from "./MahjongLogic";
import { LAYOUT_ORDER, LAYOUTS } from "./MahjongLayouts";
import type { LayoutId } from "./MahjongLayouts";

const ACCENT = "#D4A820";

const DIFFICULTIES: { id: MahjongDifficulty; label: string; emoji: string; desc: string }[] = [
  { id: "ROOKIE", label: "Rookie",     emoji: "🌊", desc: "Freie Steine hervorgehoben · unbegrenzte Hinweise" },
  { id: "SNIPER", label: "Sniper",     emoji: "🎯", desc: "3 Hinweise · 1 Mischung · kein Highlight" },
  { id: "BOSS",   label: "Boss Level", emoji: "💪", desc: "Keine Hilfen · Highscore-Timer" },
];

const VALID_LAYOUTS: LayoutId[] = ["schildkroete", "pyramide", "kreuz", "drachen", "leuchtturm"];

export default function MahjongSettingsScreen() {
  const navigate = useNavigate();
  const uid = auth.currentUser?.uid;

  const [difficulty, setDifficulty] = useState<MahjongDifficulty>("ROOKIE");
  const [layout, setLayout]         = useState<LayoutId>("schildkroete");
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    if (!uid) return;
    getDoc(doc(db, "users", uid)).then((snap) => {
      if (!snap.exists()) return;
      const d = snap.data().preferredMahjongDifficulty as MahjongDifficulty | undefined;
      const l = snap.data().preferredMahjongLayout as LayoutId | undefined;
      if (d && ["ROOKIE", "SNIPER", "BOSS"].includes(d)) setDifficulty(d);
      if (l && VALID_LAYOUTS.includes(l)) setLayout(l);
    }).catch(() => {});
  }, [uid]);

  async function handleSave() {
    if (!uid) { navigate(-1); return; }
    setSaving(true);
    await updateDoc(doc(db, "users", uid), {
      preferredMahjongDifficulty: difficulty,
      preferredMahjongLayout: layout,
    }).catch(() => {});
    setSaving(false);
    navigate(-1);
  }

  return (
    <div className="screen">
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, #3a2800 0%, ${ACCENT} 100%)`,
        borderRadius: "var(--radius)", padding: "20px",
        display: "flex", alignItems: "center", gap: 16,
      }}>
        <div style={{ fontSize: 32 }}>⚙️</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>GezeitenSteine</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "white" }}>Einstellungen</div>
        </div>
        <button className="btn btn-outline btn-sm"
          style={{ color: "rgba(255,255,255,0.8)", borderColor: "rgba(255,255,255,0.2)" }}
          onClick={() => navigate(-1)}>
          ‹ Zurück
        </button>
      </div>

      {/* Standard-Schwierigkeit */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Standard-Schwierigkeit</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.5 }}>
          Diese Schwierigkeit wird beim Öffnen der Lobby vorausgewählt.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {DIFFICULTIES.map((d) => (
            <button key={d.id} onClick={() => setDifficulty(d.id)} style={{
              padding: "14px 16px",
              background: difficulty === d.id ? ACCENT + "22" : "var(--surface)",
              border: `${difficulty === d.id ? "2px" : "1.5px"} solid ${difficulty === d.id ? ACCENT : "var(--border)"}`,
              borderRadius: 12, cursor: "pointer", textAlign: "left",
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>{d.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: difficulty === d.id ? ACCENT : "var(--text)" }}>{d.label}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{d.desc}</div>
              </div>
              {difficulty === d.id && <span style={{ fontSize: 16, color: ACCENT, fontWeight: 800 }}>✓</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "var(--border)" }} />

      {/* Standard-Layout */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Standard-Layout</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.5 }}>
          Bei SNIPER und BOSS Level vorausgewählt. Im ROOKIE-Modus immer Schildkröte.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
          {LAYOUT_ORDER.map((lid) => {
            const l = LAYOUTS[lid];
            const sel = layout === lid;
            return (
              <button key={lid} onClick={() => setLayout(lid)} style={{
                padding: "12px 6px",
                background: sel ? ACCENT + "22" : "var(--surface)",
                border: `${sel ? "2px" : "1.5px"} solid ${sel ? ACCENT : "var(--border)"}`,
                borderRadius: 10, cursor: "pointer", textAlign: "center",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              }}>
                <span style={{ fontSize: 20 }}>{l.emoji}</span>
                <span style={{ fontSize: 10, fontWeight: sel ? 700 : 400, color: sel ? ACCENT : "var(--text-muted)", lineHeight: 1.2 }}>{l.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Buttons */}
      <button onClick={handleSave} disabled={saving} style={{
        padding: "16px", background: ACCENT, border: "none",
        borderRadius: 14, cursor: "pointer", fontSize: 16, fontWeight: 800, color: "#0a1628",
        opacity: saving ? 0.7 : 1,
      }}>
        {saving ? "Speichern …" : "Speichern"}
      </button>
      <button onClick={() => navigate(-1)} style={{
        padding: "14px", background: "transparent",
        border: "1.5px solid var(--border)",
        borderRadius: 14, cursor: "pointer", fontSize: 15, fontWeight: 600, color: "var(--text-muted)",
      }}>
        Abbrechen
      </button>
    </div>
  );
}
