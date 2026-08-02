export type PuzzleGameType =
  | "strandoku"
  | "wellensumme"
  | "kuestenkrieg"
  | "duenenschatten"
  | "inselbruecke"
  | "wortwelle";

export type PuzzleDifficulty = "leicht" | "mittel" | "schwer" | "experte";

export interface PuzzleSave {
  id: string;
  gameType: PuzzleGameType;
  variant: string;
  difficulty: PuzzleDifficulty;
  seed: number;
  puzzleState: string; // JSON-stringified game-specific state
  startedAt: number;   // ms timestamp
  elapsedSeconds: number;
}

const SAVES_KEY = "beachbande_puzzle_saves";
const BEST_TIMES_KEY = "beachbande_puzzle_best_times";

export function generateSaveId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function getPuzzleSaves(): PuzzleSave[] {
  try {
    const raw = localStorage.getItem(SAVES_KEY);
    return raw ? (JSON.parse(raw) as PuzzleSave[]) : [];
  } catch {
    return [];
  }
}

export function savePuzzle(save: PuzzleSave): void {
  const saves = getPuzzleSaves().filter((s) => s.id !== save.id);
  saves.unshift(save); // newest first
  localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
}

export function deletePuzzleSave(id: string): void {
  localStorage.setItem(
    SAVES_KEY,
    JSON.stringify(getPuzzleSaves().filter((s) => s.id !== id)),
  );
}

export function getBestTime(
  gameType: string,
  variant: string,
  difficulty: string,
): number | null {
  try {
    const raw = localStorage.getItem(BEST_TIMES_KEY);
    const times: Record<string, number> = raw ? JSON.parse(raw) : {};
    return times[`${gameType}_${variant}_${difficulty}`] ?? null;
  } catch {
    return null;
  }
}

export function recordBestTime(
  gameType: string,
  variant: string,
  difficulty: string,
  seconds: number,
): void {
  try {
    const raw = localStorage.getItem(BEST_TIMES_KEY);
    const times: Record<string, number> = raw ? JSON.parse(raw) : {};
    const key = `${gameType}_${variant}_${difficulty}`;
    if (!times[key] || seconds < times[key]) {
      times[key] = seconds;
      localStorage.setItem(BEST_TIMES_KEY, JSON.stringify(times));
    }
  } catch { /* ignore */ }
}

export function getBestTimeAny(gameTypePrefix: string, difficulty: string): number | null {
  try {
    const raw = localStorage.getItem(BEST_TIMES_KEY);
    const times: Record<string, number> = raw ? JSON.parse(raw) : {};
    const suffix = `_${difficulty}`;
    const matches = Object.entries(times)
      .filter(([k]) => k.startsWith(gameTypePrefix) && k.endsWith(suffix))
      .map(([, v]) => v);
    return matches.length > 0 ? Math.min(...matches) : null;
  } catch {
    return null;
  }
}

export function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}min ${s < 10 ? "0" : ""}${s}s` : `${s}s`;
}

export const PUZZLE_GAME_INFO: Record<
  PuzzleGameType,
  { title: string; emoji: string; color: string }
> = {
  strandoku:      { title: "Strandoku",     emoji: "🔢", color: "#38bdf8" },
  wellensumme:    { title: "WellenSumme",   emoji: "➕", color: "#c084fc" },
  kuestenkrieg:   { title: "Küstenkrieg",   emoji: "⚓", color: "#fb7185" },
  duenenschatten: { title: "DünenSchatten", emoji: "◼",  color: "#fbbf24" },
  inselbruecke:   { title: "Inselbrücke",   emoji: "🌉", color: "#4ade80" },
  wortwelle:      { title: "WortWelle",     emoji: "🌊", color: "#06b6d4" },
};

export const PUZZLE_DIFFICULTY_LABELS: Record<PuzzleDifficulty, string> = {
  leicht:  "Leicht",
  mittel:  "Mittel",
  schwer:  "Schwer",
  experte: "Experte",
};
