// ── Typen ─────────────────────────────────────────────────────────────────────

export type WortWelleDifficulty = "leicht" | "mittel" | "schwer" | "experte";
export type LetterStatus = "correct" | "present" | "absent" | "empty" | "typing";
export type GameStatus = "playing" | "won" | "lost";

export interface DifficultyConfig {
  wordLength: number;
  maxGuesses: number;
  hardMode: boolean;
  label: string;
  description: string;
}

export const DIFFICULTY_CONFIG: Record<WortWelleDifficulty, DifficultyConfig> = {
  leicht:  { wordLength: 4, maxGuesses: 7, hardMode: false, label: "Leicht",  description: "4 Buchstaben · 7 Versuche" },
  mittel:  { wordLength: 5, maxGuesses: 6, hardMode: false, label: "Mittel",  description: "5 Buchstaben · 6 Versuche" },
  schwer:  { wordLength: 6, maxGuesses: 6, hardMode: false, label: "Schwer",  description: "6 Buchstaben · 6 Versuche" },
  experte: { wordLength: 7, maxGuesses: 6, hardMode: false, label: "Experte", description: "7 Buchstaben · 6 Versuche" },
};

export const DIFFICULTIES: WortWelleDifficulty[] = ["leicht", "mittel", "schwer", "experte"];

export interface WortWelleState {
  guesses: string[];
  currentInput: string;
  gameStatus: GameStatus;
  targetWord: string;
  hardModeViolation: string | null;
}

export interface WortWelleStats {
  played: number;
  won: number;
  currentStreak: number;
  maxStreak: number;
  distribution: number[];
  lastPlayedDate: string;
  lastDailyDate: string;
  dailyPlayed: number;
  dailyWon: number;
  dailyCurrentStreak: number;
  dailyMaxStreak: number;
  dailyDistribution: number[];
}

// ── Wortlisten — lazy-loaded aus /public/wortwelle/*.txt ────────────────────────
// Quellen: enz/german-wordlist (CC0) + caco3/wordle-de Targets 5 (MIT)
// Umlaute werden beim Laden substituiert: ä→ae, ö→oe, ü→ue, ß→ss

interface WwWordLists {
  targets: Map<number, string[]>;
  pool: Map<number, Set<string>>;
}

let _wordLists: WwWordLists | null = null;
let _initPromise: Promise<WwWordLists> | null = null;

function substituteUmlauts(word: string): string {
  return word
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue")
    .replace(/Ä/g, "AE").replace(/Ö/g, "OE").replace(/Ü/g, "UE")
    .replace(/ß/g, "ss").replace(/ẞ/g, "SS");
}

async function loadWordFile(path: string): Promise<string[]> {
  const res = await fetch(path);
  const text = await res.text();
  return text.split("\n")
    .map(w => substituteUmlauts(w.trim()).toUpperCase())
    .filter(w => w.length > 0 && /^[A-Z]+$/.test(w));
}

export async function initWwWordLists(): Promise<void> {
  if (_wordLists) return;
  if (!_initPromise) {
    _initPromise = (async (): Promise<WwWordLists> => {
      const [t4, t5, t6, t7, p4, p5, p6, p7] = await Promise.all([
        loadWordFile("/wortwelle/targets_4.txt"),
        loadWordFile("/wortwelle/targets_5.txt"),
        loadWordFile("/wortwelle/targets_6.txt"),
        loadWordFile("/wortwelle/targets_7.txt"),
        loadWordFile("/wortwelle/pool_4.txt"),
        loadWordFile("/wortwelle/pool_5.txt"),
        loadWordFile("/wortwelle/pool_6.txt"),
        loadWordFile("/wortwelle/pool_7.txt"),
      ]);

      // Group words by length-after-substitution so umlaut words
      // land in the correct bucket (e.g. BÖSE→BOESE goes to len=5)
      const targets = new Map<number, string[]>();
      const pool = new Map<number, Set<string>>();

      const allTargetWords = [...t4, ...t5, ...t6, ...t7];
      const allPoolWords = [...p4, ...p5, ...p6, ...p7, ...allTargetWords];

      for (const w of allTargetWords) {
        const len = w.length;
        if (len < 4 || len > 7) continue;
        if (!targets.has(len)) targets.set(len, []);
        targets.get(len)!.push(w);
      }

      for (const w of allPoolWords) {
        const len = w.length;
        if (len < 4 || len > 7) continue;
        if (!pool.has(len)) pool.set(len, new Set());
        pool.get(len)!.add(w);
      }

      return { targets, pool };
    })();
  }
  _wordLists = await _initPromise;
}

export function isWwReady(): boolean {
  return _wordLists !== null;
}

function getTargets(len: number): string[] {
  return _wordLists?.targets.get(len) ?? [];
}

function getPool(len: number): Set<string> {
  return _wordLists?.pool.get(len) ?? new Set();
}

// ── Kernfunktionen ─────────────────────────────────────────────────────────────

export function getDailyWord(difficulty: WortWelleDifficulty): { word: string; dateStr: string } {
  const { wordLength } = DIFFICULTY_CONFIG[difficulty];
  const targets = getTargets(wordLength);
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  let h = 0;
  for (let i = 0; i < dateStr.length; i++) h = (h * 31 + dateStr.charCodeAt(i)) | 0;
  const offsets: Record<WortWelleDifficulty, number> = { leicht: 0, mittel: 1000, schwer: 2000, experte: 3000 };
  const idx = Math.abs(h + offsets[difficulty]) % (targets.length || 1);
  return { word: targets[idx] ?? "", dateStr };
}

export function getRandomWord(difficulty: WortWelleDifficulty): string {
  const { wordLength } = DIFFICULTY_CONFIG[difficulty];
  const targets = getTargets(wordLength);
  return targets[Math.floor(Math.random() * targets.length)] ?? "";
}

export function isValidGuess(word: string, difficulty: WortWelleDifficulty): boolean {
  const { wordLength } = DIFFICULTY_CONFIG[difficulty];
  return getPool(wordLength).has(word.toUpperCase());
}

// ── Spiel-Algorithmen ──────────────────────────────────────────────────────────

export function computeStatuses(guess: string, target: string): LetterStatus[] {
  const g = guess.toUpperCase();
  const t = target.toUpperCase();
  const result: LetterStatus[] = new Array(g.length).fill("absent");

  const remaining: Record<string, number> = {};
  for (let i = 0; i < t.length; i++) {
    if (g[i] !== t[i]) remaining[t[i]] = (remaining[t[i]] || 0) + 1;
  }
  for (let i = 0; i < g.length; i++) {
    if (g[i] === t[i]) result[i] = "correct";
  }
  for (let i = 0; i < g.length; i++) {
    if (result[i] === "correct") continue;
    if (remaining[g[i]] && remaining[g[i]] > 0) {
      result[i] = "present";
      remaining[g[i]]--;
    }
  }
  return result;
}

export function computeKeyStatuses(
  guesses: string[],
  target: string
): Record<string, LetterStatus> {
  const priority: Record<LetterStatus, number> = { correct: 3, present: 2, absent: 1, empty: 0, typing: 0 };
  const result: Record<string, LetterStatus> = {};
  for (const guess of guesses) {
    const statuses = computeStatuses(guess, target);
    for (let i = 0; i < guess.length; i++) {
      const ch = guess[i];
      const st = statuses[i];
      if (!result[ch] || priority[st] > priority[result[ch]]) result[ch] = st;
    }
  }
  return result;
}

export function validateHardMode(
  newGuess: string,
  previousGuesses: string[],
  target: string
): string | null {
  if (previousGuesses.length === 0) return null;
  const g = newGuess.toUpperCase();
  for (const prev of previousGuesses) {
    const statuses = computeStatuses(prev, target);
    for (let i = 0; i < prev.length; i++) {
      if (statuses[i] === "correct" && g[i] !== prev[i]) {
        return `Position ${i + 1} muss "${prev[i]}" sein (grüner Buchstabe).`;
      }
    }
    for (let i = 0; i < prev.length; i++) {
      if (statuses[i] === "present" && !g.includes(prev[i])) {
        return `Das Wort muss den Buchstaben "${prev[i]}" enthalten.`;
      }
    }
  }
  return null;
}

// ── Spielzustand ───────────────────────────────────────────────────────────────

export function createInitialState(targetWord: string): WortWelleState {
  return {
    guesses: [],
    currentInput: "",
    gameStatus: "playing",
    targetWord,
    hardModeViolation: null,
  };
}

export function serializeState(state: WortWelleState): string {
  return JSON.stringify({
    guesses: state.guesses,
    currentInput: state.currentInput,
    gameStatus: state.gameStatus,
    targetWord: state.targetWord,
  });
}

export function deserializeState(raw: string): WortWelleState {
  const parsed = JSON.parse(raw);
  return { ...parsed, hardModeViolation: null };
}

// ── Statistiken ────────────────────────────────────────────────────────────────

function makeEmptyStats(maxGuesses: number): WortWelleStats {
  return {
    played: 0, won: 0, currentStreak: 0, maxStreak: 0,
    distribution: new Array(maxGuesses).fill(0),
    lastPlayedDate: "",
    lastDailyDate: "",
    dailyPlayed: 0, dailyWon: 0, dailyCurrentStreak: 0, dailyMaxStreak: 0,
    dailyDistribution: new Array(maxGuesses).fill(0),
  };
}

const STATS_KEY_PREFIX = "wortwelle_stats_";

export function getStats(difficulty: WortWelleDifficulty): WortWelleStats {
  const { maxGuesses } = DIFFICULTY_CONFIG[difficulty];
  try {
    const raw = localStorage.getItem(STATS_KEY_PREFIX + difficulty);
    if (!raw) return makeEmptyStats(maxGuesses);
    const s = JSON.parse(raw) as WortWelleStats;
    while (s.distribution.length < maxGuesses) s.distribution.push(0);
    while (s.dailyDistribution.length < maxGuesses) s.dailyDistribution.push(0);
    return s;
  } catch {
    return makeEmptyStats(maxGuesses);
  }
}

export function saveStats(difficulty: WortWelleDifficulty, stats: WortWelleStats): void {
  try {
    localStorage.setItem(STATS_KEY_PREFIX + difficulty, JSON.stringify(stats));
  } catch { /* ignore */ }
}

export function recordResult(
  difficulty: WortWelleDifficulty,
  won: boolean,
  guessCount: number,
  isDaily: boolean,
  dateStr?: string
): void {
  const stats = getStats(difficulty);
  const today = dateStr ?? new Date().toISOString().slice(0, 10);

  stats.played++;
  if (won) {
    stats.won++;
    const idx = Math.min(guessCount - 1, stats.distribution.length - 1);
    stats.distribution[idx]++;
    if (stats.lastPlayedDate !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      stats.currentStreak = stats.lastPlayedDate === yesterday ? stats.currentStreak + 1 : 1;
      stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
    }
  } else {
    stats.currentStreak = 0;
  }
  stats.lastPlayedDate = today;

  if (isDaily && dateStr) {
    stats.dailyPlayed++;
    if (won) {
      stats.dailyWon++;
      const idx = Math.min(guessCount - 1, stats.dailyDistribution.length - 1);
      stats.dailyDistribution[idx]++;
      if (stats.lastDailyDate !== dateStr) {
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        stats.dailyCurrentStreak = stats.lastDailyDate === yesterday ? stats.dailyCurrentStreak + 1 : 1;
        stats.dailyMaxStreak = Math.max(stats.dailyMaxStreak, stats.dailyCurrentStreak);
      }
    } else {
      stats.dailyCurrentStreak = 0;
    }
    stats.lastDailyDate = dateStr;
  }

  saveStats(difficulty, stats);
}

export function hasDailyBeenPlayed(difficulty: WortWelleDifficulty, dateStr: string): boolean {
  return getStats(difficulty).lastDailyDate === dateStr;
}
