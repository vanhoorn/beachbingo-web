import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../../firebase";
import { doc, getDoc } from "firebase/firestore";
import { getPuzzleSaves, deletePuzzleSave, formatElapsed, getBestTimeAny } from "../../puzzleSave";
import type { MahjongDifficulty } from "./MahjongLogic";
import { LAYOUT_ORDER, LAYOUTS } from "./MahjongLayouts";
import type { LayoutId } from "./MahjongLayouts";
import GameRulesModal from "../../components/GameRulesModal";
import { GAME_RULES } from "../../gameRules";

const ACCENT = "#D4A820";

const DIFFICULTIES: { id: MahjongDifficulty; label: string; emoji: string; desc: string }[] = [
  { id: "ROOKIE",    label: "Rookie",     emoji: "🌊", desc: "Freie Steine hervorgehoben · unbegrenzte Hinweise" },
  { id: "SNIPER",    label: "Sniper",     emoji: "🎯", desc: "3 Hinweise · 1 Mischung · kein Highlight" },
  { id: "BOSS",      label: "Boss Level", emoji: "💪", desc: "Keine Hilfen · Highscore-Timer" },
];

const VALID_LAYOUTS: LayoutId[] = ["schildkroete", "pyramide", "kreuz", "drachen", "leuchtturm"];

export default function MahjongLobbyScreen() {
  const navigate = useNavigate();
  const [difficulty, setDifficulty] = useState<MahjongDifficulty>("ROOKIE");
  const [layout, setLayout]         = useState<LayoutId>("schildkroete");

  // Load preferred defaults from Firestore
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    getDoc(doc(db, "users", uid)).then((snap) => {
      if (!snap.exists()) return;
      const d = snap.data().preferredMahjongDifficulty as MahjongDifficulty | undefined;
      const l = snap.data().preferredMahjongLayout as LayoutId | undefined;
      if (d && ["ROOKIE", "SNIPER", "BOSS"].includes(d)) setDifficulty(d);
      if (l && VALID_LAYOUTS.includes(l)) setLayout(l);
    }).catch(() => {});
  }, []);
  const [showRules, setShowRules]   = useState(false);
  const [showStats, setShowStats]   = useState(false);
  const [isFavorite, setIsFavorite] = useState(() => {
    try { return (JSON.parse(localStorage.getItem("favoriteGames") ?? "[]") as string[]).includes("mahjong"); }
    catch { return false; }
  });

  const saves = getPuzzleSaves().filter((s) => s.gameType === "mahjong");

  function toggleFavorite() {
    const next = !isFavorite; setIsFavorite(next);
    try {
      const favs = JSON.parse(localStorage.getItem("favoriteGames") ?? "[]") as string[];
      localStorage.setItem("favoriteGames", JSON.stringify(
        next ? [...new Set([...favs, "mahjong"])] : favs.filter((f) => f !== "mahjong"),
      ));
    } catch { /* ignore */ }
  }

  function startNew() {
    navigate("/mahjong/game", { state: { difficulty, layout, seed: Date.now() } });
  }

  function resumeSave(save: ReturnType<typeof getPuzzleSaves>[number]) {
    navigate("/mahjong/game", {
      state: {
        difficulty: save.difficulty as MahjongDifficulty,
        layout: save.variant as LayoutId,
        seed: save.seed,
        saveId: save.id,
        savedState: save.puzzleState,
        elapsedSeconds: save.elapsedSeconds,
      },
    });
  }

  const showLayoutPicker = difficulty !== "ROOKIE";

  return (
    <div className="screen">
      <button className="btn btn-outline btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => navigate(-1)}>
        ‹ Couch
      </button>

      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, #3a2800 0%, ${ACCENT} 100%)`,
        borderRadius: "var(--radius)", padding: "20px",
        display: "flex", alignItems: "center", gap: 16,
      }}>
        <div style={{ fontSize: 44 }}>🀄</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>Couch</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "white" }}>GezeitenSteine</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-outline btn-sm"
            style={{ width: 42, padding: 0, fontSize: 18, color: "rgba(255,255,255,0.8)", borderColor: "rgba(255,255,255,0.2)" }}
            onClick={() => navigate("/mahjong/settings")} title="Einstellungen">⚙️</button>
          <button className="btn btn-outline btn-sm"
            style={{ width: 42, padding: 0, fontSize: 18, color: "rgba(255,255,255,0.8)", borderColor: "rgba(255,255,255,0.2)" }}
            onClick={() => setShowStats(true)} title="Bestzeiten">🏆</button>
          <button className="btn btn-outline btn-sm" onClick={toggleFavorite}
            style={{ width: 42, padding: 0, fontSize: 18, color: isFavorite ? "#facc15" : "rgba(255,255,255,0.8)", borderColor: isFavorite ? "#facc15" : "rgba(255,255,255,0.2)" }}>
            {isFavorite ? "★" : "☆"}
          </button>
          <button className="btn btn-outline btn-sm"
            style={{ width: 42, padding: 0, fontSize: 18, color: "rgba(255,255,255,0.8)", borderColor: "rgba(255,255,255,0.2)" }}
            onClick={() => setShowRules(true)} title="Spielanleitung">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5" fill="currentColor"/></svg>
          </button>
        </div>
      </div>

      {/* About */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.55 }}>
        <strong style={{ color: "var(--text)" }}>Mahjong Solitaire:</strong> Entferne alle 144 Steine durch Paare. Ein Stein ist spielbar, wenn er seitlich frei und nicht verdeckt ist. Jahreszeiten und Blumen passen zu allen ihrer Art.
      </div>

      {/* Difficulty */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Schwierigkeit</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {DIFFICULTIES.map((d) => (
            <button key={d.id} onClick={() => setDifficulty(d.id)} style={{
              padding: "14px 16px",
              background: difficulty === d.id ? ACCENT + "22" : "var(--surface)",
              border: `1.5px solid ${difficulty === d.id ? ACCENT : "var(--border)"}`,
              borderRadius: 12, cursor: "pointer", textAlign: "left",
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>{d.emoji}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: difficulty === d.id ? ACCENT : "var(--text)" }}>{d.label}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{d.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Layout picker (Sniper / Boss) */}
      {showLayoutPicker && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Layout</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {LAYOUT_ORDER.map((lid) => {
              const l = LAYOUTS[lid];
              const sel = layout === lid;
              return (
                <button key={lid} onClick={() => setLayout(lid)} style={{
                  padding: "10px 12px",
                  background: sel ? ACCENT + "22" : "var(--surface)",
                  border: `1.5px solid ${sel ? ACCENT : "var(--border)"}`,
                  borderRadius: 10, cursor: "pointer", textAlign: "left",
                  display: "flex", flexDirection: "column", gap: 6,
                }}>
                  <LayoutPreview positions={l.positions} active={sel} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: sel ? ACCENT : "var(--text)" }}>{l.emoji} {l.label}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{l.tileCount} Steine</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Start button */}
      <button onClick={startNew} style={{
        padding: "16px", background: ACCENT, border: "none",
        borderRadius: 14, cursor: "pointer", fontSize: 16, fontWeight: 800, color: "#0a1628",
      }}>
        Neues Spiel starten
      </button>

      {/* Saved games */}
      {saves.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Gespeicherte Spiele</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {saves.map((save) => (
              <div key={save.id} style={{
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: 12, padding: "14px 16px",
                display: "flex", alignItems: "center", gap: 12,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
                    {DIFFICULTIES.find((d) => d.id === save.difficulty)?.label ?? save.difficulty}
                    {" · "}{LAYOUTS[save.variant as LayoutId]?.emoji ?? ""} {LAYOUTS[save.variant as LayoutId]?.label ?? save.variant}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    {formatElapsed(save.elapsedSeconds)} gespielt
                  </div>
                </div>
                <button onClick={() => resumeSave(save)} style={{
                  padding: "8px 14px", background: ACCENT + "22",
                  border: `1px solid ${ACCENT}55`, borderRadius: 8,
                  cursor: "pointer", fontSize: 13, fontWeight: 700, color: ACCENT,
                }}>Fortsetzen</button>
                <button onClick={() => { deletePuzzleSave(save.id); window.location.reload(); }} style={{
                  padding: "8px 10px", background: "var(--danger)22",
                  border: "1px solid var(--danger)55", borderRadius: 8,
                  cursor: "pointer", fontSize: 13, color: "var(--danger)",
                }}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats modal */}
      {showStats && (
        <div style={overlay} onClick={() => setShowStats(false)}>
          <div style={dialog} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: "var(--text)" }}>🏆 Bestzeiten (Boss Level)</span>
              <button onClick={() => setShowStats(false)} style={closeBtn}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {LAYOUT_ORDER.map((lid) => {
                const l = LAYOUTS[lid];
                const best = getBestTimeAny(`mahjong_${lid}`, "BOSS");
                return (
                  <div key={lid} style={{ background: "var(--surface2)", borderRadius: 10, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 14, color: "var(--text)" }}>{l.emoji} {l.label}</span>
                    <span style={{ fontSize: 18, fontWeight: 800, color: best ? ACCENT : "var(--text-muted)" }}>{best ? formatElapsed(best) : "—"}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showRules && GAME_RULES["mahjong"] && (
        <GameRulesModal rule={GAME_RULES["mahjong"]} onClose={() => setShowRules(false)} />
      )}
    </div>
  );
}

function LayoutPreview({ positions, active }: { positions: [number, number, number][]; active: boolean }) {
  const layer0 = positions.filter(([, , l]) => l === 0);
  if (layer0.length === 0) return null;
  const cols = layer0.map(([c]) => c);
  const rows = layer0.map(([, r]) => r);
  const minC = Math.min(...cols), maxC = Math.max(...cols);
  const minR = Math.min(...rows), maxR = Math.max(...rows);
  const spanC = (maxC - minC) / 2 + 1;
  const spanR = (maxR - minR) / 2 + 1;
  const dotW = Math.min(5, 60 / spanC);
  const dotH = dotW * 1.3;
  const W = Math.ceil(spanC * dotW);
  const H = Math.ceil(spanR * dotH);
  return (
    <div style={{ position: "relative", width: W, height: H, flexShrink: 0 }}>
      {layer0.map(([c, r], i) => (
        <div key={i} style={{
          position: "absolute",
          left: (c - minC) / 2 * dotW,
          top: (r - minR) / 2 * dotH,
          width: dotW - 1, height: dotH - 1,
          background: active ? "#D4A820" : "var(--text-muted)",
          borderRadius: 1,
          opacity: active ? 0.9 : 0.45,
        }} />
      ))}
    </div>
  );
}

const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 };
const dialog: React.CSSProperties  = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 20, padding: 24, width: "100%", maxWidth: 380 };
const closeBtn: React.CSSProperties = { background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, width: 32, height: 32, cursor: "pointer", color: "var(--text-muted)", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" };
