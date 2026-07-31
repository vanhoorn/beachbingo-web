import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import type { User } from "../types";
import { ALL_GAMES, PLAYER_COUNT_INFO, PLAYER_COUNT_ORDER, RIDDLE_GAMES, type PlayerCountKey } from "../gameMetadata";
import { getPuzzleSaves, PUZZLE_GAME_INFO, formatElapsed, PUZZLE_DIFFICULTY_LABELS, type PuzzleSave } from "../puzzleSave";

interface ActiveGameInfo {
  type: string;
  gameId: string;
  name: string;
  emoji: string;
  path: string;
}

export default function HomeScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [activeGame, setActiveGame] = useState<ActiveGameInfo | null>(null);
  const [savedPuzzles, setSavedPuzzles] = useState<PuzzleSave[]>([]);
  const navigate = useNavigate();
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    setSavedPuzzles(getPuzzleSaves());
  }, []);

  useEffect(() => {
    if (!uid) return;
    getDoc(doc(db, "users", uid)).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setUser(data as User);
        setFavoriteIds(data.favoriteGames ?? []);
      }
    });
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    const GAME_COLLECTIONS = [
      { type: "strandraeuber", col: "strandraeuberGames", name: "Strandräuber", emoji: "🦹", path: "/strandraeuber/game" },
      { type: "meermau",       col: "meermauGames",       name: "MeerMau",       emoji: "🃏", path: "/meermau/game" },
      { type: "brandung",      col: "brandungGames",      name: "Brandung",      emoji: "🌊", path: "/brandung/game" },
      { type: "bingo",         col: "games",              name: "Bingo",         emoji: "🎱", path: "/game" },
    ];
    (async () => {
      for (const { type, col, name, emoji, path } of GAME_COLLECTIONS) {
        try {
          const q = query(collection(db, col), where("status", "==", "RUNNING"), where("playerIds", "array-contains", uid));
          const snap = await getDocs(q);
          if (!snap.empty) {
            setActiveGame({ type, gameId: snap.docs[0].id, name, emoji, path });
            return;
          }
        } catch { /* ignore */ }
      }
    })();
  }, [uid]);

  function handleGameClick(_gameId: string, path: string) {
    navigate(path);
  }

  async function deleteActiveGame() {
    if (!activeGame) return;
    if (!confirm(`"${activeGame.name}" wirklich löschen? Das Spiel wird für alle Spieler beendet.`)) return;
    const collectionByType: Record<string, string> = {
      strandraeuber: "strandraeuberGames",
      meermau: "meermauGames",
      brandung: "brandungGames",
      bingo: "games",
    };
    const col = collectionByType[activeGame.type];
    if (col) await deleteDoc(doc(db, col, activeGame.gameId));
    setActiveGame(null);
  }

  const favoriteGames = ALL_GAMES
    .filter((g) => favoriteIds.includes(g.id))
    .sort((a, b) => a.title.localeCompare(b.title));

  const cardGameCount = ALL_GAMES.filter((g) => g.genres.includes("CARD")).length;
  const riddleCount = RIDDLE_GAMES.length;

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

        {/* Aktives Spiel Banner */}
        {activeGame && (
          <div style={{
            margin: "16px 20px 0",
            background: "var(--surface)",
            border: "1.5px solid rgba(14,165,233,0.5)",
            borderRadius: 14, padding: "14px 16px",
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#0ea5e9", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>
              Aktives Spiel
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 24 }}>{activeGame.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>{activeGame.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Code: {activeGame.gameId}</div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn btn-outline"
                  style={{ flex: 1, fontSize: 13, padding: "8px" }}
                  onClick={() => setActiveGame(null)}
                >Ignorieren</button>
                <button
                  className="btn btn-outline"
                  style={{ flex: 1, fontSize: 13, padding: "8px", borderColor: "#ef4444", color: "#ef4444" }}
                  onClick={deleteActiveGame}
                >🗑 Löschen</button>
              </div>
              <button
                className="btn"
                style={{ width: "100%", fontSize: 13, padding: "8px", background: "#0ea5e9", color: "white" }}
                onClick={() => {
                  if (activeGame.type === "strandraeuber") {
                    sessionStorage.setItem("spGame", JSON.stringify({ mode: "online", gameId: activeGame.gameId }));
                  }
                  navigate(activeGame.path);
                }}
              >Weiterspielen →</button>
            </div>
          </div>
        )}

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

        {/* Spieleranzahl */}
        <section style={{ padding: "24px 20px 0" }}>
          <SectionHeader title="Spieleranzahl" emoji="👥" />
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

        {/* Rätsel */}
        <section style={{ padding: "24px 20px 0" }}>
          <SectionHeader title="Rätsel" emoji="🧩" />
          <button
            onClick={() => navigate("/raetsel")}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 14,
              padding: "18px 20px", background: "var(--surface)",
              border: "1.5px solid rgba(56,189,248,0.4)", borderRadius: 14,
              cursor: "pointer", textAlign: "left",
            }}
          >
            <span style={{ fontSize: 28 }}>🧩</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>Rätsel</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                {riddleCount} Rätsel · Strandoku, WellenSumme & mehr
              </div>
            </div>
            <span style={{ fontSize: 20, color: "#38bdf8" }}>›</span>
          </button>
        </section>

        {/* Kartenspiele */}
        <section style={{ padding: "24px 20px 0" }}>
          <SectionHeader title="Kartenspiele" emoji="🃏" />
          <button
            onClick={() => navigate("/card-games")}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 14,
              padding: "18px 20px", background: "var(--surface)",
              border: "1.5px solid rgba(124,58,237,0.4)", borderRadius: 14,
              cursor: "pointer", textAlign: "left",
            }}
          >
            <span style={{ fontSize: 28 }}>🃏</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>Kartenspiele</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                {cardGameCount} {cardGameCount === 1 ? "Spiel" : "Spiele"} · MeerMau, Brandung & mehr
              </div>
            </div>
            <span style={{ fontSize: 20, color: "#7c3aed" }}>›</span>
          </button>
        </section>

        {/* Gespeicherte Spiele */}
        {savedPuzzles.length > 0 && (
          <section style={{ padding: "24px 20px 0" }}>
            <SectionHeader title="Gespeicherte Spiele" emoji="💾" />
            <div style={{
              display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4,
              scrollbarWidth: "none",
            }}>
              {savedPuzzles.map((save) => {
                const info = PUZZLE_GAME_INFO[save.gameType];
                if (!info) return null;
                return (
                  <SavedPuzzleCard
                    key={save.id}
                    save={save}
                    info={info}
                    onClick={() => navigate(`/raetsel/${save.gameType}`, { state: { resumeSaveId: save.id } })}
                  />
                );
              })}
            </div>
          </section>
        )}

        {/* Alle Spiele */}
        <section style={{ padding: "24px 20px 0" }}>
          <SectionHeader title="Alle Spiele" emoji="🎮" />
          <button
            onClick={() => navigate("/all-games")}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 14,
              padding: "18px 20px", background: "var(--surface)",
              border: "1.5px solid rgba(14,165,233,0.4)", borderRadius: 14,
              cursor: "pointer", textAlign: "left",
            }}
          >
            <span style={{ fontSize: 28 }}>🎮</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>Alle Spiele</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                {ALL_GAMES.length} Spiele · alphabetisch sortiert
              </div>
            </div>
            <span style={{ fontSize: 20, color: "#0ea5e9" }}>›</span>
          </button>
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
      <div style={{ fontSize: 28, marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {game.id === "meermau"
            ? <img src="/meermau-logo.svg" alt="MeerMau" style={{ width: 28, height: 28, objectFit: "contain" }} />
            : game.emoji}
        </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", lineHeight: 1.3 }}>
        {game.title}
      </div>
    </button>
  );
}

function CategoryTile({
  playerKey: _playerKey, emoji, label, gameCount, onClick,
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

function SavedPuzzleCard({
  save, info, onClick,
}: {
  save: PuzzleSave;
  info: { title: string; emoji: string; color: string };
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const diffLabel = PUZZLE_DIFFICULTY_LABELS[save.difficulty] ?? save.difficulty;
  const elapsed = formatElapsed(save.elapsedSeconds);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flexShrink: 0, width: 140, padding: "14px 12px 12px",
        background: hovered ? "var(--surface2)" : "var(--surface)",
        border: `1.5px solid ${hovered ? info.color : info.color + "55"}`,
        borderRadius: 14, cursor: "pointer", textAlign: "left",
        transition: "all 0.15s",
      }}
    >
      <div style={{ fontSize: 26, marginBottom: 6 }}>{info.emoji}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", lineHeight: 1.3, marginBottom: 2 }}>
        {info.title}
      </div>
      <div style={{ fontSize: 10, color: info.color, fontWeight: 700, marginBottom: 4 }}>
        {diffLabel} · {save.variant}
      </div>
      <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
        ⏱ {elapsed}
      </div>
    </button>
  );
}
