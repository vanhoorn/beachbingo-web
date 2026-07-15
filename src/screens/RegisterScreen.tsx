import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useNavigate, Link } from "react-router-dom";
import { auth, db } from "../firebase";
import { BEACH_AVATARS } from "../types";

export default function RegisterScreen() {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [avatar, setAvatar] = useState(BEACH_AVATARS[0]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleRegister() {
    if (!email.trim() || !displayName.trim() || !password) return;
    setLoading(true);
    setError("");
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await setDoc(doc(db, "users", cred.user.uid), {
        uid: cred.user.uid,
        displayName: displayName.trim(),
        email: email.trim(),
        avatarUrl: avatar,
        preferredGameMode: "AUTO_MARK",
        preferredDrawStyle: "INSTANT",
        bossLevelEliminationInterval: 5,
        createdAt: Date.now(),
      });
      // Write to public username index for username-based login
      await setDoc(doc(db, "usernames", displayName.trim().toLowerCase()), {
        email: email.trim(),
      });
      navigate("/home");
    } catch (e: unknown) {
      const msg = (e as { code?: string })?.code;
      if (msg === "auth/email-already-in-use") setError("E-Mail bereits registriert.");
      else if (msg === "auth/weak-password") setError("Passwort muss mindestens 6 Zeichen haben.");
      else setError("Registrierung fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="screen" style={{ gap: 20, paddingTop: 24 }}>
      {/* Hero */}
      <div className="hero-block">
        <div style={{ fontSize: 52, marginBottom: 10 }}>🏖️</div>
        <h1 style={{ color: "#fff", fontSize: 26, marginBottom: 4 }}>Konto erstellen</h1>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>
          Wähle deinen Avatar und leg los!
        </p>
      </div>

      {/* Avatar */}
      <div className="card">
        <div className="card-title">Dein Avatar</div>
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
                width: 52,
                height: 52,
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

      {/* Formular */}
      <div className="card flex flex-col gap-3">
        <h3 style={{ marginBottom: 4 }}>Deine Daten</h3>

        <div className="flex flex-col gap-1">
          <label>Anzeigename</label>
          <input
            type="text"
            placeholder="z.B. MaxMuster"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label>E-Mail</label>
          <input
            type="email"
            placeholder="max@beispiel.de"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label>Passwort</label>
          <input
            type="password"
            placeholder="Mind. 6 Zeichen"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRegister()}
          />
        </div>

        {error && (
          <div style={{
            background: "var(--danger-bg)",
            border: "1px solid var(--danger)",
            borderRadius: "var(--radius-sm)",
            padding: "10px 14px",
            color: "var(--danger)",
            fontSize: 14,
          }}>
            {error}
          </div>
        )}

        <button
          className="btn btn-primary"
          onClick={handleRegister}
          disabled={loading || !email.trim() || !displayName.trim() || !password}
          style={{ marginTop: 4 }}
        >
          {loading ? "Erstelle Konto…" : "Konto erstellen"}
        </button>
      </div>

      <p className="text-center text-sub" style={{ paddingBottom: 16 }}>
        Bereits ein Konto?{" "}
        <Link to="/login" style={{ color: "var(--primary)", fontWeight: 600 }}>
          Einloggen
        </Link>
      </p>
    </div>
  );
}
