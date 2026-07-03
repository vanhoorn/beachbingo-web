export type GameMode = "AUTO_MARK" | "MANUAL_MARK" | "BOSS_LEVEL";
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

export const BEACH_AVATARS = ["🏄", "🤿", "🦀", "🐚", "🌊", "🦞", "☀️", "🏖️", "🐠", "🦈", "🐡", "🦭", "🌴", "🍹", "⛵"];
