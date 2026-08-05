import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  DIFFICULTY_CONFIG, computeStatuses, computeKeyStatuses, isValidGuess,
  validateHardMode, createInitialState, serializeState, deserializeState,
  recordResult, getStats, getRandomWord, initWwWordLists, isWwReady,
  type WortWelleDifficulty, type LetterStatus, type GameStatus,
} from "./wortwelleLogic";
import { savePuzzle, generateSaveId, deletePuzzleSave, getBestTime, recordBestTime, formatElapsed } from "../../../puzzleSave";
import { GameSaveQuitDialog } from "../../../components/GameHudBar";

const ACCENT = "#06b6d4";

interface LocationState {
  difficulty: WortWelleDifficulty;
  mode: "random" | "daily";
  dailyWord?: string;
  dateStr?: string;
  saveId?: string;
  savedState?: string;
  elapsedSeconds?: number;
}

const STATUS_COLORS: Record<LetterStatus, { bg: string; border: string; text: string }> = {
  correct: { bg: "#22c55e", border: "#22c55e", text: "#000" },
  present:  { bg: "#eab308", border: "#eab308", text: "#000" },
  absent:   { bg: "#374151", border: "#374151", text: "#9ca3af" },
  empty:    { bg: "transparent", border: "#374151", text: "var(--text)" },
  typing:   { bg: "transparent", border: ACCENT, text: "var(--text)" },
};

const KEYBOARD_ROWS = [
  ["Q","W","E","R","T","Z","U","I","O","P","←"],
  ["A","S","D","F","G","H","J","K","L"],
  ["Y","X","C","V","B","N","M","↵"],
];

const RULES_TEXT = [
  "Errate das versteckte Wort in möglichst wenigen Versuchen.",
  "🟩 Grün: Buchstabe ist richtig und an der richtigen Stelle.",
  "🟨 Gelb: Buchstabe ist im Wort, aber an der falschen Stelle.",
  "⬛ Grau: Buchstabe kommt im Wort nicht vor.",
  "Umlaute werden ersetzt: Ä→AE, Ö→OE, Ü→UE, ß→SS (z.B. BÖSE = BOESE).",
];

export default function WortWelleGameScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const locState = (location.state ?? {}) as LocationState;

  const difficulty = locState.difficulty ?? "mittel";
  const mode = locState.mode ?? "random";
  const cfg = DIFFICULTY_CONFIG[difficulty];

  const saveIdRef = useRef<string>(locState.saveId ?? generateSaveId());
  const resultRecordedRef = useRef(false);

  const [targetWord, setTargetWord] = useState<string>(() => {
    if (locState.dailyWord) return locState.dailyWord;
    if (locState.savedState) return (JSON.parse(locState.savedState) as { targetWord: string }).targetWord;
    if (isWwReady()) return getRandomWord(difficulty);
    return "";
  });

  // Safety-init: falls direkt zur GameScreen navigiert ohne Lobby-Init
  useEffect(() => {
    if (!isWwReady()) {
      initWwWordLists().then(() => {
        if (!targetWord) setTargetWord(getRandomWord(difficulty));
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [gs, setGs] = useState(() => {
    if (locState.savedState) return deserializeState(locState.savedState);
    return createInitialState(targetWord);
  });

  const [cells, setCells] = useState<string[]>(() => {
    const saved = locState.savedState
      ? (JSON.parse(locState.savedState) as { currentInput: string }).currentInput
      : "";
    const arr = new Array(cfg.wordLength).fill("");
    for (let i = 0; i < Math.min(saved.length, cfg.wordLength); i++) {
      if (saved[i] && saved[i].trim()) arr[i] = saved[i];
    }
    return arr;
  });

  const [cursorPos, setCursorPos] = useState<number>(() => {
    const saved = locState.savedState
      ? (JSON.parse(locState.savedState) as { currentInput: string }).currentInput
      : "";
    const firstEmpty = Array.from({ length: cfg.wordLength }, (_, i) => saved[i] ?? "").findIndex(c => !c || !c.trim());
    return firstEmpty === -1 ? cfg.wordLength - 1 : Math.max(0, firstEmpty);
  });

  const [elapsed, setElapsed] = useState(locState.elapsedSeconds ?? 0);
  const [running, setRunning] = useState(true);
  const [shake, setShake] = useState(false);
  const [flip, setFlip] = useState<number | null>(null);  // row index
  const [showQuit, setShowQuit] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showWin, setShowWin] = useState(false);
  const [showLose, setShowLose] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const bestTime = getBestTime("wortwelle", difficulty, difficulty);

  // Timer
  useEffect(() => {
    if (!running || gs.gameStatus !== "playing") return;
    const id = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(id);
  }, [running, gs.gameStatus]);


  // Auto-Save (alle 5s, nur im playing-Zustand, nur Random-Modus)
  useEffect(() => {
    if (gs.gameStatus !== "playing" || mode === "daily") return;
    const id = setInterval(() => {
      savePuzzle({
        id: saveIdRef.current,
        gameType: "wortwelle",
        variant: mode,
        difficulty,
        seed: 0,
        puzzleState: serializeState(gs),
        startedAt: Date.now(),
        elapsedSeconds: elapsed,
      });
    }, 5000);
    return () => clearInterval(id);
  }, [gs, elapsed, difficulty, mode]);

  // Gewinn/Verlust-Erkennung
  useEffect(() => {
    if (resultRecordedRef.current) return;
    if (gs.gameStatus === "won") {
      resultRecordedRef.current = true;
      setRunning(false);
      recordBestTime("wortwelle", difficulty, difficulty, elapsed);
      recordResult(difficulty, true, gs.guesses.length, mode === "daily", locState.dateStr);
      deletePuzzleSave(saveIdRef.current);
      setTimeout(() => setShowWin(true), cfg.wordLength * 150 + 200);
    } else if (gs.gameStatus === "lost") {
      resultRecordedRef.current = true;
      setRunning(false);
      recordResult(difficulty, false, gs.guesses.length, mode === "daily", locState.dateStr);
      deletePuzzleSave(saveIdRef.current);
      setTimeout(() => setShowLose(true), 400);
    }
  }, [gs.gameStatus, gs.guesses.length, difficulty, elapsed, mode, locState.dateStr, cfg.wordLength]);

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 2000);
  };

  const submitGuess = useCallback(() => {
    if (cells.some(c => c === "")) {
      setShake(true);
      showError(`Bitte ${cfg.wordLength} Buchstaben eingeben.`);
      setTimeout(() => setShake(false), 500);
      return;
    }
    const input = cells.join("").toUpperCase();
    if (!isValidGuess(input, difficulty)) {
      setShake(true);
      showError("Unbekanntes Wort.");
      setTimeout(() => setShake(false), 500);
      return;
    }
    if (cfg.hardMode) {
      const violation = validateHardMode(input, gs.guesses, targetWord);
      if (violation) {
        setShake(true);
        showError(violation);
        setTimeout(() => setShake(false), 500);
        return;
      }
    }
    const newGuesses = [...gs.guesses, input];
    const won = input === targetWord;
    const lost = !won && newGuesses.length >= cfg.maxGuesses;
    const newStatus: GameStatus = won ? "won" : lost ? "lost" : "playing";

    setFlip(newGuesses.length - 1);
    setTimeout(() => setFlip(null), cfg.wordLength * 150 + 200);

    setCells(new Array(cfg.wordLength).fill(""));
    setCursorPos(0);
    setGs({
      guesses: newGuesses,
      currentInput: "",
      gameStatus: newStatus,
      targetWord: targetWord,
      hardModeViolation: null,
    });
  }, [cells, gs.guesses, cfg, difficulty, targetWord]);

  const handleKey = useCallback((key: string) => {
    if (gs.gameStatus !== "playing") return;
    if (key === "←" || key === "Backspace") {
      if (cells[cursorPos] !== "") {
        const next = [...cells];
        next[cursorPos] = "";
        setCells(next);
        setGs(prev => ({ ...prev, currentInput: next.join("") }));
      } else if (cursorPos > 0) {
        const newPos = cursorPos - 1;
        const next = [...cells];
        next[newPos] = "";
        setCells(next);
        setCursorPos(newPos);
        setGs(prev => ({ ...prev, currentInput: next.join("") }));
      }
      return;
    }
    if (key === "↵" || key === "Enter") {
      submitGuess();
      return;
    }
    const ch = key.toUpperCase();
    if (/^[A-Z]$/.test(ch)) {
      const next = [...cells];
      next[cursorPos] = ch;
      setCells(next);
      setGs(prev => ({ ...prev, currentInput: next.join("") }));
      if (cursorPos < cfg.wordLength - 1) setCursorPos(cursorPos + 1);
    }
  }, [gs.gameStatus, cells, cursorPos, cfg.wordLength, submitGuess]);

  // Physische Tastatur
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Backspace") { handleKey("←"); return; }
      if (e.key === "Enter") { handleKey("↵"); return; }
      if (e.key.length === 1) handleKey(e.key);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleKey]);

  const keyStatuses = computeKeyStatuses(gs.guesses, targetWord);

  const handleQuitSave = () => {
    savePuzzle({
      id: saveIdRef.current, gameType: "wortwelle", variant: mode,
      difficulty, seed: 0, puzzleState: serializeState(gs),
      startedAt: Date.now(), elapsedSeconds: elapsed,
    });
    navigate(-1);
  };

  const handleQuitNoSave = () => {
    deletePuzzleSave(saveIdRef.current);
    navigate(-1);
  };

  // Zellen-Berechnung für Responsive-Layout
  // Grid-Breite: min(360, availW - 40); Zellgröße: (gridW - (wordLen-1)*6) / wordLen
  const maxGridW = Math.min(360, typeof window !== "undefined" ? window.innerWidth - 40 : 320);
  const cellSize = Math.floor((maxGridW - (cfg.wordLength - 1) * 6) / cfg.wordLength);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "var(--bg)", overflow: "hidden" }}>
      {/* Header */}
      <div style={{
        background: "var(--surface)", borderBottom: "1px solid var(--border)",
        padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0,
      }}>
        <button onClick={() => setShowQuit(true)} style={headerBtnStyle}>‹</button>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20 }}>🌊</span>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>WortWelle</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text)" }}>
              {DIFFICULTY_CONFIG[difficulty].label}
              {mode === "daily" ? " · Tageswort" : ""}
              {" · "}{formatElapsed(elapsed)}
            </div>
          </div>
        </div>
        {bestTime !== null && (
          <div style={{ fontSize: 11, color: ACCENT }}>⏱ {formatElapsed(bestTime)}</div>
        )}
      </div>

      {/* Fehlermeldung */}
      {errorMsg && (
        <div style={{
          position: "absolute", top: 70, left: "50%", transform: "translateX(-50%)",
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 10, padding: "8px 18px", fontSize: 14, color: "var(--text)",
          fontWeight: 600, zIndex: 50, whiteSpace: "nowrap",
          boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
        }}>
          {errorMsg}
        </div>
      )}

      {/* Spielfeld — oben ausgerichtet */}
      <div style={{
        flexShrink: 0, display: "flex", flexDirection: "column",
        alignItems: "center",
        padding: "16px 20px 8px", gap: 6,
      }}>
        {Array.from({ length: cfg.maxGuesses }, (_, row) => {
          const isSubmitted = row < gs.guesses.length;
          const isCurrent = row === gs.guesses.length;
          const statuses = isSubmitted ? computeStatuses(gs.guesses[row], targetWord) : null;
          const isFlipping = flip === row;

          return (
            <div
              key={row}
              style={{
                display: "flex", gap: 6,
                animation: (isCurrent && shake) ? "shake 0.4s ease" : undefined,
              }}
            >
              {Array.from({ length: cfg.wordLength }, (_, col) => {
                let letter = "";
                let status: LetterStatus = "empty";

                if (isSubmitted) {
                  letter = gs.guesses[row][col] ?? "";
                  status = statuses![col];
                } else if (isCurrent) {
                  letter = cells[col] ?? "";
                  status = letter ? "typing" : "empty";
                }

                const c = STATUS_COLORS[status];
                const delay = isFlipping ? col * 150 : 0;
                const isCursorCell = isCurrent && col === cursorPos && gs.gameStatus === "playing";

                return (
                  <div
                    key={col}
                    onClick={isCurrent && gs.gameStatus === "playing" ? () => setCursorPos(col) : undefined}
                    style={{
                      width: cellSize, height: cellSize,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: c.bg,
                      border: `2.5px solid ${isCursorCell ? ACCENT : c.border}`,
                      borderRadius: 8,
                      fontSize: Math.max(16, Math.floor(cellSize * 0.45)),
                      fontWeight: 900, color: c.text,
                      transition: isFlipping ? `background ${delay}ms ease, border-color ${delay}ms ease` : undefined,
                      userSelect: "none",
                      cursor: isCurrent && gs.gameStatus === "playing" ? "pointer" : undefined,
                      boxShadow: isCursorCell ? `0 0 0 2px ${ACCENT}44` : undefined,
                    }}
                  >
                    {letter}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Controls-Leiste */}
      <div style={{
        flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        padding: "8px 12px", background: "var(--surface)",
        borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)",
      }}>
        {mode !== "daily" && (
          <button onClick={handleQuitSave} style={ctrlBtn("var(--primary)")}>💾</button>
        )}
        <button onClick={() => { setRunning(false); setShowHelp(true); }} style={ctrlBtn("var(--text-muted)")}>?</button>
        <button onClick={() => setRunning(r => !r)} style={ctrlBtn("var(--primary)")}>{running ? "⏸" : "▶"}</button>
        <button onClick={() => { setRunning(false); setShowQuit(true); }} style={ctrlBtn("var(--danger)")}>✕</button>
      </div>

      {/* Tastatur */}
      <div style={{ flexShrink: 0, padding: "8px 8px 16px", background: "var(--surface)" }}>
        {KEYBOARD_ROWS.map((row, ri) => (
          <div key={ri} style={{ display: "flex", justifyContent: "center", gap: 4, marginBottom: ri < 2 ? 4 : 0 }}>
            {row.map(key => {
              const status = keyStatuses[key];
              const isAction = key === "←" || key === "↵";
              const c = status ? STATUS_COLORS[status] : { bg: "var(--surface2)", border: "var(--border)", text: "var(--text)" };

              return (
                <button
                  key={key}
                  onPointerDown={e => { e.preventDefault(); handleKey(key); }}
                  style={{
                    minWidth: isAction ? 52 : 30,
                    height: 48,
                    background: c.bg,
                    border: `1.5px solid ${c.border}`,
                    borderRadius: 8,
                    cursor: "pointer",
                    fontSize: isAction ? 16 : 14,
                    fontWeight: 800,
                    color: c.text,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    userSelect: "none",
                    touchAction: "manipulation",
                    padding: "0 4px",
                    flexShrink: 0,
                  }}
                >
                  {key}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Quit-Dialog */}
      {showQuit && (
        <GameSaveQuitDialog
          emoji="🏖️"
          hideSave={mode === "daily"}
          onContinue={() => { setRunning(true); setShowQuit(false); }}
          onSaveAndQuit={handleQuitSave}
          onQuitWithoutSave={handleQuitNoSave}
        />
      )}

      {/* Hilfe-Dialog */}
      {showHelp && (
        <div style={overlayStyle} onClick={() => { setShowHelp(false); if (gs.gameStatus === "playing") setRunning(true); }}>
          <div style={{ ...dialogStyle, maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, alignItems: "center" }}>
              <span style={{ fontSize: 17, fontWeight: 800, color: "var(--text)" }}>Spielregeln</span>
              <button onClick={() => { setShowHelp(false); if (gs.gameStatus === "playing") setRunning(true); }} style={closeBtnStyle}>✕</button>
            </div>
            {RULES_TEXT.map((r, i) => (
              <div key={i} style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.55, marginBottom: 8 }}>{r}</div>
            ))}
          </div>
        </div>
      )}

      {/* Gewinn-Dialog */}
      {showWin && (
        <ResultDialog
          won={true}
          targetWord={targetWord}
          guessCount={gs.guesses.length}
          maxGuesses={cfg.maxGuesses}
          elapsed={elapsed}
          difficulty={difficulty}
          onClose={() => navigate(-1)}
        />
      )}

      {/* Verloren-Dialog */}
      {showLose && (
        <ResultDialog
          won={false}
          targetWord={targetWord}
          guessCount={gs.guesses.length}
          maxGuesses={cfg.maxGuesses}
          elapsed={elapsed}
          difficulty={difficulty}
          onClose={() => navigate(-1)}
        />
      )}

      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
}

// ── Ergebnis-Dialog ────────────────────────────────────────────────────────────

function ResultDialog({
  won, targetWord, guessCount, maxGuesses, elapsed, difficulty, onClose,
}: {
  won: boolean; targetWord: string; guessCount: number; maxGuesses: number;
  elapsed: number; difficulty: WortWelleDifficulty; onClose: () => void;
}) {
  const stats = getStats(difficulty);
  const winPct = stats.played > 0 ? Math.round((stats.won / stats.played) * 100) : 0;

  return (
    <div style={overlayStyle}>
      <div style={{ ...dialogStyle, maxWidth: 360, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>{won ? "🎉" : "😔"}</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: "var(--text)", marginBottom: 4 }}>
          {won ? "Glückwunsch!" : "Schade!"}
        </div>
        <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 16 }}>
          {won
            ? `Du hast das Wort in ${guessCount} von ${maxGuesses} Versuchen erraten!`
            : `Das gesuchte Wort war:`}
        </div>
        <div style={{
          display: "inline-flex", gap: 4, marginBottom: 20,
          padding: "10px 16px", background: "var(--surface2)", borderRadius: 12,
        }}>
          {targetWord.split("").map((ch, i) => (
            <div key={i} style={{
              width: 40, height: 40, background: "#22c55e", borderRadius: 6,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, fontWeight: 900, color: "#000",
            }}>{ch}</div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 20, marginBottom: 20, fontSize: 13, color: "var(--text-muted)" }}>
          <span>Zeit: <strong style={{ color: "var(--text)" }}>{formatElapsed(elapsed)}</strong></span>
          <span>Gewonnen: <strong style={{ color: ACCENT }}>{winPct}%</strong></span>
          <span>Streak: <strong style={{ color: ACCENT }}>{stats.currentStreak}</strong></span>
        </div>
        <button onClick={onClose} style={{ ...ctrlBtn("var(--primary)"), width: "100%", padding: "13px 0" }}>
          Zurück zur Lobby
        </button>
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const headerBtnStyle: React.CSSProperties = {
  width: 36, height: 36, flexShrink: 0,
  background: "var(--surface2)", border: "1px solid var(--border)",
  borderRadius: 10, cursor: "pointer", fontSize: 18,
  display: "flex", alignItems: "center", justifyContent: "center",
  color: "var(--text)",
};

const ctrlBtn = (color: string): React.CSSProperties => ({
  padding: "9px 14px", background: color + "22", border: `1px solid ${color}55`,
  borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 700, color,
});

const overlayStyle: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 100, padding: 20,
};

const dialogStyle: React.CSSProperties = {
  background: "var(--surface)", border: "1px solid var(--border)",
  borderRadius: 20, padding: 24, width: "100%",
  maxHeight: "90vh", overflowY: "auto",
};

const closeBtnStyle: React.CSSProperties = {
  background: "var(--surface2)", border: "1px solid var(--border)",
  borderRadius: 8, width: 30, height: 30, cursor: "pointer",
  color: "var(--text-muted)", fontSize: 13,
  display: "flex", alignItems: "center", justifyContent: "center",
};
