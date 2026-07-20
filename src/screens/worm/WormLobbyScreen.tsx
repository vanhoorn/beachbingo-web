import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase";
import type { WormDifficulty, User } from "../../types";
import GameRulesModal from "../../components/GameRulesModal";
import { GAME_RULES } from "../../gameRules";

const WORM_GREEN = "#22c55e";

function DiffOption({ selected, onClick, title, description }: {
  selected: boolean; onClick: () => void; title: string; description: string;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: selected ? "rgba(34,197,94,0.12)" : "var(--surface)",
        border: `1.5px solid ${selected ? WORM_GREEN : "var(--border)"}`,
        borderRadius: "var(--radius)",
        padding: "14px 18px",
        cursor: "pointer",
        transition: "border-color 0.15s, background 0.15s",
        display: "flex", alignItems: "center", gap: 12,
      }}
    >
      <div style={{
        width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
        border: `2px solid ${selected ? WORM_GREEN : "var(--text-muted)"}`,
        background: selected ? WORM_GREEN : "transparent",
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

export default function WormLobbyScreen() {
  const [difficulty, setDifficulty] = useState<WormDifficulty>("ROOKIE");
  const [controlMode, setControlMode] = useState<"BUTTONS" | "SWIPE">("BUTTONS");
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const navigate = useNavigate();
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid) return;
    getDoc(doc(db, "users", uid)).then((snap) => {
      if (snap.exists()) {
        const u = snap.data() as User;
        setDifficulty(u.preferredWormDifficulty ?? "ROOKIE");
        setControlMode(u.preferredWormControlMode ?? "BUTTONS");
        setIsFavorite((u as unknown as Record<string, string[]>).favoriteGames?.includes("worm") ?? false);
      }
      setLoading(false);
    });
  }, [uid]);

  async function toggleFavorite() {
    if (!uid) return;
    const next = !isFavorite;
    setIsFavorite(next);
    await updateDoc(doc(db, "users", uid), {
      favoriteGames: next ? arrayUnion("worm") : arrayRemove("worm"),
    });
  }

  if (loading) {
    return (
      <div className="screen" style={{ alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 48 }}>🪱</span>
      </div>
    );
  }

  return (
    <div className="screen" style={{ gap: 20, paddingTop: 16 }}>
      {/* Header */}
      <div className="flex items-center" style={{ gap: 12 }}>
        <button className="btn btn-outline btn-sm" onClick={() => navigate("/home")}>‹ Zurück</button>
        <h2 style={{ fontSize: 20 }}>Wattwurm</h2>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={() => navigate("/worm/highscores")}>🏆</button>
          <button
            className="btn btn-outline btn-sm"
            onClick={toggleFavorite}
            style={{ color: isFavorite ? "var(--accent)" : undefined, borderColor: isFavorite ? "var(--accent)" : undefined }}
          >
            {isFavorite ? "★" : "☆"}
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => setShowRules(true)} title="Spielanleitung"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5" fill="currentColor"/></svg></button>
          <button className="btn btn-outline btn-sm" onClick={() => navigate("/worm/settings")}>⚙️</button>
        </div>
      </div>

      {/* Hero */}
      <div style={{
        background: "linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(34,197,94,0.05) 100%)",
        border: "1px solid rgba(34,197,94,0.3)",
        borderRadius: "var(--radius)",
        padding: "24px 20px",
        textAlign: "center",
      }}>
        <div style={{ fontSize: 56 }}>🪱</div>
        <div style={{ fontSize: 18, fontWeight: 800, marginTop: 8 }}>Wattenfresser unterwegs!</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.5 }}>
          Frisst Krabben 🦀, Muscheln 🐚 und Fische 🐟.<br />
          Werde länger — verliere dich nicht!
        </div>
      </div>

      {/* Difficulty */}
      <div className="flex flex-col gap-2">
        <div className="card-title" style={{ paddingLeft: 4 }}>Schwierigkeit</div>
        <DiffOption
          selected={difficulty === "ROOKIE"}
          onClick={() => setDifficulty("ROOKIE")}
          title="🌊 Rookie"
          description="Langsam · Wände töten · Ideal zum Starten"
        />
        <DiffOption
          selected={difficulty === "SNIPER"}
          onClick={() => setDifficulty("SNIPER")}
          title="🎯 Sniper"
          description="Schneller · Wände töten · Echte Herausforderung"
        />
        <DiffOption
          selected={difficulty === "BOSS_LEVEL"}
          onClick={() => setDifficulty("BOSS_LEVEL")}
          title="💪 Boss Level"
          description="Sehr schnell · Wände = Teleport · Viel Spaß 😈"
        />
      </div>

      {/* Control mode preview */}
      <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
        Steuerung: <strong style={{ color: "var(--text)" }}>{controlMode === "BUTTONS" ? "🔲 Buttons" : "👆 Swipe"}</strong>
        {" "}· <span style={{ cursor: "pointer", color: WORM_GREEN }} onClick={() => navigate("/worm/settings")}>Ändern</span>
      </div>

      <button
        className="btn btn-primary"
        style={{ background: WORM_GREEN, borderColor: WORM_GREEN, fontSize: 17, padding: "16px" }}
        onClick={() => navigate("/worm/game", { state: { difficulty, controlMode } })}
      >
        🎮 Spielen
      </button>
      {showRules && GAME_RULES["worm"] && (
        <GameRulesModal rule={GAME_RULES["worm"]} onClose={() => setShowRules(false)} />
      )}
    </div>
  );
}
