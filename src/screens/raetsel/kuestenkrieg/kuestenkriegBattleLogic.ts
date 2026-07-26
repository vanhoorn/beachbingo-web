// ── Constants ──────────────────────────────────────────────────────────────────

export const GRID = 10;

export const FLEET_DEFS = [
  { size: 5, name: "Schlachtschiff", emoji: "⛴" },
  { size: 4, name: "Kreuzer",        emoji: "🚢" },
  { size: 3, name: "Zerstörer",      emoji: "🛥" },
  { size: 3, name: "Zerstörer",      emoji: "🛥" },
  { size: 2, name: "U-Boot",         emoji: "🤿" },
  { size: 2, name: "U-Boot",         emoji: "🤿" },
  { size: 2, name: "U-Boot",         emoji: "🤿" },
];

// ── Types ──────────────────────────────────────────────────────────────────────

export type ShotResult = "unknown" | "miss" | "hit" | "sunk";
export type AiMode = "matrose" | "kapitaen" | "admiral";
export type BattleTurn = "player" | "ai";

export interface PlacedShip {
  id: number;
  size: number;
  row: number;
  col: number;
  horiz: boolean;
  sunk: boolean;
}

export interface BattleState {
  playerFleet: PlacedShip[];
  aiFleet: PlacedShip[];
  playerGrid: ShotResult[][];   // shots fired at player's grid
  aiGrid: ShotResult[][];       // shots fired at AI's grid
  turn: BattleTurn;
  gameOver: boolean;
  winner: BattleTurn | null;
  // Admiral AI internal state
  _aiHuntMode?: boolean;
  _aiHits?: [number, number][];
  _aiTargets?: [number, number][];
}

// ── Ship placement helpers ─────────────────────────────────────────────────────

export function canPlaceShip(
  grid: boolean[][], r: number, c: number, size: number, horiz: boolean
): boolean {
  for (let i = 0; i < size; i++) {
    const nr = r + (horiz ? 0 : i);
    const nc = c + (horiz ? i : 0);
    if (nr < 0 || nr >= GRID || nc < 0 || nc >= GRID) return false;
    // Check cell + all 8 neighbors are empty
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const tr = nr + dr, tc = nc + dc;
        if (tr >= 0 && tr < GRID && tc >= 0 && tc < GRID && grid[tr][tc]) return false;
      }
    }
  }
  return true;
}

export function placeShipOnGrid(
  grid: boolean[][], r: number, c: number, size: number, horiz: boolean
): void {
  for (let i = 0; i < size; i++) {
    grid[r + (horiz ? 0 : i)][c + (horiz ? i : 0)] = true;
  }
}

export function removeShipFromGrid(
  grid: boolean[][], ship: PlacedShip
): void {
  for (let i = 0; i < ship.size; i++) {
    const nr = ship.row + (ship.horiz ? 0 : i);
    const nc = ship.col + (ship.horiz ? i : 0);
    if (nr >= 0 && nr < GRID && nc >= 0 && nc < GRID) grid[nr][nc] = false;
  }
}

export function fleetToGrid(fleet: PlacedShip[]): boolean[][] {
  const grid: boolean[][] = Array.from({ length: GRID }, () => Array(GRID).fill(false));
  fleet.forEach(s => placeShipOnGrid(grid, s.row, s.col, s.size, s.horiz));
  return grid;
}

// ── AI ship placement ──────────────────────────────────────────────────────────

function rng() { return Math.random(); }

export function placeFleetAi(): PlacedShip[] {
  const fleet: PlacedShip[] = [];
  const grid: boolean[][] = Array.from({ length: GRID }, () => Array(GRID).fill(false));
  FLEET_DEFS.forEach((def, id) => {
    for (let attempt = 0; attempt < 200; attempt++) {
      const horiz = rng() < 0.5;
      const r = Math.floor(rng() * GRID);
      const c = Math.floor(rng() * GRID);
      if (canPlaceShip(grid, r, c, def.size, horiz)) {
        placeShipOnGrid(grid, r, c, def.size, horiz);
        fleet.push({ id, size: def.size, row: r, col: c, horiz, sunk: false });
        break;
      }
    }
  });
  return fleet;
}

// ── Battle state creation ──────────────────────────────────────────────────────

export function createBattleState(playerFleet: PlacedShip[], _aiMode: AiMode): BattleState {
  const aiFleet = placeFleetAi();
  const emptyGrid = (): ShotResult[][] =>
    Array.from({ length: GRID }, () => Array(GRID).fill("unknown") as ShotResult[]);
  return {
    playerFleet, aiFleet,
    playerGrid: emptyGrid(), aiGrid: emptyGrid(),
    turn: "player", gameOver: false, winner: null,
    _aiHuntMode: true, _aiHits: [], _aiTargets: [],
  };
}

// ── Player shoots AI grid ──────────────────────────────────────────────────────

export function playerShoot(state: BattleState, r: number, c: number): BattleState {
  if (state.turn !== "player" || state.gameOver) return state;
  if (state.aiGrid[r][c] !== "unknown") return state;

  const aiGrid = state.aiGrid.map(row => [...row]) as ShotResult[][];
  let aiFleet = state.aiFleet.map(s => ({ ...s }));

  const hitShip = aiFleet.find(
    s => shipCells(s).some(([sr, sc]) => sr === r && sc === c)
  );

  if (hitShip) {
    aiGrid[r][c] = "hit";
    // Check if ship is sunk
    const sunkNow = shipCells(hitShip).every(([sr, sc]) => aiGrid[sr][sc] !== "unknown");
    if (sunkNow) {
      aiFleet = aiFleet.map(s => s.id === hitShip.id && s.row === hitShip.row && s.col === hitShip.col
        ? { ...s, sunk: true } : s);
      shipCells(hitShip).forEach(([sr, sc]) => { aiGrid[sr][sc] = "sunk"; });
    }
  } else {
    aiGrid[r][c] = "miss";
  }

  const allSunk = aiFleet.every(s => s.sunk);
  return {
    ...state,
    aiGrid,
    aiFleet,
    turn: allSunk ? "player" : "ai",
    gameOver: allSunk,
    winner: allSunk ? "player" : null,
  };
}

// ── AI shoots player grid ──────────────────────────────────────────────────────

export function aiShoot(state: BattleState, aiMode: AiMode): BattleState {
  if (state.turn !== "ai" || state.gameOver) return state;

  const cell = pickAiCell(state, aiMode);
  if (!cell) return { ...state, turn: "player" };
  const [r, c] = cell;

  const playerGrid = state.playerGrid.map(row => [...row]) as ShotResult[][];
  let playerFleet = state.playerFleet.map(s => ({ ...s }));
  let aiHits = [...(state._aiHits ?? [])];
  let aiTargets = [...(state._aiTargets ?? [])];
  let aiHuntMode = state._aiHuntMode ?? true;

  const hitShip = playerFleet.find(
    s => shipCells(s).some(([sr, sc]) => sr === r && sc === c)
  );

  if (hitShip) {
    playerGrid[r][c] = "hit";
    aiHits.push([r, c]);
    const sunkNow = shipCells(hitShip).every(([sr, sc]) => playerGrid[sr][sc] !== "unknown");
    if (sunkNow) {
      playerFleet = playerFleet.map(s => s.id === hitShip.id && s.row === hitShip.row && s.col === hitShip.col
        ? { ...s, sunk: true } : s);
      shipCells(hitShip).forEach(([sr, sc]) => { playerGrid[sr][sc] = "sunk"; });
      // Remove sunk ship's cells from hits
      const sunkCells = new Set(shipCells(hitShip).map(([sr, sc]) => `${sr},${sc}`));
      aiHits = aiHits.filter(([hr, hc]) => !sunkCells.has(`${hr},${hc}`));
      aiTargets = [];
      aiHuntMode = aiHits.length === 0;
    } else {
      // Build target list from adjacent cells of all unsunk hits
      if (aiMode === "admiral") {
        aiTargets = buildTargets(aiHits, playerGrid);
        aiHuntMode = false;
      }
    }
  } else {
    playerGrid[r][c] = "miss";
    // Remove this cell from targets if present
    aiTargets = aiTargets.filter(([tr, tc]) => !(tr === r && tc === c));
  }

  const allSunk = playerFleet.every(s => s.sunk);
  return {
    ...state,
    playerGrid, playerFleet,
    turn: allSunk ? "ai" : "player",
    gameOver: allSunk,
    winner: allSunk ? "ai" : null,
    _aiHuntMode: aiHuntMode,
    _aiHits: aiHits,
    _aiTargets: aiTargets,
  };
}

function buildTargets(hits: [number, number][], grid: ShotResult[][]): [number, number][] {
  const targets: [number, number][] = [];
  const seen = new Set<string>();
  for (const [hr, hc] of hits) {
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]] as [number,number][]) {
      const nr = hr + dr, nc = hc + dc;
      const key = `${nr},${nc}`;
      if (nr >= 0 && nr < GRID && nc >= 0 && nc < GRID && grid[nr][nc] === "unknown" && !seen.has(key)) {
        targets.push([nr, nc]);
        seen.add(key);
      }
    }
  }
  return targets;
}

function pickAiCell(state: BattleState, aiMode: AiMode): [number, number] | null {
  const unknown: [number, number][] = [];
  for (let r = 0; r < GRID; r++)
    for (let c = 0; c < GRID; c++)
      if (state.playerGrid[r][c] === "unknown") unknown.push([r, c]);
  if (unknown.length === 0) return null;

  if (aiMode === "matrose") {
    return unknown[Math.floor(Math.random() * unknown.length)];
  }

  if (aiMode === "admiral") {
    const targets = state._aiTargets ?? [];
    if (targets.length > 0) {
      return targets[Math.floor(Math.random() * targets.length)];
    }
    // Hunt mode: prefer checkerboard pattern (cells where (r+c) % 2 === 0)
    const checker = unknown.filter(([r, c]) => (r + c) % 2 === 0);
    const pool = checker.length > 0 ? checker : unknown;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // Kapitän: probability density map
  const density: number[][] = Array.from({ length: GRID }, () => Array(GRID).fill(0));
  for (const ship of state.playerFleet.filter(s => !s.sunk)) {
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        // Horizontal placement
        if (c + ship.size <= GRID) {
          const cells: [number, number][] = Array.from({ length: ship.size }, (_, i) => [r, c + i]);
          const valid = cells.every(([cr, cc]) => state.playerGrid[cr][cc] !== "miss" && state.playerGrid[cr][cc] !== "sunk");
          const hasHit = cells.some(([cr, cc]) => state.playerGrid[cr][cc] === "hit");
          if (valid) cells.forEach(([cr, cc]) => { density[cr][cc] += hasHit ? 5 : 1; });
        }
        // Vertical
        if (r + ship.size <= GRID) {
          const cells: [number, number][] = Array.from({ length: ship.size }, (_, i) => [r + i, c]);
          const valid = cells.every(([cr, cc]) => state.playerGrid[cr][cc] !== "miss" && state.playerGrid[cr][cc] !== "sunk");
          const hasHit = cells.some(([cr, cc]) => state.playerGrid[cr][cc] === "hit");
          if (valid) cells.forEach(([cr, cc]) => { density[cr][cc] += hasHit ? 5 : 1; });
        }
      }
    }
  }
  // Zero out already-shot cells
  for (let r = 0; r < GRID; r++)
    for (let c = 0; c < GRID; c++)
      if (state.playerGrid[r][c] !== "unknown") density[r][c] = 0;

  // Pick highest density cell
  let maxD = 0, best: [number, number] = unknown[0];
  for (const [r, c] of unknown) {
    if (density[r][c] > maxD) { maxD = density[r][c]; best = [r, c]; }
  }
  return best;
}

// ── Helper: get all cells of a ship ───────────────────────────────────────────

export function shipCells(ship: PlacedShip): [number, number][] {
  return Array.from({ length: ship.size }, (_, i) => [
    ship.row + (ship.horiz ? 0 : i),
    ship.col + (ship.horiz ? i : 0),
  ] as [number, number]);
}

// ── Serialization ──────────────────────────────────────────────────────────────

export function serializeBattleState(state: BattleState): string {
  return JSON.stringify(state);
}

export function deserializeBattleState(raw: string): BattleState | null {
  try { return JSON.parse(raw) as BattleState; } catch { return null; }
}

// ── Count remaining ship cells ─────────────────────────────────────────────────

export function countRemainingCells(fleet: PlacedShip[]): number {
  return fleet.filter(s => !s.sunk).reduce((sum, s) => sum + s.size, 0);
}
