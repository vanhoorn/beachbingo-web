export type CardSuit = "♣" | "♠" | "♥" | "♦";
export type CardRank = "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A";

export interface BCard { suit: CardSuit; rank: CardRank }

export const SUITS: CardSuit[] = ["♣", "♠", "♥", "♦"];
export const RANKS: CardRank[] = ["7", "8", "9", "10", "J", "Q", "K", "A"];
export const RED_SUITS = new Set<CardSuit>(["♥", "♦"]);

export const CARD_VALUES: Record<CardRank, number> = {
  "7": 7, "8": 8, "9": 9, "10": 10, "J": 10, "Q": 10, "K": 10, "A": 11,
};

export function createDeck(): BCard[] {
  return SUITS.flatMap(suit => RANKS.map(rank => ({ suit, rank })));
}

export function shuffleDeck(deck: BCard[]): BCard[] {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

export function calcScore(hand: BCard[]): number {
  if (hand.length !== 3) return 0;
  // Three of a kind → 30.5 points (independent of suits)
  if (hand[0].rank === hand[1].rank && hand[1].rank === hand[2].rank) return 30.5;
  // Best same-suit combination
  let best = 0;
  for (const suit of SUITS) {
    const val = hand.filter(c => c.suit === suit).reduce((s, c) => s + CARD_VALUES[c.rank], 0);
    if (val > best) best = val;
  }
  return best;
}

export function isFeuerBlitz(hand: BCard[]): boolean {
  return hand.length === 3 && hand.every(c => c.rank === "A");
}

export function isThirtyOne(hand: BCard[]): boolean {
  return calcScore(hand) === 31;
}

export type BrandungDifficulty = "ROOKIE" | "SNIPER" | "BOSS_LEVEL";

export type AIAction =
  | { type: "SWAP_ONE"; handIdx: number; tableIdx: number }
  | { type: "SWAP_ALL" }
  | { type: "PASS" }
  | { type: "KNOCK" };

export function bestAIMove(
  hand: BCard[],
  tableCards: BCard[],
  difficulty: BrandungDifficulty,
  canPass: boolean,
): AIAction {
  const currentScore = calcScore(hand);

  if (difficulty === "ROOKIE") {
    const r = Math.random();
    if (r < 0.45) return { type: "SWAP_ONE", handIdx: Math.floor(Math.random() * 3), tableIdx: Math.floor(Math.random() * 3) };
    if (r < 0.65) return { type: "SWAP_ALL" };
    if (r < 0.82 && canPass) return { type: "PASS" };
    return { type: "KNOCK" };
  }

  if (currentScore >= 30.5) return { type: "KNOCK" };

  // Find best single swap
  let bestSwap: { handIdx: number; tableIdx: number; score: number } | null = null;
  for (let hi = 0; hi < 3; hi++) {
    for (let ti = 0; ti < 3; ti++) {
      const newHand = [...hand];
      newHand[hi] = tableCards[ti];
      const score = calcScore(newHand);
      if (!bestSwap || score > bestSwap.score) bestSwap = { handIdx: hi, tableIdx: ti, score };
    }
  }

  const swapAllScore = calcScore(tableCards);
  const knockThreshold = difficulty === "BOSS_LEVEL" ? 27 : 24;

  if (bestSwap && bestSwap.score > currentScore && bestSwap.score >= swapAllScore) {
    return { type: "SWAP_ONE", handIdx: bestSwap.handIdx, tableIdx: bestSwap.tableIdx };
  }
  if (swapAllScore > currentScore) return { type: "SWAP_ALL" };
  if (currentScore >= knockThreshold) return { type: "KNOCK" };
  if (canPass) return { type: "PASS" };
  return { type: "KNOCK" };
}

// Deal initial game state
export interface DealResult {
  playerHands: Record<string, BCard[]>; // uid → 3 cards
  tableCards: BCard[];
  deck: BCard[];
}

export function dealCards(playerIds: string[]): DealResult {
  const deck = shuffleDeck(createDeck());
  const playerHands: Record<string, BCard[]> = {};
  let idx = 0;
  for (const uid of playerIds) {
    playerHands[uid] = deck.slice(idx, idx + 3);
    idx += 3;
  }
  const tableCards = deck.slice(idx, idx + 3);
  const remaining = deck.slice(idx + 3);
  return { playerHands, tableCards, deck: remaining };
}

export function formatScore(score: number): string {
  return score === 30.5 ? "30½" : score.toString();
}
