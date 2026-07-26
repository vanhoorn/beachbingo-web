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
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export type HashiDifficulty = "leicht" | "mittel" | "schwer" | "experte";

export interface Island {
  id: number;
  row: number;
  col: number;
  value: number; // number of bridges that must connect
}

export interface Bridge {
  from: number; // island id
  to: number;   // island id
  count: number; // 1 or 2
  // direction derived from island positions
}

export interface HashiPuzzle {
  gridSize: number;
  islands: Island[];
  solution: Bridge[]; // bridges in the complete solution
}

export interface HashiState {
  puzzle: HashiPuzzle;
  bridges: Bridge[];
  solved: boolean;
}

export const HASHI_GRID_SIZES: Record<HashiDifficulty, number> = {
  leicht: 7,
  mittel: 9,
  schwer: 11,
  experte: 13,
};

export const HASHI_ISLAND_COUNTS: Record<HashiDifficulty, number> = {
  leicht: 8,
  mittel: 14,
  schwer: 20,
  experte: 28,
};

// Check if a potential bridge between two islands crosses an existing bridge or island
function crossesExisting(
  r1: number, c1: number, r2: number, c2: number,
  islands: Island[], bridges: Bridge[]
): boolean {
  const islandMap = new Map<string, Island>();
  islands.forEach(i => islandMap.set(`${i.row},${i.col}`, i));

  if (r1 === r2) {
    // Horizontal bridge
    const minC = Math.min(c1, c2), maxC = Math.max(c1, c2);
    // Check for islands in between
    for (let c = minC + 1; c < maxC; c++) {
      if (islandMap.has(`${r1},${c}`)) return true;
    }
    // Check for crossing vertical bridges
    for (const b of bridges) {
      const ia = islands.find(i => i.id === b.from)!;
      const ib = islands.find(i => i.id === b.to)!;
      if (ia.col === ib.col) {
        // vertical bridge
        const bridgeCol = ia.col;
        if (bridgeCol > minC && bridgeCol < maxC) {
          const minR = Math.min(ia.row, ib.row), maxR = Math.max(ia.row, ib.row);
          if (minR < r1 && r1 < maxR) return true;
        }
      }
    }
  } else {
    // Vertical bridge
    const minR = Math.min(r1, r2), maxR = Math.max(r1, r2);
    for (let r = minR + 1; r < maxR; r++) {
      if (islandMap.has(`${r},${c1}`)) return true;
    }
    for (const b of bridges) {
      const ia = islands.find(i => i.id === b.from)!;
      const ib = islands.find(i => i.id === b.to)!;
      if (ia.row === ib.row) {
        const bridgeRow = ia.row;
        if (bridgeRow > minR && bridgeRow < maxR) {
          const minC = Math.min(ia.col, ib.col), maxC = Math.max(ia.col, ib.col);
          if (minC < c1 && c1 < maxC) return true;
        }
      }
    }
  }
  return false;
}

// Check if all islands are connected (via bridges, ignoring counts)
function isFullyConnected(islands: Island[], bridges: Bridge[]): boolean {
  if (islands.length === 0) return true;
  const adj = new Map<number, Set<number>>();
  islands.forEach(i => adj.set(i.id, new Set()));
  bridges.forEach(b => {
    if (b.count > 0) {
      adj.get(b.from)!.add(b.to);
      adj.get(b.to)!.add(b.from);
    }
  });
  const visited = new Set<number>();
  const queue = [islands[0].id];
  visited.add(islands[0].id);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const nb of adj.get(cur)!) {
      if (!visited.has(nb)) {
        visited.add(nb);
        queue.push(nb);
      }
    }
  }
  return visited.size === islands.length;
}

// Place islands on grid and build a valid solution
export function generateHashi(difficulty: HashiDifficulty, seed: number): HashiPuzzle {
  const gridSize = HASHI_GRID_SIZES[difficulty];
  const targetIslands = HASHI_ISLAND_COUNTS[difficulty];
  const rng = mulberry32(seed);

  for (let attempt = 0; attempt < 30; attempt++) {
    const result = tryGenerate(gridSize, targetIslands, rng);
    if (result) return result;
  }
  // Fallback with different seed
  return generateHashi(difficulty, seed + 99999);
}

function tryGenerate(gridSize: number, targetIslands: number, rng: () => number): HashiPuzzle | null {
  const islands: Island[] = [];
  const solutionBridges: Bridge[] = [];
  let nextId = 0;

  // Place first island
  const r0 = 1 + Math.floor(rng() * (gridSize - 2));
  const c0 = 1 + Math.floor(rng() * (gridSize - 2));
  islands.push({ id: nextId++, row: r0, col: c0, value: 0 });

  // Grow the graph by extending bridges from existing islands
  let attempts = 0;
  while (islands.length < targetIslands && attempts < 2000) {
    attempts++;
    const srcIsland = islands[Math.floor(rng() * islands.length)];
    const bridgeCount = rng() < 0.4 ? 2 : 1;

    // Try a random direction
    const dirs: [number, number][] = shuffle([[-1, 0], [1, 0], [0, -1], [0, 1]], rng);
    for (const [dr, dc] of dirs) {
      // Place new island at distance 2-5 cells away
      const dist = 2 + Math.floor(rng() * 4);
      const nr = srcIsland.row + dr * dist;
      const nc = srcIsland.col + dc * dist;

      if (nr < 1 || nr >= gridSize - 1 || nc < 1 || nc >= gridSize - 1) continue;

      // Check no island already there
      if (islands.some(i => i.row === nr && i.col === nc)) continue;

      // Check the bridge wouldn't cross anything
      if (crossesExisting(srcIsland.row, srcIsland.col, nr, nc, islands, solutionBridges)) continue;

      // Add island and bridge
      const newIsland: Island = { id: nextId++, row: nr, col: nc, value: 0 };
      islands.push(newIsland);
      solutionBridges.push({ from: srcIsland.id, to: newIsland.id, count: bridgeCount });
      break;
    }
  }

  if (islands.length < 4) return null;

  // Calculate island values from solution bridges
  islands.forEach(island => {
    island.value = solutionBridges.reduce((sum, b) => {
      if (b.from === island.id || b.to === island.id) return sum + b.count;
      return sum;
    }, 0);
  });

  // Cap values at 8 (Hashiwokakero max)
  if (islands.some(i => i.value > 8)) return null;

  // Check connectivity
  if (!isFullyConnected(islands, solutionBridges)) return null;

  return { gridSize, islands, solution: solutionBridges };
}

// ── State management ──────────────────────────────────────────────────────────

export function createHashiState(puzzle: HashiPuzzle): HashiState {
  return { puzzle, bridges: [], solved: false };
}

// Find existing bridge between two islands
function findBridge(bridges: Bridge[], id1: number, id2: number): Bridge | undefined {
  return bridges.find(b =>
    (b.from === id1 && b.to === id2) || (b.from === id2 && b.to === id1)
  );
}

// Toggle bridge between two islands (0→1→2→0)
export function toggleBridge(state: HashiState, id1: number, id2: number): HashiState {
  const { puzzle, bridges } = state;

  // Find islands
  const ia = puzzle.islands.find(i => i.id === id1)!;
  const ib = puzzle.islands.find(i => i.id === id2)!;

  // They must be in same row or column
  if (ia.row !== ib.row && ia.col !== ib.col) return state;

  const existing = findBridge(bridges, id1, id2);
  const currentCount = existing?.count ?? 0;
  const newCount = (currentCount + 1) % 3; // 0→1→2→0

  let newBridges: Bridge[];
  if (newCount === 0) {
    newBridges = bridges.filter(b => !(
      (b.from === id1 && b.to === id2) || (b.from === id2 && b.to === id1)
    ));
  } else {
    // Check crossing for new bridge (only if adding first bridge)
    if (currentCount === 0) {
      const others = bridges.filter(b => !(
        (b.from === id1 && b.to === id2) || (b.from === id2 && b.to === id1)
      ));
      if (crossesExisting(ia.row, ia.col, ib.row, ib.col, puzzle.islands, others)) {
        return state; // Can't add bridge here
      }
    }
    if (existing) {
      newBridges = bridges.map(b =>
        ((b.from === id1 && b.to === id2) || (b.from === id2 && b.to === id1))
          ? { ...b, count: newCount }
          : b
      );
    } else {
      newBridges = [...bridges, { from: id1, to: id2, count: newCount }];
    }
  }

  const solved = checkHashiSolved(newBridges, puzzle);
  return { ...state, bridges: newBridges, solved };
}

function checkHashiSolved(bridges: Bridge[], puzzle: HashiPuzzle): boolean {
  // Each island must have the correct total bridge count
  for (const island of puzzle.islands) {
    const total = bridges.reduce((sum, b) => {
      if (b.from === island.id || b.to === island.id) return sum + b.count;
      return sum;
    }, 0);
    if (total !== island.value) return false;
  }
  // All islands must be connected
  return isFullyConnected(puzzle.islands, bridges);
}

// Find all islands reachable from a given island in the same row/col (for tap target)
export function getNeighborIslands(puzzle: HashiPuzzle, islandId: number): number[] {
  const island = puzzle.islands.find(i => i.id === islandId)!;
  const neighbors: number[] = [];

  for (const other of puzzle.islands) {
    if (other.id === islandId) continue;
    if (other.row !== island.row && other.col !== island.col) continue;

    // Check direct line-of-sight (no island in between)
    const hasIslandBetween = puzzle.islands.some(mid => {
      if (mid.id === islandId || mid.id === other.id) return false;
      if (island.row === other.row && mid.row === island.row) {
        const minC = Math.min(island.col, other.col);
        const maxC = Math.max(island.col, other.col);
        return mid.col > minC && mid.col < maxC;
      }
      if (island.col === other.col && mid.col === island.col) {
        const minR = Math.min(island.row, other.row);
        const maxR = Math.max(island.row, other.row);
        return mid.row > minR && mid.row < maxR;
      }
      return false;
    });

    if (!hasIslandBetween) neighbors.push(other.id);
  }
  return neighbors;
}

// Serialization
export function serializeHashiState(state: HashiState): string {
  return JSON.stringify({ bridges: state.bridges });
}

export function deserializeHashiState(puzzle: HashiPuzzle, raw: string): HashiState {
  try {
    const data = JSON.parse(raw) as { bridges: Bridge[] };
    const bridges = data.bridges;
    const solved = checkHashiSolved(bridges, puzzle);
    return { puzzle, bridges, solved };
  } catch {
    return createHashiState(puzzle);
  }
}

// Hint: add one correct bridge
export function getHashiHint(state: HashiState): { from: number; to: number } | null {
  const { puzzle, bridges } = state;
  for (const sb of puzzle.solution) {
    const current = findBridge(bridges, sb.from, sb.to);
    if (!current || current.count < sb.count) {
      return { from: sb.from, to: sb.to };
    }
  }
  return null;
}

// Bridge count between two islands in current state
export function getBridgeCount(bridges: Bridge[], id1: number, id2: number): number {
  return findBridge(bridges, id1, id2)?.count ?? 0;
}

// Current bridge sum for an island
export function islandBridgeSum(bridges: Bridge[], islandId: number): number {
  return bridges.reduce((s, b) => {
    if (b.from === islandId || b.to === islandId) return s + b.count;
    return s;
  }, 0);
}
