export interface GameSave {
  id: string;
  gameType: string;   // "worm" | "pirates" | "strandturm"
  difficulty: string;
  gameState: string;  // JSON-stringified state
  displayLabel: string; // e.g. "Score: 240 · Länge: 8"
  savedAt: number;    // ms timestamp
}

const SAVES_KEY = "beachbande_game_saves";

export function generateGameSaveId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function getGameSaves(): GameSave[] {
  try {
    const raw = localStorage.getItem(SAVES_KEY);
    return raw ? (JSON.parse(raw) as GameSave[]) : [];
  } catch {
    return [];
  }
}

export function getGameSave(gameType: string): GameSave | null {
  return getGameSaves().find((s) => s.gameType === gameType) ?? null;
}

export function saveGame(save: GameSave): void {
  const saves = getGameSaves().filter((s) => s.gameType !== save.gameType);
  saves.unshift(save);
  localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
}

export function deleteGameSave(gameType: string): void {
  localStorage.setItem(
    SAVES_KEY,
    JSON.stringify(getGameSaves().filter((s) => s.gameType !== gameType)),
  );
}
