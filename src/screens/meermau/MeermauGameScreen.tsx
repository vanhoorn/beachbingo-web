import { useEffect, useRef, useState } from "react";
import { doc, onSnapshot, addDoc, collection, getDoc } from "firebase/firestore";
import { useLocation, useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase";
import type { MeermauGame } from "../../types";
import {
  type MCard, type MSuit, type MeerMauDifficulty, type MeerMauSettings,
  MSUITS, MRED_SUITS, canPlayMCard, calcHandPoints, getAIMMove, dealMCards,
  DEFAULT_MM_SETTINGS,
} from "./meermauLogic";

const VIOLET = "#7c3aed";
const AI_DELAY_MS = 1200;
const ELIMINATION_SCORE = 100;

// ── Card component ────────────────────────────────────────────────────────────

function PlayingCard({
  card, faceUp = true, selected = false, playable = true, small = false,
  onClick, style = {},
}: {
  card?: MCard; faceUp?: boolean; selected?: boolean; playable?: boolean;
  small?: boolean; onClick?: () => void; style?: React.CSSProperties;
}) {
  const isRed = card ? MRED_SUITS.has(card.suit) : false;
  const W = small ? 36 : 58;
  const H = small ? 52 : 84;
  return (
    <div onClick={onClick} style={{
      width: W, height: H, borderRadius: small ? 5 : 8, flexShrink: 0,
      cursor: onClick ? "pointer" : "default",
      userSelect: "none", position: "relative",
      transition: "transform 0.15s, box-shadow 0.15s, opacity 0.15s",
      transform: selected ? "translateY(-10px)" : undefined,
      opacity: faceUp && !playable ? 0.38 : 1,
      ...(faceUp ? {
        background: "#f8f5ee",
        border: `${small ? 1 : 2}px solid ${selected ? VIOLET : "rgba(0,0,0,0.12)"}`,
        boxShadow: selected
          ? `0 0 0 2px ${VIOLET}, 0 6px 18px rgba(0,0,0,0.4)`
          : "0 2px 8px rgba(0,0,0,0.25)",
      } : {
        background: "linear-gradient(to bottom, #1a72c8 0%, #5ab8e8 55%, #1a8ab8 56%, #0a4a7a 100%)",
        border: `${small ? 1 : 2}px solid rgba(124,58,237,0.4)`,
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        overflow: "hidden",
      }),
      ...style,
    }}>
      {faceUp && card ? (
        <>
          <div style={{
            position: "absolute", top: small ? 2 : 4, left: small ? 3 : 5,
            color: isRed ? "#d63031" : "#1a1a2e", lineHeight: 1,
            fontSize: small ? 9 : 13,
          }}>
            <div style={{ fontWeight: 900 }}>{card.rank}</div>
            {!small && <div style={{ fontSize: 10 }}>{card.suit}</div>}
          </div>
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%,-50%)",
            fontSize: small ? 16 : 26, color: isRed ? "#d63031" : "#1a1a2e",
          }}>{card.suit}</div>
          {!small && (
            <div style={{
              position: "absolute", bottom: 4, right: 5,
              color: isRed ? "#d63031" : "#1a1a2e", lineHeight: 1,
              fontSize: 13, transform: "rotate(180deg)",
            }}>
              <div style={{ fontWeight: 900 }}>{card.rank}</div>
              <div style={{ fontSize: 10 }}>{card.suit}</div>
            </div>
          )}
        </>
      ) : !faceUp ? (
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} viewBox="0 0 58 84">
          <circle cx="45" cy="11" r="9.5" fill="rgba(255,224,51,0.28)"/>
          <circle cx="45" cy="11" r="5.8" fill="#ffd700"/>
          <circle cx="43.3" cy="9.8" r="3.4" fill="#ffed4a"/>
          <line x1="45" y1="2.5" x2="45" y2="0.2" stroke="#ffd700" strokeWidth="1.4" opacity="0.75"/>
          <line x1="52.2" y1="4.8" x2="53.8" y2="3.2" stroke="#ffd700" strokeWidth="1.4" opacity="0.75"/>
          <line x1="54.5" y1="11" x2="57" y2="11" stroke="#ffd700" strokeWidth="1.4" opacity="0.75"/>
          <line x1="52.2" y1="17.2" x2="53.8" y2="18.8" stroke="#ffd700" strokeWidth="1.4" opacity="0.75"/>
          <line x1="45" y1="19.5" x2="45" y2="21.8" stroke="#ffd700" strokeWidth="1.4" opacity="0.75"/>
          <line x1="37.8" y1="17.2" x2="36.2" y2="18.8" stroke="#ffd700" strokeWidth="1.4" opacity="0.75"/>
          <line x1="35.5" y1="11" x2="33" y2="11" stroke="#ffd700" strokeWidth="1.4" opacity="0.75"/>
          <line x1="37.8" y1="4.8" x2="36.2" y2="3.2" stroke="#ffd700" strokeWidth="1.4" opacity="0.75"/>
          <path d="M0,57 Q7,54.5 14,57 Q21,59.5 29,57 Q37,54.5 44,57 Q51,59.5 58,57" stroke="rgba(255,255,255,0.35)" strokeWidth="0.9" fill="none"/>
          <path d="M0,67 Q8,64.5 16,67 Q24,69.5 32,67 Q40,64.5 48,67 Q56,69.5 58,67" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" fill="none"/>
          <path d="M0,76 Q9,73.5 18,76 Q27,78.5 36,76 Q45,73.5 54,76" stroke="rgba(255,255,255,0.18)" strokeWidth="0.7" fill="none"/>
          <ellipse cx="29" cy="72" rx="12" ry="4.5" fill="#c8942a"/>
          <ellipse cx="26" cy="70.5" rx="6.5" ry="2.5" fill="#e4b44a" opacity="0.5"/>
          <path d="M29,70 Q27,60 28,49 Q29.5,42 32,34" stroke="#7a5c2e" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
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

// ── Local state types ─────────────────────────────────────────────────────────

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
  phase: "PLAYING" | "WISH" | "MAU_CHECK" | "ROUND_END" | "GAME_OVER";
  mauPlayerId: string | null;
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

function doPlayCard(
  st: LocalState, playerIdx: number, cardId: string, wishSuit?: MSuit,
): LocalState {
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
      return { ...st, players: updated, discardPile: newDiscard, phase: "WISH", drawnCard: null, aiThinking: false };
    }
  } else {
    ws = null;
  }

  const updated = st.players.map((p, i) => i === playerIdx ? { ...p, hand: newHand } : p);

  // Round win
  if (newHand.length === 0) {
    return resolveRound({ ...st, players: updated, discardPile: newDiscard, drawPile: draw, drawPending: 0, wishSuit: null, direction: dir, roundWinnerId: player.userId, lastActionText: `🏆 ${player.displayName} gewinnt die Runde!`, aiThinking: false, lastSkippedId: null });
  }

  const nextPlayer = nextIdx(playerIdx, dir, updated, extraSkip);

  // Mau check
  if (newHand.length === 1 && st.mauPlayerId !== player.userId) {
    return { ...st, players: updated, discardPile: newDiscard, drawPile: draw, drawPending, wishSuit: ws, direction: dir, currentPlayerIndex: nextPlayer, phase: "MAU_CHECK", mauPlayerId: player.userId, drawnCard: null, lastActionText: txt, aiThinking: false, lastSkippedId };
  }

  return { ...st, players: updated, discardPile: newDiscard, drawPile: draw, drawPending, wishSuit: ws, direction: dir, currentPlayerIndex: nextPlayer, phase: "PLAYING", drawnCard: null, lastActionText: txt, aiThinking: false, lastSkippedId };
}

function doDrawCard(st: LocalState, playerIdx: number): LocalState {
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

  // Penalty draw → advance turn
  if (st.drawPending > 0) {
    const nextPlayer = nextIdx(playerIdx, st.direction, updated);
    return { ...st, players: updated, drawPile: draw, discardPile: discard, drawPending: 0, currentPlayerIndex: nextPlayer, phase: "PLAYING", drawnCard: null, lastActionText: `${player.displayName} zieht ${drawn.length} Karten (Strafe)`, aiThinking: false };
  }

  // Normal draw — offer to play if possible
  const top = discard[discard.length - 1];
  const dc = drawn[0] ?? null;
  const canPlay = dc && top ? canPlayMCard(dc, top, st.wishSuit, 0, st.settings) : false;

  if (!canPlay || !dc) {
    const nextPlayer = nextIdx(playerIdx, st.direction, updated);
    return { ...st, players: updated, drawPile: draw, discardPile: discard, currentPlayerIndex: nextPlayer, phase: "PLAYING", drawnCard: null, lastActionText: `${player.displayName} zieht eine Karte`, aiThinking: false };
  }

  return { ...st, players: updated, drawPile: draw, discardPile: discard, drawnCard: dc, lastActionText: `${player.displayName} zieht ${dc.rank}${dc.suit} — spielen?`, aiThinking: false };
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
    phase: "PLAYING", mauPlayerId: null, drawnCard: null,
    roundWinnerId: null, roundScores: {},
    round: st.round + 1, lastActionText: "Neue Runde!", aiThinking: false, lastSkippedId: null,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

interface LocState {
  mode: "ai" | "online";
  aiCount?: number;
  difficulty?: MeerMauDifficulty;
  settings?: MeerMauSettings;
  gameId?: string;
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

  const [localState, setLocalState] = useState<LocalState | null>(null);
  const [_onlineGame, setOnlineGame] = useState<MeermauGame | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  // ── Init AI game ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== "ai") return;
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
        wishSuit: null, phase: "PLAYING", mauPlayerId: null, drawnCard: null,
        roundWinnerId: null, gameWinnerId: null, roundScores: {},
        round: 1, lastActionText: "Dein Zug!", aiThinking: false,
        difficulty, settings: initSettings, lastSkippedId: null,
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

  // ── AI MAU auto-declare ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!localState || localState.phase !== "MAU_CHECK") return;
    const mauPlayer = localState.players.find(p => p.userId === localState.mauPlayerId);
    if (!mauPlayer?.isAI) return;

    const t = setTimeout(() => {
      setLocalState(prev => {
        if (!prev || prev.phase !== "MAU_CHECK") return prev;
        const mp = prev.players.find(p => p.userId === prev.mauPlayerId);
        return { ...prev, phase: "PLAYING", lastActionText: `${mp?.displayName ?? ""}: Mau!` };
      });
    }, 700);
    return () => clearTimeout(t);
  }, [localState?.phase, localState?.mauPlayerId]);

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
    if (!playableIds.has(cardId)) { setSelectedCardId(prev => prev === cardId ? null : cardId); return; }
    if (selectedCardId !== cardId) { setSelectedCardId(cardId); return; }
    // Second click → play
    const card = humanPlayer?.hand.find(c => c.id === cardId);
    if (!card) return;
    const needsWish = card.rank === "J" || (st.settings.wildOn10 && card.rank === "10");
    if (needsWish) {
      setLocalState(prev => prev ? doPlayCard(prev, 0, cardId) : prev); // enters WISH phase
    } else {
      setLocalState(prev => prev ? doPlayCard(prev, 0, cardId) : prev);
      setSelectedCardId(null);
    }
  }

  function handleDraw() {
    if (!st || !isMyTurn || st.phase !== "PLAYING") return;
    setLocalState(prev => prev ? doDrawCard(prev, 0) : prev);
    setSelectedCardId(null);
  }

  function handleDrawnCardPlay() {
    if (!st || !st.drawnCard || !topCard) return;
    const dc = st.drawnCard;
    if (!canPlayMCard(dc, topCard, st.wishSuit, 0, st.settings)) return;
    const needsWish = dc.rank === "J" || (st.settings.wildOn10 && dc.rank === "10");
    if (needsWish) {
      setLocalState(prev => prev ? doPlayCard(prev, 0, dc.id) : prev);
    } else {
      setLocalState(prev => prev ? doPlayCard(prev, 0, dc.id) : prev);
    }
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
        return resolveRound({ ...prev, wishSuit: suit, roundWinnerId: h.userId, lastActionText: `🏆 ${h.displayName} gewinnt die Runde!` });
      } else if (h.hand.length === 1 && prev.mauPlayerId !== h.userId) {
        return { ...prev, wishSuit: suit, phase: "MAU_CHECK", mauPlayerId: h.userId, currentPlayerIndex: np, lastActionText: `${h.displayName} wünscht ${sn[suit]}!` };
      }
      return { ...prev, wishSuit: suit, phase: "PLAYING", currentPlayerIndex: np, lastActionText: `${h.displayName} wünscht ${sn[suit]}!` };
    });
    void human; // used implicitly above
    setSelectedCardId(null);
  }

  function handleMau() {
    if (!st || st.phase !== "MAU_CHECK" || st.mauPlayerId !== uid) return;
    const mp = st.players.find(p => p.userId === uid);
    setLocalState(prev => prev ? { ...prev, phase: "PLAYING", lastActionText: `${mp?.displayName ?? "Du"}: Mau!` } : prev);
  }

  // ── Online move handlers ─────────────────────────────────────────────────────
  // ── Status text ──────────────────────────────────────────────────────────────
  const statusText = (() => {
    if (!st) return "Lädt…";
    if (st.aiThinking) return "KI denkt…";
    if (st.phase === "MAU_CHECK" && st.mauPlayerId === uid) return "Drücke MAU!";
    if (st.phase === "MAU_CHECK") return `${st.players.find(p => p.userId === st.mauPlayerId)?.displayName ?? ""} sagt Mau…`;
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
          onClick={() => navigate("/meermau/lobby")}>‹</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 17, color: VIOLET }}>MeerMau</div>
          <div style={{ fontSize: 11, color: "var(--text-sub)" }}>Runde {st?.round ?? 1}</div>
        </div>
        {st?.settings.reverseOn9 && (
          <div style={{ fontSize: 22, color: VIOLET }}>
            {st.direction === 1 ? "↻" : "↺"}
          </div>
        )}
      </div>

      {st ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "10px 12px", gap: 10, overflow: "hidden" }}>

          {/* Opponents */}
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            {opponents.map(opp => {
              const oppIdx = st.players.indexOf(opp);
              const isCurrent = oppIdx === st.currentPlayerIndex;
              const isMau = opp.userId === st.mauPlayerId;
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
                  <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                    {opp.hand.slice(0, 7).map((_, ci) => (
                      <PlayingCard key={ci} faceUp={false} small />
                    ))}
                    {opp.hand.length > 7 && (
                      <span style={{ fontSize: 9, color: "var(--text-sub)", alignSelf: "center" }}>+{opp.hand.length - 7}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Table */}
          <div style={{
            background: "var(--surface2)", borderRadius: 12, padding: "14px 16px",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 20, flexShrink: 0,
          }}>
            {/* Draw pile */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ position: "relative" }}>
                <PlayingCard faceUp={false} style={{ cursor: isMyTurn && st.phase === "PLAYING" && !st.drawnCard ? "pointer" : "default" }} onClick={isMyTurn && st.phase === "PLAYING" && !st.drawnCard ? handleDraw : undefined} />
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
                  padding: "4px 12px", fontSize: 22, fontWeight: 900,
                }}>{st.wishSuit}</div>
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
              {topCard && <PlayingCard card={topCard} faceUp />}
              <div style={{ fontSize: 10, color: "var(--text-sub)" }}>Ablage</div>
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

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Human hand */}
          <div style={{
            background: "var(--surface)", borderRadius: 12, padding: "10px 8px",
            border: `1px solid ${isMyTurn && st.phase === "PLAYING" ? VIOLET + "55" : "var(--border)"}`,
            flexShrink: 0,
          }}>
            <div style={{ display: "flex", gap: 5, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
              {humanPlayer?.hand.map(card => (
                <PlayingCard
                  key={card.id} card={card} faceUp
                  selected={selectedCardId === card.id}
                  playable={isMyTurn && st.phase === "PLAYING" && playableIds.has(card.id)}
                  onClick={() => handleCardClick(card.id)}
                />
              ))}
              {/* Drawn card offer */}
              {st.drawnCard && isMyTurn && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginLeft: 6 }}>
                  <div style={{ fontSize: 9, color: VIOLET, marginBottom: 3, fontWeight: 700 }}>GEZOGEN</div>
                  <PlayingCard
                    card={st.drawnCard} faceUp
                    playable={!!topCard && canPlayMCard(st.drawnCard, topCard, st.wishSuit, 0, st.settings)}
                    style={{ border: `2px dashed ${VIOLET}` }}
                    onClick={handleDrawnCardPlay}
                  />
                </div>
              )}
            </div>
            <div style={{ fontSize: 10, color: "var(--text-sub)", textAlign: "center", marginTop: 6 }}>
              Du · {humanPlayer?.hand.length ?? 0} Karten · {humanPlayer?.totalScore ?? 0} Punkte
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            {isMyTurn && st.phase === "PLAYING" && !st.drawnCard && (
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={handleDraw}>
                {st.drawPending > 0 ? `${st.drawPending} Karten ziehen` : "Karte ziehen"}
              </button>
            )}
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
            {st.phase === "MAU_CHECK" && st.mauPlayerId === uid && (
              <button className="btn" style={{ flex: 1, background: VIOLET, color: "white", fontWeight: 900, fontSize: 20, padding: "14px" }}
                onClick={handleMau}>
                🂠 MAU!
              </button>
            )}
            {selectedCardId && isMyTurn && st.phase === "PLAYING" && playableIds.has(selectedCardId) && !st.drawnCard && (
              <button className="btn" style={{ flex: 1, background: VIOLET, color: "white", fontWeight: 700 }}
                onClick={() => handleCardClick(selectedCardId)}>
                Spielen
              </button>
            )}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 48 }}>🂠</div>
          <div style={{ color: "var(--text-sub)" }}>Karten werden gemischt…</div>
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
                const isRed = suit === "♥" || suit === "♦";
                return (
                  <button key={suit} onClick={() => handleWishSelect(suit)} style={{
                    padding: "20px 8px", borderRadius: 12, fontSize: 36, fontWeight: 900,
                    background: isRed ? "#fff5f5" : "#f8f9fa",
                    color: isRed ? "#d63031" : "#1a1a2e",
                    border: `2px solid ${isRed ? "#d6303133" : "#1a1a2e22"}`,
                    cursor: "pointer", transition: "transform 0.1s",
                  }}>
                    {suit}
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
                onClick={() => navigate("/meermau/lobby")}>
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
    </div>
  );
}
