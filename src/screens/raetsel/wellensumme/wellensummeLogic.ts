// Seeded RNG
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
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export type KakuroDifficulty = "leicht" | "mittel" | "schwer" | "experte";

export interface KakuroClue {
  sum: number;    // 0 means no clue in that direction
}

export interface KakuroCell {
  isBlack: boolean;
  downClue?: number;   // sum for downward run
  rightClue?: number;  // sum for rightward run
  solution?: number;   // 1-9 for white cells
}

export interface KakuroPuzzle {
  size: number;
  cells: KakuroCell[][];
}

export interface KakuroState {
  puzzle: KakuroPuzzle;
  board: number[][];   // 0 = empty, 1-9 = entered
  errors: boolean[][];
  selected: [number, number] | null;
  solved: boolean;
}

export const KAKURO_SIZES: Record<KakuroDifficulty, number> = {
  leicht: 7, mittel: 9, schwer: 11, experte: 13,
};

// ── Generator ─────────────────────────────────────────────────────────────────

export function generateKakuro(difficulty: KakuroDifficulty, seed: number): KakuroPuzzle {
  const size = KAKURO_SIZES[difficulty];
  const rng = mulberry32(seed);

  for (let attempt = 0; attempt < 20; attempt++) {
    const puzzle = tryGenerateKakuro(size, rng);
    if (puzzle) return puzzle;
  }
  return generateKakuro(difficulty, seed + 111);
}

function tryGenerateKakuro(size: number, rng: () => number): KakuroPuzzle | null {
  // Step 1: Create black/white pattern
  // Borders are black. Interior has ~30% black cells.
  const isBlack: boolean[][] = Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => r === 0 || c === 0 || (r > 0 && c > 0 && rng() < 0.28))
  );

  // Ensure every white run has length >= 2 (Kakuro constraint)
  // Adjust: make single white cells black
  for (let pass = 0; pass < 5; pass++) {
    let changed = false;
    for (let r = 1; r < size; r++) {
      for (let c = 1; c < size; c++) {
        if (!isBlack[r][c]) {
          const runH = getRunLength(isBlack, r, c, 0, 1, size);
          const runV = getRunLength(isBlack, r, c, 1, 0, size);
          if (runH === 1 || runV === 1) { isBlack[r][c] = true; changed = true; }
        }
      }
    }
    if (!changed) break;
  }

  // Check at least some white cells remain
  const whiteCells = [];
  for (let r = 1; r < size; r++) for (let c = 1; c < size; c++) if (!isBlack[r][c]) whiteCells.push([r, c]);
  if (whiteCells.length < 6) return null;

  // Step 2: Assign numbers to white cells (backtracking)
  const solution: number[][] = Array.from({ length: size }, () => Array(size).fill(0));
  if (!fillKakuro(solution, isBlack, size, shuffle([...whiteCells] as [number, number][], rng), 0)) return null;

  // Step 3: Compute clues from solution
  const cells: KakuroCell[][] = Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => {
      if (isBlack[r][c]) {
        const cell: KakuroCell = { isBlack: true };
        // right clue: sum of run to the right
        if (c < size - 1 && !isBlack[r][c + 1]) {
          let sum = 0;
          for (let cc = c + 1; cc < size && !isBlack[r][cc]; cc++) sum += solution[r][cc];
          cell.rightClue = sum;
        }
        // down clue: sum of run below
        if (r < size - 1 && !isBlack[r + 1][c]) {
          let sum = 0;
          for (let rr = r + 1; rr < size && !isBlack[rr][c]; rr++) sum += solution[rr][c];
          cell.downClue = sum;
        }
        return cell;
      } else {
        return { isBlack: false, solution: solution[r][c] };
      }
    })
  );

  return { size, cells };
}

function getRunLength(isBlack: boolean[][], r: number, c: number, dr: number, dc: number, size: number): number {
  // Find start of run
  let rr = r, cc = c;
  while (rr > 0 && cc > 0 && !isBlack[rr - dr][cc - dc]) { rr -= dr; cc -= dc; }
  // Count length
  let len = 0;
  while (rr < size && cc < size && !isBlack[rr][cc]) { len++; rr += dr; cc += dc; }
  return len;
}

function fillKakuro(solution: number[][], isBlack: boolean[][], size: number, whiteCells: [number, number][], idx: number): boolean {
  if (idx === whiteCells.length) return validateKakuro(solution, isBlack, size);

  const [r, c] = whiteCells[idx];
  for (let n = 1; n <= 9; n++) {
    if (isPlaceable(solution, isBlack, r, c, n, size)) {
      solution[r][c] = n;
      if (fillKakuro(solution, isBlack, size, whiteCells, idx + 1)) return true;
      solution[r][c] = 0;
    }
  }
  return false;
}

function isPlaceable(sol: number[][], isBlack: boolean[][], r: number, c: number, n: number, size: number): boolean {
  // No duplicate in horizontal run
  for (let cc = c - 1; cc >= 0 && !isBlack[r][cc]; cc--) if (sol[r][cc] === n) return false;
  for (let cc = c + 1; cc < size && !isBlack[r][cc]; cc++) if (sol[r][cc] === n) return false;
  // No duplicate in vertical run
  for (let rr = r - 1; rr >= 0 && !isBlack[rr][c]; rr--) if (sol[rr][c] === n) return false;
  for (let rr = r + 1; rr < size && !isBlack[rr][c]; rr++) if (sol[rr][c] === n) return false;
  return true;
}

function validateKakuro(sol: number[][], isBlack: boolean[][], size: number): boolean {
  // All white cells filled
  for (let r = 1; r < size; r++) for (let c = 1; c < size; c++) if (!isBlack[r][c] && sol[r][c] === 0) return false;
  return true;
}

// ── State management ──────────────────────────────────────────────────────────

export function createKakuroState(puzzle: KakuroPuzzle): KakuroState {
  const board: number[][] = Array.from({ length: puzzle.size }, () => Array(puzzle.size).fill(0));
  const errors: boolean[][] = Array.from({ length: puzzle.size }, () => Array(puzzle.size).fill(false));
  return { puzzle, board, errors, selected: null, solved: false };
}

export function selectKakuroCell(state: KakuroState, r: number, c: number): KakuroState {
  if (state.puzzle.cells[r][c].isBlack) return state;
  return { ...state, selected: [r, c] };
}

export function enterKakuroNumber(state: KakuroState, n: number): KakuroState {
  const sel = state.selected;
  if (!sel) return state;
  const [r, c] = sel;
  const board = state.board.map(row => [...row]);
  board[r][c] = board[r][c] === n ? 0 : n;
  const errors = computeKakuroErrors(board, state.puzzle);
  const solved = checkKakuroSolved(board, state.puzzle);
  return { ...state, board, errors, solved };
}

export function eraseKakuroCell(state: KakuroState): KakuroState {
  const sel = state.selected;
  if (!sel) return state;
  const [r, c] = sel;
  const board = state.board.map(row => [...row]);
  board[r][c] = 0;
  const errors = computeKakuroErrors(board, state.puzzle);
  return { ...state, board, errors, solved: false };
}

function computeKakuroErrors(board: number[][], puzzle: KakuroPuzzle): boolean[][] {
  const { size, cells } = puzzle;
  const errors: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  // Check runs: wrong sum or duplicate
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const cell = cells[r][c];
      if (!cell.isBlack) {
        if (board[r][c] !== 0 && cell.solution !== undefined && board[r][c] !== cell.solution) {
          errors[r][c] = true;
        }
      }
    }
  }
  return errors;
}

function checkKakuroSolved(board: number[][], puzzle: KakuroPuzzle): boolean {
  const { size, cells } = puzzle;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const cell = cells[r][c];
      if (!cell.isBlack && board[r][c] !== cell.solution) return false;
    }
  }
  return true;
}

// Serialization
export function serializeKakuroState(state: KakuroState): string {
  return JSON.stringify({ board: state.board });
}

export function deserializeKakuroState(puzzle: KakuroPuzzle, raw: string): KakuroState {
  try {
    const data = JSON.parse(raw) as { board: number[][] };
    const board = data.board;
    const errors = computeKakuroErrors(board, puzzle);
    const solved = checkKakuroSolved(board, puzzle);
    return { puzzle, board, errors, selected: null, solved };
  } catch {
    return createKakuroState(puzzle);
  }
}

// Hint: reveal one cell
export function getKakuroHint(state: KakuroState): [number, number] | null {
  const { size, cells } = state.puzzle;
  const wrongs: [number, number][] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const cell = cells[r][c];
      if (!cell.isBlack && state.board[r][c] !== cell.solution) wrongs.push([r, c]);
    }
  }
  if (wrongs.length === 0) return null;
  return wrongs[Math.floor(Math.random() * wrongs.length)];
}
