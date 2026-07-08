import { useEffect, useRef, useCallback, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../../firebase";
import type { WormDifficulty } from "../../types";
import { GameHudBar, QuitConfirmDialog } from "../../components/GameHudBar";

// ── Constants ─────────────────────────────────────────────────────────────────
const WORM_GREEN = "#22c55e";

const COLS = 20;
const ROWS = 20;
const CELL = 20;
const CW = COLS * CELL; // 400
const CH = ROWS * CELL; // 400

const WORM_COLOR      = WORM_GREEN;
const WORM_HEAD_COLOR = "#15803d";
const BG_COLOR        = "#0a1628";
const GRID_COLOR      = "rgba(30,48,80,0.9)";

// ── Food types (weighted) ─────────────────────────────────────────────────────
const FOOD_TYPES = [
  { emoji: "🦀", points: 10, weight: 60 },
  { emoji: "🐚", points: 20, weight: 30 },
  { emoji: "🐟", points: 30, weight: 10 },
] as const;

// ── Difficulty ────────────────────────────────────────────────────────────────
const STEP_MS: Record<WormDifficulty, number> = {
  ROOKIE:     150,
  SNIPER:     100,
  BOSS_LEVEL:  65,
};

// BOSS_LEVEL: walls wrap-around; others: walls kill
const WALLS_WRAP: Record<WormDifficulty, boolean> = {
  ROOKIE:     false,
  SNIPER:     false,
  BOSS_LEVEL: true,
};

interface Vec2  { x: number; y: number; }
interface Food  { x: number; y: number; emoji: string; points: number; }

function pickFoodType() {
  const r = Math.random() * 100;
  let acc = 0;
  for (const f of FOOD_TYPES) {
    acc += f.weight;
    if (r < acc) return f;
  }
  return FOOD_TYPES[0];
}

function spawnFood(snake: Vec2[]): Food {
  const occupied = new Set(snake.map((s) => `${s.x},${s.y}`));
  let x: number, y: number;
  do {
    x = Math.floor(Math.random() * COLS);
    y = Math.floor(Math.random() * ROWS);
  } while (occupied.has(`${x},${y}`));
  const { emoji, points } = pickFoodType();
  return { x, y, emoji, points };
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function WormGameScreen() {
  const navigate   = useNavigate();
  const location   = useLocation();
  const state      = location.state as { difficulty: WormDifficulty; controlMode: "BUTTONS" | "SWIPE" } | null;
  const difficulty  = state?.difficulty  ?? "ROOKIE";
  const controlMode = state?.controlMode ?? "BUTTONS";

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);

  // ── Game refs (no re-render) ──────────────────────────────────────────────
  const snakeRef    = useRef<Vec2[]>([{ x: 12, y: 10 }, { x: 11, y: 10 }, { x: 10, y: 10 }]);
  const dirRef      = useRef<Vec2>({ x: 1, y: 0 });
  const nextDirRef  = useRef<Vec2>({ x: 1, y: 0 });
  const foodRef     = useRef<Food>(spawnFood(snakeRef.current));
  const scoreRef    = useRef(0);
  const statusRef   = useRef<"PLAYING" | "PAUSED" | "DEAD">("PLAYING");
  const lastStepRef = useRef(0);
  const savedRef    = useRef(false);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [score, setScore]               = useState(0);
  const [length, setLength]             = useState(3);
  const [paused, setPaused]             = useState(false);
  const [dead, setDead]                 = useState(false);
  const [quitDialog, setQuitDialog]     = useState(false);
  const [finalHighScore, setFinalHS]    = useState(0);
  const [isNewHighScore, setIsNewHS]    = useState(false);

  const stepInterval = STEP_MS[difficulty];
  const wallsWrap    = WALLS_WRAP[difficulty];

  // ── Rendering ─────────────────────────────────────────────────────────────
  function draw() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, CW, CH);

    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= COLS; i++) {
      ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, CH); ctx.stroke();
    }
    for (let j = 0; j <= ROWS; j++) {
      ctx.beginPath(); ctx.moveTo(0, j * CELL); ctx.lineTo(CW, j * CELL); ctx.stroke();
    }

    // Snake segments
    const snake = snakeRef.current;
    snake.forEach((seg, i) => {
      ctx.fillStyle = i === 0 ? WORM_HEAD_COLOR : WORM_COLOR;
      const x = seg.x * CELL + 1;
      const y = seg.y * CELL + 1;
      const s = CELL - 2;
      const r = i === 0 ? 6 : 4;
      ctx.beginPath();
      (ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect(x, y, s, s, r);
      ctx.fill();
    });

    // Head eyes
    if (snake.length > 0) {
      const head = snake[0];
      const d = dirRef.current;
      const cx = head.x * CELL + CELL / 2;
      const cy = head.y * CELL + CELL / 2;
      ctx.fillStyle = "#fff";
      const eyeOff = 3.5;
      const eyeR = 2;
      if (d.x !== 0) {
        ctx.beginPath(); ctx.arc(cx + d.x * 2, cy - eyeOff, eyeR, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + d.x * 2, cy + eyeOff, eyeR, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(cx - eyeOff, cy + d.y * 2, eyeR, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + eyeOff, cy + d.y * 2, eyeR, 0, Math.PI * 2); ctx.fill();
      }
    }

    // Food
    const food = foodRef.current;
    ctx.font = `${CELL - 2}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(food.emoji, food.x * CELL + CELL / 2, food.y * CELL + CELL / 2 + 1);
  }

  // ── Step ──────────────────────────────────────────────────────────────────
  function step() {
    const snake = snakeRef.current;
    const dir = nextDirRef.current;
    dirRef.current = dir;

    let nx = snake[0].x + dir.x;
    let ny = snake[0].y + dir.y;

    if (wallsWrap) {
      nx = (nx + COLS) % COLS;
      ny = (ny + ROWS) % ROWS;
    } else {
      if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) {
        handleDeath();
        return;
      }
    }

    if (snake.some((s) => s.x === nx && s.y === ny)) {
      handleDeath();
      return;
    }

    const newHead = { x: nx, y: ny };
    const food = foodRef.current;

    if (nx === food.x && ny === food.y) {
      const bonus = 1 + Math.floor((snake.length - 3) / 10) * 0.1;
      const pts = Math.round(food.points * bonus);
      scoreRef.current += pts;
      const newSnake = [newHead, ...snake];
      snakeRef.current = newSnake;
      foodRef.current = spawnFood(newSnake);
      setScore(scoreRef.current);
      setLength(newSnake.length);
    } else {
      snakeRef.current = [newHead, ...snake.slice(0, -1)];
    }
  }

  // ── Death ─────────────────────────────────────────────────────────────────
  async function handleDeath() {
    if (savedRef.current) return;
    savedRef.current = true;
    statusRef.current = "DEAD";
    setDead(true);

    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const finalScore = scoreRef.current;
    const snap = await getDoc(doc(db, "users", uid));
    const scores = (snap.data()?.wormHighScores as Record<string, number>) ?? {};
    const prev = scores[difficulty] ?? 0;
    const isNew = finalScore > prev;

    if (isNew) {
      await updateDoc(doc(db, "users", uid), {
        [`wormHighScores.${difficulty}`]: finalScore,
      });
    }

    setFinalHS(Math.max(prev, finalScore));
    setIsNewHS(isNew);
  }

  // ── RAF loop ──────────────────────────────────────────────────────────────
  const loop = useCallback((ts: number) => {
    if (statusRef.current === "DEAD") {
      draw();
      return;
    }
    if (statusRef.current !== "PAUSED") {
      if (lastStepRef.current === 0) lastStepRef.current = ts;
      if (ts - lastStepRef.current >= stepInterval) {
        step();
        lastStepRef.current = ts;
      }
    }
    draw();
    rafRef.current = requestAnimationFrame(loop);
  }, [stepInterval]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [loop]);

  // ── Keyboard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const cur = dirRef.current;
      if ((e.key === "ArrowUp"    || e.key === "w") && cur.y !== 1)  nextDirRef.current = { x: 0, y: -1 };
      if ((e.key === "ArrowDown"  || e.key === "s") && cur.y !== -1) nextDirRef.current = { x: 0, y: 1 };
      if ((e.key === "ArrowLeft"  || e.key === "a") && cur.x !== 1)  nextDirRef.current = { x: -1, y: 0 };
      if ((e.key === "ArrowRight" || e.key === "d") && cur.x !== -1) nextDirRef.current = { x: 1, y: 0 };
      if (e.key === "p" || e.key === "Escape") togglePause();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Controls ──────────────────────────────────────────────────────────────
  function changeDir(dx: number, dy: number) {
    const cur = dirRef.current;
    if (dx !== 0 && cur.x === -dx) return;
    if (dy !== 0 && cur.y === -dy) return;
    nextDirRef.current = { x: dx, y: dy };
  }

  function togglePause() {
    if (statusRef.current === "DEAD") return;
    if (statusRef.current === "PLAYING") {
      statusRef.current = "PAUSED";
      setPaused(true);
    } else {
      statusRef.current = "PLAYING";
      setPaused(false);
      lastStepRef.current = 0;
    }
  }

  // ── Swipe ─────────────────────────────────────────────────────────────────
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (!touchStartRef.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;
    touchStartRef.current = null;
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
    if (Math.abs(dx) > Math.abs(dy)) changeDir(dx > 0 ? 1 : -1, 0);
    else changeDir(0, dy > 0 ? 1 : -1);
  }

  // ── Navigate to results ───────────────────────────────────────────────────
  function goToResults() {
    navigate("/worm/results", {
      state: {
        score: scoreRef.current,
        length: snakeRef.current.length,
        difficulty,
        controlMode,
        highScore: finalHighScore,
        newHighScore: isNewHighScore,
      },
    });
  }

  const btnStyle = {
    width: 56, height: 56, fontSize: 20, border: "1px solid var(--border)",
    background: "var(--surface2)", borderRadius: 10, cursor: "pointer",
    color: "var(--text)", display: "flex", alignItems: "center", justifyContent: "center",
  };

  return (
    <div className="screen" style={{ gap: 0, padding: 0, alignItems: "center" }}>
      {/* Canvas wrapper */}
      <div
        style={{ position: "relative", width: CW, maxWidth: "100%" }}
        onTouchStart={controlMode === "SWIPE" ? onTouchStart : undefined}
        onTouchEnd={controlMode === "SWIPE" ? onTouchEnd : undefined}
      >
        <canvas
          ref={canvasRef}
          width={CW}
          height={CH}
          style={{ display: "block", width: "100%", touchAction: "none" }}
        />

        {/* Pause overlay */}
        {paused && !dead && (
          <div style={{
            position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{
              background: "var(--surface)", borderRadius: 16, padding: "24px 32px",
              textAlign: "center", border: "1px solid var(--border)",
            }}>
              <div style={{ fontSize: 40 }}>⏸</div>
              <div style={{ fontWeight: 800, fontSize: 18, marginTop: 8 }}>Pause</div>
              <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>Drücke ⏸ zum Weiterspielen</div>
            </div>
          </div>
        )}

        {/* Game over overlay */}
        {dead && (
          <div style={{
            position: "absolute", inset: 0, background: "rgba(0,0,0,0.75)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{
              background: "var(--surface)", borderRadius: 16, padding: "24px 28px",
              textAlign: "center", width: 280,
              border: "1.5px solid rgba(34,197,94,0.4)",
            }}>
              <div style={{ fontSize: 40 }}>🪱</div>
              <div style={{ fontWeight: 800, fontSize: 18, marginTop: 8 }}>Game Over!</div>
              {isNewHighScore && (
                <div style={{ color: "var(--accent)", fontWeight: 700, fontSize: 14, marginTop: 4 }}>🏆 Neuer Rekord!</div>
              )}
              <div style={{ fontSize: 28, fontWeight: 900, color: WORM_GREEN, marginTop: 12 }}>{score}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Punkte · Länge: {length}</div>
              <button
                onClick={goToResults}
                style={{
                  marginTop: 16, width: "100%", padding: "12px 0",
                  background: WORM_GREEN, color: "#fff", fontWeight: 700,
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
          if (dead) { navigate("/worm/lobby"); return; }
          statusRef.current = "PAUSED";
          setPaused(true);
          setQuitDialog(true);
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 700, color: WORM_GREEN }}>{score}</span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Pts</span>
        <div style={{ width: 1, height: 14, background: "var(--border)", margin: "0 4px" }} />
        <span style={{ fontSize: 14, fontWeight: 700 }}>{length}</span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Länge</span>
      </GameHudBar>

      {/* D-Pad (BUTTONS mode) */}
      {controlMode === "BUTTONS" && !dead && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 56px)",
          gridTemplateRows: "repeat(3, 56px)",
          gap: 4, padding: "12px 0",
        }}>
          <div />
          <button style={btnStyle} onClick={() => changeDir(0, -1)}>▲</button>
          <div />
          <button style={btnStyle} onClick={() => changeDir(-1, 0)}>◄</button>
          <div />
          <button style={btnStyle} onClick={() => changeDir(1, 0)}>►</button>
          <div />
          <button style={btnStyle} onClick={() => changeDir(0, 1)}>▼</button>
          <div />
        </div>
      )}

      {quitDialog && (
        <QuitConfirmDialog
          message={`Score: ${score} Pts. Dein Fortschritt geht verloren.`}
          onConfirm={() => navigate("/worm/lobby")}
          onDismiss={() => {
            setQuitDialog(false);
            if (!dead) { statusRef.current = "PLAYING"; setPaused(false); lastStepRef.current = 0; }
          }}
        />
      )}
    </div>
  );
}
