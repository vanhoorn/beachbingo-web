import { useEffect, useRef, useState } from "react";
import { doc, setDoc, getDoc, onSnapshot, updateDoc, arrayUnion } from "firebase/firestore";
import { useFavorite } from "../../favorites";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { auth, db } from "../../firebase";
import type { User } from "../../types";
import GameRulesModal from "../../components/GameRulesModal";
import { GAME_RULES } from "../../gameRules";
import { getGameSave, deleteGameSave } from "../../gameSave";
import SavedGameRow from "../../components/SavedGameRow";
import {
  generateKlonGameCode, dealGame, playerStateToFirestore, EMPTY_OFFER,
} from "./klontauschLogic";
import type { KlonPlayerState } from "./klontauschLogic";

const KT_COLOR = "#8B5CF6";
const KT_DIM   = "rgba(139,92,246,0.12)";

type Step = "mode" | "lobby";
type Mode = "ai" | "online";

const AI_KLON_AVATARS = ["🤖", "🦀", "🐟", "🦈", "🐬"];

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

export default function KlontauschLobbyScreen() {
  const navigate = useNavigate();
  const uid = auth.currentUser?.uid ?? "";

  const [step, setStep]           = useState<Step>("mode");
  const [mode, setMode]           = useState<Mode>("ai");
  const [aiCount, setAiCount]     = useState(2);
  const [difficulty, setDifficulty] = useState("SNIPER");
  const [isFavorite, toggleFavorite] = useFavorite("klontausch");
  const [showRules, setShowRules] = useState(false);
  const [klonSave, setKlonSave]   = useState(() => getGameSave("klontausch"));

  const [creating, setCreating]   = useState(false);
  const [gameCode, setGameCode]   = useState("");
  const [waitingPlayers, setWaitingPlayers] = useState<{ userId: string; displayName: string; avatarUrl: string }[]>([]);
  const [adminId, setAdminId]     = useState("");
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
    });
    const code = new URLSearchParams(window.location.search).get("join");
    if (code) joinExistingGame(code.toUpperCase());
    return () => { unsubRef.current?.(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  function startVsAi() {
    sessionStorage.setItem("klontauschGame", JSON.stringify({
      mode: "ai", aiCount, difficulty, myName, myAvatar,
    }));
    navigate("/klontausch/game");
  }

  async function createOnlineGame() {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return;
    const user = snap.data() as User;
    setCreating(true);
    setError("");
    try {
      const code = generateKlonGameCode();
      await setDoc(doc(db, "klontauschGames", code), {
        adminId: uid,
        status: "LOBBY",
        players: {
          [uid]: {
            userId: uid,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            heldCards: [], cardCount: 0, isAI: false, isEliminated: false,
          },
        },
        playerIds: [uid],
        turnIndex: 0,
        offer: EMPTY_OFFER,
        winnerId: "",
        createdAt: Date.now(),
      });
      setGameCode(code);
      setAdminId(uid);
      const unsub = onSnapshot(doc(db, "klontauschGames", code), (s) => {
        if (!s.exists()) return;
        const g = s.data();
        const pIds = (g.playerIds as string[]) ?? [];
        const ps = (g.players as Record<string, { displayName: string; avatarUrl: string }>) ?? {};
        setWaitingPlayers(pIds.map(pid => ({
          userId: pid,
          displayName: ps[pid]?.displayName ?? pid,
          avatarUrl: ps[pid]?.avatarUrl ?? "👤",
        })));
        if (g.status === "PLAYING") {
          unsub();
          unsubRef.current = null;
          sessionStorage.setItem("klontauschGame", JSON.stringify({ mode: "online", gameId: code }));
          navigate("/klontausch/game");
        }
      });
      unsubRef.current = unsub;
    } catch {
      setError("Erstellen fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setCreating(false);
    }
  }

  async function startOnlineGame() {
    if (!gameCode) return;
    const gameSnap = await getDoc(doc(db, "klontauschGames", gameCode));
    if (!gameSnap.exists()) return;
    const g = gameSnap.data();
    const pIds = g.playerIds as string[];
    const ps = g.players as Record<string, KlonPlayerState>;

    const playerMap: Record<string, KlonPlayerState> = {};
    pIds.forEach(pid => {
      playerMap[pid] = {
        userId: pid,
        displayName: ps[pid]?.displayName ?? pid,
        avatarUrl: ps[pid]?.avatarUrl ?? "👤",
        heldCards: [], cardCount: 0, isAI: false, isEliminated: false,
      };
    });

    const { players: dealtPlayers, targets } = dealGame(playerMap, pIds);

    await updateDoc(doc(db, "klontauschGames", gameCode), {
      status: "PLAYING",
      turnIndex: 0,
      players: Object.fromEntries(
        Object.entries(dealtPlayers).map(([pid, p]) => [pid, playerStateToFirestore(p)])
      ),
    });

    for (const [pid, targetIds] of Object.entries(targets)) {
      await setDoc(doc(db, "klontauschGames", gameCode, "private", pid), {
        targetCharacterIds: targetIds,
      });
    }
  }

  async function cancelWaiting() {
    unsubRef.current?.();
    unsubRef.current = null;
    setGameCode("");
    setWaitingPlayers([]);
    setStep("mode");
  }

  async function joinExistingGame(code: string) {
    const [gameSnap, userSnap] = await Promise.all([
      getDoc(doc(db, "klontauschGames", code)),
      getDoc(doc(db, "users", uid)),
    ]);
    if (!gameSnap.exists()) { setError("Spiel nicht gefunden."); return; }
    if (!userSnap.exists()) return;
    const g = gameSnap.data();
    const user = userSnap.data() as User;

    if (g.status === "PLAYING") {
      if ((g.playerIds as string[]).includes(uid)) {
        sessionStorage.setItem("klontauschGame", JSON.stringify({ mode: "online", gameId: code }));
        navigate("/klontausch/game");
      } else {
        setError("Das Spiel läuft bereits.");
      }
      return;
    }

    if (!(g.playerIds as string[]).includes(uid)) {
      await updateDoc(doc(db, "klontauschGames", code), {
        [`players.${uid}`]: {
          userId: uid, displayName: user.displayName, avatarUrl: user.avatarUrl,
          heldCards: [], cardCount: 0, isAI: false, isEliminated: false,
        },
        playerIds: arrayUnion(uid),
      });
    }

    setGameCode(code);
    setAdminId(g.adminId);
    setMode("online");
    setStep("lobby");

    const unsub = onSnapshot(doc(db, "klontauschGames", code), (s) => {
      if (!s.exists()) return;
      const upd = s.data();
      const pIds = (upd.playerIds as string[]) ?? [];
      const pss = (upd.players as Record<string, { displayName: string; avatarUrl: string }>) ?? {};
      setWaitingPlayers(pIds.map(pid => ({
        userId: pid,
        displayName: pss[pid]?.displayName ?? pid,
        avatarUrl: pss[pid]?.avatarUrl ?? "👤",
      })));
      if (upd.status === "PLAYING") {
        unsub();
        sessionStorage.setItem("klontauschGame", JSON.stringify({ mode: "online", gameId: code }));
        navigate("/klontausch/game");
      }
    });
    unsubRef.current = unsub;
  }

  const joinUrl = `${window.location.origin}/klontausch/lobby?join=${gameCode}`;
  const isAdmin = adminId === uid;

  return (
    <div className="screen">
      <button className="btn btn-outline btn-sm" style={{ alignSelf: "flex-start" }}
        onClick={() => navigate("/card-games", { replace: true })}>
        ‹ Kartenspiele
      </button>

      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, #3b0764 0%, ${KT_COLOR} 100%)`,
        borderRadius: "var(--radius)", padding: "20px",
        display: "flex", alignItems: "center", gap: 16,
      }}>
        <div style={{ fontSize: 44 }}>🃏</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>Klontausch</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "white" }}>Figuren-Teile tauschen</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-outline btn-sm"
            onClick={() => navigate("/klontausch/results")}
            style={{ width: 42, padding: 0, fontSize: 18, color: "rgba(255,255,255,0.8)", borderColor: "rgba(255,255,255,0.2)" }}
            title="Statistik">
            🏆
          </button>
          <button className="btn btn-outline btn-sm"
            onClick={() => navigate("/klontausch/gallery")}
            style={{ width: 42, padding: 0, fontSize: 18, color: "rgba(255,255,255,0.8)", borderColor: "rgba(255,255,255,0.2)" }}
            title="Figurengalerie">
            🖼️
          </button>
          <button className="btn btn-outline btn-sm"
            onClick={toggleFavorite}
            style={{ width: 42, padding: 0, fontSize: 18, color: isFavorite ? "var(--accent)" : "rgba(255,255,255,0.8)", borderColor: isFavorite ? "var(--accent)" : "rgba(255,255,255,0.2)" }}>
            {isFavorite ? "★" : "☆"}
          </button>
          <button className="btn btn-outline btn-sm"
            onClick={() => setShowRules(true)}
            style={{ width: 42, padding: 0, fontSize: 18, color: "rgba(255,255,255,0.8)", borderColor: "rgba(255,255,255,0.2)" }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5" fill="currentColor"/>
            </svg>
          </button>
          <button className="btn btn-outline btn-sm"
            onClick={() => navigate("/klontausch/settings")}
            style={{ width: 42, padding: 0, fontSize: 18, color: "rgba(255,255,255,0.8)", borderColor: "rgba(255,255,255,0.2)" }}
            title="Einstellungen">
            ⚙️
          </button>
        </div>
      </div>

      {/* ── Step: Mode ── */}
      {step === "mode" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Spielmodus wählen</div>
          {klonSave && (
            <SavedGameRow
              title="Klontausch"
              subtitle={klonSave.displayLabel}
              color={KT_COLOR}
              onResume={() => {
                const saved = (() => { try { return JSON.parse(klonSave.gameState); } catch { return {}; } })();
                sessionStorage.setItem("klontauschGame", JSON.stringify({
                  mode: "ai", aiCount: saved.aiCount ?? 2, myName, myAvatar, saveId: klonSave.id,
                }));
                navigate("/klontausch/game");
              }}
              onDelete={() => { deleteGameSave("klontausch"); setKlonSave(null); }}
            />
          )}
          <ModeCard emoji="🤖" title="Gegen KI" description="Spiel allein gegen 1–3 KI-Gegner" color={KT_COLOR}
            onClick={() => { setMode("ai"); setStep("lobby"); }} />
          <ModeCard emoji="📱" title="Online – bis 4 Spieler" description="Spielt gemeinsam via QR-Code" color="#0ea5e9"
            onClick={() => { setMode("online"); setStep("lobby"); createOnlineGame(); }} />
        </div>
      )}

      {/* ── Step: KI-Lobby ── */}
      {step === "lobby" && mode === "ai" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <button className="btn btn-outline btn-sm" style={{ alignSelf: "flex-start" }}
            onClick={() => setStep("mode")}>‹ Zurück</button>

          <div className="card" style={{ padding: 20, gap: 16, display: "flex", flexDirection: "column" }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>KI-Gegner ({aiCount + 1} Spieler gesamt)</div>
            <div style={{ display: "flex", gap: 8 }}>
              {[1, 2, 3].map(n => (
                <button key={n} onClick={() => setAiCount(n)} style={{
                  flex: 1, padding: "12px 4px", borderRadius: 8,
                  border: `1px solid ${aiCount === n ? KT_COLOR : "var(--border)"}`,
                  background: aiCount === n ? KT_DIM : "var(--surface2)",
                  color: aiCount === n ? KT_COLOR : "var(--text-sub)",
                  fontWeight: aiCount === n ? 700 : 400, fontSize: 14, cursor: "pointer",
                }}>
                  {n} KI{"\n"}
                  <span style={{ fontSize: 11, opacity: 0.7 }}>
                    {AI_KLON_AVATARS.slice(0, n).join(" ")}
                  </span>
                </button>
              ))}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {aiCount + 1} Spieler · {(aiCount + 1) * 3} Figuren · {(aiCount + 1) * 9} Karten
            </div>
          </div>

          {/* Difficulty picker */}
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-sub)" }}>KI-Schwierigkeit</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {([
              { id: "ROOKIE",     emoji: "🐣", label: "Rookie",     desc: "Mopst zufällig, keine Strategie" },
              { id: "SNIPER",     emoji: "🎯", label: "Sniper",     desc: "Taktisch klug, bevorzugt Zielkarten" },
              { id: "BOSS_LEVEL", emoji: "💀", label: "Boss Level", desc: "Unerbittlich – kennt deine Schwächen" },
            ] as const).map(d => {
              const sel = difficulty === d.id;
              return (
                <button key={d.id} onClick={() => setDifficulty(d.id)} style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "12px 16px", borderRadius: 8, cursor: "pointer",
                  border: `2px solid ${sel ? KT_COLOR : "var(--border)"}`,
                  background: sel ? KT_DIM : "var(--surface)",
                  textAlign: "left", width: "100%",
                }}>
                  <span style={{ fontSize: 22 }}>{d.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{d.label}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{d.desc}</div>
                  </div>
                  {sel && <span style={{ color: KT_COLOR, fontWeight: 700 }}>✓</span>}
                </button>
              );
            })}
          </div>

          <button className="btn"
            style={{ background: KT_COLOR, color: "white", padding: "14px", fontSize: 16, fontWeight: 700, borderRadius: "var(--radius)" }}
            onClick={startVsAi}>
            🃏 Spiel starten ({aiCount + 1} Spieler)
          </button>
        </div>
      )}

      {/* ── Step: Online-Lobby ── */}
      {step === "lobby" && mode === "online" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {creating ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ fontSize: 36 }}>🃏</div>
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
                <div style={{ fontFamily: "monospace", fontSize: 22, fontWeight: 900, letterSpacing: 6, color: KT_COLOR }}>
                  {gameCode}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
                  QR-Code scannen oder Code auf beachbande.de/klontausch/lobby eingeben
                </div>
              </div>

              <div className="card" style={{ padding: "16px 18px" }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
                  Spieler ({waitingPlayers.length}/4)
                </div>
                {waitingPlayers.map(p => (
                  <div key={p.userId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid var(--border)" }}>
                    <span style={{ fontSize: 22 }}>{p.avatarUrl}</span>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: p.userId === uid ? 700 : 400 }}>
                      {p.displayName}
                      {p.userId === uid ? " 👤" : ""}
                      {p.userId === adminId ? " 👑" : ""}
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
                  <button className="btn"
                    style={{
                      flex: 2,
                      background: waitingPlayers.length >= 2 ? KT_COLOR : "var(--surface2)",
                      color: "white", fontWeight: 700,
                      opacity: waitingPlayers.length >= 2 ? 1 : 0.5,
                      cursor: waitingPlayers.length >= 2 ? "pointer" : "not-allowed",
                    }}
                    onClick={waitingPlayers.length >= 2 ? startOnlineGame : undefined}>
                    {waitingPlayers.length >= 2 ? "🃏 Spiel starten!" : `⏳ Warte (${waitingPlayers.length}/2)`}
                  </button>
                )}
                {!isAdmin && (
                  <div style={{ flex: 2, textAlign: "center", fontSize: 13, color: "var(--text-muted)", alignSelf: "center" }}>
                    Warte auf Spielleiter…
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

      {showRules && GAME_RULES["klontausch"] && (
        <GameRulesModal rule={GAME_RULES["klontausch"]} onClose={() => setShowRules(false)} />
      )}
    </div>
  );
}
