import { useCallback, useEffect, useRef, useState } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase";
import type { SpCard, SpOnlineGame, SpOnlinePlayer } from "../../types";
import {
  dealCards, discardPairs, shuffleArray,
  PAIR_COLORS, AI_NAMES, AI_AVATARS,
} from "./strandraeuberLogic";
import type { SpDifficulty } from "./strandraeuberLogic";
import { audioManager } from "../../audio/AudioManager";
import { getGameSave, saveGame, deleteGameSave, generateGameSaveId } from "../../gameSave";
import { GameSaveQuitDialog } from "../../components/GameHudBar";

const SP_COLOR = "#e11d48";
const SP_DIM   = "rgba(225,29,72,0.12)";

// ── Local player type ─────────────────────────────────────────────────────────

interface SpPlayerLocal {
  userId: string;
  displayName: string;
  avatarUrl: string;
  hand: SpCard[];
  isAI: boolean;
}

interface SpGameStateLocal {
  players: SpPlayerLocal[];
  /** Indices into players[] that are still active. */
  activePlayerIndices: number[];
  /** Index into activePlayerIndices for the current drawer. */
  turnIndex: number;
  phase: "PLAYING" | "PAIR_REVEAL" | "ROUND_END" | "GAME_OVER";
  /** Pairs just discarded, shown briefly before clearing. */
  pairRevealInfo: { playerIdx: number; pairs: [SpCard, SpCard][] } | null;
  /** All pairs discarded so far this round (accumulated). */
  discardedPairs: [SpCard, SpCard][];
  roundScores: Record<string, number>; // userId → Strandräuber points
  loserUserId: string | null;
  roundNumber: number;
  totalRounds: number;
  lastActionText: string;
}

// ── OpponentFan ───────────────────────────────────────────────────────────────

function OpponentFan({
  player, cardCount, isTarget, isDrawer, isOut,
  selectedCardIndex, onCardSelected,
}: {
  player: SpPlayerLocal | { displayName: string; avatarUrl: string; userId: string };
  cardCount: number;
  isTarget: boolean;
  isDrawer: boolean;
  isOut: boolean;
  selectedCardIndex: number | null;
  onCardSelected: (i: number) => void;
}) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      minWidth: 80, flex: "1 1 auto",
      opacity: isOut ? 0.45 : 1,
      transition: "opacity 0.3s",
    }}>
      {/* Avatar + name */}
      <div style={{ fontSize: 22, marginBottom: 2 }}>{player.avatarUrl}</div>
      <div style={{
        fontSize: 11, fontWeight: isDrawer ? 700 : 400,
        color: isDrawer ? SP_COLOR : "var(--text-sub)",
        maxWidth: 90, textAlign: "center", overflow: "hidden",
        textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {player.displayName}{isDrawer ? " 🎯" : ""}
      </div>

      {/* Cards row */}
      {isOut ? (
        <div style={{ marginTop: 8, fontSize: 20 }}>✅</div>
      ) : (
        <div style={{
          display: "flex", flexWrap: "wrap", gap: 4,
          justifyContent: "center", marginTop: 6,
        }}>
          {Array.from({ length: cardCount }).map((_, i) => {
            const isSelected = selectedCardIndex === i;
            return (
              <div
                key={i}
                onClick={() => isTarget && onCardSelected(i)}
                style={{
                  width: 34, height: 50,
                  background: "linear-gradient(135deg, #1a3a6b, #0d2040)",
                  border: isSelected
                    ? "2px solid gold"
                    : isTarget
                      ? `1.5px solid ${SP_COLOR}88`
                      : "1.5px solid rgba(255,255,255,0.18)",
                  borderRadius: 5,
                  cursor: isTarget ? "pointer" : "default",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14,
                  transition: "transform 0.15s, border 0.15s, box-shadow 0.15s",
                  transform: isSelected ? "translateY(-8px)" : "none",
                  boxShadow: isTarget
                    ? `0 0 6px ${SP_COLOR}44`
                    : "0 2px 4px rgba(0,0,0,0.4)",
                  flexShrink: 0,
                }}
              >
                <span style={{ opacity: 0.25 }}>🦹</span>
              </div>
            );
          })}
        </div>
      )}

      {!isOut && (
        <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
          {cardCount} Karte{cardCount !== 1 ? "n" : ""}
        </div>
      )}
    </div>
  );
}

// ── OwnCard ───────────────────────────────────────────────────────────────────

function OwnCard({ card, highlight, cardW = 54, cardH = 78 }: { card: SpCard; highlight: boolean; cardW?: number; cardH?: number }) {
  const isSR = card.pairId === "strandraeuber";
  const color = PAIR_COLORS[card.pairId] ?? "#666";
  return (
    <div style={{
      width: cardW, height: cardH, borderRadius: 8, flexShrink: 0,
      background: isSR
        ? `linear-gradient(135deg, #7a0f27, #e11d48)`
        : `linear-gradient(135deg, ${color}22, ${color}11)`,
      border: highlight
        ? "2px solid #22c55e"
        : isSR
          ? `2px solid ${SP_COLOR}`
          : `1.5px solid ${color}55`,
      boxShadow: isSR
        ? `0 0 10px ${SP_COLOR}88`
        : highlight
          ? "0 0 8px rgba(34,197,94,0.6)"
          : "0 2px 6px rgba(0,0,0,0.25)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: 2, userSelect: "none",
      transition: "box-shadow 0.3s, border 0.3s",
    }}>
      <div style={{ fontSize: cardW * 0.37, lineHeight: 1 }}>{card.emoji}</div>
      <div style={{
        fontSize: cardW * 0.15, fontWeight: 600, textAlign: "center",
        color: isSR ? "white" : color,
        maxWidth: cardW - 6, overflow: "hidden", textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}>{card.name}</div>
    </div>
  );
}

// ── Pure game logic ───────────────────────────────────────────────────────────

function applyDrawCard(
  state: SpGameStateLocal,
  targetPlayerIdx: number,
  cardIndex: number,
): SpGameStateLocal {
  const drawerActiveIdx   = state.turnIndex;
  const drawerPlayerIdx   = state.activePlayerIndices[drawerActiveIdx];
  const len               = state.activePlayerIndices.length;

  // Determine next turn's active index BEFORE removals
  const nextActiveIdx       = (drawerActiveIdx + 1) % len;
  const nextDrawerPlayerIdx = state.activePlayerIndices[nextActiveIdx];

  // Move card
  const targetHand = [...state.players[targetPlayerIdx].hand];
  if (cardIndex >= targetHand.length) return state;
  const [drawnCard] = targetHand.splice(cardIndex, 1);

  const rawDrawerHand = [...state.players[drawerPlayerIdx].hand, drawnCard];
  const { remaining: drawerHand, discarded } = discardPairs(rawDrawerHand);

  const updatedPlayers: SpPlayerLocal[] = state.players.map((p, i) => {
    if (i === targetPlayerIdx) return { ...p, hand: targetHand };
    if (i === drawerPlayerIdx) return { ...p, hand: drawerHand };
    return p;
  });

  // Remove players with 0 cards
  const newActive = state.activePlayerIndices.filter(
    (pi) => updatedPlayers[pi].hand.length > 0,
  );

  const newDiscardedPairs: [SpCard, SpCard][] = [
    ...state.discardedPairs,
    ...discarded,
  ];

  // Game over?
  if (newActive.length <= 1) {
    const loserIdx = newActive[0];
    const loserId  = loserIdx !== undefined ? updatedPlayers[loserIdx].userId : null;
    const newScores = { ...state.roundScores };
    if (loserId) newScores[loserId] = (newScores[loserId] ?? 0) + 1;
    const loserName = loserIdx !== undefined ? updatedPlayers[loserIdx].displayName : "?";
    return {
      ...state, players: updatedPlayers,
      activePlayerIndices: newActive,
      turnIndex: 0,
      phase: discarded.length > 0 ? "PAIR_REVEAL" : "GAME_OVER",
      pairRevealInfo: discarded.length > 0 ? { playerIdx: drawerPlayerIdx, pairs: discarded } : null,
      discardedPairs: newDiscardedPairs,
      roundScores: newScores,
      loserUserId: loserId,
      lastActionText: `${loserName} hält den Strandräuber! 🦹`,
    };
  }

  // Find new turnIndex
  let newTurnIndex = newActive.indexOf(nextDrawerPlayerIdx);
  if (newTurnIndex === -1) newTurnIndex = nextActiveIdx % newActive.length;

  const drawerName = updatedPlayers[drawerPlayerIdx].displayName;

  if (discarded.length > 0) {
    return {
      ...state, players: updatedPlayers,
      activePlayerIndices: newActive,
      turnIndex: newTurnIndex,
      phase: "PAIR_REVEAL",
      pairRevealInfo: { playerIdx: drawerPlayerIdx, pairs: discarded },
      discardedPairs: newDiscardedPairs,
      lastActionText: `${drawerName} legt ${discarded.length} Paar${discarded.length > 1 ? "e" : ""} ab!`,
    };
  }

  return {
    ...state, players: updatedPlayers,
    activePlayerIndices: newActive,
    turnIndex: newTurnIndex,
    phase: "PLAYING",
    pairRevealInfo: null,
    discardedPairs: newDiscardedPairs,
    lastActionText: `${drawerName} zieht eine Karte.`,
  };
}

function startNextRound(state: SpGameStateLocal): SpGameStateLocal {
  const playerCount = state.players.length;
  const hands = dealCards(playerCount);
  let initialPairs: [SpCard, SpCard][] = [];
  const updatedPlayers: SpPlayerLocal[] = state.players.map((p, i) => {
    const { remaining, discarded } = discardPairs(hands[i]);
    initialPairs = [...initialPairs, ...discarded];
    return { ...p, hand: remaining };
  });
  const newActive = updatedPlayers.map((_, i) => i).filter(i => updatedPlayers[i].hand.length > 0);
  const startTurnIdx = Math.min(1, newActive.length - 1);
  return {
    ...state,
    players: updatedPlayers,
    activePlayerIndices: newActive,
    turnIndex: startTurnIdx,
    phase: "PLAYING",
    pairRevealInfo: null,
    discardedPairs: initialPairs,
    loserUserId: null,
    roundNumber: state.roundNumber + 1,
    lastActionText: `Runde ${state.roundNumber + 1} beginnt!`,
  };
}

// ── Main component ────────────────────────────────────────────────────────────

export default function StrandraeuberGameScreen() {
  const navigate = useNavigate();
  const uid = auth.currentUser?.uid ?? "";

  const gameData = JSON.parse(sessionStorage.getItem("spGame") ?? "{}") as {
    mode?: string; aiCount?: number; difficulty?: SpDifficulty;
    totalRounds?: number; myName?: string; myAvatar?: string; gameId?: string; saveId?: string;
  };

  const mode        = gameData.mode ?? "ai";
  const difficulty  = gameData.difficulty ?? "SNIPER";
  const gameId      = gameData.gameId ?? "";
  const saveId      = gameData.saveId ?? null;

  // AI mode state
  const [local, setLocal] = useState<SpGameStateLocal | null>(null);
  const localRef = useRef<SpGameStateLocal | null>(null);
  useEffect(() => { localRef.current = local; }, [local]);

  // Online mode state
  const [online, setOnline] = useState<SpOnlineGame | null>(null);

  // UI state
  const [selectedFanIndex, setSelectedFanIndex] = useState<number | null>(null);
  const [showQuit, setShowQuit]   = useState(false);
  const aiTimeoutRef              = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pairRevealTimeoutRef      = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    audioManager.startMusic("strandraeuber");
    return () => audioManager.stopMusic();
  }, []);

  // ── Restore from save ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!saveId) return;
    const save = getGameSave("strandraeuber");
    if (!save || save.id !== saveId) return;
    try {
      const restored = JSON.parse(save.gameState) as SpGameStateLocal;
      setLocal({ ...restored, pairRevealInfo: null });
    } catch (_) {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Init AI mode ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== "ai" || saveId) return;
    const aiCount    = gameData.aiCount ?? 2;
    const totalRounds = gameData.totalRounds ?? 3;
    const myName     = gameData.myName ?? "Du";
    const myAvatar   = gameData.myAvatar ?? "👤";

    const playerCount = aiCount + 1;
    const hands = dealCards(playerCount);
    let initialPairs: [SpCard, SpCard][] = [];
    const players: SpPlayerLocal[] = Array.from({ length: playerCount }, (_, i) => {
      const { remaining, discarded } = discardPairs(hands[i]);
      initialPairs = [...initialPairs, ...discarded];
      return {
        userId:      i === 0 ? uid || "human" : `ai_${i - 1}`,
        displayName: i === 0 ? myName : AI_NAMES[i - 1] ?? `KI ${i}`,
        avatarUrl:   i === 0 ? myAvatar : AI_AVATARS[i - 1] ?? "🤖",
        hand:        remaining,
        isAI:        i > 0,
      };
    });
    const activePlayerIndices = players.map((_, i) => i).filter(i => players[i].hand.length > 0);
    const startTurnIdx = Math.min(1, activePlayerIndices.length - 1);
    setLocal({
      players, activePlayerIndices,
      turnIndex: startTurnIdx,
      phase: "PLAYING",
      pairRevealInfo: null,
      discardedPairs: initialPairs,
      roundScores: {},
      loserUserId: null,
      roundNumber: 1,
      totalRounds,
      lastActionText: "Runde 1 beginnt!",
    });
    audioManager.playSound("card_deal");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Init online mode ────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== "online" || !gameId) return;
    const unsub = onSnapshot(doc(db, "strandraeuberGames", gameId), (snap) => {
      if (!snap.exists()) return;
      setOnline({ gameId: snap.id, ...snap.data() } as SpOnlineGame);
    });
    return () => unsub();
  }, [mode, gameId]);

  // ── Pair reveal auto-continue ───────────────────────────────────────────────
  useEffect(() => {
    if (mode !== "ai" || !local) return;
    if (local.phase !== "PAIR_REVEAL") return;
    audioManager.playSound("pair_discard");
    pairRevealTimeoutRef.current = setTimeout(() => {
      setLocal((prev) => {
        if (!prev || prev.phase !== "PAIR_REVEAL") return prev;
        if (prev.loserUserId !== null) {
          return { ...prev, phase: "GAME_OVER", pairRevealInfo: null };
        }
        return { ...prev, phase: "PLAYING", pairRevealInfo: null };
      });
    }, 1500);
    return () => { if (pairRevealTimeoutRef.current) clearTimeout(pairRevealTimeoutRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local?.phase, local?.pairRevealInfo]);

  // ── AI turn trigger ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== "ai" || !local) return;
    if (local.phase !== "PLAYING") return;

    const drawerIdx    = local.activePlayerIndices[local.turnIndex];
    const drawerPlayer = local.players[drawerIdx];
    if (!drawerPlayer?.isAI) return;

    const len       = local.activePlayerIndices.length;
    const targetActiveIdx = (local.turnIndex - 1 + len) % len;
    const targetIdx  = local.activePlayerIndices[targetActiveIdx];
    const target     = local.players[targetIdx];
    if (!target || target.hand.length === 0) return;

    aiTimeoutRef.current = setTimeout(() => {
      const st = localRef.current;
      if (!st || st.phase !== "PLAYING") return;

      const curTarget    = st.players[st.activePlayerIndices[(st.turnIndex - 1 + st.activePlayerIndices.length) % st.activePlayerIndices.length]];

      // Shuffle target's hand?
      const shouldShuffle = difficulty === "BOSS_LEVEL" || (difficulty === "SNIPER" && Math.random() < 0.3);
      if (shouldShuffle && curTarget.hand.length > 1) {
        audioManager.playSound("card_shuffle");
        setLocal((s) => {
          if (!s) return s;
          const shuffledTargetHand = shuffleArray(curTarget.hand);
          const updPlayers = s.players.map((p, i) =>
            i === st.activePlayerIndices[(st.turnIndex - 1 + st.activePlayerIndices.length) % st.activePlayerIndices.length]
              ? { ...p, hand: shuffledTargetHand }
              : p,
          );
          return { ...s, players: updPlayers };
        });
      }

      // Pick card index (read from localRef to capture any shuffle that happened)
      let pickIdx = 0;
      if (difficulty !== "ROOKIE") {
        const latestTargetIdx = st.activePlayerIndices[(st.turnIndex - 1 + st.activePlayerIndices.length) % st.activePlayerIndices.length];
        const latestTargetHand = localRef.current?.players[latestTargetIdx]?.hand ?? curTarget.hand;
        pickIdx = Math.floor(Math.random() * Math.max(latestTargetHand.length, 1));
      }

      audioManager.playSound("card_draw");
      setLocal((s) => {
        if (!s) return s;
        const tgtActiveIdx = (s.turnIndex - 1 + s.activePlayerIndices.length) % s.activePlayerIndices.length;
        const tgtIdx = s.activePlayerIndices[tgtActiveIdx];
        const safeIdx = Math.min(pickIdx, Math.max(0, s.players[tgtIdx].hand.length - 1));
        return applyDrawCard(s, tgtIdx, safeIdx);
      });
    }, 1200);

    return () => { if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local?.turnIndex, local?.phase]);

  // ── Human draws a card (AI mode) ────────────────────────────────────────────
  const handleHumanDraw = useCallback((cardIndex: number) => {
    const st = localRef.current;
    if (!st || st.phase !== "PLAYING") return;
    const drawerIdx = st.activePlayerIndices[st.turnIndex];
    if (st.players[drawerIdx].userId !== (uid || "human")) return;

    const len           = st.activePlayerIndices.length;
    const targetActiveIdx = (st.turnIndex - 1 + len) % len;
    const targetIdx     = st.activePlayerIndices[targetActiveIdx];

    audioManager.playSound("card_draw");
    setSelectedFanIndex(null);
    setLocal((s) => s ? applyDrawCard(s, targetIdx, cardIndex) : s);
  }, [uid]);

  // ── Online: execute draw ─────────────────────────────────────────────────────
  const handleOnlineDraw = useCallback(async (cardIndex: number) => {
    if (!online || !gameId) return;
    if (online.phase !== "PLAYING") return;
    const len = online.activePlayerIds.length;
    if (len < 2) return;
    const drawerUid = online.activePlayerIds[online.turnIndex];
    if (drawerUid !== uid) return;
    const targetUid = online.activePlayerIds[(online.turnIndex - 1 + len) % len];

    const targetPlayer = online.players[targetUid];
    const drawerPlayer = online.players[drawerUid];
    if (!targetPlayer || cardIndex >= targetPlayer.hand.length) return;

    const targetHand = [...targetPlayer.hand];
    const [drawnCard] = targetHand.splice(cardIndex, 1);
    const rawDrawerHand = [...drawerPlayer.hand, drawnCard];
    const { remaining: drawerHand, discarded } = discardPairs(rawDrawerHand);

    const updatedPlayers: Record<string, SpOnlinePlayer> = {
      ...online.players,
      [targetUid]: { ...targetPlayer, hand: targetHand, cardCount: targetHand.length },
      [drawerUid]: { ...drawerPlayer, hand: drawerHand, cardCount: drawerHand.length },
    };

    const nextActiveIdx = (online.turnIndex + 1) % len;
    const nextDrawerUid = online.activePlayerIds[nextActiveIdx];

    const newActivePlayerIds = online.activePlayerIds.filter(
      (pid) => updatedPlayers[pid].cardCount > 0,
    );

    const isGameOver = newActivePlayerIds.length <= 1;
    const loserUid   = isGameOver && newActivePlayerIds.length === 1 ? newActivePlayerIds[0] : null;

    let newTurnIndex = newActivePlayerIds.indexOf(nextDrawerUid);
    if (newTurnIndex === -1) newTurnIndex = nextActiveIdx % Math.max(newActivePlayerIds.length, 1);

    const newScores = { ...online.scores };
    if (loserUid) newScores[loserUid] = (newScores[loserUid] ?? 0) + 1;

    const updateData: Record<string, unknown> = {
      players: updatedPlayers,
      activePlayerIds: newActivePlayerIds,
      turnIndex: newTurnIndex,
    };

    if (isGameOver) {
      const loserPlayer = loserUid ? online.players[loserUid] : null;
      updateData.phase     = "ROUND_END";
      updateData.loserId   = loserUid ?? null;
      updateData.loserName = loserPlayer?.displayName ?? null;
      updateData.loserAvatar = loserPlayer?.avatarUrl ?? null;
      updateData.scores    = newScores;
    } else {
      updateData.phase = discarded.length > 0 ? "PLAYING" : "PLAYING";
    }

    audioManager.playSound(discarded.length > 0 ? "pair_discard" : "card_draw");
    setSelectedFanIndex(null);
    await updateDoc(doc(db, "strandraeuberGames", gameId), updateData);
  }, [online, gameId, uid]);

  // ── Online: admin starts next round ─────────────────────────────────────────
  useEffect(() => {
    if (mode !== "online" || !online || !gameId) return;
    if (online.phase !== "ROUND_END") return;
    if (online.adminId !== uid) return;
    if (online.roundNumber >= online.totalRounds) return; // stay on ROUND_END, show final
    // After short delay, start next round
    const timer = setTimeout(async () => {
      const playerCount = online.playerIds.length;
      const hands = dealCards(playerCount);
      const updPlayers: Record<string, SpOnlinePlayer> = {};
      for (let i = 0; i < online.playerIds.length; i++) {
        const pid = online.playerIds[i];
        const { remaining } = discardPairs(hands[i]);
        updPlayers[pid] = { ...online.players[pid], hand: remaining, cardCount: remaining.length };
      }
      const newActive = online.playerIds.filter(pid => updPlayers[pid].cardCount > 0);
      await updateDoc(doc(db, "strandraeuberGames", gameId), {
        players: updPlayers,
        activePlayerIds: newActive,
        turnIndex: Math.min(1, newActive.length - 1),
        phase: "PLAYING",
        roundNumber: online.roundNumber + 1,
        loserId: null, loserName: null, loserAvatar: null,
      });
    }, 3000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online?.phase, online?.roundNumber]);

  // ── Derive display state ─────────────────────────────────────────────────────
  const gs = local; // Only AI mode fully rendered here; online uses its own path below

  if (mode === "online") {
    return <OnlineGameView
      online={online} uid={uid}
      selectedFanIndex={selectedFanIndex}
      setSelectedFanIndex={setSelectedFanIndex}
      onDraw={handleOnlineDraw}
      onQuit={() => navigate("/strandraeuber/lobby", { replace: true })}
    />;
  }

  if (!gs) {
    return (
      <div className="screen" style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ fontSize: 42 }}>🦹</div>
        <div style={{ marginTop: 12, color: "var(--text-sub)" }}>Wird geladen…</div>
      </div>
    );
  }

  // Human player
  const humanPlayerIdx  = gs.players.findIndex((p) => !p.isAI);
  const humanPlayer     = gs.players[humanPlayerIdx];
  const humanActivePos  = gs.activePlayerIndices.indexOf(humanPlayerIdx);
  const isHumansTurn    = humanActivePos !== -1 && gs.activePlayerIndices[gs.turnIndex] === humanPlayerIdx;

  // Current drawer
  const drawerIdx       = gs.activePlayerIndices[gs.turnIndex];
  const drawer          = gs.players[drawerIdx];

  // Target (who drawer draws from)
  const len             = gs.activePlayerIndices.length;
  const targetActivePos = (gs.turnIndex - 1 + len) % len;
  const targetIdx       = gs.activePlayerIndices[targetActivePos];

  // Is human the TARGET (needs to show shuffle button)
  const isHumanTarget   = humanActivePos !== -1 && targetIdx === humanPlayerIdx;

  const isTablet = window.innerWidth > 640;
  const ownCardW = isTablet ? 72 : 54;
  const ownCardH = isTablet ? 100 : 78;

  // Pair highlight ids
  const pairHighlightIds = new Set<string>();
  if (gs.pairRevealInfo?.playerIdx === humanPlayerIdx) {
    for (const [a, b] of gs.pairRevealInfo.pairs) {
      pairHighlightIds.add(a.id);
      pairHighlightIds.add(b.id);
    }
  }

  // Opponents (everyone except human)
  const opponents = gs.players
    .map((p, i) => ({ player: p, playerIdx: i }))
    .filter(({ playerIdx }) => playerIdx !== humanPlayerIdx);

  function handleShuffle() {
    if (!isHumanTarget || !isHumansTurn) return;
    audioManager.playSound("card_shuffle");
    setLocal((s) => {
      if (!s) return s;
      const shuffledHand = shuffleArray(humanPlayer.hand);
      return {
        ...s,
        players: s.players.map((p, i) => i === humanPlayerIdx ? { ...p, hand: shuffledHand } : p),
      };
    });
  }

  function handleContinueRound() {
    if (!local) return;
    if (local.roundNumber >= local.totalRounds) {
      // End of game series → results
      sessionStorage.setItem("spResult", JSON.stringify({
        players: local.players.map(p => ({
          userId: p.userId,
          displayName: p.displayName,
          avatarUrl: p.avatarUrl,
          score: local.roundScores[p.userId] ?? 0,
        })),
        totalRounds: local.totalRounds,
        loserUserId: Object.entries(local.roundScores).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
      }));
      navigate("/strandraeuber/results", { replace: true });
    } else {
      setLocal(startNextRound(local));
      audioManager.playSound("card_deal");
    }
  }

  return (
    <div style={{
      minHeight: "100dvh", background: "#0a1628",
      display: "flex", flexDirection: "column",
      gap: 0,
    }}>
      {/* ── Header ── */}
      <div style={{
        background: `linear-gradient(135deg, #7a0f27 0%, ${SP_COLOR} 100%)`,
        padding: "10px 14px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>🦹</span>
          <div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", letterSpacing: 1, textTransform: "uppercase" }}>Strandräuber</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "white" }}>
              Runde {gs.roundNumber}/{gs.totalRounds}
            </div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", flex: 1, textAlign: "center", padding: "0 8px" }}>
          {(gs.phase === "PLAYING" && drawer?.isAI)
            ? `${drawer?.displayName ?? "KI"} überlegt…`
            : gs.lastActionText}
        </div>
        <button onClick={() => setShowQuit(true)} style={{
          background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 6,
          width: 32, height: 32, fontSize: 16, cursor: "pointer", color: "white", flexShrink: 0,
        }}>✕</button>
      </div>

      {/* ── Opponents area (green table feel) ── */}
      <div style={{
        flex: 1, padding: "12px 10px",
        background: "linear-gradient(180deg, #0d2040 0%, #0a1628 100%)",
        display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", alignContent: "flex-start",
        minHeight: 160,
      }}>
        {opponents.map(({ player, playerIdx }) => {
          const isActive     = gs.activePlayerIndices.includes(playerIdx);
          const isTarget     = isActive && targetIdx === playerIdx && isHumansTurn && gs.phase === "PLAYING";
          const isDrawerOpp  = gs.activePlayerIndices[gs.turnIndex] === playerIdx;
          return (
            <OpponentFan
              key={player.userId}
              player={player}
              cardCount={player.hand.length}
              isTarget={isTarget}
              isDrawer={isDrawerOpp}
              isOut={!isActive}
              selectedCardIndex={isTarget ? selectedFanIndex : null}
              onCardSelected={(i) => {
                if (!isTarget) return;
                if (selectedFanIndex === i) {
                  // Second click on same card → draw
                  handleHumanDraw(i);
                  setSelectedFanIndex(null);
                } else {
                  // First click → mark/select
                  setSelectedFanIndex(i);
                }
              }}
            />
          );
        })}
      </div>

      {/* ── Status bar ── */}
      <div style={{
        padding: "8px 16px", background: "var(--surface2)",
        textAlign: "center", fontSize: 13, color: "var(--text-sub)",
        borderTop: "1px solid var(--border)",
        flexShrink: 0,
      }}>
        {isHumansTurn && gs.phase === "PLAYING"
          ? selectedFanIndex !== null
            ? <span style={{ color: "#f59e0b", fontWeight: 700 }}>Karte {selectedFanIndex + 1} markiert — nochmals antippen zum Ziehen.</span>
            : <span style={{ color: SP_COLOR, fontWeight: 700 }}>Du ziehst! Tippe auf eine verdeckte Karte.</span>
          : isHumanTarget && gs.phase === "PLAYING"
            ? <span style={{ color: "#f59e0b" }}>
                {drawer?.displayName} will ziehen.
                <button onClick={handleShuffle} style={{
                  marginLeft: 8, background: "none", border: `1px solid #f59e0b`,
                  borderRadius: 6, color: "#f59e0b", fontSize: 12, cursor: "pointer",
                  padding: "2px 8px",
                }}>🔀 Mischen</button>
              </span>
            : (gs.phase === "PLAYING" && drawer?.isAI)
              ? `🤖 ${drawer?.displayName ?? "KI"} zieht…`
              : gs.phase === "PAIR_REVEAL"
                ? `🎉 Paar abgelegt!`
                : null}
      </div>

      {/* ── Abgelegte Paare ── */}
      {gs.discardedPairs.length > 0 && (
        <div style={{
          padding: "8px 12px",
          background: "var(--surface2)",
          borderTop: "1px solid var(--border)",
          flexShrink: 0,
        }}>
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 5, letterSpacing: 0.5 }}>
            ✅ ABGELEGTE PAARE ({gs.discardedPairs.length})
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {gs.discardedPairs.map(([a], idx) => (
              <div key={idx} style={{
                background: "rgba(34,197,94,0.12)",
                border: "1px solid rgba(34,197,94,0.3)",
                borderRadius: 6, padding: "3px 7px",
                fontSize: 16, lineHeight: 1,
              }}>
                {a.emoji}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Own cards ── */}
      <div style={{
        background: "var(--surface)", borderTop: "1px solid var(--border)",
        padding: "12px 12px 16px", flexShrink: 0,
      }}>
        <div style={{
          display: "flex", gap: 6, justifyContent: "center",
          flexWrap: "wrap", marginBottom: 8,
        }}>
          {(humanPlayer?.hand ?? []).map((card) => (
            <OwnCard
              key={card.id}
              card={card}
              highlight={pairHighlightIds.has(card.id)}
              cardW={ownCardW}
              cardH={ownCardH}
            />
          ))}
          {(humanPlayer?.hand?.length ?? 0) === 0 && (
            <div style={{ fontSize: 14, color: "var(--text-muted)", padding: "20px 0" }}>
              ✅ Du bist fertig! Kein Strandräuber bei dir.
            </div>
          )}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
          {humanPlayer?.displayName} · {humanPlayer?.hand?.length ?? 0} Karten
          {gs.roundScores[humanPlayer?.userId ?? ""] !== undefined && (
            <span style={{ marginLeft: 8, color: SP_COLOR }}>
              🦹 {gs.roundScores[humanPlayer.userId]} Pkt.
            </span>
          )}
        </div>
      </div>

      {/* ── Round End / Game Over Overlay ── */}
      {(gs.phase === "ROUND_END" || gs.phase === "GAME_OVER") && (
        <RoundEndOverlay
          gs={gs}
          humanPlayer={humanPlayer}
          onContinue={handleContinueRound}
          onHome={() => navigate("/home", { replace: true })}
          onLobby={() => navigate("/strandraeuber/lobby", { replace: true })}
        />
      )}

      {/* ── Quit dialog ── */}
      {showQuit && mode === "ai" && local && (
        <GameSaveQuitDialog
          emoji="🦹"
          message={`Runde ${local.roundNumber} · ${local.players.length} Spieler`}
          onContinue={() => setShowQuit(false)}
          onSaveAndQuit={() => {
            saveGame({
              id: saveId ?? generateGameSaveId(),
              gameType: "strandraeuber",
              difficulty,
              gameState: JSON.stringify({ ...local, pairRevealInfo: null }),
              displayLabel: `Runde ${local.roundNumber} · ${local.players.length} Spieler`,
              savedAt: Date.now(),
            });
            navigate("/strandraeuber/lobby", { replace: true });
          }}
          onQuitWithoutSave={() => {
            deleteGameSave("strandraeuber");
            navigate("/strandraeuber/lobby", { replace: true });
          }}
        />
      )}
      {showQuit && mode !== "ai" && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(10,22,40,0.9)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60,
        }}>
          <div className="card" style={{ width: "min(300px,90vw)", padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: 36 }}>🏳️</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 8 }}>Spiel verlassen?</div>
            <div style={{ fontSize: 13, color: "var(--text-sub)", marginTop: 6 }}>Spielstand geht verloren.</div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowQuit(false)}>Weiter</button>
              <button className="btn" style={{ flex: 1, background: SP_COLOR, color: "white" }}
                onClick={() => navigate("/strandraeuber/lobby", { replace: true })}>Verlassen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── RoundEndOverlay ────────────────────────────────────────────────────────────

function RoundEndOverlay({
  gs, humanPlayer, onContinue, onHome, onLobby,
}: {
  gs: SpGameStateLocal;
  humanPlayer: SpPlayerLocal;
  onContinue: () => void;
  onHome: () => void;
  onLobby: () => void;
}) {
  const isLastRound = gs.roundNumber >= gs.totalRounds;
  const loser       = gs.loserUserId ? gs.players.find(p => p.userId === gs.loserUserId) : null;
  const humanLost   = gs.loserUserId === humanPlayer?.userId;

  // Final standings for multi-round
  const standings = [...gs.players]
    .map(p => ({ ...p, score: gs.roundScores[p.userId] ?? 0 }))
    .sort((a, b) => b.score - a.score);
  const overallLoser = standings[0];

  useEffect(() => {
    audioManager.playSound(humanLost ? "sp_gameover" : "level_complete");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(10,22,40,0.92)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50,
    }}>
      <div className="card" style={{ width: "min(360px,92vw)", padding: 24, textAlign: "center" }}>
        {/* Loser announcement */}
        {loser && (
          <>
            <div style={{ fontSize: 56 }}>🦹</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "white", marginTop: 8 }}>
              {humanLost ? "Du hältst den Strandräuber!" : `${loser.displayName} hält den Strandräuber!`}
            </div>
            <div style={{ fontSize: 14, color: "var(--text-sub)", marginTop: 4 }}>
              {humanLost ? "🙈 Erwischt!" : "💀 So ein Pech!"}
            </div>
          </>
        )}

        {/* Scores */}
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 6 }}>
          {standings.filter(p => (gs.roundScores[p.userId] ?? 0) > 0 || isLastRound).map(p => (
            <div key={p.userId} style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "8px 12px", borderRadius: 8,
              background: p.userId === gs.loserUserId ? SP_DIM : "rgba(255,255,255,0.05)",
              border: `1px solid ${p.userId === gs.loserUserId ? SP_COLOR + "44" : "var(--border)"}`,
            }}>
              <span style={{ fontSize: 18 }}>{p.avatarUrl}</span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, textAlign: "left" }}>{p.displayName}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: (gs.roundScores[p.userId] ?? 0) > 0 ? SP_COLOR : "var(--text-muted)" }}>
                {"🦹".repeat(gs.roundScores[p.userId] ?? 0) || "—"}
              </span>
            </div>
          ))}
        </div>

        {/* Final summary */}
        {isLastRound && (
          <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 8, background: SP_DIM, border: `1px solid ${SP_COLOR}44` }}>
            <div style={{ fontSize: 12, color: "var(--text-sub)", marginBottom: 4 }}>Gesamtverlierer</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: SP_COLOR }}>
              {overallLoser.avatarUrl} {overallLoser.displayName} mit {overallLoser.score} 🦹
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button className="btn btn-outline" style={{ flex: 1 }} onClick={onHome}>🏠 Home</button>
          {isLastRound ? (
            <button className="btn" style={{ flex: 1, background: SP_COLOR, color: "white" }}
              onClick={onLobby}>Nochmal 🦹</button>
          ) : (
            <button className="btn" style={{ flex: 1, background: SP_COLOR, color: "white" }}
              onClick={onContinue}>Weiter →</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── OnlineGameView ─────────────────────────────────────────────────────────────

function OnlineGameView({
  online, uid, selectedFanIndex, setSelectedFanIndex, onDraw, onQuit,
}: {
  online: SpOnlineGame | null;
  uid: string;
  selectedFanIndex: number | null;
  setSelectedFanIndex: (i: number | null) => void;
  onDraw: (cardIndex: number) => void;
  onQuit: () => void;
}) {
  const navigate = useNavigate();

  if (!online) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a1628" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 42 }}>🦹</div>
          <div style={{ marginTop: 12, color: "var(--text-sub)" }}>Wird geladen…</div>
        </div>
      </div>
    );
  }

  const len          = online.activePlayerIds.length;
  const drawerUid    = len > 0 ? online.activePlayerIds[online.turnIndex % len] : "";
  const targetUid    = len > 1 ? online.activePlayerIds[(online.turnIndex - 1 + len) % len] : "";
  const isMyTurn     = drawerUid === uid;
  const myPlayer     = online.players[uid];
  const opponents    = online.playerIds.filter(pid => pid !== uid).map(pid => online.players[pid]).filter(Boolean);

  const isGameOver   = online.phase === "ROUND_END";
  const isLastRound  = online.roundNumber >= online.totalRounds;

  return (
    <div style={{ minHeight: "100dvh", background: "#0a1628", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, #7a0f27 0%, ${SP_COLOR} 100%)`,
        padding: "10px 14px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>🦹</span>
          <div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", letterSpacing: 1, textTransform: "uppercase" }}>Strandräuber</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "white" }}>Runde {online.roundNumber}/{online.totalRounds}</div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", flex: 1, textAlign: "center" }}>
          {isMyTurn ? "Du bist dran!" : `Warte auf ${online.players[drawerUid]?.displayName ?? "…"}…`}
        </div>
        <button onClick={onQuit} style={{
          background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 6,
          width: 32, height: 32, fontSize: 16, cursor: "pointer", color: "white",
        }}>✕</button>
      </div>

      {/* Opponents */}
      <div style={{
        flex: 1, padding: "12px 10px",
        background: "linear-gradient(180deg, #0d2040 0%, #0a1628 100%)",
        display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", alignContent: "flex-start",
      }}>
        {opponents.map((opp) => {
          if (!opp) return null;
          const isActive = online.activePlayerIds.includes(opp.userId);
          const isTarget = isActive && opp.userId === targetUid && isMyTurn && online.phase === "PLAYING";
          const isDrawer = opp.userId === drawerUid;
          return (
            <OpponentFan
              key={opp.userId}
              player={opp}
              cardCount={opp.cardCount}
              isTarget={isTarget}
              isDrawer={isDrawer}
              isOut={!isActive}
              selectedCardIndex={isTarget ? selectedFanIndex : null}
              onCardSelected={(i) => {
                if (!isTarget) return;
                setSelectedFanIndex(i);
                onDraw(i);
              }}
            />
          );
        })}
      </div>

      {/* Status */}
      <div style={{ padding: "8px 16px", background: "var(--surface2)", textAlign: "center", fontSize: 13, color: "var(--text-sub)", borderTop: "1px solid var(--border)" }}>
        {isMyTurn && online.phase === "PLAYING"
          ? <span style={{ color: SP_COLOR, fontWeight: 700 }}>Du ziehst! Tippe auf eine verdeckte Karte.</span>
          : null}
      </div>

      {/* Own cards */}
      <div style={{ background: "var(--surface)", borderTop: "1px solid var(--border)", padding: "12px 12px 16px" }}>
        <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap", marginBottom: 8 }}>
          {(myPlayer?.hand ?? []).map((card) => (
            <OwnCard key={card.id} card={card} highlight={false} />
          ))}
          {(myPlayer?.hand?.length ?? 0) === 0 && (
            <div style={{ fontSize: 14, color: "var(--text-muted)", padding: "20px 0" }}>✅ Du bist fertig!</div>
          )}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
          {myPlayer?.displayName} · {myPlayer?.cardCount ?? 0} Karten
          {(online.scores[uid] ?? 0) > 0 && (
            <span style={{ marginLeft: 8, color: SP_COLOR }}>🦹 {online.scores[uid]} Pkt.</span>
          )}
        </div>
      </div>

      {/* Round end overlay for online */}
      {isGameOver && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(10,22,40,0.92)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50,
        }}>
          <div className="card" style={{ width: "min(360px,92vw)", padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: 56 }}>🦹</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "white", marginTop: 8 }}>
              {online.loserName} hält den Strandräuber!
            </div>
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              {online.playerIds.map(pid => {
                const p = online.players[pid];
                return (
                  <div key={pid} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 12px", borderRadius: 8,
                    background: pid === online.loserId ? SP_DIM : "rgba(255,255,255,0.05)",
                    border: `1px solid ${pid === online.loserId ? SP_COLOR + "44" : "var(--border)"}`,
                  }}>
                    <span style={{ fontSize: 18 }}>{p?.avatarUrl}</span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, textAlign: "left" }}>{p?.displayName}</span>
                    <span style={{ fontSize: 14, color: SP_COLOR }}>
                      {"🦹".repeat(online.scores[pid] ?? 0) || "—"}
                    </span>
                  </div>
                );
              })}
            </div>
            {isLastRound ? (
              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => navigate("/home", { replace: true })}>🏠 Home</button>
                <button className="btn" style={{ flex: 1, background: SP_COLOR, color: "white" }}
                  onClick={() => navigate("/strandraeuber/lobby", { replace: true })}>Nochmal</button>
              </div>
            ) : (
              <div style={{ marginTop: 16, fontSize: 13, color: "var(--text-muted)" }}>
                Nächste Runde startet automatisch…
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
