import type { DocumentData } from 'firebase/firestore';
import { ALL_KLON_CHARACTERS } from './klontauschCharacterLibrary';
import type { KlonPart } from './klontauschCharacterLibrary';

export type { KlonPart };

// ── Types ─────────────────────────────────────────────────────────────────────

export interface KlonCard {
  cardId: string;
  characterId: string;
  part: KlonPart;
}

export interface KlonOffer {
  type: 'NONE' | 'OPEN';
  fromUserId: string;
  part: KlonPart | '';
  committedCardId: string;
  responderIds: string[];  // accepted
  declinedIds: string[];   // declined
  selectedResponderId: string;
  responderCardId: string;
}

export interface KlonPlayerState {
  userId: string;
  displayName: string;
  avatarUrl: string;
  heldCards: KlonCard[];
  cardCount: number;
  isAI: boolean;
  isEliminated: boolean;
}

export interface KlonGameState {
  players: Record<string, KlonPlayerState>;
  playerIds: string[];
  turnIndex: number;
  offer: KlonOffer;
  status: 'LOBBY' | 'PLAYING' | 'FINISHED';
  winnerId: string;
  adminId: string;
}

// ── Defaults ──────────────────────────────────────────────────────────────────

export const EMPTY_OFFER: KlonOffer = {
  type: 'NONE', fromUserId: '', part: '', committedCardId: '',
  responderIds: [], declinedIds: [], selectedResponderId: '', responderCardId: '',
};

export const AI_KLON_NAMES = ['🤖 Möwe', '🤖 Krabbe', '🤖 Fisch', '🤖 Hai', '🤖 Delfin'];

// ── Setup ─────────────────────────────────────────────────────────────────────

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDeck(characterIds: string[]): KlonCard[] {
  const parts: KlonPart[] = ['KOPF', 'KOERPER', 'BEINE'];
  const cards: KlonCard[] = [];
  for (const charId of characterIds) {
    for (const part of parts) {
      cards.push({ cardId: `${charId}_${part}_${Math.floor(Math.random() * 99999)}`, characterId: charId, part });
    }
  }
  return shuffled(cards);
}

export function dealGame(
  playerMap: Record<string, KlonPlayerState>,
  playerIds: string[],
): { players: Record<string, KlonPlayerState>; targets: Record<string, string[]> } {
  const n = playerIds.length;
  const pool = shuffled(ALL_KLON_CHARACTERS).slice(0, n * 3);
  const deck = buildDeck(pool.map(c => c.id));

  const targets: Record<string, string[]> = {};
  const players: Record<string, KlonPlayerState> = { ...playerMap };

  playerIds.forEach((uid, i) => {
    targets[uid] = pool.slice(i * 3, i * 3 + 3).map(c => c.id);
  });

  playerIds.forEach(uid => {
    const hand = deck.splice(0, 9);
    players[uid] = { ...playerMap[uid], heldCards: hand, cardCount: hand.length };
  });

  return { players, targets };
}

export function generateKlonGameCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ── Win check ─────────────────────────────────────────────────────────────────

export function hasWon(player: KlonPlayerState, targetCharacterIds: string[]): boolean {
  if (targetCharacterIds.length < 3) return false;
  const parts: KlonPart[] = ['KOPF', 'KOERPER', 'BEINE'];
  return targetCharacterIds.every(charId =>
    parts.every(p => player.heldCards.some(c => c.characterId === charId && c.part === p))
  );
}

// ── Game actions ──────────────────────────────────────────────────────────────

export function executeNehmen(state: KlonGameState, activeUid: string, targetUid?: string): KlonGameState {
  const effectiveTargetUid = targetUid ?? (() => {
    const idx = state.playerIds.indexOf(activeUid);
    return state.playerIds[(idx - 1 + state.playerIds.length) % state.playerIds.length];
  })();
  const targetP = state.players[effectiveTargetUid];
  if (!targetP || targetP.heldCards.length === 0) return state;

  const takenCard = targetP.heldCards[Math.floor(Math.random() * targetP.heldCards.length)];
  const newTargetCards = targetP.heldCards.filter(c => c.cardId !== takenCard.cardId);
  const activeP = state.players[activeUid];
  if (!activeP) return state;
  const newActiveCards = [...activeP.heldCards, takenCard];

  return {
    ...state,
    players: {
      ...state.players,
      [effectiveTargetUid]: { ...targetP, heldCards: newTargetCards, cardCount: newTargetCards.length },
      [activeUid]: { ...activeP, heldCards: newActiveCards, cardCount: newActiveCards.length },
    },
    turnIndex: state.turnIndex + 1,
    offer: EMPTY_OFFER,
  };
}

export function openOffer(state: KlonGameState, activeUid: string, cardId: string): KlonGameState {
  const activeP = state.players[activeUid];
  const card = activeP?.heldCards.find(c => c.cardId === cardId);
  if (!card) return state;
  return {
    ...state,
    offer: {
      ...EMPTY_OFFER,
      type: 'OPEN',
      fromUserId: activeUid,
      part: card.part,
      committedCardId: cardId,
    },
  };
}

export function respondToOffer(state: KlonGameState, responderId: string): KlonGameState {
  const { offer } = state;
  if (offer.type !== 'OPEN' || responderId === offer.fromUserId) return state;
  if (offer.responderIds.includes(responderId)) return state;
  const responder = state.players[responderId];
  if (!responder?.heldCards.some(c => c.part === offer.part)) return state;
  return { ...state, offer: { ...offer, responderIds: [...offer.responderIds, responderId] } };
}

export function withdrawResponse(state: KlonGameState, responderId: string): KlonGameState {
  if (state.offer.type !== 'OPEN') return state;
  return { ...state, offer: {
    ...state.offer,
    responderIds: state.offer.responderIds.filter(id => id !== responderId),
    declinedIds:  state.offer.declinedIds.filter(id => id !== responderId),
  }};
}

export function declineOffer(state: KlonGameState, responderId: string): KlonGameState {
  const { offer } = state;
  if (offer.type !== 'OPEN' || responderId === offer.fromUserId) return state;
  if (offer.declinedIds.includes(responderId)) return state;
  return { ...state, offer: {
    ...offer,
    responderIds: offer.responderIds.filter(id => id !== responderId),
    declinedIds:  [...offer.declinedIds, responderId],
  }};
}

export function selectPartnerAndSwap(state: KlonGameState, selectedResponderId: string): KlonGameState {
  const { offer } = state;
  if (offer.type !== 'OPEN') return state;
  const offerer = state.players[offer.fromUserId];
  const responder = state.players[selectedResponderId];
  if (!offerer || !responder) return state;

  const offererCard = offerer.heldCards.find(c => c.cardId === offer.committedCardId);
  if (!offererCard) return state;
  const candidates = responder.heldCards.filter(c => c.part === offer.part);
  if (candidates.length === 0) return state;
  const responderCard = candidates[Math.floor(Math.random() * candidates.length)];

  const newOffererCards = offerer.heldCards.filter(c => c.cardId !== offererCard.cardId).concat(responderCard);
  const newResponderCards = responder.heldCards.filter(c => c.cardId !== responderCard.cardId).concat(offererCard);

  return {
    ...state,
    players: {
      ...state.players,
      [offer.fromUserId]: { ...offerer, heldCards: newOffererCards, cardCount: newOffererCards.length },
      [selectedResponderId]: { ...responder, heldCards: newResponderCards, cardCount: newResponderCards.length },
    },
    turnIndex: state.turnIndex + 1,
    offer: EMPTY_OFFER,
  };
}

export function cancelOffer(state: KlonGameState): KlonGameState {
  return { ...state, offer: EMPTY_OFFER, turnIndex: state.turnIndex + 1 };
}

// ── AI ────────────────────────────────────────────────────────────────────────

export function aiDecideMove(state: KlonGameState, aiUid: string, targetIds: string[]): KlonGameState {
  const activeTurnUid = state.playerIds[state.turnIndex % state.playerIds.length];
  const { offer } = state;

  // Not AI's turn but there's an open offer from someone else → accept or decline
  if (activeTurnUid !== aiUid && offer.type === 'OPEN' && offer.fromUserId !== aiUid) {
    if (offer.responderIds.includes(aiUid) || offer.declinedIds.includes(aiUid)) return state;
    const aiPlayer = state.players[aiUid];
    const hasPart = aiPlayer?.heldCards.some(c => c.part === offer.part) ?? false;
    return (hasPart && Math.random() < 0.70) ? respondToOffer(state, aiUid) : declineOffer(state, aiUid);
  }

  if (activeTurnUid !== aiUid) return state;

  // AI has an open offer → pick partner if someone responded
  if (offer.type === 'OPEN' && offer.fromUserId === aiUid) {
    if (offer.responderIds.length > 0) {
      const partner = offer.responderIds[Math.floor(Math.random() * offer.responderIds.length)];
      return selectPartnerAndSwap(state, partner);
    }
    return state; // still waiting
  }

  const aiPlayer = state.players[aiUid];
  if (!aiPlayer || aiPlayer.heldCards.length === 0) {
    return { ...state, turnIndex: state.turnIndex + 1, offer: EMPTY_OFFER };
  }

  if (Math.random() < 0.50) {
    return executeNehmen(state, aiUid);
  } else {
    const nonTargetCards = aiPlayer.heldCards.filter(c => !targetIds.includes(c.characterId));
    const candidates = nonTargetCards.length > 0 ? nonTargetCards : aiPlayer.heldCards;
    const card = candidates[Math.floor(Math.random() * candidates.length)];
    return openOffer(state, aiUid, card.cardId);
  }
}

// ── Firestore serialization ───────────────────────────────────────────────────

function toKlonCard(raw: DocumentData): KlonCard {
  return { cardId: raw.cardId ?? '', characterId: raw.characterId ?? '', part: raw.part ?? 'KOPF' };
}

function toKlonPlayerState(uid: string, raw: DocumentData): KlonPlayerState {
  return {
    userId: uid,
    displayName: raw.displayName ?? '',
    avatarUrl: raw.avatarUrl ?? '',
    heldCards: Array.isArray(raw.heldCards) ? raw.heldCards.map(toKlonCard) : [],
    cardCount: Number(raw.cardCount ?? 0),
    isAI: Boolean(raw.isAI),
    isEliminated: Boolean(raw.isEliminated),
  };
}

function toKlonOffer(raw: DocumentData): KlonOffer {
  return {
    type: raw.type === 'OPEN' ? 'OPEN' : 'NONE',
    fromUserId: raw.fromUserId ?? '',
    part: raw.part ?? '',
    committedCardId: raw.committedCardId ?? '',
    responderIds: Array.isArray(raw.responderIds) ? raw.responderIds : [],
    declinedIds:  Array.isArray(raw.declinedIds)  ? raw.declinedIds  : [],
    selectedResponderId: raw.selectedResponderId ?? '',
    responderCardId: raw.responderCardId ?? '',
  };
}

export function fromFirestoreDoc(data: DocumentData): KlonGameState {
  const playerIds: string[] = Array.isArray(data.playerIds) ? data.playerIds : [];
  const rawPlayers: Record<string, DocumentData> = data.players ?? {};
  const players: Record<string, KlonPlayerState> = {};
  for (const [uid, raw] of Object.entries(rawPlayers)) {
    players[uid] = toKlonPlayerState(uid, raw as DocumentData);
  }
  return {
    players,
    playerIds,
    turnIndex: Number(data.turnIndex ?? 0),
    offer: data.offer ? toKlonOffer(data.offer) : EMPTY_OFFER,
    status: data.status ?? 'LOBBY',
    winnerId: data.winnerId ?? '',
    adminId: data.adminId ?? '',
  };
}

export function playerStateToFirestore(p: KlonPlayerState): DocumentData {
  return {
    userId: p.userId,
    displayName: p.displayName,
    avatarUrl: p.avatarUrl,
    heldCards: p.heldCards.map(c => ({ cardId: c.cardId, characterId: c.characterId, part: c.part })),
    cardCount: p.heldCards.length,
    isAI: p.isAI,
    isEliminated: p.isEliminated,
  };
}

export function offerToFirestore(o: KlonOffer): DocumentData {
  return {
    type: o.type,
    fromUserId: o.fromUserId,
    part: o.part,
    committedCardId: o.committedCardId,
    responderIds: o.responderIds,
    declinedIds: o.declinedIds,
    selectedResponderId: o.selectedResponderId,
    responderCardId: o.responderCardId,
  };
}
