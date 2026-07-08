export type PlayerCountKey = "ONE" | "ONE_TWO" | "TWO_FOUR" | "FOUR_PLUS";
export type GameGenreKey = "ACTION" | "PARTY" | "LOGICAL" | "COUCH" | "RIDDLE";

export interface GameMetadata {
  id: string;
  emoji: string;
  title: string;
  description: string;
  color: string;
  path: string;
  playerCounts: PlayerCountKey[];
  genres: GameGenreKey[];
}

export interface PlayerCountInfo {
  label: string;
  emoji: string;
  sublabel: string;
}

export const PLAYER_COUNT_INFO: Record<PlayerCountKey, PlayerCountInfo> = {
  ONE:      { label: "1 Spieler",   emoji: "👤", sublabel: "Solo" },
  ONE_TWO:  { label: "1-2 Spieler", emoji: "🤝", sublabel: "Solo oder zu zweit" },
  TWO_FOUR: { label: "2-4 Spieler", emoji: "👥", sublabel: "Kleine Gruppe" },
  FOUR_PLUS:{ label: "4+ Spieler",  emoji: "🎉", sublabel: "Große Runde" },
};

export const ALL_GAMES: GameMetadata[] = [
  {
    id: "bingo",
    emoji: "🎱",
    title: "BeachBingo",
    description: "Ziehe Zahlen, markiere deine Karte – BINGO!",
    color: "#0ea5e9",
    path: "/lobby",
    playerCounts: ["TWO_FOUR", "FOUR_PLUS"],
    genres: ["PARTY"],
  },
  {
    id: "pong",
    emoji: "🏓",
    title: "BeachVolley",
    description: "Klassisches Volleyball am Strand – wer gewinnt die Runde?",
    color: "#f97316",
    path: "/pong/lobby",
    playerCounts: ["ONE_TWO", "TWO_FOUR"],
    genres: ["ACTION", "PARTY"],
  },
  {
    id: "vier",
    emoji: "🍺",
    title: "Vier4Bier",
    description: "Vier in einer Reihe mit Beach-Twist.",
    color: "#f59e0b",
    path: "/vier/lobby",
    playerCounts: ["ONE", "ONE_TWO"],
    genres: ["LOGICAL"],
  },
  {
    id: "pirates",
    emoji: "🐙",
    title: "BeachPirates",
    description: "Verteidige den Strand! Besiege Quallen, Muscheln und Fische.",
    color: "#a855f7",
    path: "/pirates/lobby",
    playerCounts: ["ONE"],
    genres: ["ACTION"],
  },
  {
    id: "worm",
    emoji: "🪱",
    title: "Wattwurm",
    description: "Frisst Krabben, Muscheln und Fische. Werde nie die Grenzen! 🌊",
    color: "#22c55e",
    path: "/worm/lobby",
    playerCounts: ["ONE"],
    genres: ["ACTION"],
  },
];

export const PLAYER_COUNT_ORDER: PlayerCountKey[] = ["ONE", "ONE_TWO", "TWO_FOUR", "FOUR_PLUS"];
