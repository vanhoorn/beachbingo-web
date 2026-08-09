// Each position: [col, row, layer]
// col/row are half-steps (so adjacent tiles share edges at step 2)
// layer 0 = bottom, higher = on top

export type LayoutId = "schildkroete" | "pyramide" | "kreuz" | "drachen" | "leuchtturm";

export interface LayoutDef {
  id: LayoutId;
  label: string;
  emoji: string;
  positions: [number, number, number][]; // [col, row, layer]
  tileCount: number;
}


// ── Schildkröte (144 tiles) ───────────────────────────────────────────────────
function turtle144(): [number, number, number][] {
  const p: [number, number, number][] = [];
  // Layer 0: base 12×4 + wings
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 12; c++)
      p.push([c * 2, r * 2, 0]);
  // Wings
  p.push([-2, 2, 0]); p.push([24, 2, 0]);
  // Single stack at centre front
  p.push([10, 8, 0]); p.push([12, 8, 0]);
  // Layer 1: 10×3
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 10; c++)
      p.push([2 + c * 2, 1 + r * 2, 1]);
  // Layer 2: 8×2
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 8; c++)
      p.push([2 + c * 2, 2 + r * 2, 2]);
  // Layer 3: 4×1
  for (let c = 0; c < 4; c++) p.push([4 + c * 2, 3, 3]);
  // Layer 4: 2 tiles
  p.push([6, 4, 4]); p.push([8, 4, 4]);
  // Layer 5: 1 peak
  p.push([7, 5, 5]);
  // Counts: 48+2+2=52, 30, 16, 4, 2, 1 = 105 → need 39 more at base
  // Fill base rows
  for (let c = 0; c < 8; c++) p.push([2 + c * 2, 9, 0]);  // 8
  for (let c = 0; c < 6; c++) p.push([4 + c * 2, 11, 0]); // 6
  for (let c = 0; c < 6; c++) p.push([4 + c * 2, 13, 0]); // 6
  for (let c = 1; c < 10; c++) p.push([c * 2, -2, 0]);     // 9 top row
  for (let c = 1; c < 11; c++) p.push([c * 2, -4, 0]);     // 10
  return p; // 105+8+6+6+9+10 = 144
}

// ── Pyramide (136 tiles) ──────────────────────────────────────────────────────
// 5-layer step pyramid: (12,5)+(10,4)+(8,2)+(6,2)+(4,2) = 60+40+16+12+8 = 136 ✓
function pyramide136(): [number, number, number][] {
  const p: [number, number, number][] = [];
  const configs: [number, number][] = [[12,5],[10,4],[8,2],[6,2],[4,2]];
  for (let layer = 0; layer < configs.length; layer++) {
    const [w, h] = configs[layer];
    const colOff = (12 - w);  // center each layer within maxWidth=12
    for (let r = 0; r < h; r++)
      for (let c = 0; c < w; c++)
        p.push([(colOff + c) * 2, r * 2, layer]);
  }
  return p;
}

// ── Kreuz (140 tiles) ─────────────────────────────────────────────────────────
function kreuz140(): [number, number, number][] {
  const p: [number, number, number][] = [];
  // Horizontal bar: 14×3
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 14; c++)
      p.push([c * 2, (3 + r) * 2, 0]);
  // Vertical bar: 4×9 (skip overlap rows 3-5)
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 4; c++)
      if (r < 3 || r > 5)
        p.push([(5 + c) * 2, r * 2, 0]);
  // Layer 1 on top of intersection (4×3)
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 4; c++)
      p.push([(5 + c) * 2, (3 + r) * 2, 1]);
  // Layer 2 centre
  for (let c = 0; c < 2; c++)
    p.push([(6 + c) * 2, 8, 2]);
  return p;
}

// ── Drachen (144 tiles) ───────────────────────────────────────────────────────
function drachen144(): [number, number, number][] {
  const p: [number, number, number][] = [];
  // Body: diagonal spine
  for (let i = 0; i < 8; i++) p.push([i * 2, i * 2, 0]);
  // Body width: 3 tiles around spine
  for (let i = 1; i < 7; i++) {
    p.push([(i) * 2, (i - 1) * 2, 0]);
    p.push([(i) * 2, (i + 1) * 2, 0]);
  }
  // Head: 4×3 block at top-left
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 4; c++)
      p.push([c * 2, r * 2, 0]);
  // Tail: narrow at bottom-right
  for (let i = 8; i < 12; i++) p.push([i * 2, i * 2, 0]);
  // Wings
  for (let i = 2; i < 6; i++) {
    p.push([(i + 2) * 2, (i - 2) * 2, 0]);
    p.push([(i - 2) * 2, (i + 2) * 2, 0]);
  }
  // Layer 1 on body
  for (let i = 2; i < 6; i++) p.push([i * 2, i * 2, 1]);
  // Layer 2 peak
  p.push([6, 6, 2]); p.push([8, 8, 2]);
  // Claws/details
  for (let c = 0; c < 3; c++) p.push([c * 2, 8, 0]);
  for (let c = 0; c < 3; c++) p.push([14 + c * 2, 2, 0]);
  // Fill to ~144
  for (let r = 0; r < 5; r++) p.push([20 + r * 2, r * 2, 0]);
  for (let r = 0; r < 5; r++) p.push([r * 2, 18 + r * 2, 0]);
  for (let r = 0; r < 4; r++) p.push([22 + r * 2, 2 + r * 2, 0]);
  return p;
}

// ── Leuchtturm (120 tiles) ───────────────────────────────────────────────────
function leuchtturm(): [number, number, number][] {
  const p: [number, number, number][] = [];
  // Wide base: 6×2
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 6; c++)
      p.push([c * 2, (8 + r) * 2, 0]);
  // Tower rising: getting narrower
  const towerWidths = [4, 4, 4, 3, 3, 2, 2, 1, 1];
  for (let layer = 0; layer < towerWidths.length; layer++) {
    const w = towerWidths[layer];
    const off = Math.floor((6 - w) / 2);
    for (let c = 0; c < w; c++)
      p.push([(off + c) * 2, (7 - layer) * 2, layer]);
  }
  // Beacon at top
  p.push([4, 0, 8]); p.push([6, 0, 8]);
  // Surrounding base extension
  for (let c = 0; c < 8; c++) p.push([c * 2 - 2, 20, 0]);
  for (let c = 0; c < 6; c++) p.push([c * 2,     22, 0]);
  // Sea tiles around base
  for (let c = 0; c < 4; c++) {
    p.push([c * 2 - 2, 18, 0]);
    p.push([12 + c * 2, 18, 0]);
  }
  return p;
}

// ── Exports ───────────────────────────────────────────────────────────────────

export const LAYOUTS: Record<LayoutId, LayoutDef> = {
  schildkroete: {
    id: "schildkroete", label: "Schildkröte", emoji: "🐢",
    positions: turtle144(),
    tileCount: 144,
  },
  pyramide: {
    id: "pyramide", label: "Pyramide", emoji: "🔺",
    positions: pyramide136(),
    tileCount: 136,
  },
  kreuz: {
    id: "kreuz", label: "Kreuz", emoji: "✚",
    positions: kreuz140(),
    tileCount: 140,
  },
  drachen: {
    id: "drachen", label: "Drachen", emoji: "🐉",
    positions: drachen144(),
    tileCount: 144,
  },
  leuchtturm: {
    id: "leuchtturm", label: "Leuchtturm", emoji: "🗼",
    positions: leuchtturm(),
    tileCount: 120,
  },
};

export const LAYOUT_ORDER: LayoutId[] = [
  "schildkroete", "pyramide", "kreuz", "drachen", "leuchtturm",
];
