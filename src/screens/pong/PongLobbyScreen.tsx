import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection, doc, getDoc, onSnapshot, addDoc, updateDoc,
  arrayUnion, arrayRemove, query, where, deleteDoc,
} from "firebase/firestore";
import { QRCodeSVG } from "qrcode.react";
import { auth, db } from "../../firebase";
import type { PongDifficulty, PongGame, PongPlayer, PongSide, User } from "../../types";


const DIFFICULTY_OPTIONS: { key: PongDifficulty; label: string; desc: string }[] = [
  { key: "ROOKIE",     label: "Rookie",     desc: "Langsam, macht Fehler" },
  { key: "SNIPER",     label: "Sniper",     desc: "Schnell, trifft meistens" },
  { key: "BOSS_LEVEL", label: "Boss Level", desc: "Unerbittlich — viel Spaß 😈" },
];

function sidesForPaddles(total: number): PongSide[] {
  if (total === 2) return ["left", "right"];
  if (total === 3) return ["left", "right", "top"]; // wall assigned at game start
  return ["left", "right", "top", "bottom"];
}

export default function PongLobbyScreen() {
  const navigate  = useNavigate();
  const uid       = auth.currentUser?.uid ?? "";
  const [user, setUser]               = useState<User | null>(null);
  const [totalPaddles, setTotalPaddles] = useState<2|3|4>(2);
  const [humanCount,   setHumanCount]   = useState(1);
  const [difficulty,   setDifficulty]   = useState<PongDifficulty>("ROOKIE");
  const [scoreLimit,   setScoreLimit]   = useState(7);
  const [isFavorite,   setIsFavorite]   = useState(false);

  // Multi-player lobby
  const [activeGame, setActiveGame] = useState<PongGame | null>(null);
  const [creating,   setCreating]   = useState(false);

  // Clamp humanCount when totalPaddles changes
  useEffect(() => {
    setHumanCount((h) => Math.min(h, totalPaddles));
  }, [totalPaddles]);

  useEffect(() => {
    if (!uid) return;
    getDoc(doc(db, "users", uid)).then((snap) => {
      if (snap.exists()) setUser(snap.data() as User);
      setIsFavorite((snap.data()?.favoriteGames as string[] ?? []).includes("pong"));
    });
  }, [uid]);

  async function toggleFavorite() {
    if (!uid) return;
    const next = !isFavorite;
    setIsFavorite(next);
    await updateDoc(doc(db, "users", uid), {
      favoriteGames: next ? arrayUnion("pong") : arrayRemove("pong"),
    });
  }

  // Listen for my open pong lobby games (multi-player)
  useEffect(() => {
    if (!uid || humanCount < 2) { setActiveGame(null); return; }
    const q = query(
      collection(db, "pongGames"),
      where("playerIds",  "array-contains", uid),
      where("status",     "==", "LOBBY"),
    );
    return onSnapshot(q, (snap) => {
      const games = snap.docs.map((d) => ({ gameId: d.id, ...d.data() } as PongGame));
      setActiveGame(games.length > 0 ? games[0] : null);
    });
  }, [uid, humanCount]);


  // ── Create game ────────────────────────────────────────────────────────────
  async function handleCreate() {
    if (!uid || !user) return;
    setCreating(true);
    try {
      const mySide = sidesForPaddles(totalPaddles)[0]; // host always takes first side
      const player: PongPlayer = { userId: uid, displayName: user.displayName, avatarUrl: user.avatarUrl, side: mySide };
      await addDoc(collection(db, "pongGames"), {
        adminId: uid, status: "LOBBY",
        totalPaddles, humanCount, difficulty, scoreLimit,
        players: [player], playerIds: [uid],
        wallSide: null,
        ballX: 200, ballY: 200, ballVX: 0, ballVY: 0, speed: 5,
        paddleLeft: 250, paddleRight: 250, paddleTop: 250, paddleBottom: 250,
        scoreLeft: 0, scoreRight: 0, scoreTop: 0, scoreBottom: 0,
        paused: true, pauseTimer: 90,
        winnerId: null,
        createdAt: Date.now(),
      });
    } finally { setCreating(false); }
  }


  function buildGameState(game: PongGame, asHost: boolean) {
    const me = game.players.find((p) => p.userId === uid);
    return {
      totalPaddles: game.totalPaddles,
      humanCount:   game.humanCount,
      difficulty:   game.difficulty,
      scoreLimit:   game.scoreLimit,
      gameId:       game.gameId,
      isHost:       asHost,
      mySide:       me?.side ?? "left",
    };
  }

  function handleStartGame(game: PongGame) {
    navigate("/pong/game", { state: buildGameState(game, true) });
  }

  async function handleDeleteGame(gameId: string) {
    if (!window.confirm("Spiel löschen?")) return;
    await deleteDoc(doc(db, "pongGames", gameId));
  }

  const joinUrl    = activeGame ? `${window.location.origin}/pong/lobby?join=${activeGame.gameId}` : "";
  const hasAI      = humanCount < totalPaddles;
  const needsLobby = humanCount > 1;
  const canStart   = activeGame && activeGame.players.length >= activeGame.humanCount;

  return (
    <div className="screen" style={{ gap: 0, paddingTop: 0 }}>

      {/* Hero */}
      <div style={{
        background: "linear-gradient(135deg, var(--surface) 0%, var(--surface2) 100%)",
        padding: "28px 20px",
      }}>
        <button onClick={() => navigate("/home")} style={backBtn}>‹ Spielauswahl</button>
      </div>

      <div style={{ padding: "24px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600, marginBottom: 4 }}>BeachVolley</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text)" }}>🏓 Lobby</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn btn-outline btn-sm"
            style={{ width: 42, padding: 0, fontSize: 18 }}
            onClick={() => navigate("/pong/results")}
            title="Ergebnisse"
          >🏆</button>
          <button
            className="btn btn-outline btn-sm"
            onClick={toggleFavorite}
            style={{ width: 42, padding: 0, fontSize: 18, color: isFavorite ? "var(--accent)" : undefined, borderColor: isFavorite ? "var(--accent)" : undefined }}
          >
            {isFavorite ? "★" : "☆"}
          </button>
          <button
            className="btn btn-outline btn-sm"
            style={{ width: 42, padding: 0, fontSize: 18 }}
            onClick={() => navigate("/pong/settings")}
            title="Einstellungen"
          >⚙️</button>
        </div>
      </div>

      <div style={{ padding: "20px 20px 48px", display: "flex", flexDirection: "column", gap: 22 }}>

        {/* ── Total paddles ── */}
        <Section title="Gesamtanzahl Paddles">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {([2, 3, 4] as const).map((n) => (
              <PillButton key={n} active={totalPaddles === n} color="var(--coral)"
                onClick={() => setTotalPaddles(n)}>
                {n} Paddles
              </PillButton>
            ))}
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
            {totalPaddles === 3 && "⚡ Eine Seite wird zufällig zur Wand"}
            {totalPaddles === 4 && "🏟️ Alle vier Seiten — mit Eck-Deflektoren"}
          </div>
        </Section>

        {/* ── Human count ── */}
        <Section title="Davon menschliche Spieler">
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${totalPaddles}, 1fr)`, gap: 10 }}>
            {Array.from({ length: totalPaddles }, (_, i) => i + 1).map((n) => (
              <PillButton key={n} active={humanCount === n} color="var(--primary)"
                onClick={() => setHumanCount(n)}>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{n}</div>
                <div style={{ fontSize: 10, color: humanCount === n ? "var(--primary)" : "var(--text-muted)", marginTop: 2 }}>
                  {n === 1 ? "Mensch" : "Menschen"}
                </div>
              </PillButton>
            ))}
          </div>
          {hasAI && (
            <div style={{ marginTop: 10, padding: "10px 14px", background: "var(--primary-bg)", borderRadius: "var(--radius-sm)", fontSize: 13, color: "var(--primary)" }}>
              🤖 {totalPaddles - humanCount} KI-{totalPaddles - humanCount === 1 ? "Gegner" : "Gegner"}
            </div>
          )}
        </Section>

        {/* ── Difficulty (only if AI) ── */}
        {hasAI && (
          <Section title="KI-Schwierigkeit">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {DIFFICULTY_OPTIONS.map((opt) => {
                const active = difficulty === opt.key;
                return (
                  <button key={opt.key} onClick={() => setDifficulty(opt.key)} style={{
                    padding: "13px 16px", borderRadius: "var(--radius-sm)",
                    border: active ? "2px solid var(--primary)" : "1.5px solid var(--border)",
                    background: active ? "var(--primary-bg)" : "var(--surface)",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                  }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{opt.label}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{opt.desc}</div>
                    </div>
                    <div style={{
                      width: 18, height: 18, borderRadius: "50%",
                      border: active ? "5px solid var(--primary)" : "2px solid var(--border)",
                      flexShrink: 0, transition: "all 0.15s",
                    }} />
                  </button>
                );
              })}
            </div>
          </Section>
        )}

        {/* ── Score limit ── */}
        <Section title="Punkte zum Sieg / Limit">
          <div style={{
            display: "flex", alignItems: "center", gap: 16,
            background: "var(--surface)", borderRadius: "var(--radius-sm)",
            padding: "12px 16px", border: "1.5px solid var(--border)",
          }}>
            <button onClick={() => setScoreLimit((s) => Math.max(1, s - 1))} style={stepBtn}>−</button>
            <div style={{ flex: 1, textAlign: "center" }}>
              <span style={{ fontSize: 32, fontWeight: 800, color: "var(--text)" }}>{scoreLimit}</span>
              <span style={{ fontSize: 13, color: "var(--text-muted)", marginLeft: 6 }}>Punkte</span>
            </div>
            <button onClick={() => setScoreLimit((s) => Math.min(21, s + 1))} style={stepBtn}>+</button>
          </div>
          {totalPaddles > 2 && (
            <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted)" }}>
              Wer dieses Limit zuerst erreicht verliert — alle anderen gewinnen.
            </div>
          )}
        </Section>

        {/* ── Solo start (humanCount = 1) ── */}
        {!needsLobby && (
          <button
            onClick={() => navigate("/pong/game", { state: { totalPaddles, humanCount: 1, difficulty, scoreLimit, isHost: true, mySide: "left" } })}
            style={primaryBtn}
          >
            🏓 Spiel starten
          </button>
        )}

        {/* ── Multi-player lobby ── */}
        {needsLobby && (
          <>
            {activeGame ? (
              /* ── Open lobby card ── */
              <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: 20 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 14 }}>
                  Dein offenes Spiel
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, fontWeight: 600 }}>Spiel-Code</div>
                  <div style={{
                    fontFamily: "monospace", fontSize: 20, fontWeight: 900, letterSpacing: 3,
                    color: "var(--accent)", background: "var(--surface2)",
                    padding: "10px 16px", borderRadius: "var(--radius-sm)", textAlign: "center",
                  }}>{activeGame.gameId}</div>
                </div>

                <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                  <div style={{ background: "#fff", padding: 10, borderRadius: 10 }}>
                    <QRCodeSVG value={joinUrl} size={150} />
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginBottom: 8 }}>
                    Spieler ({activeGame.players.length}/{activeGame.humanCount})
                  </div>
                  {activeGame.players.map((p) => (
                    <div key={p.userId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                      <span style={{ fontSize: 22 }}>{p.avatarUrl}</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{p.displayName}</span>
                      <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: sideColor(p.side) }}>
                        {sideLabel(p.side)}
                      </span>
                    </div>
                  ))}
                  {hasAI && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
                      <span style={{ fontSize: 22 }}>🤖</span>
                      <span style={{ fontSize: 14, color: "var(--text-muted)" }}>
                        {totalPaddles - humanCount}× KI ({difficulty === "ROOKIE" ? "Rookie" : difficulty === "SNIPER" ? "Sniper" : "Boss Level"})
                      </span>
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => handleStartGame(activeGame)}
                    disabled={!canStart}
                    style={{ ...primaryBtn, flex: 1, opacity: canStart ? 1 : 0.45, cursor: canStart ? "pointer" : "default" }}
                  >
                    {canStart ? "🏓 Spiel starten" : `⏳ Warte… (${activeGame.players.length}/${activeGame.humanCount})`}
                  </button>
                  <button onClick={() => handleDeleteGame(activeGame.gameId)} style={deleteBtn}>🗑️</button>
                </div>
              </div>
            ) : (
              /* ── Create button ── */
              <button onClick={handleCreate} disabled={creating} style={{ ...primaryBtn, opacity: creating ? 0.6 : 1 }}>
                {creating ? "Erstelle Spiel…" : "🎮 Neues Spiel erstellen"}
              </button>
            )}

          </>
        )}
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function sideLabel(side: PongSide) {
  return side === "left" ? "◀ Links" : side === "right" ? "▶ Rechts" : side === "top" ? "▲ Oben" : "▼ Unten";
}

function sideColor(side: PongSide) {
  return side === "left" ? "var(--primary)" : side === "right" ? "var(--coral)" : side === "top" ? "var(--accent)" : "var(--success)";
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 10 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function PillButton({ active, color, onClick, children }: {
  active: boolean; color: string; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} style={{
      padding: "12px 8px", borderRadius: "var(--radius-sm)",
      border: active ? `2px solid ${color}` : "1.5px solid var(--border)",
      background: active ? `${color}22` : "var(--surface)",
      color: "var(--text)", fontSize: 13, fontWeight: 700,
      cursor: "pointer", display: "flex", flexDirection: "column",
      alignItems: "center", gap: 2, transition: "all 0.15s",
    }}>
      {children}
    </button>
  );
}

const backBtn: React.CSSProperties = {
  background: "none", border: "none", color: "var(--primary)",
  fontSize: 16, fontWeight: 700, cursor: "pointer", padding: 0,
};

const primaryBtn: React.CSSProperties = {
  background: "linear-gradient(135deg, var(--coral), #e8501a)",
  border: "none", borderRadius: "var(--radius)",
  color: "#fff", fontSize: 16, fontWeight: 800,
  padding: "17px", cursor: "pointer",
  boxShadow: "0 4px 20px rgba(249,115,22,0.35)",
  width: "100%",
};

const deleteBtn: React.CSSProperties = {
  background: "var(--surface2)", border: "1.5px solid var(--border)",
  borderRadius: "var(--radius)", color: "var(--danger)",
  fontSize: 20, padding: "0 14px", cursor: "pointer",
};

const stepBtn: React.CSSProperties = {
  width: 40, height: 40, borderRadius: "var(--radius-sm)",
  border: "1.5px solid var(--border)", background: "var(--surface2)",
  color: "var(--text)", fontSize: 20, fontWeight: 700,
  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
  flexShrink: 0,
};
