// Seeded RNG (mulberry32)
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export type CellMark = "white" | "black" | "dot";
export type HitoriDifficulty = "leicht" | "mittel" | "schwer" | "experte";

export interface HitoriPuzzle {
  size: number;
  grid: number[][];      // numbers shown to player
  solution: boolean[][]; // true = black cell
}

export interface HitoriState {
  puzzle: HitoriPuzzle;
  marks: CellMark[][];
  solved: boolean;
  conflicts: boolean[][];
}

export const HITORI_SIZES: Record<HitoriDifficulty, number> = {
  leicht: 5,
  mittel: 7,
  schwer: 9,
  experte: 11,
};

// Check if a cell has adjacent black cells
function hasAdjacentBlack(isBlack: boolean[][], r: number, c: number, size: number): boolean {
  if (r > 0 && isBlack[r - 1][c]) return true;
  if (r < size - 1 && isBlack[r + 1][c]) return true;
  if (c > 0 && isBlack[r][c - 1]) return true;
  if (c < size - 1 && isBlack[r][c + 1]) return true;
  return false;
}

// Check all white cells form a single connected group
function isWhiteConnected(isBlack: boolean[][], size: number): boolean {
  let startR = -1, startC = -1;
  let whiteCount = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!isBlack[r][c]) {
        whiteCount++;
        if (startR === -1) { startR = r; startC = c; }
      }
    }
  }
  if (whiteCount === 0) return false;

  const visited = Array.from({ length: size }, () => Array(size).fill(false));
  const queue: [number, number][] = [[startR, startC]];
  visited[startR][startC] = true;
  let visitedCount = 1;

  while (queue.length > 0) {
    const [r, c] = queue.shift()!;
    const dirs: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of dirs) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < size && nc >= 0 && nc < size && !isBlack[nr][nc] && !visited[nr][nc]) {
        visited[nr][nc] = true;
        visitedCount++;
        queue.push([nr, nc]);
      }
    }
  }
  return visitedCount === whiteCount;
}

// Generate a valid black pattern (no adjacent black, all white connected, ~25% black)
function generateBlackPattern(size: number, rng: () => number): boolean[][] {
  const isBlack: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const target = Math.floor(size * size * (0.22 + rng() * 0.08));
  let count = 0;

  const cells = shuffle(
    Array.from({ length: size * size }, (_, i) => [Math.floor(i / size), i % size] as [number, number]),
    rng
  );

  for (const [r, c] of cells) {
    if (count >= target) break;
    if (!hasAdjacentBlack(isBlack, r, c, size)) {
      isBlack[r][c] = true;
      if (isWhiteConnected(isBlack, size)) {
        count++;
      } else {
        isBlack[r][c] = false;
      }
    }
  }
  return isBlack;
}

// Assign numbers to white cells: each row/col has unique numbers among white cells
function assignWhiteNumbers(size: number, isBlack: boolean[][], rng: () => number): number[][] | null {
  const grid: number[][] = Array.from({ length: size }, () => Array(size).fill(0));

  // Collect white cells sorted by most constrained (fewest in row/col)
  const whiteCells: [number, number][] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!isBlack[r][c]) whiteCells.push([r, c]);
    }
  }

  function usedInRow(r: number) {
    const s = new Set<number>();
    for (let c = 0; c < size; c++) if (!isBlack[r][c] && grid[r][c] > 0) s.add(grid[r][c]);
    return s;
  }
  function usedInCol(c: number) {
    const s = new Set<number>();
    for (let r = 0; r < size; r++) if (!isBlack[r][c] && grid[r][c] > 0) s.add(grid[r][c]);
    return s;
  }

  function backtrack(idx: number): boolean {
    if (idx === whiteCells.length) return true;
    const [r, c] = whiteCells[idx];
    const usedR = usedInRow(r);
    const usedC = usedInCol(c);
    const candidates = shuffle(
      Array.from({ length: size }, (_, i) => i + 1).filter(n => !usedR.has(n) && !usedC.has(n)),
      rng
    );
    for (const n of candidates) {
      grid[r][c] = n;
      if (backtrack(idx + 1)) return true;
      grid[r][c] = 0;
    }
    return false;
  }

  if (!backtrack(0)) return null;
  return grid;
}

// Assign numbers to black cells (must create duplicates in row/col to give clues)
function assignBlackNumbers(size: number, grid: number[][], isBlack: boolean[][], rng: () => number): void {
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!isBlack[r][c]) continue;
      // Pick number appearing in same row/col white cells
      const candidates: number[] = [];
      for (let cc = 0; cc < size; cc++) {
        if (!isBlack[r][cc] && grid[r][cc] > 0) candidates.push(grid[r][cc]);
      }
      for (let rr = 0; rr < size; rr++) {
        if (!isBlack[rr][c] && grid[rr][c] > 0) candidates.push(grid[rr][c]);
      }
      if (candidates.length > 0) {
        grid[r][c] = candidates[Math.floor(rng() * candidates.length)];
      } else {
        grid[r][c] = Math.floor(rng() * size) + 1;
      }
    }
  }
}

export function generateHitori(difficulty: HitoriDifficulty, seed: number): HitoriPuzzle {
  const size = HITORI_SIZES[difficulty];
  const rng = mulberry32(seed);

  // Try up to 20 times in case generation fails
  for (let attempt = 0; attempt < 20; attempt++) {
    const solution = generateBlackPattern(size, rng);
    const grid = assignWhiteNumbers(size, solution, rng);
    if (!grid) continue;
    assignBlackNumbers(size, grid, solution, rng);
    return { size, grid, solution };
  }

  // Fallback: use different seed
  return generateHitori(difficulty, seed + 7777);
}

// ── State management ──────────────────────────────────────────────────────────

export function createHitoriState(puzzle: HitoriPuzzle): HitoriState {
  const marks: CellMark[][] = Array.from({ length: puzzle.size }, () =>
    Array(puzzle.size).fill("white")
  );
  return { puzzle, marks, solved: false, conflicts: computeConflicts(marks, puzzle) };
}

export function toggleMark(state: HitoriState, r: number, c: number): HitoriState {
  const marks = state.marks.map(row => [...row]);
  const current = marks[r][c];
  marks[r][c] = current === "white" ? "black" : current === "black" ? "dot" : "white";
  const conflicts = computeConflicts(marks, state.puzzle);
  const solved = checkSolved(marks, state.puzzle);
  return { ...state, marks, conflicts, solved };
}

export function setMark(state: HitoriState, r: number, c: number, mark: CellMark): HitoriState {
  const marks = state.marks.map(row => [...row]);
  marks[r][c] = mark;
  const conflicts = computeConflicts(marks, state.puzzle);
  const solved = checkSolved(marks, state.puzzle);
  return { ...state, marks, conflicts, solved };
}

function computeConflicts(marks: CellMark[][], puzzle: HitoriPuzzle): boolean[][] {
  const { size, grid } = puzzle;
  const conflict: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  // Adjacent black cells
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (marks[r][c] === "black") {
        if (r > 0 && marks[r - 1][c] === "black") { conflict[r][c] = true; conflict[r - 1][c] = true; }
        if (c > 0 && marks[r][c - 1] === "black") { conflict[r][c] = true; conflict[r][c - 1] = true; }
      }
    }
  }

  // Duplicate white numbers in rows
  for (let r = 0; r < size; r++) {
    const seen = new Map<number, number>();
    for (let c = 0; c < size; c++) {
      if (marks[r][c] !== "black") {
        const n = grid[r][c];
        if (seen.has(n)) {
          conflict[r][c] = true;
          conflict[r][seen.get(n)!] = true;
        } else {
          seen.set(n, c);
        }
      }
    }
  }

  // Duplicate white numbers in cols
  for (let c = 0; c < size; c++) {
    const seen = new Map<number, number>();
    for (let r = 0; r < size; r++) {
      if (marks[r][c] !== "black") {
        const n = grid[r][c];
        if (seen.has(n)) {
          conflict[r][c] = true;
          conflict[seen.get(n)!][c] = true;
        } else {
          seen.set(n, r);
        }
      }
    }
  }

  return conflict;
}

function checkSolved(marks: CellMark[][], puzzle: HitoriPuzzle): boolean {
  const { size, solution } = puzzle;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const shouldBeBlack = solution[r][c];
      const isBlack = marks[r][c] === "black";
      if (shouldBeBlack !== isBlack) return false;
    }
  }
  return true;
}

// State serialization for save system
export function serializeHitoriState(state: HitoriState): string {
  return JSON.stringify({ marks: state.marks });
}

export function deserializeHitoriState(puzzle: HitoriPuzzle, raw: string): HitoriState {
  try {
    const data = JSON.parse(raw) as { marks: CellMark[][] };
    const marks = data.marks;
    const conflicts = computeConflicts(marks, puzzle);
    const solved = checkSolved(marks, puzzle);
    return { puzzle, marks, conflicts, solved };
  } catch {
    return createHitoriState(puzzle);
  }
}

// Hint: reveal one incorrectly marked cell
export function getHint(state: HitoriState): [number, number] | null {
  const { size, solution } = state.puzzle;
  const wrong: [number, number][] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const shouldBeBlack = solution[r][c];
      const isBlack = state.marks[r][c] === "black";
      if (shouldBeBlack !== isBlack) wrong.push([r, c]);
    }
  }
  if (wrong.length === 0) return null;
  return wrong[Math.floor(Math.random() * wrong.length)];
}
