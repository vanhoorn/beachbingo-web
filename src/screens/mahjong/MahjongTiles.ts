// ── Tile type IDs ─────────────────────────────────────────────────────────────
// Muscheln 1-9, Wellen 1-9, Fische 1-9, 4 Winde, 3 Drachen, 4 Jahreszeiten, 4 Blumen

export type TileGroup =
  | "muscheln" | "wellen" | "fische"
  | "winde" | "drachen"
  | "jahreszeiten" | "blumen";

export interface TileType {
  id: string;
  group: TileGroup;
  rank: number; // 1-9 for suits; 1-4 for winds/bonus; 1-3 for dragons
  label: string;
  svgIcon: string; // key for SVG renderer
  color: string;   // border/accent colour for tile face
  copies: number;  // how many in a full set
}

// Suit tile border colours
const C_MUSCHELN   = "#0ea5e9"; // ocean blue
const C_WELLEN     = "#06b6d4"; // cyan
const C_FISCHE     = "#22c55e"; // green
const C_WINDE      = "#f59e0b"; // sand-gold
const C_JAHRESZEIT = "#a855f7"; // purple
const C_BLUMEN     = "#f97316"; // coral

function suit(group: TileGroup, color: string): TileType[] {
  return Array.from({ length: 9 }, (_, i) => ({
    id: `${group}_${i + 1}`,
    group,
    rank: i + 1,
    label: `${group.charAt(0).toUpperCase() + group.slice(1)} ${i + 1}`,
    svgIcon: `${group}_${i + 1}`,
    color,
    copies: 4,
  }));
}

export const ALL_TILE_TYPES: TileType[] = [
  // ── Farbsteine ──────────────────────────────────────────────────────────────
  ...suit("muscheln", C_MUSCHELN),
  ...suit("wellen",   C_WELLEN),
  ...suit("fische",   C_FISCHE),

  // ── Winde ────────────────────────────────────────────────────────────────────
  { id: "wind_ost",  group: "winde", rank: 1, label: "Sonnenaufgang", svgIcon: "wind_ost",  color: C_WINDE, copies: 4 },
  { id: "wind_sued", group: "winde", rank: 2, label: "Palme",         svgIcon: "wind_sued", color: C_WINDE, copies: 4 },
  { id: "wind_west", group: "winde", rank: 3, label: "Sonnenuntergang", svgIcon: "wind_west", color: C_WINDE, copies: 4 },
  { id: "wind_nord", group: "winde", rank: 4, label: "Leuchtturm",    svgIcon: "wind_nord", color: C_WINDE, copies: 4 },

  // ── Drachen ──────────────────────────────────────────────────────────────────
  { id: "drache_rot",   group: "drachen", rank: 1, label: "Roter Hai",     svgIcon: "drache_rot",   color: "#ef4444", copies: 4 },
  { id: "drache_gruen", group: "drachen", rank: 2, label: "Blauer Delfin", svgIcon: "drache_gruen", color: "#2563eb", copies: 4 },
  { id: "drache_weiss", group: "drachen", rank: 3, label: "Oktopus",       svgIcon: "drache_weiss", color: "#0d9488", copies: 4 },

  // ── Jahreszeiten (Wildcards) ──────────────────────────────────────────────
  { id: "jahreszeit_fruehling", group: "jahreszeiten", rank: 1, label: "Fruehling", svgIcon: "jahreszeit_fruehling", color: C_JAHRESZEIT, copies: 1 },
  { id: "jahreszeit_sommer",    group: "jahreszeiten", rank: 2, label: "Sommer",    svgIcon: "jahreszeit_sommer",    color: C_JAHRESZEIT, copies: 1 },
  { id: "jahreszeit_herbst",    group: "jahreszeiten", rank: 3, label: "Herbst",    svgIcon: "jahreszeit_herbst",    color: C_JAHRESZEIT, copies: 1 },
  { id: "jahreszeit_winter",    group: "jahreszeiten", rank: 4, label: "Winter",    svgIcon: "jahreszeit_winter",    color: C_JAHRESZEIT, copies: 1 },

  // ── Blumen (Wildcards) ────────────────────────────────────────────────────
  { id: "blume_hibiskus",    group: "blumen", rank: 1, label: "Hibiskus",    svgIcon: "blume_hibiskus",    color: C_BLUMEN, copies: 1 },
  { id: "blume_anemone",     group: "blumen", rank: 2, label: "Seeanemone",  svgIcon: "blume_anemone",     color: C_BLUMEN, copies: 1 },
  { id: "blume_seerose",     group: "blumen", rank: 3, label: "Seerose",     svgIcon: "blume_seerose",     color: C_BLUMEN, copies: 1 },
  { id: "blume_stranddistel", group: "blumen", rank: 4, label: "Stranddistel", svgIcon: "blume_stranddistel", color: C_BLUMEN, copies: 1 },
];

// Expand into full 144-tile deck (one entry per physical tile)
export function buildDeck(): string[] {
  const deck: string[] = [];
  for (const t of ALL_TILE_TYPES) {
    for (let c = 0; c < t.copies; c++) deck.push(t.id);
  }
  return deck; // 144 entries
}

export function getTileType(id: string): TileType {
  const t = ALL_TILE_TYPES.find((x) => x.id === id);
  if (!t) throw new Error(`Unknown tile type: ${id}`);
  return t;
}

// Two tile-type-ids match if:
// - identical, OR
// - both are jahreszeiten, OR
// - both are blumen
export function tilesMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const ta = getTileType(a);
  const tb = getTileType(b);
  if (ta.group === "jahreszeiten" && tb.group === "jahreszeiten") return true;
  if (ta.group === "blumen"       && tb.group === "blumen")       return true;
  return false;
}

export const TILE_COLOR: Record<string, string> = Object.fromEntries(
  ALL_TILE_TYPES.map((t) => [t.id, t.color])
);
