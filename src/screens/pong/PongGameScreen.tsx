import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { doc, onSnapshot, updateDoc, addDoc, collection, getDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../../firebase";
import { QuitConfirmDialog } from "../../components/GameHudBar";
import { audioManager } from "../../audio/AudioManager";
import type { PongDifficulty, PongGame, PongSide } from "../../types";

interface PongSettings {
  totalPaddles: number;
  humanCount: number;
  difficulty: PongDifficulty;
  scoreLimit: number;
  gameId?: string;
  isHost?: boolean;
  mySide?: PongSide;
  guestSides?: PongSide[];
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
const WALL_H       = 18;                   // top/bottom wall thickness (2P mode)

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


function sidesForPaddles(total: number, wall: PongSide | null): PongSide[] {
  if (total === 2) return ["left", "right"];
  if (total === 3) return ALL_SIDES.filter((s) => s !== wall);
  return ALL_SIDES;
}

function makeBall(cw: number, ch: number): Pick<GS, "bx"|"by"|"bvx"|"bvy"|"speed"> {
  // Angle from horizontal: 10°–80° per quadrant (user request: no 0°/180° = vertical shots)
  const toRad = (d: number) => (d * Math.PI) / 180;
  const deg = 10 + Math.random() * 70;           // 10° to 80° from horizontal
  const rad = toRad(deg);
  const signX = Math.random() < 0.5 ? 1 : -1;   // left or right
  const signY = Math.random() < 0.5 ? 1 : -1;   // up or down
  return {
    bx: cw / 2, by: ch / 2,
    bvx: BASE_SPEED * Math.cos(rad) * signX,
    bvy: BASE_SPEED * Math.sin(rad) * signY,
    speed: BASE_SPEED,
  };
}

function initGS(totalPaddles: number, humanCount: number): GS {
  const is2P  = totalPaddles === 2;
  const cw    = is2P ? W2 : SQ;
  const ch    = is2P ? H2 : SQ;
  // Wall must not collide with human-assigned sides (left/right/top are used first)
  const humanSides = (["left", "right", "top", "bottom"] as PongSide[]).slice(0, humanCount);
  const wallCandidates = (["left", "right", "top", "bottom"] as PongSide[]).filter(s => !humanSides.includes(s));
  const wall: PongSide | null = totalPaddles === 3 ? wallCandidates[Math.floor(Math.random() * wallCandidates.length)] : null;
  return {
    ...makeBall(cw, ch),
    paddles: { left: ch / 2, right: ch / 2, top: cw / 2, bottom: cw / 2 },
    scores:  { left: 0, right: 0, top: 0, bottom: 0 },
    paused: true, pauseTimer: 90,
    wallSide: wall,
  };
}

// ── AI: update one paddle position toward target ──────────────────────────────
function moveAI(current: number, target: number, speed: number, error: number, min: number, max: number): number {
  const t = target + (Math.random() - 0.5) * error * 2;
  const diff = t - current;
  const next = current + Math.sign(diff) * Math.min(Math.abs(diff), speed);
  return Math.max(min, Math.min(max, next));
}

export default function PongGameScreen() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const settings: PongSettings = (location.state as PongSettings) || {
    totalPaddles: 2, humanCount: 1, difficulty: "ROOKIE", scoreLimit: 7,
  };
  const { totalPaddles, humanCount, difficulty, scoreLimit, gameId, isHost, mySide = "left" } = settings;
  const guestSidesRef = useRef<PongSide[]>(settings.guestSides ?? []);
  const uid = auth.currentUser?.uid ?? "";

  const is2P = totalPaddles === 2;
  const CW   = is2P ? W2 : SQ;
  const CH   = is2P ? H2 : SQ;

  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const gsRef       = useRef<GS>(initGS(totalPaddles, humanCount));
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

  useEffect(() => {
    audioManager.startMusic("pong");
    return () => audioManager.stopMusic();
  }, []);

  const resultWrittenRef = useRef(false);
  const [hostGone, setHostGone] = useState(false);
  const lastHbRef = useRef(Date.now());

  // AI config
  const aiSpd = difficulty === "ROOKIE" ? 2.8 : difficulty === "SNIPER" ? 5   : 9;
  const aiErr = difficulty === "ROOKIE" ? 45  : difficulty === "SNIPER" ? 12  : 0;

  // ── Determine which sides are active paddles (not wall, not empty) ───────────
  const activeSides = sidesForPaddles(totalPaddles, gsRef.current.wallSide);

  // ── Touch / Mouse helpers ────────────────────────────────────────────────────
  const zoneRef = useRef<HTMLDivElement>(null);

  function applyZoneInput(clientX: number, clientY: number, rect: DOMRect) {
    const g = gsRef.current;
    const touchX = clientX - rect.left;
    const touchY = clientY - rect.top;
    const frac  = Math.max(0, Math.min(1, touchY / rect.height));
    const fracX = Math.max(0, Math.min(1, touchX / rect.width));
    const wallOff = is2P ? WALL_H : 0;
    const pMin  = PADDLE_LEN / 2 + wallOff;
    const pMax  = CH - PADDLE_LEN / 2 - wallOff;
    const pMinX = PADDLE_LEN / 2;
    const pMaxX = CW - PADDLE_LEN / 2;
    const side: PongSide = (humanCount === 1 || gameId != null)
      ? mySide
      : touchX < rect.width / 2 ? "left" : "right";
    if (side === "left" || side === "right") {
      g.paddles[side] = pMin + frac * (pMax - pMin);
    } else {
      g.paddles[side] = pMinX + fracX * (pMaxX - pMinX);
    }
  }

  useEffect(() => {
    const zone = zoneRef.current;
    if (!zone) return;
    const onTouch = (e: TouchEvent) => {
      e.preventDefault();
      const rect = zone.getBoundingClientRect();
      for (let i = 0; i < e.touches.length; i++) {
        const t = e.touches[i];
        applyZoneInput(t.clientX, t.clientY, rect);
      }
    };
    zone.addEventListener("touchstart", onTouch, { passive: false });
    zone.addEventListener("touchmove",  onTouch, { passive: false });
    return () => { zone.removeEventListener("touchstart", onTouch); zone.removeEventListener("touchmove", onTouch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mySide, humanCount, is2P, CW, CH]);

  useEffect(() => {
    const zone = zoneRef.current;
    if (!zone) return;
    let down = false;
    const onDown = (e: MouseEvent) => { down = true; applyZoneInput(e.clientX, e.clientY, zone.getBoundingClientRect()); };
    const onMove = (e: MouseEvent) => { if (down) applyZoneInput(e.clientX, e.clientY, zone.getBoundingClientRect()); };
    const onUp   = () => { down = false; };
    zone.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => { zone.removeEventListener("mousedown", onDown); window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mySide, humanCount, is2P, CW, CH]);

  // ── Host: mark game as running so guests can activate ─────────────────────
  useEffect(() => {
    if (!gameId || !isHost) return;
    updateDoc(doc(db, "pongGames", gameId), {
      status: "IN_PROGRESS",
      wallSide: gsRef.current.wallSide ?? null,
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, isHost]);

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
        lastHbRef.current = Date.now();
        const status = (data as any).status as string | undefined;
        // Sync wallSide from host so both devices render the same paddles
        if (data.wallSide && gsRef.current.wallSide !== data.wallSide) {
          gsRef.current.wallSide = data.wallSide as PongSide;
        }
        remoteRef.current = {
          bx: data.ballX, by: data.ballY, bvx: data.ballVX, bvy: data.ballVY,
          paddleLeft: data.paddleLeft, paddleRight: data.paddleRight,
          paddleTop: data.paddleTop, paddleBottom: data.paddleBottom,
          scoreLeft: data.scoreLeft, scoreRight: data.scoreRight,
          scoreTop: data.scoreTop, scoreBottom: data.scoreBottom,
          paused: data.paused, pauseTimer: data.pauseTimer,
        };
        setScores({ left: data.scoreLeft, right: data.scoreRight, top: data.scoreTop, bottom: data.scoreBottom });
        if (status === "FINISHED") {
          // find which side lost (has max score); covers both winnerId=null (human lost) and winnerId!=null
          const s = data.scoreLeft >= scoreLimit ? "left" : data.scoreRight >= scoreLimit ? "right" : data.scoreTop >= scoreLimit ? "top" : "bottom";
          setLoser(s);
        } else if (status === "IN_PROGRESS") {
          setLoser(null);
        }
      } else {
        // Host only reads guest paddles
        const g = gsRef.current;
        data.players.forEach((p) => { if (p.userId !== uid) g.paddles[p.side] = (data as unknown as Record<string,number>)[`paddle${cap(p.side)}`] ?? g.paddles[p.side]; });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, isHost, uid]);

  // ── Guest: host-disconnect watchdog ──────────────────────────────────────────
  useEffect(() => {
    if (!gameId || isHost) return;
    lastHbRef.current = Date.now();
    const id = setInterval(() => {
      setHostGone(Date.now() - lastHbRef.current > 15_000);
    }, 5_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, isHost]);

  const writeHost = useCallback(() => {
    if (!gameId) return;
    const g = gsRef.current;
    // Only write paddles the host owns (own + AI) — never overwrite guest paddles.
    const paddleFields: Record<string, number> = {};
    ALL_SIDES.forEach((s) => {
      if (!guestSidesRef.current.includes(s))
        paddleFields[`paddle${cap(s)}`] = g.paddles[s];
    });
    updateDoc(doc(db, "pongGames", gameId), {
      ballX: g.bx, ballY: g.by, ballVX: g.bvx, ballVY: g.bvy, speed: g.speed,
      wallSide: g.wallSide ?? null,
      ...paddleFields,
      scoreLeft: g.scores.left, scoreRight: g.scores.right,
      scoreTop: g.scores.top, scoreBottom: g.scores.bottom,
      paused: g.paused, pauseTimer: g.pauseTimer,
      lastHeartbeat: serverTimestamp(),
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
            const isMyHumanSide = side === mySide;
            const isGuestSide   = guestSidesRef.current.includes(side);
            if (!isMyHumanSide && !isGuestSide) {
              // Pure AI paddle
              const isVert  = side === "left" || side === "right";
              const target  = isVert ? g.by : g.bx;
              const size    = isVert ? CH : CW;
              const wallOff = is2P && isVert ? WALL_H : 0;
              g.paddles[side] = moveAI(g.paddles[side], target, aiSpd, aiErr, PADDLE_LEN / 2 + wallOff, size - PADDLE_LEN / 2 - wallOff);
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
            if (s === mySide) return; // never lerp own paddle — user input wins
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

  // ── Draw helpers (classic) ───────────────────────────────────────────────────

  function draw2PField(ctx: CanvasRenderingContext2D, g: GS, cw: number, ch: number) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, cw, ch);
    // Walls
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, cw, WALL_H);
    ctx.fillRect(0, ch - WALL_H, cw, WALL_H);
    // Dashed center line
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 4;
    ctx.setLineDash([12, 10]);
    ctx.beginPath();
    ctx.moveTo(cw / 2, WALL_H);
    ctx.lineTo(cw / 2, ch - WALL_H);
    ctx.stroke();
    ctx.setLineDash([]);
    // Paddles
    ctx.fillStyle = "#fff";
    ctx.fillRect(MARGIN, g.paddles.left  - PADDLE_LEN / 2, PADDLE_THICK, PADDLE_LEN);
    ctx.fillRect(cw - MARGIN - PADDLE_THICK, g.paddles.right - PADDLE_LEN / 2, PADDLE_THICK, PADDLE_LEN);
    drawBall(ctx, g);
    if (g.paused && g.pauseTimer > 30) drawCountdown(ctx, g.pauseTimer, cw, ch);
  }

  function drawMultiField(ctx: CanvasRenderingContext2D, g: GS, total: number, size: number) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, size, size);
    const wall = g.wallSide;
    // Center cross
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 10]);
    ctx.beginPath(); ctx.moveTo(size / 2, 0); ctx.lineTo(size / 2, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, size / 2); ctx.lineTo(size, size / 2); ctx.stroke();
    ctx.setLineDash([]);
    // Wall side
    if (wall) {
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      if (wall === "left")   ctx.fillRect(0, 0, MARGIN + PADDLE_THICK, size);
      if (wall === "right")  ctx.fillRect(size - MARGIN - PADDLE_THICK, 0, MARGIN + PADDLE_THICK, size);
      if (wall === "top")    ctx.fillRect(0, 0, size, MARGIN + PADDLE_THICK);
      if (wall === "bottom") ctx.fillRect(0, size - MARGIN - PADDLE_THICK, size, MARGIN + PADDLE_THICK);
    }
    if (total === 4) {
      drawCorner(ctx, 0,    0,    "tl");
      drawCorner(ctx, size, 0,    "tr");
      drawCorner(ctx, 0,    size, "bl");
      drawCorner(ctx, size, size, "br");
    }
    // Paddles (colored for player identification)
    sidesForPaddles(total, wall).forEach((side) => {
      ctx.fillStyle = SIDE_COLOR[side];
      const pos = g.paddles[side];
      if (side === "left")   ctx.fillRect(MARGIN, pos - PADDLE_LEN / 2, PADDLE_THICK, PADDLE_LEN);
      if (side === "right")  ctx.fillRect(size - MARGIN - PADDLE_THICK, pos - PADDLE_LEN / 2, PADDLE_THICK, PADDLE_LEN);
      if (side === "top")    ctx.fillRect(pos - PADDLE_LEN / 2, MARGIN, PADDLE_LEN, PADDLE_THICK);
      if (side === "bottom") ctx.fillRect(pos - PADDLE_LEN / 2, size - MARGIN - PADDLE_THICK, PADDLE_LEN, PADDLE_THICK);
    });
    drawBall(ctx, g);
    if (g.paused && g.pauseTimer > 30) drawCountdown(ctx, g.pauseTimer, size, size);
  }

  function drawCorner(ctx: CanvasRenderingContext2D, cx: number, cy: number, pos: "tl"|"tr"|"bl"|"br") {
    const s = CORNER_SIZE;
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.beginPath();
    if (pos === "tl") { ctx.moveTo(cx, cy); ctx.lineTo(cx + s, cy); ctx.lineTo(cx, cy + s); }
    if (pos === "tr") { ctx.moveTo(cx, cy); ctx.lineTo(cx - s, cy); ctx.lineTo(cx, cy + s); }
    if (pos === "bl") { ctx.moveTo(cx, cy); ctx.lineTo(cx + s, cy); ctx.lineTo(cx, cy - s); }
    if (pos === "br") { ctx.moveTo(cx, cy); ctx.lineTo(cx - s, cy); ctx.lineTo(cx, cy - s); }
    ctx.closePath(); ctx.fill();
  }

  function drawBall(ctx: CanvasRenderingContext2D, g: GS) {
    if (g.paused && g.pauseTimer >= 30) return;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(g.bx, g.by, BALL_R, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCountdown(ctx: CanvasRenderingContext2D, timer: number, cw: number, ch: number) {
    const n = Math.ceil(timer / 30);
    ctx.save();
    ctx.font = "bold 80px system-ui";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(String(n), cw / 2, ch / 2 + 28);
    ctx.restore();
  }

  // ── Physics ──────────────────────────────────────────────────────────────────

  function physics2P(g: GS, cw: number, ch: number): PongSide | null {
    // Walls top/bottom — bounce at inner wall edge
    if (g.by - BALL_R < WALL_H)        { g.by = WALL_H + BALL_R;        g.bvy =  Math.abs(g.bvy); audioManager.playSound("land"); }
    if (g.by + BALL_R > ch - WALL_H)   { g.by = ch - WALL_H - BALL_R;   g.bvy = -Math.abs(g.bvy); audioManager.playSound("land"); }

    // Left paddle
    const lpx = MARGIN + PADDLE_THICK;
    const prevBxL = g.bx - g.bvx;
    if (g.bvx < 0 && g.bx - BALL_R < lpx && prevBxL - BALL_R >= MARGIN - 2 &&
        inRange(g.by, g.paddles.left - PADDLE_LEN / 2 - BALL_R, g.paddles.left + PADDLE_LEN / 2 + BALL_R)) {
      const rel = (g.by - g.paddles.left) / (PADDLE_LEN / 2);
      g.speed = Math.min(g.speed + 0.35, MAX_SPEED);
      g.bvx =  g.speed * Math.cos(rel * 0.75);
      g.bvy =  g.speed * Math.sin(rel * 0.75);
      g.bx  = lpx + BALL_R + 1;
      audioManager.playSound("coconut_bounce");
    }

    // Right paddle
    const rpx = cw - MARGIN - PADDLE_THICK;
    const prevBxR = g.bx - g.bvx;
    if (g.bvx > 0 && g.bx + BALL_R > rpx && prevBxR + BALL_R <= cw - MARGIN + 2 &&
        inRange(g.by, g.paddles.right - PADDLE_LEN / 2 - BALL_R, g.paddles.right + PADDLE_LEN / 2 + BALL_R)) {
      const rel = (g.by - g.paddles.right) / (PADDLE_LEN / 2);
      g.speed = Math.min(g.speed + 0.35, MAX_SPEED);
      g.bvx = -g.speed * Math.cos(rel * 0.75);
      g.bvy =  g.speed * Math.sin(rel * 0.75);
      g.bx  = rpx - BALL_R - 1;
      audioManager.playSound("coconut_bounce");
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
      if (wall === "left") { g.bvx = Math.abs(g.bvx); g.bx = lx + BALL_R; audioManager.playSound("land"); }
      else if (inRange(g.bx - g.bvx - BALL_R, MARGIN - 2, lx) && inRange(g.by, g.paddles.left - PADDLE_LEN/2 - BALL_R, g.paddles.left + PADDLE_LEN/2 + BALL_R)) {
        const rel = (g.by - g.paddles.left) / (PADDLE_LEN / 2);
        g.speed = Math.min(g.speed + 0.3, MAX_SPEED);
        g.bvx =  g.speed * Math.cos(rel * 0.7);
        g.bvy =  g.speed * Math.sin(rel * 0.7);
        g.bx  = lx + BALL_R + 1;
        audioManager.playSound("coconut_bounce");
      } else if (g.bx + BALL_R < 0 && padSide.includes("left")) return "left";
    }

    // RIGHT
    const rx = size - MARGIN - PADDLE_THICK;
    if (g.bvx > 0 && g.bx + BALL_R > rx) {
      if (wall === "right") { g.bvx = -Math.abs(g.bvx); g.bx = rx - BALL_R; audioManager.playSound("land"); }
      else if (inRange(g.bx - g.bvx + BALL_R, rx, size - MARGIN + 2) && inRange(g.by, g.paddles.right - PADDLE_LEN/2 - BALL_R, g.paddles.right + PADDLE_LEN/2 + BALL_R)) {
        const rel = (g.by - g.paddles.right) / (PADDLE_LEN / 2);
        g.speed = Math.min(g.speed + 0.3, MAX_SPEED);
        g.bvx = -g.speed * Math.cos(rel * 0.7);
        g.bvy =  g.speed * Math.sin(rel * 0.7);
        g.bx  = rx - BALL_R - 1;
        audioManager.playSound("coconut_bounce");
      } else if (g.bx - BALL_R > size && padSide.includes("right")) return "right";
    }

    // TOP
    const ty = MARGIN + PADDLE_THICK;
    if (g.bvy < 0 && g.by - BALL_R < ty) {
      if (wall === "top") { g.bvy = Math.abs(g.bvy); g.by = ty + BALL_R; audioManager.playSound("land"); }
      else if (inRange(g.by - g.bvy - BALL_R, MARGIN - 2, ty) && inRange(g.bx, g.paddles.top - PADDLE_LEN/2 - BALL_R, g.paddles.top + PADDLE_LEN/2 + BALL_R)) {
        const rel = (g.bx - g.paddles.top) / (PADDLE_LEN / 2);
        g.speed = Math.min(g.speed + 0.3, MAX_SPEED);
        g.bvy =  g.speed * Math.cos(rel * 0.7);
        g.bvx =  g.speed * Math.sin(rel * 0.7);
        g.by  = ty + BALL_R + 1;
        audioManager.playSound("coconut_bounce");
      } else if (g.by + BALL_R < 0 && padSide.includes("top")) return "top";
    }

    // BOTTOM
    const by_ = size - MARGIN - PADDLE_THICK;
    if (g.bvy > 0 && g.by + BALL_R > by_) {
      if (wall === "bottom") { g.bvy = -Math.abs(g.bvy); g.by = by_ - BALL_R; audioManager.playSound("land"); }
      else if (inRange(g.by - g.bvy + BALL_R, by_, size - MARGIN + 2) && inRange(g.bx, g.paddles.bottom - PADDLE_LEN/2 - BALL_R, g.paddles.bottom + PADDLE_LEN/2 + BALL_R)) {
        const rel = (g.bx - g.paddles.bottom) / (PADDLE_LEN / 2);
        g.speed = Math.min(g.speed + 0.3, MAX_SPEED);
        g.bvy = -g.speed * Math.cos(rel * 0.7);
        g.bvx =  g.speed * Math.sin(rel * 0.7);
        g.by  = by_ - BALL_R - 1;
        audioManager.playSound("coconut_bounce");
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
    const newGs = initGS(totalPaddles, humanCount);
    gsRef.current = newGs;
    setScores({ left: 0, right: 0, top: 0, bottom: 0 });
    setLoser(null);
    frameRef.current = 0;
    resultWrittenRef.current = false;
    if (gameId) {
      updateDoc(doc(db, "pongGames", gameId), {
        status: "IN_PROGRESS",
        winnerId: null,
        scoreLeft: 0, scoreRight: 0, scoreTop: 0, scoreBottom: 0,
        ballX: newGs.bx, ballY: newGs.by, ballVX: newGs.bvx, ballVY: newGs.bvy,
        paused: true, pauseTimer: 90,
        wallSide: newGs.wallSide ?? null,
      }).catch(() => {});
    }
  }

  // ── Score display ─────────────────────────────────────────────────────────────
  function labelForSide(side: PongSide): string {
    if (humanCount === 1) {
      return side === mySide ? "Du" : `KI`;
    }
    if (side === mySide) return "Du";
    return opponentNames[side] ?? "Gegner";
  }

  const winnerSides = loser ? activeSides.filter((s) => s !== loser) : [];

  return (
    <div style={{ background: "#0a1628", height: "100dvh", overflow: "hidden", display: "flex", flexDirection: "column", userSelect: "none" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", padding: "12px 16px 8px", borderBottom: "1px solid #1e3050", flexShrink: 0, gap: 8 }}>
        <button onClick={() => navigate("/pong/lobby", { replace: true })} style={{ background: "none", border: "none", color: "var(--primary)", fontSize: 15, fontWeight: 700, cursor: "pointer", padding: 0 }}>
          ‹ Lobby
        </button>

        {/* Scores */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, overflowX: "auto" }}>
          {activeSides.map((side, i) => (
            <div key={side} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {i > 0 && <span style={{ color: "#1e3050", fontWeight: 900 }}>·</span>}
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 9, color: SIDE_COLOR[side], fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", whiteSpace: "nowrap" }}>
                  {labelForSide(side)}
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, color: scores[side] >= scoreLimit ? "var(--danger)" : "#e2e8f0", lineHeight: 1 }}>
                  {scores[side]}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button
            onClick={handleManualPause}
            style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 20, cursor: "pointer", padding: "4px 6px", lineHeight: 1 }}
            title={manualPaused ? "Weiterspielen" : "Pause"}
          >
            {manualPaused ? "▶" : "⏸"}
          </button>
          <button
            onClick={() => { setManualPaused(true); manualPausedRef.current = true; setShowQuitDialog(true); }}
            style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 18, cursor: "pointer", padding: "4px 6px", lineHeight: 1 }}
            title="Beenden"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", padding: "4px 4px 0" }}>
        <canvas
          ref={canvasRef}
          width={CW} height={CH}
          style={{
            width: is2P ? "auto" : "min(100%, calc(100dvh - 260px))",
            height: is2P ? "calc(100dvh - 260px)" : "min(100%, calc(100dvh - 260px))",
            maxWidth: is2P ? CW : undefined,
            maxHeight: is2P ? "100%" : undefined,
            touchAction: "none", display: "block",
          }}
        />
      </div>

      {/* Zone control strip */}
      <div
        ref={zoneRef}
        style={{
          height: "clamp(120px, 18vh, 180px)", background: "#0d0d0d", borderTop: "1px solid #1a1a1a",
          display: "flex", alignItems: "stretch", userSelect: "none",
          touchAction: "none", flexShrink: 0, cursor: "ns-resize",
        }}
      >
        {humanCount >= 2 ? (
          <>
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", borderRight: "1px solid #1a1a1a", gap: 8 }}>
              <div style={{ width: 3, height: 28, background: SIDE_COLOR.left, borderRadius: 2 }} />
              <span style={{ fontSize: 10, color: "#444", fontWeight: 700 }}>↕</span>
            </div>
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <span style={{ fontSize: 10, color: "#444", fontWeight: 700 }}>↕</span>
              <div style={{ width: 3, height: 28, background: SIDE_COLOR.right, borderRadius: 2 }} />
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {(mySide === "left" || mySide === "right") ? (
              <>
                <div style={{ width: 3, height: 32, background: SIDE_COLOR[mySide], borderRadius: 2 }} />
                <span style={{ fontSize: 11, color: "#444", fontWeight: 700 }}>↕</span>
              </>
            ) : (
              <>
                <div style={{ width: 32, height: 3, background: SIDE_COLOR[mySide], borderRadius: 2 }} />
                <span style={{ fontSize: 11, color: "#444", fontWeight: 700 }}>↔</span>
              </>
            )}
          </div>
        )}
      </div>

      {showQuitDialog && (
        <QuitConfirmDialog
          emoji="🏓"
          message="Das laufende Spiel wird beendet."
          onConfirm={() => navigate("/pong/lobby", { replace: true })}
          onDismiss={() => { setShowQuitDialog(false); setManualPaused(false); manualPausedRef.current = false; }}
        />
      )}

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
            {activeSides.map((side) => (
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
            <button onClick={() => navigate("/pong/lobby", { replace: true })} style={{
              background: "var(--surface2)", border: "1.5px solid var(--border)",
              borderRadius: "var(--radius)", color: "var(--text)",
              fontSize: 15, fontWeight: 700, padding: "15px 22px", cursor: "pointer",
            }}>Lobby</button>
          </div>
        </div>
      )}

      {hostGone && !loser && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(10,22,40,0.93)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50,
        }}>
          <div style={{ textAlign: "center", padding: 32 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔌</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#e2e8f0", marginBottom: 8 }}>Host nicht erreichbar</div>
            <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 24 }}>Verbindung zum Host unterbrochen.</div>
            <button
              onClick={() => navigate("/pong/lobby", { replace: true })}
              style={{
                background: "linear-gradient(135deg, var(--coral), #e8501a)",
                border: "none", borderRadius: "var(--radius)", color: "#fff",
                fontSize: 15, fontWeight: 800, padding: "14px 28px", cursor: "pointer",
              }}
            >Zur Lobby</button>
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
