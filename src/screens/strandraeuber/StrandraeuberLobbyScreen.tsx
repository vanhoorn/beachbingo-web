import { useEffect, useRef, useState } from "react";
import { doc, setDoc, getDoc, onSnapshot, deleteDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { auth, db } from "../../firebase";
import type { User, SpOnlineGame, SpOnlinePlayer } from "../../types";
import type { SpDifficulty } from "./strandraeuberLogic";
import GameRulesModal from "../../components/GameRulesModal";
import { GAME_RULES } from "../../gameRules";
import { getGameSave } from "../../gameSave";

const SP_COLOR = "#e11d48";
const SP_DIM   = "rgba(225,29,72,0.12)";

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

type Step = "mode" | "lobby";
type Mode = "ai" | "online";

function DifficultyButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: "10px 8px", borderRadius: 8,
        border: `1px solid ${active ? SP_COLOR : "var(--border)"}`,
        background: active ? SP_DIM : "var(--surface2)",
        color: active ? SP_COLOR : "var(--text-sub)",
        fontWeight: active ? 700 : 400, fontSize: 13, cursor: "pointer", transition: "all .15s",
      }}
    >{label}</button>
  );
}

function RoundsButton({ value, active, onClick }: { value: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: "10px 4px", borderRadius: 8,
        border: `1px solid ${active ? SP_COLOR : "var(--border)"}`,
        background: active ? SP_DIM : "var(--surface2)",
        color: active ? SP_COLOR : "var(--text-sub)",
        fontWeight: active ? 700 : 400, fontSize: 14, cursor: "pointer",
      }}
    >{value === 1 ? "1 Runde" : `${value} Runden`}</button>
  );
}

function ModeCard({ emoji, title, description, color, onClick }: {
  emoji: string; title: string; description: string; color: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{
      background: `linear-gradient(135deg, ${color}22, ${color}11)`,
      border: `1px solid ${color}44`, borderRadius: "var(--radius)",
      padding: "18px", textAlign: "left", cursor: "pointer",
      display: "flex", alignItems: "center", gap: 16, width: "100%",
    }}>
      <span style={{ fontSize: 36 }}>{emoji}</span>
      <div>
        <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>{title}</div>
        <div style={{ fontSize: 13, color: "var(--text-sub)", marginTop: 2 }}>{description}</div>
      </div>
    </button>
  );
}

export default function StrandraeuberLobbyScreen() {
  const navigate = useNavigate();
  const uid = auth.currentUser?.uid ?? "";

  const [step, setStep]           = useState<Step>("mode");
  const [mode, setMode]           = useState<Mode>("ai");
  const [aiCount, setAiCount]     = useState(2);
  const [difficulty, setDifficulty] = useState<SpDifficulty>("SNIPER");
  const [totalRounds, setTotalRounds] = useState(3);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showRules, setShowRules]  = useState(false);

  // Online state
  const [creating, setCreating]   = useState(false);
  const [gameCode, setGameCode]   = useState("");
  const [waitingGame, setWaitingGame] = useState<SpOnlineGame | null>(null);
  const [error, setError]         = useState("");
  const unsubRef = useRef<(() => void) | null>(null);
  const [myName, setMyName]       = useState("Du");
  const [myAvatar, setMyAvatar]   = useState("👤");

  useEffect(() => {
    if (!uid) return;
    getDoc(doc(db, "users", uid)).then((snap) => {
      if (!snap.exists()) return;
      const u = snap.data() as User;
      setMyName(u.displayName ?? "Du");
      setMyAvatar(u.avatarUrl ?? "👤");
      if (u.preferredStrandraeuberDifficulty) setDifficulty(u.preferredStrandraeuberDifficulty as SpDifficulty);
      if (u.preferredStrandraeuberRounds)     setTotalRounds(u.preferredStrandraeuberRounds);
      setIsFavorite((snap.data()?.favoriteGames as string[] ?? []).includes("strandraeuber"));
    });
    return () => { unsubRef.current?.(); };
  }, [uid]);

  async function toggleFavorite() {
    const next = !isFavorite;
    setIsFavorite(next);
    await updateDoc(doc(db, "users", uid), {
      favoriteGames: next ? arrayUnion("strandraeuber") : arrayRemove("strandraeuber"),
    });
  }

  function startVsAi() {
    sessionStorage.setItem("spGame", JSON.stringify({
      mode: "ai", aiCount, difficulty, totalRounds, myName, myAvatar,
    }));
    navigate("/strandraeuber/game");
  }

  async function createOnlineGame() {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return;
    const user = snap.data() as User;
    setCreating(true);
    setError("");
    try {
      const code = generateCode();
      const me: SpOnlinePlayer = {
        userId: uid, displayName: user.displayName, avatarUrl: user.avatarUrl,
        hand: [], cardCount: 0, roundScore: 0, isAI: false,
      };
      const game: Omit<SpOnlineGame, "gameId"> = {
        adminId: uid, status: "LOBBY",
        players: { [uid]: me },
        playerIds: [uid],
        activePlayerIds: [uid],
        turnIndex: 0,
        phase: "LOBBY",
        roundNumber: 1,
        totalRounds,
        loserId: null, loserName: null, loserAvatar: null,
        scores: {},
        createdAt: Date.now(),
      };
      await setDoc(doc(db, "strandraeuberGames", code), game);
      setGameCode(code);

      const unsub = onSnapshot(doc(db, "strandraeuberGames", code), (s) => {
        if (!s.exists()) return;
        const g = { gameId: s.id, ...s.data() } as SpOnlineGame;
        setWaitingGame(g);
        if (g.status === "RUNNING") {
          unsub();
          unsubRef.current = null;
          sessionStorage.setItem("spGame", JSON.stringify({ mode: "online", gameId: code, totalRounds }));
          navigate("/strandraeuber/game");
        }
      });
      unsubRef.current = unsub;
    } catch {
      setError("Erstellen fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setCreating(false);
    }
  }

  async function cancelWaiting() {
    unsubRef.current?.();
    unsubRef.current = null;
    if (gameCode) {
      try { await deleteDoc(doc(db, "strandraeuberGames", gameCode)); } catch { /* ignore */ }
    }
    setGameCode("");
    setWaitingGame(null);
    setStep("mode");
  }

  async function startOnlineGame() {
    if (!waitingGame || !gameCode) return;
    const { dealCards, discardPairs } = await import("./strandraeuberLogic");
    const playerIds = Object.keys(waitingGame.players);
    const hands = dealCards(playerIds.length);
    const updatedPlayers: Record<string, SpOnlinePlayer> = {};
    for (let i = 0; i < playerIds.length; i++) {
      const pid = playerIds[i];
      const { remaining } = discardPairs(hands[i]);
      updatedPlayers[pid] = {
        ...waitingGame.players[pid],
        hand: remaining,
        cardCount: remaining.length,
      };
    }
    const startTurnIdx = Math.min(1, playerIds.length - 1);
    const activePlayerIds = playerIds.filter(pid => updatedPlayers[pid].hand.length > 0);
    await updateDoc(doc(db, "strandraeuberGames", gameCode), {
      status: "RUNNING",
      phase: "PLAYING",
      players: updatedPlayers,
      playerIds,
      activePlayerIds,
      turnIndex: startTurnIdx % activePlayerIds.length,
    });
  }

  const joinUrl = `${window.location.origin}/strandraeuber/lobby?join=${gameCode}`;
  const waitingPlayers = waitingGame ? Object.values(waitingGame.players) : [];
  const isAdmin = waitingGame?.adminId === uid;

  // Handle ?join= deep-link
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("join");
    if (!code || !uid) return;
    joinExistingGame(code.toUpperCase());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  async function joinExistingGame(code: string) {
    const [gameSnap, userSnap] = await Promise.all([
      getDoc(doc(db, "strandraeuberGames", code)),
      getDoc(doc(db, "users", uid)),
    ]);
    if (!gameSnap.exists()) { setError("Spiel nicht gefunden."); return; }
    if (!userSnap.exists()) return;
    const g = { gameId: code, ...gameSnap.data() } as SpOnlineGame;
    if (g.status === "FINISHED") { setError("Dieses Spiel ist bereits beendet."); return; }
    if (g.status === "RUNNING") {
      if (g.playerIds.includes(uid)) {
        sessionStorage.setItem("spGame", JSON.stringify({ mode: "online", gameId: code }));
        navigate("/strandraeuber/game");
        return;
      }
      setError("Das Spiel läuft bereits.");
      return;
    }
    const user = userSnap.data() as User;
    const me: SpOnlinePlayer = {
      userId: uid, displayName: user.displayName, avatarUrl: user.avatarUrl,
      hand: [], cardCount: 0, roundScore: 0, isAI: false,
    };
    if (!g.playerIds.includes(uid)) {
      await updateDoc(doc(db, "strandraeuberGames", code), {
        [`players.${uid}`]: me,
        playerIds: arrayUnion(uid),
        activePlayerIds: arrayUnion(uid),
      });
    }
    setGameCode(code);
    const unsub = onSnapshot(doc(db, "strandraeuberGames", code), (s) => {
      if (!s.exists()) return;
      const upd = { gameId: s.id, ...s.data() } as SpOnlineGame;
      setWaitingGame(upd);
      if (upd.status === "RUNNING") {
        unsub();
        sessionStorage.setItem("spGame", JSON.stringify({ mode: "online", gameId: code }));
        navigate("/strandraeuber/game");
      }
    });
    unsubRef.current = unsub;
    setStep("lobby");
    setMode("online");
  }

  return (
    <div className="screen">
      <button className="btn btn-outline btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => navigate("/home")}>
        ‹ Spielauswahl
      </button>

      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, #7a0f27 0%, ${SP_COLOR} 100%)`,
        borderRadius: "var(--radius)", padding: "20px",
        display: "flex", alignItems: "center", gap: 16,
      }}>
        <div style={{ fontSize: 44 }}>🦹</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>Strandräuber</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "white" }}>Karten ziehen & Paare ablegen</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-outline btn-sm"
            style={{ width: 42, padding: 0, fontSize: 18, color: "rgba(255,255,255,0.8)", borderColor: "rgba(255,255,255,0.2)" }}
            onClick={() => navigate("/strandraeuber/results")} title="Ergebnisse">🏆</button>
          <button className="btn btn-outline btn-sm"
            onClick={toggleFavorite}
            style={{ width: 42, padding: 0, fontSize: 18, color: isFavorite ? "var(--accent)" : "rgba(255,255,255,0.8)", borderColor: isFavorite ? "var(--accent)" : "rgba(255,255,255,0.2)" }}>
            {isFavorite ? "★" : "☆"}
          </button>
          <button className="btn btn-outline btn-sm"
            style={{ width: 42, padding: 0, fontSize: 18, color: "rgba(255,255,255,0.8)", borderColor: "rgba(255,255,255,0.2)" }}
            onClick={() => setShowRules(true)} title="Spielanleitung">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5" fill="currentColor"/>
            </svg>
          </button>
          <button className="btn btn-outline btn-sm"
            style={{ width: 42, padding: 0, fontSize: 18, color: "rgba(255,255,255,0.8)", borderColor: "rgba(255,255,255,0.2)" }}
            onClick={() => navigate("/strandraeuber/settings")} title="Einstellungen">⚙️</button>
        </div>
      </div>

      {/* ── Step: Mode ── */}
      {step === "mode" && (() => {
        const savedSp = getGameSave("strandraeuber");
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Spielmodus wählen</div>
            {savedSp && (
              <ModeCard
                emoji="▶️"
                title="Fortsetzen"
                description={savedSp.displayLabel}
                color={SP_COLOR}
                onClick={() => {
                  const gs = (() => { try { return JSON.parse(savedSp.gameState); } catch (_) { return {}; } })();
                  const savedAiCount = Math.max(1, (gs.players?.length ?? 2) - 1);
                  sessionStorage.setItem("spGame", JSON.stringify({
                    mode: "ai",
                    aiCount: savedAiCount,
                    difficulty: savedSp.difficulty,
                    totalRounds: gs.totalRounds ?? 3,
                    myName,
                    myAvatar,
                    saveId: savedSp.id,
                  }));
                  navigate("/strandraeuber/game");
                }}
              />
            )}
            <ModeCard emoji="🤖" title="Gegen KI" description="Spiel allein gegen 1–5 KI-Gegner" color={SP_COLOR}
              onClick={() => { setMode("ai"); setStep("lobby"); }} />
            <ModeCard emoji="📱" title="Online – bis 6 Spieler" description="Spielt gemeinsam via QR-Code" color="#0ea5e9"
              onClick={() => { setMode("online"); setStep("lobby"); createOnlineGame(); }} />
          </div>
        );
      })()}

      {/* ── Step: AI Lobby ── */}
      {step === "lobby" && mode === "ai" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <button className="btn btn-outline btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setStep("mode")}>
            ‹ Zurück
          </button>

          <div className="card" style={{ padding: 20, gap: 16, display: "flex", flexDirection: "column" }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>KI-Gegner</div>
            <div style={{ display: "flex", gap: 8 }}>
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setAiCount(n)} style={{
                  flex: 1, padding: "10px 4px", borderRadius: 8,
                  border: `1px solid ${aiCount === n ? SP_COLOR : "var(--border)"}`,
                  background: aiCount === n ? SP_DIM : "var(--surface2)",
                  color: aiCount === n ? SP_COLOR : "var(--text-sub)",
                  fontWeight: aiCount === n ? 700 : 400, fontSize: 14, cursor: "pointer",
                }}>{n}</button>
              ))}
            </div>

            <div style={{ fontWeight: 700, fontSize: 15, marginTop: 4 }}>KI-Stärke</div>
            <div style={{ display: "flex", gap: 8 }}>
              <DifficultyButton label="🌊 Rookie"  active={difficulty === "ROOKIE"}     onClick={() => setDifficulty("ROOKIE")} />
              <DifficultyButton label="🎯 Sniper"  active={difficulty === "SNIPER"}     onClick={() => setDifficulty("SNIPER")} />
              <DifficultyButton label="💪 Boss"    active={difficulty === "BOSS_LEVEL"} onClick={() => setDifficulty("BOSS_LEVEL")} />
            </div>

            <div style={{ fontWeight: 700, fontSize: 15, marginTop: 4 }}>Rundenanzahl</div>
            <div style={{ display: "flex", gap: 8 }}>
              <RoundsButton value={1} active={totalRounds === 1} onClick={() => setTotalRounds(1)} />
              <RoundsButton value={3} active={totalRounds === 3} onClick={() => setTotalRounds(3)} />
              <RoundsButton value={5} active={totalRounds === 5} onClick={() => setTotalRounds(5)} />
            </div>
          </div>

          <button className="btn" style={{ background: SP_COLOR, color: "white", padding: "14px", fontSize: 16, fontWeight: 700, borderRadius: "var(--radius)" }}
            onClick={startVsAi}>
            🃏 Spiel starten ({aiCount + 1} Spieler)
          </button>
        </div>
      )}

      {/* ── Step: Online Lobby ── */}
      {step === "lobby" && mode === "online" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {creating ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ fontSize: 36 }}>🦹</div>
              <div style={{ marginTop: 8, color: "var(--text-sub)" }}>Spiel wird erstellt…</div>
            </div>
          ) : gameCode ? (
            <>
              <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-sub)", letterSpacing: 1, textTransform: "uppercase" }}>
                  Anderen einladen
                </div>
                <div style={{ background: "white", padding: 12, borderRadius: 10 }}>
                  <QRCodeSVG value={joinUrl} size={160} />
                </div>
                <div style={{ fontFamily: "monospace", fontSize: 22, fontWeight: 900, letterSpacing: 6, color: SP_COLOR }}>
                  {gameCode}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
                  QR-Code scannen oder Code auf beachbande.de/strandraeuber/lobby eingeben
                </div>
              </div>

              <div className="card" style={{ padding: "16px 18px" }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
                  Spieler ({waitingPlayers.length}/6)
                </div>
                {waitingPlayers.map(p => (
                  <div key={p.userId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid var(--border)" }}>
                    <span style={{ fontSize: 22 }}>{p.avatarUrl}</span>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: p.userId === uid ? 700 : 400 }}>
                      {p.displayName}{p.userId === uid ? " 👤" : ""}
                      {p.userId === waitingGame?.adminId ? " 👑" : ""}
                    </span>
                  </div>
                ))}
                {waitingPlayers.length < 2 && (
                  <div style={{ fontSize: 13, color: "var(--text-muted)", paddingTop: 8 }}>
                    Warte auf weitere Spieler… (mind. 2)
                  </div>
                )}
              </div>

              {error && <div style={{ color: "var(--danger)", fontSize: 13, textAlign: "center" }}>{error}</div>}

              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={cancelWaiting}>Abbrechen</button>
                {isAdmin && (
                  <button
                    className="btn"
                    style={{ flex: 2, background: waitingPlayers.length >= 2 ? SP_COLOR : "var(--surface-2)", color: "white", fontWeight: 700, opacity: waitingPlayers.length >= 2 ? 1 : 0.5, cursor: waitingPlayers.length >= 2 ? "pointer" : "not-allowed" }}
                    onClick={waitingPlayers.length >= 2 ? startOnlineGame : undefined}
                    title={waitingPlayers.length < 2 ? "Mindestens 2 Spieler benötigt" : undefined}
                  >
                    {waitingPlayers.length >= 2 ? "🃏 Spiel starten!" : `⏳ Warte auf Spieler (${waitingPlayers.length}/2)`}
                  </button>
                )}
                {!isAdmin && (
                  <div style={{ flex: 2, textAlign: "center", fontSize: 13, color: "var(--text-muted)", alignSelf: "center" }}>
                    Warte auf {waitingGame?.players[waitingGame?.adminId ?? ""]?.displayName}…
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ fontSize: 14, color: "var(--danger)" }}>{error || "Fehler beim Erstellen."}</div>
              <button className="btn btn-outline" style={{ marginTop: 16 }} onClick={() => setStep("mode")}>Zurück</button>
            </div>
          )}
        </div>
      )}

      {showRules && GAME_RULES["strandraeuber"] && (
        <GameRulesModal rule={GAME_RULES["strandraeuber"]} onClose={() => setShowRules(false)} />
      )}
    </div>
  );
}
