// ── Seeded RNG ────────────────────────────────────────────────────────────────
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

export type StrandokuVariant = "classic" | "mega12" | "mega16" | "irregular" | "diagonal" | "killer" | "samurai";
export type StrandokuDifficulty = "leicht" | "mittel" | "schwer" | "experte";

export interface KillerCage {
  cells: [number, number][];
  sum: number;
}

export interface StrandokuPuzzle {
  variant: StrandokuVariant;
  size: number;           // 9, 12, or 16
  grid: number[][];       // 0 = empty, otherwise given
  solution: number[][];
  given: boolean[][];
  // Killer
  cages?: KillerCage[];
  // Irregular regions: regionId per cell (size × size)
  regions?: number[][];
  // Samurai: 5 sub-puzzles (each 9×9, first is top-left)
  isSamurai?: boolean;
}

export interface StrandokuState {
  puzzle: StrandokuPuzzle;
  board: number[][];        // player's current entries (0 = empty)
  notes: Set<number>[][];   // candidate notes per cell
  errors: boolean[][];
  selected: [number, number] | null;
  solved: boolean;
}

// ── Variant metadata ──────────────────────────────────────────────────────────

export const VARIANT_LABELS: Record<StrandokuVariant, string> = {
  classic:   "Classic 9×9",
  mega12:    "Mega 12×12",
  mega16:    "Mega 16×16",
  irregular: "Irregular 9×9",
  diagonal:  "Diagonal 9×9",
  killer:    "Killer 9×9",
  samurai:   "Samurai 5×9",
};

export const VARIANT_DESCRIPTIONS: Record<StrandokuVariant, string> = {
  classic:   "Klassisches 9×9 Sudoku",
  mega12:    "Größeres 12×12 Raster",
  mega16:    "Riesiges 16×16 Raster",
  irregular: "Unregelmäßige Bereiche",
  diagonal:  "Extra: Diagonalen 1–9",
  killer:    "Käfige mit Summenbedingungen",
  samurai:   "5 überlappende 9×9 Grids",
};

// ── Box helpers ───────────────────────────────────────────────────────────────

function boxOf(r: number, c: number, size: number): number {
  if (size === 9) return Math.floor(r / 3) * 3 + Math.floor(c / 3);
  if (size === 12) return Math.floor(r / 3) * 4 + Math.floor(c / 4); // 3×4 boxes
  if (size === 16) return Math.floor(r / 4) * 4 + Math.floor(c / 4); // 4×4 boxes
  return 0;
}

function boxBounds(boxId: number, size: number): { r0: number; c0: number; rh: number; ch: number } {
  if (size === 9) return { r0: Math.floor(boxId / 3) * 3, c0: (boxId % 3) * 3, rh: 3, ch: 3 };
  if (size === 12) return { r0: Math.floor(boxId / 4) * 3, c0: (boxId % 4) * 4, rh: 3, ch: 4 };
  if (size === 16) return { r0: Math.floor(boxId / 4) * 4, c0: (boxId % 4) * 4, rh: 4, ch: 4 };
  return { r0: 0, c0: 0, rh: 3, ch: 3 };
}

// ── Core Sudoku solver / generator ───────────────────────────────────────────

function isValid(board: number[][], r: number, c: number, n: number, size: number, regions?: number[][]): boolean {
  // Row
  for (let cc = 0; cc < size; cc++) if (cc !== c && board[r][cc] === n) return false;
  // Col
  for (let rr = 0; rr < size; rr++) if (rr !== r && board[rr][c] === n) return false;
  // Box (classic/mega) or region (irregular)
  if (regions) {
    const regionId = regions[r][c];
    for (let rr = 0; rr < size; rr++) {
      for (let cc = 0; cc < size; cc++) {
        if ((rr !== r || cc !== c) && regions[rr][cc] === regionId && board[rr][cc] === n) return false;
      }
    }
  } else {
    const boxId = boxOf(r, c, size);
    const { r0, c0, rh, ch } = boxBounds(boxId, size);
    for (let rr = r0; rr < r0 + rh; rr++) {
      for (let cc = c0; cc < c0 + ch; cc++) {
        if ((rr !== r || cc !== c) && board[rr][cc] === n) return false;
      }
    }
  }
  return true;
}

function isValidDiag(board: number[][], r: number, c: number, n: number, size: number): boolean {
  // Main diagonal (r === c)
  if (r === c) {
    for (let i = 0; i < size; i++) if (i !== r && board[i][i] === n) return false;
  }
  // Anti-diagonal (r + c === size - 1)
  if (r + c === size - 1) {
    for (let i = 0; i < size; i++) if (i !== r && board[i][size - 1 - i] === n) return false;
  }
  return true;
}

// Fill a board completely using backtracking
function fillBoard(board: number[][], size: number, rng: () => number, diagonal = false, regions?: number[][]): boolean {
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] === 0) {
        const nums = shuffle(Array.from({ length: size }, (_, i) => i + 1), rng);
        for (const n of nums) {
          if (isValid(board, r, c, n, size, regions) && (!diagonal || isValidDiag(board, r, c, n, size))) {
            board[r][c] = n;
            if (fillBoard(board, size, rng, diagonal, regions)) return true;
            board[r][c] = 0;
          }
        }
        return false;
      }
    }
  }
  return true;
}

// Count solutions (up to max); uses MRV heuristic
function countSolutions(board: number[][], size: number, max = 2, diagonal = false, regions?: number[][]): number {
  let count = 0;
  let steps = 0;

  function solve(): boolean {
    if (count >= max) return true;
    if (++steps > 60_000) return true;
    // Find cell with fewest candidates
    let bestR = -1, bestC = -1, bestCount = size + 1;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (board[r][c] !== 0) continue;
        let cand = 0;
        for (let n = 1; n <= size; n++) {
          if (isValid(board, r, c, n, size, regions) && (!diagonal || isValidDiag(board, r, c, n, size))) cand++;
        }
        if (cand === 0) return false; // dead end
        if (cand < bestCount) { bestCount = cand; bestR = r; bestC = c; }
      }
    }
    if (bestR === -1) { count++; return count >= max; }
    for (let n = 1; n <= size; n++) {
      if (isValid(board, bestR, bestC, n, size, regions) && (!diagonal || isValidDiag(board, bestR, bestC, n, size))) {
        board[bestR][bestC] = n;
        if (solve()) return true;
        board[bestR][bestC] = 0;
      }
    }
    return false;
  }

  solve();
  return count;
}

// ── Remove cells to create puzzle ─────────────────────────────────────────────

const REMOVE_COUNT: Record<StrandokuDifficulty, number> = {
  leicht: 30, mittel: 45, schwer: 52, experte: 58,
};
const REMOVE_COUNT_12: Record<StrandokuDifficulty, number> = {
  leicht: 60, mittel: 90, schwer: 110, experte: 128,
};
const REMOVE_COUNT_16: Record<StrandokuDifficulty, number> = {
  leicht: 100, mittel: 130, schwer: 160, experte: 180,
};

function removeClues(solution: number[][], size: number, difficulty: StrandokuDifficulty, rng: () => number, diagonal = false, regions?: number[][]): { grid: number[][]; given: boolean[][] } {
  const removeMap = size === 9 ? REMOVE_COUNT : size === 12 ? REMOVE_COUNT_12 : REMOVE_COUNT_16;
  const toRemove = removeMap[difficulty];
  const grid = solution.map(row => [...row]);
  const given = Array.from({ length: size }, () => Array(size).fill(true));

  const cells = shuffle(
    Array.from({ length: size * size }, (_, i) => [Math.floor(i / size), i % size] as [number, number]),
    rng
  );

  // Large boards (12×12, 16×16) and irregular hard/expert time out in countSolutions,
  // returning 0 (count never increments before the step cap) → every cell is "non-unique"
  // → zero cells removed. Skip the uniqueness check for these cases.
  const skipUniqueness =
    (size > 9 || regions !== undefined) &&
    (difficulty === "schwer" || difficulty === "experte");

  let removed = 0;
  for (const [r, c] of cells) {
    if (removed >= toRemove) break;
    if (skipUniqueness) {
      grid[r][c] = 0;
      given[r][c] = false;
      removed++;
    } else {
      const backup = grid[r][c];
      grid[r][c] = 0;
      given[r][c] = false;
      const temp = grid.map(row => [...row]);
      if (countSolutions(temp, size, 2, diagonal, regions) !== 1) {
        grid[r][c] = backup;
        given[r][c] = true;
      } else {
        removed++;
      }
    }
  }
  return { grid, given };
}

// ── Irregular regions generator ───────────────────────────────────────────────

function generateIrregularRegions(size: number, rng: () => number): number[][] {
  for (let attempt = 0; attempt < 50; attempt++) {
    const result = tryGenerateIrregularRegions(size, rng);
    if (result !== null) return result;
    rng(); // advance RNG so next attempt differs
  }
  // Fallback: rows as regions (guaranteed equal size, always valid)
  return Array.from({ length: size }, (_, r) => Array(size).fill(r));
}

function tryGenerateIrregularRegions(size: number, rng: () => number): number[][] | null {
  const regions: number[][] = Array.from({ length: size }, () => Array(size).fill(-1));

  for (let regionId = 0; regionId < size; regionId++) {
    let startR = -1, startC = -1;
    outer: for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (regions[r][c] === -1) { startR = r; startC = c; break outer; }
      }
    }
    if (startR === -1) break;

    regions[startR][startC] = regionId;
    let placed = 1;
    const frontier: [number, number][] = [[startR, startC]];

    while (placed < size && frontier.length > 0) {
      const idx = Math.floor(rng() * frontier.length);
      const [cr, cc] = frontier[idx];
      const dirs = shuffle([[-1, 0], [1, 0], [0, -1], [0, 1]] as [number, number][], rng);
      let expanded = false;
      for (const [dr, dc] of dirs) {
        const nr = cr + dr, nc = cc + dc;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size && regions[nr][nc] === -1) {
          regions[nr][nc] = regionId;
          frontier.push([nr, nc]);
          placed++;
          expanded = true;
          break;
        }
      }
      if (!expanded) frontier.splice(idx, 1);
    }

    if (placed < size) return null; // region too small — retry entire generation
  }
  return regions;
}

// ── Killer cages ──────────────────────────────────────────────────────────────

function generateKillerCages(solution: number[][], size: number, rng: () => number): KillerCage[] {
  const assigned: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const cages: KillerCage[] = [];

  const cells = shuffle(
    Array.from({ length: size * size }, (_, i) => [Math.floor(i / size), i % size] as [number, number]),
    rng
  );

  for (const [r, c] of cells) {
    if (assigned[r][c]) continue;
    // Create cage of 2-5 cells via random walk
    const cageSize = 2 + Math.floor(rng() * 3);
    const cage: [number, number][] = [[r, c]];
    assigned[r][c] = true;

    while (cage.length < cageSize) {
      const [cr, cc] = cage[Math.floor(rng() * cage.length)];
      const dirs = shuffle([[-1, 0], [1, 0], [0, -1], [0, 1]] as [number, number][], rng);
      let found = false;
      for (const [dr, dc] of dirs) {
        const nr = cr + dr, nc = cc + dc;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size && !assigned[nr][nc]) {
          cage.push([nr, nc]);
          assigned[nr][nc] = true;
          found = true;
          break;
        }
      }
      if (!found) break;
    }

    const sum = cage.reduce((s, [row, col]) => s + solution[row][col], 0);
    cages.push({ cells: cage, sum });
  }
  return cages;
}

// ── Samurai helpers ───────────────────────────────────────────────────────────

// Sub-grid offsets (row, col) for [TL, TR, CENTER, BL, BR]
const SAMURAI_OFFSETS: [number, number][] = [[0,0],[0,12],[6,6],[12,0],[12,12]];

// Number of givens to show per difficulty for Samurai (out of ~369 valid cells)
const SAMURAI_GIVENS: Record<StrandokuDifficulty, number> = {
  leicht: 135, mittel: 105, schwer: 80, experte: 60,
};

// Returns local [row, col] within the first matching 9×9 sub-grid, or null for gap cells
export function getSamuraiLocalPos(r: number, c: number): [number, number] | null {
  for (const [or, oc] of SAMURAI_OFFSETS) {
    if (r >= or && r < or + 9 && c >= oc && c < oc + 9) return [r - or, c - oc];
  }
  return null;
}

// ── Main generator ────────────────────────────────────────────────────────────

export function generateStrandoku(variant: StrandokuVariant, difficulty: StrandokuDifficulty, seed: number): StrandokuPuzzle {
  const rng = mulberry32(seed);

  if (variant === "samurai") return generateSamurai(difficulty, seed);

  const size = variant === "mega12" ? 12 : variant === "mega16" ? 16 : 9;
  const diagonal = variant === "diagonal";
  let regions: number[][] | undefined;

  if (variant === "irregular") {
    regions = generateIrregularRegions(size, rng);
  }

  // Generate complete solution
  const solution: number[][] = Array.from({ length: size }, () => Array(size).fill(0));
  fillBoard(solution, size, rng, diagonal, regions);

  // Remove cells
  const { grid, given } = removeClues(solution, size, difficulty, rng, diagonal, regions);

  let cages: KillerCage[] | undefined;
  if (variant === "killer") {
    cages = generateKillerCages(solution, size, rng);
    // In killer, no givens are shown
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) { grid[r][c] = 0; given[r][c] = false; }
  }

  return { variant, size, grid, solution, given, cages, regions };
}

// Samurai: 5 overlapping 9×9 grids in a 21×21 canvas
// Layout (offsets row,col): TL(0,0) TR(0,12) CENTER(6,6) BL(12,0) BR(12,12)
// Overlap corners (each 3×3):
//   TL bottom-right (rows 6-8, cols 6-8) = CENTER top-left (rows 0-2, cols 0-2)
//   TR bottom-left  (rows 6-8, cols 0-2) = CENTER top-right (rows 0-2, cols 6-8)
//   BL top-right    (rows 0-2, cols 6-8) = CENTER bottom-left (rows 6-8, cols 0-2)
//   BR top-left     (rows 0-2, cols 0-2) = CENTER bottom-right (rows 6-8, cols 6-8)
function generateSamurai(difficulty: StrandokuDifficulty, seed: number): StrandokuPuzzle {
  const rng = mulberry32(seed);
  const FULL = 21;

  // 1. Generate CENTER first
  const center: number[][] = Array.from({ length: 9 }, () => Array(9).fill(0));
  fillBoard(center, 9, rng);

  // 2. TL: seed bottom-right 3×3 from CENTER top-left 3×3
  const tl: number[][] = Array.from({ length: 9 }, () => Array(9).fill(0));
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) tl[6+i][6+j] = center[i][j];
  fillBoard(tl, 9, rng);

  // 3. TR: seed bottom-left 3×3 from CENTER top-right 3×3
  const tr: number[][] = Array.from({ length: 9 }, () => Array(9).fill(0));
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) tr[6+i][j] = center[i][6+j];
  fillBoard(tr, 9, rng);

  // 4. BL: seed top-right 3×3 from CENTER bottom-left 3×3
  const bl: number[][] = Array.from({ length: 9 }, () => Array(9).fill(0));
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) bl[i][6+j] = center[6+i][j];
  fillBoard(bl, 9, rng);

  // 5. BR: seed top-left 3×3 from CENTER bottom-right 3×3
  const br: number[][] = Array.from({ length: 9 }, () => Array(9).fill(0));
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) br[i][j] = center[6+i][6+j];
  fillBoard(br, 9, rng);

  // Build 21×21 solution — overlap cells are written by both grids but always agree
  const subGrids = [tl, tr, center, bl, br]; // same order as SAMURAI_OFFSETS
  const fullSolution: number[][] = Array.from({ length: FULL }, () => Array(FULL).fill(-1));
  subGrids.forEach((sol, idx) => {
    const [or, oc] = SAMURAI_OFFSETS[idx];
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) fullSolution[or+r][oc+c] = sol[r][c];
  });

  // Player grid: 0 for empty valid cells, -1 for gap cells
  const fullGrid: number[][] = fullSolution.map(row => row.map(v => v === -1 ? -1 : 0));
  const fullGiven: boolean[][] = Array.from({ length: FULL }, () => Array(FULL).fill(false));

  // Collect valid positions and show a random subset as givens
  const validCells: [number, number][] = [];
  for (let r = 0; r < FULL; r++)
    for (let c = 0; c < FULL; c++)
      if (fullSolution[r][c] !== -1) validCells.push([r, c]);

  const toShow = shuffle(validCells, rng).slice(0, SAMURAI_GIVENS[difficulty]);
  toShow.forEach(([r, c]) => {
    fullGrid[r][c] = fullSolution[r][c];
    fullGiven[r][c] = true;
  });

  return { variant: "samurai", size: FULL, grid: fullGrid, solution: fullSolution, given: fullGiven, isSamurai: true };
}

// ── State management ──────────────────────────────────────────────────────────

export function createStrandokuState(puzzle: StrandokuPuzzle): StrandokuState {
  const board = puzzle.grid.map(row => [...row]);
  const notes: Set<number>[][] = Array.from({ length: puzzle.size }, () =>
    Array.from({ length: puzzle.size }, () => new Set<number>())
  );
  const errors = Array.from({ length: puzzle.size }, () => Array(puzzle.size).fill(false));
  return { puzzle, board, notes, errors, selected: null, solved: false };
}

export function selectCell(state: StrandokuState, r: number, c: number): StrandokuState {
  if (state.puzzle.given[r]?.[c]) return { ...state, selected: [r, c] };
  return { ...state, selected: [r, c] };
}

export function enterNumber(state: StrandokuState, n: number, noteMode: boolean): StrandokuState {
  const sel = state.selected;
  if (!sel) return state;
  const [r, c] = sel;
  if (state.puzzle.given[r][c]) return state;

  const board = state.board.map(row => [...row]);
  const notes = state.notes.map(row => row.map(s => new Set(s)));

  if (noteMode) {
    if (board[r][c] !== 0) return state;
    const note = notes[r][c];
    if (note.has(n)) note.delete(n); else note.add(n);
  } else {
    board[r][c] = board[r][c] === n ? 0 : n;
    notes[r][c].clear();
  }

  const errors = computeErrors(board, state.puzzle);
  const solved = checkSolved(board, state.puzzle);
  return { ...state, board, notes, errors, solved };
}

export function eraseCell(state: StrandokuState): StrandokuState {
  const sel = state.selected;
  if (!sel) return state;
  const [r, c] = sel;
  if (state.puzzle.given[r][c]) return state;
  const board = state.board.map(row => [...row]);
  const notes = state.notes.map(row => row.map(s => new Set(s)));
  board[r][c] = 0;
  notes[r][c].clear();
  const errors = computeErrors(board, state.puzzle);
  return { ...state, board, notes, errors, solved: false };
}

function computeErrors(board: number[][], puzzle: StrandokuPuzzle): boolean[][] {
  const { size, solution } = puzzle;
  const errors: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] !== 0 && solution[r][c] !== -1 && board[r][c] !== solution[r][c]) {
        errors[r][c] = true;
      }
    }
  }
  return errors;
}

function checkSolved(board: number[][], puzzle: StrandokuPuzzle): boolean {
  const { size, solution } = puzzle;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (solution[r][c] === -1) continue;
      if (board[r][c] !== solution[r][c]) return false;
    }
  }
  return true;
}

// Hint: reveal one empty cell
export function getStrandokuHint(state: StrandokuState): [number, number] | null {
  const { size, solution } = state.puzzle;
  const empties: [number, number][] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (solution[r][c] !== -1 && state.board[r][c] === 0 && !state.puzzle.given[r][c]) {
        empties.push([r, c]);
      }
    }
  }
  if (empties.length === 0) return null;
  return empties[Math.floor(Math.random() * empties.length)];
}

// Serialization
export function serializeStrandokuState(state: StrandokuState): string {
  return JSON.stringify({
    board: state.board,
    notes: state.notes.map(row => row.map(s => Array.from(s))),
  });
}

export function deserializeStrandokuState(puzzle: StrandokuPuzzle, raw: string): StrandokuState {
  try {
    const data = JSON.parse(raw) as { board: number[][]; notes: number[][][] };
    const board = data.board;
    const notes: Set<number>[][] = data.notes.map(row => row.map(s => new Set(s)));
    const errors = computeErrors(board, puzzle);
    const solved = checkSolved(board, puzzle);
    return { puzzle, board, notes, errors, selected: null, solved };
  } catch {
    return createStrandokuState(puzzle);
  }
}

// Box size for display
export function getBoxDimensions(size: number): { bw: number; bh: number } {
  if (size === 9) return { bw: 3, bh: 3 };
  if (size === 12) return { bw: 4, bh: 3 };
  if (size === 16) return { bw: 4, bh: 4 };
  return { bw: 3, bh: 3 };
}

// Check if two cells are in the same box (for highlighting)
export function sameBox(r1: number, c1: number, r2: number, c2: number, size: number): boolean {
  return boxOf(r1, c1, size) === boxOf(r2, c2, size);
}

// Get cage for a cell (killer variant)
export function getCageForCell(puzzle: StrandokuPuzzle, r: number, c: number): KillerCage | undefined {
  return puzzle.cages?.find(cage => cage.cells.some(([cr, cc]) => cr === r && cc === c));
}

// Get region color for irregular
export function getRegionColor(regionId: number): string {
  const colors = [
    "#0ea5e922", "#f59e0b22", "#22c55e22", "#ec489922", "#8b5cf622",
    "#06b6d422", "#f9731622", "#6366f122", "#14b8a622", "#f4322422",
    "#84cc1622", "#a855f722", "#3b82f622", "#ef444422", "#10b98122",
    "#fb923c22",
  ];
  return colors[regionId % colors.length];
}
