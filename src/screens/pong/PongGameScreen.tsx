import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { doc, onSnapshot, updateDoc, addDoc, collection, getDoc } from "firebase/firestore";
import { db, auth } from "../../firebase";
import { GameHudBar, QuitConfirmDialog } from "../../components/GameHudBar";
import type { PongDifficulty, PongGame, PongSide } from "../../types";

interface PongSettings {
  totalPaddles: number;
  humanCount: number;
  difficulty: PongDifficulty;
  scoreLimit: number;
  gameId?: string;
  isHost?: boolean;
  mySide?: PongSide;
}

// ── Canvas dimensions ─────────────────────────────────────────────────────────
const W2 = 400; const H2 = 700;            // 2-paddle portrait
const SQ = 500;                             // 3/4-paddle square

const PADDLE_THICK = 14;
const PADDLE_LEN   = 90;
const MARGIN       = 20;
const BALL_R       = 9;
const BASE_SPEED   = 5;
const MAX_SPEED    = 13;
const CORNER_SIZE  = 38;                   // corner deflector triangle size

// ── Colours per side ──────────────────────────────────────────────────────────
const SIDE_COLOR: Record<PongSide, string> = {
  left:   "#0ea5e9",
  right:  "#f97316",
  top:    "#f59e0b",
  bottom: "#22c55e",
};

type Scores = Record<PongSide, number>;
type Paddles = Record<PongSide, number>;

interface GS {
  bx: number; by: number; bvx: number; bvy: number; speed: number;
  paddles: Paddles;
  scores: Scores;
  paused: boolean; pauseTimer: number;
  wallSide: PongSide | null;
}

const ALL_SIDES: PongSide[] = ["left", "right", "top", "bottom"];

function randomSide(): PongSide { return ALL_SIDES[Math.floor(Math.random() * 4)]; }

function sidesForPaddles(total: number, wall: PongSide | null): PongSide[] {
  if (total === 2) return ["left", "right"];
  if (total === 3) return ALL_SIDES.filter((s) => s !== wall);
  return ALL_SIDES;
}

function makeBall(cw: number, ch: number): Pick<GS, "bx"|"by"|"bvx"|"bvy"|"speed"> {
  const angle = Math.random() * Math.PI * 2;
  return { bx: cw / 2, by: ch / 2, bvx: BASE_SPEED * Math.cos(angle), bvy: BASE_SPEED * Math.sin(angle), speed: BASE_SPEED };
}

function initGS(totalPaddles: number): GS {
  const is2P  = totalPaddles === 2;
  const cw    = is2P ? W2 : SQ;
  const ch    = is2P ? H2 : SQ;
  const wall  = totalPaddles === 3 ? randomSide() : null;
  return {
    ...makeBall(cw, ch),
    paddles: { left: ch / 2, right: ch / 2, top: cw / 2, bottom: cw / 2 },
    scores:  { left: 0, right: 0, top: 0, bottom: 0 },
    paused: true, pauseTimer: 90,
    wallSide: wall,
  };
}

// ── AI: update one paddle position toward target ──────────────────────────────
function moveAI(current: number, target: number, speed: number, error: number, size: number): number {
  const t = target + (Math.random() - 0.5) * error * 2;
  const diff = t - current;
  const next = current + Math.sign(diff) * Math.min(Math.abs(diff), speed);
  return Math.max(PADDLE_LEN / 2, Math.min(size - PADDLE_LEN / 2, next));
}

export default function PongGameScreen() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const settings: PongSettings = (location.state as PongSettings) || {
    totalPaddles: 2, humanCount: 1, difficulty: "ROOKIE", scoreLimit: 7,
  };
  const { totalPaddles, humanCount, difficulty, scoreLimit, gameId, isHost, mySide = "left" } = settings;
  const uid = auth.currentUser?.uid ?? "";

  const is2P = totalPaddles === 2;
  const CW   = is2P ? W2 : SQ;
  const CH   = is2P ? H2 : SQ;

  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const gsRef       = useRef<GS>(initGS(totalPaddles));
  const rafRef      = useRef<number>(0);
  const frameRef    = useRef(0);
  const remoteRef   = useRef<Partial<GS & { paddleLeft: number; paddleRight: number; paddleTop: number; paddleBottom: number; scoreLeft: number; scoreRight: number; scoreTop: number; scoreBottom: number }> | null>(null);

  const [scores,       setScores]       = useState<Scores>({ left: 0, right: 0, top: 0, bottom: 0 });
  const [loser,        setLoser]        = useState<PongSide | null>(null);
  const [opponentNames, setOpponentNames] = useState<Partial<Record<PongSide, string>>>({});

  const userProfileRef = useRef<{ displayName: string; avatarUrl: string } | null>(null);
  useEffect(() => {
    if (!uid) return;
    getDoc(doc(db, "users", uid)).then((snap) => {
      if (snap.exists()) {
        const u = snap.data();
        userProfileRef.current = { displayName: u.displayName, avatarUrl: u.avatarUrl };
      }
    });
  }, [uid]);

  const resultWrittenRef = useRef(false);

  // AI config
  const aiSpd = difficulty === "ROOKIE" ? 2.8 : difficulty === "SNIPER" ? 5   : 9;
  const aiErr = difficulty === "ROOKIE" ? 45  : difficulty === "SNIPER" ? 12  : 0;

  // ── Determine which sides are active paddles (not wall, not empty) ───────────
  const activeSides = sidesForPaddles(totalPaddles, gsRef.current.wallSide);

  // ── Touch / Mouse helpers ────────────────────────────────────────────────────
  const getScale = useCallback(() => {
    const el = canvasRef.current;
    if (!el) return { sx: 1, sy: 1, rect: null as DOMRect | null };
    const rect = el.getBoundingClientRect();
    return { sx: CW / rect.width, sy: CH / rect.height, rect };
  }, [CW, CH]);

  function applyInput(lx: number, ly: number) {
    // lx, ly are in logical canvas coords
    const g = gsRef.current;
    const side = humanCount === 1 ? mySide : mySide;  // player always controls mySide
    const clamped = (axis: "x" | "y", val: number) =>
      Math.max(PADDLE_LEN / 2, Math.min((axis === "x" ? CW : CH) - PADDLE_LEN / 2, val));

    if (side === "left"   || side === "right")  g.paddles[side] = clamped("y", ly);
    if (side === "top"    || side === "bottom")  g.paddles[side] = clamped("x", lx);
  }

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onTouch = (e: TouchEvent) => {
      e.preventDefault();
      const { sx, sy, rect } = getScale();
      if (!rect) return;
      for (let i = 0; i < e.touches.length; i++) {
        const t = e.touches[i];
        applyInput((t.clientX - rect.left) * sx, (t.clientY - rect.top) * sy);
      }
    };
    el.addEventListener("touchstart", onTouch, { passive: false });
    el.addEventListener("touchmove",  onTouch, { passive: false });
    return () => { el.removeEventListener("touchstart", onTouch); el.removeEventListener("touchmove", onTouch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getScale, mySide, CW, CH]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onMouse = (e: MouseEvent) => {
      const { sx, sy, rect } = getScale();
      if (!rect) return;
      applyInput((e.clientX - rect.left) * sx, (e.clientY - rect.top) * sy);
    };
    el.addEventListener("mousemove", onMouse);
    return () => el.removeEventListener("mousemove", onMouse);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getScale, mySide, CW, CH]);

  // ── Firestore sync ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!gameId) return;
    return onSnapshot(doc(db, "pongGames", gameId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as PongGame;

      // Build opponent names map
      const names: Partial<Record<PongSide, string>> = {};
      data.players.forEach((p) => { if (p.userId !== uid) names[p.side] = p.displayName; });
      setOpponentNames(names);

      if (!isHost) {
        remoteRef.current = {
          bx: data.ballX, by: data.ballY, bvx: data.ballVX, bvy: data.ballVY,
          paddleLeft: data.paddleLeft, paddleRight: data.paddleRight,
          paddleTop: data.paddleTop, paddleBottom: data.paddleBottom,
          scoreLeft: data.scoreLeft, scoreRight: data.scoreRight,
          scoreTop: data.scoreTop, scoreBottom: data.scoreBottom,
          paused: data.paused, pauseTimer: data.pauseTimer,
        };
        setScores({ left: data.scoreLeft, right: data.scoreRight, top: data.scoreTop, bottom: data.scoreBottom });
        if (data.winnerId) {
          // find which side lost (has max score)
          const s = data.scoreLeft >= scoreLimit ? "left" : data.scoreRight >= scoreLimit ? "right" : data.scoreTop >= scoreLimit ? "top" : "bottom";
          setLoser(s);
        }
      } else {
        // Host only reads guest paddles
        const g = gsRef.current;
        data.players.forEach((p) => { if (p.userId !== uid) g.paddles[p.side] = (data as Record<string,number>)[`paddle${cap(p.side)}`] ?? g.paddles[p.side]; });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, isHost, uid]);

  const writeHost = useCallback(() => {
    if (!gameId) return;
    const g = gsRef.current;
    updateDoc(doc(db, "pongGames", gameId), {
      ballX: g.bx, ballY: g.by, ballVX: g.bvx, ballVY: g.bvy, speed: g.speed,
      paddleLeft: g.paddles.left, paddleRight: g.paddles.right,
      paddleTop: g.paddles.top, paddleBottom: g.paddles.bottom,
      scoreLeft: g.scores.left, scoreRight: g.scores.right,
      scoreTop: g.scores.top, scoreBottom: g.scores.bottom,
      paused: g.paused, pauseTimer: g.pauseTimer,
    }).catch(() => {});
  }, [gameId]);

  const writeGuestPaddle = useCallback(() => {
    if (!gameId) return;
    const g = gsRef.current;
    updateDoc(doc(db, "pongGames", gameId), {
      [`paddle${cap(mySide)}`]: g.paddles[mySide],
    }).catch(() => {});
  }, [gameId, mySide]);

  // ── Game loop ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    function drawScene(g: GS) {
      ctx.fillStyle = "#0a1628";
      ctx.fillRect(0, 0, CW, CH);

      if (is2P) {
        draw2PField(ctx, g, CW, CH);
      } else {
        drawMultiField(ctx, g, totalPaddles, CW);
      }
    }

    function physicsStep(g: GS): PongSide | null {
      if (g.paused) { g.pauseTimer--; if (g.pauseTimer <= 0) g.paused = false; return null; }

      g.bx += g.bvx;
      g.by += g.bvy;

      if (is2P) {
        return physics2P(g, CW, CH);
      } else {
        return physicsMulti(g, totalPaddles, CW);
      }
    }

    function loop() {
      frameRef.current++;
      const g = gsRef.current;

      if (manualPausedRef.current) { rafRef.current = requestAnimationFrame(loop); return; }

      const isPhysicsOwner = humanCount === 1 || isHost;

      if (isPhysicsOwner) {
        // Run AI for all non-human, non-wall sides
        if (!g.paused) {
          activeSides.forEach((side) => {
            const isMyHumanSide = (humanCount === 1 && side === mySide) || (humanCount > 1 && side === mySide);
            const isGuestSide   = humanCount > 1 && side !== mySide;
            if (!isMyHumanSide && !isGuestSide) {
              // Pure AI paddle
              const target = (side === "left" || side === "right") ? g.by : g.bx;
              const size   = (side === "left" || side === "right") ? CH : CW;
              g.paddles[side] = moveAI(g.paddles[side], target, aiSpd, aiErr, size);
            }
          });
        }

        if (!loser) {
          const lostSide = physicsStep(g);
          if (lostSide) {
            g.scores[lostSide]++;
            const newScores = { ...g.scores };
            setScores(newScores);
            if (g.scores[lostSide] >= scoreLimit) {
              setLoser(lostSide);
              const humanWon = lostSide !== mySide;
              if (!resultWrittenRef.current) {
                resultWrittenRef.current = true;
                const profile = userProfileRef.current;
                if (gameId) {
                  // Online: set status FINISHED + winnerId
                  updateDoc(doc(db, "pongGames", gameId), {
                    winnerId: humanWon ? uid : null,
                    status: "FINISHED",
                    scoreLeft: g.scores.left, scoreRight: g.scores.right,
                    scoreTop: g.scores.top, scoreBottom: g.scores.bottom,
                  }).catch(() => {});
                } else if (profile) {
                  // KI game: create result document
                  addDoc(collection(db, "pongGames"), {
                    adminId: uid,
                    status: "FINISHED",
                    totalPaddles, humanCount, difficulty, scoreLimit,
                    players: [{ userId: uid, displayName: profile.displayName, avatarUrl: profile.avatarUrl, side: mySide }],
                    playerIds: [uid],
                    winnerId: humanWon ? uid : null,
                    scoreLeft: g.scores.left, scoreRight: g.scores.right,
                    scoreTop: g.scores.top, scoreBottom: g.scores.bottom,
                    createdAt: Date.now(),
                  }).catch(() => {});
                }
              }
            } else {
              // Reset ball
              Object.assign(g, makeBall(CW, CH), { paused: true, pauseTimer: 90 });
            }
          }
        }

        drawScene(g);
        if (gameId && frameRef.current % 4 === 0) writeHost();

      } else {
        // Guest: apply remote state
        const r = remoteRef.current;
        if (r) {
          g.bx  = lerp(g.bx, r.bx ?? g.bx, 0.3);
          g.by  = lerp(g.by, r.by ?? g.by, 0.3);
          ALL_SIDES.forEach((s) => {
            const key = `paddle${cap(s)}` as keyof typeof r;
            if (r[key] !== undefined) g.paddles[s] = lerp(g.paddles[s], r[key] as number, 0.4);
          });
          g.paused     = r.paused     ?? g.paused;
          g.pauseTimer = r.pauseTimer ?? g.pauseTimer;
        }
        drawScene(g);
        if (gameId && frameRef.current % 4 === 0) writeGuestPaddle();
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loser]);

  // ── Draw helpers ─────────────────────────────────────────────────────────────

  function drawBackground(ctx: CanvasRenderingContext2D, cw: number, ch: number) {
    // Sandy beach court gradient
    const grad = ctx.createLinearGradient(0, 0, 0, ch);
    grad.addColorStop(0,   "#c8a86b");
    grad.addColorStop(0.5, "#d4b87a");
    grad.addColorStop(1,   "#c09050");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cw, ch);
    // Subtle sand texture lines
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.strokeStyle = "#8b6a30";
    ctx.lineWidth = 1;
    for (let y = 0; y < ch; y += 6) {
      ctx.beginPath(); ctx.moveTo(0, y + Math.sin(y * 0.3) * 1.5); ctx.lineTo(cw, y + Math.sin(y * 0.3 + 1) * 1.5); ctx.stroke();
    }
    ctx.restore();
    // Court boundary
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.strokeRect(MARGIN + PADDLE_THICK + 4, 8, cw - 2 * (MARGIN + PADDLE_THICK + 4), ch - 16);
    ctx.restore();
  }

  function drawNet2P(ctx: CanvasRenderingContext2D, cw: number, ch: number) {
    const nx = cw / 2;
    // Shadow
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.3)"; ctx.shadowBlur = 6;
    ctx.fillStyle = "#7a5c28";
    ctx.fillRect(nx - 2, 0, 4, ch);
    ctx.shadowBlur = 0;
    // Net stripes
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 5]);
    for (let y = 8; y < ch; y += 9) {
      ctx.beginPath(); ctx.moveTo(nx - 6, y); ctx.lineTo(nx + 6, y); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawNetMulti(ctx: CanvasRenderingContext2D, size: number) {
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 6]);
    ctx.beginPath(); ctx.moveTo(size / 2, 0); ctx.lineTo(size / 2, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, size / 2); ctx.lineTo(size, size / 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function draw2PField(ctx: CanvasRenderingContext2D, g: GS, cw: number, ch: number) {
    drawBackground(ctx, cw, ch);
    drawNet2P(ctx, cw, ch);

    drawSurfboard(ctx, MARGIN, g.paddles.left  - PADDLE_LEN / 2, PADDLE_THICK, PADDLE_LEN, SIDE_COLOR.left,  "v");
    drawSurfboard(ctx, cw - MARGIN - PADDLE_THICK, g.paddles.right - PADDLE_LEN / 2, PADDLE_THICK, PADDLE_LEN, SIDE_COLOR.right, "v");

    drawBall(ctx, g);
    if (g.paused && g.pauseTimer > 30) drawCountdown(ctx, g.pauseTimer, cw, ch);
  }

  function drawMultiField(ctx: CanvasRenderingContext2D, g: GS, total: number, size: number) {
    const wall = g.wallSide;
    drawBackground(ctx, size, size);
    drawNetMulti(ctx, size);

    // Corner deflectors (4P only)
    if (total === 4) {
      drawCorner(ctx, 0,    0,    "tl");
      drawCorner(ctx, size, 0,    "tr");
      drawCorner(ctx, 0,    size, "bl");
      drawCorner(ctx, size, size, "br");
    }

    // Wall (3P) — sand-coloured plank
    if (wall) {
      ctx.save();
      ctx.fillStyle = "#8b6530cc";
      ctx.strokeStyle = "rgba(255,255,255,0.2)"; ctx.lineWidth = 2;
      if (wall === "left")   { ctx.fillRect(0, 0, PADDLE_THICK + MARGIN, size); ctx.strokeRect(0, 0, PADDLE_THICK + MARGIN, size); }
      if (wall === "right")  { ctx.fillRect(size - MARGIN - PADDLE_THICK, 0, PADDLE_THICK + MARGIN, size); }
      if (wall === "top")    { ctx.fillRect(0, 0, size, PADDLE_THICK + MARGIN); }
      if (wall === "bottom") { ctx.fillRect(0, size - MARGIN - PADDLE_THICK, size, PADDLE_THICK + MARGIN); }
      ctx.restore();
    }

    sidesForPaddles(total, wall).forEach((side) => {
      const pos = g.paddles[side];
      if (side === "left")   drawSurfboard(ctx, MARGIN,                       pos - PADDLE_LEN / 2, PADDLE_THICK, PADDLE_LEN, SIDE_COLOR[side], "v");
      if (side === "right")  drawSurfboard(ctx, size - MARGIN - PADDLE_THICK, pos - PADDLE_LEN / 2, PADDLE_THICK, PADDLE_LEN, SIDE_COLOR[side], "v");
      if (side === "top")    drawSurfboard(ctx, pos - PADDLE_LEN / 2, MARGIN,                       PADDLE_LEN, PADDLE_THICK, SIDE_COLOR[side], "h");
      if (side === "bottom") drawSurfboard(ctx, pos - PADDLE_LEN / 2, size - MARGIN - PADDLE_THICK, PADDLE_LEN, PADDLE_THICK, SIDE_COLOR[side], "h");
    });

    drawBall(ctx, g);
    if (g.paused && g.pauseTimer > 30) drawCountdown(ctx, g.pauseTimer, size, size);
  }

  // Surfboard shape — pointed at both long ends, curved sides
  function drawSurfboard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, dir: "v" | "h") {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.4)"; ctx.shadowBlur = 8;

    const cx = x + w / 2;
    const cy = y + h / 2;

    if (dir === "v") {
      // Vertical surfboard: pointed top & bottom, wide middle
      const hw = w / 2, hh = h / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy - hh);                                    // top tip
      ctx.bezierCurveTo(cx + hw * 2.2, cy - hh * 0.6, cx + hw * 2.2, cy + hh * 0.6, cx, cy + hh); // right curve
      ctx.bezierCurveTo(cx - hw * 2.2, cy + hh * 0.6, cx - hw * 2.2, cy - hh * 0.6, cx, cy - hh); // left curve
      ctx.closePath();
      // Fill with gradient
      const g2 = ctx.createLinearGradient(x, 0, x + w, 0);
      g2.addColorStop(0, shadeColor(color, -20));
      g2.addColorStop(0.5, color);
      g2.addColorStop(1, shadeColor(color, -20));
      ctx.fillStyle = g2;
      ctx.fill();
      // Stripe down the middle
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1.5; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(cx, cy - hh * 0.7); ctx.lineTo(cx, cy + hh * 0.7); ctx.stroke();
    } else {
      // Horizontal surfboard: pointed left & right
      const hw = w / 2, hh = h / 2;
      ctx.beginPath();
      ctx.moveTo(cx - hw, cy);                                    // left tip
      ctx.bezierCurveTo(cx - hw * 0.6, cy - hh * 2.2, cx + hw * 0.6, cy - hh * 2.2, cx + hw, cy); // top curve
      ctx.bezierCurveTo(cx + hw * 0.6, cy + hh * 2.2, cx - hw * 0.6, cy + hh * 2.2, cx - hw, cy); // bottom curve
      ctx.closePath();
      const g2 = ctx.createLinearGradient(0, y, 0, y + h);
      g2.addColorStop(0, shadeColor(color, -20));
      g2.addColorStop(0.5, color);
      g2.addColorStop(1, shadeColor(color, -20));
      ctx.fillStyle = g2;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1.5; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(cx - hw * 0.7, cy); ctx.lineTo(cx + hw * 0.7, cy); ctx.stroke();
    }
    ctx.restore();
  }

  function shadeColor(hex: string, amt: number): string {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.max(0, (n >> 16) + amt));
    const g2 = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + amt));
    const b = Math.min(255, Math.max(0, (n & 0xff) + amt));
    return `rgb(${r},${g2},${b})`;
  }

  function drawCorner(ctx: CanvasRenderingContext2D, cx: number, cy: number, pos: "tl"|"tr"|"bl"|"br") {
    const s = CORNER_SIZE;
    ctx.fillStyle = "#8b6530bb";
    ctx.beginPath();
    if (pos === "tl") { ctx.moveTo(cx, cy); ctx.lineTo(cx + s, cy); ctx.lineTo(cx, cy + s); }
    if (pos === "tr") { ctx.moveTo(cx, cy); ctx.lineTo(cx - s, cy); ctx.lineTo(cx, cy + s); }
    if (pos === "bl") { ctx.moveTo(cx, cy); ctx.lineTo(cx + s, cy); ctx.lineTo(cx, cy - s); }
    if (pos === "br") { ctx.moveTo(cx, cy); ctx.lineTo(cx - s, cy); ctx.lineTo(cx, cy - s); }
    ctx.closePath(); ctx.fill();
  }

  function drawBall(ctx: CanvasRenderingContext2D, g: GS) {
    if (g.paused && g.pauseTimer >= 30) return;
    const r = BALL_R;
    const bx = g.bx, by = g.by;

    // Drop shadow
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.4)"; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fillStyle = "#f0ede0"; ctx.fill();
    ctx.restore();

    // Ball base (off-white)
    ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fillStyle = "#f5f2e6"; ctx.fill();

    // Volleyball panel seams — 3 curved bands
    ctx.save();
    ctx.lineWidth = 1.4;
    ctx.setLineDash([]);

    // Blue panel (top-left area)
    ctx.beginPath();
    ctx.arc(bx - r * 0.3, by - r * 0.3, r * 1.05, Math.PI * 0.55, Math.PI * 1.3);
    ctx.strokeStyle = "#2563eb"; ctx.stroke();

    // Orange/yellow panel (right area)
    ctx.beginPath();
    ctx.arc(bx + r * 0.3, by, r * 1.05, Math.PI * 1.55, Math.PI * 0.25);
    ctx.strokeStyle = "#f59e0b"; ctx.stroke();

    // Green panel (bottom area)
    ctx.beginPath();
    ctx.arc(bx, by + r * 0.35, r * 1.05, Math.PI * 0.05, Math.PI * 0.95);
    ctx.strokeStyle = "#16a34a"; ctx.stroke();

    // Outer border
    ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(0,0,0,0.15)"; ctx.lineWidth = 1; ctx.stroke();

    // Highlight
    ctx.beginPath(); ctx.arc(bx - r * 0.28, by - r * 0.28, r * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.fill();

    ctx.restore();
  }

  function drawCountdown(ctx: CanvasRenderingContext2D, timer: number, cw: number, ch: number) {
    const n = Math.ceil(timer / 30);
    ctx.save();
    ctx.font = "bold 80px system-ui";
    ctx.textAlign = "center";
    ctx.shadowColor = "rgba(0,0,0,0.4)"; ctx.shadowBlur = 12;
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(String(n), cw / 2, ch / 2 + 28);
    ctx.restore();
  }

  // ── Physics ──────────────────────────────────────────────────────────────────

  function physics2P(g: GS, cw: number, ch: number): PongSide | null {
    // Walls top/bottom
    if (g.by - BALL_R < 0)  { g.by = BALL_R;       g.bvy =  Math.abs(g.bvy); }
    if (g.by + BALL_R > ch) { g.by = ch - BALL_R;  g.bvy = -Math.abs(g.bvy); }

    // Left paddle
    const lpx = MARGIN + PADDLE_THICK;
    if (g.bvx < 0 && g.bx - BALL_R < lpx && g.bx - BALL_R > MARGIN - 2 &&
        inRange(g.by, g.paddles.left - PADDLE_LEN / 2 - BALL_R, g.paddles.left + PADDLE_LEN / 2 + BALL_R)) {
      const rel = (g.by - g.paddles.left) / (PADDLE_LEN / 2);
      g.speed = Math.min(g.speed + 0.35, MAX_SPEED);
      g.bvx =  g.speed * Math.cos(rel * 0.75);
      g.bvy =  g.speed * Math.sin(rel * 0.75);
      g.bx  = lpx + BALL_R + 1;
    }

    // Right paddle
    const rpx = cw - MARGIN - PADDLE_THICK;
    if (g.bvx > 0 && g.bx + BALL_R > rpx && g.bx + BALL_R < cw - MARGIN + 2 &&
        inRange(g.by, g.paddles.right - PADDLE_LEN / 2 - BALL_R, g.paddles.right + PADDLE_LEN / 2 + BALL_R)) {
      const rel = (g.by - g.paddles.right) / (PADDLE_LEN / 2);
      g.speed = Math.min(g.speed + 0.35, MAX_SPEED);
      g.bvx = -g.speed * Math.cos(rel * 0.75);
      g.bvy =  g.speed * Math.sin(rel * 0.75);
      g.bx  = rpx - BALL_R - 1;
    }

    if (g.bx + BALL_R < 0)   return "left";
    if (g.bx - BALL_R > cw)  return "right";
    return null;
  }

  function physicsMulti(g: GS, total: number, size: number): PongSide | null {
    const wall    = g.wallSide;
    const padSide = sidesForPaddles(total, wall);

    // Corner deflectors (4P)
    if (total === 4) {
      const cs = CORNER_SIZE;
      if (g.bx < cs && g.by < cs)            { g.bvx =  Math.abs(g.bvx); g.bvy =  Math.abs(g.bvy); }
      if (g.bx > size - cs && g.by < cs)     { g.bvx = -Math.abs(g.bvx); g.bvy =  Math.abs(g.bvy); }
      if (g.bx < cs && g.by > size - cs)     { g.bvx =  Math.abs(g.bvx); g.bvy = -Math.abs(g.bvy); }
      if (g.bx > size - cs && g.by > size - cs) { g.bvx = -Math.abs(g.bvx); g.bvy = -Math.abs(g.bvy); }
    }

    // ── Check each side ──────────────────────────────────────────────────────
    // LEFT
    const lx = MARGIN + PADDLE_THICK;
    if (g.bvx < 0 && g.bx - BALL_R < lx) {
      if (wall === "left") { g.bvx = Math.abs(g.bvx); g.bx = lx + BALL_R; }
      else if (inRange(g.bx - BALL_R, MARGIN - 2, lx) && inRange(g.by, g.paddles.left - PADDLE_LEN/2 - BALL_R, g.paddles.left + PADDLE_LEN/2 + BALL_R)) {
        const rel = (g.by - g.paddles.left) / (PADDLE_LEN / 2);
        g.speed = Math.min(g.speed + 0.3, MAX_SPEED);
        g.bvx =  g.speed * Math.cos(rel * 0.7);
        g.bvy =  g.speed * Math.sin(rel * 0.7);
        g.bx  = lx + BALL_R + 1;
      } else if (g.bx + BALL_R < 0 && padSide.includes("left")) return "left";
    }

    // RIGHT
    const rx = size - MARGIN - PADDLE_THICK;
    if (g.bvx > 0 && g.bx + BALL_R > rx) {
      if (wall === "right") { g.bvx = -Math.abs(g.bvx); g.bx = rx - BALL_R; }
      else if (inRange(g.bx + BALL_R, rx, size - MARGIN + 2) && inRange(g.by, g.paddles.right - PADDLE_LEN/2 - BALL_R, g.paddles.right + PADDLE_LEN/2 + BALL_R)) {
        const rel = (g.by - g.paddles.right) / (PADDLE_LEN / 2);
        g.speed = Math.min(g.speed + 0.3, MAX_SPEED);
        g.bvx = -g.speed * Math.cos(rel * 0.7);
        g.bvy =  g.speed * Math.sin(rel * 0.7);
        g.bx  = rx - BALL_R - 1;
      } else if (g.bx - BALL_R > size && padSide.includes("right")) return "right";
    }

    // TOP
    const ty = MARGIN + PADDLE_THICK;
    if (g.bvy < 0 && g.by - BALL_R < ty) {
      if (wall === "top") { g.bvy = Math.abs(g.bvy); g.by = ty + BALL_R; }
      else if (inRange(g.by - BALL_R, MARGIN - 2, ty) && inRange(g.bx, g.paddles.top - PADDLE_LEN/2 - BALL_R, g.paddles.top + PADDLE_LEN/2 + BALL_R)) {
        const rel = (g.bx - g.paddles.top) / (PADDLE_LEN / 2);
        g.speed = Math.min(g.speed + 0.3, MAX_SPEED);
        g.bvy =  g.speed * Math.cos(rel * 0.7);
        g.bvx =  g.speed * Math.sin(rel * 0.7);
        g.by  = ty + BALL_R + 1;
      } else if (g.by + BALL_R < 0 && padSide.includes("top")) return "top";
    }

    // BOTTOM
    const by_ = size - MARGIN - PADDLE_THICK;
    if (g.bvy > 0 && g.by + BALL_R > by_) {
      if (wall === "bottom") { g.bvy = -Math.abs(g.bvy); g.by = by_ - BALL_R; }
      else if (inRange(g.by + BALL_R, by_, size - MARGIN + 2) && inRange(g.bx, g.paddles.bottom - PADDLE_LEN/2 - BALL_R, g.paddles.bottom + PADDLE_LEN/2 + BALL_R)) {
        const rel = (g.bx - g.paddles.bottom) / (PADDLE_LEN / 2);
        g.speed = Math.min(g.speed + 0.3, MAX_SPEED);
        g.bvy = -g.speed * Math.cos(rel * 0.7);
        g.bvx =  g.speed * Math.sin(rel * 0.7);
        g.by  = by_ - BALL_R - 1;
      } else if (g.by - BALL_R > size && padSide.includes("bottom")) return "bottom";
    }

    return null;
  }

  // ── HUD state ────────────────────────────────────────────────────────────────
  const manualPausedRef = useRef(false);
  const [manualPaused, setManualPaused] = useState(false);
  const [showQuitDialog, setShowQuitDialog] = useState(false);

  function handleManualPause() {
    const next = !manualPausedRef.current;
    manualPausedRef.current = next;
    setManualPaused(next);
  }

  // ── Restart ──────────────────────────────────────────────────────────────────
  function handleRestart() {
    gsRef.current = initGS(totalPaddles);
    setScores({ left: 0, right: 0, top: 0, bottom: 0 });
    setLoser(null);
    frameRef.current = 0;
  }

  // ── Score display ─────────────────────────────────────────────────────────────
  const activeSidesList = sidesForPaddles(totalPaddles, gsRef.current.wallSide);

  function labelForSide(side: PongSide): string {
    if (humanCount === 1) {
      return side === mySide ? "Du" : `KI`;
    }
    if (side === mySide) return "Du";
    return opponentNames[side] ?? "Gegner";
  }

  const winnerSides = loser ? activeSidesList.filter((s) => s !== loser) : [];

  return (
    <div style={{ background: "#0a1628", minHeight: "100vh", display: "flex", flexDirection: "column", userSelect: "none" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", padding: "12px 16px 8px", borderBottom: "1px solid #1e3050", flexShrink: 0, gap: 8 }}>
        <button onClick={() => navigate("/pong/lobby")} style={{ background: "none", border: "none", color: "var(--primary)", fontSize: 15, fontWeight: 700, cursor: "pointer", padding: 0 }}>
          ‹ Lobby
        </button>

        {/* Scores */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, overflowX: "auto" }}>
          {activeSidesList.map((side, i) => (
            <div key={side} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {i > 0 && <span style={{ color: "#1e3050", fontWeight: 900 }}>·</span>}
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 9, color: SIDE_COLOR[side], fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", whiteSpace: "nowrap" }}>
                  {labelForSide(side)}
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, color: scores[side] >= scoreLimit - 1 ? "var(--danger)" : "#e2e8f0", lineHeight: 1 }}>
                  {scores[side]}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 10, color: "var(--text-muted)", minWidth: 36, textAlign: "right" }}>/{scoreLimit}</div>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", padding: 8 }}>
        <canvas
          ref={canvasRef}
          width={CW} height={CH}
          style={{
            width: is2P ? "auto" : "min(100%, calc(100vh - 80px))",
            height: is2P ? "calc(100vh - 70px)" : "min(100%, calc(100vh - 80px))",
            maxWidth: is2P ? CW : undefined,
            touchAction: "none", display: "block",
          }}
        />
      </div>

      {/* HUD bar */}
      <GameHudBar
        paused={manualPaused}
        onPauseToggle={handleManualPause}
        onQuit={() => { setManualPaused(true); manualPausedRef.current = true; setShowQuitDialog(true); }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, overflowX: "auto" }}>
          {activeSidesList.map((side, i) => (
            <div key={side} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {i > 0 && <span style={{ color: "#1e3050", fontWeight: 900, fontSize: 12 }}>·</span>}
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 8, color: SIDE_COLOR[side], fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase" }}>{labelForSide(side)}</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: scores[side] >= scoreLimit - 1 ? "var(--danger)" : "#e2e8f0", lineHeight: 1 }}>{scores[side]}</div>
              </div>
            </div>
          ))}
        </div>
      </GameHudBar>

      {showQuitDialog && (
        <QuitConfirmDialog
          message="Das laufende Spiel wird beendet."
          onConfirm={() => navigate("/pong/lobby")}
          onDismiss={() => { setShowQuitDialog(false); setManualPaused(false); manualPausedRef.current = false; }}
        />
      )}

      {/* Touch hint */}
      <div style={{ position: "fixed", bottom: 16, left: 0, right: 0, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
        <div style={{ fontSize: 11, color: `${SIDE_COLOR[mySide]}88`, fontWeight: 700 }}>
          {mySide === "left" || mySide === "right" ? "↕ Ziehe zum Steuern" : "↔ Ziehe zum Steuern"}
        </div>
      </div>

      {/* Loser / Winner overlay */}
      {loser && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 50,
          background: "rgba(10,22,40,0.93)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18,
        }}>
          <div style={{ fontSize: 72 }}>
            {winnerSides.includes(mySide) ? "🏆" : loser === mySide ? "😅" : "🏓"}
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "var(--text)", textAlign: "center", maxWidth: 280 }}>
            {loser === mySide ? "Du verlierst!" :
             winnerSides.includes(mySide) ? "Du gewinnst!" :
             `${labelForSide(loser)} verliert!`}
          </div>

          {/* Score summary */}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
            {activeSidesList.map((side) => (
              <div key={side} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, color: SIDE_COLOR[side], fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase" }}>{labelForSide(side)}</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: side === loser ? "var(--danger)" : "#e2e8f0" }}>{scores[side]}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            {(humanCount === 1 || isHost) && (
              <button onClick={handleRestart} style={{
                background: "linear-gradient(135deg, var(--coral), #e8501a)",
                border: "none", borderRadius: "var(--radius)", color: "#fff",
                fontSize: 15, fontWeight: 800, padding: "15px 28px", cursor: "pointer",
              }}>🔄 Nochmal</button>
            )}
            <button onClick={() => navigate("/pong/lobby")} style={{
              background: "var(--surface2)", border: "1.5px solid var(--border)",
              borderRadius: "var(--radius)", color: "var(--text)",
              fontSize: 15, fontWeight: 700, padding: "15px 22px", cursor: "pointer",
            }}>Lobby</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Utility ───────────────────────────────────────────────────────────────────
function inRange(v: number, min: number, max: number) { return v >= min && v <= max; }
function lerp(a: number, b: number, t: number)       { return a + (b - a) * t; }
function cap(s: string)                               { return s.charAt(0).toUpperCase() + s.slice(1); }
