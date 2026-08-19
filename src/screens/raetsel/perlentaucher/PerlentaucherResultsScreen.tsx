import { useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { generateLevel, PerlentaucherBoardModel } from "./perlentaucherLogic";
import { savePuzzle, generateSaveId } from "../../../puzzleSave";

interface ResultsState {
  level: number;
  score: number;
  movesLeft: number;
  bestScore: number;
  newBestScore: boolean;
}

const ACCENT = "#0EA5E9";
const GOLD = "#F59E0B";

function starCount(movesLeft: number): number {
  if (movesLeft >= 6) return 3;
  if (movesLeft >= 2) return 2;
  return 1;
}

function createFreshPerlentaucherSave(level: number) {
  const config = generateLevel(level);
  const model = new PerlentaucherBoardModel(config.seed);
  savePuzzle({
    id: generateSaveId(),
    gameType: "perlentaucher",
    variant: `level_${level}`,
    difficulty: "standard",
    seed: config.seed,
    puzzleState: JSON.stringify({
      levelNumber: level,
      score: 0,
      movesLeft: config.movesLeft,
      board: model.boardToIntArray(),
    }),
    startedAt: Date.now(),
    elapsedSeconds: 0,
  });
}

export default function PerlentaucherResultsScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { level = 1, score = 0, movesLeft = 0, bestScore = 0, newBestScore = false } =
    (location.state ?? {}) as Partial<ResultsState>;

  const stars = starCount(movesLeft);

  function goNextLevel() {
    navigate("/raetsel/perlentaucher/game", { state: { level: level + 1, _instance: Date.now() } });
  }

  function saveAndQuit() {
    if (level < 150) createFreshPerlentaucherSave(level + 1);
    navigate("/raetsel/perlentaucher/lobby");
  }

  function goLobby() {
    navigate("/raetsel/perlentaucher/lobby");
  }

  const starRow = useMemo(() => Array.from({ length: 3 }, (_, i) => i < stars), [stars]);

  return (
    <div className="screen" style={{ gap: 0, padding: 0 }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, var(--surface) 0%, var(--surface2) 100%)",
        padding: "36px 20px",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
        textAlign: "center",
      }}>
        <div style={{ fontSize: 48 }}>{newBestScore ? "🏆" : "🤿"}</div>
        <div style={{ fontSize: 24, fontWeight: 800, color: newBestScore ? ACCENT : "var(--text)" }}>
          {newBestScore ? "Neuer Rekord!" : "Level geschafft!"}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Level {level}</div>
        <div style={{ display: "flex", gap: 8 }}>
          {starRow.map((lit, i) => (
            <span key={i} style={{ fontSize: 28, color: lit ? GOLD : "var(--text-muted)", opacity: lit ? 1 : 0.35 }}>
              {lit ? "★" : "☆"}
            </span>
          ))}
        </div>
      </div>

      <div style={{ padding: "24px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Score + Züge */}
        <div style={{ display: "flex", gap: 12 }}>
          <StatCard emoji="💎" label="Score" value={score.toLocaleString()} color={ACCENT} />
          <StatCard emoji="🎯" label="Übrige Züge" value={movesLeft.toString()} color={GOLD} />
        </div>

        {/* Bestpunktzahl */}
        <div style={{
          background: newBestScore ? ACCENT + "1A" : "var(--surface)",
          border: `${newBestScore ? 2 : 1}px solid ${newBestScore ? ACCENT : "var(--border)"}`,
          borderRadius: 14, padding: "16px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 2 }}>Bestpunktzahl Level {level}</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: newBestScore ? ACCENT : "var(--text)" }}>
              {bestScore.toLocaleString()}
            </div>
          </div>
          <div style={{ fontSize: 32 }}>{newBestScore ? "🏆" : "🎖️"}</div>
        </div>

        {/* Stern-Erklärung */}
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 12, padding: "12px 16px",
          display: "flex", justifyContent: "space-evenly",
        }}>
          <StarHint count={1} label="Ziel erreicht" earned={stars >= 1} />
          <StarHint count={2} label="2+ Züge übrig" earned={stars >= 2} />
          <StarHint count={3} label="6+ Züge übrig" earned={stars >= 3} />
        </div>

        <div style={{ height: 4 }} />

        {level < 150 && (
          <>
            <button onClick={goNextLevel} style={{
              padding: "16px", background: ACCENT, border: "none",
              borderRadius: 14, cursor: "pointer", fontSize: 16, fontWeight: 800,
              color: "#0a1628", width: "100%",
            }}>
              Level {level + 1} starten
            </button>
            <button onClick={saveAndQuit} style={{
              padding: "15px", background: "transparent",
              border: `1px solid ${ACCENT}80`, borderRadius: 14,
              cursor: "pointer", fontSize: 15, fontWeight: 600,
              color: ACCENT, width: "100%",
            }}>
              Level {level + 1} speichern &amp; beenden
            </button>
          </>
        )}
        <button onClick={goLobby} style={{
          padding: "15px", background: "transparent",
          border: "1px solid var(--border)", borderRadius: 14,
          cursor: "pointer", fontSize: 15, fontWeight: 600,
          color: "var(--text-muted)", width: "100%",
        }}>
          Zur Lobby
        </button>
      </div>
    </div>
  );
}

function StatCard({ emoji, label, value, color }: { emoji: string; label: string; value: string; color: string }) {
  return (
    <div style={{
      flex: 1, background: color + "1A",
      border: `1px solid ${color}66`,
      borderRadius: 14, padding: "16px 12px",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
    }}>
      <div style={{ fontSize: 24 }}>{emoji}</div>
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color }}>{value}</div>
    </div>
  );
}

function StarHint({ count, label, earned }: { count: number; label: string; earned: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <div style={{ fontSize: 12, color: earned ? GOLD : "var(--text-muted)", opacity: earned ? 1 : 0.4 }}>
        {"★".repeat(count) + "☆".repeat(3 - count)}
      </div>
      <div style={{ fontSize: 10, color: earned ? "var(--text)" : "var(--text-muted)", opacity: earned ? 1 : 0.5, textAlign: "center" }}>
        {label}
      </div>
    </div>
  );
}
