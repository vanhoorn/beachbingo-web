import { buildDeck, tilesMatch } from "./MahjongTiles";
import { LAYOUTS, type LayoutId } from "./MahjongLayouts";

// ── Seeded RNG (mulberry32) ───────────────────────────────────────────────────
function mulberry32(seed: number) {
  let s = seed >>> 0;
  return function (): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) >>> 0;
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

// ── Tile instance ─────────────────────────────────────────────────────────────
export interface MahjongTile {
  id: number;       // unique instance id (0..143)
  typeId: string;   // refers to TileType.id
  col: number;      // grid column (even numbers)
  row: number;      // grid row (even numbers)
  layer: number;    // z-layer (0 = bottom)
  removed: boolean;
}

export type MahjongDifficulty = "ROOKIE" | "SNIPER" | "BOSS";

export interface MahjongState {
  layoutId: LayoutId;
  difficulty: MahjongDifficulty;
  seed: number;
  tiles: MahjongTile[];
  selectedId: number | null;
  hintsUsed: number;
  shufflesUsed: number;
  history: number[][]; // pairs of tile ids removed, for undo
  won: boolean;
  gameOver: boolean; // no moves left and no shuffles remaining
}

// ── Board generation ──────────────────────────────────────────────────────────

function makeTiles(positions: [number, number, number][], typeIds: string[]): MahjongTile[] {
  return positions.map(([col, row, layer], i) => ({
    id: i,
    typeId: typeIds[i],
    col, row, layer,
    removed: false,
  }));
}

export function generateBoard(layoutId: LayoutId, seed: number): MahjongTile[] {
  const layout = LAYOUTS[layoutId];
  const rng = mulberry32(seed);
  const positions = layout.positions.slice(0, layout.tileCount);
  const typeIds = buildTypeIds(positions.length, rng);
  // slice(0, typeIds.length) guards against odd tileCount edge-cases
  return makeTiles(positions.slice(0, typeIds.length), typeIds);
}

function buildTypeIds(count: number, rng: () => number): string[] {
  // Build exactly `count` tile type IDs in matched pairs
  const fullDeck = buildDeck(); // 144 shuffled slots
  // Ensure even count
  const n = count % 2 === 0 ? count : count - 1;
  const deckShuffled = shuffle(fullDeck, rng);
  const result: string[] = [];
  // Strategy: take from shuffled deck in pairs
  for (let i = 0; i < deckShuffled.length && result.length < n; i += 2) {
    if (i + 1 < deckShuffled.length) {
      result.push(deckShuffled[i], deckShuffled[i + 1]);
    }
  }
  // Pad if needed (shouldn't happen with 144 tile deck >= 120 min count)
  while (result.length < n) {
    result.push(result[result.length - 2], result[result.length - 1]);
  }
  return shuffle(result.slice(0, n), rng);
}

// ── Free tile check ───────────────────────────────────────────────────────────

function isBlocked(tile: MahjongTile, tiles: MahjongTile[]): boolean {
  if (tile.removed) return true;
  const active = tiles.filter((t) => !t.removed && t.id !== tile.id);

  // Covered from above: any tile with layer = tile.layer+1 overlapping
  const coveredAbove = active.some(
    (t) =>
      t.layer === tile.layer + 1 &&
      t.col >= tile.col - 1 && t.col <= tile.col + 1 &&
      t.row >= tile.row - 1 && t.row <= tile.row + 1,
  );
  if (coveredAbove) return true;

  // Blocked on left: any tile at same layer with col = tile.col-2, row overlapping
  const blockedLeft = active.some(
    (t) =>
      t.layer === tile.layer &&
      t.col === tile.col - 2 &&
      Math.abs(t.row - tile.row) < 2,
  );
  // Blocked on right
  const blockedRight = active.some(
    (t) =>
      t.layer === tile.layer &&
      t.col === tile.col + 2 &&
      Math.abs(t.row - tile.row) < 2,
  );
  // Free if at least one side is clear
  return blockedLeft && blockedRight;
}

export function isFree(tile: MahjongTile, tiles: MahjongTile[]): boolean {
  return !isBlocked(tile, tiles);
}

// ── Find all matching free pairs ──────────────────────────────────────────────
export function findFreePairs(tiles: MahjongTile[]): [MahjongTile, MahjongTile][] {
  const free = tiles.filter((t) => !t.removed && isFree(t, tiles));
  const pairs: [MahjongTile, MahjongTile][] = [];
  for (let i = 0; i < free.length; i++) {
    for (let j = i + 1; j < free.length; j++) {
      if (tilesMatch(free[i].typeId, free[j].typeId)) {
        pairs.push([free[i], free[j]]);
      }
    }
  }
  return pairs;
}

export function hasAnyMoves(tiles: MahjongTile[]): boolean {
  return findFreePairs(tiles).length > 0;
}

// ── Hint: returns first available pair ───────────────────────────────────────
export function getHint(tiles: MahjongTile[]): [MahjongTile, MahjongTile] | null {
  const pairs = findFreePairs(tiles);
  return pairs.length > 0 ? pairs[0] : null;
}

// ── Shuffle remaining tiles ───────────────────────────────────────────────────
export function shuffleTiles(tiles: MahjongTile[], seed: number): MahjongTile[] {
  const rng = mulberry32(seed + Date.now());
  const active = tiles.filter((t) => !t.removed);
  const typeIds = shuffle(active.map((t) => t.typeId), rng);
  return tiles.map((t) => {
    if (t.removed) return t;
    const idx = active.findIndex((a) => a.id === t.id);
    return { ...t, typeId: typeIds[idx] };
  });
}

// ── Remove a pair ─────────────────────────────────────────────────────────────
export function removePair(
  state: MahjongState,
  idA: number,
  idB: number,
): MahjongState {
  const tiles = state.tiles.map((t) =>
    t.id === idA || t.id === idB ? { ...t, removed: true } : t,
  );
  const remaining = tiles.filter((t) => !t.removed).length;
  return {
    ...state,
    tiles,
    selectedId: null,
    history: [...state.history, [idA, idB]],
    won: remaining === 0,
    gameOver: remaining > 0 && !hasAnyMoves(tiles),
  };
}

// ── Undo last pair ────────────────────────────────────────────────────────────
export function undoLast(state: MahjongState): MahjongState {
  if (state.history.length === 0) return state;
  const history = [...state.history];
  const last = history.pop()!;
  const tiles = state.tiles.map((t) =>
    last.includes(t.id) ? { ...t, removed: false } : t,
  );
  return { ...state, tiles, history, selectedId: null, won: false, gameOver: false };
}

// ── Click handler ─────────────────────────────────────────────────────────────
export function handleTileClick(
  state: MahjongState,
  tileId: number,
): MahjongState {
  const tile = state.tiles.find((t) => t.id === tileId);
  if (!tile || tile.removed || !isFree(tile, state.tiles)) return state;

  if (state.selectedId === null) {
    return { ...state, selectedId: tileId };
  }
  if (state.selectedId === tileId) {
    return { ...state, selectedId: null };
  }

  const selected = state.tiles.find((t) => t.id === state.selectedId)!;
  if (tilesMatch(selected.typeId, tile.typeId)) {
    return removePair(state, state.selectedId, tileId);
  }
  // No match: switch selection to newly clicked tile
  return { ...state, selectedId: tileId };
}

// ── Create initial state ──────────────────────────────────────────────────────
export function createMahjongState(
  layoutId: LayoutId,
  difficulty: MahjongDifficulty,
  seed: number,
): MahjongState {
  return {
    layoutId,
    difficulty,
    seed,
    tiles: generateBoard(layoutId, seed),
    selectedId: null,
    hintsUsed: 0,
    shufflesUsed: 0,
    history: [],
    won: false,
    gameOver: false,
  };
}

// ── Serialization (for save/load) ─────────────────────────────────────────────
export interface MahjongSaveState {
  layoutId: LayoutId;
  difficulty: MahjongDifficulty;
  seed: number;
  removedIds: number[];
  typeIds: string[]; // current typeId for each tile (may differ after shuffle)
  hintsUsed: number;
  shufflesUsed: number;
  historyLength: number;
}

export function serializeMahjong(state: MahjongState): string {
  const save: MahjongSaveState = {
    layoutId: state.layoutId,
    difficulty: state.difficulty,
    seed: state.seed,
    removedIds: state.tiles.filter((t) => t.removed).map((t) => t.id),
    typeIds: state.tiles.map((t) => t.typeId),
    hintsUsed: state.hintsUsed,
    shufflesUsed: state.shufflesUsed,
    historyLength: state.history.length,
  };
  return JSON.stringify(save);
}

export function deserializeMahjong(raw: string): MahjongState {
  const save: MahjongSaveState = JSON.parse(raw);
  const baseTiles = generateBoard(save.layoutId, save.seed);
  const tiles = baseTiles.map((t, i) => ({
    ...t,
    typeId: save.typeIds[i] ?? t.typeId,
    removed: save.removedIds.includes(t.id),
  }));
  return {
    layoutId: save.layoutId,
    difficulty: save.difficulty,
    seed: save.seed,
    tiles,
    selectedId: null,
    hintsUsed: save.hintsUsed,
    shufflesUsed: save.shufflesUsed,
    history: [],
    won: false,
    gameOver: !hasAnyMoves(tiles),
  };
}

// ── Difficulty limits ─────────────────────────────────────────────────────────
export const HINT_LIMIT: Record<MahjongDifficulty, number> = {
  ROOKIE: Infinity,
  SNIPER: 3,
  BOSS:   0,
};
export const SHUFFLE_LIMIT: Record<MahjongDifficulty, number> = {
  ROOKIE: Infinity,
  SNIPER: 1,
  BOSS:   0,
};
export const SHOW_FREE_HIGHLIGHT: Record<MahjongDifficulty, boolean> = {
  ROOKIE: true,
  SNIPER: false,
  BOSS:   false,
};
