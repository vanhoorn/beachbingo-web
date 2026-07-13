import { useEffect, useRef, useCallback, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../../firebase";
import { GameHudBar, QuitConfirmDialog } from "../../components/GameHudBar";
import { audioManager } from "../../audio/AudioManager";

// ── Canvas ─────────────────────────────────────────────────────────────────────
const CW = 400, CH = 580;
const RED = "#dc2626";
const BG  = "#0a1628";

// ── Player ─────────────────────────────────────────────────────────────────────
const PW = 16, PH = 26;
const GRAVITY    = 0.48;
const MAX_FALL   = 11;
const WALK_SPEED = 2.2;
const JUMP_VY    = -7.5; // max ~58px – cannot reach next platform (85px gap)
const CLIMB_SPD  = 1.7;

// ── Level layout ───────────────────────────────────────────────────────────────
// y = top surface (where player feet stand), platform drawn below
const PLATS = [
  { x: 10, y: 505, w: 380 }, // P0 (bottom, start)
  { x: 10, y: 420, w: 360 }, // P1
  { x: 10, y: 335, w: 360 }, // P2
  { x: 10, y: 250, w: 360 }, // P3
  { x: 10, y: 165, w: 360 }, // P4
  { x: 10, y: 80,  w: 380 }, // P5 (top, goal)
] as const;
const PLAT_H = 11;

// Ladders: cx = center x, y1 = top (platform above), y2 = bottom (platform below)
const LADDERS = [
  { cx: 355, y1: 420, y2: 505 }, // R: P0→P1
  { cx: 130, y1: 420, y2: 505 }, // L: P0→P1 (extra)
  { cx: 25,  y1: 335, y2: 420 }, // L: P1→P2
  { cx: 255, y1: 335, y2: 420 }, // R: P1→P2 (extra)
  { cx: 355, y1: 250, y2: 335 }, // R: P2→P3
  { cx: 130, y1: 250, y2: 335 }, // L: P2→P3 (extra)
  { cx: 25,  y1: 165, y2: 250 }, // L: P3→P4
  { cx: 255, y1: 165, y2: 250 }, // R: P3→P4 (extra)
  { cx: 355, y1: 80,  y2: 165 }, // R: P4→P5
  { cx: 130, y1: 80,  y2: 165 }, // L: P4→P5 (extra)
] as const;
const LADD_W = 18;

const GOAL_X = 340; // x-threshold on P5 to win
const MOEVE_X = 55; // Möwe x position on P5 left side
const HAMMER_FLOAT = 30; // px above platform surface – requires a jump to reach
const EXPLOSION_FRAMES = 18;

// Coconut roll directions per platform index (positive = right)
// Alternating creates the DK-style zigzag cascade from top to bottom
const ROLL_DIR = [-1, 1, -1, 1, -1, 1] as const;

// ── Level 3 – Aufzüge layout ──────────────────────────────────────────────────
type Plat = { x: number; y: number; w: number };
type Ladd = { cx: number; y1: number; y2: number };
type HammerDefT = { x: number; platIdx: number };

const LEVEL3_PLATS: readonly Plat[] = [
  { x: 10,  y: 505, w: 380 }, // P0 full bottom (start)
  { x: 50,  y: 420, w: 140 }, // P1a links  x=50..190
  { x: 230, y: 420, w: 70  }, // P1b links  x=230..300
  { x: 100, y: 335, w: 80  }, // P2a rechts x=100..180
  { x: 220, y: 335, w: 135 }, // P2b rechts x=220..355
  { x: 50,  y: 250, w: 140 }, // P3a links  x=50..190
  { x: 230, y: 250, w: 70  }, // P3b links  x=230..300
  { x: 100, y: 165, w: 80  }, // P4a rechts x=100..180
  { x: 220, y: 165, w: 135 }, // P4b rechts x=220..355
  { x: 10,  y: 80,  w: 380 }, // P5 full top (goal)
];
const LEVEL3_LADDERS: readonly Ladd[] = [];
const OKTO_R   = 7;
const OKTO_SPD = 0.8;

function getActivePlats(lvl: number): readonly Plat[] {
  return getLevelType(lvl) === 3 ? LEVEL3_PLATS : PLATS;
}
function getActiveLadders(lvl: number): readonly Ladd[] {
  return getLevelType(lvl) === 3 ? LEVEL3_LADDERS : LADDERS;
}
function getHammerDefsForLevel(lvl: number): HammerDefT[] {
  return getLevelType(lvl) === 3
    ? [{ x: 120, platIdx: 1 }, { x: 120, platIdx: 5 }]
    : [{ x: 190, platIdx: 1 }, { x: 190, platIdx: 3 }];
}
function spawnOktos(lvl: number): Okto[] {
  if (getLevelType(lvl) !== 3) return [];
  return [1, 4, 5, 8].map((pi, i) => {
    const p = LEVEL3_PLATS[pi];
    return { id: i, x: p.x + p.w / 2, y: p.y, vx: pi % 2 === 0 ? OKTO_SPD : -OKTO_SPD, platIdx: pi };
  });
}

const HAMMER_DURATION = 300; // 5 s at 60 fps
const COCO_R = 8;

// ── Bonus timer ────────────────────────────────────────────────────────────────
const BONUS_START = 5000;
// at level 22 the bonus timer is only ~400 (kill screen)
function bonusForLevel(lvl: number) {
  return Math.max(400, BONUS_START - (lvl - 1) * 200);
}
// Decrement 10 pts every 6 frames ≈ 100 pts/sec at 60fps
const BONUS_DEC_FRAMES = 6;

// Coconut spawn interval in frames (decreases with level)
function spawnInterval(lvl: number) { return Math.max(80, 240 - (lvl - 1) * 20); }

// Roll/fall speed factor (increases with level, capped at level 5)
function cocoSpeed(lvl: number) { return 1.0 + Math.min(4, lvl - 1) * 0.15; }

// ── Level type & names ─────────────────────────────────────────────────────────
// Cycles 1→2→3→4→1→2→… as levels increase
function getLevelType(lvl: number): number { return ((lvl - 1) % 4) + 1; }

const LEVEL_NAMES: Record<number, string> = {
  1: "🏗️ Die Baustelle",
  2: "🏭 Die Zementfabrik",
  3: "🛗 Die Aufzüge",
  4: "🔩 Die Nieten",
};

// ── Conveyor belts (Level 2 mechanic) ─────────────────────────────────────────
interface ConveyorBelt { platIdx: number; x: number; w: number; vx: number; }

const BELT_SPEED = 1.2;

function getConveyorBelts(lvl: number): ConveyorBelt[] {
  if (getLevelType(lvl) !== 2) return [];
  // Right-going belts on P1/P3, left-going on P2/P4 (same direction as obstacles).
  // Positioned away from main ladder entries so a safe zone exists near each ladder.
  return [
    { platIdx: 1, x: 150, w: 200, vx:  BELT_SPEED }, // P1 right half → right
    { platIdx: 2, x:  20, w: 200, vx: -BELT_SPEED }, // P2 left half  → left
    { platIdx: 3, x: 150, w: 200, vx:  BELT_SPEED }, // P3 right half → right
    { platIdx: 4, x:  20, w: 200, vx: -BELT_SPEED }, // P4 left half  → left
  ];
}

// ── Elevators (Level 3 mechanic) ──────────────────────────────────────────────
const ELEV_SPEED = 1.2;
const ELEV_H = 11; // same thickness as PLAT_H

interface Elevator {
  x: number; w: number;
  y: number;    // current surface y (top)
  y1: number;   // upper travel limit (smaller y = higher)
  y2: number;   // lower travel limit (larger y = lower)
  vy: number;   // current velocity (positive = moving down)
}

function getElevators(lvl: number): Elevator[] {
  if (getLevelType(lvl) !== 3) return [];
  return [
    { x: 5,   w: 40, y: 380, y1: 80, y2: 490, vy: -ELEV_SPEED }, // Links,  fährt hoch
    { x: 355, w: 40, y: 210, y1: 80, y2: 490, vy:  ELEV_SPEED }, // Rechts, fährt runter
  ];
}

// ── Bouncing weights (Level 3 obstacle) ────────────────────────────────────────
const WEIGHT_BOUNCE_FACTOR = 0.72;
const WEIGHT_MAX_BOUNCES = 10;

// ── Types ──────────────────────────────────────────────────────────────────────
interface Coco {
  id: number; x: number; y: number;
  vx: number; vy: number;
  platIdx: number; // -1 = airborne; always -1 for Level-3 weights
  bounces: number; // number of platform bounces (Level-3 weights only)
}

interface Explosion {
  id: number; x: number; y: number; frame: number;
}

interface Okto {
  id: number; x: number; y: number;
  vx: number; platIdx: number;
}

interface GS {
  // Player position (center x, bottom y)
  px: number; py: number;
  pvx: number; pvy: number;
  ponGround: boolean;
  ponLadder: boolean;
  pladderIdx: number;
  pfacing: 1 | -1;
  panimTick: number;
  pinvTimer: number; // invincibility frames remaining

  // Coconuts
  cocos: Coco[];
  cocoIdCtr: number;
  cocoSpawnAcc: number;

  // Game meta
  lives: number;
  score: number;
  level: number;
  bonusTimer: number;
  bonusTickAcc: number;
  phase: "PLAYING" | "LEVEL_COMPLETE" | "LIFE_LOST" | "GAME_OVER";
  phaseTimer: number;
  totalFrame: number;

  // Hammer power-up
  hasHammer: boolean;
  hammerTimer: number;
  hammerPickups: boolean[]; // one entry per HAMMER_DEFS

  // Jump-over bonus tracking
  jumpedCocoIds: Set<number>;

  // Explosion effects
  explosions: Explosion[];
  explosionIdCtr: number;

  // Conveyor belts active this level (empty for non-L2 level types)
  conveyorBelts: ConveyorBelt[];

  // Elevators active this level (empty for non-L3 level types)
  elevators: Elevator[];
  ponElevator: boolean;
  pElevatorIdx: number;

  // Aktives Level-Layout (Level 3 hat andere Plattformen/Leitern)
  activePlats: readonly Plat[];
  activeLadders: readonly Ladd[];
  activeHammerDefs: HammerDefT[];

  // Level 3 Okto-Feinde
  oktos: Okto[];
  oktoIdCtr: number;
}

function makeGS(lvl = 1, lives = 3, score = 0): GS {
  const hd = getHammerDefsForLevel(lvl);
  return {
    px: 50, py: 505,
    pvx: 0, pvy: 0,
    ponGround: true, ponLadder: false, pladderIdx: -1,
    pfacing: 1, panimTick: 0, pinvTimer: 0,
    cocos: [], cocoIdCtr: 0, cocoSpawnAcc: 0,
    lives, score, level: lvl,
    bonusTimer: bonusForLevel(lvl), bonusTickAcc: 0,
    phase: "PLAYING", phaseTimer: 0, totalFrame: 0,
    hasHammer: false, hammerTimer: 0,
    hammerPickups: hd.map(() => false),
    jumpedCocoIds: new Set<number>(),
    explosions: [], explosionIdCtr: 0,
    conveyorBelts: getConveyorBelts(lvl),
    elevators: getElevators(lvl),
    ponElevator: false, pElevatorIdx: -1,
    activePlats: getActivePlats(lvl),
    activeLadders: getActiveLadders(lvl),
    activeHammerDefs: hd,
    oktos: spawnOktos(lvl),
    oktoIdCtr: 0,
  };
}

// ── Drawing helpers ─────────────────────────────────────────────────────────────
function drawPlat(ctx: CanvasRenderingContext2D, p: Plat) {
  ctx.fillStyle = "#7c3f1a";
  ctx.fillRect(p.x, p.y, p.w, PLAT_H);
  ctx.fillStyle = "#a05a2c";
  ctx.fillRect(p.x, p.y, p.w, 2);
  ctx.fillStyle = "#4a2409";
  ctx.fillRect(p.x, p.y + PLAT_H - 2, p.w, 2);
  ctx.strokeStyle = "#6b3416";
  ctx.lineWidth = 0.5;
  for (let gx = p.x + 8; gx < p.x + p.w - 4; gx += 16) {
    ctx.beginPath(); ctx.moveTo(gx, p.y + 2); ctx.lineTo(gx, p.y + PLAT_H - 2); ctx.stroke();
  }
}

function drawLadder(ctx: CanvasRenderingContext2D, l: Ladd) {
  ctx.strokeStyle = "#8b6534";
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(l.cx - LADD_W / 2 + 2, l.y1); ctx.lineTo(l.cx - LADD_W / 2 + 2, l.y2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(l.cx + LADD_W / 2 - 2, l.y1); ctx.lineTo(l.cx + LADD_W / 2 - 2, l.y2); ctx.stroke();
  ctx.lineWidth = 1.8;
  for (let ry = l.y2 - 9; ry >= l.y1 + 4; ry -= 11) {
    ctx.beginPath(); ctx.moveTo(l.cx - LADD_W / 2 + 3, ry); ctx.lineTo(l.cx + LADD_W / 2 - 3, ry); ctx.stroke();
  }
}

function drawSeeloewe(ctx: CanvasRenderingContext2D, frame: number, topPlatY: number) {
  const mx = MOEVE_X;
  const gy = topPlatY; // ground level of top platform

  // Flipper animation: smooth raise/lower
  const flipRaise = Math.sin(frame * 0.1) * 5;

  ctx.save();
  ctx.lineCap = "round";

  // Hind flippers (rest on ground)
  ctx.fillStyle = "#2a2018";
  ctx.beginPath(); ctx.ellipse(mx - 7, gy + 5, 11, 5, -0.25, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(mx + 7, gy + 5, 11, 5, 0.25, 0, Math.PI * 2); ctx.fill();

  // Main body
  ctx.fillStyle = "#4a3828";
  ctx.beginPath(); ctx.ellipse(mx, gy - 15, 15, 17, 0, 0, Math.PI * 2); ctx.fill();

  // Belly lighter patch
  ctx.fillStyle = "#6b5240";
  ctx.beginPath(); ctx.ellipse(mx + 2, gy - 13, 8, 11, 0, 0, Math.PI * 2); ctx.fill();

  // Left front flipper (hangs down)
  ctx.fillStyle = "#2a2018";
  ctx.beginPath(); ctx.ellipse(mx - 16, gy - 17, 8, 4, 0.6, 0, Math.PI * 2); ctx.fill();

  // Right front flipper (raised – throwing pose)
  ctx.fillStyle = "#2a2018";
  ctx.beginPath(); ctx.ellipse(mx + 17, gy - 24 - flipRaise, 9, 4, -0.7, 0, Math.PI * 2); ctx.fill();

  // Neck
  ctx.fillStyle = "#4a3828";
  ctx.beginPath(); ctx.ellipse(mx + 4, gy - 34, 8, 9, 0.15, 0, Math.PI * 2); ctx.fill();

  // Head
  ctx.fillStyle = "#5a4535";
  ctx.beginPath(); ctx.arc(mx + 6, gy - 46, 10, 0, Math.PI * 2); ctx.fill();

  // Ear bumps
  ctx.fillStyle = "#3d2e20";
  ctx.beginPath(); ctx.arc(mx + 1, gy - 55, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(mx + 10, gy - 54, 3, 0, Math.PI * 2); ctx.fill();

  // Snout / muzzle (lighter)
  ctx.fillStyle = "#7a6050";
  ctx.beginPath(); ctx.ellipse(mx + 13, gy - 46, 6, 4, 0, 0, Math.PI * 2); ctx.fill();

  // Nose
  ctx.fillStyle = "#1a0f0a";
  ctx.beginPath(); ctx.ellipse(mx + 18, gy - 46, 2.2, 1.5, 0, 0, Math.PI * 2); ctx.fill();

  // Eye
  ctx.fillStyle = "#0a0a12";
  ctx.beginPath(); ctx.arc(mx + 10, gy - 50, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(mx + 11, gy - 51, 1.1, 0, Math.PI * 2); ctx.fill();
  // Grumpy brow
  ctx.strokeStyle = "#1a0f0a";
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(mx + 6, gy - 54); ctx.lineTo(mx + 13, gy - 52); ctx.stroke();

  // Whiskers (both sides)
  ctx.strokeStyle = "#c8b8a0";
  ctx.lineWidth = 0.9;
  for (let i = 0; i < 4; i++) {
    const wy = gy - 49 + i * 1.4;
    // right whiskers
    ctx.beginPath(); ctx.moveTo(mx + 15, wy); ctx.lineTo(mx + 28, wy - 1 + i * 0.3); ctx.stroke();
    // left whiskers
    ctx.beginPath(); ctx.moveTo(mx + 8, wy); ctx.lineTo(mx - 4, wy - 0.5 + i * 0.3); ctx.stroke();
  }

  ctx.restore();
}

function drawExplosion(ctx: CanvasRenderingContext2D, e: Explosion) {
  const t = e.frame / EXPLOSION_FRAMES;
  const r = 4 + t * 20;
  const a = 1 - t;
  // Bright core
  ctx.fillStyle = `rgba(255,255,200,${a * 0.95})`;
  ctx.beginPath(); ctx.arc(e.x, e.y, r * 0.35, 0, Math.PI * 2); ctx.fill();
  // Orange fill
  ctx.fillStyle = `rgba(251,146,60,${a * 0.75})`;
  ctx.beginPath(); ctx.arc(e.x, e.y, r * 0.7, 0, Math.PI * 2); ctx.fill();
  // Red expanding ring
  ctx.strokeStyle = `rgba(239,68,68,${a})`;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, Math.PI * 2); ctx.stroke();
  // 8 flying sparks
  for (let i = 0; i < 8; i++) {
    const ang = (i * Math.PI * 2) / 8;
    const sx = e.x + Math.cos(ang) * r * 1.4;
    const sy = e.y + Math.sin(ang) * r * 1.4;
    ctx.fillStyle = `rgba(251,191,36,${a})`;
    ctx.beginPath(); ctx.arc(sx, sy, 2.5 * (1 - t * 0.7), 0, Math.PI * 2); ctx.fill();
  }
}

function drawHammerPickup(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // Handle
  ctx.fillStyle = "#92400e";
  ctx.fillRect(x - 2, y - 17, 3, 13);
  // Head
  ctx.fillStyle = "#94a3b8";
  ctx.fillRect(x - 7, y - 22, 13, 6);
  // Glint
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(x - 6, y - 21, 5, 2);
  // Glow
  ctx.fillStyle = "rgba(251,191,36,0.25)";
  ctx.beginPath(); ctx.arc(x, y - 16, 10, 0, Math.PI * 2); ctx.fill();
}

function drawPlayer(ctx: CanvasRenderingContext2D, gs: GS) {
  const { px, py, pfacing, ponLadder, pvy, panimTick, pinvTimer } = gs;
  if (pinvTimer > 0 && Math.floor(gs.totalFrame / 5) % 2 === 0) return;

  const f = pfacing;

  // Swim cap
  ctx.fillStyle = "#fbbf24";
  ctx.beginPath(); ctx.ellipse(px, py - PH + 5, 7, 5.5, 0, 0, Math.PI * 2); ctx.fill();

  // Head (skin)
  ctx.fillStyle = "#fde68a";
  ctx.beginPath(); ctx.arc(px, py - PH + 12, 7, 0, Math.PI * 2); ctx.fill();

  // Torso (red swimsuit)
  ctx.fillStyle = RED;
  ctx.fillRect(px - 5, py - PH + 18, 10, 11);

  // Legs
  ctx.strokeStyle = "#fde68a"; ctx.lineWidth = 3; ctx.lineCap = "round";
  if (ponLadder) {
    // Arms on rails
    ctx.strokeStyle = "#fde68a";
    ctx.beginPath(); ctx.moveTo(px - 5, py - PH + 21); ctx.lineTo(px - 10, py - PH + 16); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px + 5, py - PH + 21); ctx.lineTo(px + 10, py - PH + 16); ctx.stroke();
    const legOff = panimTick % 2 === 0 ? 3 : -3;
    ctx.beginPath(); ctx.moveTo(px - 3, py - PH + 29); ctx.lineTo(px - 3 + legOff, py); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px + 3, py - PH + 29); ctx.lineTo(px + 3 - legOff, py); ctx.stroke();
  } else if (pvy < -1) {
    // Jumping: tuck
    ctx.beginPath(); ctx.moveTo(px - 4, py - PH + 29); ctx.lineTo(px - 7, py - 5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px + 4, py - PH + 29); ctx.lineTo(px + 7, py - 5); ctx.stroke();
  } else {
    const swing = panimTick % 2 === 0 ? 5 : -5;
    ctx.beginPath(); ctx.moveTo(px - 3, py - PH + 29); ctx.lineTo(px - 3 + swing * f, py); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px + 3, py - PH + 29); ctx.lineTo(px + 3 - swing * f, py); ctx.stroke();
  }

  // Hammer held above head
  if (gs.hasHammer) {
    const swing = gs.totalFrame % 24 < 12;
    const hx = px + f * 6;
    const hy = py - PH - (swing ? 8 : 3);
    ctx.fillStyle = "#92400e";
    ctx.fillRect(hx - 1, hy, 3, 11);
    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(hx - 6, hy - (swing ? 6 : 2), 12, 5);
    // Sparkles when active
    if (gs.hammerTimer > 0 && gs.totalFrame % 6 < 3) {
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath(); ctx.arc(hx + 7, hy - 4, 2, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function drawCoco(ctx: CanvasRenderingContext2D, c: Coco) {
  ctx.fillStyle = "#5c2d0a";
  ctx.beginPath(); ctx.arc(c.x, c.y, COCO_R, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#3d1a06";
  ctx.beginPath(); ctx.arc(c.x - 2, c.y - 2, COCO_R * 0.38, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(c.x + 3, c.y + 2, COCO_R * 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(c.x - 1, c.y + 3, COCO_R * 0.33, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.13)";
  ctx.beginPath(); ctx.arc(c.x - 2, c.y - 3, COCO_R * 0.38, 0, Math.PI * 2); ctx.fill();
}

function drawConveyorBelt(ctx: CanvasRenderingContext2D, belt: ConveyorBelt, frame: number) {
  const py = PLATS[belt.platIdx].y;
  const PERIOD = 18;
  const rawOff = (frame * 0.5) % PERIOD;
  const scrollX = belt.vx > 0 ? rawOff : PERIOD - rawOff;
  // Belt surface – industrial steel-gray, 5px overlaying the platform top edge
  ctx.fillStyle = "rgba(51,65,85,0.88)";
  ctx.fillRect(belt.x, py, belt.w, 5);
  // Animated diagonal stripes (clipped to belt area)
  ctx.save();
  ctx.beginPath(); ctx.rect(belt.x, py, belt.w, 5); ctx.clip();
  ctx.fillStyle = "rgba(148,163,184,0.42)";
  for (let sx = belt.x - PERIOD * 2 + scrollX; sx < belt.x + belt.w + PERIOD; sx += PERIOD) {
    ctx.beginPath();
    ctx.moveTo(sx,                   py);
    ctx.lineTo(sx + PERIOD * 0.55,   py + 5);
    ctx.lineTo(sx + PERIOD,          py + 5);
    ctx.lineTo(sx + PERIOD * 0.45,   py);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  // Direction edge highlight (amber = right, blue = left)
  ctx.strokeStyle = belt.vx > 0 ? "rgba(251,191,36,0.85)" : "rgba(96,165,250,0.85)";
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(belt.x, py); ctx.lineTo(belt.x + belt.w, py); ctx.stroke();
}

function drawElevatorTrack(ctx: CanvasRenderingContext2D, el: Elevator) {
  ctx.save();
  ctx.strokeStyle = "rgba(59,130,246,0.2)";
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  // Left rail
  ctx.beginPath(); ctx.moveTo(el.x + 5, el.y1); ctx.lineTo(el.x + 5, el.y2 + ELEV_H); ctx.stroke();
  // Right rail
  ctx.beginPath(); ctx.moveTo(el.x + el.w - 5, el.y1); ctx.lineTo(el.x + el.w - 5, el.y2 + ELEV_H); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawElevator(ctx: CanvasRenderingContext2D, el: Elevator) {
  const { x, y, w } = el;
  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(x + 2, y + 3, w, ELEV_H);
  // Main body
  ctx.fillStyle = "#1d4ed8";
  ctx.fillRect(x, y, w, ELEV_H);
  // Top highlight
  ctx.fillStyle = "#3b82f6";
  ctx.fillRect(x, y, w, 3);
  // Bottom shadow
  ctx.fillStyle = "#1e3a8a";
  ctx.fillRect(x, y + ELEV_H - 2, w, 2);
  // Side bolts
  ctx.fillStyle = "#93c5fd";
  ctx.beginPath(); ctx.arc(x + 7,     y + ELEV_H / 2 + 1, 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + w - 7, y + ELEV_H / 2 + 1, 2, 0, Math.PI * 2); ctx.fill();
  // Direction arrow
  ctx.font = "7px sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(191,219,254,0.95)";
  ctx.fillText(el.vy > 0 ? "▼" : "▲", x + w / 2, y + ELEV_H / 2 + 1);
}

function drawWeight(ctx: CanvasRenderingContext2D, c: Coco) {
  const r = 8;
  const { x, y } = c;
  // Outer border
  ctx.fillStyle = "#111827";
  ctx.fillRect(x - r - 1, y - r - 1, r * 2 + 2, r * 2 + 2);
  // Body
  ctx.fillStyle = "#374151";
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  // Top highlight
  ctx.fillStyle = "#4b5563";
  ctx.fillRect(x - r, y - r, r * 2, 3);
  // Left edge
  ctx.fillStyle = "#4b5563";
  ctx.fillRect(x - r, y - r, 2, r * 2);
  // Bottom shadow
  ctx.fillStyle = "#1f2937";
  ctx.fillRect(x - r + 2, y + r - 3, r * 2 - 2, 3);
  // "KG" label
  ctx.font = "bold 6px monospace";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = "#9ca3af";
  ctx.fillText("KG", x, y + 1);
  // Hook at top
  ctx.strokeStyle = "#6b7280";
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x, y - r - 3, 3, Math.PI, 2 * Math.PI); ctx.stroke();
}

function drawWanne(ctx: CanvasRenderingContext2D, c: Coco) {
  const r = COCO_R;
  // Trapezoid body (cement trough)
  ctx.fillStyle = "#78716c";
  ctx.beginPath();
  ctx.moveTo(c.x - r + 1,   c.y - r * 0.55);
  ctx.lineTo(c.x + r - 1,   c.y - r * 0.55);
  ctx.lineTo(c.x + r - 3,   c.y + r * 0.6);
  ctx.lineTo(c.x - r + 3,   c.y + r * 0.6);
  ctx.closePath(); ctx.fill();
  // Lighter cement fill on top surface
  ctx.fillStyle = "#a8a29e";
  ctx.beginPath();
  ctx.moveTo(c.x - r + 2,   c.y - r * 0.55);
  ctx.lineTo(c.x + r - 2,   c.y - r * 0.55);
  ctx.lineTo(c.x + r - 3.5, c.y - r * 0.05);
  ctx.lineTo(c.x - r + 3.5, c.y - r * 0.05);
  ctx.closePath(); ctx.fill();
  // Carrying handle (U-shape)
  ctx.strokeStyle = "#57534e"; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(c.x - r + 2, c.y - r * 0.55);
  ctx.lineTo(c.x - r,     c.y - r * 1.15);
  ctx.lineTo(c.x + r,     c.y - r * 1.15);
  ctx.lineTo(c.x + r - 2, c.y - r * 0.55);
  ctx.stroke();
  // Dark shadow on bottom
  ctx.fillStyle = "#44403c";
  ctx.fillRect(c.x - r + 3, c.y + r * 0.25, (r - 3) * 2, r * 0.35);
}

function drawGoal(ctx: CanvasRenderingContext2D, topPlatY: number) {
  ctx.font = "24px serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("🛟", GOAL_X + 15, topPlatY - 16);
}

function drawOkto(ctx: CanvasRenderingContext2D, o: Okto) {
  const { x, y } = o;
  const r = OKTO_R;
  // Body
  ctx.fillStyle = "#7c3aed";
  ctx.beginPath(); ctx.arc(x, y - r, r, Math.PI, 2 * Math.PI); ctx.fill();
  ctx.fillRect(x - r, y - r, r * 2, r);
  // Tentacles (4 wiggly legs)
  ctx.strokeStyle = "#7c3aed"; ctx.lineWidth = 2.5; ctx.lineCap = "round";
  for (let i = 0; i < 4; i++) {
    const tx = x - r + r * 0.5 * i + r * 0.25;
    ctx.beginPath(); ctx.moveTo(tx, y); ctx.lineTo(tx - 1, y + 5); ctx.stroke();
  }
  // Eyes
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(x - 2.5, y - r - 1, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 2.5, y - r - 1, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#1e1b4b";
  ctx.beginPath(); ctx.arc(x - 2, y - r - 1, 1, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 3, y - r - 1, 1, 0, Math.PI * 2); ctx.fill();
}

function drawHUD(ctx: CanvasRenderingContext2D, gs: GS) {
  // Bonus timer top-right of canvas
  const timerColor = gs.bonusTimer < 1000 ? "#ef4444" : "#fbbf24";
  ctx.font = "bold 12px monospace";
  ctx.textAlign = "right"; ctx.textBaseline = "top";
  ctx.fillStyle = timerColor;
  ctx.fillText(`⏱ ${gs.bonusTimer}`, CW - 8, 8);

  // Level top-left
  ctx.textAlign = "left";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText(`LV.${gs.level}`, 8, 8);

  // Lives (hearts)
  ctx.textAlign = "center";
  ctx.font = "14px serif";
  for (let i = 0; i < 3; i++) {
    ctx.fillText(i < gs.lives ? "❤️" : "🖤", CW / 2 - 16 + i * 18, 6);
  }
}

function drawOverlay(ctx: CanvasRenderingContext2D, gs: GS) {
  if (gs.phase === "PLAYING") return;

  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(0, 0, CW, CH);

  if (gs.phase === "LEVEL_COMPLETE") {
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = "bold 28px sans-serif"; ctx.fillStyle = "#fbbf24";
    ctx.fillText("🎉 Geschafft!", CW / 2, CH / 2 - 20);
    ctx.font = "16px sans-serif"; ctx.fillStyle = "#e2e8f0";
    ctx.fillText(`+${gs.bonusTimer} Bonus-Punkte`, CW / 2, CH / 2 + 18);
    ctx.font = "14px sans-serif"; ctx.fillStyle = "#94a3b8";
    ctx.fillText(`Level ${gs.level + 1} startet …`, CW / 2, CH / 2 + 46);
    ctx.font = "13px sans-serif"; ctx.fillStyle = "#fbbf24";
    ctx.fillText(LEVEL_NAMES[getLevelType(gs.level + 1)], CW / 2, CH / 2 + 70);
  }

  if (gs.phase === "LIFE_LOST") {
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = "bold 26px sans-serif"; ctx.fillStyle = RED;
    ctx.fillText("💥 Autsch!", CW / 2, CH / 2 - 16);
    ctx.font = "16px sans-serif"; ctx.fillStyle = "#e2e8f0";
    ctx.fillText(`Noch ${gs.lives} Leben`, CW / 2, CH / 2 + 18);
  }

  if (gs.phase === "GAME_OVER") {
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = "bold 28px sans-serif"; ctx.fillStyle = RED;
    ctx.fillText("Game Over", CW / 2, CH / 2 - 24);
    ctx.font = "20px sans-serif"; ctx.fillStyle = "#fbbf24";
    ctx.fillText(`${gs.score} Punkte`, CW / 2, CH / 2 + 12);
    ctx.font = "14px sans-serif"; ctx.fillStyle = "#94a3b8";
    ctx.fillText("Drücke Weiter zum Ergebnis", CW / 2, CH / 2 + 44);
  }
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function StrandturmGameScreen() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const state     = location.state as { controlMode?: "BUTTONS" | "TOUCH" | "SPLIT"; startLevel?: number } | null;
  const controlMode = state?.controlMode ?? "BUTTONS";
  const startLevel  = state?.startLevel ?? 1;

  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const rafRef     = useRef<number>(0);
  const gsRef      = useRef<GS>(makeGS(startLevel));
  const savedRef   = useRef(false);

  // Input state
  const leftRef  = useRef(false);
  const rightRef = useRef(false);
  const upRef    = useRef(false);
  const downRef  = useRef(false);
  const jumpPressRef = useRef(false); // consumed once per press

  // Display state (UI updates)
  const [score, setScore]      = useState(0);
  const [lives, setLives]      = useState(3);
  const [bonusTimer, setBonus] = useState(BONUS_START);
  const [paused, setPaused]    = useState(false);
  const [quitDialog, setQuit]  = useState(false);
  const [phase, setPhase]      = useState<GS["phase"]>("PLAYING");

  const isOver = phase === "GAME_OVER";

  // ── Physics step ─────────────────────────────────────────────────────────────
  function step(gs: GS) {
    if (gs.phase !== "PLAYING") {
      gs.phaseTimer--;
      if (gs.phaseTimer <= 0) {
        if (gs.phase === "LEVEL_COMPLETE") {
          // Advance to next level
          const newGs = makeGS(gs.level + 1, gs.lives, gs.score);
          Object.assign(gs, newGs);
          setScore(gs.score); setLives(gs.lives); setBonus(gs.bonusTimer);
          setPhase("PLAYING");
        } else if (gs.phase === "LIFE_LOST") {
          // Reset position
          gs.px = 50; gs.py = 505; gs.pvx = 0; gs.pvy = 0;
          gs.ponGround = true; gs.ponLadder = false; gs.pladderIdx = -1;
          gs.cocos = []; gs.cocoSpawnAcc = 0;
          gs.bonusTimer = bonusForLevel(gs.level); gs.bonusTickAcc = 0;
          gs.pinvTimer = 120; // 2s invincibility
          gs.hasHammer = false; gs.hammerTimer = 0;
          gs.hammerPickups = gs.activeHammerDefs.map(() => false);
          gs.jumpedCocoIds = new Set<number>();
          gs.explosions = []; gs.explosionIdCtr = 0;
          gs.ponElevator = false; gs.pElevatorIdx = -1;
          gs.oktos = spawnOktos(gs.level);
          gs.phase = "PLAYING";
          setBonus(gs.bonusTimer); setPhase("PLAYING");
        }
      }
      return;
    }

    gs.totalFrame++;

    // ── Elevator movement (Level 3 mechanic) ─────────────────────────────────
    for (const el of gs.elevators) {
      el.y += el.vy;
      if (el.y <= el.y1) { el.y = el.y1; el.vy =  Math.abs(el.vy); }
      if (el.y >= el.y2) { el.y = el.y2; el.vy = -Math.abs(el.vy); }
    }

    // ── Bonus timer ──────────────────────────────────────────────────────────
    gs.bonusTickAcc++;
    if (gs.bonusTickAcc >= BONUS_DEC_FRAMES) {
      gs.bonusTickAcc = 0;
      gs.bonusTimer = Math.max(0, gs.bonusTimer - 10);
      if (gs.bonusTimer > 0 && gs.bonusTimer <= 500 && gs.bonusTimer % 100 === 0) {
        audioManager.playSound("timer_tick");
      }
      if (gs.bonusTimer === 0) {
        loseLife(gs);
        return;
      }
      setBonus(gs.bonusTimer);
    }

    // ── Hammer pickup ─────────────────────────────────────────────────────────
    if (!gs.hasHammer) {
      for (let hi = 0; hi < gs.activeHammerDefs.length; hi++) {
        if (gs.hammerPickups[hi]) continue;
        const h = gs.activeHammerDefs[hi];
        const hy = gs.activePlats[h.platIdx].y - HAMMER_FLOAT; // floated above platform
        if (Math.abs(gs.px - h.x) < 20 && Math.abs(gs.py - hy) < 18) {
          gs.hasHammer = true;
          gs.hammerTimer = HAMMER_DURATION;
          gs.hammerPickups[hi] = true;
          gs.score += 500;
          setScore(gs.score);
          audioManager.playSound("bonus");
        }
      }
    } else {
      gs.hammerTimer--;
      if (gs.hammerTimer <= 0) { gs.hasHammer = false; gs.hammerTimer = 0; }
    }

    // ── Spawn obstacle ────────────────────────────────────────────────────────
    gs.cocoSpawnAcc++;
    if (gs.cocoSpawnAcc >= spawnInterval(gs.level)) {
      gs.cocoSpawnAcc = 0;
      if (getLevelType(gs.level) === 3) {
        // Level 3: single weight on right side only
        const wx = 300 + Math.random() * 80;
        const wvx = (Math.random() - 0.3) * 1.5;
        gs.cocos.push({ id: gs.cocoIdCtr++, x: wx, y: -8, vx: wvx, vy: 2.5, platIdx: -1, bounces: 0 });
      } else {
        const spd = cocoSpeed(gs.level);
        const topPlat = gs.activePlats[gs.activePlats.length - 1];
        gs.cocos.push({
          id: gs.cocoIdCtr++,
          x: MOEVE_X + 35, y: topPlat.y - COCO_R,
          vx: spd, vy: 0,
          platIdx: gs.activePlats.length - 1,
          bounces: 0,
        });
      }
    }

    // ── Player movement ────────────────────────────────────────────────────────
    const wasOnGround = gs.ponGround;

    if (!gs.ponLadder) {
      // Gravity
      if (!wasOnGround) {
        gs.pvy = Math.min(gs.pvy + GRAVITY, MAX_FALL);
      } else {
        gs.pvy = 0;
      }

      // Jump
      if (jumpPressRef.current && wasOnGround) {
        gs.pvy = JUMP_VY;
        gs.ponGround = false;
        audioManager.playSound("jump");
      }
      jumpPressRef.current = false;

      // Horizontal
      if (leftRef.current)  { gs.pvx = -WALK_SPEED; gs.pfacing = -1; }
      else if (rightRef.current) { gs.pvx = WALK_SPEED; gs.pfacing = 1; }
      else gs.pvx = 0;

      // Enter ladder from bottom (UP near ladder)
      if (upRef.current && wasOnGround) {
        for (let i = 0; i < gs.activeLadders.length; i++) {
          const l = gs.activeLadders[i];
          if (Math.abs(gs.px - l.cx) <= LADD_W / 2 + 14 && Math.abs(gs.py - l.y2) <= 12) {
            gs.ponLadder = true; gs.pladderIdx = i;
            gs.ponGround = false; gs.pvx = 0; gs.pvy = 0;
            gs.py = l.y2 - 2; // nudge above exit threshold so it doesn't fire immediately
            gs.px = l.cx;     // center on ladder
            break;
          }
        }
      }

      // Enter ladder from top (DOWN while on platform over a ladder)
      if (downRef.current && wasOnGround) {
        for (let i = 0; i < gs.activeLadders.length; i++) {
          const l = gs.activeLadders[i];
          if (Math.abs(gs.px - l.cx) <= LADD_W / 2 + 14 && Math.abs(gs.py - l.y1) <= 8) {
            gs.ponLadder = true; gs.pladderIdx = i;
            gs.ponGround = false; gs.pvx = 0; gs.pvy = CLIMB_SPD;
            break;
          }
        }
      }
    } else {
      // On ladder
      jumpPressRef.current = false;
      gs.pvx = 0;
      if (upRef.current)   gs.pvy = -CLIMB_SPD;
      else if (downRef.current) gs.pvy = CLIMB_SPD;
      else gs.pvy = 0;

      // Walk off ladder
      if ((leftRef.current || rightRef.current) && gs.ponGround) {
        gs.ponLadder = false; gs.pladderIdx = -1;
        gs.pvx = leftRef.current ? -WALK_SPEED : WALK_SPEED;
        gs.pfacing = leftRef.current ? -1 : 1;
      }
    }

    // ── Move player ───────────────────────────────────────────────────────────
    const prevPY = gs.py;
    gs.px += gs.pvx;
    gs.py += gs.pvy;
    gs.px = Math.max(PW / 2, Math.min(CW - PW / 2, gs.px));

    // ── Platform collision ────────────────────────────────────────────────────
    if (!gs.ponLadder) {
      gs.ponGround = false;
      for (let i = 0; i < gs.activePlats.length; i++) {
        const p = gs.activePlats[i];
        if (gs.px + PW / 2 > p.x && gs.px - PW / 2 < p.x + p.w) {
          if (gs.pvy >= 0 && prevPY <= p.y + 1 && gs.py >= p.y) {
            gs.py = p.y; gs.pvy = 0; gs.ponGround = true;
            if (!wasOnGround) audioManager.playSound("land");
            break;
          }
        }
      }
    }

    // ── Elevator snap (Level 3 mechanic) ─────────────────────────────────────
    gs.ponElevator = false;
    gs.pElevatorIdx = -1;
    if (!gs.ponGround && !gs.ponLadder && gs.elevators.length > 0 && gs.pvy >= 0) {
      const tol = ELEV_SPEED + 3;
      for (let ei = 0; ei < gs.elevators.length; ei++) {
        const el = gs.elevators[ei];
        if (gs.px > el.x && gs.px < el.x + el.w) {
          if (gs.py >= el.y - 2 && gs.py <= el.y + tol) {
            gs.py = el.y;
            gs.pvy = 0;
            gs.ponGround = true;
            gs.ponElevator = true;
            gs.pElevatorIdx = ei;
            if (!wasOnGround) audioManager.playSound("land");
            break;
          }
        }
      }
    }

    // ── Conveyor belt effect (Level 2 mechanic) ──────────────────────────────
    if (gs.ponGround && !gs.ponLadder && gs.conveyorBelts.length > 0) {
      for (const belt of gs.conveyorBelts) {
        if (Math.abs(gs.py - gs.activePlats[belt.platIdx].y) < 2 &&
            gs.px >= belt.x && gs.px <= belt.x + belt.w) {
          gs.px = Math.max(PW / 2, Math.min(CW - PW / 2, gs.px + belt.vx));
          break;
        }
      }
    }

    // ── Ladder exit ───────────────────────────────────────────────────────────
    if (gs.ponLadder && gs.pladderIdx >= 0) {
      const l = gs.activeLadders[gs.pladderIdx];
      if (gs.py <= l.y1) {
        gs.py = l.y1; gs.ponLadder = false; gs.pladderIdx = -1;
        gs.ponGround = true; gs.pvy = 0;
        audioManager.playSound("land");
      } else if (gs.py >= l.y2) {
        gs.py = l.y2; gs.ponLadder = false; gs.pladderIdx = -1;
        gs.ponGround = true; gs.pvy = 0;
        audioManager.playSound("land");
      } else {
        // Climbing sound every 12 frames
        if (gs.pvy !== 0 && gs.totalFrame % 12 === 0) audioManager.playSound("climb");
      }
    }

    // ── Walk animation ────────────────────────────────────────────────────────
    if (gs.pvx !== 0 || (gs.ponLadder && gs.pvy !== 0)) {
      if (gs.totalFrame % 8 === 0) gs.panimTick++;
    }

    // ── Fall off bottom ───────────────────────────────────────────────────────
    if (gs.py > CH + 40) {
      loseLife(gs);
      return;
    }

    // ── Goal check (reached top platform right side) ─────────────────────────
    if (gs.py <= gs.activePlats[gs.activePlats.length - 1].y + 2 && gs.px >= GOAL_X && gs.phase === "PLAYING") {
      gs.score += 300 + gs.bonusTimer;
      audioManager.playSound("level_complete");
      audioManager.playSound("bonus");
      gs.phase = "LEVEL_COMPLETE";
      gs.phaseTimer = 150; // 2.5s at 60fps
      setScore(gs.score); setLives(gs.lives); setPhase("LEVEL_COMPLETE");
      saveHighScore(gs);
      return;
    }

    // ── Invincibility countdown ───────────────────────────────────────────────
    if (gs.pinvTimer > 0) gs.pinvTimer--;

    // ── Explosion update ─────────────────────────────────────────────────────
    gs.explosions = gs.explosions.filter(e => { e.frame++; return e.frame < EXPLOSION_FRAMES; });

    // ── Obstacle physics (coconuts L1, cement troughs L2, iron weights L3) ──
    const spd = cocoSpeed(gs.level);
    const levelType = getLevelType(gs.level);
    const cocoToRemove: number[] = [];

    for (let ci = 0; ci < gs.cocos.length; ci++) {
      const c = gs.cocos[ci];

      if (levelType === 3) {
        // ── Level 3: Falling weight — passes through platforms, bounces off elevators ──
        c.vy = Math.min(c.vy + 0.6, 14);
        c.x += c.vx;
        c.y += c.vy;
        // No wall clamping — weights fall freely off-screen

        // Bounce off elevator surfaces only
        for (const el of gs.elevators) {
          if (c.x > el.x && c.x < el.x + el.w &&
              c.y + 8 >= el.y && c.y + 8 <= el.y + 16 && c.vy > 0) {
            c.y = el.y - 8;
            c.vy = -Math.abs(c.vy) * WEIGHT_BOUNCE_FACTOR;
            c.vx += (Math.random() - 0.5) * 4;
            c.bounces++;
            audioManager.playSound("coconut_bounce");
            if (c.bounces >= WEIGHT_MAX_BOUNCES) cocoToRemove.push(ci);
            break;
          }
        }
        if (c.y > CH + 30 || c.x < -40 || c.x > CW + 40) cocoToRemove.push(ci);

      } else {
        // ── Level 1/2: Rolling coconut / cement-trough physics ────────────
        if (c.platIdx >= 0) {
          const p = gs.activePlats[c.platIdx];
          c.vx = ROLL_DIR[c.platIdx % ROLL_DIR.length] * spd;
          c.x += c.vx;
          c.y = p.y - COCO_R;
          if (c.x < p.x - COCO_R || c.x > p.x + p.w + COCO_R) {
            const nextPIdx = c.platIdx - 1;
            if (nextPIdx >= 0) {
              const np = gs.activePlats[nextPIdx];
              c.x = c.vx > 0 ? np.x + np.w - 25 : np.x + 25;
            }
            c.y = p.y + PLAT_H + 1;
            c.platIdx = -1; c.vy = 1; c.vx = 0;
          }
        } else {
          c.vy = Math.min(c.vy + 0.6, 14);
          c.y += c.vy;
          for (let pi = 0; pi < gs.activePlats.length; pi++) {
            const p = gs.activePlats[pi];
            if (c.x > p.x && c.x < p.x + p.w &&
                c.y + COCO_R >= p.y && c.y + COCO_R <= p.y + COCO_R + 8 && c.vy > 0) {
              c.y = p.y - COCO_R; c.vy = 0;
              c.vx = ROLL_DIR[pi % ROLL_DIR.length] * spd; c.platIdx = pi;
              audioManager.playSound("coconut_bounce");
              break;
            }
          }
          if (c.y > CH + 30) cocoToRemove.push(ci);
        }

        // Jump-over bonus (rolling obstacles only)
        if (c.platIdx >= 0 && !gs.ponGround && !gs.ponLadder &&
            !gs.jumpedCocoIds.has(c.id) &&
            Math.abs(c.x - gs.px) < PW / 2 + COCO_R + 4 &&
            gs.py < c.y - COCO_R) {
          gs.jumpedCocoIds.add(c.id);
          gs.score += 100;
          setScore(gs.score);
          audioManager.playSound("bonus");
        }
      }

      // Player collision (shared for all level types)
      if (gs.pinvTimer === 0) {
        const r = levelType === 3 ? 8 : COCO_R;
        const dx = Math.abs(c.x - gs.px);
        const dy = Math.abs(c.y - (gs.py - PH / 2));
        if (dx < PW / 2 + r - 2 && dy < PH / 2 + r - 2) {
          if (gs.hasHammer) {
            cocoToRemove.push(ci);
            gs.score += 300;
            gs.explosions.push({ id: gs.explosionIdCtr++, x: c.x, y: c.y, frame: 0 });
            setScore(gs.score);
            audioManager.playSound("bonus");
          } else {
            audioManager.playSound("hit");
            loseLife(gs);
            return;
          }
        }
      }
    }

    for (let i = cocoToRemove.length - 1; i >= 0; i--) {
      gs.cocos.splice(cocoToRemove[i], 1);
    }

    // ── Okto movement (Level 3 wandering enemies) ─────────────────────────────
    if (gs.oktos.length > 0) {
      for (const o of gs.oktos) {
        const p = gs.activePlats[o.platIdx];
        o.x += o.vx;
        if (o.x < p.x + OKTO_R) { o.x = p.x + OKTO_R; o.vx = Math.abs(o.vx); }
        if (o.x > p.x + p.w - OKTO_R) { o.x = p.x + p.w - OKTO_R; o.vx = -Math.abs(o.vx); }

        if (gs.pinvTimer === 0) {
          const dx = Math.abs(o.x - gs.px);
          const dy = Math.abs(o.y - gs.py);
          if (dx < PW / 2 + OKTO_R && dy < PH / 2 + OKTO_R) {
            if (gs.hasHammer) {
              gs.oktos = gs.oktos.filter(oo => oo.id !== o.id);
              gs.score += 300;
              gs.explosions.push({ id: gs.explosionIdCtr++, x: o.x, y: o.y, frame: 0 });
              setScore(gs.score);
              audioManager.playSound("bonus");
            } else {
              audioManager.playSound("hit");
              loseLife(gs);
              return;
            }
          }
        }
      }
    }
  }

  function loseLife(gs: GS) {
    gs.lives--;
    setLives(gs.lives);
    if (gs.lives <= 0) {
      audioManager.playSound("game_over");
      audioManager.stopMusic();
      gs.phase = "GAME_OVER";
      gs.phaseTimer = 9999;
      setPhase("GAME_OVER");
      saveHighScore(gs);
    } else {
      audioManager.playSound("life_lost");
      gs.phase = "LIFE_LOST";
      gs.phaseTimer = 90; // 1.5s
      setPhase("LIFE_LOST");
    }
  }

  async function saveHighScore(gs: GS) {
    if (savedRef.current) return;
    savedRef.current = true;
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const snap = await getDoc(doc(db, "users", uid));
    const prev = snap.data()?.strandturmHighScore ?? 0;
    const prevLvl = snap.data()?.strandturmBestLevel ?? 0;
    const updates: Record<string, number> = {};
    if (gs.score > prev) updates.strandturmHighScore = gs.score;
    if (gs.level > prevLvl) updates.strandturmBestLevel = gs.level;
    if (Object.keys(updates).length > 0) {
      await updateDoc(doc(db, "users", uid), updates);
    }
  }

  // ── Draw ──────────────────────────────────────────────────────────────────
  function draw(gs: GS) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    // Background
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, CW, CH);

    // Subtle ocean gradient at bottom
    const grad = ctx.createLinearGradient(0, CH - 60, 0, CH);
    grad.addColorStop(0, "rgba(14,165,233,0)");
    grad.addColorStop(1, "rgba(14,165,233,0.15)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, CH - 60, CW, 60);

    // Platforms
    for (const p of gs.activePlats) drawPlat(ctx, p);

    // Conveyor belts (overlaid on platform surface, under ladders – Level 2 mechanic)
    for (const belt of gs.conveyorBelts) drawConveyorBelt(ctx, belt, gs.totalFrame);

    // Elevator shafts + moving platforms (Level 3 mechanic)
    for (const el of gs.elevators) drawElevatorTrack(ctx, el);
    for (const el of gs.elevators) drawElevator(ctx, el);

    // Ladders
    for (const l of gs.activeLadders) drawLadder(ctx, l);

    // Goal
    drawGoal(ctx, gs.activePlats[gs.activePlats.length - 1].y);

    // Hammer pickups (floated above platform – jump to reach)
    for (let hi = 0; hi < gs.activeHammerDefs.length; hi++) {
      if (!gs.hammerPickups[hi]) {
        const h = gs.activeHammerDefs[hi];
        drawHammerPickup(ctx, h.x, gs.activePlats[h.platIdx].y - HAMMER_FLOAT);
      }
    }

    // Seelöwe
    drawSeeloewe(ctx, gs.totalFrame, gs.activePlats[gs.activePlats.length - 1].y);

    // Obstacles (coconuts in L1, cement troughs in L2, iron weights in L3)
    const lt = getLevelType(gs.level);
    for (const c of gs.cocos) {
      if (lt === 2) drawWanne(ctx, c);
      else if (lt === 3) drawWeight(ctx, c);
      else drawCoco(ctx, c);
    }

    // Okto enemies (Level 3)
    for (const o of gs.oktos) drawOkto(ctx, o);

    // Explosions (above coconuts, below player)
    for (const e of gs.explosions) drawExplosion(ctx, e);

    // Player
    drawPlayer(ctx, gs);

    // HUD on canvas
    drawHUD(ctx, gs);

    // Phase overlays
    drawOverlay(ctx, gs);
  }

  // ── RAF loop ──────────────────────────────────────────────────────────────
  const loop = useCallback((ts: number) => {
    void ts;
    const gs = gsRef.current;
    if (!paused || gs.phase !== "PLAYING") {
      step(gs);
    }
    draw(gs);
    rafRef.current = requestAnimationFrame(loop);
  }, [paused]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    audioManager.startMusic("strandturm");
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      audioManager.stopMusic();
    };
  }, [loop]);

  // ── Keyboard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    function onDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft"  || e.key === "a") leftRef.current  = true;
      if (e.key === "ArrowRight" || e.key === "d") rightRef.current = true;
      if (e.key === "ArrowUp"    || e.key === "w") { upRef.current = true; jumpPressRef.current = true; }
      if (e.key === "ArrowDown"  || e.key === "s") downRef.current = true;
      if (e.key === "p" || e.key === "Escape") togglePause();
    }
    function onUp(e: KeyboardEvent) {
      if (e.key === "ArrowLeft"  || e.key === "a") leftRef.current  = false;
      if (e.key === "ArrowRight" || e.key === "d") rightRef.current = false;
      if (e.key === "ArrowUp"    || e.key === "w") upRef.current   = false;
      if (e.key === "ArrowDown"  || e.key === "s") downRef.current  = false;
    }
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function togglePause() {
    const gs = gsRef.current;
    if (gs.phase !== "PLAYING") return;
    setPaused((p) => !p);
  }

  // ── Touch controls (TOUCH mode) ───────────────────────────────────────────
  const touchRef = useRef<{ id: number; side: "left" | "right" | "jump" }[]>([]);

  function onCanvasTouchStart(e: React.TouchEvent) {
    if (controlMode !== "TOUCH") return;
    e.preventDefault();
    const rect = canvasRef.current!.getBoundingClientRect();
    const scaleX = CW / rect.width;
    for (const t of Array.from(e.changedTouches)) {
      const lx = (t.clientX - rect.left) * scaleX;
      const ly = (t.clientY - rect.top) * (CH / rect.height);
      if (ly < CH * 0.35) {
        // Top area = jump
        jumpPressRef.current = true; upRef.current = true;
        touchRef.current.push({ id: t.identifier, side: "jump" });
      } else if (lx < CW / 2) {
        leftRef.current = true;
        touchRef.current.push({ id: t.identifier, side: "left" });
      } else {
        rightRef.current = true;
        touchRef.current.push({ id: t.identifier, side: "right" });
      }
    }
  }

  function onCanvasTouchEnd(e: React.TouchEvent) {
    if (controlMode !== "TOUCH") return;
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      const idx = touchRef.current.findIndex((x) => x.id === t.identifier);
      if (idx >= 0) {
        const { side } = touchRef.current[idx];
        touchRef.current.splice(idx, 1);
        if (side === "left"  && !touchRef.current.some((x) => x.side === "left"))  leftRef.current  = false;
        if (side === "right" && !touchRef.current.some((x) => x.side === "right")) rightRef.current = false;
        if (side === "jump"  && !touchRef.current.some((x) => x.side === "jump"))  upRef.current    = false;
      }
    }
  }

  // ── Navigate to results ───────────────────────────────────────────────────
  function goResults() {
    const gs = gsRef.current;
    navigate("/strandturm/results", {
      state: { score: gs.score, level: gs.level },
    });
  }

  // ── Button style ──────────────────────────────────────────────────────────
  const btnS: React.CSSProperties = {
    width: 56, height: 56, fontSize: 20,
    border: "1px solid var(--border)", background: "var(--surface2)",
    borderRadius: 10, cursor: "pointer", color: "var(--text)",
    display: "flex", alignItems: "center", justifyContent: "center",
    userSelect: "none", touchAction: "none",
  };

  const gs = gsRef.current;

  return (
    <div className="screen" style={{ gap: 0, padding: 0, alignItems: "center" }}>
      {/* Canvas */}
      <div
        style={{ position: "relative", width: CW, maxWidth: "100%" }}
        onTouchStart={onCanvasTouchStart}
        onTouchEnd={onCanvasTouchEnd}
      >
        <canvas
          ref={canvasRef}
          width={CW} height={CH}
          style={{ display: "block", width: "100%", touchAction: "none" }}
        />

        {paused && !isOver && (
          <div style={{
            position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{
              background: "var(--surface)", borderRadius: 16, padding: "24px 32px",
              textAlign: "center", border: "1px solid var(--border)",
            }}>
              <div style={{ fontSize: 36 }}>⏸</div>
              <div style={{ fontWeight: 800, fontSize: 18, marginTop: 8 }}>Pause</div>
              <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>Drücke ⏸ zum Weiterspielen</div>
            </div>
          </div>
        )}

        {isOver && (
          <div style={{
            position: "absolute", inset: 0, background: "rgba(0,0,0,0.75)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{
              background: "var(--surface)", borderRadius: 16, padding: "24px 28px",
              textAlign: "center", width: 280,
              border: `1.5px solid rgba(220,38,38,0.4)`,
            }}>
              <div style={{ fontSize: 40 }}>🗼</div>
              <div style={{ fontWeight: 800, fontSize: 18, marginTop: 8 }}>Game Over</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: RED, marginTop: 12 }}>{score}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Punkte · Level {gs.level}</div>
              <button
                onClick={goResults}
                style={{
                  marginTop: 16, width: "100%", padding: "12px 0",
                  background: RED, color: "#fff", fontWeight: 700,
                  border: "none", borderRadius: 10, cursor: "pointer", fontSize: 15,
                }}
              >
                Weiter →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* HUD */}
      <GameHudBar
        paused={paused}
        onPauseToggle={togglePause}
        onQuit={() => {
          if (isOver) { navigate("/strandturm/lobby"); return; }
          setPaused(true); setQuit(true);
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 700, color: RED }}>{score}</span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Pts</span>
        <div style={{ width: 1, height: 14, background: "var(--border)", margin: "0 4px" }} />
        <span style={{ fontSize: 14, fontWeight: 700 }}>Lv.{gs.level}</span>
        <div style={{ width: 1, height: 14, background: "var(--border)", margin: "0 4px" }} />
        <span style={{ fontSize: 12 }}>{[0,1,2].map(i => i < lives ? "❤️" : "🖤").join("")}</span>
        <div style={{ width: 1, height: 14, background: "var(--border)", margin: "0 4px" }} />
        <span style={{ fontSize: 11, color: bonusTimer < 1000 ? RED : "var(--text-muted)" }}>⏱{bonusTimer}</span>
      </GameHudBar>

      {/* D-Pad (BUTTONS mode) */}
      {controlMode === "BUTTONS" && !isOver && (
        <div style={{ padding: "10px 0" }}>
          {/* Row 1: up */}
          <div style={{ display: "flex", justifyContent: "center", gap: 4, marginBottom: 4 }}>
            <div style={{ width: 56 }} />
            <button
              style={btnS}
              onPointerDown={() => { upRef.current = true; jumpPressRef.current = true; }}
              onPointerUp={() => { upRef.current = false; }}
              onPointerLeave={() => { upRef.current = false; }}
            >▲</button>
            <div style={{ width: 56 }} />
          </div>
          {/* Row 2: left / right */}
          <div style={{ display: "flex", justifyContent: "center", gap: 4, marginBottom: 4 }}>
            <button
              style={btnS}
              onPointerDown={() => { leftRef.current = true; }}
              onPointerUp={() => { leftRef.current = false; }}
              onPointerLeave={() => { leftRef.current = false; }}
            >◄</button>
            <div style={{ width: 56 }} />
            <button
              style={btnS}
              onPointerDown={() => { rightRef.current = true; }}
              onPointerUp={() => { rightRef.current = false; }}
              onPointerLeave={() => { rightRef.current = false; }}
            >►</button>
          </div>
          {/* Row 3: down */}
          <div style={{ display: "flex", justifyContent: "center", gap: 4 }}>
            <div style={{ width: 56 }} />
            <button
              style={btnS}
              onPointerDown={() => { downRef.current = true; }}
              onPointerUp={() => { downRef.current = false; }}
              onPointerLeave={() => { downRef.current = false; }}
            >▼</button>
            <div style={{ width: 56 }} />
          </div>
        </div>
      )}

      {/* SPLIT layout: ◄ ► left side, ▲ ▼ right side – two-handed play */}
      {controlMode === "SPLIT" && !isOver && (
        <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 20px", width: "100%", boxSizing: "border-box" }}>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              style={{ ...btnS, width: 76, height: 68, fontSize: 24 }}
              onPointerDown={() => { leftRef.current = true; }}
              onPointerUp={() => { leftRef.current = false; }}
              onPointerLeave={() => { leftRef.current = false; }}
            >◄</button>
            <button
              style={{ ...btnS, width: 76, height: 68, fontSize: 24 }}
              onPointerDown={() => { rightRef.current = true; }}
              onPointerUp={() => { rightRef.current = false; }}
              onPointerLeave={() => { rightRef.current = false; }}
            >►</button>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              style={{ ...btnS, width: 76, height: 68, fontSize: 24 }}
              onPointerDown={() => { upRef.current = true; jumpPressRef.current = true; }}
              onPointerUp={() => { upRef.current = false; }}
              onPointerLeave={() => { upRef.current = false; }}
            >▲</button>
            <button
              style={{ ...btnS, width: 76, height: 68, fontSize: 24 }}
              onPointerDown={() => { downRef.current = true; }}
              onPointerUp={() => { downRef.current = false; }}
              onPointerLeave={() => { downRef.current = false; }}
            >▼</button>
          </div>
        </div>
      )}

      {controlMode === "TOUCH" && !isOver && (
        <div style={{ padding: "8px 0", fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
          Links / Rechts tippen · Oben tippen = Springen / Klettern
        </div>
      )}

      {quitDialog && (
        <QuitConfirmDialog
          message={`Score: ${score} Pts · Level ${gs.level}. Fortschritt geht verloren.`}
          onConfirm={() => navigate("/strandturm/lobby")}
          onDismiss={() => { setQuit(false); setPaused(false); }}
        />
      )}
    </div>
  );
}
