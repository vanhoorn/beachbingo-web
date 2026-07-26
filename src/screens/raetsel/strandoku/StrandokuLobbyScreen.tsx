import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPuzzleSaves, deletePuzzleSave, formatElapsed, PUZZLE_DIFFICULTY_LABELS } from "../../../puzzleSave";
import { VARIANT_LABELS, VARIANT_DESCRIPTIONS, type StrandokuVariant, type StrandokuDifficulty } from "./strandokuLogic";

const ACCENT = "#38bdf8";
const VARIANTS: StrandokuVariant[] = ["classic", "mega12", "mega16", "irregular", "diagonal", "killer", "samurai"];
const DIFFICULTIES: StrandokuDifficulty[] = ["leicht", "mittel", "schwer", "experte"];

export default function StrandokuLobbyScreen() {
  const navigate = useNavigate();
  const [variant, setVariant] = useState<StrandokuVariant>("classic");
  const [difficulty, setDifficulty] = useState<StrandokuDifficulty>("mittel");
  const saves = getPuzzleSaves().filter(s => s.gameType === "strandoku");

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
    <div className="screen" style={{ gap: 0, paddingTop: 0 }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, var(--surface) 0%, var(--surface2) 100%)", padding: "20px", display: "flex", alignItems: "center", gap: 14 }}>
        <button onClick={() => navigate(-1)} style={backBtnStyle}>‹</button>
        <span style={{ fontSize: 32 }}>🔢</span>
        <div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 2 }}>RÄTSEL</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text)" }}>Strandoku</div>
        </div>
      </div>

      <div style={{ padding: "20px 20px 32px", display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Variant selection */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Variante</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {VARIANTS.map(v => (
              <button
                key={v}
                onClick={() => setVariant(v)}
                style={{
                  padding: "12px 16px", textAlign: "left",
                  background: variant === v ? ACCENT + "22" : "var(--surface)",
                  border: `1.5px solid ${variant === v ? ACCENT : "var(--border)"}`,
                  borderRadius: 12, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 12,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: variant === v ? ACCENT : "var(--text)" }}>{VARIANT_LABELS[v]}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{VARIANT_DESCRIPTIONS[v]}</div>
                </div>
                {variant === v && <span style={{ color: ACCENT, fontSize: 18 }}>✓</span>}
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
    </div>
  );
}

const backBtnStyle: React.CSSProperties = {
  width: 40, height: 40, flexShrink: 0, background: "var(--surface2)", border: "1px solid var(--border)",
  borderRadius: 12, cursor: "pointer", fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text)",
};
