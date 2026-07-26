import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPuzzleSaves, deletePuzzleSave, formatElapsed, PUZZLE_DIFFICULTY_LABELS } from "../../../puzzleSave";
import type { KriegDifficulty } from "./kuestenkriegLogic";
import { GRID_SIZES, FLEET } from "./kuestenkriegLogic";

const ACCENT = "#fb7185";
const DIFFICULTIES: KriegDifficulty[] = ["leicht", "mittel", "schwer", "experte"];

function fleetLabel(fleet: number[]): string {
  const counts: Record<number, number> = {};
  fleet.forEach(n => { counts[n] = (counts[n] ?? 0) + 1; });
  return Object.entries(counts)
    .sort(([a], [b]) => Number(b) - Number(a))
    .map(([size, count]) => `${count}×${size}er`)
    .join(", ");
}

export default function KuestenkriegLobbyScreen() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<KriegDifficulty>("mittel");
  const saves = getPuzzleSaves().filter(s => s.gameType === "kuestenkrieg");

  const startNew = () =>
    navigate("/raetsel/kuestenkrieg/game", { state: { difficulty: selected, seed: Date.now() } });

  const resumeSave = (save: ReturnType<typeof getPuzzleSaves>[number]) =>
    navigate("/raetsel/kuestenkrieg/game", {
      state: {
        difficulty: save.difficulty as KriegDifficulty,
        seed: save.seed,
        saveId: save.id,
        savedState: save.puzzleState,
        elapsedSeconds: save.elapsedSeconds,
      },
    });

  return (
    <div className="screen" style={{ gap: 0, paddingTop: 0 }}>
      <div style={{ background: "linear-gradient(135deg, var(--surface) 0%, var(--surface2) 100%)", padding: "20px", display: "flex", alignItems: "center", gap: 14 }}>
        <button onClick={() => navigate(-1)} style={backBtnStyle}>‹</button>
        <span style={{ fontSize: 32 }}>⚓</span>
        <div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 2 }}>RÄTSEL</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text)" }}>Küstenkrieg</div>
        </div>
      </div>

      <div style={{ padding: "20px 20px 32px", display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.55 }}>
          <strong style={{ color: "var(--text)" }}>Schlachtschiff-Rätsel:</strong> Zahlen am Rand zeigen die Anzahl der Schiffsfelder in jeder Zeile und Spalte. Tippe Felder an, um sie als Schiff oder Wasser zu markieren. Schiffe berühren sich nie, auch nicht diagonal.
        </div>

        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Schwierigkeit</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {DIFFICULTIES.map(d => (
              <button
                key={d}
                onClick={() => setSelected(d)}
                style={{
                  padding: "14px 16px", textAlign: "left",
                  background: selected === d ? ACCENT + "22" : "var(--surface)",
                  border: `1.5px solid ${selected === d ? ACCENT : "var(--border)"}`,
                  borderRadius: 12, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 12,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: selected === d ? ACCENT : "var(--text)" }}>{PUZZLE_DIFFICULTY_LABELS[d]}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
                    {GRID_SIZES[d]}×{GRID_SIZES[d]} · Flotte: {fleetLabel(FLEET[d])}
                  </div>
                </div>
                {selected === d && <span style={{ color: ACCENT, fontSize: 18 }}>✓</span>}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={startNew}
          style={{ padding: "16px", background: ACCENT, border: "none", borderRadius: 14, cursor: "pointer", fontSize: 16, fontWeight: 800, color: "#0a1628" }}
        >
          Neues Spiel starten
        </button>

        {saves.length > 0 && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Gespeicherte Spiele</div>
            {saves.map(save => (
              <div key={save.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
                    {PUZZLE_DIFFICULTY_LABELS[save.difficulty as KriegDifficulty]} · {GRID_SIZES[save.difficulty as KriegDifficulty]}×{GRID_SIZES[save.difficulty as KriegDifficulty]}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{formatElapsed(save.elapsedSeconds)} gespielt</div>
                </div>
                <button onClick={() => resumeSave(save)} style={{ padding: "8px 14px", background: ACCENT + "22", border: `1px solid ${ACCENT}55`, borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700, color: ACCENT }}>Fortsetzen</button>
                <button onClick={() => { deletePuzzleSave(save.id); window.location.reload(); }} style={{ padding: "8px 10px", background: "var(--danger)22", border: "1px solid var(--danger)55", borderRadius: 8, cursor: "pointer", fontSize: 13, color: "var(--danger)" }}>✕</button>
              </div>
            ))}
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
