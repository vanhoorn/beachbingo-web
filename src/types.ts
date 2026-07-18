export type GameMode = "AUTO_MARK" | "MANUAL_MARK" | "MINI_BOSS_LEVEL" | "BOSS_LEVEL";
export type DrawStyle = "INSTANT" | "DRUM";
export type GameStatus = "LOBBY" | "RUNNING" | "FINISHED";

export interface User {
  uid: string;
  displayName: string;
  email: string;
  avatarUrl: string;
  preferredGameMode: GameMode;
  preferredDrawStyle: DrawStyle;
  bossLevelEliminationInterval: number;
  // BeachVolley preferences
  preferredPongDifficulty?: PongDifficulty;
  preferredPongScoreLimit?: number;
  preferredPongPaddles?: 2 | 3 | 4;
  // Vier4Bier preferences
  preferredVierDrinkId?: string;
  preferredVierDifficulty?: VierDifficulty;
  // BeachPirates preferences
  preferredPiratesDifficulty?: PiratesDifficulty;
  preferredPiratesFireRate?: number;       // 1–10
  preferredPiratesControlMode?: "BUTTONS" | "TOUCH";
  piratesHighScore?: number;
  piratesHighScores?: { ROOKIE?: number; SNIPER?: number; BOSS_LEVEL?: number };
  // Wattwurm preferences
  preferredWormDifficulty?: WormDifficulty;
  preferredWormControlMode?: "BUTTONS" | "SWIPE";
  wormHighScores?: { ROOKIE?: number; SNIPER?: number; BOSS_LEVEL?: number };
  // Strandturm preferences
  preferredStrandturmControlMode?: "BUTTONS" | "TOUCH" | "SPLIT";
  strandturmHighScore?: number;
  strandturmBestLevel?: number;
  // Brandung preferences
  brandungNewCardsOnAllPass?: boolean;
  brandungPassingForbidden?: boolean;
  // Global audio settings
  soundEnabled?: boolean;
  musicEnabled?: boolean;
}

export interface BingoCard {
  grid: number[]; // flat array of 25 numbers (row-major)
  markedNumbers: number[];
}

export interface BingoPlayer {
  userId: string;
  displayName: string;
  avatarUrl: string;
  card: BingoCard;
  hasBingo: boolean;
}

export interface BingoGame {
  gameId: string;
  adminId: string;
  status: GameStatus;
  gameMode: GameMode;
  drawStyle: DrawStyle;
  players: BingoPlayer[];
  playerIds: string[];
  drawnNumbers: number[];
  currentNumber: number | null;
  drawAnimationActive: boolean;
  totalDrawCount: number;
  eliminationInterval: number;
  eliminationPendingPlayerId: string | null;
  eliminationAnimationActive: boolean;
  eliminationPlayerName: string | null;
  eliminationPlayerAvatar: string | null;
  eliminationNumber: number | null;
  createdAt: number;
}

export interface GameResult {
  resultId: string;
  gameId: string;
  winnerName: string;
  winnerId: string;
  winnerAvatar: string;
  playerCount: number;
  drawnNumbersCount: number;
  finishedAt: number;
  playerIds: string[];
  playerNames: string[];
  playerAvatars: string[];
}

export const BEACH_AVATARS = ["🏄", "🤿", "🦀", "🐚", "🌊", "🦞", "🌞", "🌅", "🐠", "🦈", "🐡", "🦭", "🌴", "⛵", "🐬"];

export const COCKTAIL_AVATARS = ["🍸", "🥂", "🍾", "🥃", "🍷", "🧋", "🍺", "🍻", "🫗", "🧃", "🍵", "🥤", "🍋", "🫧", "🍑"];

export const HOTPROMS_AVATARS = ["🦁👑", "🐍👑", "💜🎤", "🤠🎸", "🎸🔥", "🤡🃏", "💣🎤", "🌹💃", "🦆🎬", "💃🕺", "🎀🔮", "🌹🎸", "🎭✨", "⚡🌟", "☂️💄"];

export const AVATAR_CATEGORIES = [
  { key: "beach",    label: "Beach",     emoji: "🏖️", avatars: BEACH_AVATARS,    color: "var(--primary)",  selBg: "var(--primary-bg)" },
  { key: "cocktail", label: "Cocktails", emoji: "🍸", avatars: COCKTAIL_AVATARS, color: "var(--coral)",    selBg: "var(--coral-bg)"   },
  { key: "hotproms", label: "HotProms",  emoji: "⭐", avatars: HOTPROMS_AVATARS, color: "#a855f7",         selBg: "rgba(168,85,247,0.12)" },
] as const;

// Vier4Bier
export type VierDifficulty = "ROOKIE" | "SNIPER" | "BOSS_LEVEL";
export type VierStatus = "LOBBY" | "RUNNING" | "FINISHED";

export interface VierPlayer {
  userId: string;
  displayName: string;
  avatarUrl: string;
  drinkId: string;
}

export interface VierGame {
  gameId: string;
  adminId: string;
  status: VierStatus;
  humanCount: 1 | 2;
  players: VierPlayer[];
  playerIds: string[];
  board: number[];      // flat 42 elements (6 rows × 7 cols), 0=empty 1=player1 2=player2
  currentTurn: string;  // userId
  winnerId: string | null;
  isDraw: boolean;
  createdAt: number;
}

// BeachPirates
export type PiratesDifficulty = "ROOKIE" | "SNIPER" | "BOSS_LEVEL";

// Brandung (Schwimmen)
export type CardSuit = "♣" | "♠" | "♥" | "♦";
export type CardRank = "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A";
export type BrandungDifficulty = "ROOKIE" | "SNIPER" | "BOSS_LEVEL";

export interface BrandungCard { suit: CardSuit; rank: CardRank }

export interface BrandungPlayer {
  userId: string;
  displayName: string;
  avatarUrl: string;
  hand: BrandungCard[];
  lives: number;
  eliminated: boolean;
  isAI: boolean;
}

export interface BrandungSettings {
  newCardsOnAllPass: boolean;
  passingForbidden: boolean;
}

export interface BrandungGame {
  gameId: string;
  adminId: string;
  status: "LOBBY" | "RUNNING" | "FINISHED";
  phase: "TURN" | "ROUND_END" | "GAME_OVER";
  players: { [uid: string]: BrandungPlayer };
  playerIds: string[];
  currentTurnIndex: number;
  tableCards: BrandungCard[];
  deck: BrandungCard[];
  knockedByUserId: string | null;
  knockRoundRemaining: string[];
  round: number;
  passCount: number;
  settings: BrandungSettings;
  winnerId: string | null;
  roundLosers: string[];
  roundScores: { [uid: string]: number };
  lastAction: string;
  createdAt: number;
}

// Wattwurm
export type WormDifficulty = "ROOKIE" | "SNIPER" | "BOSS_LEVEL";

// BeachVolley
export type PongDifficulty = "ROOKIE" | "SNIPER" | "BOSS_LEVEL";
export type PongStatus    = "LOBBY" | "RUNNING" | "FINISHED";
export type PongSide      = "left" | "right" | "top" | "bottom";

export interface PongPlayer {
  userId: string;
  displayName: string;
  avatarUrl: string;
  side: PongSide;
}

export interface PongGame {
  gameId: string;
  adminId: string;
  status: PongStatus;
  totalPaddles: number;  // 2 | 3 | 4
  humanCount: number;    // how many human players
  difficulty: PongDifficulty;
  scoreLimit: number;
  players: PongPlayer[];
  playerIds: string[];
  wallSide: PongSide | null; // for 3-paddle mode: which side is a wall
  // Synced physics (written by host ~15fps)
  ballX: number; ballY: number; ballVX: number; ballVY: number; speed: number;
  paddleLeft: number; paddleRight: number; paddleTop: number; paddleBottom: number;
  scoreLeft: number; scoreRight: number; scoreTop: number; scoreBottom: number;
  paused: boolean; pauseTimer: number;
  winnerId: string | null;
  createdAt: number;
}
