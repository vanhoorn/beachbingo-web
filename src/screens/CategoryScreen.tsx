import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { ALL_GAMES, PLAYER_COUNT_INFO, type PlayerCountKey } from "../gameMetadata";
import { GAME_RULES } from "../gameRules";
import GameRulesModal from "../components/GameRulesModal";

export default function CategoryScreen() {
  const { playerCount } = useParams<{ playerCount: string }>();
  const navigate = useNavigate();
  const uid = auth.currentUser?.uid;
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [rulesGameId, setRulesGameId] = useState<string | null>(null);

  const key = playerCount as PlayerCountKey;
  const info = PLAYER_COUNT_INFO[key];
  const games = ALL_GAMES.filter((g) => g.playerCounts.includes(key));
  const activeRule = rulesGameId ? GAME_RULES[rulesGameId] : null;

  useEffect(() => {
    if (!uid) return;
    getDoc(doc(db, "users", uid)).then((snap) => {
      setRecentIds(snap.data()?.recentGames ?? []);
    });
  }, [uid]);

  if (!info) return <Navigate to="/home" replace />;

  function handleGameClick(gameId: string, path: string) {
    if (uid) {
      const filtered = recentIds.filter((id) => id !== gameId);
      const updated = [gameId, ...filtered].slice(0, 10);
      setRecentIds(updated);
      updateDoc(doc(db, "users", uid), { recentGames: updated });
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
            <GameCard
              key={game.id}
              game={game}
              onSelect={() => handleGameClick(game.id, game.path)}
              onInfo={() => setRulesGameId(game.id)}
            />
          ))
        )}
      </div>

      {activeRule && (
        <GameRulesModal rule={activeRule} onClose={() => setRulesGameId(null)} />
      )}
    </div>
  );
}

function GameCard({
  game,
  onSelect,
  onInfo,
}: {
  game: { id: string; emoji: string; title: string; description: string; color: string };
  onSelect: () => void;
  onInfo: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [infoHovered, setInfoHovered] = useState(false);

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "var(--surface)",
        border: `1.5px solid ${hovered ? game.color : game.color + "55"}`,
        borderRadius: "var(--radius)", padding: "20px", cursor: "pointer",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
        transition: "transform 0.15s ease, border-color 0.15s ease",
        display: "flex", alignItems: "center", gap: 16, width: "100%",
        boxSizing: "border-box",
      }}
    >
      <div style={{
        width: 64, height: 64, borderRadius: 18,
        background: game.color + "22",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 34, flexShrink: 0,
      }}>
        {game.id === "meermau"
          ? <img src="/meermau-logo.svg" alt="MeerMau" style={{ width: 42, height: 42, objectFit: "contain" }} />
          : game.emoji}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
          {game.title}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
          {game.description}
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onInfo(); }}
        onMouseEnter={(e) => { e.stopPropagation(); setInfoHovered(true); }}
        onMouseLeave={(e) => { e.stopPropagation(); setInfoHovered(false); }}
        title="Anleitung anzeigen"
        style={{
          width: 34, height: 34, flexShrink: 0,
          background: infoHovered ? game.color + "33" : "var(--surface2)",
          border: `1px solid ${infoHovered ? game.color : "var(--border)"}`,
          borderRadius: 10, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, color: game.color,
          transition: "background 0.15s, border-color 0.15s",
        }}
      >ℹ</button>
      <div style={{ fontSize: 22, color: "var(--text-muted)", flexShrink: 0 }}>›</div>
    </div>
  );
}
