export type PlayerCountKey = "SOLO" | "ONE_TWO" | "TWO_FOUR" | "FOUR_PLUS";
export type GameGenreKey = "ACTION" | "PARTY" | "LOGICAL" | "COUCH" | "RIDDLE" | "CARD";
export type PuzzleDifficulty = "leicht" | "mittel" | "schwer" | "experte";

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
  SOLO:     { label: "Solo",        emoji: "🧘", sublabel: "Allein spielen" },
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
    genres: ["PARTY", "COUCH"],
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
    playerCounts: ["ONE_TWO"],
    genres: ["LOGICAL", "COUCH"],
  },
  {
    id: "pirates",
    emoji: "🐙",
    title: "BeachPirates",
    description: "Verteidige den Strand! Besiege Quallen, Muscheln und Fische.",
    color: "#a855f7",
    path: "/pirates/lobby",
    playerCounts: ["SOLO"],
    genres: ["ACTION"],
  },
  {
    id: "worm",
    emoji: "🪱",
    title: "Wattwurm",
    description: "Frisst Krabben, Muscheln und Fische. Werde nie die Grenzen! 🌊",
    color: "#22c55e",
    path: "/worm/lobby",
    playerCounts: ["SOLO"],
    genres: ["COUCH"],
  },
  {
    id: "strandturm",
    emoji: "🗼",
    title: "Strandturm",
    description: "Klettere den Pier hoch, weiche Kokosnüssen aus — bis zum Gipfel!",
    color: "#dc2626",
    path: "/strandturm/lobby",
    playerCounts: ["SOLO"],
    genres: ["ACTION"],
  },
  {
    id: "brandung",
    emoji: "🌊",
    title: "Brandung",
    description: "Schwimm nicht unter! Sammel 31 Punkte gleicher Farbe — Kartenspiel für 2–6.",
    color: "#0d9488",
    path: "/brandung/lobby",
    playerCounts: ["ONE_TWO", "TWO_FOUR", "FOUR_PLUS"],
    genres: ["PARTY", "LOGICAL", "CARD"],
  },
  {
    id: "meermau",
    emoji: "🂠",
    title: "MeerMau",
    description: "Werde als Erster alle Karten los! Mau-Mau mit Strand-Feeling — für 2–4 Spieler.",
    color: "#7c3aed",
    path: "/meermau/lobby",
    playerCounts: ["ONE_TWO", "TWO_FOUR"],
    genres: ["PARTY", "LOGICAL", "CARD"],
  },
  {
    id: "strandraeuber",
    emoji: "🦹",
    title: "Strandräuber",
    description: "Wer hält am Ende den Strandräuber? Paare ablegen, Schwarzen Peter vermeiden!",
    color: "#e11d48",
    path: "/strandraeuber/lobby",
    playerCounts: ["ONE_TWO", "TWO_FOUR", "FOUR_PLUS"],
    genres: ["PARTY", "CARD"],
  },
  {
    id: "mahjong",
    emoji: "🀄",
    title: "GezeitenSteine",
    description: "Mahjong Solitaire am Strand — entferne alle 144 Steine durch Paare.",
    color: "#D4A820",
    path: "/mahjong/lobby",
    playerCounts: ["SOLO"],
    genres: ["COUCH", "LOGICAL"],
  },
  // ── Rätsel-Spiele ──────────────────────────────────────────────────────────
  {
    id: "strandoku",
    emoji: "🔢",
    title: "Strandoku",
    description: "Das meistgespielte Logikrätsel der Welt — 6 Varianten von Classic bis Samurai.",
    color: "#38bdf8",
    path: "/raetsel/strandoku/lobby",
    playerCounts: ["SOLO"],
    genres: ["RIDDLE", "LOGICAL"],
  },
  {
    id: "wellensumme",
    emoji: "➕",
    title: "WellenSumme",
    description: "Kreuzworträtsel mit Zahlen — Blöcke addieren sich zur angegebenen Summe.",
    color: "#c084fc",
    path: "/raetsel/wellensumme/lobby",
    playerCounts: ["SOLO"],
    genres: ["RIDDLE", "LOGICAL"],
  },
  {
    id: "kuestenkrieg",
    emoji: "⚓",
    title: "Küstenkrieg",
    description: "Solo-Logik-Rätsel oder klassisches 2-Spieler-Duell — Flotten versenken!",
    color: "#fb7185",
    path: "/raetsel/kuestenkrieg/lobby",
    playerCounts: ["ONE_TWO"],
    genres: ["COUCH", "LOGICAL"],
  },
  {
    id: "duenenschatten",
    emoji: "◼",
    title: "DünenSchatten",
    description: "Schwärze Felder ein — das japanische Zahlen-Ausschluss-Rätsel.",
    color: "#fbbf24",
    path: "/raetsel/duenenschatten/lobby",
    playerCounts: ["SOLO"],
    genres: ["RIDDLE", "LOGICAL"],
  },
  {
    id: "inselbruecke",
    emoji: "🌉",
    title: "Inselbrücke",
    description: "Verbinde alle Inseln mit Brücken — das japanische Hashi-Rätsel.",
    color: "#4ade80",
    path: "/raetsel/inselbruecke/lobby",
    playerCounts: ["SOLO"],
    genres: ["RIDDLE", "LOGICAL"],
  },
  {
    id: "wortwelle",
    emoji: "💬",
    title: "WortWelle",
    description: "Errate das deutsche Wort in wenigen Versuchen — Wordle auf Deutsch mit Hard Mode.",
    color: "#06b6d4",
    path: "/raetsel/wortwelle/lobby",
    playerCounts: ["SOLO"],
    genres: ["RIDDLE", "LOGICAL"],
  },
  {
    id: "perlentaucher",
    emoji: "🤿",
    title: "Perlentaucher",
    description: "Match-3 am Meeresgrund — tausche Schätze aus, bilde Reihen und knacke 150 Level.",
    color: "#0EA5E9",
    path: "/raetsel/perlentaucher/lobby",
    playerCounts: ["SOLO"],
    genres: ["COUCH", "LOGICAL"],
  },
  {
    id: "sonnenrad",
    emoji: "☀️",
    title: "Sonnenrad",
    description: "Tagesbonus: Drehe drei Muschelkarten auf und klettere die Bonusleiter hinauf!",
    color: "#D4A820",
    path: "/sonnenrad/lobby",
    playerCounts: ["SOLO"],
    genres: ["COUCH"],
  },
  {
    id: "klontausch",
    emoji: "🃏",
    title: "Klontausch",
    description: "Tausch Figuren-Teile blind mit anderen — wer als Erstes seine 3 Zielfiguren komplett hat, gewinnt!",
    color: "#8B5CF6",
    path: "/klontausch/lobby",
    playerCounts: ["TWO_FOUR"],
    genres: ["PARTY", "CARD"],
  },
];

export const SOLO_GAMES   = ALL_GAMES.filter((g) => g.playerCounts.includes("SOLO"));
export const CARD_GAMES   = ALL_GAMES.filter((g) => g.genres.includes("CARD"));
export const RIDDLE_GAMES = ALL_GAMES.filter((g) => g.genres.includes("RIDDLE"));
export const ACTION_GAMES = ALL_GAMES.filter((g) => g.genres.includes("ACTION"));
export const COUCH_GAMES  = ALL_GAMES.filter((g) => g.genres.includes("COUCH"));

export const PLAYER_COUNT_ORDER: PlayerCountKey[] = ["SOLO", "ONE_TWO", "TWO_FOUR", "FOUR_PLUS"];
