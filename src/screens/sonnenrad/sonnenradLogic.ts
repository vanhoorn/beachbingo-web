// Sonnenrad — game logic, paytable, localStorage helpers

export type SonnenradSymbol = "SONNE" | "WELLE" | "PALME" | "MUSCHEL" | "SONNENSCHIRM";
export type SonnenradPhase =
  | "BONUS_READY"
  | "SHUFFLING"
  | "REVEALING"
  | "AWAITING_CHOICE"
  | "CLIMBING"
  | "FINISHED";

export const LS_LAST_CLAIMED  = "sonnenrad_last_claimed";
export const LS_TOTAL_POINTS  = "sonnenrad_total_points";

// Full Tagesbonus points per step
export const STEP_POINTS        = [0, 50, 100, 175, 275, 400, 600] as const;
// Normal (1/3) points per step
export const NORMAL_STEP_POINTS = [0, 17,  33,  58,  92, 133, 200] as const;

export function pointsForStep(step: number, isBonusRound: boolean): number {
  const arr = isBonusRound ? STEP_POINTS : NORMAL_STEP_POINTS;
  return arr[Math.min(Math.max(step, 0), 6)] ?? 0;
}

// Weighted symbol pool: SONNE/WELLE/PALME/MUSCHEL = 9 each, SONNENSCHIRM = 4 (sum 40)
const SYMBOL_POOL: SonnenradSymbol[] = [
  ...Array<SonnenradSymbol>(9).fill("SONNE"),
  ...Array<SonnenradSymbol>(9).fill("WELLE"),
  ...Array<SonnenradSymbol>(9).fill("PALME"),
  ...Array<SonnenradSymbol>(9).fill("MUSCHEL"),
  ...Array<SonnenradSymbol>(4).fill("SONNENSCHIRM"),
];

export function drawThreeCards(): [SonnenradSymbol, SonnenradSymbol, SonnenradSymbol] {
  const pool = [...SYMBOL_POOL];
  const result: SonnenradSymbol[] = [];
  for (let i = 0; i < 3; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    result.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return result as [SonnenradSymbol, SonnenradSymbol, SonnenradSymbol];
}

// Returns initial ladder step (0 = no match, 1 = pair, 2 = triple base, 4 = triple Sonnenschirm)
export function evaluateCards(
  cards: [SonnenradSymbol, SonnenradSymbol, SonnenradSymbol],
): number {
  const [a, b, c] = cards;
  if (a === "SONNENSCHIRM" && b === "SONNENSCHIRM" && c === "SONNENSCHIRM") return 4;
  if (a === b && b === c) return 2;
  if (a === b || b === c || a === c) return 1;
  return 0;
}

export function isBonusAvailable(): boolean {
  const lastClaimed = Number(localStorage.getItem(LS_LAST_CLAIMED) ?? "0");
  if (!lastClaimed) return true;
  const now  = new Date();
  const last = new Date(lastClaimed);
  return (
    now.getFullYear() !== last.getFullYear() ||
    now.getMonth()    !== last.getMonth()    ||
    now.getDate()     !== last.getDate()
  );
}

export function msUntilBonus(): number {
  const now = new Date();
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return Math.max(0, nextMidnight.getTime() - now.getTime());
}

export function formatMs(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function getLifetimePoints(): number {
  return Number(localStorage.getItem(LS_TOTAL_POINTS) ?? "0");
}

export function addLifetimePoints(pts: number): void {
  localStorage.setItem(LS_TOTAL_POINTS, String(getLifetimePoints() + pts));
}

export function claimBonus(): void {
  localStorage.setItem(LS_LAST_CLAIMED, String(Date.now()));
}

export const SYMBOL_COLORS: Record<SonnenradSymbol, string> = {
  SONNE:        "#F59E0B",
  WELLE:        "#0D9488",
  PALME:        "#22C55E",
  MUSCHEL:      "#F97316",
  SONNENSCHIRM: "#A855F7",
};

export const SYMBOL_LABELS: Record<SonnenradSymbol, string> = {
  SONNE:        "Sonne",
  WELLE:        "Welle",
  PALME:        "Palme",
  MUSCHEL:      "Muschel",
  SONNENSCHIRM: "Sonnenschirm",
};
