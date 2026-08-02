import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  DIFFICULTIES, DIFFICULTY_CONFIG, getDailyWord, hasDailyBeenPlayed,
  getStats, initWwWordLists, isWwReady, type WortWelleDifficulty,
} from "./wortwelleLogic";
import { getPuzzleSaves, deletePuzzleSave, formatElapsed } from "../../../puzzleSave";

const ACCENT = "#06b6d4";

const RULES_TEXT = [
  "Errate das versteckte Wort — Buchstabe für Buchstabe.",
  "Nach jedem Versuch zeigt dir die Farbe, wie nah du bist.",
  "🟩 Grün: Buchstabe ist richtig und an der richtigen Stelle.",
  "🟨 Gelb: Buchstabe ist im Wort, aber an der falschen Stelle.",
  "⬛ Grau: Buchstabe kommt im Wort nicht vor.",
  "Im Experten-Modus (Hard Mode) musst du bestätigte Buchstaben in allen Folge-Versuchen verwenden.",
  "Doppelbuchstaben werden korrekt behandelt.",
];

export default function WortWelleLobbyScreen() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<WortWelleDifficulty>("mittel");
  const [showRules, setShowRules] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [wordBankReady, setWordBankReady] = useState(isWwReady);
  const saves = getPuzzleSaves().filter(s => s.gameType === "wortwelle");
  const [isFavorite, setIsFavorite] = useState(() => {
    try { return (JSON.parse(localStorage.getItem("favoriteGames") ?? "[]") as string[]).includes("wortwelle"); }
    catch { return false; }
  });
  function toggleFavorite() {
    const next = !isFavorite; setIsFavorite(next);
    try {
      const favs = JSON.parse(localStorage.getItem("favoriteGames") ?? "[]") as string[];
      localStorage.setItem("favoriteGames", JSON.stringify(next ? [...new Set([...favs, "wortwelle"])] : favs.filter(f => f !== "wortwelle")));
    } catch { }
  }

  useEffect(() => {
    if (!isWwReady()) {
      initWwWordLists().then(() => setWordBankReady(true));
    }
  }, []);

  const { word: dailyWord, dateStr } = wordBankReady
    ? getDailyWord(selected)
    : { word: "", dateStr: "" };
  const dailyDone = wordBankReady ? hasDailyBeenPlayed(selected, dateStr) : false;

  const startRandom = () => {
    navigate("/raetsel/wortwelle/game", { state: { difficulty: selected, mode: "random" } });
  };

  const startDaily = () => {
    navigate("/raetsel/wortwelle/game", { state: { difficulty: selected, mode: "daily", dailyWord, dateStr } });
  };

  const resumeSave = (save: ReturnType<typeof getPuzzleSaves>[number]) => {
    navigate("/raetsel/wortwelle/game", {
      state: {
        difficulty: save.difficulty as WortWelleDifficulty,
        mode: "random",
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
        background: `linear-gradient(135deg, #083344 0%, ${ACCENT} 100%)`,
        borderRadius: "var(--radius)", padding: "20px",
        display: "flex", alignItems: "center", gap: 16,
      }}>
        <div style={{ fontSize: 44 }}>🌊</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>Rätsel</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "white" }}>WortWelle</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-outline btn-sm"
            style={{ width: 42, padding: 0, fontSize: 18, color: "rgba(255,255,255,0.8)", borderColor: "rgba(255,255,255,0.2)" }}
            onClick={() => setShowStats(true)} title="Statistiken">🏆</button>
          <button className="btn btn-outline btn-sm" onClick={toggleFavorite}
            style={{ width: 42, padding: 0, fontSize: 18, color: isFavorite ? "var(--accent)" : "rgba(255,255,255,0.8)", borderColor: isFavorite ? "var(--accent)" : "rgba(255,255,255,0.2)" }}>
            {isFavorite ? "★" : "☆"}
          </button>
          <button className="btn btn-outline btn-sm"
            style={{ width: 42, padding: 0, fontSize: 18, color: "rgba(255,255,255,0.8)", borderColor: "rgba(255,255,255,0.2)" }}
            onClick={() => setShowRules(true)} title="Spielanleitung">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5" fill="currentColor"/></svg>
          </button>
          <button className="btn btn-outline btn-sm"
            style={{ width: 42, padding: 0, fontSize: 18, color: "rgba(255,255,255,0.8)", borderColor: "rgba(255,255,255,0.2)" }}
            onClick={() => navigate("/raetsel/wortwelle/settings")} title="Einstellungen">⚙️</button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* About */}
        <div style={cardStyle}>
          <strong style={{ color: "var(--text)" }}>Wordle auf Deutsch:</strong>{" "}
          Errate das Wort in möglichst wenigen Versuchen. Grün = richtige Position, Gelb = im Wort aber falsche Stelle.
        </div>

        {/* Schwierigkeit */}
        <div>
          <div style={labelStyle}>Schwierigkeit</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {DIFFICULTIES.map(d => {
              const cfg = DIFFICULTY_CONFIG[d];
              return (
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
                    {cfg.label}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                    {cfg.description}
                  </div>
                  {cfg.hardMode && (
                    <div style={{ fontSize: 10, color: "#f59e0b", marginTop: 4, fontWeight: 700 }}>⚡ Hard Mode</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tageswort */}
        <div style={{ ...cardStyle, background: dailyDone ? "var(--surface)" : ACCENT + "11", border: `1px solid ${dailyDone ? "var(--border)" : ACCENT + "44"}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: dailyDone ? "var(--text-muted)" : "var(--text)" }}>
                🗓 Wort des Tages
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                {dailyDone ? "Heute bereits gespielt ✓" : "Täglich ein neues Wort für alle"}
              </div>
            </div>
            <button
              onClick={startDaily}
              disabled={!wordBankReady || dailyDone}
              style={{
                padding: "10px 18px",
                background: !wordBankReady || dailyDone ? "var(--surface2)" : ACCENT,
                color: !wordBankReady || dailyDone ? "var(--text-muted)" : "#000",
                border: "none", borderRadius: 10, cursor: (!wordBankReady || dailyDone) ? "default" : "pointer",
                fontWeight: 700, fontSize: 14, flexShrink: 0,
              }}
            >
              {!wordBankReady ? "Laden…" : dailyDone ? "Erledigt" : "Spielen"}
            </button>
          </div>
        </div>

        {/* Start Zufallsspiel */}
        <button
          onClick={startRandom}
          disabled={!wordBankReady}
          style={{
            padding: "16px", background: wordBankReady ? ACCENT : "var(--surface2)",
            color: wordBankReady ? "#000" : "var(--text-muted)",
            border: "none", borderRadius: 14, cursor: wordBankReady ? "pointer" : "default",
            fontWeight: 800, fontSize: 16,
          }}
        >
          {wordBankReady ? "🌊 Zufälliges Spiel starten" : "⏳ Wörter werden geladen…"}
        </button>

        {/* Gespeicherte Spiele */}
        {saves.length > 0 && (
          <div>
            <div style={labelStyle}>Gespeicherte Spiele</div>
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
                      {DIFFICULTY_CONFIG[save.difficulty as WortWelleDifficulty]?.label ?? save.difficulty}
                      {" · "}
                      <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
                        {formatElapsed(save.elapsedSeconds)}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                      {new Date(save.startedAt).toLocaleDateString("de-DE")}
                    </div>
                  </div>
                  <button
                    onClick={() => resumeSave(save)}
                    style={{ padding: "8px 14px", background: ACCENT + "22", color: ACCENT, border: `1px solid ${ACCENT}55`, borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13 }}
                  >
                    Weiter →
                  </button>
                  <button
                    onClick={() => deletePuzzleSave(save.id)}
                    style={{ padding: "8px 10px", background: "transparent", color: "var(--danger)", border: "1px solid var(--danger)44", borderRadius: 8, cursor: "pointer", fontSize: 13 }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Regeln-Dialog */}
      {showRules && <RulesDialog onClose={() => setShowRules(false)} />}

      {/* Statistik-Dialog */}
      {showStats && <StatsDialog difficulty={selected} onClose={() => setShowStats(false)} />}
    </div>
  );
}

// ── Regeln-Dialog ──────────────────────────────────────────────────────────────

function RulesDialog({ onClose }: { onClose: () => void }) {
  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={{ ...dialogStyle, maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 24 }}>🌊</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: "var(--text)" }}>Spielregeln</span>
          </div>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {RULES_TEXT.map((r, i) => (
            <div key={i} style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.55 }}>{r}</div>
          ))}
        </div>
        {/* Beispiel */}
        <div style={{ marginTop: 20, padding: "14px 16px", background: "var(--surface2)", borderRadius: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Beispiel</div>
          <div style={{ display: "flex", gap: 4 }}>
            {["S","T","R","A","N","D"].map((l, i) => (
              <div key={i} style={{
                width: 40, height: 40, borderRadius: 6,
                background: i === 0 ? "#22c55e" : i === 2 ? "#eab308" : "var(--surface)",
                border: `2px solid ${i === 0 ? "#22c55e" : i === 2 ? "#eab308" : "var(--border)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 900, fontSize: 18, color: i === 0 || i === 2 ? "#000" : "var(--text)",
              }}>{l}</div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.5 }}>
            <strong style={{ color: "#22c55e" }}>S</strong> ist richtig und an Position 1. {" "}
            <strong style={{ color: "#eab308" }}>R</strong> ist im Wort, aber nicht an Position 3.
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Statistik-Dialog ───────────────────────────────────────────────────────────

function StatsDialog({ difficulty, onClose }: { difficulty: WortWelleDifficulty; onClose: () => void }) {
  const stats = getStats(difficulty);
  const { maxGuesses, label } = DIFFICULTY_CONFIG[difficulty];
  const winPct = stats.played > 0 ? Math.round((stats.won / stats.played) * 100) : 0;
  const maxBar = Math.max(1, ...stats.distribution);

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={{ ...dialogStyle, maxWidth: 380 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: "var(--text)" }}>Statistiken · {label}</span>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>

        {/* Kennzahlen */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 20 }}>
          {[
            { val: stats.played, lbl: "Gespielt" },
            { val: `${winPct}%`, lbl: "Gewonnen" },
            { val: stats.currentStreak, lbl: "Streak" },
            { val: stats.maxStreak, lbl: "Max Streak" },
          ].map(({ val, lbl }) => (
            <div key={lbl} style={{ textAlign: "center", background: "var(--surface2)", borderRadius: 10, padding: "10px 4px" }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: ACCENT }}>{val}</div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{lbl}</div>
            </div>
          ))}
        </div>

        {/* Verteilung */}
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>
          Rateanzahl-Verteilung
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {stats.distribution.slice(0, maxGuesses).map((count, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 16, textAlign: "right", fontSize: 13, color: "var(--text-muted)", flexShrink: 0 }}>{i + 1}</div>
              <div style={{ flex: 1, background: "var(--surface2)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{
                  height: 22, width: `${(count / maxBar) * 100}%`, minWidth: count > 0 ? 32 : 0,
                  background: ACCENT, borderRadius: 4,
                  display: "flex", alignItems: "center", justifyContent: "flex-end",
                  paddingRight: 6, fontSize: 12, fontWeight: 700, color: "#000",
                  transition: "width 0.4s ease",
                }}>
                  {count > 0 ? count : ""}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Tageswort-Statistik */}
        {stats.dailyPlayed > 0 && (
          <div style={{ marginTop: 20, padding: "12px 14px", background: "var(--surface2)", borderRadius: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
              🗓 Tageswort
            </div>
            <div style={{ display: "flex", gap: 16, fontSize: 13, color: "var(--text)" }}>
              <span>Gespielt: <strong>{stats.dailyPlayed}</strong></span>
              <span>Gewonnen: <strong>{stats.dailyWon}</strong></span>
              <span>Streak: <strong>{stats.dailyCurrentStreak}</strong></span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────


const cardStyle: React.CSSProperties = {
  background: "var(--surface)", border: "1px solid var(--border)",
  borderRadius: 12, padding: "14px 16px",
  fontSize: 13, color: "var(--text-muted)", lineHeight: 1.55,
};

const labelStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, color: "var(--text-muted)",
  marginBottom: 10, textTransform: "uppercase", letterSpacing: 1,
};

const overlayStyle: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
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
  borderRadius: 8, width: 32, height: 32, cursor: "pointer",
  color: "var(--text-muted)", fontSize: 14, display: "flex",
  alignItems: "center", justifyContent: "center",
};
