import { useState, useMemo } from "react";
import { useFavorite } from "../../../favorites";
import { useNavigate } from "react-router-dom";
import { generateLevel } from "./perlentaucherLogic";
import {
  getPuzzleSaves, deletePuzzleSave,
  getHighestPerlentaucherLevel, getBestPerlentaucherScore, getAllPerlentaucherScores,
} from "../../../puzzleSave";
import { GAME_RULES } from "../../../gameRules";
import GameRulesModal from "../../../components/GameRulesModal";

const ACCENT = "#0EA5E9";
const QUICK_LEVELS = [1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150];

export default function PerlentaucherLobbyScreen() {
  const navigate = useNavigate();
  const highestUnlocked = useMemo(() => getHighestPerlentaucherLevel(), []);
  const [selectedLevel, setSelectedLevel] = useState(() => {
    const s = getPuzzleSaves().filter(s => s.gameType === "perlentaucher")[0];
    if (!s) return 1;
    try { return (JSON.parse(s.puzzleState).levelNumber as number) ?? 1; } catch { return 1; }
  });
  const [showRules, setShowRules] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [saves, setSaves] = useState(() => getPuzzleSaves().filter(s => s.gameType === "perlentaucher"));
  const [isFavorite, toggleFavorite] = useFavorite("perlentaucher");

  const config = useMemo(() => generateLevel(selectedLevel), [selectedLevel]);
  const bestScore = useMemo(() => getBestPerlentaucherScore(selectedLevel), [selectedLevel, showStats]);

  const allStats = useMemo(() => {
    if (!showStats) return null;
    const scores = getAllPerlentaucherScores();
    const entries = Object.entries(scores)
      .map(([lvl, sc]) => {
        const lvlNum = Number(lvl);
        const target = generateLevel(lvlNum).targetScore;
        const stars = sc >= target * 1.5 ? 3 : sc >= target * 1.2 ? 2 : sc >= target ? 1 : 0;
        return { level: lvlNum, bestScore: sc, target, stars };
      })
      .sort((a, b) => a.level - b.level);
    const starCounts = [3, 2, 1].map(s => entries.filter(e => e.stars === s).length);
    return { entries, starCounts, total: entries.length };
  }, [showStats]);


  function startNew() {
    navigate("/raetsel/perlentaucher/game", { state: { level: selectedLevel, _instance: Date.now() } });
  }

  function resumeSave(save: typeof saves[number]) {
    navigate("/raetsel/perlentaucher/game", {
      state: { level: selectedLevel, saveId: save.id, savedState: save.puzzleState, _instance: Date.now() },
    });
  }

  function deleteSave(id: string) {
    deletePuzzleSave(id);
    setSaves(getPuzzleSaves().filter(s => s.gameType === "perlentaucher"));
  }

  const save = saves[0];
  const savedLevel = save ? (() => {
    try { return JSON.parse(save.puzzleState).levelNumber as number; } catch { return 1; }
  })() : null;

  return (
    <div className="screen">
      <button className="btn btn-outline btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => navigate("/raetsel", { replace: true })}>‹ Zurück</button>

      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, #0c4a6e 0%, ${ACCENT} 100%)`,
        borderRadius: "var(--radius)", padding: "20px",
        display: "flex", alignItems: "center", gap: 16,
      }}>
        <div style={{ fontSize: 44 }}>🤿</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>Rätsel</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "white" }}>Perlentaucher</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-outline btn-sm"
            style={{ width: 42, padding: 0, fontSize: 18, color: "rgba(255,255,255,0.8)", borderColor: "rgba(255,255,255,0.2)" }}
            onClick={() => setShowStats(true)} title="Bestpunktzahl">🏆</button>
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

        {/* Gespeichertes Spiel */}
        {save && savedLevel !== null && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Fortsetzen</div>
            <div style={{ background: "var(--surface)", border: `1px solid ${ACCENT}55`, borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>Level {savedLevel}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  {(() => { try { const s = JSON.parse(save.puzzleState); return `${s.score} Pkt. · ${s.movesLeft} Züge übrig`; } catch { return save.variant; } })()}
                </div>
              </div>
              <button onClick={() => resumeSave(save)} style={{ padding: "8px 14px", background: ACCENT + "22", border: `1px solid ${ACCENT}55`, borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700, color: ACCENT }}>Fortsetzen</button>
              <button onClick={() => deleteSave(save.id)} style={{ padding: "8px 10px", background: "var(--danger)22", border: "1px solid var(--danger)55", borderRadius: 8, cursor: "pointer", fontSize: 13, color: "var(--danger)" }}>✕</button>
            </div>
          </div>
        )}

        {/* Level-Auswahl */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Level wählen</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {QUICK_LEVELS.map(lvl => {
              const locked = lvl > highestUnlocked;
              const sel = selectedLevel === lvl;
              return (
                <button
                  key={lvl}
                  disabled={locked}
                  onClick={() => !locked && setSelectedLevel(lvl)}
                  style={{
                    padding: "12px 0", textAlign: "center",
                    background: sel && !locked ? ACCENT + "22" : "var(--surface)",
                    border: `1.5px solid ${sel && !locked ? ACCENT : locked ? "var(--border)55" : "var(--border)"}`,
                    borderRadius: 12, cursor: locked ? "default" : "pointer",
                    opacity: locked ? 0.35 : 1,
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: sel && !locked ? 800 : 600, color: sel && !locked ? ACCENT : locked ? "var(--text-muted)" : "var(--text)" }}>{lvl}</span>
                  {locked && <span style={{ fontSize: 9, color: "var(--text-muted)" }}>🔒</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Feinauswahl-Slider */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Feinauswahl</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: ACCENT }}>Level {selectedLevel}</span>
          </div>
          <input
            type="range" min={1} max={highestUnlocked} value={selectedLevel}
            onChange={e => setSelectedLevel(Number(e.target.value))}
            style={{ width: "100%", accentColor: ACCENT }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>1</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{highestUnlocked}</span>
          </div>
        </div>

        {/* Level-Info-Karte */}
        <div style={{
          background: "var(--surface)", border: `1px solid ${ACCENT}40`,
          borderRadius: 12, padding: "16px",
          display: "flex", gap: 0, justifyContent: "space-around",
        }}>
          <LevelStat label="Züge" value={config.movesLeft.toString()} />
          <div style={{ width: 1, background: "var(--border)" }} />
          <LevelStat label="Ziel" value={`${config.targetScore.toLocaleString()} Pkt.`} />
          <div style={{ width: 1, background: "var(--border)" }} />
          <LevelStat label="Rekord" value={bestScore ? bestScore.toLocaleString() : "—"} highlight={!!bestScore} />
        </div>

        {/* Start-Button */}
        <button
          onClick={startNew}
          disabled={selectedLevel > highestUnlocked}
          style={{
            padding: "16px", background: selectedLevel > highestUnlocked ? "var(--surface2)" : ACCENT,
            border: "none", borderRadius: 14, cursor: selectedLevel > highestUnlocked ? "default" : "pointer",
            fontSize: 16, fontWeight: 800,
            color: selectedLevel > highestUnlocked ? "var(--text-muted)" : "#0a1628",
          }}
        >
          {selectedLevel > highestUnlocked ? `🔒 Level ${selectedLevel} noch gesperrt` : `Neues Spiel — Level ${selectedLevel}`}
        </button>
      </div>

      {/* Stats-Dialog */}
      {showStats && allStats && (
        <div style={overlayStyle} onClick={() => setShowStats(false)}>
          <div style={{ ...dialogStyle, maxHeight: "85vh", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
            {/* Titel */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexShrink: 0 }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: "var(--text)" }}>🏆 Statistik</span>
              <button onClick={() => setShowStats(false)} style={closeBtnStyle}>✕</button>
            </div>

            {/* Gesamt-Übersicht */}
            <div style={{ background: "var(--surface2)", borderRadius: 12, padding: "12px 16px", marginBottom: 14, flexShrink: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Freigeschaltet</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>{highestUnlocked} / 150 Level</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Absolviert</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{allStats.total} Level</span>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                {[3, 2, 1].map((s, i) => (
                  <div key={s} style={{ textAlign: "center", flex: 1, background: "var(--surface)", borderRadius: 8, padding: "6px 4px" }}>
                    <div style={{ fontSize: 12, color: "#f59e0b" }}>{"★".repeat(s) + "☆".repeat(3 - s)}</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text)", marginTop: 2 }}>{allStats.starCounts[i]}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Ausgewähltes Level */}
            <div style={{ background: ACCENT + "15", border: `1px solid ${ACCENT}40`, borderRadius: 12, padding: "12px 16px", marginBottom: 14, flexShrink: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Level {selectedLevel}</div>
              {bestScore ? (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: ACCENT }}>{bestScore.toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Ziel: {config.targetScore.toLocaleString()} · {config.movesLeft} Züge</div>
                  </div>
                  <div style={{ fontSize: 20, color: "#f59e0b" }}>
                    {(() => { const s = bestScore >= config.targetScore * 1.5 ? 3 : bestScore >= config.targetScore * 1.2 ? 2 : bestScore >= config.targetScore ? 1 : 0; return "★".repeat(s) + "☆".repeat(3 - s); })()}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Noch kein Spiel abgeschlossen · Ziel: {config.targetScore.toLocaleString()} Pkt.</div>
              )}
            </div>

            {/* Level-Liste */}
            {allStats.entries.length > 0 && (
              <div style={{ flexShrink: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Alle Level</div>
              </div>
            )}
            {allStats.entries.length > 0 && (
              <div style={{ overflowY: "auto", flex: 1 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <th style={{ textAlign: "left", padding: "4px 0", color: "var(--text-muted)", fontWeight: 600, fontSize: 11 }}>Lvl</th>
                      <th style={{ textAlign: "right", padding: "4px 0", color: "var(--text-muted)", fontWeight: 600, fontSize: 11 }}>Rekord</th>
                      <th style={{ textAlign: "right", padding: "4px 0", color: "var(--text-muted)", fontWeight: 600, fontSize: 11 }}>Ziel</th>
                      <th style={{ textAlign: "right", padding: "4px 0", color: "var(--text-muted)", fontWeight: 600, fontSize: 11 }}>★</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allStats.entries.map(e => (
                      <tr key={e.level} style={{ borderBottom: "1px solid var(--border)44", background: e.level === selectedLevel ? ACCENT + "10" : "transparent" }}>
                        <td style={{ padding: "5px 0", color: e.level === selectedLevel ? ACCENT : "var(--text)", fontWeight: e.level === selectedLevel ? 800 : 400 }}>{e.level}</td>
                        <td style={{ textAlign: "right", padding: "5px 0", color: "var(--text)", fontWeight: 600 }}>{e.bestScore.toLocaleString()}</td>
                        <td style={{ textAlign: "right", padding: "5px 0", color: "var(--text-muted)" }}>{e.target.toLocaleString()}</td>
                        <td style={{ textAlign: "right", padding: "5px 0", color: "#f59e0b", fontSize: 11 }}>{"★".repeat(e.stars)}{"☆".repeat(3 - e.stars)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {showRules && GAME_RULES["perlentaucher"] && (
        <GameRulesModal rule={GAME_RULES["perlentaucher"]} onClose={() => setShowRules(false)} />
      )}
    </div>
  );
}

function LevelStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ textAlign: "center", flex: 1 }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: highlight ? ACCENT : "var(--text)" }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{label}</div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20,
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
