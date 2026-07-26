import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPuzzleSaves, deletePuzzleSave, formatElapsed, PUZZLE_DIFFICULTY_LABELS } from "../../../puzzleSave";
import type { HashiDifficulty } from "./inselbrueckeLogic";

const ACCENT = "#4ade80";
const DIFFICULTIES: HashiDifficulty[] = ["leicht", "mittel", "schwer", "experte"];
const SIZES = { leicht: "7×7 · 8 Inseln", mittel: "9×9 · 14 Inseln", schwer: "11×11 · 20 Inseln", experte: "13×13 · 28 Inseln" };

export default function InselbrueckeLobbyScreen() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<HashiDifficulty>("mittel");
  const saves = getPuzzleSaves().filter(s => s.gameType === "inselbruecke");

  const startNew = () => navigate("/raetsel/inselbruecke/game", { state: { difficulty: selected, seed: Date.now() } });
  const resumeSave = (save: ReturnType<typeof getPuzzleSaves>[number]) => {
    navigate("/raetsel/inselbruecke/game", {
      state: { difficulty: save.difficulty as HashiDifficulty, seed: save.seed, saveId: save.id, savedState: save.puzzleState, elapsedSeconds: save.elapsedSeconds },
    });
  };

  return (
    <div className="screen" style={{ gap: 0, paddingTop: 0 }}>
      <div style={{ background: "linear-gradient(135deg, var(--surface) 0%, var(--surface2) 100%)", padding: "20px", display: "flex", alignItems: "center", gap: 14 }}>
        <button onClick={() => navigate(-1)} style={backBtnStyle}>‹</button>
        <span style={{ fontSize: 32 }}>🌉</span>
        <div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 2 }}>RÄTSEL</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text)" }}>Inselbrücke</div>
        </div>
      </div>

      <div style={{ padding: "20px 20px 32px", display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.55 }}>
          <strong style={{ color: "var(--text)" }}>Hashiwokakero:</strong> Verbinde alle Inseln mit Brücken. Jede Insel muss genau so viele Brücken haben wie die Zahl zeigt. Max. 2 Brücken zwischen zwei Inseln, keine Kreuzungen. Alle Inseln müssen verbunden sein.
        </div>

        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Schwierigkeit</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {DIFFICULTIES.map(d => (
              <button key={d} onClick={() => setSelected(d)} style={{
                padding: "14px 12px", background: selected === d ? ACCENT + "22" : "var(--surface)",
                border: `1.5px solid ${selected === d ? ACCENT : "var(--border)"}`, borderRadius: 12, cursor: "pointer", textAlign: "left",
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: selected === d ? ACCENT : "var(--text)" }}>{PUZZLE_DIFFICULTY_LABELS[d]}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{SIZES[d]}</div>
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
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{PUZZLE_DIFFICULTY_LABELS[save.difficulty as HashiDifficulty]}</div>
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
