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

export type KriegDifficulty = "leicht" | "mittel" | "schwer" | "experte";

// Battleship puzzle: Nonogram-style
// Grid has ships placed. Clues are counts per row and column.
// Ships: 1×Schlachtschiff(4), 2×Kreuzer(3), 3×Zerstörer(2), 4×U-Boot(1)
export const FLEET: Record<KriegDifficulty, number[]> = {
  leicht:  [3, 2, 2, 1, 1, 1],                  // 10×10 small fleet
  mittel:  [4, 3, 3, 2, 2, 2, 1, 1, 1, 1],      // standard fleet
  schwer:  [4, 3, 3, 2, 2, 2, 1, 1, 1, 1],
  experte: [4, 4, 3, 3, 2, 2, 2, 1, 1, 1, 1, 1],
};

export const GRID_SIZES: Record<KriegDifficulty, number> = {
  leicht: 8, mittel: 10, schwer: 10, experte: 12,
};

export interface BattleshipPuzzle {
  size: number;
  solution: boolean[][];  // true = ship cell
  rowClues: number[];
  colClues: number[];
  // Partial reveal: some cells shown as given
  givenShip: boolean[][];
  givenWater: boolean[][];
}

export type CellMark = "unknown" | "ship" | "water";

export interface BattleshipState {
  puzzle: BattleshipPuzzle;
  marks: CellMark[][];
  solved: boolean;
}

// Place ships on grid
function placeShips(size: number, fleet: number[], rng: () => number): boolean[][] | null {
  const grid: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  for (const shipLen of fleet) {
    let placed = false;
    const attempts = shuffle(
      Array.from({ length: size * size * 2 }, () => ({
        r: Math.floor(rng() * size),
        c: Math.floor(rng() * size),
        horiz: rng() < 0.5,
      })),
      rng
    );

    for (const { r, c, horiz } of attempts) {
      if (canPlace(grid, size, r, c, shipLen, horiz)) {
        placeShip(grid, r, c, shipLen, horiz);
        placed = true;
        break;
      }
    }
    if (!placed) return null;
  }
  return grid;
}

function canPlace(grid: boolean[][], size: number, r: number, c: number, len: number, horiz: boolean): boolean {
  for (let i = 0; i < len; i++) {
    const nr = r + (horiz ? 0 : i);
    const nc = c + (horiz ? i : 0);
    if (nr < 0 || nr >= size || nc < 0 || nc >= size) return false;
    // Check cell and all 8 neighbors are empty
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const tr = nr + dr, tc = nc + dc;
        if (tr >= 0 && tr < size && tc >= 0 && tc < size && grid[tr][tc]) return false;
      }
    }
  }
  return true;
}

function placeShip(grid: boolean[][], r: number, c: number, len: number, horiz: boolean): void {
  for (let i = 0; i < len; i++) {
    grid[r + (horiz ? 0 : i)][c + (horiz ? i : 0)] = true;
  }
}

export function generateBattleship(difficulty: KriegDifficulty, seed: number): BattleshipPuzzle {
  const size = GRID_SIZES[difficulty];
  const fleet = [...FLEET[difficulty]].sort((a, b) => b - a); // largest first
  const rng = mulberry32(seed);

  let solution: boolean[][] | null = null;
  for (let attempt = 0; attempt < 50; attempt++) {
    solution = placeShips(size, fleet, rng);
    if (solution) break;
  }
  if (!solution) return generateBattleship(difficulty, seed + 9999);

  const rowClues = Array.from({ length: size }, (_, r) =>
    solution!.reduce((s, row, _r) => _r === r ? s + row.filter(Boolean).length : s, 0)
  ).map((_, r) => solution![r].filter(Boolean).length);

  const colClues = Array.from({ length: size }, (_, c) =>
    solution!.reduce((s, row) => s + (row[c] ? 1 : 0), 0)
  );

  // Give some cells as hints based on difficulty
  const givenShip: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const givenWater: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const hintFraction = difficulty === "leicht" ? 0.3 : difficulty === "mittel" ? 0.15 : difficulty === "schwer" ? 0.08 : 0.04;

  const shipCells: [number, number][] = [];
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (solution[r][c]) shipCells.push([r, c]);
  const hintCount = Math.floor(shipCells.length * hintFraction);
  const hintCells = shuffle([...shipCells], rng).slice(0, hintCount);
  hintCells.forEach(([r, c]) => { givenShip[r][c] = true; });

  // Give some definite water cells (rows/cols with 0 ships)
  for (let r = 0; r < size; r++) {
    if (rowClues[r] === 0) for (let c = 0; c < size; c++) givenWater[r][c] = true;
  }
  for (let c = 0; c < size; c++) {
    if (colClues[c] === 0) for (let r = 0; r < size; r++) givenWater[r][c] = true;
  }

  return { size, solution, rowClues, colClues, givenShip, givenWater };
}

// ── State management ──────────────────────────────────────────────────────────

export function createBattleshipState(puzzle: BattleshipPuzzle): BattleshipState {
  const marks: CellMark[][] = Array.from({ length: puzzle.size }, (_, r) =>
    Array.from({ length: puzzle.size }, (_, c) => {
      if (puzzle.givenShip[r][c]) return "ship";
      if (puzzle.givenWater[r][c]) return "water";
      return "unknown";
    })
  );
  return { puzzle, marks, solved: false };
}

export function toggleBattleshipMark(state: BattleshipState, r: number, c: number): BattleshipState {
  if (state.puzzle.givenShip[r][c] || state.puzzle.givenWater[r][c]) return state;
  const marks = state.marks.map(row => [...row]) as CellMark[][];
  const cur = marks[r][c];
  marks[r][c] = cur === "unknown" ? "ship" : cur === "ship" ? "water" : "unknown";
  const solved = checkBattleshipSolved(marks, state.puzzle);
  return { ...state, marks, solved };
}

export function setShipMark(state: BattleshipState, r: number, c: number, mark: CellMark): BattleshipState {
  if (state.puzzle.givenShip[r][c] || state.puzzle.givenWater[r][c]) return state;
  const marks = state.marks.map(row => [...row]) as CellMark[][];
  marks[r][c] = mark;
  const solved = checkBattleshipSolved(marks, state.puzzle);
  return { ...state, marks, solved };
}

function checkBattleshipSolved(marks: CellMark[][], puzzle: BattleshipPuzzle): boolean {
  const { size, solution } = puzzle;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const isShip = marks[r][c] === "ship";
      if (isShip !== solution[r][c]) return false;
    }
  }
  return true;
}

// Row/col errors
export function computeBattleshipErrors(state: BattleshipState): { rows: boolean[]; cols: boolean[] } {
  const { size, rowClues, colClues } = state.puzzle;
  const rowShipCount = Array.from({ length: size }, (_, r) =>
    state.marks[r].filter(m => m === "ship").length
  );
  const colShipCount = Array.from({ length: size }, (_, c) =>
    state.marks.reduce((s, row) => s + (row[c] === "ship" ? 1 : 0), 0)
  );
  return {
    rows: rowShipCount.map((count, r) => count > rowClues[r]),
    cols: colShipCount.map((count, c) => count > colClues[c]),
  };
}

// Serialization
export function serializeBattleshipState(state: BattleshipState): string {
  return JSON.stringify({ marks: state.marks });
}

export function deserializeBattleshipState(puzzle: BattleshipPuzzle, raw: string): BattleshipState {
  try {
    const data = JSON.parse(raw) as { marks: CellMark[][] };
    const marks = data.marks;
    const solved = checkBattleshipSolved(marks, puzzle);
    return { puzzle, marks, solved };
  } catch {
    return createBattleshipState(puzzle);
  }
}

// Hint: reveal one wrong cell
export function getBattleshipHint(state: BattleshipState): [number, number] | null {
  const { size, solution } = state.puzzle;
  const wrongs: [number, number][] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (state.puzzle.givenShip[r][c] || state.puzzle.givenWater[r][c]) continue;
      const mark = state.marks[r][c];
      const isShip = mark === "ship";
      if (isShip !== solution[r][c]) wrongs.push([r, c]);
    }
  }
  if (wrongs.length === 0) return null;
  return wrongs[Math.floor(Math.random() * wrongs.length)];
}
