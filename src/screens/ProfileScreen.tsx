import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import { BEACH_AVATARS } from "../types";
import type { User } from "../types";

export default function ProfileScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatar, setAvatar] = useState(BEACH_AVATARS[0]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const navigate = useNavigate();
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid) return;
    getDoc(doc(db, "users", uid)).then((snap) => {
      if (snap.exists()) {
        const u = snap.data() as User;
        setUser(u);
        setDisplayName(u.displayName);
        setAvatar(u.avatarUrl || BEACH_AVATARS[0]);
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

  return (
    <div className="screen" style={{ gap: 20, paddingTop: 16 }}>
      <div className="flex items-center" style={{ gap: 12 }}>
        <button className="btn btn-outline btn-sm" onClick={() => navigate("/lobby")}>
          ‹ Zurück
        </button>
        <h2 style={{ fontSize: 20 }}>Profil</h2>
      </div>

      {/* Avatar-Anzeige */}
      <div className="card text-center" style={{ padding: "28px 20px" }}>
        <div style={{ fontSize: 72, marginBottom: 8 }}>{avatar}</div>
        <div style={{ fontWeight: 700, fontSize: 18 }}>{user?.displayName}</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>{user?.email}</div>
      </div>

      {/* Avatar wählen */}
      <div className="card">
        <div className="card-title">Avatar ändern</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {BEACH_AVATARS.map((a) => (
            <button
              key={a}
              onClick={() => setAvatar(a)}
              style={{
                fontSize: 26,
                background: a === avatar ? "var(--primary)" : "var(--surface2)",
                border: a === avatar ? "2px solid var(--primary)" : "2px solid transparent",
                borderRadius: 12,
                width: 52, height: 52,
                cursor: "pointer",
                transition: "background 0.15s, transform 0.1s",
                transform: a === avatar ? "scale(1.15)" : "scale(1)",
              }}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* Anzeigename */}
      <div className="card flex flex-col gap-2">
        <div className="card-title">Anzeigename</div>
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

      <button
        className="btn btn-primary"
        onClick={handleSave}
        disabled={saving || !displayName.trim()}
      >
        {saving ? "Speichern…" : "Speichern"}
      </button>

      <div style={{ marginTop: "auto" }}>
        <div className="divider" style={{ marginBottom: 16 }} />
        <button
          className="btn btn-outline"
          style={{ color: "var(--danger)", borderColor: "rgba(239,68,68,0.3)" }}
          onClick={() => signOut(auth)}
        >
          Abmelden
        </button>
      </div>
    </div>
  );
}
