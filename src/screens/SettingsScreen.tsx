import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import type { User, GameMode, DrawStyle } from "../types";

function SettingsOption({
  selected, onClick, title, description,
}: {
  selected: boolean; onClick: () => void; title: string; description: string;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: selected ? "var(--primary-bg)" : "var(--surface)",
        border: `1.5px solid ${selected ? "var(--primary)" : "var(--border)"}`,
        borderRadius: "var(--radius)",
        padding: "16px 20px",
        cursor: "pointer",
        transition: "border-color 0.15s, background 0.15s",
      }}
    >
      <div className="flex items-center" style={{ gap: 12, marginBottom: 4 }}>
        <div style={{
          width: 18, height: 18, borderRadius: "50%",
          border: `2px solid ${selected ? "var(--primary)" : "var(--text-muted)"}`,
          background: selected ? "var(--primary)" : "transparent",
          flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {selected && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff" }} />}
        </div>
        <span style={{ fontWeight: 600, fontSize: 15 }}>{title}</span>
      </div>
      <div style={{ fontSize: 13, color: "var(--text-muted)", paddingLeft: 30 }}>
        {description}
      </div>
    </div>
  );
}

export default function SettingsScreen() {
  const [gameMode, setGameMode] = useState<GameMode>("AUTO_MARK");
  const [drawStyle, setDrawStyle] = useState<DrawStyle>("INSTANT");
  const [eliminationInterval, setEliminationInterval] = useState(5);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const navigate = useNavigate();
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid) return;
    getDoc(doc(db, "users", uid)).then((snap) => {
      if (snap.exists()) {
        const u = snap.data() as User;
        setGameMode(u.preferredGameMode || "AUTO_MARK");
        setDrawStyle(u.preferredDrawStyle || "INSTANT");
        setEliminationInterval(u.bossLevelEliminationInterval || 5);
      }
    });
  }, [uid]);

  async function handleSave() {
    if (!uid) return;
    setSaving(true);
    await updateDoc(doc(db, "users", uid), {
      preferredGameMode: gameMode,
      preferredDrawStyle: drawStyle,
      bossLevelEliminationInterval: eliminationInterval,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="screen" style={{ gap: 20, paddingTop: 16 }}>
      <div className="flex items-center" style={{ gap: 12 }}>
        <button className="btn btn-outline btn-sm" onClick={() => navigate(-1)}>
          ‹ Zurück
        </button>
        <h2 style={{ fontSize: 20 }}>Einstellungen</h2>
      </div>

      <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
        Diese Einstellungen werden beim Erstellen eines neuen Spiels übernommen.
      </p>

      {/* Erfahrungslevel */}
      <div className="flex flex-col gap-2">
        <div className="card-title" style={{ paddingLeft: 4 }}>Erfahrungslevel</div>
        <SettingsOption
          selected={gameMode === "AUTO_MARK"}
          onClick={() => setGameMode("AUTO_MARK")}
          title="🌊 1. Rookie"
          description="Gezogene Zahlen werden sofort markiert. Drücke BINGO! wenn du gewonnen hast."
        />
        <SettingsOption
          selected={gameMode === "MANUAL_MARK"}
          onClick={() => setGameMode("MANUAL_MARK")}
          title="🎯 2. Sniper"
          description="Du tippst selbst auf deine Zahlen. Klassisches Bingo-Feeling."
        />
        <SettingsOption
          selected={gameMode === "MINI_BOSS_LEVEL"}
          onClick={() => setGameMode("MINI_BOSS_LEVEL")}
          title="🔵 3. Mini Boss Level"
          description="Wie Boss Level, aber gezogene Zahlen werden auf deiner Karte blau umrandet — du siehst sofort welche Zahlen du noch tippen kannst."
        />
        <SettingsOption
          selected={gameMode === "BOSS_LEVEL"}
          onClick={() => setGameMode("BOSS_LEVEL")}
          title="💪 4. Boss Level"
          description="Alle N Züge wirft ein Spieler eine Zahl zurück in die Lostrommel. Kein visuelles Highlight — du musst selbst den Überblick behalten."
        />
      </div>

      {/* Elimination Interval */}
      {(gameMode === "BOSS_LEVEL" || gameMode === "MINI_BOSS_LEVEL") && (
        <div className="card">
          <div className="card-title">Züge bis Elimination</div>
          <div className="flex items-center justify-between">
            <button
              className="btn btn-surface btn-sm"
              style={{ width: 44, fontSize: 22 }}
              onClick={() => setEliminationInterval((v) => Math.max(1, v - 1))}
            >−</button>
            <span style={{ fontSize: 28, fontWeight: 700 }}>{eliminationInterval}</span>
            <button
              className="btn btn-surface btn-sm"
              style={{ width: 44, fontSize: 22 }}
              onClick={() => setEliminationInterval((v) => Math.min(20, v + 1))}
            >+</button>
          </div>
        </div>
      )}

      {/* Ziehungs-Animation */}
      <div className="flex flex-col gap-2">
        <div className="card-title" style={{ paddingLeft: 4 }}>Ziehungs-Animation</div>
        <SettingsOption
          selected={drawStyle === "INSTANT"}
          onClick={() => setDrawStyle("INSTANT")}
          title="⚡ Sofort"
          description="Die Zahl erscheint direkt. Schnelles Spieltempo."
        />
        <SettingsOption
          selected={drawStyle === "DRUM"}
          onClick={() => setDrawStyle("DRUM")}
          title="🥁 Lostrommel"
          description="3-Sekunden-Animation baut Spannung auf bevor die Zahl erscheint."
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

      <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
        {saving ? "Speichern…" : "Einstellungen speichern"}
      </button>
    </div>
  );
}
