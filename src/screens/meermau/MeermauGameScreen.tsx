import { useEffect, useRef, useState } from "react";
import { doc, onSnapshot, addDoc, collection, getDoc } from "firebase/firestore";
import { useLocation, useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase";
import type { MeermauGame } from "../../types";
import {
  type MCard, type MSuit, type MeerMauDifficulty, type MeerMauSettings,
  MSUITS, canPlayMCard, calcHandPoints, getAIMMove, dealMCards,
  DEFAULT_MM_SETTINGS,
} from "./meermauLogic";
import { audioManager } from "../../audio/AudioManager";
import { getGameSave, saveGame, deleteGameSave, generateGameSaveId } from "../../gameSave";
import { GameSaveQuitDialog } from "../../components/GameHudBar";
import { PlayingCard, SuitIcon, SUIT_COLORS, SUIT_NAMES } from "../../components/PlayingCard";
import { CardFanRow } from "../../components/CardFanRow";

const VIOLET = "#7c3aed";
const AI_DELAY_MS = 1200;
const ELIMINATION_SCORE = 100;

// ── Local state types ─────────────────────────────────────────────────────────

interface MoveLogEntry {
  round: number;
  playerName: string;
  detail: string;
  ts: number;
}

interface LocalPlayer {
  userId: string;
  displayName: string;
  avatarUrl: string;
  hand: MCard[];
  isAI: boolean;
  totalScore: number;
  eliminated: boolean;
}

interface LocalState {
  players: LocalPlayer[];
  drawPile: MCard[];
  discardPile: MCard[];
  currentPlayerIndex: number;
  direction: 1 | -1;
  drawPending: number;
  wishSuit: MSuit | null;
  phase: "PLAYING" | "WISH" | "ROUND_END" | "GAME_OVER";
  mauPlayerId: string | null;
  pendingMau: string | null;
  pendingMauMau: string | null;
  mauMauReady: boolean;
  drawnCard: MCard | null;
  roundWinnerId: string | null;
  gameWinnerId: string | null;
  roundScores: Record<string, number>;
  round: number;
  lastActionText: string;
  aiThinking: boolean;
  difficulty: MeerMauDifficulty;
  settings: MeerMauSettings;
  lastSkippedId: string | null;
  moveLog: MoveLogEntry[];
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

function shuffleLocal(deck: MCard[]): MCard[] {
  const a = [...deck];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function reshuffleIfNeeded(draw: MCard[], discard: MCard[]): [MCard[], MCard[]] {
  if (draw.length > 0) return [draw, discard];
  if (discard.length <= 1) return [[], discard];
  const top = discard[discard.length - 1];
  return [shuffleLocal(discard.slice(0, -1)), [top]];
}

function nextIdx(from: number, dir: 1 | -1, players: LocalPlayer[], extraSkip = 0): number {
  const n = players.length;
  let idx = from;
  let steps = 1 + extraSkip;
  while (steps > 0) {
    idx = ((idx + dir) % n + n) % n;
    if (!players[idx].eliminated) steps--;
  }
  return idx;
}

/**
 * If a player played to 1 card but hasn't called MAU yet, and another player
 * now takes an action, draw 1 penalty card for the forgetful player first.
 */
function applyPendingMauPenalty(st: LocalState): LocalState {
  if (!st.pendingMau) return st;
  // Don't penalise if it's still the pendingMau player's own turn
  if (st.players[st.currentPlayerIndex]?.userId === st.pendingMau) return st;
  const pidx = st.players.findIndex(p => p.userId === st.pendingMau);
  if (pidx < 0) return { ...st, pendingMau: null };
  const pp = st.players[pidx];
  let [draw, discard] = reshuffleIfNeeded(st.drawPile, st.discardPile);
  if (draw.length === 0) return { ...st, pendingMau: null };
  const penaltyCard = draw[0];
  draw = draw.slice(1);
  const updatedPlayers = st.players.map((p, i) => i === pidx ? { ...p, hand: [...p.hand, penaltyCard] } : p);
  const entry: MoveLogEntry = { round: st.round, playerName: pp.displayName, detail: `${pp.displayName} vergisst MAU — zieht 1 Strafkarte`, ts: Date.now() };
  return { ...st, players: updatedPlayers, drawPile: draw, discardPile: discard, pendingMau: null, moveLog: [...st.moveLog, entry] };
}

/** Same as applyPendingMauPenalty but for forgotten MAU MAU (played last card, didn't call MAU MAU). */
function applyPendingMauMauPenalty(st: LocalState): LocalState {
  if (!st.pendingMauMau) return st;
  if (st.players[st.currentPlayerIndex]?.userId === st.pendingMauMau) return st;
  const pidx = st.players.findIndex(p => p.userId === st.pendingMauMau);
  if (pidx < 0) return { ...st, pendingMauMau: null };
  const pp = st.players[pidx];
  let [draw, discard] = reshuffleIfNeeded(st.drawPile, st.discardPile);
  if (draw.length === 0) return { ...st, pendingMauMau: null };
  const penaltyCard = draw[0];
  draw = draw.slice(1);
  const updatedPlayers = st.players.map((p, i) => i === pidx ? { ...p, hand: [...p.hand, penaltyCard] } : p);
  const entry: MoveLogEntry = { round: st.round, playerName: pp.displayName, detail: `${pp.displayName} vergisst MAU MAU — zieht 1 Strafkarte`, ts: Date.now() };
  return { ...st, players: updatedPlayers, drawPile: draw, discardPile: discard, pendingMauMau: null, moveLog: [...st.moveLog, entry] };
}

function doPlayCard(
  st: LocalState, playerIdx: number, cardId: string, wishSuit?: MSuit,
): LocalState {
  // Apply any pending MAU / MAU MAU penalties before the new action
  st = applyPendingMauPenalty(st);
  st = applyPendingMauMauPenalty(st);

  const player = st.players[playerIdx];
  const card = player.hand.find(c => c.id === cardId);
  if (!card) return st;

  const newHand = player.hand.filter(c => c.id !== cardId);
  const newDiscard = [...st.discardPile, card];
  let draw = st.drawPile;
  let drawPending = st.drawPending;
  let ws = st.wishSuit;
  let dir = st.direction;
  let extraSkip = 0;
  let lastSkippedId: string | null = null;
  let txt = `${player.displayName} spielt ${card.rank}${card.suit}`;

  if (card.rank === "7") {
    drawPending += 2;
    txt = `${player.displayName} spielt 7 — Ziehzwang auf ${drawPending}!`;
  } else if (card.rank === "8") {
    if (st.settings.stopperOn8 && st.drawPending > 0) {
      drawPending = 0;
      txt = `${player.displayName} stoppt den Ziehzwang mit 8!`;
    } else {
      extraSkip = 1;
      const skippedIdx = nextIdx(playerIdx, dir, st.players);
      lastSkippedId = st.players[skippedIdx].userId;
      txt = `${player.displayName} spielt 8 — ${st.players[skippedIdx].displayName} setzt aus!`;
    }
  } else if (card.rank === "9" && st.settings.reverseOn9) {
    dir = (dir * -1) as 1 | -1;
    ws = null;
    txt = `${player.displayName} kehrt die Richtung um!`;
  } else if (card.rank === "J" || (st.settings.wildOn10 && card.rank === "10")) {
    if (wishSuit) {
      ws = wishSuit;
      const sn: Record<MSuit, string> = { "♣": "Kreuz", "♠": "Pik", "♥": "Herz", "♦": "Karo" };
      txt = `${player.displayName} wünscht ${sn[wishSuit]}!`;
    } else {
      // Need wish — return WISH phase (human player path)
      const updated = st.players.map((p, i) => i === playerIdx ? { ...p, hand: newHand } : p);
      const wishEntry: MoveLogEntry = { round: st.round, playerName: player.displayName, detail: txt, ts: Date.now() };
      return { ...st, players: updated, discardPile: newDiscard, phase: "WISH", drawnCard: null, aiThinking: false, moveLog: [...st.moveLog, wishEntry] };
    }
  } else {
    ws = null;
  }

  const updated = st.players.map((p, i) => i === playerIdx ? { ...p, hand: newHand } : p);
  const entry: MoveLogEntry = { round: st.round, playerName: player.displayName, detail: txt, ts: Date.now() };
  const nextPlayer = nextIdx(playerIdx, dir, updated, extraSkip);

  // 0 cards: AI auto-wins; human wins only if they pre-declared MAU MAU, otherwise pendingMauMau
  if (newHand.length === 0) {
    if (playerIdx !== 0 || st.mauMauReady) {
      return resolveRound({ ...st, players: updated, discardPile: newDiscard, drawPile: draw, drawPending: 0, wishSuit: null, direction: dir, roundWinnerId: player.userId, lastActionText: `🏆 ${player.displayName} gewinnt die Runde!`, aiThinking: false, lastSkippedId: null, mauMauReady: false, pendingMauMau: null, moveLog: [...st.moveLog, entry] });
    } else {
      // Human played last card without pressing MAU MAU — set pending, move to next player
      return { ...st, players: updated, discardPile: newDiscard, drawPile: draw, drawPending: 0, wishSuit: null, direction: dir, currentPlayerIndex: nextPlayer, phase: "PLAYING", pendingMauMau: player.userId, mauMauReady: false, drawnCard: null, lastActionText: `${player.displayName} spielt letzte Karte!`, aiThinking: false, lastSkippedId: null, moveLog: [...st.moveLog, entry] };
    }
  }

  // 1 card left: AI auto-calls MAU; human must press the button
  if (newHand.length === 1) {
    if (playerIdx !== 0 || st.mauPlayerId === player.userId) {
      // AI always auto-calls MAU; human auto-passes if they already declared before playing
      const aiMauTxt = `${player.displayName}: MAU!`;
      const mauEntry: MoveLogEntry = { round: st.round, playerName: player.displayName, detail: aiMauTxt, ts: Date.now() + 1 };
      const logs = playerIdx !== 0 ? [...st.moveLog, entry, mauEntry] : [...st.moveLog, entry];
      return { ...st, players: updated, discardPile: newDiscard, drawPile: draw, drawPending, wishSuit: ws, direction: dir, currentPlayerIndex: nextPlayer, phase: "PLAYING", mauPlayerId: player.userId, pendingMau: null, drawnCard: null, lastActionText: aiMauTxt, aiThinking: false, lastSkippedId, moveLog: logs };
    } else {
      // Human must press MAU before next player acts
      return { ...st, players: updated, discardPile: newDiscard, drawPile: draw, drawPending, wishSuit: ws, direction: dir, currentPlayerIndex: nextPlayer, phase: "PLAYING", mauPlayerId: null, pendingMau: player.userId, drawnCard: null, lastActionText: txt, aiThinking: false, lastSkippedId, moveLog: [...st.moveLog, entry] };
    }
  }

  return { ...st, players: updated, discardPile: newDiscard, drawPile: draw, drawPending, wishSuit: ws, direction: dir, currentPlayerIndex: nextPlayer, phase: "PLAYING", drawnCard: null, lastActionText: txt, aiThinking: false, lastSkippedId, moveLog: [...st.moveLog, entry] };
}

function doDrawCard(st: LocalState, playerIdx: number): LocalState {
  st = applyPendingMauPenalty(st);
  st = applyPendingMauMauPenalty(st);
  const player = st.players[playerIdx];
  const count = st.drawPending > 0 ? st.drawPending : 1;
  let [draw, discard] = reshuffleIfNeeded(st.drawPile, st.discardPile);

  const drawn: MCard[] = [];
  for (let i = 0; i < count; i++) {
    if (draw.length === 0) {
      [draw, discard] = reshuffleIfNeeded(draw, discard);
      if (draw.length === 0) break;
    }
    drawn.push(draw[0]);
    draw = draw.slice(1);
  }

  const newHand = [...player.hand, ...drawn];
  const updated = st.players.map((p, i) => i === playerIdx ? { ...p, hand: newHand } : p);
  // If this player had said Mau but now draws cards, reset the Mau declaration
  const newMauPlayerId = st.mauPlayerId === player.userId ? null : st.mauPlayerId;

  // Penalty draw → advance turn
  if (st.drawPending > 0) {
    const nextPlayer = nextIdx(playerIdx, st.direction, updated);
    const penaltyTxt = `${player.displayName} zieht ${drawn.length} Karten (Strafe)`;
    const penaltyEntry: MoveLogEntry = { round: st.round, playerName: player.displayName, detail: penaltyTxt, ts: Date.now() };
    return { ...st, players: updated, drawPile: draw, discardPile: discard, drawPending: 0, mauPlayerId: newMauPlayerId, currentPlayerIndex: nextPlayer, phase: "PLAYING", drawnCard: null, lastActionText: penaltyTxt, aiThinking: false, moveLog: [...st.moveLog, penaltyEntry] };
  }

  // Normal draw — offer to play if possible
  const top = discard[discard.length - 1];
  const dc = drawn[0] ?? null;
  const canPlay = dc && top ? canPlayMCard(dc, top, st.wishSuit, 0, st.settings) : false;

  if (!canPlay || !dc) {
    const nextPlayer = nextIdx(playerIdx, st.direction, updated);
    const drawTxt = `${player.displayName} zieht eine Karte`;
    const drawEntry: MoveLogEntry = { round: st.round, playerName: player.displayName, detail: drawTxt, ts: Date.now() };
    return { ...st, players: updated, drawPile: draw, discardPile: discard, mauPlayerId: newMauPlayerId, currentPlayerIndex: nextPlayer, phase: "PLAYING", drawnCard: null, lastActionText: drawTxt, aiThinking: false, moveLog: [...st.moveLog, drawEntry] };
  }

  const offerTxt = `${player.displayName} zieht ${dc.rank}${dc.suit} — spielen?`;
  const offerEntry: MoveLogEntry = { round: st.round, playerName: player.displayName, detail: offerTxt, ts: Date.now() };
  return { ...st, players: updated, drawPile: draw, discardPile: discard, mauPlayerId: newMauPlayerId, drawnCard: dc, lastActionText: offerTxt, aiThinking: false, moveLog: [...st.moveLog, offerEntry] };
}

function resolveRound(st: LocalState): LocalState {
  const scores: Record<string, number> = {};
  for (const p of st.players) {
    if (p.eliminated) continue;
    scores[p.userId] = p.userId === st.roundWinnerId ? 0 : calcHandPoints(p.hand);
  }

  const updated = st.players.map(p => {
    if (p.eliminated) return p;
    const add = scores[p.userId] ?? 0;
    const newTotal = p.totalScore + add;
    return { ...p, totalScore: newTotal, eliminated: newTotal >= ELIMINATION_SCORE };
  });

  const alive = updated.filter(p => !p.eliminated);
  if (alive.length <= 1) {
    const winner = alive[0] ?? [...updated].sort((a, b) => a.totalScore - b.totalScore)[0];
    return { ...st, players: updated, roundScores: scores, gameWinnerId: winner.userId, phase: "GAME_OVER", aiThinking: false };
  }

  return { ...st, players: updated, roundScores: scores, phase: "ROUND_END", aiThinking: false };
}

function doStartNewRound(st: LocalState): LocalState {
  const alive = st.players.filter(p => !p.eliminated);
  const { hands, drawPile, topCard } = dealMCards(alive.length);
  const updated = st.players.map(p => {
    if (p.eliminated) return { ...p, hand: [] };
    const ai = alive.findIndex(a => a.userId === p.userId);
    return { ...p, hand: hands[ai] ?? [] };
  });
  return {
    ...st, players: updated, drawPile, discardPile: [topCard],
    currentPlayerIndex: 0, direction: 1, drawPending: 0, wishSuit: null,
    phase: "PLAYING", mauPlayerId: null, pendingMau: null, pendingMauMau: null, mauMauReady: false, drawnCard: null,
    roundWinnerId: null, roundScores: {},
    round: st.round + 1, lastActionText: "Neue Runde!", aiThinking: false, lastSkippedId: null,
    moveLog: [...st.moveLog, { round: st.round + 1, playerName: "System", detail: `── Runde ${st.round + 1} beginnt ──`, ts: Date.now() }],
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

interface LocState {
  mode: "ai" | "online";
  aiCount?: number;
  difficulty?: MeerMauDifficulty;
  settings?: MeerMauSettings;
  gameId?: string;
  saveId?: string;
}

export default function MeermauGameScreen() {
  const navigate = useNavigate();
  const { state: locState } = useLocation() as { state: LocState };
  const uid = auth.currentUser?.uid ?? "";
  const mode = locState?.mode ?? "ai";
  const aiCount = locState?.aiCount ?? 1;
  const difficulty = (locState?.difficulty ?? "SNIPER") as MeerMauDifficulty;
  const initSettings = locState?.settings ?? DEFAULT_MM_SETTINGS;
  const gameId = locState?.gameId ?? null;
  const saveId = locState?.saveId ?? null;

  const [localState, setLocalState] = useState<LocalState | null>(null);
  const [_onlineGame, setOnlineGame] = useState<MeermauGame | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showQuit, setShowQuit] = useState(false);
  const unsubRef = useRef<(() => void) | null>(null);

  // Responsive card sizing for tablets
  const [winW, setWinW] = useState(window.innerWidth);
  useEffect(() => {
    const h = () => setWinW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  const effectiveW = Math.min(winW, 520);
  const cardScale = Math.min(Math.max(effectiveW / 390, 1), 2.2);
  const CARD_W = Math.round(58 * cardScale);
  const CARD_H = Math.round(84 * cardScale);
  const SMALL_W = Math.round(36 * cardScale);
  const SMALL_H = Math.round(52 * cardScale);

  // Player hand: clamp so 5 cards always fit without scrolling
  const HAND_GAP = Math.round(5 * cardScale);
  const handContainerW = effectiveW - 24 - Math.round(16 * cardScale); // outer 12*2 + inner padding
  const maxHandCardW = Math.floor((handContainerW - HAND_GAP * 4) / 5);
  const HAND_W = Math.min(CARD_W, maxHandCardW);
  const HAND_H = Math.round(CARD_H * HAND_W / CARD_W);

  // ── Restore from save ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!saveId) return;
    const save = getGameSave("meermau");
    if (!save || save.id !== saveId) return;
    try {
      const s = JSON.parse(save.gameState) as LocalState;
      setLocalState({ ...s, aiThinking: false });
    } catch { /* ignore corrupt save */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Init AI game ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== "ai" || saveId) return;
    getDoc(doc(db, "users", uid)).then(snap => {
      const ud = snap.exists() ? snap.data() : {};
      const { hands, drawPile, topCard } = dealMCards(1 + aiCount);
      const aiNames = ["Mia", "Leo", "Sam"];
      const aiAvatars = ["🤖", "🦈", "🐠"];
      const players: LocalPlayer[] = [
        { userId: uid, displayName: ud.displayName ?? "Du", avatarUrl: ud.avatarUrl ?? "🏖️", hand: hands[0], isAI: false, totalScore: 0, eliminated: false },
        ...Array.from({ length: aiCount }, (_, i) => ({
          userId: `ai_${i}`, displayName: aiNames[i] ?? `KI ${i + 1}`, avatarUrl: aiAvatars[i] ?? "🤖",
          hand: hands[i + 1], isAI: true, totalScore: 0, eliminated: false,
        })),
      ];
      setLocalState({
        players, drawPile, discardPile: [topCard],
        currentPlayerIndex: 0, direction: 1, drawPending: 0,
        wishSuit: null, phase: "PLAYING", mauPlayerId: null, pendingMau: null, pendingMauMau: null, mauMauReady: false, drawnCard: null,
        roundWinnerId: null, gameWinnerId: null, roundScores: {},
        round: 1, lastActionText: "Dein Zug!", aiThinking: false,
        difficulty, settings: initSettings, lastSkippedId: null, moveLog: [],
      });
    });
    return () => { unsubRef.current?.(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Online subscription ─────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== "online" || !gameId) return;
    const unsub = onSnapshot(doc(db, "meermauGames", gameId), snap => {
      if (snap.exists()) setOnlineGame({ gameId: snap.id, ...snap.data() } as MeermauGame);
    });
    unsubRef.current = unsub;
    return () => unsub();
  }, [mode, gameId]);

  // ── AI turn ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!localState || mode !== "ai" || localState.phase !== "PLAYING") return;
    const cp = localState.players[localState.currentPlayerIndex];
    if (!cp?.isAI) return;
    const top = localState.discardPile[localState.discardPile.length - 1];
    if (!top) return;

    const t = setTimeout(() => {
      setLocalState(prev => {
        if (!prev || prev.phase !== "PLAYING") return prev;
        const cpi = prev.currentPlayerIndex;
        const cur = prev.players[cpi];
        if (!cur?.isAI) return prev;
        const topC = prev.discardPile[prev.discardPile.length - 1];
        if (!topC) return prev;

        const move = getAIMMove(cur.hand, topC, prev.wishSuit, prev.drawPending, prev.difficulty, prev.settings);
        if (move.type === "DRAW") return doDrawCard(prev, cpi);
        return doPlayCard(prev, cpi, move.cardId, move.wishSuit);
      });
    }, AI_DELAY_MS);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localState?.currentPlayerIndex, localState?.phase]);

  // ── AI drawn-card decision ───────────────────────────────────────────────────
  useEffect(() => {
    if (!localState || mode !== "ai" || !localState.drawnCard) return;
    const cp = localState.players[localState.currentPlayerIndex];
    if (!cp?.isAI) return;
    const top = localState.discardPile[localState.discardPile.length - 1];
    if (!top) return;

    const t = setTimeout(() => {
      setLocalState(prev => {
        if (!prev || !prev.drawnCard) return prev;
        const cpi = prev.currentPlayerIndex;
        const cur = prev.players[cpi];
        if (!cur?.isAI) return prev;
        const topC = prev.discardPile[prev.discardPile.length - 1];
        if (!topC) return prev;
        const dCard = prev.drawnCard;
        if (!dCard) return prev;

        if (canPlayMCard(dCard, topC, prev.wishSuit, 0, prev.settings)) {
          // Pick wish suit if needed
          const ws = (dCard.rank === "J" || (prev.settings.wildOn10 && dCard.rank === "10"))
            ? (prev.difficulty === "ROOKIE"
              ? MSUITS[Math.floor(Math.random() * 4)]
              : (() => {
                  const counts: Record<MSuit, number> = { "♣": 0, "♠": 0, "♥": 0, "♦": 0 };
                  cur.hand.forEach(c => { if (c.id !== dCard.id) counts[c.suit]++; });
                  return (Object.entries(counts) as [MSuit, number][]).sort(([, a], [, b]) => b - a)[0]?.[0] ?? "♥";
                })())
            : undefined;
          return doPlayCard(prev, cpi, dCard.id, ws);
        }
        // Can't play — pass turn
        const np = nextIdx(cpi, prev.direction, prev.players);
        return { ...prev, drawnCard: null, currentPlayerIndex: np, phase: "PLAYING" };
      });
    }, AI_DELAY_MS / 2);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localState?.drawnCard]);

  // ── Save result on game over ────────────────────────────────────────────────
  useEffect(() => {
    if (!localState || localState.phase !== "GAME_OVER" || !uid) return;
    const playerIds = localState.players.map(p => p.userId);
    const finalScores: Record<string, number> = {};
    localState.players.forEach(p => { finalScores[p.userId] = p.totalScore; });
    addDoc(collection(db, "meermauResults"), {
      playerIds, winnerId: localState.gameWinnerId,
      scores: finalScores, rounds: localState.round,
      createdAt: Date.now(),
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localState?.phase]);

  // ── Phase change sounds ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!localState) return;
    if (localState.phase === "ROUND_END") audioManager.playSound("level_complete");
    if (localState.phase === "GAME_OVER") audioManager.playSound("game_over");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localState?.phase]);

  // ── Derive render values ────────────────────────────────────────────────────
  const st = localState;
  const humanPlayer = st?.players[0] ?? null;
  const opponents = st?.players.slice(1) ?? [];
  const cp = st ? st.players[st.currentPlayerIndex] : null;
  const isMyTurn = cp?.userId === uid && !st?.aiThinking;
  const topCard = st ? st.discardPile[st.discardPile.length - 1] ?? null : null;

  const playableIds = (isMyTurn && st?.phase === "PLAYING" && topCard)
    ? new Set(humanPlayer?.hand.filter(c => canPlayMCard(c, topCard, st.wishSuit, st.drawPending, st.settings)).map(c => c.id) ?? [])
    : new Set<string>();

  // ── Handlers ────────────────────────────────────────────────────────────────
  function handleCardClick(cardId: string) {
    if (!st || !isMyTurn || st.phase !== "PLAYING") return;
    if (!playableIds.has(cardId)) { setSelectedCardId(prev => prev === cardId ? null : cardId); audioManager.playSound("card_select"); return; }
    if (selectedCardId !== cardId) { setSelectedCardId(cardId); audioManager.playSound("card_select"); return; }
    // Second click → play (all cards including last — MAU MAU can be pressed separately)
    const card = humanPlayer?.hand.find(c => c.id === cardId);
    if (!card) return;
    audioManager.playSound("card_place");
    setLocalState(prev => prev ? doPlayCard(prev, 0, cardId) : prev);
    if (card.rank !== "J" && !(st.settings.wildOn10 && card.rank === "10")) setSelectedCardId(null);
  }

  function handleMauMau() {
    if (!st) return;
    audioManager.playSound("card_feuer");
    // Post-play: human played last card, now pressing MAU MAU → win
    if (st.pendingMauMau === uid) {
      setLocalState(prev => {
        if (!prev || prev.pendingMauMau !== uid) return prev;
        const ph = prev.players.find(p => p.userId === uid);
        if (!ph || ph.hand.length !== 0) return prev;
        const entry: MoveLogEntry = { round: prev.round, playerName: ph.displayName, detail: `🏆 ${ph.displayName}: MAU MAU!`, ts: Date.now() };
        const result = resolveRound({ ...prev, pendingMauMau: null, roundWinnerId: uid, lastActionText: `🏆 ${ph.displayName}: MAU MAU!` });
        return { ...result, moveLog: [...result.moveLog, entry] };
      });
      return;
    }
    // Pre-play: declare MAU MAU before playing the last card
    if (!isMyTurn || st.phase !== "PLAYING" || humanPlayer?.hand.length !== 1 || playableIds.size === 0) return;
    const mp = st.players[0];
    setLocalState(prev => {
      if (!prev) return prev;
      const entry: MoveLogEntry = { round: prev.round, playerName: mp.displayName, detail: `${mp.displayName}: MAU MAU! (bereit)`, ts: Date.now() };
      return { ...prev, mauMauReady: true, moveLog: [...prev.moveLog, entry] };
    });
  }

  function handleDraw() {
    if (!st || !isMyTurn || st.phase !== "PLAYING") return;
    audioManager.playSound("card_draw");
    setLocalState(prev => prev ? doDrawCard(prev, 0) : prev);
    setSelectedCardId(null);
  }

  function handleDrawnCardPlay() {
    if (!st || !st.drawnCard || !topCard) return;
    const dc = st.drawnCard;
    if (!canPlayMCard(dc, topCard, st.wishSuit, 0, st.settings)) return;
    audioManager.playSound("card_place");
    setLocalState(prev => prev ? doPlayCard(prev, 0, dc.id) : prev);
  }

  function handleDrawnCardPass() {
    if (!st) return;
    const np = nextIdx(0, st.direction, st.players);
    setLocalState(prev => prev ? { ...prev, drawnCard: null, currentPlayerIndex: np, phase: "PLAYING" } : prev);
  }

  function handleWishSelect(suit: MSuit) {
    if (!st || st.phase !== "WISH") return;
    const human = st.players[0];
    const sn: Record<MSuit, string> = { "♣": "Kreuz", "♠": "Pik", "♥": "Herz", "♦": "Karo" };
    const np = nextIdx(0, st.direction, st.players);
    setLocalState(prev => {
      if (!prev || prev.phase !== "WISH") return prev;
      const h = prev.players[0];
      if (h.hand.length === 0) {
        if (prev.mauMauReady) {
          return resolveRound({ ...prev, wishSuit: suit, roundWinnerId: h.userId, mauMauReady: false, lastActionText: `🏆 ${h.displayName} gewinnt die Runde!` });
        }
        return { ...prev, wishSuit: suit, phase: "PLAYING", currentPlayerIndex: np, pendingMauMau: h.userId, mauMauReady: false, lastActionText: `${h.displayName} spielt letzte Karte!` };
      } else if (h.hand.length === 1) {
        // Played J as second-to-last card → must call MAU
        return { ...prev, wishSuit: suit, phase: "PLAYING", mauPlayerId: null, pendingMau: h.userId, currentPlayerIndex: np, lastActionText: `${h.displayName} wünscht ${sn[suit]}!` };
      }
      return { ...prev, wishSuit: suit, phase: "PLAYING", currentPlayerIndex: np, lastActionText: `${h.displayName} wünscht ${sn[suit]}!` };
    });
    void human; // used implicitly above
    setSelectedCardId(null);
  }

  function handleMau() {
    if (!st) return;
    const mp = st.players[0];
    const postPlay = st.pendingMau === uid;
    const prePlay = isMyTurn && st.phase === "PLAYING" && humanPlayer?.hand.length === 2 && !!selectedCardId && playableIds.has(selectedCardId);
    if (!postPlay && !prePlay) return;
    audioManager.playSound("card_knock");
    const mauTxt = `${mp?.displayName ?? "Du"}: MAU!`;
    setLocalState(prev => {
      if (!prev) return prev;
      const entry: MoveLogEntry = { round: prev.round, playerName: mp?.displayName ?? "Du", detail: mauTxt, ts: Date.now() };
      return { ...prev, pendingMau: null, mauPlayerId: uid, lastActionText: mauTxt, moveLog: [...prev.moveLog, entry] };
    });
  }

  // ── Online move handlers ─────────────────────────────────────────────────────
  // ── Status text ──────────────────────────────────────────────────────────────
  const statusText = (() => {
    if (!st) return "Lädt…";
    if (st.aiThinking) return "KI denkt…";
    if (st.pendingMauMau === uid) return "⚡ Schnell MAU MAU drücken!";
    if (st.pendingMau === uid) return "⚡ Schnell MAU drücken!";
    if (st.drawnCard && isMyTurn) return `${st.drawnCard.rank}${st.drawnCard.suit} gezogen — spielen?`;
    if (isMyTurn) return "Du bist dran";
    return `${cp?.displayName ?? ""} ist dran…`;
  })();

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="screen" style={{ padding: 0, gap: 0, overflow: "hidden" }}>
      {/* Header */}
      <div style={{
        padding: "10px 14px", display: "flex", alignItems: "center", gap: 12,
        background: "var(--surface)", borderBottom: "1px solid var(--border)", flexShrink: 0,
      }}>
        <button className="btn btn-outline btn-sm" style={{ width: 36, padding: 0, fontSize: 16 }}
          onClick={() => setShowQuit(true)}>‹</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 17, color: VIOLET }}>MeerMau</div>
          <div style={{ fontSize: 11, color: "var(--text-sub)" }}>Runde {st?.round ?? 1}</div>
        </div>
        {st?.settings.reverseOn9 && (
          <div style={{ fontSize: 22, color: VIOLET }}>
            {st.direction === 1 ? "↻" : "↺"}
          </div>
        )}
        <button
          className="btn btn-outline btn-sm"
          style={{ width: 36, padding: 0, fontSize: 16, position: "relative" }}
          onClick={() => setShowHistory(true)}
          title="Spielverlauf"
        >
          📋
          {st && st.moveLog.length > 0 && (
            <span style={{
              position: "absolute", top: -4, right: -4,
              background: VIOLET, color: "white", borderRadius: "50%",
              width: 14, height: 14, fontSize: 8, fontWeight: 900,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>{st.moveLog.length > 99 ? "99+" : st.moveLog.length}</span>
          )}
        </button>
      </div>

      {st ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "10px 12px", gap: 10, overflow: "hidden" }}>

          {/* Opponents */}
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            {opponents.map(opp => {
              const oppIdx = st.players.indexOf(opp);
              const isCurrent = oppIdx === st.currentPlayerIndex;
              const isMau = opp.userId === st.mauPlayerId;
              const fanCount = Math.min(opp.hand.length, 12);
              const fanSpread = fanCount > 1 ? Math.min(14, Math.round(SMALL_W * 0.55)) : 0;
              const fanWidth = fanCount > 0 ? SMALL_W + fanSpread * (fanCount - 1) : SMALL_W;
              return (
                <div key={opp.userId} style={{
                  flex: 1, background: isCurrent ? `${VIOLET}1a` : "var(--surface2)",
                  border: `1px solid ${isCurrent ? VIOLET : "var(--border)"}`,
                  borderRadius: 10, padding: "8px 10px", opacity: opp.eliminated ? 0.35 : 1,
                  display: "flex", flexDirection: "column", gap: 6,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 18 }}>{opp.avatarUrl}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {opp.displayName}
                        {isMau && <span style={{ color: VIOLET, marginLeft: 4, fontSize: 10 }}>MAU!</span>}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-sub)" }}>
                        {opp.eliminated ? "OUT" : `${opp.hand.length} Karten · ${opp.totalScore}P`}
                      </div>
                    </div>
                  </div>
                  {/* Fan display */}
                  <div style={{ position: "relative", height: SMALL_H + 8, width: Math.min(fanWidth, 160), flexShrink: 0, alignSelf: "center" }}>
                    {Array.from({ length: fanCount }).map((_, ci) => {
                      const midIdx = (fanCount - 1) / 2;
                      const angle = (ci - midIdx) * (fanCount > 1 ? Math.min(8, 40 / fanCount) : 0);
                      const xOff = ci * fanSpread;
                      const yOff = Math.abs(ci - midIdx) * 1.5;
                      return (
                        <div key={ci} style={{
                          position: "absolute", left: xOff, top: yOff,
                          transform: `rotate(${angle}deg)`,
                          transformOrigin: "bottom center",
                        }}>
                          <PlayingCard faceUp={false} small accentColor={VIOLET} w={SMALL_W} h={SMALL_H} />
                        </div>
                      );
                    })}
                    {opp.hand.length > 12 && (
                      <span style={{
                        position: "absolute", right: -18, top: "50%", transform: "translateY(-50%)",
                        fontSize: Math.round(9 * cardScale), color: "var(--text-sub)", fontWeight: 700,
                      }}>+{opp.hand.length - 12}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Table */}
          <div style={{
            background: "#1a5c2e", borderRadius: Math.round(60 * cardScale), border: "4px solid #8B7355",
            padding: `${Math.round(18 * cardScale)}px ${Math.round(32 * cardScale)}px`,
            display: "flex", alignItems: "center", justifyContent: "center", gap: Math.round(20 * cardScale), flexShrink: 0,
          }}>
            {/* Draw pile */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ position: "relative" }}>
                <PlayingCard faceUp={false} accentColor={VIOLET} w={CARD_W} h={CARD_H} style={{ cursor: isMyTurn && st.phase === "PLAYING" && !st.drawnCard ? "pointer" : "default" }} onClick={isMyTurn && st.phase === "PLAYING" && !st.drawnCard ? handleDraw : undefined} />
                {st.drawPending > 0 && (
                  <div style={{
                    position: "absolute", top: -8, right: -8,
                    background: "#ef4444", color: "white", borderRadius: "50%",
                    width: 22, height: 22, fontSize: 11, fontWeight: 900,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>+{st.drawPending}</div>
                )}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-sub)" }}>{st.drawPile.length} ⬛</div>
            </div>

            {/* Center */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              {st.wishSuit && (
                <div style={{
                  background: VIOLET, color: "white", borderRadius: 8,
                  padding: "4px 10px", fontSize: 12, fontWeight: 700,
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <SuitIcon suit={st.wishSuit} size={18} />
                  {SUIT_NAMES[st.wishSuit] ?? st.wishSuit}
                </div>
              )}
              {st.drawPending > 0 && !st.wishSuit && (
                <div style={{ fontSize: 12, color: "#ef4444", fontWeight: 700 }}>
                  ⚡ {st.drawPending} Karten
                </div>
              )}
              {st.lastSkippedId && (
                <div style={{ fontSize: 10, color: "#f59e0b", textAlign: "center" }}>
                  {st.players.find(p => p.userId === st.lastSkippedId)?.displayName} setzt aus
                </div>
              )}
            </div>

            {/* Discard pile */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              {topCard && <PlayingCard card={topCard} faceUp accentColor={VIOLET} w={CARD_W} h={CARD_H} />}
              <div style={{ fontSize: Math.round(10 * cardScale), color: "var(--text-sub)" }}>Ablage</div>
            </div>
          </div>

          {/* Status */}
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: isMyTurn ? VIOLET : "var(--text-sub)" }}>
              {statusText}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
              {st.lastActionText}
            </div>
          </div>

          {/* Human hand */}
          <div style={{
            background: "var(--surface)", borderRadius: 12, padding: `${Math.round(8 * cardScale)}px ${Math.round(8 * cardScale)}px`,
            border: `1px solid ${isMyTurn && st.phase === "PLAYING" ? VIOLET + "55" : "var(--border)"}`,
            flexShrink: 0,
          }}>
            <div style={{ display: "flex", gap: HAND_GAP, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" as const, justifyContent: "center" }}>
              <CardFanRow
                cards={humanPlayer?.hand ?? []}
                cardWidth={HAND_W} cardHeight={HAND_H}
                renderCard={(card, _i) => (
                  <PlayingCard
                    card={card} faceUp accentColor={VIOLET}
                    selected={selectedCardId === card.id}
                    playable={isMyTurn && st.phase === "PLAYING" && playableIds.has(card.id)}
                    onClick={() => handleCardClick(card.id)}
                    w={HAND_W} h={HAND_H}
                  />
                )}
              />
              {/* Drawn card offer */}
              {st.drawnCard && isMyTurn && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginLeft: Math.round(6 * cardScale), flexShrink: 0 }}>
                  <div style={{ fontSize: Math.round(9 * cardScale), color: VIOLET, marginBottom: 3, fontWeight: 700 }}>GEZOGEN</div>
                  <PlayingCard
                    card={st.drawnCard} faceUp accentColor={VIOLET}
                    playable={!!topCard && canPlayMCard(st.drawnCard, topCard, st.wishSuit, 0, st.settings)}
                    style={{ border: `2px dashed ${VIOLET}` }}
                    onClick={handleDrawnCardPlay}
                    w={HAND_W} h={HAND_H}
                  />
                </div>
              )}
            </div>
            <div style={{ fontSize: Math.round(10 * cardScale), color: "var(--text-sub)", textAlign: "center", marginTop: 4 }}>
              Du · {humanPlayer?.hand.length ?? 0} Karten · {humanPlayer?.totalScore ?? 0} Punkte
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
            {/* Draw button */}
            {isMyTurn && st.phase === "PLAYING" && !st.drawnCard && (
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={handleDraw}>
                {st.drawPending > 0 ? `${st.drawPending} Karten ziehen` : "Karte ziehen"}
              </button>
            )}
            {/* Drawn-card offer buttons */}
            {st.drawnCard && isMyTurn && (
              <>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={handleDrawnCardPass}>
                  Behalten
                </button>
                {topCard && canPlayMCard(st.drawnCard, topCard, st.wishSuit, 0, st.settings) && (
                  <button className="btn" style={{ flex: 1, background: VIOLET, color: "white", fontWeight: 700 }}
                    onClick={handleDrawnCardPlay}>
                    Spielen
                  </button>
                )}
              </>
            )}
            {/* Regular Spielen — for all cases (including last card) */}
            {selectedCardId && isMyTurn && st.phase === "PLAYING" && playableIds.has(selectedCardId) && !st.drawnCard && (
              <button className="btn" style={{ flex: 1, background: VIOLET, color: "white", fontWeight: 700 }}
                onClick={() => handleCardClick(selectedCardId)}>
                Spielen
              </button>
            )}
            {/* MAU button: shown next to Spielen when hand=2 & card selected, OR post-play (pendingMau) */}
            {((isMyTurn && st.phase === "PLAYING" && humanPlayer?.hand.length === 2 && !!selectedCardId && playableIds.has(selectedCardId) && !st.drawnCard)
              || st.pendingMau === uid) && (
              <button className="btn" style={{ flex: 1, background: "#e67e22", color: "white", fontWeight: 900, fontSize: 16 }}
                onClick={handleMau}>
                🂠 MAU!
              </button>
            )}
            {/* MAU MAU button: shown next to Spielen when hand=1, OR post-play (pendingMauMau) */}
            {((isMyTurn && st.phase === "PLAYING" && !st.drawnCard && humanPlayer?.hand.length === 1 && playableIds.size > 0 && !st.mauMauReady)
              || st.pendingMauMau === uid) && (
              <button className="btn" style={{ flex: 1, background: "#27ae60", color: "white", fontWeight: 900, fontSize: 16 }}
                onClick={handleMauMau}>
                🏆 MAU MAU!
              </button>
            )}
            {/* Indicator when MAU MAU already pre-declared */}
            {st.mauMauReady && isMyTurn && st.phase === "PLAYING" && humanPlayer?.hand.length === 1 && (
              <div style={{ flex: 1, background: "#27ae6022", border: "1px solid #27ae60", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 700, color: "#27ae60", textAlign: "center", alignSelf: "center" }}>
                ✓ MAU MAU gerufen!
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 48 }}>🂠</div>
          <div style={{ color: "var(--text-sub)" }}>Karten werden gemischt…</div>
        </div>
      )}

      {/* ── Spielverlauf-Modal ── */}
      {showHistory && st && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)",
          display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 300,
        }} onClick={() => setShowHistory(false)}>
          <div style={{
            background: "var(--surface)", borderRadius: "20px 20px 0 0",
            padding: "20px 16px", width: "100%", maxWidth: 480,
            display: "flex", flexDirection: "column", gap: 12,
            borderTop: `3px solid ${VIOLET}`, maxHeight: "80vh",
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontWeight: 900, fontSize: 18 }}>📋 Spielverlauf</div>
              <button className="btn btn-outline btn-sm" style={{ width: 32, padding: 0, fontSize: 14 }}
                onClick={() => setShowHistory(false)}>✕</button>
            </div>
            <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              {st.moveLog.length === 0 ? (
                <div style={{ color: "var(--text-sub)", textAlign: "center", padding: "20px 0", fontSize: 13 }}>
                  Noch keine Spielzüge
                </div>
              ) : [...st.moveLog].reverse().map((entry, i) => {
                const isSystem = entry.playerName === "System";
                const isMAU = entry.detail.includes("MAU!");
                const isDraw = entry.detail.includes("zieht");
                const isWin = entry.detail.includes("gewinnt");
                const bgColor = isSystem ? "transparent"
                  : isWin ? `${VIOLET}22`
                  : isMAU ? `${VIOLET}15`
                  : isDraw ? "rgba(239,68,68,0.08)"
                  : "var(--surface2)";
                const textColor = isMAU || isWin ? VIOLET : isDraw ? "#ef4444" : "var(--text)";
                return (
                  <div key={i} style={{
                    padding: isSystem ? "6px 0" : "8px 10px",
                    background: bgColor,
                    borderRadius: 8,
                    borderLeft: isSystem ? "none" : `3px solid ${isMAU || isWin ? VIOLET : isDraw ? "#ef4444" : "var(--border)"}`,
                  }}>
                    {isSystem ? (
                      <div style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "center", fontWeight: 600 }}>
                        {entry.detail}
                      </div>
                    ) : (
                      <>
                        <div style={{ fontSize: 12, fontWeight: 700, color: textColor }}>{entry.detail}</div>
                        <div style={{ fontSize: 10, color: "var(--text-sub)", marginTop: 2 }}>
                          Runde {entry.round} · {new Date(entry.ts).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Wish suit dialog ── */}
      {st?.phase === "WISH" && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200,
        }}>
          <div style={{
            background: "var(--surface)", borderRadius: 18, padding: "24px 20px", width: 280,
            border: `2px solid ${VIOLET}44`, display: "flex", flexDirection: "column", gap: 16,
          }}>
            <div style={{ fontWeight: 900, fontSize: 20, textAlign: "center" }}>Farbe wählen</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {(["♥", "♦", "♣", "♠"] as MSuit[]).map(suit => {
                const sc = SUIT_COLORS[suit] ?? "#1a1a2e";
                return (
                  <button key={suit} onClick={() => handleWishSelect(suit)} style={{
                    padding: "14px 8px", borderRadius: 12, cursor: "pointer",
                    background: `${sc}18`,
                    border: `2px solid ${sc}44`,
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                    transition: "transform 0.1s",
                  }}>
                    <SuitIcon suit={suit} size={40} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: sc }}>{SUIT_NAMES[suit]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Round end / Game over overlay ── */}
      {(st?.phase === "ROUND_END" || st?.phase === "GAME_OVER") && st && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)",
          display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 200,
        }}>
          <div style={{
            background: "var(--surface)", borderRadius: "20px 20px 0 0",
            padding: "24px 18px", width: "100%", maxWidth: 480,
            display: "flex", flexDirection: "column", gap: 14,
            borderTop: `3px solid ${VIOLET}`,
          }}>
            <div style={{ fontWeight: 900, fontSize: 22, textAlign: "center" }}>
              {st.phase === "GAME_OVER" ? "🏆 Spiel beendet!" : `Runde ${st.round} beendet!`}
            </div>

            {st.roundWinnerId && (
              <div style={{ textAlign: "center", color: VIOLET, fontSize: 14, fontWeight: 700 }}>
                {st.players.find(p => p.userId === st.roundWinnerId)?.displayName} gewinnt die Runde!
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[...st.players].sort((a, b) => a.totalScore - b.totalScore).map(p => (
                <div key={p.userId} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px",
                  background: p.userId === st.roundWinnerId ? `${VIOLET}1a` : p.eliminated ? "rgba(239,68,68,0.08)" : "var(--surface2)",
                  borderRadius: 10, opacity: p.eliminated ? 0.7 : 1,
                  border: `1px solid ${p.userId === st.gameWinnerId ? VIOLET : "var(--border)"}`,
                }}>
                  <span style={{ fontSize: 20 }}>{p.avatarUrl}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>
                      {p.displayName}
                      {p.userId === st.gameWinnerId && " 🏆"}
                      {p.eliminated && " ❌"}
                    </div>
                    {st.roundScores[p.userId] !== undefined && !p.eliminated && (
                      <div style={{ fontSize: 11, color: "var(--text-sub)" }}>
                        {st.roundScores[p.userId] === 0 ? "Gewinner — 0 Punkte" : `+${st.roundScores[p.userId]} Punkte`}
                      </div>
                    )}
                  </div>
                  <div style={{
                    fontWeight: 900, fontSize: 18,
                    color: p.totalScore >= 80 ? "#ef4444" : p.totalScore >= 60 ? "#f59e0b" : "var(--text)",
                  }}>
                    {p.totalScore}P
                  </div>
                </div>
              ))}
            </div>

            {st.phase === "GAME_OVER" ? (
              <button className="btn" style={{ background: VIOLET, color: "white", fontWeight: 700, padding: "14px" }}
                onClick={() => navigate("/meermau/lobby", { replace: true })}>
                Zum Menü
              </button>
            ) : (
              <button className="btn" style={{ background: VIOLET, color: "white", fontWeight: 700, padding: "14px" }}
                onClick={() => setLocalState(prev => prev ? doStartNewRound(prev) : prev)}>
                Weiter →
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Quit dialog (AI: save dialog; Online: custom leave dialog) ── */}
      {showQuit && mode === "ai" && st && (
        <GameSaveQuitDialog
          emoji="🂠"
          message={`Runde ${st.round} · ${st.players.length} Spieler · ${st.players[0]?.totalScore ?? 0}P`}
          onContinue={() => setShowQuit(false)}
          onSaveAndQuit={() => {
            saveGame({
              id: generateGameSaveId(),
              gameType: "meermau",
              difficulty: st.difficulty,
              gameState: JSON.stringify({ ...st, aiThinking: false }),
              displayLabel: `Runde ${st.round} · ${st.players.length} Spieler · ${st.players[0]?.totalScore ?? 0}P`,
              savedAt: Date.now(),
            });
            navigate("/meermau/lobby", { replace: true });
          }}
          onQuitWithoutSave={() => {
            deleteGameSave("meermau");
            navigate("/meermau/lobby", { replace: true });
          }}
        />
      )}
      {showQuit && mode === "online" && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(10,22,40,0.9)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60,
        }}>
          <div style={{
            background: "var(--surface)", borderRadius: 16, padding: 24,
            maxWidth: 300, width: "90%", textAlign: "center",
          }}>
            <div style={{ fontSize: 36 }}>🏳️</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 8 }}>Spiel verlassen?</div>
            <div style={{ fontSize: 13, color: "var(--text-sub)", marginTop: 6 }}>Du kannst über den Code wieder beitreten.</div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowQuit(false)}>Bleiben</button>
              <button className="btn" style={{ flex: 1, background: VIOLET, color: "white" }}
                onClick={() => navigate("/meermau/lobby", { replace: true })}>Verlassen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
