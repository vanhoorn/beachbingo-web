import { useCallback, useEffect, useRef, useState } from "react";
import { doc, onSnapshot, updateDoc, addDoc, collection, getDoc } from "firebase/firestore";
import { useLocation, useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase";
import type { BrandungGame, BrandungSettings } from "../../types";
import {
  type BCard, type BrandungDifficulty, calcScore, dealCards,
  formatScore, isFeuerBlitz, isThirtyOne, bestAIMove, RED_SUITS,
} from "./brandungLogic";
import { audioManager } from "../../audio/AudioManager";

const TEAL = "#0d9488";
const LIVES_START = 3;
const AI_DELAY = 1100;

// ── Card Component ────────────────────────────────────────────────────────────

function PlayingCard({
  card, faceUp = true, selected = false, selectable = false, onClick, style = {},
}: {
  card?: BCard; faceUp?: boolean; selected?: boolean; selectable?: boolean;
  onClick?: () => void; style?: React.CSSProperties;
}) {
  const isRed = card && RED_SUITS.has(card.suit);
  return (
    <div
      onClick={onClick}
      style={{
        width: 58, height: 84, borderRadius: 8, flexShrink: 0,
        cursor: (selectable || onClick) ? "pointer" : "default",
        userSelect: "none", position: "relative",
        transition: "transform 0.15s, box-shadow 0.15s",
        transform: selected ? "translateY(-8px)" : undefined,
        ...(faceUp ? {
          background: "#f8f5ee",
          border: `2px solid ${selected ? TEAL : "rgba(0,0,0,0.12)"}`,
          boxShadow: selected
            ? `0 0 0 2px ${TEAL}, 0 6px 18px rgba(0,0,0,0.35)`
            : "0 3px 10px rgba(0,0,0,0.3)",
        } : {
          background: "linear-gradient(to bottom, #1a72c8 0%, #5ab8e8 55%, #1a8ab8 56%, #0a4a7a 100%)",
          border: "2px solid rgba(13,148,136,0.4)",
          boxShadow: "0 3px 10px rgba(0,0,0,0.3)",
          overflow: "hidden",
        }),
        ...style,
      }}
    >
      {faceUp && card ? (
        <>
          <div style={{
            position: "absolute", top: 4, left: 5,
            color: isRed ? "#d63031" : "#1a1a2e", lineHeight: 1, fontSize: 13,
          }}>
            <div style={{ fontWeight: 900 }}>{card.rank}</div>
            <div style={{ fontSize: 11 }}>{card.suit}</div>
          </div>
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%,-50%)",
            fontSize: 26, color: isRed ? "#d63031" : "#1a1a2e",
          }}>{card.suit}</div>
          <div style={{
            position: "absolute", bottom: 4, right: 5,
            color: isRed ? "#d63031" : "#1a1a2e", lineHeight: 1,
            fontSize: 13, transform: "rotate(180deg)",
          }}>
            <div style={{ fontWeight: 900 }}>{card.rank}</div>
            <div style={{ fontSize: 11 }}>{card.suit}</div>
          </div>
        </>
      ) : !faceUp ? (
        // Island & palm card back (daytime)
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} viewBox="0 0 58 84">
          {/* Sun glow */}
          <circle cx="45" cy="11" r="9.5" fill="rgba(255,224,51,0.28)"/>
          {/* Sun core */}
          <circle cx="45" cy="11" r="5.8" fill="#ffd700"/>
          <circle cx="43.3" cy="9.8" r="3.4" fill="#ffed4a"/>
          {/* Sun rays */}
          <line x1="45" y1="2.5" x2="45" y2="0.2" stroke="#ffd700" strokeWidth="1.4" opacity="0.75"/>
          <line x1="52.2" y1="4.8" x2="53.8" y2="3.2" stroke="#ffd700" strokeWidth="1.4" opacity="0.75"/>
          <line x1="54.5" y1="11" x2="57" y2="11" stroke="#ffd700" strokeWidth="1.4" opacity="0.75"/>
          <line x1="52.2" y1="17.2" x2="53.8" y2="18.8" stroke="#ffd700" strokeWidth="1.4" opacity="0.75"/>
          <line x1="45" y1="19.5" x2="45" y2="21.8" stroke="#ffd700" strokeWidth="1.4" opacity="0.75"/>
          <line x1="37.8" y1="17.2" x2="36.2" y2="18.8" stroke="#ffd700" strokeWidth="1.4" opacity="0.75"/>
          <line x1="35.5" y1="11" x2="33" y2="11" stroke="#ffd700" strokeWidth="1.4" opacity="0.75"/>
          <line x1="37.8" y1="4.8" x2="36.2" y2="3.2" stroke="#ffd700" strokeWidth="1.4" opacity="0.75"/>
          {/* Ocean waves */}
          <path d="M0,57 Q7,54.5 14,57 Q21,59.5 29,57 Q37,54.5 44,57 Q51,59.5 58,57"
            stroke="rgba(255,255,255,0.35)" strokeWidth="0.9" fill="none"/>
          <path d="M0,67 Q8,64.5 16,67 Q24,69.5 32,67 Q40,64.5 48,67 Q56,69.5 58,67"
            stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" fill="none"/>
          <path d="M0,76 Q9,73.5 18,76 Q27,78.5 36,76 Q45,73.5 54,76"
            stroke="rgba(255,255,255,0.18)" strokeWidth="0.7" fill="none"/>
          {/* Island */}
          <ellipse cx="29" cy="72" rx="12" ry="4.5" fill="#c8942a"/>
          <ellipse cx="26" cy="70.5" rx="6.5" ry="2.5" fill="#e4b44a" opacity="0.5"/>
          {/* Palm trunk */}
          <path d="M29,70 Q27,60 28,49 Q29.5,42 32,34"
            stroke="#7a5c2e" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
          {/* Palm fronds — filled leaf shapes */}
          <path d="M31,33 Q19,38 8,52 Q25,45 33,35 Z" fill="#2a7828"/>
          <path d="M31,35 Q38,45 54,52 Q44,38 33,33 Z" fill="#2a7828"/>
          <path d="M33,33 Q25,26 10,22 Q21,33 31,35 Z" fill="#36963a"/>
          <path d="M33,35 Q42,32 52,22 Q38,26 31,33 Z" fill="#36963a"/>
          <path d="M34,34 Q35,24 30,12 Q28,25 31,34 Z" fill="#2a7828"/>
        </svg>
      ) : null}
    </div>
  );
}

// ── Local game state types ─────────────────────────────────────────────────────

interface LocalPlayer {
  userId: string;
  displayName: string;
  avatarUrl: string;
  hand: BCard[];
  lives: number;
  eliminated: boolean;
  isAI: boolean;
}

interface LocalState {
  players: LocalPlayer[];
  tableCards: BCard[];
  deck: BCard[];
  currentTurnIndex: number;
  knockedByUserId: string | null;
  knockRoundRemaining: string[];
  passCount: number;
  round: number;
  phase: "TURN" | "ROUND_END" | "GAME_OVER";
  roundScores: Record<string, number>;
  roundLosers: string[];
  winnerId: string | null;
  lastActionText: string;
  aiThinking: boolean;
}

// ── Pure turn helpers ─────────────────────────────────────────────────────────

function nextAlive(players: LocalPlayer[], fromIndex: number): number {
  const n = players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (fromIndex + i) % n;
    if (!players[idx].eliminated) return idx;
  }
  return fromIndex;
}

function resolveRound(state: LocalState): LocalState {
  const active = state.players.filter(p => !p.eliminated);
  const scores: Record<string, number> = {};
  for (const p of active) scores[p.userId] = calcScore(p.hand);

  const minScore = Math.min(...Object.values(scores));
  const losers = active.filter(p => scores[p.userId] === minScore).map(p => p.userId);

  const updatedPlayers = state.players.map(p => {
    if (losers.includes(p.userId)) {
      return { ...p, lives: p.lives - 1, eliminated: p.lives - 1 <= 0 };
    }
    return p;
  });

  const stillAlive = updatedPlayers.filter(p => !p.eliminated);
  if (stillAlive.length <= 1) {
    return {
      ...state,
      players: updatedPlayers,
      roundScores: scores,
      roundLosers: losers,
      winnerId: stillAlive[0]?.userId ?? null,
      phase: "GAME_OVER",
      aiThinking: false,
    };
  }

  return {
    ...state,
    players: updatedPlayers,
    roundScores: scores,
    roundLosers: losers,
    phase: "ROUND_END",
    aiThinking: false,
  };
}

function startNewRound(state: LocalState): LocalState {
  const alivePlayers = state.players.filter(p => !p.eliminated);
  const allIds = alivePlayers.map(p => p.userId);
  const { playerHands, tableCards, deck } = dealCards(allIds);
  const updatedPlayers = state.players.map(p => ({
    ...p,
    hand: p.eliminated ? [] : playerHands[p.userId] ?? [],
  }));
  const startIdx = 0;
  return {
    ...state,
    players: updatedPlayers,
    tableCards,
    deck,
    currentTurnIndex: startIdx,
    knockedByUserId: null,
    knockRoundRemaining: [],
    passCount: 0,
    round: state.round + 1,
    phase: "TURN",
    roundScores: {},
    roundLosers: [],
    lastActionText: "Neue Runde beginnt!",
    aiThinking: false,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

interface LocationState {
  mode: "ai" | "online";
  aiCount?: number;
  difficulty?: BrandungDifficulty;
  settings?: BrandungSettings;
  gameId?: string;
}

export default function BrandungGameScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const { mode, aiCount = 2, difficulty = "SNIPER", settings: initSettings, gameId } = (location.state ?? {}) as LocationState;
  const uid = auth.currentUser?.uid ?? "";

  // Responsive card sizing (same mechanism as MeerMau)
  const [winW, setWinW] = useState(window.innerWidth);
  useEffect(() => {
    const h = () => setWinW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  const cardScale = Math.min(Math.max(Math.min(winW, 520) / 390, 1), 2.0);
  const CARD_W = Math.round(58 * cardScale);
  const CARD_H = Math.round(84 * cardScale);
  const SMALL_W = Math.round(30 * cardScale);
  const SMALL_H = Math.round(44 * cardScale);

  // ── AI mode: local state ────────────────────────────────────────────────
  const [local, setLocal] = useState<LocalState | null>(null);
  // ── Online mode: firestore ──────────────────────────────────────────────
  const [online, setOnline] = useState<BrandungGame | null>(null);

  // Interaction state
  const [selectedHandIdx, setSelectedHandIdx] = useState<number | null>(null);
  const [selectedTableIdx, setSelectedTableIdx] = useState<number | null>(null);
  const [showQuit, setShowQuit] = useState(false);

  const resultWrittenRef = useRef(false);
  const aiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localRef = useRef(local);
  useEffect(() => { localRef.current = local; }, [local]);

  useEffect(() => {
    audioManager.startMusic("brandung");
    return () => audioManager.stopMusic();
  }, []);

  // ── Init AI mode ────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== "ai") return;
    const playerIds: string[] = [uid];
    const aiNames = ["Mia 🤖", "Leo 🤖", "Finn 🤖", "Zoe 🤖", "Max 🤖"];
    const aiAvatars = ["🤖", "🦾", "⚡", "🎯", "🔮"];
    for (let i = 0; i < aiCount; i++) {
      playerIds.push(`ai_${i}`);
    }
    const { playerHands, tableCards, deck } = dealCards(playerIds);
    const players: LocalPlayer[] = playerIds.map((pid, i) => ({
      userId: pid,
      displayName: i === 0 ? "Du" : aiNames[i - 1] ?? `KI ${i}`,
      avatarUrl: i === 0 ? "👤" : aiAvatars[i - 1] ?? "🤖",
      hand: playerHands[pid],
      lives: LIVES_START,
      eliminated: false,
      isAI: i > 0,
    }));
    const init: LocalState = {
      players, tableCards, deck, currentTurnIndex: 0,
      knockedByUserId: null, knockRoundRemaining: [], passCount: 0,
      round: 1, phase: "TURN", roundScores: {}, roundLosers: [],
      winnerId: null, lastActionText: "Runde 1 beginnt!", aiThinking: false,
    };
    setLocal(init);
    audioManager.playSound("card_deal");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Init online mode ─────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== "online" || !gameId) return;
    const unsub = onSnapshot(doc(db, "brandungGames", gameId), (snap) => {
      if (!snap.exists()) return;
      setOnline({ gameId: snap.id, ...snap.data() } as BrandungGame);
    });
    return () => unsub();
  }, [mode, gameId]);

  // ── AI turn trigger ──────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== "ai" || !local) return;
    if (local.phase !== "TURN") return;
    const curPlayer = local.players[local.currentTurnIndex];
    if (!curPlayer || !curPlayer.isAI || local.aiThinking) return;

    setLocal(s => s ? { ...s, aiThinking: true } : s);
    aiTimeoutRef.current = setTimeout(() => {
      const st = localRef.current;
      if (!st) return;
      const p = st.players[st.currentTurnIndex];
      if (!p || !p.isAI) return;
      const canPass = !initSettings?.passingForbidden && st.knockedByUserId === null;
      const action = bestAIMove(p.hand, st.tableCards, difficulty, canPass);
      executeLocalAction(action.type,
        action.type === "SWAP_ONE" ? action.handIdx : undefined,
        action.type === "SWAP_ONE" ? action.tableIdx : undefined,
      );
    }, AI_DELAY);
    return () => { if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local?.currentTurnIndex, local?.phase]);

  // ── Save AI result ───────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== "ai" || !local || local.phase !== "GAME_OVER") return;
    if (resultWrittenRef.current) return;
    resultWrittenRef.current = true;
    addDoc(collection(db, "brandungResults"), {
      adminId: uid,
      playerIds: [uid],
      winnerId: local.winnerId === uid ? uid : null,
      rounds: local.round,
      finishedAt: Date.now(),
    });
  }, [local?.phase, mode, uid, local]);

  // ── Local action executor ─────────────────────────────────────────────────
  const executeLocalAction = useCallback((
    type: string, handIdx?: number, tableIdx?: number,
  ) => {
    setLocal(prev => {
      if (!prev || prev.phase !== "TURN") return prev;
      const s = { ...prev, aiThinking: false };
      const curPlayer = s.players[s.currentTurnIndex];
      if (!curPlayer) return prev;

      let newHand = [...curPlayer.hand];
      let newTable = [...s.tableCards];
      let newDeck = [...s.deck];
      let newPassCount = s.passCount;
      let lastAction = "";
      let newKnockedBy = s.knockedByUserId;
      let newKnockRemaining = [...s.knockRoundRemaining];

      if (type === "SWAP_ONE" && handIdx !== undefined && tableIdx !== undefined) {
        const tmp = newHand[handIdx];
        newHand[handIdx] = newTable[tableIdx];
        newTable[tableIdx] = tmp;
        lastAction = `${curPlayer.displayName} tauscht 1 Karte.`;
        audioManager.playSound("card_place");
        newPassCount = 0;
      } else if (type === "SWAP_ALL") {
        const tmp = newHand;
        newHand = newTable;
        newTable = tmp;
        lastAction = `${curPlayer.displayName} tauscht alle 3.`;
        audioManager.playSound("card_place");
        newPassCount = 0;
      } else if (type === "PASS") {
        newPassCount += 1;
        lastAction = `${curPlayer.displayName} schiebt.`;
        audioManager.playSound("card_select");
      } else if (type === "KNOCK") {
        newKnockedBy = curPlayer.userId;
        const alivePlayers = s.players.filter(p => !p.eliminated && p.userId !== curPlayer.userId);
        newKnockRemaining = alivePlayers.map(p => p.userId);
        lastAction = `${curPlayer.displayName} klopft! ✊`;
        audioManager.playSound("card_knock");
      }

      const updatedPlayers = s.players.map(p =>
        p.userId === curPlayer.userId ? { ...p, hand: newHand } : p,
      );

      // Check Feuer/Blitz after swap
      if ((type === "SWAP_ONE" || type === "SWAP_ALL") && isFeuerBlitz(newHand)) {
        audioManager.playSound("card_feuer");
        const scores: Record<string, number> = {};
        for (const p of updatedPlayers) if (!p.eliminated) scores[p.userId] = calcScore(p.hand);
        const losers = updatedPlayers.filter(p => !p.eliminated && p.userId !== curPlayer.userId).map(p => p.userId);
        const updAfter = updatedPlayers.map(p =>
          losers.includes(p.userId) ? { ...p, lives: p.lives - 1, eliminated: p.lives - 1 <= 0 } : p,
        );
        const alive = updAfter.filter(p => !p.eliminated);
        return {
          ...s, players: updAfter, tableCards: newTable, deck: newDeck,
          roundScores: scores, roundLosers: losers,
          lastActionText: `🔥 FEUER! ${curPlayer.displayName} hat 3 Asse! Alle anderen verlieren 1 Leben!`,
          phase: alive.length <= 1 ? "GAME_OVER" : "ROUND_END",
          winnerId: alive.length <= 1 ? (alive[0]?.userId ?? null) : null,
          aiThinking: false,
        };
      }

      // Check 31 after swap
      if ((type === "SWAP_ONE" || type === "SWAP_ALL") && isThirtyOne(newHand)) {
        audioManager.playSound("level_complete");
        return resolveRound({
          ...s, players: updatedPlayers, tableCards: newTable, deck: newDeck,
          lastActionText: `31! ${curPlayer.displayName} deckt auf!`,
        });
      }

      // All-pass rule: replace table cards
      const alivePlayers = s.players.filter(p => !p.eliminated);
      if (type === "PASS" && newPassCount >= alivePlayers.length && initSettings?.newCardsOnAllPass && newDeck.length >= 3) {
        newTable = newDeck.slice(0, 3);
        newDeck = newDeck.slice(3);
        newPassCount = 0;
        lastAction += " Neue Tischkarten!";
        audioManager.playSound("card_deal");
      }

      // Advance turn
      let nextState = {
        ...s, players: updatedPlayers, tableCards: newTable, deck: newDeck,
        passCount: newPassCount, knockedByUserId: newKnockedBy,
        knockRoundRemaining: newKnockRemaining, lastActionText: lastAction,
      };

      if (type === "KNOCK") {
        // Move to next in knock-round
        const nextIdx = nextAlive(updatedPlayers, s.currentTurnIndex);
        if (newKnockRemaining.length === 0) {
          return resolveRound({ ...nextState });
        }
        return { ...nextState, currentTurnIndex: nextIdx };
      }

      // After knock is active: remove current player from remaining
      if (newKnockedBy !== null) {
        const remaining = newKnockRemaining.filter(id => id !== curPlayer.userId);
        if (remaining.length === 0) {
          return resolveRound({ ...nextState, knockRoundRemaining: remaining });
        }
        const nextIdx = nextAlive(updatedPlayers, s.currentTurnIndex);
        return { ...nextState, knockRoundRemaining: remaining, currentTurnIndex: nextIdx };
      }

      const nextIdx = nextAlive(updatedPlayers, s.currentTurnIndex);
      return { ...nextState, currentTurnIndex: nextIdx };
    });
    setSelectedHandIdx(null);
    setSelectedTableIdx(null);
  }, [initSettings]);

  // ── Online action sender ──────────────────────────────────────────────────
  const executeOnlineAction = useCallback(async (
    type: string, handIdx?: number, tableIdx?: number,
  ) => {
    if (!online || !gameId) return;
    const myPlayer = online.players[uid];
    if (!myPlayer || online.phase !== "TURN") return;
    const curId = online.playerIds[online.currentTurnIndex];
    if (curId !== uid) return;

    let newHand = [...myPlayer.hand];
    let newTable = [...online.tableCards];
    let newDeck = [...online.deck];
    let newPassCount = online.passCount;
    let lastAction = "";
    let newKnockedBy = online.knockedByUserId;
    let newKnockRemaining = [...online.knockRoundRemaining];

    if (type === "SWAP_ONE" && handIdx !== undefined && tableIdx !== undefined) {
      const tmp = newHand[handIdx];
      newHand[handIdx] = newTable[tableIdx];
      newTable[tableIdx] = tmp;
      lastAction = `${myPlayer.displayName} tauscht 1 Karte.`;
      audioManager.playSound("card_place");
    } else if (type === "SWAP_ALL") {
      const tmp = newHand;
      newHand = newTable;
      newTable = tmp;
      lastAction = `${myPlayer.displayName} tauscht alle 3.`;
      audioManager.playSound("card_place");
    } else if (type === "PASS") {
      newPassCount += 1;
      lastAction = `${myPlayer.displayName} schiebt.`;
      audioManager.playSound("card_select");
    } else if (type === "KNOCK") {
      newKnockedBy = uid;
      const alivePlayers = online.playerIds.map(id => online.players[id]).filter(p => !p.eliminated && p.userId !== uid);
      newKnockRemaining = alivePlayers.map(p => p.userId);
      lastAction = `${myPlayer.displayName} klopft! ✊`;
      audioManager.playSound("card_knock");
    }

    const alivePlayers = online.playerIds.map(id => online.players[id]).filter(p => !p.eliminated);

    // All-pass replace table
    if (type === "PASS" && newPassCount >= alivePlayers.length && online.settings.newCardsOnAllPass && newDeck.length >= 3) {
      newTable = newDeck.slice(0, 3);
      newDeck = newDeck.slice(3);
      newPassCount = 0;
      lastAction += " Neue Tischkarten!";
      audioManager.playSound("card_deal");
    }

    // Find next turn index
    let nextIdx = online.currentTurnIndex;
    if (type === "KNOCK") {
      nextIdx = (online.currentTurnIndex + 1) % online.playerIds.length;
      while (online.players[online.playerIds[nextIdx]]?.eliminated) nextIdx = (nextIdx + 1) % online.playerIds.length;
    } else if (newKnockedBy !== null) {
      const remaining = newKnockRemaining.filter(id => id !== uid);
      nextIdx = (online.currentTurnIndex + 1) % online.playerIds.length;
      while (online.players[online.playerIds[nextIdx]]?.eliminated) nextIdx = (nextIdx + 1) % online.playerIds.length;
      const updates: Record<string, unknown> = {
        [`players.${uid}.hand`]: newHand,
        tableCards: newTable, deck: newDeck, passCount: newPassCount,
        knockRoundRemaining: remaining, currentTurnIndex: nextIdx,
        lastAction,
      };
      if (remaining.length === 0) {
        updates.phase = "ROUND_END";
      }
      await updateDoc(doc(db, "brandungGames", gameId), updates);
      setSelectedHandIdx(null); setSelectedTableIdx(null);
      return;
    } else {
      nextIdx = (online.currentTurnIndex + 1) % online.playerIds.length;
      while (online.players[online.playerIds[nextIdx]]?.eliminated) nextIdx = (nextIdx + 1) % online.playerIds.length;
    }

    const isFeuer = (type === "SWAP_ONE" || type === "SWAP_ALL") && isFeuerBlitz(newHand);
    const is31 = (type === "SWAP_ONE" || type === "SWAP_ALL") && isThirtyOne(newHand);

    const updates: Record<string, unknown> = {
      [`players.${uid}.hand`]: newHand,
      tableCards: newTable, deck: newDeck, passCount: newPassCount,
      knockedByUserId: newKnockedBy, knockRoundRemaining: newKnockRemaining,
      currentTurnIndex: nextIdx, lastAction,
    };
    if (isFeuer || is31) { updates.phase = "ROUND_END"; if (isFeuer) updates.lastAction = `🔥 FEUER! ${myPlayer.displayName} hat 3 Asse!`; }
    if (type === "KNOCK") { updates.phase = newKnockRemaining.length === 0 ? "ROUND_END" : "TURN"; }

    await updateDoc(doc(db, "brandungGames", gameId), updates);
    setSelectedHandIdx(null); setSelectedTableIdx(null);

    if (isFeuer) audioManager.playSound("card_feuer");
    else if (is31) audioManager.playSound("level_complete");
  }, [online, gameId, uid]);

  // ── Online: admin drives round resolution ─────────────────────────────────
  useEffect(() => {
    if (mode !== "online" || !online || !gameId) return;
    if (online.phase !== "ROUND_END") return;
    if (online.adminId !== uid) return;
    // Small delay so all clients see the round end state
    const timer = setTimeout(async () => {
      const snap = await getDoc(doc(db, "brandungGames", gameId));
      if (!snap.exists()) return;
      const g = { gameId: snap.id, ...snap.data() } as BrandungGame;
      if (g.phase !== "ROUND_END") return;

      const active = g.playerIds.map(id => g.players[id]).filter(p => !p.eliminated);
      const scores: Record<string, number> = {};
      for (const p of active) scores[p.userId] = calcScore(p.hand);
      const minScore = Math.min(...Object.values(scores));
      const losers = active.filter(p => scores[p.userId] === minScore).map(p => p.userId);

      const updPlayers = { ...g.players };
      for (const lid of losers) {
        updPlayers[lid] = { ...updPlayers[lid], lives: updPlayers[lid].lives - 1, eliminated: updPlayers[lid].lives - 1 <= 0 };
      }
      const stillAlive = g.playerIds.map(id => updPlayers[id]).filter(p => !p.eliminated);

      if (stillAlive.length <= 1) {
        await updateDoc(doc(db, "brandungGames", gameId), {
          players: updPlayers, roundScores: scores, roundLosers: losers,
          phase: "GAME_OVER", status: "FINISHED", winnerId: stillAlive[0]?.userId ?? null,
        });
        addDoc(collection(db, "brandungResults"), {
          adminId: uid, playerIds: g.playerIds, winnerId: stillAlive[0]?.userId ?? null,
          rounds: g.round, finishedAt: Date.now(),
        });
        return;
      }

      // Start new round
      const aliveIds = g.playerIds.filter(id => !updPlayers[id].eliminated);
      const { playerHands, tableCards, deck } = dealCards(aliveIds);
      for (const pid of aliveIds) updPlayers[pid] = { ...updPlayers[pid], hand: playerHands[pid] };

      await updateDoc(doc(db, "brandungGames", gameId), {
        players: updPlayers, roundScores: scores, roundLosers: losers,
        tableCards, deck, currentTurnIndex: 0, knockedByUserId: null,
        knockRoundRemaining: [], passCount: 0, round: g.round + 1,
        phase: "TURN", lastAction: `Runde ${g.round + 1} beginnt!`,
      });
      audioManager.playSound("card_deal");
    }, 2500);
    return () => clearTimeout(timer);
  }, [online?.phase, online?.adminId, gameId, mode, uid]);

  // ── Derive display from state ─────────────────────────────────────────────
  const gs = mode === "ai" ? local : online
    ? (() => {
      const players: LocalPlayer[] = online.playerIds.map(id => {
        const p = online.players[id];
        return { ...p, hand: p.hand ?? [] };
      });
      return {
        players, tableCards: online.tableCards, deck: online.deck,
        currentTurnIndex: online.currentTurnIndex,
        knockedByUserId: online.knockedByUserId,
        knockRoundRemaining: online.knockRoundRemaining,
        passCount: online.passCount, round: online.round,
        phase: online.phase as LocalState["phase"],
        roundScores: online.roundScores ?? {},
        roundLosers: online.roundLosers ?? [],
        winnerId: online.winnerId,
        lastActionText: online.lastAction,
        aiThinking: false,
      } as LocalState;
    })() : null;

  if (!gs) {
    return (
      <div className="screen" style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ fontSize: 42 }}>🌊</div>
        <div style={{ marginTop: 12, color: "var(--text-sub)" }}>Wird geladen…</div>
      </div>
    );
  }

  const myUserId = uid;
  const myPlayer = gs.players.find(p => p.userId === myUserId) ?? gs.players[0];
  const myIdx = gs.players.indexOf(myPlayer);
  const opponents = gs.players.filter((_, i) => i !== myIdx);
  const curPlayer = gs.players[gs.currentTurnIndex];
  const isMyTurn = curPlayer?.userId === myUserId;
  const deckCount = gs.deck.length;

  const canPass = gs.knockedByUserId === null && !(initSettings?.passingForbidden ?? online?.settings.passingForbidden ?? false);
  const canSwapOne = isMyTurn && selectedHandIdx !== null && selectedTableIdx !== null && gs.phase === "TURN";
  const canSwapAll = isMyTurn && gs.phase === "TURN";
  const myScore = myPlayer ? calcScore(myPlayer.hand) : 0;

  function handleHandCard(idx: number) {
    if (!isMyTurn || gs?.phase !== "TURN") return;
    audioManager.playSound("card_select");
    setSelectedHandIdx(prev => prev === idx ? null : idx);
    setSelectedTableIdx(null);
  }

  function handleTableCard(idx: number) {
    if (!isMyTurn || gs?.phase !== "TURN") return;
    if (selectedHandIdx !== null) {
      // Immediate swap
      if (mode === "ai") executeLocalAction("SWAP_ONE", selectedHandIdx, idx);
      else executeOnlineAction("SWAP_ONE", selectedHandIdx, idx);
    } else {
      audioManager.playSound("card_select");
      setSelectedTableIdx(prev => prev === idx ? null : idx);
    }
  }

  function handleSwapAll() {
    if (mode === "ai") executeLocalAction("SWAP_ALL");
    else executeOnlineAction("SWAP_ALL");
  }

  function handlePass() {
    if (mode === "ai") executeLocalAction("PASS");
    else executeOnlineAction("PASS");
  }

  function handleKnock() {
    if (mode === "ai") executeLocalAction("KNOCK");
    else executeOnlineAction("KNOCK");
  }

  function continueRound() {
    if (mode !== "ai") return;
    setLocal(prev => prev ? startNewRound(prev) : prev);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="screen" style={{ gap: 0, paddingTop: 0, paddingBottom: 0, height: "100dvh", overflow: "hidden" }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #064e47 0%, #0d9488 100%)",
        padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>🌊</span>
          <div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", letterSpacing: 1, textTransform: "uppercase" }}>Brandung</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "white" }}>Runde {gs.round}</div>
          </div>
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)" }}>
          {gs.knockedByUserId ? `✊ ${gs.players.find(p => p.userId === gs.knockedByUserId)?.displayName} klopfte!` : gs.lastActionText}
        </div>
        <button onClick={() => setShowQuit(true)} style={{
          background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 6,
          width: 32, height: 32, fontSize: 16, cursor: "pointer", color: "white",
        }}>✕</button>
      </div>

      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", gap: 0, padding: "10px 12px", boxSizing: "border-box" }}>
        {/* Opponents */}
        <div style={{ display: "flex", gap: 8, flexShrink: 0, marginBottom: 10 }}>
          {opponents.map(opp => {
            const isCurrentTurn = curPlayer?.userId === opp.userId;
            const lives = opp.lives;
            const showFaceUp = gs.phase === "ROUND_END" || gs.phase === "GAME_OVER";
            const fanCount = showFaceUp ? 0 : 3;
            const fanSpread = Math.round(SMALL_W * 0.45);
            return (
              <div key={opp.userId} style={{
                flex: 1,
                background: opp.eliminated ? "rgba(239,68,68,0.08)" : isCurrentTurn ? "rgba(13,148,136,0.15)" : "var(--surface2)",
                border: `1px solid ${isCurrentTurn ? TEAL : opp.eliminated ? "#ef4444" : "var(--border)"}`,
                borderRadius: 10, padding: "8px 10px",
                display: "flex", flexDirection: "column", gap: 6,
                opacity: opp.eliminated ? 0.5 : 1,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 18 }}>{opp.avatarUrl}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: opp.eliminated ? "var(--text-muted)" : "var(--text)" }}>
                      {opp.displayName}{isCurrentTurn ? " ⟵" : ""}
                    </div>
                    <div style={{ fontSize: 10, color: TEAL, letterSpacing: 0.5 }}>
                      {opp.eliminated ? "❌ aus" : Array(lives).fill("🌊").join("") + Array(LIVES_START - lives).fill("🤍").join("")}
                    </div>
                  </div>
                  {showFaceUp && gs.roundScores[opp.userId] !== undefined && (
                    <span style={{ fontSize: 12, fontWeight: 700, color: gs.roundLosers.includes(opp.userId) ? "#ef4444" : TEAL }}>
                      {formatScore(gs.roundScores[opp.userId])}P
                    </span>
                  )}
                </div>
                {/* Fan or face-up cards */}
                {showFaceUp ? (
                  <div style={{ display: "flex", gap: 4, justifyContent: "center", flexWrap: "wrap" }}>
                    {opp.hand.map((c, i) => (
                      <PlayingCard key={i} card={c} faceUp style={{ width: SMALL_W, height: SMALL_H }} />
                    ))}
                  </div>
                ) : (
                  <div style={{ display: "flex", justifyContent: "center" }}>
                  <div style={{ position: "relative", height: SMALL_H + 6, width: SMALL_W + fanSpread * (fanCount - 1) }}>
                    {Array.from({ length: fanCount }).map((_, ci) => {
                      const mid = (fanCount - 1) / 2;
                      const angle = (ci - mid) * 10;
                      return (
                        <div key={ci} style={{
                          position: "absolute", left: ci * fanSpread,
                          top: Math.abs(ci - mid) * 2,
                          transform: `rotate(${angle}deg)`,
                          transformOrigin: "bottom center",
                        }}>
                          <PlayingCard faceUp={false} style={{ width: SMALL_W, height: SMALL_H }} />
                        </div>
                      );
                    })}
                  </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Table – green oval like MeerMau */}
        <div style={{
          background: "#1a5c2e", borderRadius: Math.round(22 * cardScale),
          border: "4px solid #8B7355",
          padding: `${Math.round(20 * cardScale)}px ${Math.round(24 * cardScale)}px`,
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: Math.round(16 * cardScale), flexShrink: 0, marginBottom: 8,
        }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", position: "absolute", display: "none" }}>Tischmitte</div>
          {gs.tableCards.map((c, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <PlayingCard card={c} faceUp
                selectable={isMyTurn && gs.phase === "TURN"}
                selected={selectedTableIdx === i}
                onClick={() => handleTableCard(i)}
                style={{ width: CARD_W, height: CARD_H }}
              />
              {isMyTurn && gs.phase === "TURN" && selectedHandIdx !== null && (
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.7)", textAlign: "center" }}>antippen</div>
              )}
            </div>
          ))}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <PlayingCard faceUp={false} style={{ width: Math.round(44 * cardScale), height: Math.round(62 * cardScale) }} />
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.7)" }}>{deckCount} 🂠</div>
          </div>
        </div>

        {/* My hand */}
        <div style={{
          background: "var(--surface)", borderRadius: 12,
          padding: `${Math.round(8 * cardScale)}px ${Math.round(8 * cardScale)}px`,
          border: `1px solid ${isMyTurn && gs.phase === "TURN" ? TEAL + "55" : "var(--border)"}`,
          flexShrink: 0, marginBottom: 8,
        }}>
          <div style={{ display: "flex", gap: Math.round(12 * cardScale), justifyContent: "center" }}>
            {(myPlayer?.hand ?? []).map((c, i) => (
              <PlayingCard key={i} card={c} faceUp
                selectable={isMyTurn && gs.phase === "TURN"}
                selected={selectedHandIdx === i}
                onClick={() => handleHandCard(i)}
                style={{ width: CARD_W, height: CARD_H }}
              />
            ))}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-sub)", textAlign: "center", marginTop: 6 }}>
            {myPlayer?.displayName} · {myPlayer?.eliminated ? "❌ Ausgeschieden" : `${Array(myPlayer?.lives ?? 0).fill("🌊").join("")}${Array(LIVES_START - (myPlayer?.lives ?? 0)).fill("🤍").join("")}`}
            {" · "}
            <span style={{ color: myScore >= 25 ? TEAL : "var(--text-sub)", fontWeight: 700 }}>{formatScore(myScore)} P</span>
          </div>
          {isMyTurn && gs.phase === "TURN" && selectedHandIdx !== null && (
            <div style={{ fontSize: 12, color: TEAL, textAlign: "center", marginTop: 4 }}>
              Jetzt eine Tischkarte antippen zum Tauschen
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {!myPlayer?.eliminated && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
            {isMyTurn && gs.phase === "TURN" && !gs.aiThinking ? (
              <>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn" disabled={!canSwapOne}
                    style={{
                      flex: 1, background: canSwapOne ? TEAL : "var(--surface2)",
                      color: canSwapOne ? "white" : "var(--text-muted)",
                      border: `1px solid ${canSwapOne ? TEAL : "var(--border)"}`,
                      fontSize: 13, padding: "10px 6px",
                    }}
                    onClick={() => { if (selectedHandIdx !== null && selectedTableIdx !== null) { if (mode === "ai") executeLocalAction("SWAP_ONE", selectedHandIdx, selectedTableIdx); else executeOnlineAction("SWAP_ONE", selectedHandIdx, selectedTableIdx); } }}
                  >1 Karte tauschen</button>
                  <button className="btn" disabled={!canSwapAll}
                    style={{
                      flex: 1, background: "var(--surface2)", color: "var(--text)",
                      border: "1px solid var(--border)", fontSize: 13, padding: "10px 6px",
                    }}
                    onClick={handleSwapAll}
                  >Alle 3 tauschen</button>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {canPass && (
                    <button className="btn" style={{
                      flex: 1, background: "var(--surface2)", color: "var(--text-sub)",
                      border: "1px solid var(--border)", fontSize: 13, padding: "10px 6px",
                    }} onClick={handlePass}>Schieben</button>
                  )}
                  <button className="btn" style={{
                    flex: 1, background: "rgba(239,68,68,0.12)", color: "#ef4444",
                    border: "1px solid rgba(239,68,68,0.3)", fontSize: 13, padding: "10px 6px", fontWeight: 700,
                  }} onClick={handleKnock}>✊ Klopfen</button>
                </div>
              </>
            ) : gs.phase === "TURN" ? (
              <div style={{ textAlign: "center", padding: "10px", fontSize: 14, color: "var(--text-muted)" }}>
                {gs.aiThinking ? "🤖 KI überlegt…" : `Warte auf ${curPlayer?.displayName}…`}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* ── Round End Overlay ── */}
      {(gs.phase === "ROUND_END" || gs.phase === "GAME_OVER") && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(10,22,40,0.88)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50,
        }}>
          <div className="card" style={{ width: "min(340px, 90vw)", padding: "24px", textAlign: "center" }}>
            {gs.phase === "GAME_OVER" ? (
              <>
                <div style={{ fontSize: 48 }}>🏆</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "white", marginTop: 8 }}>
                  {gs.winnerId === myUserId ? "Du gewinnst!" : `${gs.players.find(p => p.userId === gs.winnerId)?.displayName} gewinnt!`}
                </div>
                <div style={{ marginTop: 12, fontSize: 13, color: "var(--text-sub)" }}>
                  {gs.round} Runden gespielt
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                  <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => navigate("/brandung/results")}>Ergebnisse</button>
                  <button className="btn" style={{ flex: 1, background: TEAL, color: "white" }} onClick={() => navigate("/brandung/lobby")}>Nochmal</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 36 }}>🃏</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "white", marginTop: 8 }}>Runde {gs.round} vorbei</div>
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                  {gs.players.filter(p => !p.eliminated).map(p => (
                    <div key={p.userId} style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "8px 12px", borderRadius: 8,
                      background: gs.roundLosers.includes(p.userId) ? "rgba(239,68,68,0.12)" : "rgba(13,148,136,0.1)",
                      border: `1px solid ${gs.roundLosers.includes(p.userId) ? "rgba(239,68,68,0.3)" : "rgba(13,148,136,0.25)"}`,
                    }}>
                      <span style={{ fontSize: 18 }}>{p.avatarUrl}</span>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--text)", textAlign: "left" }}>{p.displayName}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: gs.roundLosers.includes(p.userId) ? "#ef4444" : TEAL }}>
                        {formatScore(gs.roundScores[p.userId] ?? calcScore(p.hand))} P
                      </span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {Array(p.lives).fill("🌊").join("")}{Array(Math.max(0, LIVES_START - p.lives)).fill("🤍").join("")}
                      </span>
                    </div>
                  ))}
                </div>
                {gs.roundLosers.length > 0 && (
                  <div style={{ marginTop: 10, fontSize: 13, color: "#ef4444" }}>
                    {gs.roundLosers.map(id => gs.players.find(p => p.userId === id)?.displayName).join(", ")} verlier{gs.roundLosers.length === 1 ? "t" : "en"} 1 Leben!
                  </div>
                )}
                {mode === "ai" && (
                  <button className="btn" style={{ marginTop: 16, width: "100%", background: TEAL, color: "white" }}
                    onClick={continueRound}>Weiter →</button>
                )}
                {mode === "online" && (
                  <div style={{ marginTop: 16, fontSize: 13, color: "var(--text-muted)" }}>
                    Nächste Runde startet automatisch…
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Quit Dialog ── */}
      {showQuit && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(10,22,40,0.88)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60,
        }}>
          <div className="card" style={{ width: "min(300px, 90vw)", padding: "24px", textAlign: "center" }}>
            <div style={{ fontSize: 36 }}>🏳️</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 8 }}>Spiel verlassen?</div>
            <div style={{ fontSize: 13, color: "var(--text-sub)", marginTop: 6 }}>Der aktuelle Spielstand geht verloren.</div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowQuit(false)}>Weiter spielen</button>
              <button className="btn" style={{ flex: 1, background: "#ef4444", color: "white" }}
                onClick={() => navigate("/brandung/lobby")}>Verlassen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
