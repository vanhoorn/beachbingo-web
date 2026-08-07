import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import type { User } from "../types";
import { ACTION_GAMES, ALL_GAMES, COUCH_GAMES, PLAYER_COUNT_INFO, PLAYER_COUNT_ORDER, RIDDLE_GAMES, type PlayerCountKey } from "../gameMetadata";
import { getPuzzleSaves, deletePuzzleSave, PUZZLE_GAME_INFO, formatElapsed, PUZZLE_DIFFICULTY_LABELS, type PuzzleSave, type PuzzleDifficulty } from "../puzzleSave";
import { getGameSaves, deleteGameSave, type GameSave } from "../gameSave";

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
  const [savedGames, setSavedGames] = useState<GameSave[]>([]);
  const [showTour, setShowTour] = useState(false);
  const [tourSlide, setTourSlide] = useState(0);
  const navigate = useNavigate();
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    setSavedPuzzles(getPuzzleSaves());
    setSavedGames(getGameSaves());
    if (!localStorage.getItem("beachbande_tour_seen")) setShowTour(true);
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

  function closeTour() {
    localStorage.setItem("beachbande_tour_seen", "1");
    setShowTour(false);
    setTourSlide(0);
  }

  const favoriteGames = ALL_GAMES
    .filter((g) => favoriteIds.includes(g.id))
    .sort((a, b) => a.title.localeCompare(b.title));

  const cardGameCount = ALL_GAMES.filter((g) => g.genres.includes("CARD")).length;
  const riddleCount = RIDDLE_GAMES.length;
  const actionCount = ACTION_GAMES.length;
  const couchCount = COUCH_GAMES.length;

  return (
    <div className="screen" style={{ gap: 0, paddingTop: 0 }}>

      {showTour && (
        <HelpTour
          slide={tourSlide}
          onNext={() => setTourSlide((s) => s + 1)}
          onBack={() => setTourSlide((s) => s - 1)}
          onClose={closeTour}
        />
      )}

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
            onClick={() => { setShowTour(true); setTourSlide(0); }}
            title="App-Tour & Hilfe"
            style={{
              background: "var(--surface2)", border: "1px solid var(--border)",
              borderRadius: 14, width: 48, height: 48, fontSize: 20, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, color: "var(--text-muted)",
            }}
          >?</button>
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

        {/* Rätsel */}
        <section style={{ padding: "24px 20px 0" }}>
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

        {/* Karten */}
        <section style={{ padding: "24px 20px 0" }}>
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
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>Karten</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                {cardGameCount} {cardGameCount === 1 ? "Spiel" : "Spiele"} · MeerMau, Brandung & mehr
              </div>
            </div>
            <span style={{ fontSize: 20, color: "#7c3aed" }}>›</span>
          </button>
        </section>

        {/* Action */}
        <section style={{ padding: "24px 20px 0" }}>
          <button
            onClick={() => navigate("/action-games")}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 14,
              padding: "18px 20px", background: "var(--surface)",
              border: "1.5px solid rgba(249,115,22,0.4)", borderRadius: 14,
              cursor: "pointer", textAlign: "left",
            }}
          >
            <span style={{ fontSize: 28 }}>⚡</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>Action</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                {actionCount} {actionCount === 1 ? "Spiel" : "Spiele"} · BeachPirates, BeachVolley & mehr
              </div>
            </div>
            <span style={{ fontSize: 20, color: "#f97316" }}>›</span>
          </button>
        </section>

        {/* Couch */}
        <section style={{ padding: "24px 20px 0" }}>
          <button
            onClick={() => navigate("/couch-games")}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 14,
              padding: "18px 20px", background: "var(--surface)",
              border: "1.5px solid rgba(245,158,11,0.4)", borderRadius: 14,
              cursor: "pointer", textAlign: "left",
            }}
          >
            <span style={{ fontSize: 28 }}>🛋️</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>Couch</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                {couchCount} {couchCount === 1 ? "Spiel" : "Spiele"} · BeachBingo, Vier4Bier & mehr
              </div>
            </div>
            <span style={{ fontSize: 20, color: "#f59e0b" }}>›</span>
          </button>
        </section>

        {/* Alle Spiele */}
        <section style={{ padding: "24px 20px 0" }}>
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

        {/* Gespeicherte Spiele */}
        {(savedPuzzles.length > 0 || savedGames.length > 0) && (
          <section style={{ padding: "24px 20px 0" }}>
            <SectionHeader title="Gespeicherte Spiele" emoji="💾" />
            <div style={{
              display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4,
              scrollbarWidth: "none",
            }}>
              {savedGames.map((save) => (
                <SavedGameCard
                  key={save.id}
                  save={save}
                  onClick={() => navigate(ALL_GAMES.find((g) => g.id === save.gameType)?.path ?? "/home")}
                  onDelete={() => { deleteGameSave(save.gameType); setSavedGames((g) => g.filter((s) => s.gameType !== save.gameType)); }}
                />
              ))}
              {savedPuzzles.map((save) => {
                const info = PUZZLE_GAME_INFO[save.gameType];
                if (!info) return null;
                return (
                  <SavedPuzzleCard
                    key={save.id}
                    save={save}
                    info={info}
                    onClick={() => navigate(`/raetsel/${save.gameType}/lobby`)}
                    onDelete={() => { deletePuzzleSave(save.id); setSavedPuzzles((p) => p.filter((s) => s.id !== save.id)); }}
                  />
                );
              })}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}

const TOUR_SLIDES = [
  { emoji: "🏖️", title: "Willkommen bei BeachBande!", desc: "Diese kurze Tour zeigt dir die wichtigsten Funktionen. Du kannst sie jederzeit über das ? oben links erneut aufrufen." },
  { emoji: "🎮", title: "Rubriken", desc: "Alle Spiele sind nach Art sortiert: Rätsel, Karten, Action und Couch. So findest du schnell das passende Spiel für eure Runde." },
  { emoji: "👥", title: "Nach Spieleranzahl filtern", desc: "Tippe auf eine Spieleranzahl, um alle passenden Spiele zu sehen – ideal, wenn du schon weißt, wie viele mitspielen werden." },
  { emoji: "★", title: "Favoriten", desc: "Öffne ein Spiel und tippe auf das Herz-Symbol, um es als Favorit zu markieren. Favoriten erscheinen immer oben auf dem Startbildschirm." },
  { emoji: "🔗", title: "Spiel beitreten", desc: "Über das Ketten-Symbol oben rechts kannst du einem laufenden Spiel beitreten – per 6-stelligem Code oder QR-Code-Scan." },
  { emoji: "📱", title: "Spieler per QR-Code einladen", desc: "In jeder Spiellobby findest du einen QR-Code. Zeige ihn deinen Mitspielern – sie können sofort beitreten, ohne den Code abzutippen." },
  { emoji: "👤", title: "Profil & Einstellungen", desc: "Über das Personen-Symbol oben rechts erreichst du dein Profil. Dort kannst du Name, Avatar und Einstellungen anpassen und speichern." },
];

function HelpTour({ slide, onNext, onBack, onClose }: {
  slide: number; onNext: () => void; onBack: () => void; onClose: () => void;
}) {
  const current = TOUR_SLIDES[slide];
  const isLast = slide === TOUR_SLIDES.length - 1;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.88)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "24px 20px",
    }}>
      <button
        onClick={onClose}
        style={{
          position: "absolute", top: 20, right: 20,
          background: "rgba(255,255,255,0.1)", border: "none",
          borderRadius: "50%", width: 36, height: 36,
          color: "rgba(255,255,255,0.6)", fontSize: 18, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >✕</button>

      <div style={{
        background: "var(--surface)", borderRadius: 20,
        padding: "36px 28px 32px",
        maxWidth: 380, width: "100%", textAlign: "center",
        border: "1px solid var(--border)",
      }}>
        <div style={{ fontSize: 64, marginBottom: 20, lineHeight: 1 }}>{current.emoji}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text)", marginBottom: 14, lineHeight: 1.3 }}>
          {current.title}
        </div>
        <div style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>
          {current.desc}
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, margin: "24px 0 20px", alignItems: "center" }}>
        {TOUR_SLIDES.map((_, i) => (
          <div key={i} style={{
            height: 7,
            width: i === slide ? 20 : 7,
            borderRadius: 4,
            background: i === slide ? "#38bdf8" : "rgba(255,255,255,0.25)",
            transition: "width 0.2s ease",
          }} />
        ))}
      </div>

      <div style={{ display: "flex", gap: 12, width: "100%", maxWidth: 380 }}>
        {slide > 0 ? (
          <button
            onClick={onBack}
            style={{
              flex: 1, padding: "14px", borderRadius: 12,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "rgba(255,255,255,0.7)", fontSize: 15, cursor: "pointer",
            }}
          >← Zurück</button>
        ) : (
          <div style={{ flex: 1 }} />
        )}
        <button
          onClick={isLast ? onClose : onNext}
          style={{
            flex: 1, padding: "14px", borderRadius: 12,
            background: "#38bdf8", border: "none",
            color: "white", fontSize: 15, fontWeight: 700, cursor: "pointer",
          }}
        >{isLast ? "Los geht's! 🏖️" : "Weiter →"}</button>
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
  save, info, onClick, onDelete,
}: {
  save: PuzzleSave;
  info: { title: string; emoji: string; color: string };
  onClick: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const diffLabel = PUZZLE_DIFFICULTY_LABELS[save.difficulty as PuzzleDifficulty] ?? save.difficulty;
  const elapsed = formatElapsed(save.elapsedSeconds);
  return (
    <div style={{ position: "relative", flexShrink: 0, width: 140 }}>
      <button
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: "100%", padding: "14px 12px 12px",
          background: hovered ? "var(--surface2)" : "var(--surface)",
          border: `1.5px solid ${hovered ? info.color : info.color + "55"}`,
          borderRadius: 14, cursor: "pointer", textAlign: "left",
          transition: "all 0.15s",
        }}
      >
        <div style={{ fontSize: 26, marginBottom: 6 }}>{info.emoji}</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", lineHeight: 1.3, marginBottom: 2, paddingRight: 18 }}>
          {info.title}
        </div>
        <div style={{ fontSize: 10, color: info.color, fontWeight: 700, marginBottom: 4 }}>
          {diffLabel} · {save.variant}
        </div>
        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
          ⏱ {elapsed}
        </div>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        title="Löschen"
        style={{
          position: "absolute", top: 6, right: 6,
          width: 22, height: 22, borderRadius: "50%",
          background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.35)",
          cursor: "pointer", fontSize: 10, color: "#ef4444",
          display: "flex", alignItems: "center", justifyContent: "center",
          lineHeight: 1, padding: 0,
        }}
      >✕</button>
    </div>
  );
}

function SavedGameCard({
  save, onClick, onDelete,
}: {
  save: GameSave;
  onClick: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const game = ALL_GAMES.find((g) => g.id === save.gameType);
  if (!game) return null;
  return (
    <div style={{ position: "relative", flexShrink: 0, width: 140 }}>
      <button
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: "100%", padding: "14px 12px 12px",
          background: hovered ? "var(--surface2)" : "var(--surface)",
          border: `1.5px solid ${hovered ? game.color : game.color + "55"}`,
          borderRadius: 14, cursor: "pointer", textAlign: "left",
          transition: "all 0.15s",
        }}
      >
        <div style={{ fontSize: 26, marginBottom: 6, display: "flex", alignItems: "center" }}>
          {game.id === "meermau"
            ? <img src="/meermau-logo.svg" alt="MeerMau" style={{ width: 26, height: 26, objectFit: "contain" }} />
            : game.emoji}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", lineHeight: 1.3, marginBottom: 2, paddingRight: 18 }}>
          {game.title}
        </div>
        <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
          {save.displayLabel}
        </div>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        title="Löschen"
        style={{
          position: "absolute", top: 6, right: 6,
          width: 22, height: 22, borderRadius: "50%",
          background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.35)",
          cursor: "pointer", fontSize: 10, color: "#ef4444",
          display: "flex", alignItems: "center", justifyContent: "center",
          lineHeight: 1, padding: 0,
        }}
      >✕</button>
    </div>
  );
}
