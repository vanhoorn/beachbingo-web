import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { doc, updateDoc } from "firebase/firestore";
import { db, auth } from "../../firebase";
import {
  createMahjongState, deserializeMahjong, serializeMahjong,
  handleTileClick, undoLast, shuffleTiles, getHint,
  HINT_LIMIT, SHUFFLE_LIMIT, SHOW_FREE_HIGHLIGHT,
  type MahjongState, type MahjongDifficulty,
} from "./MahjongLogic";
import type { LayoutId } from "./MahjongLayouts";
import { LAYOUTS } from "./MahjongLayouts";
import MahjongBoard from "./MahjongBoard";
import { GameSaveQuitDialog } from "../../components/GameHudBar";
import GameRulesModal from "../../components/GameRulesModal";
import { GAME_RULES } from "../../gameRules";
import {
  savePuzzle, deletePuzzleSave, generateSaveId,
  recordBestTime, getBestTime, getBestTimeAny, formatElapsed,
} from "../../puzzleSave";
import { audioManager } from "../../audio/AudioManager";

interface LocationState {
  difficulty: MahjongDifficulty;
  layout: LayoutId;
  seed: number;
  saveId?: string;
  savedState?: string;
  elapsedSeconds?: number;
}

const ACCENT = "#D4A820";

export default function MahjongGameScreen() {
  const navigate   = useNavigate();
  const location   = useLocation();
  const loc        = (location.state ?? {}) as LocationState;

  const difficulty    = loc.difficulty ?? "ROOKIE";
  const layoutId      = loc.layout     ?? "schildkroete";
  const seed          = loc.seed       ?? Date.now();
  const saveIdRef     = useRef<string>(loc.saveId ?? generateSaveId());

  const [gs, setGs] = useState<MahjongState>(() =>
    loc.savedState ? deserializeMahjong(loc.savedState) : createMahjongState(layoutId, difficulty, seed)
  );
  const [elapsed, setElapsed]     = useState(loc.elapsedSeconds ?? 0);
  const [paused, setPaused]       = useState(false);
  const [showQuit, setShowQuit]   = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [hintIds, setHintIds]     = useState<number[]>([]);
  const [flashIds, setFlashIds]   = useState<number[]>([]);
  const [noHint, setNoHint]       = useState(false);

  // Container size for board
  const boardAreaRef = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = boardAreaRef.current; if (!el) return;
    // Measure immediately (fallback when ResizeObserver delays)
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setBoardSize({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      if (width > 0 && height > 0) setBoardSize({ w: width, h: height });
    });
    ro.observe(el);
    // Also listen to window resize as safety net
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, []);

  // Timer
  const showTimer = difficulty !== "ROOKIE";
  useEffect(() => {
    if (paused || gs.won || gs.gameOver) return;
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [paused, gs.won, gs.gameOver]);

  // Clear hint after 3s
  useEffect(() => {
    if (hintIds.length === 0) return;
    const id = setTimeout(() => setHintIds([]), 3000);
    return () => clearTimeout(id);
  }, [hintIds]);

  const showFreeHighlight = SHOW_FREE_HIGHLIGHT[difficulty];
  const hintLimit   = HINT_LIMIT[difficulty];
  const shuffleLimit = SHUFFLE_LIMIT[difficulty];

  const hintsLeft   = Math.max(0, hintLimit   - gs.hintsUsed);
  const shufflesLeft = Math.max(0, shuffleLimit - gs.shufflesUsed);
  const canHint     = hintsLeft > 0;
  const canShuffle  = shufflesLeft > 0;
  const canUndo     = gs.history.length > 0;
  const remaining   = gs.tiles.filter((t) => !t.removed).length;

  // Music
  useEffect(() => {
    audioManager.startMusic("mahjong");
    return () => audioManager.stopMusic();
  }, []);

  // Win: record best time + Firestore sync
  useEffect(() => {
    if (gs.won && difficulty === "BOSS") {
      const prevBest = getBestTime(`mahjong_${layoutId}`, layoutId, "BOSS");
      recordBestTime(`mahjong_${layoutId}`, layoutId, "BOSS", elapsed);
      if (prevBest === null || elapsed < prevBest) {
        const uid = auth.currentUser?.uid;
        if (uid) {
          updateDoc(doc(db, "users", uid), {
            [`mahjongBestTimes.${layoutId}_BOSS`]: elapsed,
          }).catch(() => {});
        }
      }
    }
  }, [gs.won]);

  const onTileClick = useCallback((id: number) => {
    if (paused || gs.won || gs.gameOver) return;
    setHintIds([]);
    setGs((prev) => {
      const next = handleTileClick(prev, id);
      const nowRemoved = next.tiles
        .filter((t) => t.removed && !prev.tiles.find((p) => p.id === t.id)?.removed)
        .map((t) => t.id);
      if (nowRemoved.length === 2) {
        setFlashIds(nowRemoved);
        setTimeout(() => setFlashIds([]), 350);
      }
      return next;
    });
  }, [paused, gs.won, gs.gameOver]);

  function onHint() {
    if (!canHint) return;
    const pair = getHint(gs.tiles);
    if (!pair) { setNoHint(true); setTimeout(() => setNoHint(false), 2000); return; }
    setHintIds([pair[0].id, pair[1].id]);
    setGs((prev) => ({ ...prev, hintsUsed: prev.hintsUsed + 1 }));
  }

  function doShuffle() {
    if (!canShuffle) return;
    setGs((prev) => {
      const newTiles = shuffleTiles(prev.tiles, prev.seed + prev.shufflesUsed + 1);
      return { ...prev, tiles: newTiles, shufflesUsed: prev.shufflesUsed + 1, gameOver: false, selectedId: null };
    });
  }

  function doUndo() {
    setHintIds([]);
    setGs((prev) => undoLast(prev));
  }

  function doSave() {
    savePuzzle({
      id: saveIdRef.current,
      gameType: "mahjong",
      variant: layoutId,
      difficulty,
      seed,
      puzzleState: serializeMahjong(gs),
      startedAt: Date.now(),
      elapsedSeconds: elapsed,
    });
  }

  function doSaveAndQuit() {
    doSave();
    navigate("/mahjong/lobby");
  }

  function doQuitWithoutSave() {
    deletePuzzleSave(saveIdRef.current);
    navigate("/mahjong/lobby");
  }

  const btnStyle = (enabled: boolean, accent?: string): React.CSSProperties => ({
    display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
    padding: "6px 10px", minWidth: 42,
    background: enabled ? (accent ? accent + "22" : "var(--surface2)") : "var(--surface)",
    border: `1px solid ${enabled ? (accent ?? "var(--border)") + "88" : "var(--border)"}`,
    borderRadius: 8, cursor: enabled ? "pointer" : "default",
    opacity: enabled ? 1 : 0.35, transition: "all 0.1s",
    color: enabled ? (accent ?? "var(--text)") : "var(--text-muted)",
    fontSize: 18,
  });

  const layout = LAYOUTS[layoutId];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "var(--bg)", overflow: "hidden" }}>

      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 12px",
        background: "var(--surface)", borderBottom: "1px solid var(--border)",
        flexShrink: 0,
      }}>
        <button onClick={() => setShowQuit(true)} style={{
          width: 36, height: 36, background: "var(--surface2)",
          border: "1px solid var(--border)", borderRadius: 8,
          cursor: "pointer", fontSize: 16, color: "var(--text-muted)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>✕</button>

        <span style={{ fontSize: 18 }}>{layout.emoji}</span>
        <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", flex: 1 }}>
          GezeitenSteine
        </span>

        {/* Remaining count */}
        <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "right" }}>
          <div style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, color: "var(--text)" }}>{remaining}</div>
          <div>Steine</div>
        </div>

        {/* Timer */}
        {showTimer && (
          <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "right", minWidth: 44 }}>
            <div style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, color: ACCENT }}>{formatElapsed(elapsed)}</div>
            <div>Zeit</div>
          </div>
        )}
      </div>

      {/* Board area */}
      <div ref={boardAreaRef} style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        <MahjongBoard
          state={gs}
          showFreeHighlight={showFreeHighlight}
          hintIds={hintIds}
          flashIds={flashIds}
          onTileClick={onTileClick}
          containerW={boardSize.w}
          containerH={boardSize.h}
        />

        {/* Paused overlay */}
        {paused && (
          <div style={{
            position: "absolute", inset: 0, background: "rgba(10,22,40,0.85)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexDirection: "column", gap: 12, zIndex: 20,
          }}>
            <div style={{ fontSize: 48 }}>⏸</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>Pause</div>
            <button onClick={() => setPaused(false)} style={{
              padding: "12px 28px", background: ACCENT, border: "none",
              borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer", color: "#0a1628",
            }}>Weiterspielen</button>
          </div>
        )}

        {/* Game Over overlay */}
        {gs.gameOver && (
          <div style={{
            position: "absolute", inset: 0, background: "rgba(10,22,40,0.88)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexDirection: "column", gap: 12, zIndex: 20,
          }}>
            <div style={{ fontSize: 48 }}>🌊</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)" }}>Keine Zuege mehr!</div>
            <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
              {canShuffle ? `Noch ${shufflesLeft} Mischung(en) verfuegbar` : "Alle Mischungen aufgebraucht"}
            </div>
            {canShuffle && (
              <button onClick={doShuffle} style={{
                padding: "12px 24px", background: ACCENT, border: "none",
                borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer", color: "#0a1628",
              }}>🔀 Steine mischen</button>
            )}
            <button onClick={doQuitWithoutSave} style={{
              padding: "10px 20px", background: "transparent",
              border: "1.5px solid rgba(239,68,68,0.55)",
              borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", color: "#ef4444",
            }}>✕ Aufgeben</button>
          </div>
        )}

        {/* Won overlay */}
        {gs.won && (
          <div style={{
            position: "absolute", inset: 0, background: "rgba(10,22,40,0.88)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexDirection: "column", gap: 12, zIndex: 20,
          }}>
            <div style={{ fontSize: 56 }}>🏆</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: ACCENT }}>Geschafft!</div>
            {showTimer && (
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>{formatElapsed(elapsed)}</div>
            )}
            {difficulty === "BOSS" && (() => {
              const best = getBestTimeAny(`mahjong_${layoutId}`, "BOSS");
              return best && best === elapsed
                ? <div style={{ fontSize: 13, color: "#22c55e", fontWeight: 700 }}>🎉 Neuer Rekord!</div>
                : best ? <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Bestzeit: {formatElapsed(best)}</div>
                : null;
            })()}
            <button onClick={() => navigate("/mahjong/lobby")} style={{
              padding: "12px 28px", background: ACCENT, border: "none",
              borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer", color: "#0a1628",
            }}>Zurueck zur Lobby</button>
          </div>
        )}
      </div>

      {/* Bottom control bar */}
      <div style={{
        background: "var(--surface)", borderTop: "1px solid var(--border)",
        flexShrink: 0,
      }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-around",
        padding: "6px 8px",
        maxWidth: 480, margin: "0 auto",
      }}>
        {/* Pause */}
        <button onClick={() => setPaused((p) => !p)} style={btnStyle(true)} title="Pause">
          <span>{paused ? "▶" : "⏸"}</span>
        </button>

        {/* Hint */}
        <button onClick={onHint} disabled={!canHint} style={btnStyle(canHint, noHint ? "#ef4444" : ACCENT)} title="Hinweis">
          <span>💡</span>
          {hintLimit < Infinity && (
            <span style={{ fontSize: 9, lineHeight: 1 }}>{hintsLeft}</span>
          )}
        </button>

        {/* Shuffle */}
        <button onClick={doShuffle} disabled={!canShuffle} style={btnStyle(canShuffle, "#0ea5e9")} title="Steine mischen">
          <span>🔀</span>
          {shuffleLimit < Infinity && (
            <span style={{ fontSize: 9, lineHeight: 1 }}>{shufflesLeft}</span>
          )}
        </button>

        {/* Undo */}
        <button onClick={doUndo} disabled={!canUndo} style={btnStyle(canUndo)} title="Rueckgaengig">
          <span>↩</span>
        </button>

        {/* Save */}
        <button onClick={doSave} style={btnStyle(true)} title="Speichern">
          <span>💾</span>
        </button>

        {/* Rules */}
        <button onClick={() => setShowRules(true)} style={btnStyle(true)} title="Spielregeln">
          <span style={{ fontSize: 16 }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5" fill="currentColor"/></svg>
          </span>
        </button>
      </div>
      </div>

      {showQuit && (
        <GameSaveQuitDialog
          emoji="🀄"
          onContinue={() => setShowQuit(false)}
          onSaveAndQuit={doSaveAndQuit}
          onQuitWithoutSave={doQuitWithoutSave}
        />
      )}

      {showRules && GAME_RULES["mahjong"] && (
        <GameRulesModal rule={GAME_RULES["mahjong"]} onClose={() => setShowRules(false)} />
      )}
    </div>
  );
}
