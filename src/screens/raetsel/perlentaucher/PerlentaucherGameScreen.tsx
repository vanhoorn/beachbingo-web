import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  PerlentaucherBoardModel, generateLevel, cellKey,
  BOARD_SIZE, PIECE_COLORS,
  type PieceType, type SpecialType,
} from "./perlentaucherLogic";
import {
  savePuzzle, deletePuzzleSave, generateSaveId,
  getBestPerlentaucherScore, saveBestPerlentaucherScore, saveHighestPerlentaucherLevel,
} from "../../../puzzleSave";
import { GameSaveQuitDialog } from "../../../components/GameHudBar";

interface LocationState {
  level: number;
  saveId?: string;
  savedState?: string;
}

const ACCENT = "#0EA5E9";

export default function PerlentaucherGameScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const locState = (location.state ?? {}) as LocationState;

  const level = locState.level ?? 1;
  const config = useMemo(() => generateLevel(level), [level]);
  const saveIdRef = useRef<string>(locState.saveId ?? generateSaveId());

  // ── Initial state from save or fresh ──────────────────────────────────────
  const initData = useMemo(() => {
    if (locState.savedState) {
      try {
        const s = JSON.parse(locState.savedState);
        return { boardArr: s.board as number[], score: s.score as number, movesLeft: s.movesLeft as number };
      } catch { }
    }
    return { boardArr: null, score: 0, movesLeft: config.movesLeft };
  }, []);

  const boardModelRef = useRef<PerlentaucherBoardModel | null>(null);
  if (!boardModelRef.current) {
    boardModelRef.current = new PerlentaucherBoardModel(config.seed);
    if (initData.boardArr) boardModelRef.current.loadFromIntArray(initData.boardArr);
  }

  const scoreRef = useRef(initData.score);
  const movesLeftRef = useRef(initData.movesLeft);
  const gameWonRef = useRef(false);
  const gameLostRef = useRef(false);
  const winSavedRef = useRef(false); // true once best score + highest level are written

  const [score, setScore] = useState(initData.score);
  const [movesLeft, setMovesLeft] = useState(initData.movesLeft);
  const [boardTick, setBoardTick] = useState(0);
  const [clearedCells, setClearedCells] = useState<Set<string>>(new Set());
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null);
  const [invalidCells, setInvalidCells] = useState<Set<string>>(new Set());
  const [isAnimating, setIsAnimating] = useState(false);
  const [paused, setPaused] = useState(false);
  const [showQuit, setShowQuit] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [gameLost, setGameLost] = useState(false);
  const [newBest, setNewBest] = useState(false);
  const [fallingCells, setFallingCells] = useState<Map<string, number>>(new Map()); // key → fallPx
  const [filledCells, setFilledCells] = useState<Map<string, number>>(new Map());   // key → delay ms

  // ── Win-Save: sobald Score ≥ Ziel, unabhängig von Board-Phase ────────────
  useEffect(() => {
    if (winSavedRef.current || gameLostRef.current) return;
    if (score >= config.targetScore) {
      winSavedRef.current = true;
      const oldBest = getBestPerlentaucherScore(level) ?? 0;
      saveBestPerlentaucherScore(level, score);
      saveHighestPerlentaucherLevel(level + 1);
      deletePuzzleSave(saveIdRef.current);
      if (score > oldBest) setNewBest(true);
    }
  }, [score]);

  // ── Auto-save ──────────────────────────────────────────────────────────────
  const autoSave = useCallback(() => {
    const model = boardModelRef.current;
    if (!model || gameWonRef.current || gameLostRef.current) return;
    savePuzzle({
      id: saveIdRef.current,
      gameType: "perlentaucher",
      variant: `level_${level}`,
      difficulty: "standard",
      seed: config.seed,
      puzzleState: JSON.stringify({
        levelNumber: level,
        score: scoreRef.current,
        movesLeft: movesLeftRef.current,
        board: model.boardToIntArray(),
      }),
      startedAt: Date.now(),
      elapsedSeconds: 0,
    });
  }, [level, config.seed]);

  // ── Game loop ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const model = boardModelRef.current;
    if (!model) return;
    if (gameWonRef.current || gameLostRef.current) return;
    if (paused) return;

    let t1: ReturnType<typeof setTimeout>;
    let t2: ReturnType<typeof setTimeout>;

    switch (model.phase) {
      case 'MATCHING':
        t1 = setTimeout(() => {
          const result = model.applyMatches();
          result.specialGenCells.forEach(({ pos: [r, c], special }) => {
            const piece = model.board[r][c];
            if (piece) model.placeSpecial(r, c, piece.type, special);
          });
          scoreRef.current += result.pointsGained;
          setScore(scoreRef.current);
          if (result.clearedCells.size > 0) {
            setClearedCells(new Set(result.clearedCells));
            t2 = setTimeout(() => {
              setClearedCells(new Set());
              setBoardTick(n => n + 1);
            }, 210);
          } else {
            setBoardTick(n => n + 1);
          }
        }, 80);
        break;

      case 'FALLING':
        t1 = setTimeout(() => {
          // Snapshot empty counts per column before gravity for animation
          // (60ms delay: just enough for clearedCells render before gravity runs)
          const colEmpties: number[] = Array.from({ length: BOARD_SIZE }, (_, c) => {
            let e = 0;
            for (let r = 0; r < BOARD_SIZE; r++) if (!model.board[r][c]) e++;
            return e;
          });
          const changed = model.applyGravity();
          if (changed) {
            // Cells that received falling pieces animate from above
            const anims = new Map<string, number>();
            for (let c = 0; c < BOARD_SIZE; c++) {
              const e = colEmpties[c];
              if (e === 0) continue;
              for (let r = e; r < BOARD_SIZE; r++) {
                if (model.board[r][c]) anims.set(cellKey(r, c), Math.min(e, 5) * cellPx);
              }
            }
            if (anims.size > 0) {
              setFallingCells(anims);
              setTimeout(() => setFallingCells(new Map()), 380);
            }
          }
          setBoardTick(n => n + 1);
        }, 60);
        break;

      case 'FILLING': {
        const emptyBefore: [number, number][] = [];
        for (let c = 0; c < BOARD_SIZE; c++)
          for (let r = 0; r < BOARD_SIZE; r++)
            if (!model.board[r][c]) emptyBefore.push([r, c]);
        model.fillBoard();
        if (emptyBefore.length > 0) {
          const filled = new Map<string, number>();
          emptyBefore.forEach(([r, c]) => {
            if (model.board[r][c]) filled.set(cellKey(r, c), r * 28);
          });
          setFilledCells(filled);
          setTimeout(() => setFilledCells(new Map()), 650);
        }
        setBoardTick(n => n + 1);
        break;
      }

      case 'CHECK_DEADLOCK':
        model.checkDeadlock();
        setBoardTick(n => n + 1);
        break;

      case 'SHUFFLE':
        t1 = setTimeout(() => {
          model.shuffle();
          setBoardTick(n => n + 1);
        }, 280);
        break;

      case 'IDLE': {
        if (winSavedRef.current && !gameWonRef.current) {
          // Win-Save wurde bereits in useEffect([score]) geschrieben — Overlay zeigen
          gameWonRef.current = true;
          setGameWon(true);
        } else if (scoreRef.current >= config.targetScore && !gameWonRef.current) {
          // Fallback falls useEffect noch nicht lief
          winSavedRef.current = true;
          const oldBest = getBestPerlentaucherScore(level) ?? 0;
          saveBestPerlentaucherScore(level, scoreRef.current);
          saveHighestPerlentaucherLevel(level + 1);
          deletePuzzleSave(saveIdRef.current);
          gameWonRef.current = true;
          setNewBest(scoreRef.current > oldBest);
          setGameWon(true);
        } else if (movesLeftRef.current <= 0) {
          deletePuzzleSave(saveIdRef.current);
          gameLostRef.current = true;
          setGameLost(true);
        } else {
          autoSave();
        }
        break;
      }
    }

    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [boardTick, paused]);

  // ── Click interaction ──────────────────────────────────────────────────────
  const handleCellClick = useCallback((r: number, c: number) => {
    const model = boardModelRef.current;
    if (!model || isAnimating || model.phase !== 'IDLE' || paused || gameWon || gameLost || winSavedRef.current) return;
    const piece = model.board[r][c];

    if (!selectedCell) {
      if (piece) setSelectedCell([r, c]);
      return;
    }

    const [sr, sc] = selectedCell;
    if (sr === r && sc === c) { setSelectedCell(null); return; }

    const isAdjacent = Math.abs(sr - r) + Math.abs(sc - c) === 1;
    if (!isAdjacent) { setSelectedCell(piece ? [r, c] : null); return; }

    setSelectedCell(null);
    const result = model.trySwap(sr, sc, r, c);
    if (!result) {
      const flash = new Set([cellKey(sr, sc), cellKey(r, c)]);
      setInvalidCells(flash);
      setTimeout(() => setInvalidCells(new Set()), 320);
      setSelectedCell([sr, sc]);
      return;
    }

    setIsAnimating(true);
    movesLeftRef.current--;
    setMovesLeft(movesLeftRef.current);
    scoreRef.current += result.pointsGained;
    setScore(scoreRef.current);

    if (result.clearedCells.size > 0) setClearedCells(new Set(result.clearedCells));

    setTimeout(() => {
      setClearedCells(new Set());
      setIsAnimating(false);
      setBoardTick(n => n + 1);
    }, 200);
  }, [selectedCell, isAnimating, paused, gameWon, gameLost]);

  const board = boardModelRef.current?.board;
  const targetScore = config.targetScore;
  const progress = Math.min(1, scoreRef.current / targetScore);

  const cellPx = Math.min(Math.floor((Math.min(window.innerWidth, 520) - 40) / BOARD_SIZE), 60);
  const isIdle = !isAnimating && boardModelRef.current?.phase === 'IDLE' && !paused && !gameWon && !gameLost;

  return (
    <div className="screen" style={{ gap: 0, paddingTop: 0, userSelect: "none" }}>
      <style>{`
        @keyframes fallDown {
          from { transform: translateY(var(--fall-from)); }
          to   { transform: translateY(0); }
        }
        @keyframes fillIn {
          from { transform: translateY(var(--fall-from)) scale(0.82); opacity: 0; }
          to   { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes confettiFall {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          80%  { opacity: 0.8; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, var(--surface) 0%, var(--surface2) 100%)",
        padding: "12px 16px", display: "flex", alignItems: "center", gap: 10,
      }}>
        <button onClick={() => { setPaused(true); setShowQuit(true); }} style={backBtn}>‹</button>
        <span style={{ fontSize: 22 }}>🤿</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase" }}>
            Perlentaucher · Level {level}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: ACCENT }}>{score.toLocaleString()} Pkt.</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Ziel: {targetScore.toLocaleString()}</span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Züge</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: movesLeft <= 5 ? "var(--danger)" : "var(--text)", fontVariantNumeric: "tabular-nums" }}>
            {movesLeft}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: "var(--surface2)", position: "relative" }}>
        <div style={{
          position: "absolute", left: 0, top: 0, height: "100%",
          width: `${progress * 100}%`, background: ACCENT,
          transition: "width 0.4s ease",
        }} />
      </div>

      {/* Board */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "12px 8px" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${BOARD_SIZE}, ${cellPx}px)`,
          gap: 2,
          background: "var(--surface)",
          border: "2px solid var(--border)",
          borderRadius: 10,
          padding: 4,
        }}>
          {board && Array.from({ length: BOARD_SIZE }, (_, r) =>
            Array.from({ length: BOARD_SIZE }, (_, c) => {
              const piece = board[r][c];
              const key = cellKey(r, c);
              const isSelected = selectedCell?.[0] === r && selectedCell?.[1] === c;
              const isCleared = clearedCells.has(key);
              const isInvalid = invalidCells.has(key);
              const fallPx = fallingCells.get(key);
              const fillDelay = filledCells.get(key);
              const hasAnim = fallPx !== undefined || fillDelay !== undefined;
              const animStyle: Record<string, string | number> = {};
              if (fallPx !== undefined) {
                animStyle['--fall-from'] = `-${fallPx}px`;
                animStyle['animation'] = 'fallDown 0.28s ease-out forwards';
              } else if (fillDelay !== undefined) {
                animStyle['--fall-from'] = `-${cellPx * 3}px`;
                animStyle['animation'] = `fillIn 0.38s ${fillDelay}ms ease-out both`;
              }
              return (
                <div
                  key={key}
                  onClick={() => handleCellClick(r, c)}
                  style={{
                    width: cellPx, height: cellPx,
                    cursor: isIdle && piece ? "pointer" : "default",
                    position: "relative",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    borderRadius: 6,
                    background: isSelected
                      ? (piece ? PIECE_COLORS[piece.type] + "33" : "transparent")
                      : isInvalid ? "var(--danger)22" : "transparent",
                    outline: isSelected
                      ? `2.5px solid ${piece ? PIECE_COLORS[piece.type] : ACCENT}`
                      : isInvalid ? "2px solid var(--danger)" : "none",
                    transform: hasAnim ? undefined : (isSelected ? "scale(1.06)" : isCleared ? "scale(1.12)" : "scale(1)"),
                    opacity: isCleared ? 0 : 1,
                    transition: hasAnim ? "none" : "transform 0.12s, opacity 0.16s, background 0.1s",
                    ...animStyle,
                  } as React.CSSProperties}
                >
                  {piece && <PieceIcon type={piece.type} special={piece.special} size={cellPx - 6} />}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Controls */}
      <div style={{ background: "var(--surface)", borderTop: "1px solid var(--border)", padding: "10px 16px 24px", display: "flex", gap: 8, justifyContent: "center" }}>
        <button onClick={() => { setPaused(p => !p); }} style={ctrlBtn(paused ? ACCENT : "var(--text-muted)")}>
          {paused ? "▶" : "⏸"}
        </button>
        <button onClick={() => { setPaused(true); setShowQuit(true); }} style={ctrlBtn("var(--danger)")}>✕</button>
      </div>

      {/* Pause overlay */}
      {paused && !showQuit && !gameWon && !gameLost && (
        <div style={overlayStyle}>
          <div style={dialogStyle}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>⏸</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", marginBottom: 16 }}>Pausiert</div>
            <button onClick={() => setPaused(false)} style={{ ...ctrlBtn(ACCENT), width: "100%", padding: "14px 0", textAlign: "center" }}>
              ▶ Weiterspielen
            </button>
          </div>
        </div>
      )}

      {/* Win overlay */}
      {gameWon && (
        <>
          <Confetti />
          <div style={overlayStyle}>
            <div style={dialogStyle}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>{newBest ? "🏆" : "🎉"}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: newBest ? ACCENT : "var(--text)", marginBottom: 4 }}>
                {newBest ? "Neuer Rekord!" : "Level geschafft!"}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: ACCENT, marginBottom: 16 }}>
                {score.toLocaleString()} Punkte
              </div>
              <button
                onClick={() => navigate("/raetsel/perlentaucher/results", {
                  state: {
                    level,
                    score,
                    movesLeft,
                    bestScore: getBestPerlentaucherScore(level) ?? score,
                    newBestScore: newBest,
                  },
                })}
                style={{ ...ctrlBtn(ACCENT), width: "100%", padding: "14px 0", textAlign: "center", fontSize: 15, fontWeight: 700 }}
              >
                Ergebnisse anzeigen
              </button>
            </div>
          </div>
        </>
      )}

      {/* Loss overlay */}
      {gameLost && (
        <div style={overlayStyle}>
          <div style={dialogStyle}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🫧</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", marginBottom: 6 }}>Keine Züge mehr!</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
              Erreicht: {score.toLocaleString()} von {targetScore.toLocaleString()} Punkten
            </div>
            <button
              onClick={() => navigate("/raetsel/perlentaucher/game", { state: { level, _instance: Date.now() } })}
              style={{ ...ctrlBtn(ACCENT), width: "100%", padding: "14px 0", textAlign: "center", marginBottom: 8 }}
            >
              Nochmal versuchen
            </button>
            <button onClick={() => navigate(-1)} style={{ ...ctrlBtn("var(--text-muted)"), width: "100%", padding: "12px 0", textAlign: "center" }}>
              Zurück zur Lobby
            </button>
          </div>
        </div>
      )}

      {showQuit && (
        <GameSaveQuitDialog
          emoji="🤿"
          onContinue={() => { setShowQuit(false); setPaused(false); }}
          onSaveAndQuit={() => { autoSave(); navigate(-1); }}
          onQuitWithoutSave={() => { deletePuzzleSave(saveIdRef.current); navigate(-1); }}
        />
      )}
    </div>
  );
}

// ── Confetti ───────────────────────────────────────────────────────────────────

function Confetti() {
  const pieces = useMemo(() => {
    const colors = ['#0EA5E9', '#F97316', '#F59E0B', '#22C55E', '#7C3AED', '#F5EFE0', '#FB7185'];
    return Array.from({ length: 65 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 1.4,
      duration: 1.6 + Math.random() * 1.6,
      color: colors[i % colors.length],
      size: 6 + Math.floor(Math.random() * 9),
      isCircle: i % 3 === 0,
    }));
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 201, overflow: 'hidden' }}>
      {pieces.map((p, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${p.left}%`,
          top: '-30px',
          width: p.size,
          height: p.size,
          borderRadius: p.isCircle ? '50%' : '2px',
          background: p.color,
          animation: `confettiFall ${p.duration}s ${p.delay}s ease-in forwards`,
        }} />
      ))}
    </div>
  );
}

// ── Piece SVG rendering ────────────────────────────────────────────────────────

function PieceIcon({ type, special, size }: { type: PieceType; special: SpecialType; size: number }) {
  const color = PIECE_COLORS[type];
  const s = size;

  return (
    <svg width={s} height={s} viewBox="0 0 100 100" style={{ display: "block" }}>
      <PieceShape type={type} color={color} />
      {special !== 'NONE' && <SpecialOverlay special={special} />}
    </svg>
  );
}

function PieceShape({ type, color }: { type: PieceType; color: string }) {
  const dark = darken(color, 0.25);
  switch (type) {
    case 'PERLE':
      return (
        <g>
          <circle cx="50" cy="50" r="40" fill={color} stroke={dark} strokeWidth="2" />
          <ellipse cx="36" cy="34" rx="11" ry="7" fill="white" opacity="0.55" transform="rotate(-30,36,34)" />
        </g>
      );
    case 'SEEGLAS':
      return (
        <g>
          <polygon points="50,10 90,50 50,90 10,50" fill={color} stroke={dark} strokeWidth="2" />
          <polygon points="50,22 78,50 50,78 22,50" fill="none" stroke="white" strokeWidth="2" opacity="0.3" />
        </g>
      );
    case 'MUSCHEL': {
      const fanPath = "M50,82 L18,32 A37,37 0 0,1 82,32 Z";
      return (
        <g>
          <path d={fanPath} fill={color} stroke={dark} strokeWidth="2" />
          <line x1="50" y1="82" x2="50" y2="32" stroke="white" strokeWidth="1.5" opacity="0.4" />
          <line x1="50" y1="82" x2="26" y2="46" stroke="white" strokeWidth="1.5" opacity="0.4" />
          <line x1="50" y1="82" x2="74" y2="46" stroke="white" strokeWidth="1.5" opacity="0.4" />
          <line x1="50" y1="82" x2="17" y2="55" stroke="white" strokeWidth="1" opacity="0.25" />
          <line x1="50" y1="82" x2="83" y2="55" stroke="white" strokeWidth="1" opacity="0.25" />
        </g>
      );
    }
    case 'SEESTERN': {
      const pts = starPoints(50, 50, 42, 18, 5);
      return (
        <g>
          <polygon points={pts} fill={color} stroke={dark} strokeWidth="2" />
          <circle cx="50" cy="50" r="8" fill="white" opacity="0.3" />
        </g>
      );
    }
    case 'KORALLE':
      return (
        <g>
          <rect x="46" y="14" width="8" height="72" rx="4" fill={color} />
          <rect x="14" y="46" width="72" height="8" rx="4" fill={color} />
          <rect x="46" y="14" width="8" height="72" rx="4" fill={color} transform="rotate(45,50,50)" />
          <rect x="46" y="14" width="8" height="72" rx="4" fill={color} transform="rotate(-45,50,50)" />
          <circle cx="50" cy="50" r="9" fill={color} stroke={dark} strokeWidth="2" />
        </g>
      );
    case 'SEETANG':
      return (
        <g>
          <path d="M50,88 C32,72 68,56 50,40 C32,24 68,8 50,4" stroke={color} strokeWidth="9" fill="none" strokeLinecap="round" />
          <path stroke={dark} strokeWidth="9" strokeOpacity="0.2" d="M50,88 C32,72 68,56 50,40 C32,24 68,8 50,4" fill="none" strokeLinecap="round" />
          <ellipse cx="33" cy="60" rx="13" ry="6" fill={color} transform="rotate(-30,33,60)" />
          <ellipse cx="67" cy="38" rx="13" ry="6" fill={color} transform="rotate(30,67,38)" />
        </g>
      );
  }
}

function SpecialOverlay({ special }: { special: SpecialType }) {
  switch (special) {
    case 'GESTREIFT_H':
      return (
        <g opacity="0.75">
          <rect x="8" y="36" width="84" height="6" rx="3" fill="white" />
          <rect x="8" y="48" width="84" height="6" rx="3" fill="white" />
          <rect x="8" y="60" width="84" height="6" rx="3" fill="white" />
        </g>
      );
    case 'GESTREIFT_V':
      return (
        <g opacity="0.75">
          <rect x="36" y="8" width="6" height="84" rx="3" fill="white" />
          <rect x="48" y="8" width="6" height="84" rx="3" fill="white" />
          <rect x="60" y="8" width="6" height="84" rx="3" fill="white" />
        </g>
      );
    case 'EINGEPACKT':
      return (
        <g opacity="0.8">
          <rect x="10" y="10" width="80" height="80" rx="8" fill="none" stroke="white" strokeWidth="4" strokeDasharray="8 4" />
        </g>
      );
    case 'PERLENKETTE': {
      const rays = Array.from({ length: 8 }, (_, i) => {
        const a = (i * 45 * Math.PI) / 180;
        const x1 = 50 + Math.cos(a) * 24, y1 = 50 + Math.sin(a) * 24;
        const x2 = 50 + Math.cos(a) * 42, y2 = 50 + Math.sin(a) * 42;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="white" strokeWidth="3" strokeLinecap="round" />;
      });
      return <g opacity="0.85">{rays}</g>;
    }
    default:
      return null;
  }
}

// Compute outer/inner alternating polygon points for a star
function starPoints(cx: number, cy: number, outer: number, inner: number, points: number): string {
  const pts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = ((i * Math.PI) / points) - Math.PI / 2;
    pts.push(`${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`);
  }
  return pts.join(" ");
}

function darken(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.round(((n >> 16) & 0xff) * (1 - amount)));
  const g = Math.max(0, Math.round(((n >> 8) & 0xff) * (1 - amount)));
  const b = Math.max(0, Math.round((n & 0xff) * (1 - amount)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const backBtn: React.CSSProperties = {
  width: 36, height: 36, flexShrink: 0, background: "var(--surface2)",
  border: "1px solid var(--border)", borderRadius: 10, cursor: "pointer",
  fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text)",
};
const ctrlBtn = (color: string): React.CSSProperties => ({
  padding: "9px 20px", background: color + "22", border: `1px solid ${color}55`,
  borderRadius: 8, cursor: "pointer", fontSize: 15, fontWeight: 700, color,
});
const overlayStyle: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
};
const dialogStyle: React.CSSProperties = {
  background: "var(--surface)", border: "1px solid var(--border)",
  borderRadius: 20, padding: "28px 24px", maxWidth: 320, width: "90%", textAlign: "center",
};
