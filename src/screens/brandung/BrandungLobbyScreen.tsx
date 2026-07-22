import { useEffect, useRef, useState } from "react";
import { doc, setDoc, getDoc, onSnapshot, deleteDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { auth, db } from "../../firebase";
import type { User, BrandungGame, BrandungPlayer, BrandungSettings } from "../../types";
import type { BrandungDifficulty } from "./brandungLogic";
import { dealCards } from "./brandungLogic";
import GameRulesModal from "../../components/GameRulesModal";
import { GAME_RULES } from "../../gameRules";

const TEAL = "#0d9488";
const TEAL_DIM = "rgba(13,148,136,0.12)";

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
        flex: 1, padding: "10px 8px", borderRadius: 8, border: `1px solid ${active ? TEAL : "var(--border)"}`,
        background: active ? TEAL_DIM : "var(--surface2)", color: active ? TEAL : "var(--text-sub)",
        fontWeight: active ? 700 : 400, fontSize: 13, cursor: "pointer", transition: "all .15s",
      }}
    >{label}</button>
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

export default function BrandungLobbyScreen() {
  const navigate = useNavigate();
  const uid = auth.currentUser?.uid ?? "";

  const [step, setStep] = useState<Step>("mode");
  const [mode, setMode] = useState<Mode>("ai");
  const [aiCount, setAiCount] = useState(2);
  const [difficulty, setDifficulty] = useState<BrandungDifficulty>("SNIPER");
  const [settings, setSettings] = useState<BrandungSettings>({ newCardsOnAllPass: true, passingForbidden: false });
  const [isFavorite, setIsFavorite] = useState(false);
  const [showRules, setShowRules] = useState(false);

  // Online state
  const [creating, setCreating] = useState(false);
  const [gameCode, setGameCode] = useState("");
  const [waitingGame, setWaitingGame] = useState<BrandungGame | null>(null);
  const [error, setError] = useState("");
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!uid) return;
    getDoc(doc(db, "users", uid)).then((snap) => {
      if (!snap.exists()) return;
      const u = snap.data() as User;
      if (u.brandungNewCardsOnAllPass !== undefined) setSettings(s => ({ ...s, newCardsOnAllPass: u.brandungNewCardsOnAllPass! }));
      if (u.brandungPassingForbidden !== undefined) setSettings(s => ({ ...s, passingForbidden: u.brandungPassingForbidden! }));
      setIsFavorite((snap.data()?.favoriteGames as string[] ?? []).includes("brandung"));
    });
    return () => { unsubRef.current?.(); };
  }, [uid]);

  // Handle ?join= deep-link (QR scan in browser)
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("join");
    if (!code || !uid) return;
    const join = async () => {
      const [userSnap, gameSnap] = await Promise.all([
        getDoc(doc(db, "users", uid)),
        getDoc(doc(db, "brandungGames", code)),
      ]);
      if (!userSnap.exists() || !gameSnap.exists()) return;
      const user = userSnap.data() as User;
      const game = { gameId: code, ...gameSnap.data() } as BrandungGame;
      if (game.status === "FINISHED") return;
      if (!game.playerIds.includes(uid)) {
        if (Object.keys(game.players).length >= 6) return;
        await updateDoc(doc(db, "brandungGames", code), {
          playerIds: arrayUnion(uid),
          [`players.${uid}`]: { userId: uid, displayName: user.displayName, avatarUrl: user.avatarUrl, hand: [], lives: 3, eliminated: false, isAI: false },
        });
      }
      navigate("/brandung/game", { state: { mode: "online", gameId: code } });
    };
    join();
  }, [uid]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleFavorite() {
    const next = !isFavorite;
    setIsFavorite(next);
    await updateDoc(doc(db, "users", uid), {
      favoriteGames: next ? arrayUnion("brandung") : arrayRemove("brandung"),
    });
  }

  function startVsAi() {
    navigate("/brandung/game", { state: { mode: "ai", aiCount, difficulty, settings } });
  }

  async function createOnlineGame() {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return;
    const user = snap.data() as User;
    setCreating(true);
    setError("");
    try {
      const code = generateCode();
      const me: BrandungPlayer = {
        userId: uid, displayName: user.displayName, avatarUrl: user.avatarUrl,
        hand: [], lives: 3, eliminated: false, isAI: false,
      };
      const game: Omit<BrandungGame, "gameId"> = {
        adminId: uid,
        status: "LOBBY",
        phase: "TURN",
        players: { [uid]: me },
        playerIds: [uid],
        currentTurnIndex: 0,
        tableCards: [],
        deck: [],
        knockedByUserId: null,
        knockRoundRemaining: [],
        round: 1,
        passCount: 0,
        settings,
        winnerId: null,
        roundLosers: [],
        roundScores: {},
        lastAction: "",
        createdAt: Date.now(),
      };
      await setDoc(doc(db, "brandungGames", code), game);
      setGameCode(code);

      const unsub = onSnapshot(doc(db, "brandungGames", code), (s) => {
        if (!s.exists()) return;
        const g = { gameId: s.id, ...s.data() } as BrandungGame;
        setWaitingGame(g);
        if (g.status === "RUNNING") {
          unsub();
          unsubRef.current = null;
          navigate("/brandung/game", { state: { mode: "online", gameId: code } });
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
      try { await deleteDoc(doc(db, "brandungGames", gameCode)); } catch { /* ignore */ }
    }
    setGameCode("");
    setWaitingGame(null);
    setStep("mode");
  }

  async function startOnlineGame() {
    if (!waitingGame || !gameCode) return;
    const playerIds = Object.keys(waitingGame.players);
    const { playerHands, tableCards, deck } = dealCards(playerIds);
    const updatedPlayers: { [uid: string]: BrandungPlayer } = {};
    for (const pid of playerIds) {
      updatedPlayers[pid] = { ...waitingGame.players[pid], hand: playerHands[pid] };
    }
    await updateDoc(doc(db, "brandungGames", gameCode), {
      status: "RUNNING",
      phase: "TURN",
      players: updatedPlayers,
      playerIds,
      tableCards,
      deck,
      currentTurnIndex: 0,
    });
  }

  const joinUrl = `${window.location.origin}/brandung/lobby?join=${gameCode}`;
  const waitingPlayers = waitingGame ? Object.values(waitingGame.players) : [];
  const isAdmin = waitingGame?.adminId === uid;

  // Handle QR join deep-link
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const j = p.get("join");
    if (j && uid) {
      joinExistingGame(j.toUpperCase());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function joinExistingGame(code: string) {
    const snap = await getDoc(doc(db, "brandungGames", code));
    if (!snap.exists()) { setError("Spiel nicht gefunden."); return; }
    const g = { gameId: snap.id, ...snap.data() } as BrandungGame;
    if (g.status !== "LOBBY") { setError("Spiel läuft bereits."); return; }
    const userSnap = await getDoc(doc(db, "users", uid));
    if (!userSnap.exists()) return;
    const user = userSnap.data() as User;
    const me: BrandungPlayer = {
      userId: uid, displayName: user.displayName, avatarUrl: user.avatarUrl,
      hand: [], lives: 3, eliminated: false, isAI: false,
    };
    await updateDoc(doc(db, "brandungGames", code), {
      [`players.${uid}`]: me,
      playerIds: [...g.playerIds, uid],
    });
    setGameCode(code);
    const unsub = onSnapshot(doc(db, "brandungGames", code), (s) => {
      if (!s.exists()) return;
      const upd = { gameId: s.id, ...s.data() } as BrandungGame;
      setWaitingGame(upd);
      if (upd.status === "RUNNING") {
        unsub();
        navigate("/brandung/game", { state: { mode: "online", gameId: code } });
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
        background: `linear-gradient(135deg, #064e47 0%, ${TEAL} 100%)`,
        borderRadius: "var(--radius)", padding: "20px",
        display: "flex", alignItems: "center", gap: 16,
      }}>
        <div style={{ fontSize: 44 }}>🌊</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>Brandung</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "white" }}>Schwimmen</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-outline btn-sm"
            style={{ width: 42, padding: 0, fontSize: 18, color: "rgba(255,255,255,0.8)", borderColor: "rgba(255,255,255,0.2)" }}
            onClick={() => navigate("/brandung/results")} title="Ergebnisse">🏆</button>
          <button className="btn btn-outline btn-sm"
            onClick={toggleFavorite}
            style={{ width: 42, padding: 0, fontSize: 18, color: isFavorite ? "var(--accent)" : "rgba(255,255,255,0.8)", borderColor: isFavorite ? "var(--accent)" : "rgba(255,255,255,0.2)" }}>
            {isFavorite ? "★" : "☆"}
          </button>
          <button className="btn btn-outline btn-sm"
            style={{ width: 42, padding: 0, fontSize: 18, color: "rgba(255,255,255,0.8)", borderColor: "rgba(255,255,255,0.2)" }}
            onClick={() => setShowRules(true)} title="Spielanleitung"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5" fill="currentColor"/></svg></button>
          <button className="btn btn-outline btn-sm"
            style={{ width: 42, padding: 0, fontSize: 18, color: "rgba(255,255,255,0.8)", borderColor: "rgba(255,255,255,0.2)" }}
            onClick={() => navigate("/brandung/settings")} title="Einstellungen">⚙️</button>
        </div>
      </div>

      {/* ── Step: Mode ── */}
      {step === "mode" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Spielmodus wählen</div>
          <ModeCard emoji="🤖" title="Gegen KI" description="Spiel allein gegen 1–5 KI-Gegner" color={TEAL}
            onClick={() => { setMode("ai"); setStep("lobby"); }} />
          <ModeCard emoji="📱" title="Online – bis 6 Spieler" description="Spielt gemeinsam via QR-Code" color="#0ea5e9"
            onClick={() => { setMode("online"); setStep("lobby"); createOnlineGame(); }} />
        </div>
      )}

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
                  border: `1px solid ${aiCount === n ? TEAL : "var(--border)"}`,
                  background: aiCount === n ? TEAL_DIM : "var(--surface2)",
                  color: aiCount === n ? TEAL : "var(--text-sub)",
                  fontWeight: aiCount === n ? 700 : 400, fontSize: 14, cursor: "pointer",
                }}>{n}</button>
              ))}
            </div>

            <div style={{ fontWeight: 700, fontSize: 15, marginTop: 4 }}>KI-Stärke</div>
            <div style={{ display: "flex", gap: 8 }}>
              <DifficultyButton label="🌊 Rookie" active={difficulty === "ROOKIE"} onClick={() => setDifficulty("ROOKIE")} />
              <DifficultyButton label="🎯 Sniper" active={difficulty === "SNIPER"} onClick={() => setDifficulty("SNIPER")} />
              <DifficultyButton label="💪 Boss" active={difficulty === "BOSS_LEVEL"} onClick={() => setDifficulty("BOSS_LEVEL")} />
            </div>
          </div>

          {/* Settings summary */}
          <div className="card" style={{ padding: "14px 18px", fontSize: 13, color: "var(--text-sub)" }}>
            <span style={{ color: TEAL }}>⚙️ </span>
            {settings.passingForbidden ? "Schieben verboten · " : ""}
            {settings.newCardsOnAllPass ? "Neue Karten bei alle schieben" : "Keine neuen Karten"}
            {" "}· <button onClick={() => navigate("/brandung/settings")} style={{ background: "none", border: "none", color: TEAL, cursor: "pointer", padding: 0, fontSize: 13 }}>Ändern →</button>
          </div>

          <button className="btn" style={{ background: TEAL, color: "white", padding: "14px", fontSize: 16, fontWeight: 700, borderRadius: "var(--radius)" }}
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
              <div style={{ fontSize: 36 }}>🌊</div>
              <div style={{ marginTop: 8, color: "var(--text-sub)" }}>Spiel wird erstellt…</div>
            </div>
          ) : gameCode ? (
            <>
              {/* QR Card */}
              <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-sub)", letterSpacing: 1, textTransform: "uppercase" }}>
                  Anderen einladen
                </div>
                <div style={{ background: "white", padding: 12, borderRadius: 10 }}>
                  <QRCodeSVG value={joinUrl} size={160} />
                </div>
                <div style={{ fontFamily: "monospace", fontSize: 22, fontWeight: 900, letterSpacing: 6, color: TEAL }}>
                  {gameCode}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
                  QR-Code scannen oder Code auf beachbande.de/brandung/lobby eingeben
                </div>
              </div>

              {/* Player list */}
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
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>🌊🌊🌊</span>
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
                {isAdmin && waitingPlayers.length >= 2 && (
                  <button className="btn" style={{ flex: 2, background: TEAL, color: "white", fontWeight: 700 }}
                    onClick={startOnlineGame}>
                    🃏 Spiel starten!
                  </button>
                )}
                {!isAdmin && (
                  <div style={{ flex: 2, textAlign: "center", fontSize: 13, color: "var(--text-muted)", alignSelf: "center" }}>
                    Warte auf Spielstart durch {waitingGame?.players[waitingGame?.adminId ?? ""]?.displayName}…
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
      {showRules && GAME_RULES["brandung"] && (
        <GameRulesModal rule={GAME_RULES["brandung"]} onClose={() => setShowRules(false)} />
      )}
    </div>
  );
}
