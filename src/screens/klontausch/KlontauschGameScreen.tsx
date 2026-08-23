import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase";
import {
  dealGame, executeNehmen, hasWon,
  fromFirestoreDoc, playerStateToFirestore, offerToFirestore,
  EMPTY_OFFER,
} from "./klontauschLogic";
import type { KlonGameState, KlonCard, KlonPart } from "./klontauschLogic";
import { klonCharacterById } from "./klontauschCharacterLibrary";
import { KlontauschCharacterPart, KlontauschSilhouette } from "./KlontauschCharacterPart";
import { GameHudBar, GameSaveQuitDialog } from "../../components/GameHudBar";
import GameRulesModal from "../../components/GameRulesModal";
import { GAME_RULES } from "../../gameRules";
import { getGameSave, saveGame, deleteGameSave, generateGameSaveId } from "../../gameSave";
import { audioManager } from "../../audio/AudioManager";

const KT_COLOR  = "#8B5CF6";
const KT_DIM    = "rgba(139,92,246,0.12)";
const OCEAN_BLUE = "#0ea5e9";
const OCEAN_DIM  = "rgba(14,165,233,0.10)";

const AI_AVATARS = ["🤖", "🦀", "🐟", "🦈", "🐬"];
const AI_NAMES   = ["Möwe", "Krabbe", "Fisch", "Hai", "Delfin"];

type KlonEventType = "SWAP" | "STOLEN" | "COMPLETE";
interface KlonEvent { text: string; type: KlonEventType; }

function checkWin(state: KlonGameState, allTargets: Record<string, string[]>): string | null {
  for (const uid of state.playerIds) {
    const player = state.players[uid];
    const targets = allTargets[uid] ?? [];
    if (player && targets.length > 0 && hasWon(player, targets)) return uid;
  }
  return null;
}

// ── KlonPartSlot ──────────────────────────────────────────────────────────────

function KlonPartSlot({
  characterId, part, owned, fillCard,
}: {
  characterId: string;
  part: KlonPart;
  owned: boolean;
  fillCard: KlonCard | null;
}) {
  const borderColor = owned
    ? `${KT_COLOR}99`
    : fillCard ? "#3A507066" : "#1E2D4544";
  return (
    <div style={{
      flex: 1, minHeight: 0,
      border: `0.5px solid ${borderColor}`,
      overflow: "hidden", position: "relative",
    }}>
      {owned ? (
        <KlontauschCharacterPart characterId={characterId} part={part} />
      ) : fillCard ? (
        <KlontauschCharacterPart
          characterId={fillCard.characterId}
          part={part}
          style={{ opacity: 0.35 }}
        />
      ) : (
        <KlontauschSilhouette />
      )}
    </div>
  );
}

// ── TargetPager ───────────────────────────────────────────────────────────────

function TargetPager({
  myTargets, humanHand,
}: {
  myTargets: string[];
  humanHand: KlonCard[];
}) {
  const [currentPage, setCurrentPage] = useState(0);
  const pagerRef = useRef<HTMLDivElement>(null);

  function handleScroll() {
    if (!pagerRef.current) return;
    const w = pagerRef.current.clientWidth;
    if (w > 0) setCurrentPage(Math.round(pagerRef.current.scrollLeft / w));
  }

  function goToPage(idx: number) {
    if (!pagerRef.current) return;
    const clamped = Math.max(0, Math.min(idx, myTargets.length - 1));
    pagerRef.current.scrollTo({ left: pagerRef.current.clientWidth * clamped, behavior: "smooth" });
  }

  const targetFillCards = useMemo(() => {
    const stockCards = humanHand.filter(c => !myTargets.includes(c.characterId));
    const result: Record<string, Partial<Record<KlonPart, KlonCard | null>>> = {};
    for (const charId of myTargets) {
      result[charId] = {};
      for (const part of ["KOPF", "KOERPER", "BEINE"] as KlonPart[]) {
        const owned = humanHand.some(c => c.characterId === charId && c.part === part);
        if (owned) {
          result[charId][part] = null;
        } else {
          const same = stockCards.filter(c => c.part === part);
          result[charId][part] = same.length > 0
            ? same[Math.floor(Math.random() * same.length)]
            : (stockCards.length > 0 ? stockCards[Math.floor(Math.random() * stockCards.length)] : null);
        }
      }
    }
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [humanHand.map(c => c.cardId).join(","), myTargets.join(",")]);

  if (myTargets.length === 0) {
    return (
      <div style={{ flex: "0 0 53%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Lade Zielfiguren…</div>
      </div>
    );
  }

  const arrowBtn: React.CSSProperties = {
    position: "absolute", top: "50%", transform: "translateY(-50%)",
    zIndex: 2, width: 28, height: 28, borderRadius: 14,
    background: "rgba(0,0,0,0.45)", border: `1px solid ${KT_COLOR}55`,
    color: "white", fontSize: 14, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    userSelect: "none",
  };

  return (
    <div style={{ flex: "0 0 53%", minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Slides + arrows */}
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        {myTargets.length > 1 && currentPage > 0 && (
          <button style={{ ...arrowBtn, left: 2 }} onClick={() => goToPage(currentPage - 1)}>‹</button>
        )}
        {myTargets.length > 1 && currentPage < myTargets.length - 1 && (
          <button style={{ ...arrowBtn, right: 2 }} onClick={() => goToPage(currentPage + 1)}>›</button>
        )}
      <div
        ref={pagerRef}
        onScroll={handleScroll}
        style={{
          height: "100%", display: "flex",
          overflowX: "auto", scrollSnapType: "x mandatory",
          scrollbarWidth: "none",
        }}
      >
        {myTargets.map((charId, idx) => {
          const ch       = klonCharacterById(charId);
          const hasKopf    = humanHand.some(c => c.characterId === charId && c.part === "KOPF");
          const hasKoerper = humanHand.some(c => c.characterId === charId && c.part === "KOERPER");
          const hasBeine   = humanHand.some(c => c.characterId === charId && c.part === "BEINE");
          const allDone    = hasKopf && hasKoerper && hasBeine;
          const fills      = targetFillCards[charId] ?? {};

          return (
            <div key={charId} style={{
              minWidth: "100%", scrollSnapAlign: "start", flexShrink: 0,
              padding: "4px 16px 0",
              display: "flex", flexDirection: "column",
            }}>
              <div style={{
                flex: 1, minHeight: 0,
                border: `1.5px solid ${allDone ? KT_COLOR : KT_COLOR + "55"}`,
                borderRadius: 12,
                background: allDone ? KT_DIM : "#0d1e3566",
                display: "flex", flexDirection: "column", overflow: "hidden",
                padding: "6px 12px",
              }}>
                {/* Label row */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {idx + 1} / {myTargets.length}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: allDone ? KT_COLOR : "white" }}>
                    {ch.name}
                  </span>
                  {allDone && <span style={{ fontSize: 13 }}>✅</span>}
                </div>
                {/* 3 part slots, centred at 70% width */}
                <div style={{ flex: 1, minHeight: 0, display: "flex", justifyContent: "center" }}>
                  <div style={{ width: "70%", display: "flex", flexDirection: "column" }}>
                    <KlonPartSlot characterId={charId} part="KOPF"    owned={hasKopf}    fillCard={fills["KOPF"]    ?? null} />
                    <KlonPartSlot characterId={charId} part="KOERPER" owned={hasKoerper} fillCard={fills["KOERPER"] ?? null} />
                    <KlonPartSlot characterId={charId} part="BEINE"   owned={hasBeine}   fillCard={fills["BEINE"]   ?? null} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      </div>{/* end relative wrapper */}

      {/* Pager dots */}
      <div style={{
        display: "flex", justifyContent: "center", alignItems: "center",
        gap: 4, height: 16, flexShrink: 0,
      }}>
        {myTargets.map((_, i) => (
          <div key={i} onClick={() => goToPage(i)} style={{
            width: i === currentPage ? 16 : 8, height: 8, borderRadius: 4,
            background: i === currentPage ? KT_COLOR : "#3A5070",
            cursor: "pointer", transition: "width 0.2s",
          }} />
        ))}
      </div>
    </div>
  );
}

// ── StockFigure ───────────────────────────────────────────────────────────────

function StockFigure({
  stockKopf, stockKoerper, stockBeine,
}: {
  stockKopf: KlonCard[];
  stockKoerper: KlonCard[];
  stockBeine: KlonCard[];
}) {
  const kopfRef    = useRef<HTMLDivElement>(null);
  const koerperRef = useRef<HTMLDivElement>(null);
  const beineRef   = useRef<HTMLDivElement>(null);
  const totalStock = stockKopf.length + stockKoerper.length + stockBeine.length;

  function scrollRandom(ref: React.RefObject<HTMLDivElement | null>, count: number) {
    if (!ref.current || count <= 1) return;
    const current = Math.round(ref.current.scrollLeft / (ref.current.clientWidth || 1));
    let next = Math.floor(Math.random() * count);
    if (next === current) next = (next + 1) % count;
    ref.current.scrollTo({ left: ref.current.clientWidth * next, behavior: "smooth" });
  }

  function shuffle() {
    scrollRandom(kopfRef, stockKopf.length);
    scrollRandom(koerperRef, stockKoerper.length);
    scrollRandom(beineRef, stockBeine.length);
  }

  const pagerStyle: React.CSSProperties = {
    flex: 1, minHeight: 0, display: "flex",
    overflowX: "auto", scrollSnapType: "x mandatory",
    scrollbarWidth: "none",
  };
  const slideStyle: React.CSSProperties = {
    minWidth: "100%", scrollSnapAlign: "start",
    flexShrink: 0, height: "100%",
  };

  return (
    <div style={{ flex: "0 0 47%", minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "4px 16px", flexShrink: 0, height: 36,
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-sub)" }}>
          Vorrat ({totalStock} Karten)
        </span>
        {totalStock > 1 && (
          <button onClick={shuffle} style={{
            width: 32, height: 32, borderRadius: 16,
            background: "var(--surface)", border: `1px solid ${OCEAN_BLUE}`,
            cursor: "pointer", fontSize: 16, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>🎲</button>
        )}
      </div>

      {totalStock === 0 ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, color: "var(--text-muted)", padding: "0 16px", textAlign: "center" }}>
          Alle Karten gehören zu deinen Zielfiguren.
        </div>
      ) : (
        <>
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: "0 28px" }}>
            {/* KOPF */}
            <div ref={kopfRef} style={pagerStyle}>
              {stockKopf.length > 0 ? stockKopf.map(c => (
                <div key={c.cardId} style={slideStyle}>
                  <KlontauschCharacterPart characterId={c.characterId} part="KOPF" />
                </div>
              )) : <div style={slideStyle}><KlontauschSilhouette /></div>}
            </div>
            {/* KOERPER */}
            <div ref={koerperRef} style={pagerStyle}>
              {stockKoerper.length > 0 ? stockKoerper.map(c => (
                <div key={c.cardId} style={slideStyle}>
                  <KlontauschCharacterPart characterId={c.characterId} part="KOERPER" />
                </div>
              )) : <div style={slideStyle}><KlontauschSilhouette /></div>}
            </div>
            {/* BEINE */}
            <div ref={beineRef} style={pagerStyle}>
              {stockBeine.length > 0 ? stockBeine.map(c => (
                <div key={c.cardId} style={slideStyle}>
                  <KlontauschCharacterPart characterId={c.characterId} part="BEINE" />
                </div>
              )) : <div style={slideStyle}><KlontauschSilhouette /></div>}
            </div>
          </div>

          {/* Part count row */}
          <div style={{
            display: "flex", justifyContent: "space-evenly",
            padding: "2px 0 4px", flexShrink: 0,
          }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{stockKopf.length} Kopf</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{stockKoerper.length} Körper</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{stockBeine.length} Beine</span>
          </div>
        </>
      )}
    </div>
  );
}

// ── GameOverOverlay ────────────────────────────────────────────────────────────

function GameOverOverlay({
  state, winnerId, humanUid, onResults, onHome, onLobby,
}: {
  state: KlonGameState;
  winnerId: string;
  humanUid: string;
  onResults: () => void;
  onHome: () => void;
  onLobby: () => void;
}) {
  const winner = state.players[winnerId];
  const iWon   = winnerId === humanUid;

  useEffect(() => {
    audioManager.playSound(iWon ? "level_complete" : "sp_gameover");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(10,22,40,0.93)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50,
    }}>
      <div className="card" style={{ width: "min(360px,92vw)", padding: 24, textAlign: "center" }}>
        <div style={{ fontSize: 64 }}>{iWon ? "🏆" : "🃏"}</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "white", marginTop: 8 }}>
          {iWon ? "Du gewinnst!" : `${winner?.displayName} gewinnt!`}
        </div>
        <div style={{ fontSize: 14, color: iWon ? "#22c55e" : "var(--text-sub)", marginTop: 4 }}>
          {iWon ? "Alle 3 Zielfiguren komplett!" : "Hat alle 3 Zielfiguren gesammelt."}
        </div>

        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 6 }}>
          {state.playerIds.map((pid, idx) => {
            const p = state.players[pid];
            const isWin = pid === winnerId;
            const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : "🦀";
            return (
              <div key={pid} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8,
                background: isWin ? KT_DIM : "rgba(255,255,255,0.04)",
                border: `1px solid ${isWin ? KT_COLOR + "44" : "var(--border)"}`,
              }}>
                <span style={{ fontSize: 16 }}>{medal}</span>
                <span style={{ fontSize: 20 }}>{p?.avatarUrl}</span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, textAlign: "left" }}>{p?.displayName}</span>
                <span style={{ fontSize: 12, color: isWin ? KT_COLOR : "var(--text-muted)" }}>
                  {isWin ? "🏆 Sieger" : `${p?.cardCount ?? 0} 🃏`}
                </span>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <button className="btn btn-outline" style={{ flex: 1 }} onClick={onHome}>🏠</button>
          <button className="btn btn-outline" style={{ flex: 1 }} onClick={onResults}>📊</button>
          <button className="btn" style={{ flex: 2, background: KT_COLOR, color: "white" }} onClick={onLobby}>Nochmal</button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function KlontauschGameScreen() {
  const navigate = useNavigate();
  const uid = auth.currentUser?.uid ?? "";

  const gameData = JSON.parse(sessionStorage.getItem("klontauschGame") ?? "{}") as {
    mode?: string; aiCount?: number; myName?: string; myAvatar?: string;
    gameId?: string; saveId?: string; difficulty?: string;
  };
  const mode   = gameData.mode ?? "ai";
  const gameId = gameData.gameId ?? "";
  const saveId = gameData.saveId ?? null;

  // ── Game state ──────────────────────────────────────────────────────────────
  const [local, setLocal]           = useState<KlonGameState | null>(null);
  const [allTargets, setAllTargets] = useState<Record<string, string[]>>({});
  const [myTargets, setMyTargets]   = useState<string[]>([]);
  const [online, setOnline]         = useState<KlonGameState | null>(null);
  const [paused, setPaused]         = useState(false);
  const [showQuit, setShowQuit]     = useState(false);
  const [showRules, setShowRules]   = useState(false);
  const [events, setEvents]         = useState<KlonEvent[]>([]);

  const aiTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevCardsRef  = useRef<KlonCard[]>([]);
  const prevCompleteRef = useRef<Set<string>>(new Set());

  // ── Audio ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    audioManager.startMusic("strandraeuber");
    return () => audioManager.stopMusic();
  }, []);

  // ── Init AI mode ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== "ai") return;

    if (saveId) {
      const save = getGameSave("klontausch");
      if (save && save.id === saveId) {
        try {
          const saved = JSON.parse(save.gameState) as {
            gameState: KlonGameState;
            allTargets: Record<string, string[]>;
          };
          setLocal(saved.gameState);
          setAllTargets(saved.allTargets);
          const hUid = saved.gameState.playerIds.find(
            id => !saved.gameState.players[id]?.isAI
          ) ?? (uid || "human");
          setMyTargets(saved.allTargets[hUid] ?? []);
        } catch { /* fall through */ }
        return;
      }
    }

    const aiCount  = gameData.aiCount ?? 2;
    const humanUid = uid || "human";
    const playerIds = [humanUid, ...Array.from({ length: aiCount }, (_, i) => `ai_${i}`)];

    const playerMap: Record<string, import("./klontauschLogic").KlonPlayerState> = {};
    playerIds.forEach((pid, i) => {
      playerMap[pid] = {
        userId:      pid,
        displayName: i === 0 ? (gameData.myName ?? "Du") : (AI_NAMES[i - 1] ?? `KI ${i}`),
        avatarUrl:   i === 0 ? (gameData.myAvatar ?? "👤") : (AI_AVATARS[i - 1] ?? "🤖"),
        heldCards: [], cardCount: 0, isAI: i > 0, isEliminated: false,
      };
    });

    const { players, targets } = dealGame(playerMap, playerIds);
    const initState: KlonGameState = {
      players, playerIds,
      turnIndex: 0, offer: EMPTY_OFFER,
      status: "PLAYING", winnerId: "", adminId: humanUid,
    };

    setLocal(initState);
    setAllTargets(targets);
    setMyTargets(targets[humanUid] ?? []);
    audioManager.playSound("card_deal");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Init online mode ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== "online" || !gameId || !uid) return;

    getDoc(doc(db, "klontauschGames", gameId, "private", uid)).then(snap => {
      if (snap.exists()) setMyTargets(snap.data().targetCharacterIds ?? []);
    });

    const unsub = onSnapshot(doc(db, "klontauschGames", gameId), snap => {
      if (!snap.exists()) return;
      const g = fromFirestoreDoc(snap.data());
      setOnline(g);
      if (g.status === "FINISHED" && g.winnerId) {
        const winner = g.players[g.winnerId];
        sessionStorage.setItem("klontauschResult", JSON.stringify({
          winnerId: g.winnerId,
          winnerName: winner?.displayName ?? "?",
          winnerAvatar: winner?.avatarUrl ?? "🏆",
          players: g.playerIds.map(pid => ({
            userId: pid,
            displayName: g.players[pid]?.displayName ?? pid,
            avatarUrl:   g.players[pid]?.avatarUrl   ?? "👤",
            cardCount:   g.players[pid]?.cardCount   ?? 0,
          })),
        }));
        navigate("/klontausch/results", { replace: true });
      }
    });
    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, gameId, uid]);

  const gs = mode === "ai" ? local : online;

  // ── Derived state ────────────────────────────────────────────────────────────
  const humanUid = mode === "ai"
    ? (local?.playerIds.find(id => !local?.players[id]?.isAI) ?? uid ?? "human")
    : uid;

  const humanHand   = gs?.players[humanUid]?.heldCards ?? [];
  const stockKopf    = humanHand.filter(c => !myTargets.includes(c.characterId) && c.part === "KOPF");
  const stockKoerper = humanHand.filter(c => !myTargets.includes(c.characterId) && c.part === "KOERPER");
  const stockBeine   = humanHand.filter(c => !myTargets.includes(c.characterId) && c.part === "BEINE");

  // ── AI loop ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== "ai" || !local || local.status !== "PLAYING" || paused) return;

    const state      = local;
    const currentUid = state.playerIds[state.turnIndex % state.playerIds.length];
    if (!state.players[currentUid]?.isAI) return;

    aiTimerRef.current = setTimeout(() => {
      setLocal(prev => {
        if (!prev || prev.status !== "PLAYING") return prev;
        const cur = prev.playerIds[prev.turnIndex % prev.playerIds.length];
        if (!prev.players[cur]?.isAI) return prev;
        const others = prev.playerIds.filter(pid => pid !== cur);
        const targetUid = others[Math.floor(Math.random() * others.length)];
        const nextState = executeNehmen(prev, cur, targetUid);
        const winner = checkWin(nextState, allTargets);
        if (winner) {
          finishGame(nextState, winner);
          return { ...nextState, status: "FINISHED", winnerId: winner };
        }
        return nextState;
      });
    }, 1200);
    return () => { if (aiTimerRef.current) clearTimeout(aiTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local?.turnIndex, local?.status, paused]);

  // ── Card change detector (event log) ─────────────────────────────────────────
  const handKey = humanHand.map(c => c.cardId).join(",");

  useEffect(() => {
    if (!gs || gs.status !== "PLAYING") return;
    const prev = prevCardsRef.current;
    if (prev.length === 0 && humanHand.length > 0) {
      prevCardsRef.current = [...humanHand];
      return;
    }
    const gained = humanHand.filter(c => !prev.some(p => p.cardId === c.cardId));
    const lost   = prev.filter(p => !humanHand.some(c => c.cardId === p.cardId));

    let newEvent: KlonEvent | null = null;
    if (gained.length > 0 && lost.length > 0) {
      const g = gained[0]; const l = lost[0];
      const gCh = klonCharacterById(g.characterId);
      const lCh = klonCharacterById(l.characterId);
      newEvent = {
        text: `🔄 +${gCh.name} (${g.part})${myTargets.includes(g.characterId) ? " ⭐" : ""}  /  −${lCh.name} (${l.part})${myTargets.includes(l.characterId) ? " 😱" : ""}`,
        type: "SWAP",
      };
    } else if (gained.length > 0) {
      const g = gained[0];
      const gCh = klonCharacterById(g.characterId);
      newEvent = {
        text: myTargets.includes(g.characterId)
          ? `📥 ${gCh.name} (${g.part}) gemopst – Zielfigur! ⭐`
          : `📥 ${gCh.name} (${g.part}) gemopst`,
        type: "SWAP",
      };
      if (myTargets.includes(g.characterId)) audioManager.playSound("card_place");
    } else if (lost.length > 0) {
      const l = lost[0];
      const lCh = klonCharacterById(l.characterId);
      newEvent = {
        text: myTargets.includes(l.characterId)
          ? `😱 Zielkarte ${lCh.name} (${l.part}) wurde gemopst!`
          : `😱 ${lCh.name} (${l.part}) wurde gemopst`,
        type: "STOLEN",
      };
    }
    if (newEvent) setEvents(ev => [newEvent!, ...ev.slice(0, 2)]);

    const nowComplete = new Set(
      myTargets.filter(charId =>
        ["KOPF", "KOERPER", "BEINE"].every(p =>
          humanHand.some(c => c.characterId === charId && c.part === p)
        )
      )
    );
    for (const charId of nowComplete) {
      if (!prevCompleteRef.current.has(charId)) {
        const ch = klonCharacterById(charId);
        setEvents(ev => [{ text: `🏆 ${ch.name} ist komplett!`, type: "COMPLETE" }, ...ev.slice(0, 2)]);
        audioManager.playSound("card_place");
      }
    }
    prevCompleteRef.current = nowComplete;
    prevCardsRef.current = [...humanHand];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handKey]);

  // ── finishGame ───────────────────────────────────────────────────────────────
  function finishGame(state: KlonGameState, winnerId: string) {
    const winner = state.players[winnerId];
    sessionStorage.setItem("klontauschResult", JSON.stringify({
      winnerId,
      winnerName:  winner?.displayName ?? "?",
      winnerAvatar: winner?.avatarUrl ?? "🏆",
      players: state.playerIds.map(pid => ({
        userId: pid,
        displayName: state.players[pid]?.displayName ?? pid,
        avatarUrl:   state.players[pid]?.avatarUrl   ?? "👤",
        cardCount:   state.players[pid]?.cardCount   ?? 0,
      })),
      targets: allTargets,
    }));
  }

  // ── Human: Mopsen ────────────────────────────────────────────────────────────
  const handleMopsen = useCallback((targetUid: string) => {
    if (!local || local.status !== "PLAYING") return;
    const cur = local.playerIds[local.turnIndex % local.playerIds.length];
    if (cur !== humanUid) return;
    audioManager.playSound("card_draw");
    setLocal(prev => {
      if (!prev) return prev;
      const next = executeNehmen(prev, humanUid, targetUid);
      const winner = checkWin(next, allTargets);
      if (winner) { finishGame(next, winner); return { ...next, status: "FINISHED", winnerId: winner }; }
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local, humanUid, allTargets]);

  // ── Online: Mopsen ────────────────────────────────────────────────────────────
  async function onlineMopsen(targetUid: string) {
    if (!online || !gameId) return;
    const cur = online.playerIds[online.turnIndex % online.playerIds.length];
    if (cur !== uid) return;
    const next = executeNehmen(online, uid, targetUid);
    const winner = checkWin(next, { [uid]: myTargets });
    await updateDoc(doc(db, "klontauschGames", gameId), {
      players: Object.fromEntries(
        Object.entries(next.players).map(([k, v]) => [k, playerStateToFirestore(v)])
      ),
      turnIndex: next.turnIndex,
      offer: offerToFirestore(next.offer),
      ...(winner ? { status: "FINISHED", winnerId: winner } : {}),
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  if (!gs) {
    return (
      <div style={{
        height: "100dvh", display: "flex", alignItems: "center",
        justifyContent: "center", background: "#0a1628",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48 }}>🃏</div>
          <div style={{ marginTop: 12, color: "var(--text-sub)" }}>Wird geladen…</div>
        </div>
      </div>
    );
  }

  const state          = gs;
  const currentTurnUid = state.playerIds[state.turnIndex % state.playerIds.length];
  const isMyTurn       = currentTurnUid === humanUid;
  const isGameOver     = state.status === "FINISHED";
  const latestEvent    = events[0] ?? null;
  const eventColor     = latestEvent?.type === "SWAP"
    ? "#22c55e"
    : latestEvent?.type === "STOLEN" ? "#ef4444" : "#f59e0b";

  return (
    <div style={{
      height: "100dvh", background: "#0a1628",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>

      {/* ── Header ── */}
      <GameHudBar
        paused={paused}
        onPauseToggle={() => setPaused(p => !p)}
        onQuit={() => setShowQuit(true)}
        onShowRules={() => setShowRules(true)}
      >
        <span style={{ fontSize: 18 }}>🃏</span>
        <div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: 1 }}>KLONTAUSCH</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: isGameOver ? "var(--accent)" : isMyTurn ? KT_COLOR : "var(--text)" }}>
            {isGameOver
              ? `${state.players[state.winnerId]?.displayName} gewinnt!`
              : isMyTurn
                ? "Dein Zug"
                : `${state.players[currentTurnUid]?.displayName} ist dran`}
          </div>
        </div>
      </GameHudBar>

      {paused ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontSize: 20, color: "var(--text-sub)" }}>Pause</div>
        </div>
      ) : (
        <>
          {/* ── Player Strip ── */}
          <div style={{
            display: "flex", padding: "4px 6px", gap: 2, flexShrink: 0,
            borderBottom: "1px solid var(--border)",
          }}>
            {state.playerIds.map(pid => {
              const p       = state.players[pid];
              if (!p) return null;
              const isActive = pid === currentTurnUid;
              const canMopse = isMyTurn && pid !== humanUid;
              return (
                <div
                  key={pid}
                  onClick={canMopse
                    ? () => (mode === "ai" ? handleMopsen(pid) : onlineMopsen(pid))
                    : undefined}
                  style={{
                    flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
                    padding: "4px 3px", borderRadius: 10, position: "relative",
                    background: canMopse ? OCEAN_DIM : "transparent",
                    border: `1px solid ${canMopse ? OCEAN_BLUE + "77" : "transparent"}`,
                    cursor: canMopse ? "pointer" : "default",
                    userSelect: "none",
                  }}
                >
                  {isActive && (
                    <div style={{
                      position: "absolute", top: 3, right: 3,
                      width: 7, height: 7, borderRadius: 4, background: KT_COLOR,
                    }} />
                  )}
                  <span style={{ fontSize: 20 }}>{p.avatarUrl}</span>
                  <span style={{
                    fontSize: 10, fontWeight: isActive || canMopse ? 700 : 400,
                    color: isActive ? KT_COLOR : canMopse ? OCEAN_BLUE : "var(--text-muted)",
                    maxWidth: 56, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    lineHeight: 1.2,
                  }}>
                    {pid === humanUid ? "Du" : p.displayName.slice(0, 7)}
                  </span>
                  <span style={{
                    fontSize: 10,
                    color: canMopse ? `${OCEAN_BLUE}cc` : "var(--text-muted)",
                  }}>
                    {p.cardCount} 🃏
                  </span>
                </div>
              );
            })}
          </div>

          {/* ── Event Log ── */}
          <div style={{
            height: 26, display: "flex", alignItems: "center",
            padding: "0 12px", flexShrink: 0,
            background: latestEvent ? "rgba(255,255,255,0.025)" : "transparent",
            borderBottom: "1px solid var(--border)",
          }}>
            {latestEvent && (
              <span style={{
                fontSize: 11, color: eventColor,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {latestEvent.text}
              </span>
            )}
          </div>

          {/* ── Main Area: Target Pager + Stock Figure ── */}
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            <TargetPager myTargets={myTargets} humanHand={humanHand} />
            <div style={{ height: 1, background: "var(--border)", flexShrink: 0 }} />
            <StockFigure
              stockKopf={stockKopf}
              stockKoerper={stockKoerper}
              stockBeine={stockBeine}
            />
          </div>

          {/* ── Bottom Action Bar ── */}
          <div style={{
            height: 42, display: "flex", alignItems: "center", justifyContent: "center",
            padding: "0 16px", flexShrink: 0,
            background: "var(--surface)", borderTop: "1px solid var(--border)",
          }}>
            {isGameOver ? (
              <span style={{ fontSize: 12, color: "#f59e0b", fontWeight: 700 }}>
                Spiel beendet
              </span>
            ) : isMyTurn ? (
              <span style={{ fontSize: 13, fontWeight: 600, color: KT_COLOR, textAlign: "center" }}>
                Dein Zug – tippe auf einen Mitspieler zum Mopsen
              </span>
            ) : (
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                ⏳ {state.players[currentTurnUid]?.displayName} überlegt…
              </span>
            )}
          </div>
        </>
      )}

      {/* ── Game Over Overlay ── */}
      {isGameOver && (
        <GameOverOverlay
          state={state}
          winnerId={state.winnerId}
          humanUid={humanUid}
          onResults={() => navigate("/klontausch/results", { replace: true })}
          onHome={() => navigate("/home", { replace: true })}
          onLobby={() => navigate("/klontausch/lobby", { replace: true })}
        />
      )}

      {showRules && GAME_RULES["klontausch"] && (
        <GameRulesModal rule={GAME_RULES["klontausch"]} onClose={() => setShowRules(false)} />
      )}

      {/* ── Quit dialog ── */}
      {showQuit && (
        <GameSaveQuitDialog
          emoji="🃏"
          message={`${state.playerIds.length} Spieler · ${humanHand.length} Karten`}
          onContinue={() => setShowQuit(false)}
          onSaveAndQuit={() => {
            if (mode === "ai" && local) {
              saveGame({
                id: saveId ?? generateGameSaveId(),
                gameType: "klontausch",
                difficulty: gameData.difficulty ?? "",
                gameState: JSON.stringify({ gameState: local, allTargets, aiCount: gameData.aiCount ?? 2 }),
                displayLabel: `${local.playerIds.length} Spieler · Zug ${local.turnIndex + 1}`,
                savedAt: Date.now(),
              });
            }
            navigate("/klontausch/lobby", { replace: true });
          }}
          onQuitWithoutSave={() => {
            deleteGameSave("klontausch");
            navigate("/klontausch/lobby", { replace: true });
          }}
          hideSave={mode !== "ai"}
        />
      )}
    </div>
  );
}
