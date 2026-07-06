import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import type { User } from "../types";
import { ALL_GAMES, PLAYER_COUNT_INFO, PLAYER_COUNT_ORDER, type PlayerCountKey } from "../gameMetadata";

export default function HomeScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const navigate = useNavigate();
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid) return;
    getDoc(doc(db, "users", uid)).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setUser(data as User);
        setFavoriteIds(data.favoriteGames ?? []);
        setRecentIds(data.recentGames ?? []);
      }
    });
  }, [uid]);

  async function handleGameClick(gameId: string, path: string) {
    if (uid) {
      const filtered = recentIds.filter((id) => id !== gameId);
      const updated = [gameId, ...filtered].slice(0, 10);
      setRecentIds(updated);
      updateDoc(doc(db, "users", uid), { recentGames: updated });
    }
    navigate(path);
  }

  const favoriteGames = ALL_GAMES
    .filter((g) => favoriteIds.includes(g.id))
    .sort((a, b) => a.title.localeCompare(b.title));

  const recentGames = recentIds
    .slice(0, 3)
    .map((id) => ALL_GAMES.find((g) => g.id === id))
    .filter(Boolean) as typeof ALL_GAMES;

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
              background: "var(--surface2)", border: "1px solid var(--border)",
              borderRadius: 14, width: 48, height: 48, fontSize: 22, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >🔗</button>
          <button
            onClick={() => navigate("/profile")}
            title="Profil & Abmelden"
            style={{
              background: "var(--surface2)", border: "1px solid var(--border)",
              borderRadius: 14, width: 48, height: 48, fontSize: 22, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >👤</button>
        </div>
      </div>

      <div style={{ paddingBottom: 32 }}>

        {/* Favoriten */}
        {favoriteGames.length > 0 && (
          <section style={{ padding: "24px 20px 0" }}>
            <SectionHeader title="Favoriten" emoji="★" />
            <div style={{
              display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4,
              scrollbarWidth: "none",
            }}>
              {favoriteGames.map((g) => (
                <MiniCard
                  key={g.id}
                  game={g}
                  onClick={() => handleGameClick(g.id, g.path)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Zuletzt gespielt */}
        {recentGames.length > 0 && (
          <section style={{ padding: "24px 20px 0" }}>
            <SectionHeader title="Zuletzt gespielt" emoji="🕐" />
            <div style={{ display: "flex", gap: 10 }}>
              {recentGames.map((g) => (
                <MiniCard
                  key={g.id}
                  game={g}
                  onClick={() => handleGameClick(g.id, g.path)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Spieleranzahl */}
        <section style={{ padding: "24px 20px 0" }}>
          <SectionHeader title="Spieleranzahl" emoji="🎮" />
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 10,
          }}>
            {PLAYER_COUNT_ORDER.map((key) => {
              const info = PLAYER_COUNT_INFO[key];
              const count = ALL_GAMES.filter((g) => g.playerCounts.includes(key)).length;
              return (
                <CategoryTile
                  key={key}
                  playerKey={key}
                  emoji={info.emoji}
                  label={info.label}
                  gameCount={count}
                  onClick={() => navigate(`/category/${key}`)}
                />
              );
            })}
          </div>
        </section>

      </div>
    </div>
  );
}

function SectionHeader({ title, emoji }: { title: string; emoji: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <span style={{ fontSize: 16 }}>{emoji}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 0.5 }}>
        {title.toUpperCase()}
      </span>
    </div>
  );
}

function MiniCard({ game, onClick }: { game: { id: string; emoji: string; title: string; color: string }; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flexShrink: 0, width: 90, padding: "14px 8px 12px",
        background: hovered ? "var(--surface2)" : "var(--surface)",
        border: `1.5px solid ${hovered ? game.color : game.color + "55"}`,
        borderRadius: 14, cursor: "pointer", textAlign: "center",
        transition: "all 0.15s",
      }}
    >
      <div style={{ fontSize: 28, marginBottom: 6 }}>{game.emoji}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", lineHeight: 1.3 }}>
        {game.title}
      </div>
    </button>
  );
}

function CategoryTile({
  playerKey, emoji, label, gameCount, onClick,
}: {
  playerKey: PlayerCountKey;
  emoji: string;
  label: string;
  gameCount: number;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "16px 8px 14px",
        background: hovered ? "var(--surface2)" : "var(--surface)",
        border: `1.5px solid ${hovered ? "var(--primary)" : "var(--border)"}`,
        borderRadius: 14, cursor: "pointer", textAlign: "center",
        transition: "all 0.15s",
      }}
    >
      <div style={{ fontSize: 26, marginBottom: 6 }}>{emoji}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", lineHeight: 1.3 }}>
        {label}
      </div>
      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>
        {gameCount} {gameCount === 1 ? "Spiel" : "Spiele"}
      </div>
    </button>
  );
}
