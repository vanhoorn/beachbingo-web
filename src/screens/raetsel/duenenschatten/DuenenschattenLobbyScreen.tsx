import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPuzzleSaves, deletePuzzleSave, formatElapsed, PUZZLE_DIFFICULTY_LABELS } from "../../../puzzleSave";
import type { HitoriDifficulty } from "./duenenschattenLogic";

const ACCENT = "#fbbf24";
const DIFFICULTIES: HitoriDifficulty[] = ["leicht", "mittel", "schwer", "experte"];
const SIZES = { leicht: "5×5", mittel: "7×7", schwer: "9×9", experte: "11×11" };

export default function DuenenschattenLobbyScreen() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<HitoriDifficulty>("mittel");
  const saves = getPuzzleSaves().filter(s => s.gameType === "duenenschatten");
  const [isFavorite, setIsFavorite] = useState(() => {
    try { return (JSON.parse(localStorage.getItem("favoriteGames") ?? "[]") as string[]).includes("duenenschatten"); }
    catch { return false; }
  });
  function toggleFavorite() {
    const next = !isFavorite; setIsFavorite(next);
    try {
      const favs = JSON.parse(localStorage.getItem("favoriteGames") ?? "[]") as string[];
      localStorage.setItem("favoriteGames", JSON.stringify(next ? [...new Set([...favs, "duenenschatten"])] : favs.filter(f => f !== "duenenschatten")));
    } catch { }
  }

  const startNew = () => {
    navigate("/raetsel/duenenschatten/game", {
      state: { difficulty: selected, seed: Date.now() },
    });
  };

  const resumeSave = (save: ReturnType<typeof getPuzzleSaves>[number]) => {
    navigate("/raetsel/duenenschatten/game", {
      state: {
        difficulty: save.difficulty as HitoriDifficulty,
        seed: save.seed,
        saveId: save.id,
        savedState: save.puzzleState,
        elapsedSeconds: save.elapsedSeconds,
      },
    });
  };

  return (
    <div className="screen">
      <button className="btn btn-outline btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => navigate(-1)}>‹ Rätsel</button>

      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, #451a03 0%, ${ACCENT} 100%)`,
        borderRadius: "var(--radius)", padding: "20px",
        display: "flex", alignItems: "center", gap: 16,
      }}>
        <div style={{ fontSize: 44 }}>◼</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>Rätsel</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "white" }}>DünenSchatten</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-outline btn-sm"
            style={{ width: 42, padding: 0, fontSize: 18, color: "rgba(255,255,255,0.8)", borderColor: "rgba(255,255,255,0.2)" }}
            onClick={() => navigate("/raetsel/duenenschatten/highscores")} title="Ergebnisse">🏆</button>
          <button className="btn btn-outline btn-sm" onClick={toggleFavorite}
            style={{ width: 42, padding: 0, fontSize: 18, color: isFavorite ? "var(--accent)" : "rgba(255,255,255,0.8)", borderColor: isFavorite ? "var(--accent)" : "rgba(255,255,255,0.2)" }}>
            {isFavorite ? "★" : "☆"}
          </button>
          <button className="btn btn-outline btn-sm"
            style={{ width: 42, padding: 0, fontSize: 18, color: "rgba(255,255,255,0.8)", borderColor: "rgba(255,255,255,0.2)" }}
            onClick={() => navigate("/raetsel/duenenschatten/rules")} title="Spielanleitung">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5" fill="currentColor"/></svg>
          </button>
          <button className="btn btn-outline btn-sm"
            style={{ width: 42, padding: 0, fontSize: 18, color: "rgba(255,255,255,0.8)", borderColor: "rgba(255,255,255,0.2)" }}
            onClick={() => navigate("/raetsel/duenenschatten/settings")} title="Einstellungen">⚙️</button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* About */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.55 }}>
          <strong style={{ color: "var(--text)" }}>Hitori-Rätsel:</strong> Schwärze Felder, bis keine Zahl doppelt in einer Zeile oder Spalte erscheint. Schwarze Felder dürfen sich nicht berühren, und alle weißen Felder bleiben verbunden.
        </div>

        {/* Difficulty selection */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Schwierigkeit</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {DIFFICULTIES.map(d => (
              <button
                key={d}
                onClick={() => setSelected(d)}
                style={{
                  padding: "14px 12px",
                  background: selected === d ? ACCENT + "22" : "var(--surface)",
                  border: `1.5px solid ${selected === d ? ACCENT : "var(--border)"}`,
                  borderRadius: 12, cursor: "pointer", textAlign: "left",
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: selected === d ? ACCENT : "var(--text)" }}>
                  {PUZZLE_DIFFICULTY_LABELS[d]}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                  {SIZES[d]} Raster
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* New game button */}
        <button
          onClick={startNew}
          style={{
            padding: "16px",
            background: ACCENT,
            border: "none",
            borderRadius: 14, cursor: "pointer",
            fontSize: 16, fontWeight: 800, color: "#0a1628",
          }}
        >
          Neues Spiel starten
        </button>

        {/* Saved games */}
        {saves.length > 0 && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>
              Gespeicherte Spiele
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {saves.map(save => (
                <div
                  key={save.id}
                  style={{
                    background: "var(--surface)", border: "1px solid var(--border)",
                    borderRadius: 12, padding: "14px 16px",
                    display: "flex", alignItems: "center", gap: 12,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
                      {PUZZLE_DIFFICULTY_LABELS[save.difficulty as HitoriDifficulty]} · {SIZES[save.difficulty as HitoriDifficulty]}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                      {formatElapsed(save.elapsedSeconds)} gespielt
                    </div>
                  </div>
                  <button
                    onClick={() => resumeSave(save)}
                    style={{ padding: "8px 14px", background: ACCENT + "22", border: `1px solid ${ACCENT}55`, borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700, color: ACCENT }}
                  >
                    Fortsetzen
                  </button>
                  <button
                    onClick={() => { deletePuzzleSave(save.id); window.location.reload(); }}
                    style={{ padding: "8px 10px", background: "var(--danger)22", border: "1px solid var(--danger)55", borderRadius: 8, cursor: "pointer", fontSize: 13, color: "var(--danger)" }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

