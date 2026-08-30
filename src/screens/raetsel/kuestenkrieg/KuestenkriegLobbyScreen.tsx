import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { doc, setDoc, getDoc, onSnapshot, updateDoc, deleteDoc, query, where, getDocs, collection } from "firebase/firestore";
import { auth, db } from "../../../firebase";
import { useFavorite } from "../../../favorites";
import { getPuzzleSaves, deletePuzzleSave, formatElapsed, getBestTimeAny, PUZZLE_DIFFICULTY_LABELS } from "../../../puzzleSave";
import type { KriegDifficulty } from "./kuestenkriegLogic";
import GameRulesModal from "../../../components/GameRulesModal";
import { GAME_RULES } from "../../../gameRules";
import { GRID_SIZES, FLEET } from "./kuestenkriegLogic";
import type { AiMode } from "./kuestenkriegBattleLogic";
import type { KriegOnlineGame, KriegOnlinePlayer, User } from "../../../types";

const ACCENT = "#fb7185";

type GameMode = "puzzle" | "ki" | "online";

function fleetLabel(fleet: number[]): string {
  const counts: Record<number, number> = {};
  fleet.forEach(n => { counts[n] = (counts[n] ?? 0) + 1; });
  return Object.entries(counts)
    .sort(([a], [b]) => Number(b) - Number(a))
    .map(([size, count]) => `${count}×${size}er`)
    .join(", ");
}

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

const AI_MODES: { id: AiMode; label: string; desc: string; emoji: string }[] = [
  { id: "matrose",  label: "Matrose",  desc: "Schießt zufällig",                 emoji: "🌊" },
  { id: "kapitaen", label: "Kapitän",  desc: "Wahrscheinlichkeitsbasiert",        emoji: "⚓" },
  { id: "admiral",  label: "Admiral",  desc: "Sucht & zielt — stärkste KI",      emoji: "🏴‍☠️" },
];

const PUZZLE_DIFFICULTIES: KriegDifficulty[] = ["leicht", "mittel", "schwer", "experte"];

interface OnlineResultItem {
  opponentId: string; opponentName: string; opponentAvatar: string;
  myWins: number; theirWins: number; totalGames: number;
  lastGameAt: number; lastWinnerId: string; constellationTitle: string;
}

const KK_CONSTELLATION_NAMES = [
  "Korallenflotte|Sandburgbataillon", "SprottenGirls|DorschBabys",
  "PalmenBoys|SchlauchbootMatrosen", "Wattjäger|Muschelsammler",
  "Möwenpiraten|Krakenflüsterer", "Brandungsreiter|Sandkastenkapitäne",
  "Tintenfischbande|Strandwächter", "Nordseeadler|Wattwurmbrigade",
  "Barrakuda-Crew|Seepferdchen-Staffel", "Wellenreiter|Sanddünenkommando",
  "Heringsjäger|Austernretter", "Salzwasserwölfe|Bademeister-Union",
  "Kormorantruppe|Strandkorbverteidiger", "Anker-Asse|Flaggen-Flatterer",
  "Neptunsgarde|Strandräuber-Koalition", "Krabbenklau-Clan|Muschelpiraten",
  "Tiefseebande|Flachlandmatrosen", "Sturmflut-Staffel|Sandburg-Söldner",
  "Möwenkönige|Plastikenten-Piraten", "Blauwal-Brigade|Minigolf-Miliz",
  "Sardellen-Syndrom|Lachs-Legion", "Schaumkronen-Crew|Treibholz-Truppe",
  "Quallen-Quartier|Sonnencrème-Söldner", "Brandungs-Barbaren|Wellenbrecher",
  "Ebbe-Allianz|Flut-Front",
];

function kkConstellationTitle(uid1: string, uid2: string): string {
  const sorted = [uid1, uid2].sort();
  const key = sorted.join("|");
  let hash = 0n;
  for (const c of key) hash = (hash * 31n + BigInt(c.charCodeAt(0))) & 0x7FFFFFFFFFFFFFFFn;
  const idx = Number(hash % 25n);
  const pair = KK_CONSTELLATION_NAMES[idx].split("|");
  return Number((hash / 25n) % 2n) === 0 ? `${pair[0]} vs. ${pair[1]}` : `${pair[1]} vs. ${pair[0]}`;
}

function formatGameDate(ms: number): string {
  return new Date(ms).toLocaleDateString("de-DE", { day: "numeric", month: "short" });
}

export default function KuestenkriegLobbyScreen() {
  const navigate = useNavigate();
  const uid = auth.currentUser?.uid ?? "";

  const [gameMode, setGameMode] = useState<GameMode>("puzzle");
  const [aiMode, setAiMode] = useState<AiMode>("kapitaen");
  const [puzzleDiff, setPuzzleDiff] = useState<KriegDifficulty>("mittel");

  // Online state
  const [creating, setCreating] = useState(false);
  const [gameCode, setGameCode] = useState("");
  const [waitingGame, setWaitingGame] = useState<KriegOnlineGame | null>(null);
  const [error, setError] = useState("");
  const [joinInput, setJoinInput] = useState("");
  const unsubRef = useRef<(() => void) | null>(null);
  const [_myName, setMyName] = useState("Du");

  const [showStats, setShowStats] = useState(false);
  const [statsTab, setStatsTab] = useState(0);
  const [onlineResultItems, setOnlineResultItems] = useState<OnlineResultItem[]>([]);
  const [loadingOnline, setLoadingOnline] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const saves = getPuzzleSaves().filter(s => s.gameType === "kuestenkrieg");
  const kiSaves = getPuzzleSaves().filter(s => s.gameType === "kuestenkrieg_ki");
  const [isFavorite, toggleFavorite] = useFavorite("kuestenkrieg");

  useEffect(() => {
    if (!uid) return;
    getDoc(doc(db, "users", uid)).then(snap => {
      if (snap.exists()) setMyName((snap.data() as User).displayName ?? "Du");
    });

    // Handle ?join= deep-link
    const code = new URLSearchParams(window.location.search).get("join");
    if (code) joinExistingGame(code.toUpperCase());

    return () => { unsubRef.current?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const startPuzzle = () =>
    navigate("/raetsel/kuestenkrieg/game", { state: { difficulty: puzzleDiff, seed: Date.now() } });

  const startKI = () =>
    navigate("/raetsel/kuestenkrieg/placement", { state: { aiMode } });

  const resumeSave = (save: ReturnType<typeof getPuzzleSaves>[number]) =>
    navigate("/raetsel/kuestenkrieg/game", {
      state: {
        difficulty: save.difficulty as KriegDifficulty,
        seed: save.seed, saveId: save.id,
        savedState: save.puzzleState, elapsedSeconds: save.elapsedSeconds,
      },
    });

  const resumeKiSave = (save: ReturnType<typeof getPuzzleSaves>[number]) =>
    navigate("/raetsel/kuestenkrieg/battle", {
      state: {
        fleet: [], aiMode: (save.variant || "matrose") as AiMode,
        resumeSaveId: save.id, resumeState: save.puzzleState,
      },
    });

  useEffect(() => {
    if (!showStats || !uid) return;
    setLoadingOnline(true);
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, "kuestenkriegResults"), where("playerIds", "array-contains", uid)));
        const docs = snap.docs.sort((a, b) => (b.data().createdAt ?? 0) - (a.data().createdAt ?? 0));
        const grouped = new Map<string, typeof docs>();
        for (const d of docs) {
          const pIds = (d.data().playerIds ?? []) as string[];
          const oppId = pIds.find(id => id !== uid);
          if (!oppId) continue;
          if (!grouped.has(oppId)) grouped.set(oppId, []);
          grouped.get(oppId)!.push(d);
        }
        const items: OnlineResultItem[] = [];
        for (const [oppId, gameDocs] of grouped.entries()) {
          const myWins = gameDocs.filter(d => d.data().winnerId === uid).length;
          const theirWins = gameDocs.filter(d => d.data().winnerId === oppId).length;
          const last = gameDocs[0].data();
          const pIds = (last.playerIds ?? []) as string[];
          const pNames = (last.playerNames ?? []) as string[];
          const pAvatars = (last.playerAvatars ?? []) as string[];
          const oppIdx = pIds.indexOf(oppId);
          items.push({
            opponentId: oppId,
            opponentName: pNames[oppIdx] ?? "Gegner",
            opponentAvatar: pAvatars[oppIdx] ?? "👤",
            myWins, theirWins,
            totalGames: gameDocs.length,
            lastGameAt: last.createdAt ?? 0,
            lastWinnerId: last.winnerId ?? "",
            constellationTitle: kkConstellationTitle(pIds[0] ?? "", pIds[1] ?? ""),
          });
        }
        setOnlineResultItems(items.sort((a, b) => b.lastGameAt - a.lastGameAt));
      } catch { /* ignore */ }
      setLoadingOnline(false);
    })();
  }, [showStats, uid]);

  async function createOnlineGame() {
    if (!uid) return;
    const userSnap = await getDoc(doc(db, "users", uid));
    if (!userSnap.exists()) return;
    const user = userSnap.data() as User;
    setCreating(true);
    setError("");
    try {
      const code = generateCode();
      const me: KriegOnlinePlayer = {
        userId: uid, displayName: user.displayName, avatarUrl: user.avatarUrl,
        fleet: [], fleetReady: false,
      };
      const game: Omit<KriegOnlineGame, "gameId"> = {
        adminId: uid, status: "LOBBY",
        playerIds: [uid],
        players: { [uid]: me },
        shots: {},
        turn: uid,
        winner: null,
        createdAt: Date.now(),
      };
      await setDoc(doc(db, "kuestenkriegGames", code), game);
      setGameCode(code);

      const unsub = onSnapshot(doc(db, "kuestenkriegGames", code), snap => {
        if (!snap.exists()) return;
        const g = { gameId: snap.id, ...snap.data() } as KriegOnlineGame;
        setWaitingGame(g);
        if (g.status === "PLACEMENT") {
          unsub();
          unsubRef.current = null;
          navigate("/raetsel/kuestenkrieg/placement", { state: { mode: "online", gameCode: code } });
        }
      });
      unsubRef.current = unsub;
    } catch {
      setError("Erstellen fehlgeschlagen.");
    } finally {
      setCreating(false);
    }
  }

  async function joinExistingGame(code: string) {
    if (!uid) return;
    const [gameSnap, userSnap] = await Promise.all([
      getDoc(doc(db, "kuestenkriegGames", code)),
      getDoc(doc(db, "users", uid)),
    ]);
    if (!gameSnap.exists()) { setError("Spiel nicht gefunden."); return; }
    const g = { gameId: code, ...gameSnap.data() } as KriegOnlineGame;
    if (!userSnap.exists()) return;
    const user = userSnap.data() as User;

    if (g.status === "FINISHED") { setError("Dieses Spiel ist bereits beendet."); return; }
    if (g.status === "RUNNING" || g.status === "PLACEMENT") {
      if (g.playerIds.includes(uid)) {
        navigate("/raetsel/kuestenkrieg/placement", { state: { mode: "online", gameCode: code } });
        return;
      }
      setError("Das Spiel hat bereits begonnen.");
      return;
    }
    if (g.playerIds.length >= 2 && !g.playerIds.includes(uid)) {
      setError("Das Spiel ist voll (2 Spieler).");
      return;
    }

    const me: KriegOnlinePlayer = {
      userId: uid, displayName: user.displayName, avatarUrl: user.avatarUrl,
      fleet: [], fleetReady: false,
    };
    if (!g.playerIds.includes(uid)) {
      await updateDoc(doc(db, "kuestenkriegGames", code), {
        [`players.${uid}`]: me,
        playerIds: [...g.playerIds, uid],
      });
    }

    setGameCode(code);
    setGameMode("online");

    const unsub = onSnapshot(doc(db, "kuestenkriegGames", code), snap => {
      if (!snap.exists()) return;
      const upd = { gameId: snap.id, ...snap.data() } as KriegOnlineGame;
      setWaitingGame(upd);
      if (upd.status === "PLACEMENT" || upd.status === "RUNNING") {
        unsub();
        unsubRef.current = null;
        navigate("/raetsel/kuestenkrieg/placement", { state: { mode: "online", gameCode: code } });
      }
    });
    unsubRef.current = unsub;
  }

  async function startPlacement() {
    if (!gameCode) return;
    await updateDoc(doc(db, "kuestenkriegGames", gameCode), { status: "PLACEMENT" });
  }

  async function cancelWaiting() {
    unsubRef.current?.();
    unsubRef.current = null;
    if (gameCode && waitingGame?.adminId === uid) {
      try { await deleteDoc(doc(db, "kuestenkriegGames", gameCode)); } catch { /* ignore */ }
    }
    setGameCode("");
    setWaitingGame(null);
    setCreating(false);
    setGameMode("puzzle");
  }

  const joinUrl = `${window.location.origin}/raetsel/kuestenkrieg/lobby?join=${gameCode}`;
  const waitingPlayers = waitingGame ? Object.values(waitingGame.players) : [];
  const isAdmin = waitingGame?.adminId === uid;
  const canStart = waitingPlayers.length === 2;

  return (
    <div className="screen">
      <button className="btn btn-outline btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => navigate("/raetsel", { replace: true })}>‹ Zurück</button>

      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, #4c0519 0%, ${ACCENT} 100%)`,
        borderRadius: "var(--radius)", padding: "20px",
        display: "flex", alignItems: "center", gap: 16,
      }}>
        <div style={{ fontSize: 44 }}>⚓</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>Rätsel</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "white" }}>Küstenkrieg</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-outline btn-sm"
            style={{ width: 42, padding: 0, fontSize: 18, color: "rgba(255,255,255,0.8)", borderColor: "rgba(255,255,255,0.2)" }}
            onClick={() => setShowStats(true)} title="Ergebnisse">🏆</button>
          <button className="btn btn-outline btn-sm" onClick={toggleFavorite}
            style={{ width: 42, padding: 0, fontSize: 18, color: isFavorite ? "var(--accent)" : "rgba(255,255,255,0.8)", borderColor: isFavorite ? "var(--accent)" : "rgba(255,255,255,0.2)" }}>
            {isFavorite ? "★" : "☆"}
          </button>
          <button className="btn btn-outline btn-sm"
            style={{ width: 42, padding: 0, fontSize: 18, color: "rgba(255,255,255,0.8)", borderColor: "rgba(255,255,255,0.2)" }}
            onClick={() => setShowRules(true)} title="Spielanleitung">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5" fill="currentColor"/></svg>
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Online waiting lobby */}
        {gameMode === "online" && gameCode ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {creating ? (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <div style={{ fontSize: 36 }}>⚓</div>
                <div style={{ marginTop: 8, color: "var(--text-muted)" }}>Spiel wird erstellt…</div>
              </div>
            ) : (
              <>
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 1, textTransform: "uppercase" }}>Gegner einladen</div>
                  <div style={{ background: "white", padding: 12, borderRadius: 10 }}>
                    <QRCodeSVG value={joinUrl} size={160} />
                  </div>
                  <div style={{ fontFamily: "monospace", fontSize: 22, fontWeight: 900, letterSpacing: 6, color: ACCENT }}>{gameCode}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
                    QR-Code scannen oder Code auf beachbande.de eingeben
                  </div>
                </div>

                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px" }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Spieler ({waitingPlayers.length}/2)</div>
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
                    <div style={{ fontSize: 13, color: "var(--text-muted)", paddingTop: 8 }}>Warte auf Gegner…</div>
                  )}
                </div>

                {error && <div style={{ color: "var(--danger)", fontSize: 13, textAlign: "center" }}>{error}</div>}

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={cancelWaiting}
                    style={{ flex: 1, padding: "12px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, cursor: "pointer", fontSize: 14, fontWeight: 700, color: "var(--text)" }}
                  >
                    Abbrechen
                  </button>
                  {isAdmin && (
                    <button
                      onClick={canStart ? startPlacement : undefined}
                      disabled={!canStart}
                      style={{ flex: 2, padding: "12px", background: canStart ? ACCENT : "var(--surface)", border: "none", borderRadius: 12, cursor: canStart ? "pointer" : "default", fontSize: 14, fontWeight: 800, color: canStart ? "#0a1628" : "var(--text-muted)", opacity: canStart ? 1 : 0.5 }}
                    >
                      {canStart ? "⚓ Schiffe setzen!" : "⏳ Warte auf Gegner…"}
                    </button>
                  )}
                  {!isAdmin && (
                    <div style={{ flex: 2, textAlign: "center", fontSize: 13, color: "var(--text-muted)", alignSelf: "center" }}>
                      Warte auf {waitingPlayers.find(p => p.userId === waitingGame?.adminId)?.displayName ?? "Gastgeber"}…
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Mode selection */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Spielmodus</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { id: "puzzle" as GameMode, emoji: "🧩", label: "Solo Rätsel", desc: "Zahlen am Rand verraten die Schiffe" },
                  { id: "ki"     as GameMode, emoji: "🤖", label: "Gegen KI",    desc: "Klassisches Schiffe versenken" },
                  { id: "online" as GameMode, emoji: "🌐", label: "Online",      desc: "Gegen echten Spieler (QR-Code)" },
                ].map(m => (
                  <button
                    key={m.id}
                    onClick={() => { setGameMode(m.id); setError(""); }}
                    style={{
                      padding: "14px 16px", textAlign: "left",
                      background: gameMode === m.id ? ACCENT + "22" : "var(--surface)",
                      border: `1.5px solid ${gameMode === m.id ? ACCENT : "var(--border)"}`,
                      borderRadius: 12, cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 12,
                    }}
                  >
                    <span style={{ fontSize: 22 }}>{m.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: gameMode === m.id ? ACCENT : "var(--text)" }}>{m.label}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{m.desc}</div>
                    </div>
                    {gameMode === m.id && m.id !== "online" && <span style={{ color: ACCENT, fontSize: 18 }}>✓</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Running KI games */}
            {gameMode !== "online" && kiSaves.length > 0 && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Laufende KI-Gefechte</div>
                {kiSaves.map(save => {
                  const modeLabel = save.variant === "admiral" ? "Admiral" : save.variant === "kapitaen" ? "Kapitän" : "Matrose";
                  const modeEmoji = save.variant === "admiral" ? "🏴‍☠️" : save.variant === "kapitaen" ? "⚓" : "🌊";
                  return (
                    <div key={save.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{modeEmoji} {modeLabel}</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Gespeichertes Gefecht</div>
                      </div>
                      <button onClick={() => resumeKiSave(save)} style={{ padding: "8px 14px", background: ACCENT + "22", border: `1px solid ${ACCENT}55`, borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700, color: ACCENT }}>Fortsetzen</button>
                      <button onClick={() => { deletePuzzleSave(save.id); window.location.reload(); }} style={{ padding: "8px 10px", background: "var(--danger)22", border: "1px solid var(--danger)55", borderRadius: 8, cursor: "pointer", fontSize: 13, color: "var(--danger)" }}>✕</button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Saved puzzle games */}
            {gameMode !== "online" && saves.length > 0 && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Gespeicherte Rätsel</div>
                {saves.map(save => (
                  <div key={save.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
                        {PUZZLE_DIFFICULTY_LABELS[save.difficulty as KriegDifficulty]} · {GRID_SIZES[save.difficulty as KriegDifficulty]}×{GRID_SIZES[save.difficulty as KriegDifficulty]}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{formatElapsed(save.elapsedSeconds)} gespielt</div>
                    </div>
                    <button onClick={() => resumeSave(save)} style={{ padding: "8px 14px", background: ACCENT + "22", border: `1px solid ${ACCENT}55`, borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700, color: ACCENT }}>Fortsetzen</button>
                    <button onClick={() => { deletePuzzleSave(save.id); window.location.reload(); }} style={{ padding: "8px 10px", background: "var(--danger)22", border: "1px solid var(--danger)55", borderRadius: 8, cursor: "pointer", fontSize: 13, color: "var(--danger)" }}>✕</button>
                  </div>
                ))}
              </div>
            )}

            {/* Puzzle options */}
            {gameMode === "puzzle" && (
              <>
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.55 }}>
                  <strong style={{ color: "var(--text)" }}>Schlachtschiff-Rätsel:</strong> Zahlen am Rand zeigen die Anzahl der Schiffsfelder. Tippe Felder an, um sie als Schiff oder Wasser zu markieren.
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Schwierigkeit</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {PUZZLE_DIFFICULTIES.map(d => (
                      <button
                        key={d}
                        onClick={() => setPuzzleDiff(d)}
                        style={{
                          padding: "12px 16px", textAlign: "left",
                          background: puzzleDiff === d ? ACCENT + "22" : "var(--surface)",
                          border: `1.5px solid ${puzzleDiff === d ? ACCENT : "var(--border)"}`,
                          borderRadius: 12, cursor: "pointer",
                          display: "flex", alignItems: "center", gap: 10,
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: puzzleDiff === d ? ACCENT : "var(--text)" }}>{PUZZLE_DIFFICULTY_LABELS[d]}</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                            {GRID_SIZES[d]}×{GRID_SIZES[d]} · Flotte: {fleetLabel(FLEET[d])}
                          </div>
                        </div>
                        {puzzleDiff === d && <span style={{ color: ACCENT, fontSize: 18 }}>✓</span>}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={startPuzzle}
                  style={{ padding: "16px", background: ACCENT, border: "none", borderRadius: 14, cursor: "pointer", fontSize: 16, fontWeight: 800, color: "#0a1628" }}
                >
                  Neues Rätsel
                </button>
              </>
            )}

            {/* KI options */}
            {gameMode === "ki" && (
              <>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>KI-Schwierigkeit</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {AI_MODES.map(m => (
                      <button
                        key={m.id}
                        onClick={() => setAiMode(m.id)}
                        style={{
                          padding: "14px 16px", textAlign: "left",
                          background: aiMode === m.id ? ACCENT + "22" : "var(--surface)",
                          border: `1.5px solid ${aiMode === m.id ? ACCENT : "var(--border)"}`,
                          borderRadius: 12, cursor: "pointer",
                          display: "flex", alignItems: "center", gap: 12,
                        }}
                      >
                        <span style={{ fontSize: 22 }}>{m.emoji}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: aiMode === m.id ? ACCENT : "var(--text)" }}>{m.label}</div>
                          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{m.desc}</div>
                        </div>
                        {aiMode === m.id && <span style={{ color: ACCENT, fontSize: 18 }}>✓</span>}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={startKI}
                  style={{ padding: "16px", background: ACCENT, border: "none", borderRadius: 14, cursor: "pointer", fontSize: 16, fontWeight: 800, color: "#0a1628" }}
                >
                  Schiffe setzen →
                </button>
              </>
            )}

            {/* Online options */}
            {gameMode === "online" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {error && (
                  <div style={{ background: "var(--danger)22", border: "1px solid var(--danger)55", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "var(--danger)" }}>{error}</div>
                )}
                <button
                  onClick={createOnlineGame}
                  disabled={creating}
                  style={{ padding: "16px", background: creating ? ACCENT + "66" : ACCENT, border: "none", borderRadius: 14, cursor: creating ? "default" : "pointer", fontSize: 16, fontWeight: 800, color: "#0a1628", opacity: creating ? 0.7 : 1 }}
                >
                  {creating ? "Spiel wird erstellt…" : "Neues Spiel erstellen"}
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Oder Code eingeben</span>
                  <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={joinInput}
                    onChange={e => { setJoinInput(e.target.value.toUpperCase().slice(0, 6)); setError(""); }}
                    placeholder="ABCD12"
                    maxLength={6}
                    style={{ flex: 1, padding: "12px 14px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 16, fontFamily: "monospace", fontWeight: 700, color: "var(--text)", letterSpacing: 2, outline: "none" }}
                  />
                  <button
                    onClick={() => joinExistingGame(joinInput.trim())}
                    disabled={joinInput.trim().length < 4}
                    style={{ padding: "12px 18px", background: joinInput.trim().length >= 4 ? "var(--surface2)" : "var(--surface)", border: `1px solid ${joinInput.trim().length >= 4 ? ACCENT : "var(--border)"}`, borderRadius: 12, cursor: joinInput.trim().length >= 4 ? "pointer" : "default", fontSize: 14, fontWeight: 800, color: joinInput.trim().length >= 4 ? ACCENT : "var(--text-muted)" }}
                  >
                    Beitreten
                  </button>
                </div>
              </div>
            )}

          </>
        )}
      </div>

      {showStats && (
        <div style={overlayStyle} onClick={() => { setShowStats(false); setStatsTab(0); }}>
          <div style={{ ...dialogStyle, maxHeight: "80vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: "var(--text)" }}>🏆 Statistik</span>
              <button onClick={() => { setShowStats(false); setStatsTab(0); }} style={closeBtnStyle}>✕</button>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", background: "var(--surface2)", borderRadius: 8, marginBottom: 16, overflow: "hidden" }}>
              {["Bestzeiten", "Online Duelle"].map((label, i) => (
                <button key={i} onClick={() => setStatsTab(i)} style={{
                  flex: 1, padding: "8px 0", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700,
                  background: statsTab === i ? ACCENT : "transparent",
                  color: statsTab === i ? "#0a1628" : "var(--text-muted)",
                  borderRadius: statsTab === i ? 8 : 0,
                }}>{label}</button>
              ))}
            </div>

            {statsTab === 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {(["leicht", "mittel", "schwer", "experte"] as const).map(d => {
                  const best = getBestTimeAny("kuestenkrieg", d);
                  return (
                    <div key={d} style={{ background: "var(--surface2)", borderRadius: 12, padding: "14px 12px", textAlign: "center" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase" }}>{PUZZLE_DIFFICULTY_LABELS[d]}</div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: best ? ACCENT : "var(--text-muted)" }}>{best ? formatElapsed(best) : "—"}</div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>Bestzeit</div>
                    </div>
                  );
                })}
              </div>
            )}

            {statsTab === 1 && (
              loadingOnline ? (
                <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)", fontSize: 13 }}>Lade…</div>
              ) : onlineResultItems.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)", fontSize: 13 }}>Noch keine Online-Duelle gespielt.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {onlineResultItems.map(item => (
                    <div key={item.opponentId} style={{ background: "var(--surface2)", borderRadius: 12, padding: "14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{item.constellationTitle}</span>
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{item.totalGames} Spiele</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 18 }}>{item.myWins >= item.theirWins ? "🥇" : "🥈"}</span>
                        <span style={{ fontSize: 15, fontWeight: 800, color: item.myWins > item.theirWins ? ACCENT : "var(--text-sub)" }}>Du: {item.myWins}</span>
                        <span style={{ color: "var(--text-muted)" }}>·</span>
                        <span style={{ fontSize: 18 }}>{item.opponentAvatar}</span>
                        <span style={{ fontSize: 15, fontWeight: 800, color: item.theirWins > item.myWins ? ACCENT : "var(--text-sub)" }}>{item.opponentName}: {item.theirWins}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        Letztes: {item.lastWinnerId === uid ? "Du" : item.opponentName} gewonnen · {formatGameDate(item.lastGameAt)}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      )}
      {showRules && GAME_RULES["kuestenkrieg"] && (
        <GameRulesModal rule={GAME_RULES["kuestenkrieg"]} onClose={() => setShowRules(false)} />
      )}
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 100, padding: 20,
};
const dialogStyle: React.CSSProperties = {
  background: "var(--surface)", border: "1px solid var(--border)",
  borderRadius: 20, padding: 24, width: "100%", maxWidth: 360,
};
const closeBtnStyle: React.CSSProperties = {
  background: "var(--surface2)", border: "1px solid var(--border)",
  borderRadius: 8, width: 32, height: 32, cursor: "pointer",
  color: "var(--text-muted)", fontSize: 14,
  display: "flex", alignItems: "center", justifyContent: "center",
};

