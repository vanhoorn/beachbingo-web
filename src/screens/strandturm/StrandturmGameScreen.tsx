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
const JUMP_VY    = -9.8;
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
  { cx: 25,  y1: 335, y2: 420 }, // L: P1→P2
  { cx: 355, y1: 250, y2: 335 }, // R: P2→P3
  { cx: 25,  y1: 165, y2: 250 }, // L: P3→P4
  { cx: 355, y1: 80,  y2: 165 }, // R: P4→P5
] as const;
const LADD_W = 18;

const GOAL_X = 340; // x-threshold on P5 to win
const MOEVE_X = 55, MOEVE_Y = 48; // Möwe center, above P5 left side

// Coconut roll directions per platform index (positive = right)
const ROLL_DIR = [-1, 1, -1, 1, -1, 1] as const;
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

// ── Types ──────────────────────────────────────────────────────────────────────
interface Coco {
  id: number; x: number; y: number;
  vx: number; vy: number;
  platIdx: number; // -1 = airborne
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
}

function makeGS(lvl = 1, lives = 3, score = 0): GS {
  return {
    px: 50, py: 505,
    pvx: 0, pvy: 0,
    ponGround: true, ponLadder: false, pladderIdx: -1,
    pfacing: 1, panimTick: 0, pinvTimer: 0,
    cocos: [], cocoIdCtr: 0, cocoSpawnAcc: 0,
    lives, score, level: lvl,
    bonusTimer: bonusForLevel(lvl), bonusTickAcc: 0,
    phase: "PLAYING", phaseTimer: 0, totalFrame: 0,
  };
}

// ── Drawing helpers ─────────────────────────────────────────────────────────────
function drawPlat(ctx: CanvasRenderingContext2D, p: typeof PLATS[number]) {
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

function drawLadder(ctx: CanvasRenderingContext2D, l: typeof LADDERS[number]) {
  ctx.strokeStyle = "#8b6534";
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(l.cx - LADD_W / 2 + 2, l.y1); ctx.lineTo(l.cx - LADD_W / 2 + 2, l.y2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(l.cx + LADD_W / 2 - 2, l.y1); ctx.lineTo(l.cx + LADD_W / 2 - 2, l.y2); ctx.stroke();
  ctx.lineWidth = 1.8;
  for (let ry = l.y2 - 9; ry >= l.y1 + 4; ry -= 11) {
    ctx.beginPath(); ctx.moveTo(l.cx - LADD_W / 2 + 3, ry); ctx.lineTo(l.cx + LADD_W / 2 - 3, ry); ctx.stroke();
  }
}

function drawMoeve(ctx: CanvasRenderingContext2D, frame: number) {
  const mx = MOEVE_X, my = MOEVE_Y;
  const wing = frame % 60 < 30 ? -6 : 0;
  // Body
  ctx.fillStyle = "#e2e8f0";
  ctx.beginPath(); ctx.ellipse(mx, my + 8, 20, 11, 0, 0, Math.PI * 2); ctx.fill();
  // Wings
  ctx.fillStyle = "#cbd5e1";
  ctx.beginPath();
  ctx.moveTo(mx - 5, my + 6);
  ctx.quadraticCurveTo(mx - 26, my + wing, mx - 36, my + 3 + wing);
  ctx.quadraticCurveTo(mx - 26, my + 10, mx - 5, my + 14); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(mx + 5, my + 6);
  ctx.quadraticCurveTo(mx + 26, my + wing, mx + 36, my + 3 + wing);
  ctx.quadraticCurveTo(mx + 26, my + 10, mx + 5, my + 14); ctx.fill();
  // Beak (right)
  ctx.fillStyle = "#f97316";
  ctx.beginPath(); ctx.moveTo(mx + 18, my + 7); ctx.lineTo(mx + 26, my + 4); ctx.lineTo(mx + 18, my + 13); ctx.fill();
  // Eye
  ctx.fillStyle = "#0f172a";
  ctx.beginPath(); ctx.arc(mx + 10, my + 5, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(mx + 11, my + 4.5, 0.9, 0, Math.PI * 2); ctx.fill();
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

function drawGoal(ctx: CanvasRenderingContext2D) {
  ctx.font = "24px serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("🛟", GOAL_X + 15, PLATS[5].y - 16);
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
  const state     = location.state as { controlMode?: "BUTTONS" | "TOUCH" } | null;
  const controlMode = state?.controlMode ?? "BUTTONS";

  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const rafRef     = useRef<number>(0);
  const gsRef      = useRef<GS>(makeGS());
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
          gs.phase = "PLAYING";
          setBonus(gs.bonusTimer); setPhase("PLAYING");
        }
      }
      return;
    }

    gs.totalFrame++;

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

    // ── Spawn coconut ─────────────────────────────────────────────────────────
    gs.cocoSpawnAcc++;
    if (gs.cocoSpawnAcc >= spawnInterval(gs.level)) {
      gs.cocoSpawnAcc = 0;
      const spd = cocoSpeed(gs.level);
      gs.cocos.push({
        id: gs.cocoIdCtr++,
        x: MOEVE_X + 35, y: PLATS[5].y - COCO_R,
        vx: spd, vy: 0,
        platIdx: 5,
      });
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
        for (let i = 0; i < LADDERS.length; i++) {
          const l = LADDERS[i];
          if (Math.abs(gs.px - l.cx) <= LADD_W / 2 + 4 && Math.abs(gs.py - l.y2) <= 8) {
            gs.ponLadder = true; gs.pladderIdx = i;
            gs.ponGround = false; gs.pvx = 0; gs.pvy = 0;
            break;
          }
        }
      }

      // Enter ladder from top (DOWN while on platform over a ladder)
      if (downRef.current && wasOnGround) {
        for (let i = 0; i < LADDERS.length; i++) {
          const l = LADDERS[i];
          if (Math.abs(gs.px - l.cx) <= LADD_W / 2 + 4 && Math.abs(gs.py - l.y1) <= 5) {
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
      for (let i = 0; i < PLATS.length; i++) {
        const p = PLATS[i];
        if (gs.px + PW / 2 > p.x && gs.px - PW / 2 < p.x + p.w) {
          if (gs.pvy >= 0 && prevPY <= p.y + 1 && gs.py >= p.y) {
            gs.py = p.y; gs.pvy = 0; gs.ponGround = true;
            if (!wasOnGround) audioManager.playSound("land");
            break;
          }
        }
      }
    }

    // ── Ladder exit ───────────────────────────────────────────────────────────
    if (gs.ponLadder && gs.pladderIdx >= 0) {
      const l = LADDERS[gs.pladderIdx];
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

    // ── Goal check (reached P5 right side) ───────────────────────────────────
    if (gs.py <= PLATS[5].y + 2 && gs.px >= GOAL_X && gs.phase === "PLAYING") {
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

    // ── Coconut physics ───────────────────────────────────────────────────────
    const spd = cocoSpeed(gs.level);
    const cocoToRemove: number[] = [];

    for (let ci = 0; ci < gs.cocos.length; ci++) {
      const c = gs.cocos[ci];

      if (c.platIdx >= 0) {
        // Rolling on platform
        const p = PLATS[c.platIdx];
        const rollVx = ROLL_DIR[c.platIdx] * spd;
        c.vx = rollVx;
        c.x += c.vx;
        c.y = p.y - COCO_R;

        // Check if fell off left or right edge
        if (c.x < p.x - COCO_R || c.x > p.x + p.w + COCO_R) {
          c.platIdx = -1; // now airborne
          c.vy = 1;
        }
      } else {
        // Airborne
        c.vy = Math.min(c.vy + 0.6, 14);
        c.x += c.vx * 0.4; // slight horizontal drift
        c.y += c.vy;

        // Land on a platform?
        for (let pi = c.platIdx === -1 ? 0 : 0; pi < PLATS.length; pi++) {
          const p = PLATS[pi];
          if (c.x > p.x && c.x < p.x + p.w) {
            if (c.y + COCO_R >= p.y && c.y + COCO_R <= p.y + COCO_R + 8 && c.vy > 0) {
              c.y = p.y - COCO_R;
              c.vy = 0;
              c.vx = ROLL_DIR[pi] * spd;
              c.platIdx = pi;
              audioManager.playSound("coconut_bounce");
              break;
            }
          }
        }

        // Off screen → remove
        if (c.y > CH + 30) cocoToRemove.push(ci);
      }

      // Player collision
      if (gs.pinvTimer === 0) {
        const dx = Math.abs(c.x - gs.px);
        const dy = Math.abs(c.y - (gs.py - PH / 2));
        if (dx < PW / 2 + COCO_R - 2 && dy < PH / 2 + COCO_R - 2) {
          audioManager.playSound("hit");
          loseLife(gs);
          return;
        }
      }
    }

    // Remove off-screen coconuts (reverse to preserve indices)
    for (let i = cocoToRemove.length - 1; i >= 0; i--) {
      gs.cocos.splice(cocoToRemove[i], 1);
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
    for (const p of PLATS) drawPlat(ctx, p);

    // Ladders
    for (const l of LADDERS) drawLadder(ctx, l);

    // Goal
    drawGoal(ctx);

    // Möwe
    drawMoeve(ctx, gs.totalFrame);

    // Coconuts
    for (const c of gs.cocos) drawCoco(ctx, c);

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
        <span style={{ fontSize: 12 }}>{"❤️".repeat(Math.max(0, lives))}</span>
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

      {controlMode === "TOUCH" && !isOver && (
        <div style={{ padding: "8px 0", fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
          Links / Rechts tippen · Oben tippen = Springen
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
