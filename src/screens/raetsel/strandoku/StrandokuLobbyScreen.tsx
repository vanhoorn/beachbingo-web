import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPuzzleSaves, deletePuzzleSave, formatElapsed, getBestTimeAny, PUZZLE_DIFFICULTY_LABELS } from "../../../puzzleSave";
import { VARIANT_LABELS, VARIANT_DESCRIPTIONS, type StrandokuVariant, type StrandokuDifficulty } from "./strandokuLogic";
import GameRulesModal from "../../../components/GameRulesModal";
import { GAME_RULES } from "../../../gameRules";

const ACCENT = "#38bdf8";
const VARIANTS: StrandokuVariant[] = ["classic", "mega12", "mega16", "irregular", "diagonal", "killer", "samurai"];
const DIFFICULTIES: StrandokuDifficulty[] = ["leicht", "mittel", "schwer", "experte"];

export default function StrandokuLobbyScreen() {
  const navigate = useNavigate();
  const [variant, setVariant] = useState<StrandokuVariant>("classic");
  const [difficulty, setDifficulty] = useState<StrandokuDifficulty>("mittel");
  const saves = getPuzzleSaves().filter(s => s.gameType === "strandoku");
  const [showStats, setShowStats] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [isFavorite, setIsFavorite] = useState(() => {
    try { return (JSON.parse(localStorage.getItem("favoriteGames") ?? "[]") as string[]).includes("strandoku"); }
    catch { return false; }
  });
  function toggleFavorite() {
    const next = !isFavorite; setIsFavorite(next);
    try {
      const favs = JSON.parse(localStorage.getItem("favoriteGames") ?? "[]") as string[];
      localStorage.setItem("favoriteGames", JSON.stringify(next ? [...new Set([...favs, "strandoku"])] : favs.filter(f => f !== "strandoku")));
    } catch { }
  }

  const startNew = () => navigate("/raetsel/strandoku/game", { state: { variant, difficulty, seed: Date.now() } });
  const resumeSave = (save: ReturnType<typeof getPuzzleSaves>[number]) => {
    navigate("/raetsel/strandoku/game", {
      state: {
        variant: save.variant as StrandokuVariant,
        difficulty: save.difficulty as StrandokuDifficulty,
        seed: save.seed, saveId: save.id, savedState: save.puzzleState, elapsedSeconds: save.elapsedSeconds,
      },
    });
  };

  return (
    <div className="screen">
      <button className="btn btn-outline btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => navigate("/raetsel", { replace: true })}>‹ Rätsel</button>

      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, #0c4a6e 0%, ${ACCENT} 100%)`,
        borderRadius: "var(--radius)", padding: "20px",
        display: "flex", alignItems: "center", gap: 16,
      }}>
        <div style={{ fontSize: 44 }}>🔢</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>Rätsel</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "white" }}>Strandoku</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-outline btn-sm"
            style={{ width: 42, padding: 0, fontSize: 18, color: "rgba(255,255,255,0.8)", borderColor: "rgba(255,255,255,0.2)" }}
            onClick={() => setShowStats(true)} title="Ergebnisse">🏆</button>
          <button className="btn btn-outline btn-sm" onClick={toggleFavorite}
            style={{ width: 42, padding: 0, fontSize: 18, color: isFavorite ? "var(--accent)" : "rgba(255,255,255,0.8)", borderColor: isFavorite ? "var(--accent)" : "rgba(255,255,255,0.2)" }}>
            {isFavorite ? "★" : "☆"}
          </button>
          <button className="btn btn-outline btn-sm"
            style={{ width: 42, padding: 0, fontSize: 18, color: "rgba(255,255,255,0.8)", borderColor: "rgba(255,255,255,0.2)" }}
            onClick={() => setShowRules(true)} title="Spielanleitung">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5" fill="currentColor"/></svg>
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Variant selection */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Variante</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {VARIANTS.map(v => (
              <button
                key={v}
                onClick={() => setVariant(v)}
                style={{
                  padding: "12px", textAlign: "left",
                  background: variant === v ? ACCENT + "22" : "var(--surface)",
                  border: `1.5px solid ${variant === v ? ACCENT : "var(--border)"}`,
                  borderRadius: 12, cursor: "pointer",
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: variant === v ? ACCENT : "var(--text)" }}>{VARIANT_LABELS[v]}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{VARIANT_DESCRIPTIONS[v]}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty selection */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Schwierigkeit</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {DIFFICULTIES.map(d => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                style={{
                  padding: "12px", background: difficulty === d ? ACCENT + "22" : "var(--surface)",
                  border: `1.5px solid ${difficulty === d ? ACCENT : "var(--border)"}`,
                  borderRadius: 12, cursor: "pointer", textAlign: "left",
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: difficulty === d ? ACCENT : "var(--text)" }}>{PUZZLE_DIFFICULTY_LABELS[d]}</div>
              </button>
            ))}
          </div>
        </div>

        <button onClick={startNew} style={{ padding: "16px", background: ACCENT, border: "none", borderRadius: 14, cursor: "pointer", fontSize: 16, fontWeight: 800, color: "#0a1628" }}>
          Neues Spiel starten
        </button>

        {saves.length > 0 && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Gespeicherte Spiele</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {saves.map(save => (
                <div key={save.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{VARIANT_LABELS[save.variant as StrandokuVariant]} · {PUZZLE_DIFFICULTY_LABELS[save.difficulty as StrandokuDifficulty]}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{formatElapsed(save.elapsedSeconds)} gespielt</div>
                  </div>
                  <button onClick={() => resumeSave(save)} style={{ padding: "8px 14px", background: ACCENT + "22", border: `1px solid ${ACCENT}55`, borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700, color: ACCENT }}>Fortsetzen</button>
                  <button onClick={() => { deletePuzzleSave(save.id); window.location.reload(); }} style={{ padding: "8px 10px", background: "var(--danger)22", border: "1px solid var(--danger)55", borderRadius: 8, cursor: "pointer", fontSize: 13, color: "var(--danger)" }}>✕</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showStats && (
        <div style={overlayStyle} onClick={() => setShowStats(false)}>
          <div style={dialogStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: "var(--text)" }}>🏆 Bestzeiten</span>
              <button onClick={() => setShowStats(false)} style={closeBtnStyle}>✕</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {(["leicht", "mittel", "schwer", "experte"] as const).map(d => {
                const best = getBestTimeAny("strandoku", d);
                return (
                  <div key={d} style={{ background: "var(--surface2)", borderRadius: 12, padding: "14px 12px", textAlign: "center" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase" }}>{PUZZLE_DIFFICULTY_LABELS[d]}</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: best ? ACCENT : "var(--text-muted)" }}>{best ? formatElapsed(best) : "—"}</div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>Bestzeit</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {showRules && GAME_RULES["strandoku"] && (
        <GameRulesModal rule={GAME_RULES["strandoku"]} onClose={() => setShowRules(false)} />
      )}
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 100, padding: 20,
};
const dialogStyle: React.CSSProperties = {
  background: "var(--surface)", border: "1px solid var(--border)",
  borderRadius: 20, padding: 24, width: "100%", maxWidth: 360,
};
const closeBtnStyle: React.CSSProperties = {
  background: "var(--surface2)", border: "1px solid var(--border)",
  borderRadius: 8, width: 32, height: 32, cursor: "pointer",
  color: "var(--text-muted)", fontSize: 14,
  display: "flex", alignItems: "center", justifyContent: "center",
};
