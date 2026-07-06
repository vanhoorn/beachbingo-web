import { useEffect, useRef, useCallback, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../../firebase";
import type { PiratesDifficulty } from "../../types";

// ── Canvas dimensions ─────────────────────────────────────────────────────────
const CW = 400;
const CH = 580;

// ── Invader layout ────────────────────────────────────────────────────────────
const INVADER_COLS  = 7;
const INVADER_ROWS  = 4;
const INVADER_W     = 40;
const INVADER_H     = 36;
const INVADER_PAD_X = 10;
const INVADER_PAD_Y = 8;
const INVADER_TOP   = 40;

// ── Player ────────────────────────────────────────────────────────────────────
const PLAYER_Y     = CH - 48;
const PLAYER_W     = 44;
const PLAYER_SPEED = 4.5;

// ── Bullets ───────────────────────────────────────────────────────────────────
const BULLET_W          = 4;
const BULLET_H          = 14;
const PLAYER_BULLET_SPD = 8;
const ENEMY_BULLET_SPD  = 4;
const MAX_PLAYER_BULLETS = 3;

// ── Shields (pixel-block system) ─────────────────────────────────────────────
const BLK      = 4;
const S_COLS   = 12;
const S_ROWS   = 8;
const SHIELD_Y = CH - 140;
const ERASE_R  = 2;

// ── Emojis ────────────────────────────────────────────────────────────────────
const EMOJIS_BY_ROW = ["🪼", "🐚", "🐟", "🦀"];
const PLAYER_EMOJI  = "🐙";

// ── Difficulty ────────────────────────────────────────────────────────────────
interface DiffConfig {
  baseMoveInterval: number;
  stepSize: number;
  shootChance: number;
}
// Speed / firing on a 1–30 scale → physics values
// interval(s) = 93 - s*3  |  stepSize(s) = 4 + s*0.4
// shootChance(f) = 0.0001 + (f-1)*0.000165
const BASE_SPEED:  Record<PiratesDifficulty, number> = { ROOKIE: 3, SNIPER: 6, BOSS_LEVEL: 10 };
const BASE_FIRING: Record<PiratesDifficulty, number> = { ROOKIE: 3, SNIPER: 6, BOSS_LEVEL: 10 };

// Cumulative wave bonus: waves 2–5 add +1 each, waves 6+ add +2 each
function waveBonus(wave: number): number {
  if (wave <= 1) return 0;
  return Math.min(wave - 1, 4) + Math.max(0, wave - 5) * 2;
}

function diffFromScales(speed: number, firing: number): DiffConfig {
  const s = Math.min(30, Math.max(1, speed));
  const f = Math.min(30, Math.max(1, firing));
  return {
    baseMoveInterval: Math.max(4, Math.round(93 - s * 3)),
    stepSize: Math.max(4, Math.round(4 + s * 0.4)),
    shootChance: 0.0001 + (f - 1) * 0.000165,
  };
}

function fireCooldownFrames(rate: number) {
  return Math.round(55 - rate * 5);
}

const POINTS_BY_ROW = [40, 30, 20, 10];

// ── Types ─────────────────────────────────────────────────────────────────────
interface Invader { col: number; row: number; x: number; y: number; alive: boolean; }
interface Bullet  { x: number; y: number; dy: number; }
interface Shield  { x: number; blocks: boolean[]; }

// ── Shield helpers ────────────────────────────────────────────────────────────
function makeShields(): Shield[] {
  const xs = [44, 140, 248, 344];
  return xs.map((x) => {
    const blocks = new Array(S_ROWS * S_COLS).fill(true);
    const archColStart = Math.floor(S_COLS / 2) - 2;
    const archColEnd   = archColStart + 4;
    for (let r = S_ROWS - 3; r < S_ROWS; r++) {
      for (let c = archColStart; c < archColEnd; c++) {
        blocks[r * S_COLS + c] = false;
      }
    }
    return { x, blocks };
  });
}

function shieldBlockAt(sh: Shield, bx: number, by: number): boolean {
  const lx = bx - sh.x;
  const ly = by - SHIELD_Y;
  if (lx < 0 || lx >= S_COLS * BLK || ly < 0 || ly >= S_ROWS * BLK) return false;
  return sh.blocks[Math.floor(ly / BLK) * S_COLS + Math.floor(lx / BLK)];
}

function erodeShield(sh: Shield, bx: number, by: number) {
  const bc = Math.floor((bx - sh.x) / BLK);
  const br = Math.floor((by - SHIELD_Y) / BLK);
  for (let r = br - ERASE_R; r <= br + ERASE_R; r++) {
    for (let c = bc - ERASE_R; c <= bc + ERASE_R; c++) {
      if (r >= 0 && r < S_ROWS && c >= 0 && c < S_COLS)
        sh.blocks[r * S_COLS + c] = false;
    }
  }
}

function drawShield(ctx: CanvasRenderingContext2D, sh: Shield) {
  for (let r = 0; r < S_ROWS; r++) {
    for (let c = 0; c < S_COLS; c++) {
      if (!sh.blocks[r * S_COLS + c]) continue;
      const shade = Math.floor(180 + r * 4);
      ctx.fillStyle = `rgb(${shade},${Math.floor(shade * 0.78)},${Math.floor(shade * 0.45)})`;
      ctx.fillRect(sh.x + c * BLK, SHIELD_Y + r * BLK, BLK - 1, BLK - 1);
    }
  }
}

// ── Game state ────────────────────────────────────────────────────────────────
interface GS {
  invaders: Invader[];
  playerX: number;
  playerBullets: Bullet[];
  fireCooldown: number;
  enemyBullets: Bullet[];
  shields: Shield[];
  groupX: number;
  groupDir: 1 | -1;
  moveTimer: number;
  moveInterval: number;
  score: number;
  lives: number;
  wave: number;
  diff: DiffConfig;
  phase: "playing" | "hit" | "wave_clear" | "game_over";
  phaseTimer: number;
  keys: { left: boolean; right: boolean };
}

function makeInvaders(wave: number, groupX: number): Invader[] {
  const invs: Invader[] = [];
  for (let r = 0; r < INVADER_ROWS; r++)
    for (let c = 0; c < INVADER_COLS; c++)
      invs.push({ col: c, row: r,
        x: groupX + c * (INVADER_W + INVADER_PAD_X),
        y: INVADER_TOP + Math.min(wave - 1, 4) * 8 + r * (INVADER_H + INVADER_PAD_Y),
        alive: true });
  return invs;
}

function initGS(diff: DiffConfig, wave: number, lives: number, score: number): GS {
  const groupX = (CW - INVADER_COLS * (INVADER_W + INVADER_PAD_X) + INVADER_PAD_X) / 2;
  return {
    invaders: makeInvaders(wave, groupX),
    playerX: CW / 2,
    playerBullets: [], fireCooldown: 0,
    enemyBullets: [],
    shields: makeShields(),
    groupX, groupDir: 1,
    moveTimer: 0, moveInterval: diff.baseMoveInterval,
    score, lives, wave, diff,
    phase: "playing", phaseTimer: 0,
    keys: { left: false, right: false },
  };
}

function rectHit(ax: number, ay: number, aw: number, ah: number,
                  bx: number, by: number, bw: number, bh: number) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function drawEmoji(ctx: CanvasRenderingContext2D, emoji: string, cx: number, cy: number, size: number) {
  ctx.font = `${size}px serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, cx, cy);
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function PiratesGameScreen() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const locState  = location.state as { difficulty?: PiratesDifficulty; fireRate?: number; controlMode?: "BUTTONS" | "TOUCH" } | null;
  const difficulty    = locState?.difficulty  ?? "ROOKIE";
  const fireRate      = locState?.fireRate    ?? 5;
  const controlMode   = locState?.controlMode ?? "BUTTONS";
  const fireCooldownMax = fireCooldownFrames(fireRate);

  function waveDiff(wave: number): DiffConfig {
    const bonus = waveBonus(wave);
    return diffFromScales(
      BASE_SPEED[difficulty]  + bonus,
      BASE_FIRING[difficulty] + bonus,
    );
  }

  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const gsRef         = useRef<GS>(initGS(waveDiff(1), 1, 3, 0));
  const rafRef        = useRef<number>(0);
  const resultWritten = useRef(false);
  const pausedRef     = useRef(false);
  const uid           = auth.currentUser?.uid;

  const touchLeft  = useRef(false);
  const touchRight = useRef(false);

  const [uiScore,  setUiScore]  = useState(0);
  const [uiLives,  setUiLives]  = useState(3);
  const [uiWave,   setUiWave]   = useState(1);
  const [uiPhase,  setUiPhase]  = useState<GS["phase"]>("playing");
  const [uiSpeed,  setUiSpeed]  = useState(BASE_SPEED[difficulty]);
  const [uiFiring, setUiFiring] = useState(BASE_FIRING[difficulty]);
  const [paused,  setPaused]            = useState(false);
  const [showQuitDialog, setShowQuitDialog] = useState(false);

  // Keep pausedRef in sync (game loop reads ref, not state)
  function setPausedSync(val: boolean) {
    pausedRef.current = val;
    setPaused(val);
  }

  const saveResult = useCallback(async (finalScore: number, finalWave: number) => {
    if (resultWritten.current || !uid) return;
    resultWritten.current = true;
    const userRef = doc(db, "users", uid);
    const snap    = await getDoc(userRef);
    const data    = snap.exists() ? snap.data() : {};
    const scores  = (data.piratesHighScores ?? {}) as Record<string, number>;
    const prev    = scores[difficulty] ?? 0;
    const newHS   = Math.max(prev, finalScore);
    await updateDoc(userRef, { [`piratesHighScores.${difficulty}`]: newHS });
    navigate("/pirates/results", {
      state: { score: finalScore, wave: finalWave, difficulty, highScore: newHS, newHighScore: finalScore > prev },
      replace: true,
    });
  }, [uid, difficulty, navigate]);

  // ── Game loop ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    function tick() {
      const gs = gsRef.current;

      // Skip physics when paused (but still draw so canvas stays alive)
      if (!pausedRef.current) {
        update(gs);
      }

      draw(ctx, gs, pausedRef.current);
      setUiScore(gs.score);
      setUiLives(gs.lives);
      setUiWave(gs.wave);
      setUiPhase(gs.phase);
      const bonus = waveBonus(gs.wave);
      setUiSpeed(Math.min(30, BASE_SPEED[difficulty]  + bonus));
      setUiFiring(Math.min(30, BASE_FIRING[difficulty] + bonus));

      if (gs.phase === "game_over" && gs.phaseTimer > 120) {
        saveResult(gs.score, gs.wave);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [saveResult]);

  // ── Physics update ────────────────────────────────────────────────────────────
  function update(gs: GS) {
    if (gs.phase === "hit") {
      gs.phaseTimer++;
      if (gs.phaseTimer > 90) {
        gs.phase = "playing"; gs.phaseTimer = 0;
        gs.playerBullets = []; gs.enemyBullets = []; gs.fireCooldown = 0;
      }
      return;
    }
    if (gs.phase === "wave_clear") {
      gs.phaseTimer++;
      if (gs.phaseTimer > 90) {
        const nextWave = gs.wave + 1;
        const next = initGS(waveDiff(nextWave), nextWave, gs.lives, gs.score);
        next.keys = gs.keys;
        gsRef.current = next;
      }
      return;
    }
    if (gs.phase === "game_over") { gs.phaseTimer++; return; }

    // Player movement
    const goLeft  = gs.keys.left  || touchLeft.current;
    const goRight = gs.keys.right || touchRight.current;
    if (goLeft)  gs.playerX = Math.max(PLAYER_W / 2, gs.playerX - PLAYER_SPEED);
    if (goRight) gs.playerX = Math.min(CW - PLAYER_W / 2, gs.playerX + PLAYER_SPEED);

    // Dauerfeuer
    if (gs.fireCooldown > 0) gs.fireCooldown--;
    if (gs.fireCooldown === 0 && gs.playerBullets.length < MAX_PLAYER_BULLETS) {
      gs.playerBullets.push({ x: gs.playerX, y: PLAYER_Y - PLAYER_W / 2, dy: -PLAYER_BULLET_SPD });
      gs.fireCooldown = fireCooldownMax;
    }

    // Player bullets
    for (let i = gs.playerBullets.length - 1; i >= 0; i--) {
      const pb = gs.playerBullets[i];
      pb.y += pb.dy;
      if (pb.y < -BULLET_H) { gs.playerBullets.splice(i, 1); continue; }
      let hit = false;
      for (const inv of gs.invaders) {
        if (!inv.alive) continue;
        const ix = gs.groupX + inv.col * (INVADER_W + INVADER_PAD_X);
        if (rectHit(pb.x - BULLET_W / 2, pb.y, BULLET_W, BULLET_H, ix, inv.y, INVADER_W, INVADER_H)) {
          inv.alive = false; gs.score += POINTS_BY_ROW[inv.row];
          gs.playerBullets.splice(i, 1); hit = true; break;
        }
      }
      if (hit) continue;
      for (const sh of gs.shields) {
        if (shieldBlockAt(sh, pb.x, pb.y)) {
          erodeShield(sh, pb.x, pb.y); gs.playerBullets.splice(i, 1); break;
        }
      }
    }

    // Invader movement
    gs.moveTimer++;
    const aliveCount  = gs.invaders.filter((i) => i.alive).length;
    const speedFactor = Math.max(0.2, aliveCount / (INVADER_COLS * INVADER_ROWS));
    gs.moveInterval   = Math.max(4, Math.round(gs.diff.baseMoveInterval * speedFactor));
    if (gs.moveTimer >= gs.moveInterval) {
      gs.moveTimer = 0;
      let minCol = INVADER_COLS, maxCol = -1;
      for (const inv of gs.invaders) {
        if (!inv.alive) continue;
        if (inv.col < minCol) minCol = inv.col;
        if (inv.col > maxCol) maxCol = inv.col;
      }
      const leftEdge  = gs.groupX + minCol * (INVADER_W + INVADER_PAD_X);
      const rightEdge = gs.groupX + maxCol * (INVADER_W + INVADER_PAD_X) + INVADER_W;
      if (gs.groupDir === 1 && rightEdge + gs.diff.stepSize > CW - 4) {
        gs.groupDir = -1;
        for (const inv of gs.invaders) inv.y += INVADER_H * 0.6;
      } else if (gs.groupDir === -1 && leftEdge - gs.diff.stepSize < 4) {
        gs.groupDir = 1;
        for (const inv of gs.invaders) inv.y += INVADER_H * 0.6;
      } else {
        gs.groupX += gs.groupDir * gs.diff.stepSize;
      }
    }

    // Enemy shooting
    const aliveInvaders = gs.invaders.filter((i) => i.alive);
    for (const inv of aliveInvaders) {
      if (Math.random() < gs.diff.shootChance) {
        gs.enemyBullets.push({
          x: gs.groupX + inv.col * (INVADER_W + INVADER_PAD_X) + INVADER_W / 2,
          y: inv.y + INVADER_H, dy: ENEMY_BULLET_SPD,
        });
      }
    }

    // Enemy bullets
    for (let i = gs.enemyBullets.length - 1; i >= 0; i--) {
      const eb = gs.enemyBullets[i];
      eb.y += eb.dy;
      if (eb.y > CH + BULLET_H) { gs.enemyBullets.splice(i, 1); continue; }
      let shHit = false;
      for (const sh of gs.shields) {
        if (shieldBlockAt(sh, eb.x, eb.y + BULLET_H)) {
          erodeShield(sh, eb.x, eb.y + BULLET_H); gs.enemyBullets.splice(i, 1); shHit = true; break;
        }
      }
      if (shHit) continue;
      if (rectHit(eb.x - BULLET_W / 2, eb.y, BULLET_W, BULLET_H,
                  gs.playerX - PLAYER_W / 2, PLAYER_Y - PLAYER_W / 2, PLAYER_W, PLAYER_W)) {
        gs.lives--;
        gs.enemyBullets.splice(i, 1);
        gs.phase = gs.lives <= 0 ? "game_over" : "hit";
        gs.phaseTimer = 0;
        break;
      }
    }

    // Invaders reached bottom?
    for (const inv of gs.invaders) {
      if (!inv.alive) continue;
      if (inv.y + INVADER_H >= PLAYER_Y - PLAYER_W / 2) {
        gs.lives = 0; gs.phase = "game_over"; gs.phaseTimer = 0; break;
      }
    }

    // Wave clear?
    if (gs.phase === "playing" && aliveInvaders.length === 0) {
      gs.phase = "wave_clear"; gs.phaseTimer = 0;
    }
  }

  // ── Draw ──────────────────────────────────────────────────────────────────────
  function draw(ctx: CanvasRenderingContext2D, gs: GS, isPaused: boolean) {
    const grad = ctx.createLinearGradient(0, 0, 0, CH);
    grad.addColorStop(0,   "#07072a");
    grad.addColorStop(0.6, "#0a1628");
    grad.addColorStop(1,   "#1a3a1a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CW, CH);

    ctx.fillStyle = "rgba(255,255,255,0.55)";
    for (let s = 0; s < 35; s++)
      ctx.fillRect((s * 137 + 17) % CW, (s * 239 + 7) % Math.round(CH * 0.5), 1.5, 1.5);

    for (const inv of gs.invaders) {
      if (!inv.alive) continue;
      drawEmoji(ctx, EMOJIS_BY_ROW[inv.row],
        gs.groupX + inv.col * (INVADER_W + INVADER_PAD_X) + INVADER_W / 2,
        inv.y + INVADER_H / 2, 22);
    }

    for (const sh of gs.shields) drawShield(ctx, sh);

    ctx.shadowColor = "#a855f7"; ctx.shadowBlur = 8; ctx.fillStyle = "#c084fc";
    for (const pb of gs.playerBullets) ctx.fillRect(pb.x - BULLET_W / 2, pb.y, BULLET_W, BULLET_H);
    ctx.shadowBlur = 0;

    ctx.shadowColor = "#f97316"; ctx.shadowBlur = 6; ctx.fillStyle = "#fb923c";
    for (const eb of gs.enemyBullets) ctx.fillRect(eb.x - BULLET_W / 2, eb.y, BULLET_W, BULLET_H);
    ctx.shadowBlur = 0;

    if (gs.phase === "hit" && Math.floor(gs.phaseTimer / 8) % 2 === 0)
      drawEmoji(ctx, "💥", gs.playerX, PLAYER_Y, 36);
    else
      drawEmoji(ctx, PLAYER_EMOJI, gs.playerX, PLAYER_Y, 36);

    if (gs.phase === "wave_clear") {
      ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(0, 0, CW, CH);
      ctx.fillStyle = "#f59e0b"; ctx.font = "bold 26px sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(`🌊 Welle ${gs.wave} geschafft!`, CW / 2, CH / 2 - 16);
      ctx.font = "16px sans-serif"; ctx.fillStyle = "#e2e8f0";
      ctx.fillText("Nächste Welle…", CW / 2, CH / 2 + 18);
    }
    if (gs.phase === "game_over") {
      ctx.fillStyle = "rgba(0,0,0,0.65)"; ctx.fillRect(0, 0, CW, CH);
      ctx.fillStyle = "#ef4444"; ctx.font = "bold 30px sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("💀 Game Over", CW / 2, CH / 2 - 20);
      ctx.font = "20px sans-serif"; ctx.fillStyle = "#e2e8f0";
      ctx.fillText(`Score: ${gs.score}`, CW / 2, CH / 2 + 18);
    }

    // Pause overlay
    if (isPaused && gs.phase !== "game_over") {
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(0, 0, CW, CH);
      ctx.fillStyle = "#a855f7"; ctx.font = "bold 32px sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("⏸ Pause", CW / 2, CH / 2 - 16);
      ctx.font = "15px sans-serif"; ctx.fillStyle = "#94a3b8";
      ctx.fillText("Weiter-Button drücken zum Fortsetzen", CW / 2, CH / 2 + 22);
    }
  }

  // ── Keyboard events ────────────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent, down: boolean) {
      const gs = gsRef.current;
      if (e.key === "ArrowLeft"  || e.key === "a") gs.keys.left  = down;
      if (e.key === "ArrowRight" || e.key === "d") gs.keys.right = down;
      if (e.key === " ") e.preventDefault();
      // Escape or P = pause toggle
      if (down && (e.key === "Escape" || e.key === "p" || e.key === "P")) {
        pausedRef.current = !pausedRef.current;
        setPaused(pausedRef.current);
      }
    }
    const kd = (e: KeyboardEvent) => onKey(e, true);
    const ku = (e: KeyboardEvent) => onKey(e, false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup",   ku);
    return () => { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); };
  }, []);

  // ── Touch control (TOUCH mode) ────────────────────────────────────────────────
  function handleCanvasPointer(e: React.PointerEvent<HTMLDivElement>, active: boolean) {
    if (controlMode !== "TOUCH") return;
    e.preventDefault();
    if (!active) { touchLeft.current = false; touchRight.current = false; return; }
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const relX = e.clientX - rect.left;
    touchLeft.current  = relX < rect.width / 2;
    touchRight.current = relX >= rect.width / 2;
  }

  // ── Button handlers (BUTTONS mode) ────────────────────────────────────────────
  function btnDown(dir: "left" | "right") { touchLeft.current  = dir === "left";  touchRight.current = dir === "right"; }
  function btnUp  (dir: "left" | "right") { if (dir === "left") touchLeft.current = false; else touchRight.current = false; }

  // ── Pause / Quit handlers ─────────────────────────────────────────────────────
  function handlePause() {
    if (uiPhase === "game_over") return;
    setPausedSync(!pausedRef.current);
  }
  function handleQuitRequest() {
    setPausedSync(true);       // pause while dialog is open
    setShowQuitDialog(true);
  }
  function handleQuitCancel() {
    setShowQuitDialog(false);
    setPausedSync(false);      // resume
  }
  function handleQuitConfirm() {
    navigate("/pirates/lobby");
  }

  const livesDisplay = Array.from({ length: 3 }, (_, i) => i < uiLives ? "🐙" : "💀").join(" ");

  const moveBtnStyle = (color: string): React.CSSProperties => ({
    flex: 1, height: 64,
    background: `${color}22`, border: `2px solid ${color}`,
    borderRadius: 14, fontSize: 28, cursor: "pointer",
    userSelect: "none", WebkitUserSelect: "none", touchAction: "none",
    color, display: "flex", alignItems: "center", justifyContent: "center",
  });

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      background: "#0a1628", minHeight: "100dvh", padding: "12px 16px 24px", gap: 12,
      position: "relative",
    }}>

      {/* HUD */}
      <div style={{
        width: "100%", maxWidth: CW,
        display: "flex", alignItems: "center", gap: 8,
        padding: "6px 8px",
        background: "rgba(255,255,255,0.05)", borderRadius: 10,
      }}>
        {/* Pause button */}
        <button
          onClick={handlePause}
          disabled={uiPhase === "game_over"}
          title="Pause (P)"
          style={{
            background: paused ? "rgba(168,85,247,0.2)" : "rgba(255,255,255,0.07)",
            border: `1.5px solid ${paused ? "#a855f7" : "rgba(255,255,255,0.15)"}`,
            borderRadius: 8, width: 38, height: 38, fontSize: 18,
            cursor: uiPhase === "game_over" ? "default" : "pointer",
            color: paused ? "#a855f7" : "#94a3b8",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, transition: "all 0.15s",
            opacity: uiPhase === "game_over" ? 0.4 : 1,
          }}
        >
          {paused ? "▶" : "⏸"}
        </button>

        {/* Score / Welle / Leben */}
        <div style={{ flex: 1, display: "flex", justifyContent: "space-around", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Score</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#a855f7" }}>{uiScore}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Welle</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--primary)" }}>{uiWave}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Leben</div>
            <div style={{ fontSize: 15 }}>{livesDisplay}</div>
          </div>
        </div>

        {/* Speed + Firing indicators */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
          {[
            { label: "⚡ Speed", value: uiSpeed,  color: "#f59e0b" },
            { label: "🔱 Feuer", value: uiFiring, color: "#a855f7" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 10, color: "var(--text-muted)", whiteSpace: "nowrap", width: 46 }}>{label}</span>
              <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${(value / 30) * 100}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.4s ease" }} />
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color, width: 24, textAlign: "right" }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Quit button */}
        <button
          onClick={handleQuitRequest}
          title="Spiel beenden"
          style={{
            background: "rgba(239,68,68,0.1)",
            border: "1.5px solid rgba(239,68,68,0.4)",
            borderRadius: 8, width: 38, height: 38, fontSize: 18,
            cursor: "pointer", color: "#ef4444",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, transition: "all 0.15s",
          }}
        >
          ✕
        </button>
      </div>

      {/* Canvas wrapper */}
      <div
        style={{ width: "100%", maxWidth: CW, touchAction: "none" }}
        onPointerDown={(e) => handleCanvasPointer(e, true)}
        onPointerMove={(e) => { if (e.buttons > 0) handleCanvasPointer(e, true); }}
        onPointerUp={(e)   => handleCanvasPointer(e, false)}
        onPointerLeave={(e) => handleCanvasPointer(e, false)}
      >
        <canvas
          ref={canvasRef}
          width={CW}
          height={CH}
          style={{ borderRadius: 12, border: "1px solid rgba(168,85,247,0.3)", maxWidth: "100%", display: "block" }}
        />
        {controlMode === "TOUCH" && !paused && (
          <div style={{
            display: "flex", justifyContent: "space-between",
            padding: "6px 8px 0",
            fontSize: 11, color: "rgba(168,85,247,0.6)", userSelect: "none",
          }}>
            <span>◀ Links tippen</span>
            <span>Rechts tippen ▶</span>
          </div>
        )}
      </div>

      {/* BUTTONS mode controls */}
      {controlMode === "BUTTONS" && (
        <div style={{ display: "flex", gap: 16, width: "100%", maxWidth: CW }}>
          <div
            style={moveBtnStyle("#0ea5e9")}
            onPointerDown={() => btnDown("left")}
            onPointerUp={() => btnUp("left")}
            onPointerLeave={() => btnUp("left")}
          >◀</div>
          <div
            style={moveBtnStyle("#f97316")}
            onPointerDown={() => btnDown("right")}
            onPointerUp={() => btnUp("right")}
            onPointerLeave={() => btnUp("right")}
          >▶</div>
        </div>
      )}

      {uiPhase === "game_over" && (
        <button className="btn btn-outline btn-sm" onClick={() => navigate("/pirates/lobby")}>
          ‹ Zurück zur Lobby
        </button>
      )}

      {/* ── Quit confirmation dialog ──────────────────────────────────────── */}
      {showQuitDialog && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.75)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 100,
          padding: "0 24px",
        }}>
          <div style={{
            background: "var(--surface)",
            border: "1.5px solid rgba(239,68,68,0.4)",
            borderRadius: "var(--radius)",
            padding: "28px 24px",
            width: "100%", maxWidth: 340,
            display: "flex", flexDirection: "column", gap: 16,
            textAlign: "center",
          }}>
            <div style={{ fontSize: 40 }}>🏳️</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
                Spiel wirklich beenden?
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
                Dein aktueller Fortschritt (Score: <strong style={{ color: "#a855f7" }}>{uiScore}</strong>) geht verloren.
                Du kommst zurück zur BeachPirates Seite.
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                onClick={handleQuitConfirm}
                style={{
                  background: "rgba(239,68,68,0.15)",
                  border: "1.5px solid #ef4444",
                  borderRadius: "var(--radius-sm)",
                  padding: "12px",
                  color: "#ef4444", fontWeight: 700, fontSize: 15,
                  cursor: "pointer",
                }}
              >
                Ja, Spiel beenden
              </button>
              <button
                onClick={handleQuitCancel}
                style={{
                  background: "rgba(168,85,247,0.15)",
                  border: "1.5px solid #a855f7",
                  borderRadius: "var(--radius-sm)",
                  padding: "12px",
                  color: "#a855f7", fontWeight: 700, fontSize: 15,
                  cursor: "pointer",
                }}
              >
                ▶ Weiterspielen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
