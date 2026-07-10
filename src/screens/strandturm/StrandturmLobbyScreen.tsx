import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase";
import type { User } from "../../types";

const RED = "#dc2626";
const RED_BG = "rgba(220,38,38,0.12)";

export default function StrandturmLobbyScreen() {
  const [controlMode, setControlMode] = useState<"BUTTONS" | "TOUCH">("BUTTONS");
  const [highScore, setHighScore] = useState(0);
  const [bestLevel, setBestLevel] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid) return;
    getDoc(doc(db, "users", uid)).then((snap) => {
      if (snap.exists()) {
        const u = snap.data() as User;
        setControlMode(u.preferredStrandturmControlMode ?? "BUTTONS");
        setHighScore(u.strandturmHighScore ?? 0);
        setBestLevel(u.strandturmBestLevel ?? 0);
        setIsFavorite(
          ((u as unknown as Record<string, string[]>).favoriteGames ?? []).includes("strandturm")
        );
      }
      setLoading(false);
    });
  }, [uid]);

  async function toggleFavorite() {
    if (!uid) return;
    const next = !isFavorite;
    setIsFavorite(next);
    await updateDoc(doc(db, "users", uid), {
      favoriteGames: next ? arrayUnion("strandturm") : arrayRemove("strandturm"),
    });
  }

  if (loading) {
    return (
      <div className="screen" style={{ alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 48 }}>🗼</span>
      </div>
    );
  }

  return (
    <div className="screen" style={{ gap: 20, paddingTop: 16 }}>
      {/* Header */}
      <div className="flex items-center" style={{ gap: 12 }}>
        <button className="btn btn-outline btn-sm" onClick={() => navigate("/home")}>‹ Zurück</button>
        <h2 style={{ fontSize: 20 }}>Strandturm</h2>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={() => navigate("/strandturm/highscores")}>🏆</button>
          <button
            className="btn btn-outline btn-sm"
            onClick={toggleFavorite}
            style={{ color: isFavorite ? "var(--accent)" : undefined, borderColor: isFavorite ? "var(--accent)" : undefined }}
          >
            {isFavorite ? "★" : "☆"}
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => navigate("/strandturm/settings")}>⚙️</button>
        </div>
      </div>

      {/* Hero */}
      <div style={{
        background: `linear-gradient(135deg, ${RED_BG} 0%, rgba(220,38,38,0.04) 100%)`,
        border: `1px solid rgba(220,38,38,0.3)`,
        borderRadius: "var(--radius)",
        padding: "24px 20px",
        textAlign: "center",
      }}>
        <div style={{ fontSize: 56 }}>🗼</div>
        <div style={{ fontSize: 18, fontWeight: 800, marginTop: 8 }}>Rette das Surfbrett!</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6 }}>
          Mega-Möwe 🐦 wirft Kokosnüsse 🥥 vom Pier.<br />
          Klettere nach oben — ohne getroffen zu werden!
        </div>
      </div>

      {/* High score tiles */}
      {(highScore > 0 || bestLevel > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: RED }}>{highScore}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>🏆 Rekord</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: "var(--primary)" }}>Lv. {bestLevel}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>🎯 Höchstes Level</div>
          </div>
        </div>
      )}

      {/* How to play */}
      <div className="card" style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.7 }}>
        <div style={{ fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>So geht's</div>
        <div>🪜 Leitern hochklettern &nbsp;·&nbsp; 🥥 Kokosnüssen ausweichen</div>
        <div>❤️ 3 Leben &nbsp;·&nbsp; ⏱ Bonuszeit läuft ab</div>
        <div style={{ marginTop: 4, color: "var(--text-sub)", fontSize: 12 }}>
          Steuerung: <strong style={{ color: "var(--text)" }}>
            {controlMode === "BUTTONS" ? "🔲 Buttons" : "👆 Touch-Zonen"}
          </strong>
          {" "}·{" "}
          <span style={{ cursor: "pointer", color: RED }} onClick={() => navigate("/strandturm/settings")}>Ändern</span>
        </div>
      </div>

      <button
        className="btn btn-primary"
        style={{ background: RED, borderColor: RED, fontSize: 17, padding: "16px" }}
        onClick={() => navigate("/strandturm/game", { state: { controlMode } })}
      >
        🎮 Spielen
      </button>
    </div>
  );
}
