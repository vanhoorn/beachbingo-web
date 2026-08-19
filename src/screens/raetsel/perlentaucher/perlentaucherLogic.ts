// ── Seeded RNG ─────────────────────────────────────────────────────────────────
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Types ──────────────────────────────────────────────────────────────────────

export type PieceType = 'PERLE' | 'SEEGLAS' | 'MUSCHEL' | 'SEESTERN' | 'KORALLE' | 'SEETANG';
export type SpecialType = 'NONE' | 'GESTREIFT_H' | 'GESTREIFT_V' | 'EINGEPACKT' | 'PERLENKETTE';
export type BoardPhase = 'IDLE' | 'SWAPPING' | 'MATCHING' | 'FALLING' | 'FILLING' | 'CHECK_DEADLOCK' | 'SHUFFLE';
export type ComboType = 'CROSS' | 'TRIPLE_SWEEP' | 'AREA_BLAST';

export interface PerlentaucherPiece {
  type: PieceType;
  special: SpecialType;
}

export interface Match {
  cells: [number, number][];
  pieceType: PieceType;
  isHorizontal: boolean;
}

export interface MatchResult {
  matches: Match[];
  clearedCells: Set<string>;
  pointsGained: number;
  specialGenCells: Array<{ pos: [number, number]; special: SpecialType }>;
}

export interface SpecialActivation {
  clearedCells: Set<string>;
  points: number;
}

export interface LevelConfig {
  level: number;
  seed: number;
  movesLeft: number;
  targetScore: number;
}

// ── Constants ──────────────────────────────────────────────────────────────────

export const BOARD_SIZE = 8;

const PIECE_TYPES: PieceType[] = ['PERLE', 'SEEGLAS', 'MUSCHEL', 'SEESTERN', 'KORALLE', 'SEETANG'];
const SPECIAL_TYPES: SpecialType[] = ['NONE', 'GESTREIFT_H', 'GESTREIFT_V', 'EINGEPACKT', 'PERLENKETTE'];

export const PIECE_COLORS: Record<PieceType, string> = {
  PERLE:    '#F5EFE0',
  SEEGLAS:  '#0EA5E9',
  MUSCHEL:  '#F97316',
  SEESTERN: '#F59E0B',
  KORALLE:  '#7C3AED',
  SEETANG:  '#22C55E',
};

export const PIECE_NAMES: Record<PieceType, string> = {
  PERLE:    'Perle',
  SEEGLAS:  'Seeglas',
  MUSCHEL:  'Muschel',
  SEESTERN: 'Seestern',
  KORALLE:  'Koralle',
  SEETANG:  'Seetang',
};

// ── Cell key helpers ───────────────────────────────────────────────────────────

export function cellKey(r: number, c: number): string { return `${r}-${c}`; }
export function parseKey(key: string): [number, number] {
  const [r, c] = key.split('-').map(Number);
  return [r, c];
}

// ── Serialization ──────────────────────────────────────────────────────────────

export function pieceToInt(p: PerlentaucherPiece): number {
  return PIECE_TYPES.indexOf(p.type) * 10 + SPECIAL_TYPES.indexOf(p.special);
}

export function intToPiece(v: number): PerlentaucherPiece {
  return { type: PIECE_TYPES[Math.floor(v / 10)], special: SPECIAL_TYPES[v % 10] };
}

// ── Special logic (port of PerlentaucherSpecials.kt) ──────────────────────────

export function activateSpecial(
  board: (PerlentaucherPiece | null)[][],
  r: number, c: number,
  matchedType: PieceType | null,
): SpecialActivation {
  const piece = board[r][c];
  if (!piece) return { clearedCells: new Set(), points: 0 };
  const cleared = new Set<string>();

  switch (piece.special) {
    case 'GESTREIFT_H':
      for (let col = 0; col < BOARD_SIZE; col++) {
        if (board[r][col]) cleared.add(cellKey(r, col));
      }
      return { clearedCells: cleared, points: 200 };
    case 'GESTREIFT_V':
      for (let row = 0; row < BOARD_SIZE; row++) {
        if (board[row][c]) cleared.add(cellKey(row, c));
      }
      return { clearedCells: cleared, points: 200 };
    case 'EINGEPACKT':
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc])
            cleared.add(cellKey(nr, nc));
        }
      }
      return { clearedCells: cleared, points: 300 };
    case 'PERLENKETTE': {
      const targetType = matchedType ?? piece.type;
      for (let row = 0; row < BOARD_SIZE; row++)
        for (let col = 0; col < BOARD_SIZE; col++)
          if (board[row][col]?.type === targetType) cleared.add(cellKey(row, col));
      return { clearedCells: cleared, points: 500 };
    }
    default:
      return { clearedCells: new Set(), points: 0 };
  }
}

export function detectCombo(s1: SpecialType, s2: SpecialType): ComboType | null {
  if (s1 === 'NONE' || s2 === 'NONE') return null;
  const both = new Set([s1, s2]);
  if (both.has('GESTREIFT_H') && both.has('GESTREIFT_V')) return 'CROSS';
  if (both.has('EINGEPACKT') && (both.has('GESTREIFT_H') || both.has('GESTREIFT_V'))) return 'TRIPLE_SWEEP';
  if (s1 === 'EINGEPACKT' && s2 === 'EINGEPACKT') return 'AREA_BLAST';
  return null;
}

export function activateCombo(
  board: (PerlentaucherPiece | null)[][],
  r1: number, c1: number,
  r2: number, c2: number,
  combo: ComboType,
): SpecialActivation {
  const cleared = new Set<string>();
  switch (combo) {
    case 'CROSS':
      for (let i = 0; i < BOARD_SIZE; i++) {
        if (board[r1][i]) cleared.add(cellKey(r1, i));
        if (board[i][c1]) cleared.add(cellKey(i, c1));
      }
      return { clearedCells: cleared, points: 400 };
    case 'TRIPLE_SWEEP': {
      const p1Special = board[r1][c1]?.special ?? 'NONE';
      const isP1Gestreift = p1Special === 'GESTREIFT_H' || p1Special === 'GESTREIFT_V';
      const gr = isP1Gestreift ? r1 : r2;
      const gc = isP1Gestreift ? c1 : c2;
      const gSpecial = isP1Gestreift ? p1Special : (board[r2][c2]?.special ?? 'NONE');
      if (gSpecial === 'GESTREIFT_H') {
        for (let dr = -1; dr <= 1; dr++) {
          const nr = gr + dr;
          if (nr >= 0 && nr < BOARD_SIZE)
            for (let col = 0; col < BOARD_SIZE; col++)
              if (board[nr][col]) cleared.add(cellKey(nr, col));
        }
      } else {
        for (let dc = -1; dc <= 1; dc++) {
          const nc = gc + dc;
          if (nc >= 0 && nc < BOARD_SIZE)
            for (let row = 0; row < BOARD_SIZE; row++)
              if (board[row][nc]) cleared.add(cellKey(row, nc));
        }
      }
      return { clearedCells: cleared, points: 600 };
    }
    case 'AREA_BLAST':
      for (let dr = -2; dr <= 2; dr++)
        for (let dc = -2; dc <= 2; dc++) {
          const nr = r1 + dr, nc = c1 + dc;
          if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc])
            cleared.add(cellKey(nr, nc));
        }
      return { clearedCells: cleared, points: 800 };
  }
}

// ── Board Model (port of PerlentaucherBoardModel.kt) ──────────────────────────

export class PerlentaucherBoardModel {
  board: (PerlentaucherPiece | null)[][];
  phase: BoardPhase = 'IDLE';
  private rng: () => number;
  private cascadeLevel = 0;

  constructor(seed: number) {
    this.rng = mulberry32(seed);
    this.board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
    this.initBoard();
  }

  private randomPiece(): PerlentaucherPiece {
    return { type: PIECE_TYPES[Math.floor(this.rng() * PIECE_TYPES.length)], special: 'NONE' };
  }

  private initBoard() {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        let piece = this.randomPiece();
        while (c >= 2 && this.board[r][c-1]?.type === piece.type && this.board[r][c-2]?.type === piece.type)
          piece = this.randomPiece();
        while (r >= 2 && this.board[r-1][c]?.type === piece.type && this.board[r-2][c]?.type === piece.type)
          piece = this.randomPiece();
        this.board[r][c] = piece;
      }
    }
  }

  loadFromIntArray(arr: number[]) {
    arr.forEach((v, i) => {
      this.board[Math.floor(i / BOARD_SIZE)][i % BOARD_SIZE] = v === -1 ? null : intToPiece(v);
    });
  }

  boardToIntArray(): number[] {
    const arr: number[] = [];
    for (let r = 0; r < BOARD_SIZE; r++)
      for (let c = 0; c < BOARD_SIZE; c++)
        arr.push(this.board[r][c] ? pieceToInt(this.board[r][c]!) : -1);
    return arr;
  }

  // ── Swap ────────────────────────────────────────────────────────────────────

  trySwap(r1: number, c1: number, r2: number, c2: number): MatchResult | null {
    if (this.phase !== 'IDLE') return null;
    if (Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1) return null;

    const comboResult = this.tryComboSwap(r1, c1, r2, c2);
    if (comboResult) return comboResult;

    const tmp = this.board[r1][c1];
    this.board[r1][c1] = this.board[r2][c2];
    this.board[r2][c2] = tmp;

    if (this.findMatches().length === 0) {
      this.board[r2][c2] = this.board[r1][c1];
      this.board[r1][c1] = tmp;
      return null;
    }

    this.phase = 'MATCHING';
    return this.applyMatches();
  }

  private tryComboSwap(r1: number, c1: number, r2: number, c2: number): MatchResult | null {
    const s1 = this.board[r1][c1]?.special ?? 'NONE';
    const s2 = this.board[r2][c2]?.special ?? 'NONE';
    const combo = detectCombo(s1, s2);
    if (!combo) return null;

    const tmp = this.board[r1][c1];
    this.board[r1][c1] = this.board[r2][c2];
    this.board[r2][c2] = tmp;

    const activation = activateCombo(this.board, r1, c1, r2, c2, combo);
    const comboKeys = new Set([cellKey(r1, c1), cellKey(r2, c2)]);

    const { allCleared, totalPts } = this.chainActivateSpecials(
      activation.clearedCells, comboKeys, new Set(), activation.points
    );

    const finalCleared = new Set([...allCleared, ...comboKeys]);
    finalCleared.forEach(key => {
      const [r, c] = parseKey(key);
      this.board[r][c] = null;
    });

    this.phase = 'FALLING';
    this.cascadeLevel = 0;
    return { matches: [], clearedCells: finalCleared, pointsGained: totalPts, specialGenCells: [] };
  }

  // ── Match detection ──────────────────────────────────────────────────────────

  findMatches(): Match[] {
    const matches: Match[] = [];

    for (let r = 0; r < BOARD_SIZE; r++) {
      let c = 0;
      while (c < BOARD_SIZE) {
        const type = this.board[r][c]?.type;
        if (!type) { c++; continue; }
        let len = 1;
        while (c + len < BOARD_SIZE && this.board[r][c + len]?.type === type) len++;
        if (len >= 3) {
          matches.push({
            cells: Array.from({ length: len }, (_, i): [number, number] => [r, c + i]),
            pieceType: type, isHorizontal: true,
          });
        }
        c += len;
      }
    }

    for (let c = 0; c < BOARD_SIZE; c++) {
      let r = 0;
      while (r < BOARD_SIZE) {
        const type = this.board[r][c]?.type;
        if (!type) { r++; continue; }
        let len = 1;
        while (r + len < BOARD_SIZE && this.board[r + len][c]?.type === type) len++;
        if (len >= 3) {
          matches.push({
            cells: Array.from({ length: len }, (_, i): [number, number] => [r + i, c]),
            pieceType: type, isHorizontal: false,
          });
        }
        r += len;
      }
    }

    return matches;
  }

  applyMatches(): MatchResult {
    const matches = this.findMatches();
    if (matches.length === 0) {
      this.cascadeLevel = 0;
      this.phase = 'CHECK_DEADLOCK';
      return { matches: [], clearedCells: new Set(), pointsGained: 0, specialGenCells: [] };
    }

    const multiplier = Math.pow(1.5, this.cascadeLevel);

    let matchPts = 0;
    const initialCells = new Set<string>();
    matches.forEach(m => {
      const ppp = m.cells.length >= 5 ? 120 : m.cells.length === 4 ? 90 : 60;
      matchPts += Math.round(m.cells.length * ppp * multiplier);
      m.cells.forEach(([r, c]) => initialCells.add(cellKey(r, c)));
    });

    const matchTypeFor = new Map<string, PieceType>();
    matches.forEach(m => m.cells.forEach(([r, c]) => matchTypeFor.set(cellKey(r, c), m.pieceType)));

    const initialSpecialQueue = new Set<string>();
    initialCells.forEach(key => {
      const [r, c] = parseKey(key);
      if (this.board[r][c]?.special !== 'NONE') initialSpecialQueue.add(key);
    });

    const { allCleared, totalPts: specialPts } = this.chainActivateSpecials(
      initialCells, new Set(), initialSpecialQueue, 0, matchTypeFor
    );

    const hCells = new Set<string>();
    const vCells = new Set<string>();
    matches.forEach(m => {
      if (m.isHorizontal) m.cells.forEach(([r, c]) => hCells.add(cellKey(r, c)));
      else m.cells.forEach(([r, c]) => vCells.add(cellKey(r, c)));
    });
    const intersections = new Set([...hCells].filter(k => vCells.has(k)));
    const specialGens = this.buildSpecialGens(matches, intersections);

    allCleared.forEach(key => {
      const [r, c] = parseKey(key);
      this.board[r][c] = null;
    });

    this.phase = 'FALLING';
    this.cascadeLevel++;

    return { matches, clearedCells: allCleared, pointsGained: matchPts + specialPts, specialGenCells: specialGens };
  }

  private chainActivateSpecials(
    startCells: Set<string>,
    skipCells: Set<string>,
    initialSpecialQueue: Set<string>,
    extraPts: number,
    matchTypeFor?: Map<string, PieceType>,
  ): { allCleared: Set<string>; totalPts: number } {
    const allCleared = new Set(startCells);
    let pts = extraPts;
    const queue: Array<{ key: string; matchedType: PieceType | null }> = [];
    const activated = new Set(skipCells);

    if (initialSpecialQueue.size > 0) {
      initialSpecialQueue.forEach(key => {
        const [r, c] = parseKey(key);
        const piece = this.board[r][c];
        if (piece && piece.special !== 'NONE')
          queue.push({ key, matchedType: matchTypeFor?.get(key) ?? null });
      });
    } else {
      startCells.forEach(key => {
        if (skipCells.has(key)) return;
        const [r, c] = parseKey(key);
        const piece = this.board[r][c];
        if (piece && piece.special !== 'NONE')
          queue.push({ key, matchedType: matchTypeFor?.get(key) ?? null });
      });
    }

    while (queue.length > 0) {
      const { key, matchedType } = queue.shift()!;
      if (activated.has(key)) continue;
      activated.add(key);
      const [r, c] = parseKey(key);
      const piece = this.board[r][c];
      if (!piece || piece.special === 'NONE') continue;

      const activation = activateSpecial(this.board, r, c, matchedType);
      pts += activation.points;

      activation.clearedCells.forEach(cellK => {
        if (!allCleared.has(cellK)) {
          allCleared.add(cellK);
          const [nr, nc] = parseKey(cellK);
          const newPiece = this.board[nr][nc];
          if (newPiece && newPiece.special !== 'NONE')
            queue.push({ key: cellK, matchedType: newPiece.type });
        }
      });
    }

    return { allCleared, totalPts: pts };
  }

  private buildSpecialGens(
    matches: Match[],
    intersections: Set<string>,
  ): Array<{ pos: [number, number]; special: SpecialType }> {
    const result: Array<{ pos: [number, number]; special: SpecialType }> = [];
    matches.forEach(m => {
      const isLT = m.cells.some(([r, c]) => intersections.has(cellKey(r, c)));
      if (m.cells.length >= 5 && !isLT)
        result.push({ pos: m.cells[Math.floor(m.cells.length / 2)], special: 'PERLENKETTE' });
      else if (m.cells.length === 4 && !isLT)
        result.push({ pos: m.cells[1], special: m.isHorizontal ? 'GESTREIFT_H' : 'GESTREIFT_V' });
    });
    intersections.forEach(key => {
      const [r, c] = parseKey(key);
      result.push({ pos: [r, c], special: 'EINGEPACKT' });
    });
    return result;
  }

  placeSpecial(r: number, c: number, type: PieceType, special: SpecialType) {
    this.board[r][c] = { type, special };
  }

  // ── Gravity ──────────────────────────────────────────────────────────────────

  applyGravity(): boolean {
    let changed = false;
    for (let c = 0; c < BOARD_SIZE; c++) {
      let writeRow = BOARD_SIZE - 1;
      for (let r = BOARD_SIZE - 1; r >= 0; r--) {
        const piece = this.board[r][c];
        if (piece !== null) {
          if (r !== writeRow) {
            this.board[writeRow][c] = piece;
            this.board[r][c] = null;
            changed = true;
          }
          writeRow--;
        }
      }
    }
    if (!changed) this.phase = 'FILLING';
    return changed;
  }

  fillBoard(): boolean {
    let filled = false;
    for (let r = 0; r < BOARD_SIZE; r++)
      for (let c = 0; c < BOARD_SIZE; c++)
        if (this.board[r][c] === null) {
          this.board[r][c] = this.randomPiece();
          filled = true;
        }
    this.phase = 'MATCHING';
    return filled;
  }

  // ── Deadlock ─────────────────────────────────────────────────────────────────

  hasValidMove(): boolean {
    for (let r = 0; r < BOARD_SIZE; r++)
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (c + 1 < BOARD_SIZE && this.wouldCreateMatch(r, c, r, c + 1)) return true;
        if (r + 1 < BOARD_SIZE && this.wouldCreateMatch(r, c, r + 1, c)) return true;
      }
    return false;
  }

  private wouldCreateMatch(r1: number, c1: number, r2: number, c2: number): boolean {
    const tmp = this.board[r1][c1];
    this.board[r1][c1] = this.board[r2][c2];
    this.board[r2][c2] = tmp;
    const result = this.findMatches().length > 0;
    this.board[r2][c2] = this.board[r1][c1];
    this.board[r1][c1] = tmp;
    return result;
  }

  checkDeadlock() {
    this.phase = this.hasValidMove() ? 'IDLE' : 'SHUFFLE';
  }

  shuffle() {
    const pieces: PerlentaucherPiece[] = [];
    for (let r = 0; r < BOARD_SIZE; r++)
      for (let c = 0; c < BOARD_SIZE; c++) {
        const p = this.board[r][c];
        if (p) pieces.push(p);
      }
    for (let i = pieces.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
    }
    let idx = 0;
    for (let r = 0; r < BOARD_SIZE; r++)
      for (let c = 0; c < BOARD_SIZE; c++)
        this.board[r][c] = idx < pieces.length ? pieces[idx++] : this.randomPiece();
    this.phase = 'CHECK_DEADLOCK';
  }
}

// ── Level Generator (port of PerlentaucherLevelGenerator.kt) ──────────────────

function baseSeedForLevel(level: number): number { return level * 7919 + 12345; }

function movesForLevel(level: number): number {
  if (level <= 20) return 35;
  if (level <= 40) return 30;
  if (level <= 60) return 25;
  if (level <= 100) return 20;
  return 18;
}

function scoreTargetForLevel(level: number): number {
  return level >= 60 ? 12500 : 600 + (level - 1) * 200;
}

export function generateLevel(level: number): LevelConfig {
  const movesLeft = movesForLevel(level);
  const targetScore = scoreTargetForLevel(level);

  let seed = baseSeedForLevel(level);
  for (let attempt = 0; attempt < 10; attempt++) {
    const model = new PerlentaucherBoardModel(seed);
    if (model.hasValidMove()) return { level, seed, movesLeft, targetScore };
    seed = baseSeedForLevel(level) + (attempt + 1) * 31337;
  }
  return { level, seed, movesLeft, targetScore };
}
