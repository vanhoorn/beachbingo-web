export type MSuit = "♣" | "♠" | "♥" | "♦";
export type MRank = "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A";
export interface MCard { suit: MSuit; rank: MRank; id: string; }
export const MSUITS: MSuit[] = ["♣", "♠", "♥", "♦"];
export const MRANKS: MRank[] = ["7", "8", "9", "10", "J", "Q", "K", "A"];
export const MRED_SUITS = new Set<MSuit>(["♥", "♦"]);
export const MCARD_POINTS: Record<MRank, number> = {
  "7": 7, "8": 8, "9": 9, "10": 10, "J": 20, "Q": 10, "K": 10, "A": 11,
};
export const DEFAULT_MM_SETTINGS: MeerMauSettings = {
  reverseOn9: false,
  stopperOn8: false,
  wildOn10: false,
};
export type MeerMauDifficulty = "ROOKIE" | "SNIPER" | "BOSS_LEVEL";
export interface MeerMauSettings {
  reverseOn9: boolean;
  stopperOn8: boolean;
  wildOn10: boolean;
}

/** Build a 32-card deck (4 suits × 8 ranks). */
export function createMDeck(): MCard[] {
  const deck: MCard[] = [];
  for (const suit of MSUITS) {
    for (const rank of MRANKS) {
      deck.push({ suit, rank, id: `${suit}${rank}` });
    }
  }
  return deck;
}

/** Fisher-Yates shuffle — returns a new array. */
export function shuffleMDeck(deck: MCard[]): MCard[] {
  const a = [...deck];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Decide whether `card` may be played given the current game state.
 *
 * Rules:
 *  • If drawPending > 0  → only a 7 can be played (or 8 when stopperOn8 is on)
 *  • If wishSuit !== null → J is always valid; 10 is valid when wildOn10;
 *                           anything else must match wishSuit
 *  • Otherwise           → same suit OR same rank as topCard
 */
export function canPlayMCard(
  card: MCard,
  topCard: MCard,
  wishSuit: MSuit | null,
  drawPending: number,
  settings: MeerMauSettings,
): boolean {
  if (drawPending > 0) {
    if (card.rank === "7") return true;
    if (settings.stopperOn8 && card.rank === "8") return true;
    return false;
  }
  if (wishSuit !== null) {
    if (card.rank === "J") return true;
    if (settings.wildOn10 && card.rank === "10") return true;
    return card.suit === wishSuit;
  }
  return card.suit === topCard.suit || card.rank === topCard.rank;
}

/** Sum of point values for a hand. */
export function calcHandPoints(hand: MCard[]): number {
  return hand.reduce((sum, c) => sum + MCARD_POINTS[c.rank], 0);
}

/**
 * Deal 5 cards to each player, set up draw pile and a topCard.
 * If the first topCard candidate is a J, re-shuffle until it is not.
 */
export function dealMCards(
  playerCount: number,
): { hands: MCard[][]; drawPile: MCard[]; topCard: MCard } {
  let deck = shuffleMDeck(createMDeck());
  const hands: MCard[][] = Array.from({ length: playerCount }, () => []);

  // Deal 5 cards each
  for (let i = 0; i < 5; i++) {
    for (let p = 0; p < playerCount; p++) {
      hands[p].push(deck.shift()!);
    }
  }

  // Find first non-J card as topCard
  let topCard: MCard | null = null;
  const remaining: MCard[] = [];
  for (const c of deck) {
    if (topCard === null && c.rank !== "J") {
      topCard = c;
    } else {
      remaining.push(c);
    }
  }
  // If somehow all remaining cards are J (extremely unlikely with 32-card deck),
  // re-deal from scratch
  if (!topCard) {
    return dealMCards(playerCount);
  }

  return { hands, drawPile: remaining, topCard };
}

// ---------------------------------------------------------------------------
// AI logic
// ---------------------------------------------------------------------------

type AIMove =
  | { type: "PLAY"; cardId: string; wishSuit?: MSuit }
  | { type: "DRAW" };

/** Pick the most common suit in the hand (used for J wish-suit selection). */
function bestWishSuit(hand: MCard[]): MSuit {
  const counts: Record<MSuit, number> = { "♣": 0, "♠": 0, "♥": 0, "♦": 0 };
  for (const c of hand) counts[c.suit]++;
  return (Object.entries(counts) as [MSuit, number][]).reduce(
    (best, [suit, n]) => (n > best[1] ? [suit, n] : best),
    ["♣", -1] as [MSuit, number],
  )[0];
}

/** Special-card priority weight (higher = prefer to play). */
function specialWeight(rank: MRank): number {
  if (rank === "7") return 40; // force draw — highest prio
  if (rank === "8") return 30; // stopper / skip
  if (rank === "J") return 20; // wish card
  if (rank === "9") return 10; // reverse
  return 0;
}

export function getAIMMove(
  hand: MCard[],
  topCard: MCard,
  wishSuit: MSuit | null,
  drawPending: number,
  difficulty: MeerMauDifficulty,
  settings: MeerMauSettings,
): AIMove {
  const playable = hand.filter((c) =>
    canPlayMCard(c, topCard, wishSuit, drawPending, settings),
  );

  // ROOKIE: sometimes draw even when a card is available
  if (difficulty === "ROOKIE") {
    if (playable.length === 0 || Math.random() < 0.15) return { type: "DRAW" };
    const chosen = playable[Math.floor(Math.random() * playable.length)];
    const wishSuitChoice =
      chosen.rank === "J" ? bestWishSuit(hand.filter((c) => c.id !== chosen.id)) : undefined;
    return { type: "PLAY", cardId: chosen.id, wishSuit: wishSuitChoice };
  }

  // SNIPER / BOSS_LEVEL: prioritise special cards, then highest point value
  if (playable.length === 0) return { type: "DRAW" };

  const scored = playable.map((c) => ({
    card: c,
    score: specialWeight(c.rank) + MCARD_POINTS[c.rank],
  }));
  scored.sort((a, b) => b.score - a.score);

  const chosen = scored[0].card;
  const handAfter = hand.filter((c) => c.id !== chosen.id);
  const wishSuitChoice =
    chosen.rank === "J" ? bestWishSuit(handAfter) : undefined;

  return { type: "PLAY", cardId: chosen.id, wishSuit: wishSuitChoice };
}
