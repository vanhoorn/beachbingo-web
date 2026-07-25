import type { SpCard } from "../../types";

export type SpDifficulty = "ROOKIE" | "SNIPER" | "BOSS_LEVEL";

export const ALL_SP_CARDS: SpCard[] = [
  { id: "krabbe_1",         pairId: "krabbe",         emoji: "🦀", name: "Krabbe"        },
  { id: "krabbe_2",         pairId: "krabbe",         emoji: "🦀", name: "Krabbe"        },
  { id: "muschel_1",        pairId: "muschel",        emoji: "🐚", name: "Muschel"       },
  { id: "muschel_2",        pairId: "muschel",        emoji: "🐚", name: "Muschel"       },
  { id: "fisch_1",          pairId: "fisch",          emoji: "🐟", name: "Fisch"         },
  { id: "fisch_2",          pairId: "fisch",          emoji: "🐟", name: "Fisch"         },
  { id: "hai_1",            pairId: "hai",            emoji: "🦈", name: "Hai"           },
  { id: "hai_2",            pairId: "hai",            emoji: "🦈", name: "Hai"           },
  { id: "delfin_1",         pairId: "delfin",         emoji: "🐬", name: "Delfin"        },
  { id: "delfin_2",         pairId: "delfin",         emoji: "🐬", name: "Delfin"        },
  { id: "oktopus_1",        pairId: "oktopus",        emoji: "🐙", name: "Oktopus"       },
  { id: "oktopus_2",        pairId: "oktopus",        emoji: "🐙", name: "Oktopus"       },
  { id: "robbe_1",          pairId: "robbe",          emoji: "🦭", name: "Robbe"         },
  { id: "robbe_2",          pairId: "robbe",          emoji: "🦭", name: "Robbe"         },
  { id: "schildkroete_1",   pairId: "schildkroete",   emoji: "🐢", name: "Schildkröte"  },
  { id: "schildkroete_2",   pairId: "schildkroete",   emoji: "🐢", name: "Schildkröte"  },
  { id: "welle_1",          pairId: "welle",          emoji: "🌊", name: "Welle"         },
  { id: "welle_2",          pairId: "welle",          emoji: "🌊", name: "Welle"         },
  { id: "surfer_1",         pairId: "surfer",         emoji: "🏄", name: "Surfer"        },
  { id: "surfer_2",         pairId: "surfer",         emoji: "🏄", name: "Surfer"        },
  { id: "palme_1",          pairId: "palme",          emoji: "🌴", name: "Palme"         },
  { id: "palme_2",          pairId: "palme",          emoji: "🌴", name: "Palme"         },
  { id: "sonne_1",          pairId: "sonne",          emoji: "☀️", name: "Sonne"         },
  { id: "sonne_2",          pairId: "sonne",          emoji: "☀️", name: "Sonne"         },
  { id: "softeis_1",        pairId: "softeis",        emoji: "🍦", name: "Softeis"       },
  { id: "softeis_2",        pairId: "softeis",        emoji: "🍦", name: "Softeis"       },
  { id: "cocktail_1",       pairId: "cocktail",       emoji: "🍹", name: "Cocktail"      },
  { id: "cocktail_2",       pairId: "cocktail",       emoji: "🍹", name: "Cocktail"      },
  { id: "sonnenbrille_1",   pairId: "sonnenbrille",   emoji: "🕶️", name: "Sonnenbrille" },
  { id: "sonnenbrille_2",   pairId: "sonnenbrille",   emoji: "🕶️", name: "Sonnenbrille" },
  { id: "segelboot_1",      pairId: "segelboot",      emoji: "⛵", name: "Segelboot"     },
  { id: "segelboot_2",      pairId: "segelboot",      emoji: "⛵", name: "Segelboot"     },
  { id: "koralle_1",        pairId: "koralle",        emoji: "🪸", name: "Koralle"       },
  { id: "koralle_2",        pairId: "koralle",        emoji: "🪸", name: "Koralle"       },
  { id: "hummer_1",         pairId: "hummer",         emoji: "🦞", name: "Hummer"        },
  { id: "hummer_2",         pairId: "hummer",         emoji: "🦞", name: "Hummer"        },
  { id: "strandraeuber",    pairId: "strandraeuber",  emoji: "🦹", name: "Strandräuber"  },
];

export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Deal all 37 cards evenly. Some players get one extra card. */
export function dealCards(playerCount: number): SpCard[][] {
  const shuffled = shuffleArray(ALL_SP_CARDS);
  const hands: SpCard[][] = Array.from({ length: playerCount }, () => []);
  for (let i = 0; i < shuffled.length; i++) {
    hands[i % playerCount].push(shuffled[i]);
  }
  return hands;
}

/** Find all matchable pairs in a hand (strandraeuber has no pair). */
export function findPairs(hand: SpCard[]): [SpCard, SpCard][] {
  const pairs: [SpCard, SpCard][] = [];
  const usedIds = new Set<string>();
  for (let i = 0; i < hand.length; i++) {
    if (usedIds.has(hand[i].id)) continue;
    if (hand[i].pairId === "strandraeuber") continue;
    for (let j = i + 1; j < hand.length; j++) {
      if (usedIds.has(hand[j].id)) continue;
      if (hand[i].pairId === hand[j].pairId) {
        pairs.push([hand[i], hand[j]]);
        usedIds.add(hand[i].id);
        usedIds.add(hand[j].id);
        break;
      }
    }
  }
  return pairs;
}

/** Remove all pairs from a hand. Returns remaining cards and discarded pairs. */
export function discardPairs(hand: SpCard[]): { remaining: SpCard[]; discarded: [SpCard, SpCard][] } {
  const discarded = findPairs(hand);
  const discardedIds = new Set<string>();
  for (const [a, b] of discarded) {
    discardedIds.add(a.id);
    discardedIds.add(b.id);
  }
  const remaining = hand.filter((c) => !discardedIds.has(c.id));
  return { remaining, discarded };
}

/** Color per pair for own-card display. */
export const PAIR_COLORS: Record<string, string> = {
  krabbe:        "#ef4444",
  muschel:       "#f97316",
  fisch:         "#0ea5e9",
  hai:           "#64748b",
  delfin:        "#06b6d4",
  oktopus:       "#a855f7",
  robbe:         "#94a3b8",
  schildkroete:  "#22c55e",
  welle:         "#0d9488",
  surfer:        "#f59e0b",
  palme:         "#16a34a",
  sonne:         "#fbbf24",
  softeis:       "#fb7185",
  cocktail:      "#e879f9",
  sonnenbrille:  "#7c3aed",
  segelboot:     "#38bdf8",
  koralle:       "#f43f5e",
  hummer:        "#dc2626",
  strandraeuber: "#e11d48",
};

export const AI_NAMES = ["🤖 Möwe", "🤖 Krabbe", "🤖 Fisch", "🤖 Hai", "🤖 Delfin"];
export const AI_AVATARS = ["🐦", "🦀", "🐟", "🦈", "🐬"];
