import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import type { User } from "../types";

interface GameEntry {
  id: string;
  emoji: string;
  title: string;
  description: string;
  color: string;
  iconBg?: string;
  available: boolean;
  path: string;
}

const GAMES: GameEntry[] = [
  {
    id: "bingo",
    emoji: "🎱",
    title: "BeachBingo",
    description: "Ziehe Zahlen, markiere deine Karte – BINGO!",
    color: "var(--primary)",
    available: true,
    path: "/lobby",
  },
  {
    id: "pong",
    emoji: "🏓",
    title: "BeachVolley",
    description: "Klassisches Tischtennis am Strand – wer gewinnt die Runde?",
    color: "var(--coral)",
    available: true,
    path: "/pong/lobby",
  },
  {
    id: "vier",
    emoji: "🍺",
    title: "Vier4Bier",
    description: "Vier in einer Reihe mit Beach-Twist.",
    color: "var(--accent)",
    available: true,
    path: "/vier/lobby",
  },
  {
    id: "pirates",
    emoji: "🐙",
    title: "BeachPirates",
    description: "Verteidige den Strand! Besiege Quallen, Muscheln und Fische als Oktopus.",
    color: "#a855f7",
    iconBg: "transparent",
    available: true,
    path: "/pirates/lobby",
  },
];

export default function HomeScreen() {
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid) return;
    getDoc(doc(db, "users", uid)).then((snap) => {
      if (snap.exists()) setUser(snap.data() as User);
    });
  }, [uid]);

  return (
    <div className="screen" style={{ gap: 0, paddingTop: 0 }}>

      {/* Hero */}
      <div style={{
        background: "linear-gradient(135deg, var(--surface) 0%, var(--surface2) 100%)",
        padding: "32px 20px 28px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 52, lineHeight: 1 }}>{user?.avatarUrl || "🏖️"}</div>
          <div>
            <div style={{
              fontSize: 11, color: "var(--text-muted)", fontWeight: 700,
              letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 2,
            }}>
              Willkommen zurück
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)" }}>
              {user?.displayName || "…"}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button
            onClick={() => navigate("/join")}
            title="Spiel beitreten"
            style={{
              background: "var(--surface2)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              width: 48, height: 48,
              fontSize: 22,
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            🔗
          </button>
          <button
            onClick={() => navigate("/profile")}
            title="Profil & Abmelden"
            style={{
              background: "var(--surface2)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              width: 48, height: 48,
              fontSize: 22,
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            👤
          </button>
        </div>
      </div>

      {/* Headline */}
      <div style={{ padding: "28px 20px 16px" }}>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 4, fontWeight: 600 }}>
          BeachBande
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text)" }}>
          Spiel auswählen
        </div>
      </div>

      {/* Game Cards */}
      <div style={{ padding: "0 20px 0", display: "flex", flexDirection: "column", gap: 14 }}>
        {GAMES.map((game) => (
          <GameCard key={game.id} game={game} onSelect={() => navigate(game.path)} />
        ))}
      </div>

    </div>
  );
}

function GameCard({ game, onSelect }: { game: GameEntry; onSelect: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={() => { if (game.available) onSelect(); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "var(--surface)",
        border: `1.5px solid ${game.available && hovered ? game.color : game.available ? game.color + "55" : "var(--border)"}`,
        borderRadius: "var(--radius)",
        padding: "20px",
        cursor: game.available ? "pointer" : "default",
        textAlign: "left",
        opacity: game.available ? 1 : 0.55,
        transform: game.available && hovered ? "translateY(-2px)" : "translateY(0)",
        transition: "transform 0.15s ease, border-color 0.15s ease",
        display: "flex", alignItems: "center", gap: 16,
        width: "100%",
      }}
    >
      <div style={{
        width: 64, height: 64,
        borderRadius: 18,
        background: game.iconBg ?? (game.available ? game.color + "22" : "var(--surface2)"),
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 34, flexShrink: 0,
        transition: "background 0.15s",
      }}>
        {game.emoji}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>
            {game.title}
          </span>
          {!game.available && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "2px 8px",
              borderRadius: 20,
              background: "var(--surface2)", color: "var(--text-muted)",
              letterSpacing: 0.8, textTransform: "uppercase",
            }}>
              Bald
            </span>
          )}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
          {game.description}
        </div>
      </div>

      {game.available && (
        <div style={{ fontSize: 22, color: "var(--text-muted)", flexShrink: 0 }}>›</div>
      )}
    </button>
  );
}
