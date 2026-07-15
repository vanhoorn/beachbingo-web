import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate, Link } from "react-router-dom";
import { auth, db } from "../firebase";

export default function LoginScreen() {
  const [input, setInput] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleLogin() {
    if (!input.trim() || !password) return;
    setLoading(true);
    setError("");
    try {
      let email = input.trim();
      if (!email.includes("@")) {
        // Lookup by username via the publicly-readable usernameMap collection
        const snap = await getDoc(doc(db, "usernameMap", email.toLowerCase()));
        if (!snap.exists()) throw new Error("Anzeigename nicht gefunden");
        email = snap.data().email as string;
      }
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/home");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "Anzeigename nicht gefunden")
        setError("Anzeigename nicht gefunden. Bitte exakt wie registriert eingeben.");
      else setError("Login fehlgeschlagen. Bitte prüfe deine Eingaben.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="screen justify-center" style={{ gap: 20 }}>
      {/* Hero */}
      <div className="hero-block">
        <div style={{ fontSize: 64, marginBottom: 12 }}>🏖️</div>
        <h1 style={{ color: "#fff", marginBottom: 6 }}>BeachBingo</h1>
        <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 15 }}>
          Sommer. Sonne. Bingo.
        </p>
      </div>

      {/* Formular */}
      <div className="card flex flex-col gap-3">
        <h2 style={{ fontSize: 20, marginBottom: 4 }}>Anmelden</h2>

        <div className="flex flex-col gap-1">
          <label>E-Mail oder Anzeigename</label>
          <input
            type="text"
            placeholder="max@beispiel.de oder MaxMuster"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label>Passwort</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />
        </div>

        {error && (
          <div style={{
            background: "var(--danger-bg)", border: "1px solid var(--danger)",
            borderRadius: "var(--radius-sm)", padding: "10px 14px",
            color: "var(--danger)", fontSize: 14
          }}>
            {error}
          </div>
        )}

        <button
          className="btn btn-primary"
          onClick={handleLogin}
          disabled={loading || !input.trim() || !password}
          style={{ marginTop: 4 }}
        >
          {loading ? "Einloggen…" : "Einloggen"}
        </button>
      </div>

      <p className="text-center text-sub">
        Noch kein Konto?{" "}
        <Link to="/register" style={{ color: "var(--primary)", fontWeight: 600 }}>
          Jetzt registrieren
        </Link>
      </p>
    </div>
  );
}
