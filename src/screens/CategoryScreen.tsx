import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { ALL_GAMES, PLAYER_COUNT_INFO, type PlayerCountKey } from "../gameMetadata";

export default function CategoryScreen() {
  const { playerCount } = useParams<{ playerCount: string }>();
  const navigate = useNavigate();
  const uid = auth.currentUser?.uid;

  const key = playerCount as PlayerCountKey;
  const info = PLAYER_COUNT_INFO[key];
  const games = ALL_GAMES.filter((g) => g.playerCounts.includes(key));

  if (!info) {
    navigate("/home");
    return null;
  }

  function handleGameClick(gameId: string, path: string) {
    if (uid) {
      getDoc(doc(db, "users", uid)).then((snap) => {
        const current: string[] = snap.data()?.recentGames ?? [];
        const filtered = current.filter((id: string) => id !== gameId);
        const updated = [gameId, ...filtered].slice(0, 10);
        updateDoc(doc(db, "users", uid), { recentGames: updated });
      });
    }
    navigate(path);
  }

  return (
    <div className="screen" style={{ gap: 0, paddingTop: 0 }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, var(--surface) 0%, var(--surface2) 100%)",
        padding: "20px 20px 20px",
        display: "flex", alignItems: "center", gap: 14,
      }}>
        <button
          onClick={() => navigate("/home")}
          style={{
            background: "var(--surface2)", border: "1px solid var(--border)",
            borderRadius: 12, width: 40, height: 40, fontSize: 18, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}
        >←</button>
        <div style={{ fontSize: 36, lineHeight: 1 }}>{info.emoji}</div>
        <div>
          <div style={{
            fontSize: 10, color: "var(--text-muted)", fontWeight: 700,
            letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 2,
          }}>Spieleranzahl</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text)" }}>{info.label}</div>
        </div>
      </div>

      {/* Games list */}
      <div style={{ padding: "20px 20px 32px", display: "flex", flexDirection: "column", gap: 14 }}>
        {games.length === 0 ? (
          <div style={{ color: "var(--text-muted)", fontSize: 14, textAlign: "center", paddingTop: 40 }}>
            Keine Spiele in dieser Kategorie.
          </div>
        ) : (
          games.map((game) => (
            <GameCard key={game.id} game={game} onSelect={() => handleGameClick(game.id, game.path)} />
          ))
        )}
      </div>
    </div>
  );
}

function GameCard({ game, onSelect }: {
  game: { id: string; emoji: string; title: string; description: string; color: string };
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "var(--surface)",
        border: `1.5px solid ${hovered ? game.color : game.color + "55"}`,
        borderRadius: "var(--radius)", padding: "20px", cursor: "pointer",
        textAlign: "left",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
        transition: "transform 0.15s ease, border-color 0.15s ease",
        display: "flex", alignItems: "center", gap: 16, width: "100%",
      }}
    >
      <div style={{
        width: 64, height: 64, borderRadius: 18,
        background: game.color + "22",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 34, flexShrink: 0,
      }}>
        {game.emoji}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
          {game.title}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
          {game.description}
        </div>
      </div>
      <div style={{ fontSize: 22, color: "var(--text-muted)", flexShrink: 0 }}>›</div>
    </button>
  );
}
