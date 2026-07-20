import { useEffect, useRef, useState } from "react";
import { doc, setDoc, getDoc, onSnapshot, deleteDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { auth, db } from "../../firebase";
import type { User, MeermauGame, MeermauOnlinePlayer } from "../../types";
import type { MeerMauDifficulty, MeerMauSettings } from "./meermauLogic";
import { dealMCards, DEFAULT_MM_SETTINGS } from "./meermauLogic";

const VIOLET = "#7c3aed";
const VIOLET_DIM = "rgba(124,58,237,0.12)";

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
        flex: 1, padding: "10px 8px", borderRadius: 8, border: `1px solid ${active ? VIOLET : "var(--border)"}`,
        background: active ? VIOLET_DIM : "var(--surface2)", color: active ? VIOLET : "var(--text-sub)",
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

export default function MeermauLobbyScreen() {
  const navigate = useNavigate();
  const uid = auth.currentUser?.uid ?? "";

  const [step, setStep] = useState<Step>("mode");
  const [mode, setMode] = useState<Mode>("ai");
  const [aiCount, setAiCount] = useState(2);
  const [difficulty, setDifficulty] = useState<MeerMauDifficulty>("SNIPER");
  const [settings, setSettings] = useState<MeerMauSettings>(DEFAULT_MM_SETTINGS);
  const [isFavorite, setIsFavorite] = useState(false);

  // Online state
  const [creating, setCreating] = useState(false);
  const [gameCode, setGameCode] = useState("");
  const [waitingGame, setWaitingGame] = useState<MeermauGame | null>(null);
  const [error, setError] = useState("");
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!uid) return;
    getDoc(doc(db, "users", uid)).then((snap) => {
      if (!snap.exists()) return;
      const u = snap.data() as User;
      if (u.meermauReverseOn9 !== undefined) setSettings(s => ({ ...s, reverseOn9: u.meermauReverseOn9! }));
      if (u.meermauStopperOn8 !== undefined) setSettings(s => ({ ...s, stopperOn8: u.meermauStopperOn8! }));
      if (u.meermauWildOn10 !== undefined) setSettings(s => ({ ...s, wildOn10: u.meermauWildOn10! }));
      setIsFavorite((snap.data()?.favoriteGames as string[] ?? []).includes("meermau"));
    });
    return () => { unsubRef.current?.(); };
  }, [uid]);

  async function toggleFavorite() {
    const next = !isFavorite;
    setIsFavorite(next);
    await updateDoc(doc(db, "users", uid), {
      favoriteGames: next ? arrayUnion("meermau") : arrayRemove("meermau"),
    });
  }

  function startVsAi() {
    navigate("/meermau/game", { state: { mode: "ai", aiCount, difficulty, settings } });
  }

  async function createOnlineGame() {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return;
    const user = snap.data() as User;
    setCreating(true);
    setError("");
    try {
      const code = generateCode();
      const me: MeermauOnlinePlayer = {
        userId: uid, displayName: user.displayName, avatarUrl: user.avatarUrl,
        hand: [], totalScore: 0, eliminated: false, isAI: false,
      };
      const game: Omit<MeermauGame, "gameId"> = {
        adminId: uid,
        status: "LOBBY",
        phase: "PLAYING",
        players: { [uid]: me },
        playerIds: [uid],
        currentPlayerIndex: 0,
        direction: 1,
        drawPile: [],
        discardPile: [],
        drawPending: 0,
        wishSuit: null,
        mauPlayerId: null,
        roundScores: {},
        gameWinnerId: null,
        eliminatedPlayerIds: [],
        round: 1,
        settings,
        lastActionText: "",
        createdAt: Date.now(),
      };
      await setDoc(doc(db, "meermauGames", code), game);
      setGameCode(code);

      const unsub = onSnapshot(doc(db, "meermauGames", code), (s) => {
        if (!s.exists()) return;
        const g = { gameId: s.id, ...s.data() } as MeermauGame;
        setWaitingGame(g);
        if (g.status === "RUNNING") {
          unsub();
          unsubRef.current = null;
          navigate("/meermau/game", { state: { mode: "online", gameId: code } });
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
      try { await deleteDoc(doc(db, "meermauGames", gameCode)); } catch { /* ignore */ }
    }
    setGameCode("");
    setWaitingGame(null);
    setStep("mode");
  }

  async function startOnlineGame() {
    if (!waitingGame || !gameCode) return;
    const playerIds = Object.keys(waitingGame.players);
    const { hands, drawPile, topCard } = dealMCards(playerIds.length);
    const updatedPlayers: { [uid: string]: MeermauOnlinePlayer } = {};
    for (let i = 0; i < playerIds.length; i++) {
      const pid = playerIds[i];
      updatedPlayers[pid] = { ...waitingGame.players[pid], hand: hands[i] };
    }
    await updateDoc(doc(db, "meermauGames", gameCode), {
      status: "RUNNING",
      phase: "PLAYING",
      players: updatedPlayers,
      playerIds,
      drawPile,
      discardPile: [topCard],
      currentPlayerIndex: 0,
      direction: 1,
      drawPending: 0,
      wishSuit: null,
    });
  }

  const joinUrl = `${window.location.origin}/meermau/lobby?join=${gameCode}`;
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
    const snap = await getDoc(doc(db, "meermauGames", code));
    if (!snap.exists()) { setError("Spiel nicht gefunden."); return; }
    const g = { gameId: snap.id, ...snap.data() } as MeermauGame;
    if (g.status !== "LOBBY") { setError("Spiel läuft bereits."); return; }
    if (Object.keys(g.players).length >= 4) { setError("Spiel ist voll (max. 4 Spieler)."); return; }
    const userSnap = await getDoc(doc(db, "users", uid));
    if (!userSnap.exists()) return;
    const user = userSnap.data() as User;
    const me: MeermauOnlinePlayer = {
      userId: uid, displayName: user.displayName, avatarUrl: user.avatarUrl,
      hand: [], totalScore: 0, eliminated: false, isAI: false,
    };
    await updateDoc(doc(db, "meermauGames", code), {
      [`players.${uid}`]: me,
      playerIds: [...g.playerIds, uid],
    });
    setGameCode(code);
    const unsub = onSnapshot(doc(db, "meermauGames", code), (s) => {
      if (!s.exists()) return;
      const upd = { gameId: s.id, ...s.data() } as MeermauGame;
      setWaitingGame(upd);
      if (upd.status === "RUNNING") {
        unsub();
        navigate("/meermau/game", { state: { mode: "online", gameId: code } });
      }
    });
    unsubRef.current = unsub;
    setStep("lobby");
    setMode("online");
  }

  const activeSettings = [
    settings.reverseOn9 && "9 kehrt um",
    settings.stopperOn8 && "8 stoppt",
    settings.wildOn10 && "10 als Joker",
  ].filter(Boolean);

  return (
    <div className="screen">
      <button className="btn btn-outline btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => navigate("/home")}>
        ‹ Spielauswahl
      </button>

      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, #3b0764 0%, ${VIOLET} 100%)`,
        borderRadius: "var(--radius)", padding: "20px",
        display: "flex", alignItems: "center", gap: 16,
      }}>
        <div style={{ fontSize: 44 }}>🂠</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>MeerMau</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "white" }}>Mau-Mau am Strand</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-outline btn-sm"
            style={{ width: 42, padding: 0, fontSize: 18, color: "rgba(255,255,255,0.8)", borderColor: "rgba(255,255,255,0.2)" }}
            onClick={() => navigate("/meermau/results")} title="Ergebnisse">🏆</button>
          <button className="btn btn-outline btn-sm"
            onClick={toggleFavorite}
            style={{ width: 42, padding: 0, fontSize: 18, color: isFavorite ? "var(--accent)" : "rgba(255,255,255,0.8)", borderColor: isFavorite ? "var(--accent)" : "rgba(255,255,255,0.2)" }}>
            {isFavorite ? "★" : "☆"}
          </button>
          <button className="btn btn-outline btn-sm"
            style={{ width: 42, padding: 0, fontSize: 18, color: "rgba(255,255,255,0.8)", borderColor: "rgba(255,255,255,0.2)" }}
            onClick={() => navigate("/meermau/settings")} title="Einstellungen">⚙️</button>
        </div>
      </div>

      {/* ── Step: Mode ── */}
      {step === "mode" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Spielmodus wählen</div>
          <ModeCard emoji="🤖" title="Gegen KI" description="Spiel allein gegen 1–3 KI-Gegner" color={VIOLET}
            onClick={() => { setMode("ai"); setStep("lobby"); }} />
          <ModeCard emoji="📱" title="Online – bis 4 Spieler" description="Spielt gemeinsam via QR-Code" color="#0ea5e9"
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
              {[1, 2, 3].map(n => (
                <button key={n} onClick={() => setAiCount(n)} style={{
                  flex: 1, padding: "10px 4px", borderRadius: 8,
                  border: `1px solid ${aiCount === n ? VIOLET : "var(--border)"}`,
                  background: aiCount === n ? VIOLET_DIM : "var(--surface2)",
                  color: aiCount === n ? VIOLET : "var(--text-sub)",
                  fontWeight: aiCount === n ? 700 : 400, fontSize: 14, cursor: "pointer",
                }}>{n}</button>
              ))}
            </div>

            <div style={{ fontWeight: 700, fontSize: 15, marginTop: 4 }}>KI-Stärke</div>
            <div style={{ display: "flex", gap: 8 }}>
              <DifficultyButton label="🎴 Rookie" active={difficulty === "ROOKIE"} onClick={() => setDifficulty("ROOKIE")} />
              <DifficultyButton label="🎯 Sniper" active={difficulty === "SNIPER"} onClick={() => setDifficulty("SNIPER")} />
              <DifficultyButton label="💪 Boss" active={difficulty === "BOSS_LEVEL"} onClick={() => setDifficulty("BOSS_LEVEL")} />
            </div>
          </div>

          {/* Settings summary */}
          <div className="card" style={{ padding: "14px 18px", fontSize: 13, color: "var(--text-sub)" }}>
            <span style={{ color: VIOLET }}>⚙️ </span>
            {activeSettings.length > 0
              ? activeSettings.join(" · ")
              : "Standard-Regeln"}
            {" "}· <button onClick={() => navigate("/meermau/settings")} style={{ background: "none", border: "none", color: VIOLET, cursor: "pointer", padding: 0, fontSize: 13 }}>Ändern →</button>
          </div>

          <button className="btn" style={{ background: VIOLET, color: "white", padding: "14px", fontSize: 16, fontWeight: 700, borderRadius: "var(--radius)" }}
            onClick={startVsAi}>
            🂠 Spiel starten ({aiCount + 1} Spieler)
          </button>
        </div>
      )}

      {/* ── Step: Online Lobby ── */}
      {step === "lobby" && mode === "online" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {creating ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ fontSize: 36 }}>🂠</div>
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
                <div style={{ fontFamily: "monospace", fontSize: 22, fontWeight: 900, letterSpacing: 6, color: VIOLET }}>
                  {gameCode}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
                  QR-Code scannen oder Code auf beachbande.de/meermau/lobby eingeben
                </div>
              </div>

              {/* Player list */}
              <div className="card" style={{ padding: "16px 18px" }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
                  Spieler ({waitingPlayers.length}/4)
                </div>
                {waitingPlayers.map(p => (
                  <div key={p.userId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid var(--border)" }}>
                    <span style={{ fontSize: 22 }}>{p.avatarUrl}</span>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: p.userId === uid ? 700 : 400 }}>
                      {p.displayName}{p.userId === uid ? " 👤" : ""}
                      {p.userId === waitingGame?.adminId ? " 👑" : ""}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>🂠🂠🂠</span>
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
                  <button className="btn" style={{ flex: 2, background: VIOLET, color: "white", fontWeight: 700 }}
                    onClick={startOnlineGame}>
                    🂠 Spiel starten!
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
    </div>
  );
}
