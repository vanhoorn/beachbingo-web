import { useEffect, useRef, useState, useCallback } from "react";
import { doc, onSnapshot, updateDoc, addDoc, collection, getDoc } from "firebase/firestore";
import { useLocation, useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase";
import type { VierDifficulty, VierGame } from "../../types";
import { DrinkPiece, getDrink } from "./drinkIcons";
import { GameHudBar, QuitConfirmDialog } from "../../components/GameHudBar";

const ROWS = 6;
const COLS = 7;

// ─── Board helpers ────────────────────────────────────────────────────────────

function emptyBoard(): number[] { return new Array(ROWS * COLS).fill(0); }

function getAvailableRow(board: number[], col: number): number {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r * COLS + col] === 0) return r;
  }
  return -1;
}

function dropPiece(board: number[], col: number, player: number): number[] {
  const row = getAvailableRow(board, col);
  if (row === -1) return board;
  const next = [...board];
  next[row * COLS + col] = player;
  return next;
}

function checkWin(board: number[], player: number): [boolean, number[]] {
  const wins: number[] = [];
  // Horizontal
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      const idxs = [0, 1, 2, 3].map(i => r * COLS + c + i);
      if (idxs.every(i => board[i] === player)) { idxs.forEach(i => wins.push(i)); }
    }
  }
  // Vertical
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r <= ROWS - 4; r++) {
      const idxs = [0, 1, 2, 3].map(i => (r + i) * COLS + c);
      if (idxs.every(i => board[i] === player)) { idxs.forEach(i => wins.push(i)); }
    }
  }
  // Diagonal ↘
  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      const idxs = [0, 1, 2, 3].map(i => (r + i) * COLS + (c + i));
      if (idxs.every(i => board[i] === player)) { idxs.forEach(i => wins.push(i)); }
    }
  }
  // Diagonal ↗
  for (let r = 3; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      const idxs = [0, 1, 2, 3].map(i => (r - i) * COLS + (c + i));
      if (idxs.every(i => board[i] === player)) { idxs.forEach(i => wins.push(i)); }
    }
  }
  const unique = [...new Set(wins)];
  return [unique.length > 0, unique];
}

function isDraw(board: number[]): boolean {
  return board.every(x => x !== 0);
}

// ─── AI (Minimax + Alpha-Beta) ────────────────────────────────────────────────

function scoreWindow(window: number[], player: number): number {
  const opp = player === 1 ? 2 : 1;
  const mine = window.filter(x => x === player).length;
  const empty = window.filter(x => x === 0).length;
  const oppC = window.filter(x => x === opp).length;
  if (mine === 4) return 100;
  if (mine === 3 && empty === 1) return 5;
  if (mine === 2 && empty === 2) return 2;
  if (oppC === 3 && empty === 1) return -4;
  return 0;
}

function scoreBoard(board: number[], player: number): number {
  let score = 0;
  const centerCol = 3;
  for (let r = 0; r < ROWS; r++) score += board[r * COLS + centerCol] === player ? 3 : 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) score += scoreWindow([0,1,2,3].map(i => board[r*COLS+c+i]), player);
  }
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r <= ROWS - 4; r++) score += scoreWindow([0,1,2,3].map(i => board[(r+i)*COLS+c]), player);
  }
  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 0; c <= COLS - 4; c++) score += scoreWindow([0,1,2,3].map(i => board[(r+i)*COLS+(c+i)]), player);
  }
  for (let r = 3; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) score += scoreWindow([0,1,2,3].map(i => board[(r-i)*COLS+(c+i)]), player);
  }
  return score;
}

function isTerminalBoard(board: number[]): boolean {
  return checkWin(board, 1)[0] || checkWin(board, 2)[0] || isDraw(board);
}

function minimax(board: number[], depth: number, alpha: number, beta: number, maximizing: boolean, ai: number): number {
  const human = ai === 1 ? 2 : 1;
  if (depth === 0 || isTerminalBoard(board)) {
    if (checkWin(board, ai)[0]) return 100000 + depth;
    if (checkWin(board, human)[0]) return -100000 - depth;
    return scoreBoard(board, ai);
  }
  const cols = [3,2,4,1,5,0,6].filter(c => getAvailableRow(board, c) !== -1);
  if (maximizing) {
    let best = -Infinity;
    for (const c of cols) {
      const score = minimax(dropPiece(board, c, ai), depth - 1, alpha, beta, false, ai);
      best = Math.max(best, score); alpha = Math.max(alpha, best);
      if (alpha >= beta) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const c of cols) {
      const score = minimax(dropPiece(board, c, human), depth - 1, alpha, beta, true, ai);
      best = Math.min(best, score); beta = Math.min(beta, best);
      if (alpha >= beta) break;
    }
    return best;
  }
}

function getBestMove(board: number[], ai: number, difficulty: VierDifficulty): number {
  const cols = [3,2,4,1,5,0,6].filter(c => getAvailableRow(board, c) !== -1);
  // Rookie: 40% random, Sniper: 15% random, BossLevel: always optimal
  const randomChance = difficulty === "ROOKIE" ? 0.4 : difficulty === "SNIPER" ? 0.15 : 0;
  if (Math.random() < randomChance) return cols[Math.floor(Math.random() * cols.length)];
  let bestCol = cols[0];
  let bestScore = -Infinity;
  for (const c of cols) {
    const score = minimax(dropPiece(board, c, ai), 5, -Infinity, Infinity, false, ai);
    if (score > bestScore) { bestScore = score; bestCol = c; }
  }
  return bestCol;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface LocationState {
  mode: "ai" | "online";
  myDrinkId: string;
  aiDrinkId?: string;
  aiDifficulty?: VierDifficulty;
  gameId?: string;
}

interface LocalState {
  board: number[];
  currentPlayer: 1 | 2;
  winner: number | null;
  draw: boolean;
  winCells: number[];
  aiThinking: boolean;
}

interface DroppedCell { cell: number; row: number; key: number; }

export default function VierGameScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState;
  const uid = auth.currentUser?.uid;

  const { mode, myDrinkId, aiDrinkId, aiDifficulty = "SNIPER", gameId } = state ?? {};

  // Local state (AI mode + shared UI state)
  const [local, setLocal] = useState<LocalState>({
    board: emptyBoard(),
    currentPlayer: 1,
    winner: null,
    draw: false,
    winCells: [],
    aiThinking: false,
  });

  // Online mode state
  const [onlineGame, setOnlineGame] = useState<VierGame | null>(null);
  const [hoverCol, setHoverCol] = useState<number | null>(null);

  // Drop animation tracking
  const [lastDropped, setLastDropped] = useState<DroppedCell | null>(null);
  const dropKeyRef = useRef(0);

  const aiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localRef = useRef(local);
  useEffect(() => { localRef.current = local; }, [local]);

  // Load user profile for result saving
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

  // Save AI game result to Firestore when game ends
  const resultWrittenRef = useRef(false);
  useEffect(() => {
    if (mode !== "ai") return;
    if (local.winner === null && !local.draw) return;
    if (resultWrittenRef.current) return;
    resultWrittenRef.current = true;
    const profile = userProfileRef.current;
    if (!uid || !profile) return;
    addDoc(collection(db, "vierGames"), {
      adminId: uid,
      status: "FINISHED",
      humanCount: 1,
      players: [{ userId: uid, displayName: profile.displayName, avatarUrl: profile.avatarUrl, drinkId: myDrinkId }],
      playerIds: [uid],
      board: local.board,
      currentTurn: uid,
      winnerId: local.winner === 1 ? uid : null,
      isDraw: local.draw,
      createdAt: Date.now(),
    });
  }, [local.winner, local.draw, mode, uid, myDrinkId]);

  // Online: detect newly placed piece by diffing boards
  const prevBoardRef = useRef<number[]>(emptyBoard());
  useEffect(() => {
    if (!onlineGame) return;
    const prev = prevBoardRef.current;
    const next = onlineGame.board;
    for (let i = 0; i < next.length; i++) {
      if (prev[i] === 0 && next[i] !== 0) {
        dropKeyRef.current += 1;
        setLastDropped({ cell: i, row: Math.floor(i / COLS), key: dropKeyRef.current });
        break;
      }
    }
    prevBoardRef.current = [...next];
  }, [onlineGame?.board.join(",")]);

  // ── Online: subscribe to Firestore ──
  useEffect(() => {
    if (mode !== "online" || !gameId) return;
    const unsub = onSnapshot(doc(db, "vierGames", gameId), (snap) => {
      if (!snap.exists()) return;
      setOnlineGame({ gameId: snap.id, ...snap.data() } as VierGame);
    });
    return () => unsub();
  }, [mode, gameId]);

  // ── AI: trigger AI move ──
  useEffect(() => {
    if (mode !== "ai") return;
    if (local.currentPlayer !== 2) return;
    if (local.winner !== null || local.draw) return;

    aiTimeoutRef.current = setTimeout(() => {
      const prev = localRef.current;
      if (prev.currentPlayer !== 2 || prev.winner !== null || prev.draw) return;
      const col = getBestMove(prev.board, 2, aiDifficulty);
      const row = getAvailableRow(prev.board, col);
      const newBoard = dropPiece(prev.board, col, 2);
      const [won, winCells] = checkWin(newBoard, 2);
      const draw = !won && isDraw(newBoard);
      dropKeyRef.current += 1;
      setLastDropped({ cell: row * COLS + col, row, key: dropKeyRef.current });
      setLocal({ ...prev, board: newBoard, currentPlayer: 1, winner: won ? 2 : null, draw, winCells, aiThinking: false });
    }, 500);

    return () => { if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current); };
  }, [local.currentPlayer, local.winner, local.draw, mode]);

  // ── Human drop (AI mode) ──
  const handleDropAi = useCallback((col: number) => {
    if (local.currentPlayer !== 1 || local.winner !== null || local.draw || local.aiThinking) return;
    const row = getAvailableRow(local.board, col);
    if (row === -1) return;

    const newBoard = dropPiece(local.board, col, 1);
    const [won, winCells] = checkWin(newBoard, 1);
    const draw = !won && isDraw(newBoard);
    dropKeyRef.current += 1;
    setLastDropped({ cell: row * COLS + col, row, key: dropKeyRef.current });
    setLocal({ board: newBoard, currentPlayer: 2, winner: won ? 1 : null, draw, winCells, aiThinking: !won && !draw });
  }, [local]);

  // ── Human drop (Online mode) ──
  async function handleDropOnline(col: number) {
    if (!onlineGame || !gameId || !uid) return;
    if (onlineGame.currentTurn !== uid) return;
    if (onlineGame.status !== "RUNNING") return;
    if (getAvailableRow(onlineGame.board, col) === -1) return;

    const myPlayerIndex = onlineGame.players.findIndex(p => p.userId === uid);
    const myPiece = myPlayerIndex + 1; // 1 or 2
    const newBoard = dropPiece(onlineGame.board, col, myPiece);
    const [won, winCells] = checkWin(newBoard, myPiece);
    const draw = !won && isDraw(newBoard);
    const opponentId = onlineGame.players.find(p => p.userId !== uid)?.userId ?? uid;

    await updateDoc(doc(db, "vierGames", gameId), {
      board: newBoard,
      currentTurn: opponentId,
      winnerId: won ? uid : null,
      isDraw: draw,
      status: (won || draw) ? "FINISHED" : "RUNNING",
      ...(won ? { winCells } : {}),
    });
  }

  // ── Restart (AI mode) ──
  function restartAi() {
    setLocal({ board: emptyBoard(), currentPlayer: 1, winner: null, draw: false, winCells: [], aiThinking: false });
  }

  // ── Determine display values ──
  const isAiMode = mode === "ai";

  let board: number[];
  let winCells: number[];
  let winner: number | null;
  let draw: boolean;
  let myPiece: 1 | 2;
  let opponentDrinkId: string;
  let myTurn: boolean;
  let aiThinking: boolean;

  if (isAiMode) {
    board = local.board;
    winCells = local.winCells;
    winner = local.winner;
    draw = local.draw;
    myPiece = 1;
    opponentDrinkId = aiDrinkId ?? "whisky";
    myTurn = local.currentPlayer === 1;
    aiThinking = local.aiThinking;
  } else {
    board = onlineGame?.board ?? emptyBoard();
    winCells = [];
    winner = onlineGame?.winnerId
      ? onlineGame.players.findIndex(p => p.userId === onlineGame.winnerId) + 1
      : null;
    draw = onlineGame?.isDraw ?? false;
    myPiece = (onlineGame?.players.findIndex(p => p.userId === uid) ?? 0) + 1 as 1 | 2;
    opponentDrinkId = onlineGame?.players.find(p => p.userId !== uid)?.drinkId ?? "whisky";
    myTurn = onlineGame?.currentTurn === uid;
    aiThinking = false;
  }

  const myDrink = getDrink(myDrinkId);
  const oppDrink = getDrink(opponentDrinkId);

  const gameOver = winner !== null || draw;

  const [showQuitDialog, setShowQuitDialog] = useState(false);

  function handleDrop(col: number) {
    if (gameOver) return;
    if (isAiMode) handleDropAi(col);
    else handleDropOnline(col);
  }

  // Piece size based on viewport (mobile-first: max 340px board / 7 cols)
  const CELL = 46;
  const PIECE = 38;

  return (
    <div className="screen" style={{ gap: 16, alignItems: "center" }}>

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", maxWidth: 360 }}>
        <button className="btn btn-outline btn-sm" onClick={() => navigate("/vier/lobby")}>
          ‹ Lobby
        </button>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-muted)" }}>
          {isAiMode ? "vs KI" : `Code: ${gameId}`}
        </div>
      </div>

      {/* Player indicators */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, width: "100%", maxWidth: 360 }}>
        <PlayerBar
          drinkId={myDrinkId}
          label="Du"
          isActive={!gameOver && myTurn}
          isWinner={winner === myPiece}
          color={myDrink.color}
        />
        <div style={{ fontSize: 18, color: "var(--text-muted)", fontWeight: 700 }}>vs</div>
        <PlayerBar
          drinkId={opponentDrinkId}
          label={isAiMode ? "KI" : "Gegner"}
          isActive={!gameOver && !myTurn}
          isWinner={winner !== null && winner !== myPiece}
          color={oppDrink.color}
          flip
        />
      </div>

      {/* Board */}
      <div
        style={{
          background: "#0c1f3d",
          borderRadius: 16,
          padding: 10,
          border: "2px solid #1e3a5f",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          overflow: "visible",
          position: "relative",
        }}
        onMouseLeave={() => setHoverCol(null)}
      >
        {/* Drop indicators */}
        <div style={{ display: "flex", marginBottom: 6, gap: 4 }}>
          {Array.from({ length: COLS }, (_, col) => {
            const available = getAvailableRow(board, col) !== -1;
            return (
              <div
                key={col}
                style={{
                  width: CELL, height: 14,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: (!gameOver && myTurn && available) ? "pointer" : "default",
                }}
                onClick={() => handleDrop(col)}
                onMouseEnter={() => setHoverCol(col)}
              >
                {hoverCol === col && !gameOver && myTurn && available && (
                  <div style={{
                    width: 10, height: 10, borderRadius: "50%",
                    background: myDrink.color,
                    opacity: 0.8,
                    animation: "pulse 0.8s infinite",
                  }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Grid */}
        {Array.from({ length: ROWS }, (_, row) => (
          <div key={row} style={{ display: "flex", gap: 4, marginBottom: row < ROWS - 1 ? 4 : 0 }}>
            {Array.from({ length: COLS }, (_, col) => {
              const cellIdx = row * COLS + col;
              const piece = board[cellIdx];
              const isWinCell = winCells.includes(cellIdx);
              const drinkId = piece === 1
                ? (myPiece === 1 ? myDrinkId : opponentDrinkId)
                : piece === 2
                  ? (myPiece === 2 ? myDrinkId : opponentDrinkId)
                  : null;

              const isDropping = lastDropped?.cell === cellIdx;
              // Fall distance: from above board top to this row (each row = CELL+4 px tall)
              const dropDistPx = isDropping ? (lastDropped!.row * (CELL + 4) + CELL + 20) : 0;
              const dropDuration = isDropping ? Math.max(0.2, 0.12 + lastDropped!.row * 0.055) : 0;

              return (
                <div
                  key={col}
                  onClick={() => handleDrop(col)}
                  onMouseEnter={() => setHoverCol(col)}
                  style={{
                    width: CELL, height: CELL,
                    borderRadius: "50%",
                    background: piece === 0 ? "#091525" : "transparent",
                    border: `2px solid ${piece === 0 ? "#1e3a5f" : "transparent"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: (!gameOver && myTurn && piece === 0 && getAvailableRow(board, col) === row)
                      ? "pointer" : "default",
                    boxShadow: isWinCell ? `0 0 12px ${piece === 1 ? getDrink(myPiece === 1 ? myDrinkId : opponentDrinkId).shadowColor : getDrink(myPiece === 2 ? myDrinkId : opponentDrinkId).shadowColor}` : "none",
                    animation: isWinCell ? "winPulse 0.6s ease infinite alternate" : "none",
                    position: "relative",
                  }}
                >
                  {drinkId && (
                    <div
                      key={isDropping ? lastDropped!.key : cellIdx}
                      style={{
                        ...(isDropping ? {
                          '--drop-dist': `-${dropDistPx}px`,
                          animation: `dropFall ${dropDuration}s cubic-bezier(0.4, 0, 1, 1)`,
                          position: "relative",
                          zIndex: 10,
                        } as React.CSSProperties : {}),
                      }}
                      onAnimationEnd={() => setLastDropped(prev => prev?.cell === cellIdx ? null : prev)}
                    >
                      <DrinkPiece drinkId={drinkId} size={PIECE} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Status */}
      {!gameOver && (
        <div style={{ fontSize: 14, color: "var(--text-muted)", textAlign: "center" }}>
          {aiThinking ? "🤖 KI denkt nach…" : myTurn ? "Dein Zug — wähle eine Spalte" : "Gegner ist dran…"}
        </div>
      )}

      {/* Game Over Overlay */}
      {gameOver && (
        <div style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: 24,
          textAlign: "center",
          width: "100%", maxWidth: 340,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
          animation: "fadeIn 0.3s ease",
        }}>
          {draw ? (
            <>
              <div style={{ fontSize: 52 }}>🤝</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)" }}>Unentschieden!</div>
              <div style={{ fontSize: 14, color: "var(--text-muted)" }}>Nochmal?</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 52 }}>{winner === myPiece ? "🏆" : "😅"}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)" }}>
                {winner === myPiece ? "Du gewinnst!" : isAiMode ? "KI gewinnt!" : "Gegner gewinnt!"}
              </div>
              <DrinkPiece drinkId={winner === myPiece ? myDrinkId : opponentDrinkId} size={56} />
              <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
                {winner === myPiece ? "Prost! 🍺" : "Beim nächsten Mal!"}
              </div>
            </>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            {isAiMode && (
              <button className="btn btn-primary" onClick={restartAi} style={{ background: "#C2410C", borderColor: "#C2410C" }}>
                Nochmal spielen
              </button>
            )}
            <button className="btn btn-outline" onClick={() => navigate("/vier/lobby")}>
              Zur Lobby
            </button>
          </div>
        </div>
      )}

      <GameHudBar
        paused={false}
        onPauseToggle={() => {}}
        onQuit={() => setShowQuitDialog(true)}
        pauseDisabled={true}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
          {gameOver ? "Spiel beendet" : myTurn ? "Du bist dran" : "Gegner denkt..."}
        </div>
      </GameHudBar>

      {showQuitDialog && (
        <QuitConfirmDialog
          message="Das laufende Spiel wird beendet."
          onConfirm={() => navigate("/vier/lobby")}
          onDismiss={() => setShowQuitDialog(false)}
        />
      )}

      <style>{`
        @keyframes dropFall {
          0%   { transform: translateY(var(--drop-dist)); }
          80%  { transform: translateY(0); }
          90%  { transform: translateY(-7px); }
          96%  { transform: translateY(3px); }
          100% { transform: translateY(0); }
        }
        @keyframes winPulse { from { transform: scale(1); } to { transform: scale(1.08); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.3); } }
      `}</style>
    </div>
  );
}

function PlayerBar({ drinkId, label, isActive, isWinner, color, flip }: {
  drinkId: string; label: string; isActive: boolean; isWinner: boolean; color: string; flip?: boolean;
}) {
  return (
    <div style={{
      flex: 1,
      background: isWinner ? `${color}22` : isActive ? `${color}11` : "var(--surface)",
      border: `1.5px solid ${isActive || isWinner ? color : "var(--border)"}`,
      borderRadius: "var(--radius-sm)",
      padding: "10px 12px",
      display: "flex", alignItems: "center",
      gap: 10,
      flexDirection: flip ? "row-reverse" : "row",
      transition: "all 0.2s",
    }}>
      <DrinkPiece drinkId={drinkId} size={36} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textAlign: flip ? "right" : "left" }}>
          {label}
        </div>
        {isActive && !isWinner && (
          <div style={{ fontSize: 11, color, fontWeight: 700, textAlign: flip ? "right" : "left" }}>Am Zug</div>
        )}
        {isWinner && (
          <div style={{ fontSize: 11, color: "#F59E0B", fontWeight: 700, textAlign: flip ? "right" : "left" }}>🏆 Gewonnen</div>
        )}
      </div>
    </div>
  );
}
