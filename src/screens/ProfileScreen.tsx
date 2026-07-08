import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import { AVATAR_CATEGORIES, BEACH_AVATARS } from "../types";
import type { User } from "../types";

const HOTPROMS_NAMES: Record<string, string> = {
  "🦁👑": "Beyoncé", "🐍👑": "Taylor Swift", "💜🎤": "Prince",
  "🤠🎸": "Elvis", "🎸🔥": "Freddie Mercury", "🤡🃏": "Joker / Joaquin",
  "💣🎤": "Eminem", "🌹💃": "Jennifer Lopez", "🦆🎬": "Tarantino",
  "💃🕺": "ABBA", "🎀🔮": "Madonna", "🌹🎸": "The Smiths",
  "🎭✨": "Lady Gaga", "⚡🌟": "David Bowie", "☂️💄": "Rihanna",
};

const COCKTAIL_NAMES: Record<string, string> = {
  "🍸": "Martini", "🥂": "Champagner", "🍾": "Flasche", "🥃": "Whisky",
  "🍷": "Rotwein", "🧋": "Bubble Tea", "🍺": "Bier", "🍻": "Prost!",
  "🫗": "Eingießen", "🧃": "Saft", "🍵": "Matcha", "🥤": "Smoothie",
  "🍋": "Limoncello", "🫧": "Sprudel", "🍑": "Bellini",
};

function avatarName(av: string): string {
  return HOTPROMS_NAMES[av] ?? COCKTAIL_NAMES[av] ?? "";
}

function categoryOf(av: string) {
  return AVATAR_CATEGORIES.find((c) => (c.avatars as readonly string[]).includes(av)) ?? AVATAR_CATEGORIES[0];
}

export default function ProfileScreen() {
  const [user, setUser]           = useState<User | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatar, setAvatar]       = useState(BEACH_AVATARS[0]);
  const [activeTab, setActiveTab] = useState(0);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const navigate = useNavigate();
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid) return;
    getDoc(doc(db, "users", uid)).then((snap) => {
      if (snap.exists()) {
        const u = snap.data() as User;
        setUser(u);
        setDisplayName(u.displayName);
        const av = u.avatarUrl || BEACH_AVATARS[0];
        setAvatar(av);
        const idx = AVATAR_CATEGORIES.findIndex((c) => (c.avatars as readonly string[]).includes(av));
        if (idx >= 0) setActiveTab(idx);
      }
    });
  }, [uid]);

  async function handleSave() {
    if (!uid || !displayName.trim()) return;
    setSaving(true);
    await updateDoc(doc(db, "users", uid), {
      displayName: displayName.trim(),
      avatarUrl: avatar,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const cat = categoryOf(avatar);
  const name = avatarName(avatar);

  return (
    <div className="screen" style={{ gap: 20, paddingTop: 16 }}>
      <div className="flex items-center" style={{ gap: 8 }}>
        <button className="btn btn-outline btn-sm" onClick={() => navigate("/home")}>
          ‹ Zurück
        </button>
        <h2 style={{ flex: 1, fontSize: 20, color: "var(--text)" }}>Profil</h2>
        <button
          className="btn btn-outline btn-sm"
          style={{ color: "var(--danger)", borderColor: "rgba(239,68,68,0.3)" }}
          onClick={() => signOut(auth)}
        >
          Abmelden
        </button>
        <button
          className="btn btn-primary btn-sm"
          onClick={handleSave}
          disabled={saving || !displayName.trim()}
        >
          {saving ? "…" : "Speichern"}
        </button>
      </div>

      {/* Avatar preview */}
      <div className="card" style={{ padding: "20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 120, height: 120, borderRadius: 28,
          background: "var(--surface2)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          border: `2.5px solid ${cat.color}`, flexShrink: 0,
          gap: 0,
        }}>
          {[...avatar].length >= 2 ? (
            <>
              <span style={{ fontSize: 44, lineHeight: 1.1 }}>{[...avatar][0]}</span>
              <span style={{ fontSize: 36, lineHeight: 1.1 }}>{[...avatar].slice(1).join("")}</span>
            </>
          ) : (
            <span style={{ fontSize: 60 }}>{avatar}</span>
          )}
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>{user?.displayName}</div>
          <div style={{ fontSize: 13, color: "var(--text-sub)", marginTop: 2 }}>{user?.email}</div>
          {name && (
            <div style={{
              marginTop: 8, fontSize: 12, fontWeight: 700,
              padding: "4px 12px", borderRadius: 20, display: "inline-block",
              background: `${cat.color}22`, color: cat.color,
              letterSpacing: 0.6, textTransform: "uppercase",
            }}>
              ⭐ {name}
            </div>
          )}
        </div>
      </div>

      {/* Avatar auswählen */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {/* Titel */}
        <div style={{ padding: "14px 16px 0", color: "var(--text)", fontWeight: 700, fontSize: 15 }}>
          Avatar ändern
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginTop: 10 }}>
          {AVATAR_CATEGORIES.map((c, i) => (
            <button
              key={c.key}
              onClick={() => setActiveTab(i)}
              style={{
                flex: 1, padding: "10px 4px 8px",
                background: "none", border: "none",
                borderBottom: `2.5px solid ${activeTab === i ? c.color : "transparent"}`,
                cursor: "pointer", transition: "all 0.15s",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
              }}
            >
              <span style={{ fontSize: 18 }}>{c.emoji}</span>
              <span style={{
                fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
                textTransform: "uppercase",
                color: activeTab === i ? "var(--text)" : "var(--text-sub)",
              }}>
                {c.label}
              </span>
            </button>
          ))}
        </div>

        {/* Grid */}
        <div style={{ padding: "14px 16px 16px", display: "flex", flexWrap: "wrap", gap: 8 }}>
          {AVATAR_CATEGORIES[activeTab].avatars.map((a) => {
            const selected = a === avatar;
            const ac = AVATAR_CATEGORIES[activeTab];
            const codePoints = [...a];
            const isDouble = codePoints.length >= 2;
            return (
              <button
                key={a}
                onClick={() => setAvatar(a)}
                title={avatarName(a)}
                style={{
                  background: selected ? ac.selBg : "var(--surface2)",
                  border: `2px solid ${selected ? ac.color : "transparent"}`,
                  borderRadius: 12,
                  width: 68, height: 68,
                  cursor: "pointer",
                  transition: "border-color 0.1s",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  gap: 0, padding: 0,
                }}
              >
                {isDouble && codePoints.length > 1 ? (
                  <>
                    <span style={{ fontSize: 24, lineHeight: 1.15 }}>{codePoints[0]}</span>
                    <span style={{ fontSize: 20, lineHeight: 1.15 }}>{codePoints.slice(1).join("")}</span>
                  </>
                ) : (
                  <span style={{ fontSize: 30 }}>{a}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Anzeigename */}
      <div className="card flex flex-col gap-2">
        <div style={{ color: "var(--text)", fontWeight: 700, fontSize: 15 }}>Anzeigename</div>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Dein Name"
        />
      </div>

      {saved && (
        <div style={{
          background: "rgba(34,197,94,0.12)", border: "1px solid var(--success)",
          borderRadius: "var(--radius-sm)", padding: "10px 16px",
          color: "var(--success)", fontSize: 14, textAlign: "center",
        }}>
          ✓ Profil gespeichert
        </div>
      )}
    </div>
  );
}
