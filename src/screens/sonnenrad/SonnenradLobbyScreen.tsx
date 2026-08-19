import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { GAME_RULES } from "../../gameRules";
import GameRulesModal from "../../components/GameRulesModal";
import {
  isBonusAvailable, msUntilBonus, formatMs,
  getLifetimePoints, STEP_POINTS, NORMAL_STEP_POINTS,
} from "./sonnenradLogic";

const GOLD = "#D4A820";

export default function SonnenradLobbyScreen() {
  const navigate = useNavigate();

  const [bonusAvail, setBonusAvail]     = useState(() => isBonusAvailable());
  const [nextBonusMs, setNextBonusMs]   = useState(() => msUntilBonus());
  const lifetimePoints                  = getLifetimePoints();
  const countdownRef                    = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isFavorite, setIsFavorite]     = useState(() => {
    try {
      return (JSON.parse(localStorage.getItem("favoriteGames") ?? "[]") as string[]).includes("sonnenrad");
    } catch { return false; }
  });
  const [showStats, setShowStats]       = useState(false);
  const [showRules, setShowRules]       = useState(false);

  // Live countdown when no bonus available
  useEffect(() => {
    if (bonusAvail) return;
    countdownRef.current = setInterval(() => {
      const ms = msUntilBonus();
      setNextBonusMs(ms);
      if (ms <= 0) {
        setBonusAvail(true);
        clearInterval(countdownRef.current!);
      }
    }, 1000);
    return () => clearInterval(countdownRef.current!);
  }, [bonusAvail]);

  function toggleFavorite() {
    const next = !isFavorite;
    setIsFavorite(next);
    try {
      const favs = JSON.parse(localStorage.getItem("favoriteGames") ?? "[]") as string[];
      localStorage.setItem(
        "favoriteGames",
        JSON.stringify(next ? [...new Set([...favs, "sonnenrad"])] : favs.filter((f) => f !== "sonnenrad")),
      );
    } catch { /* ignore */ }
  }

  const bonusBorder = bonusAvail ? `1.5px solid ${GOLD}99` : "1.5px solid var(--border)";
  const bonusBg     = bonusAvail ? `${GOLD}18` : "var(--surface)";

  return (
    <div className="screen">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        background: "linear-gradient(135deg, #1a1200 0%, #3a2800 100%)",
        borderRadius: "var(--radius)", padding: "20px",
        display: "flex", alignItems: "center", gap: 14,
      }}>
        <button className="btn btn-outline btn-sm"
          style={{ width: 40, height: 40, padding: 0, fontSize: 20, flexShrink: 0 }}
          onClick={() => navigate(-1)}>‹</button>
        <div style={{ fontSize: 40, lineHeight: 1 }}>☀️</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>TAGESBONUS</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "white" }}>Sonnenrad</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-outline btn-sm"
            style={{ width: 42, padding: 0, fontSize: 18, color: GOLD, borderColor: `${GOLD}55` }}
            onClick={() => setShowStats(true)} title="Statistik">🏆</button>
          <button className="btn btn-outline btn-sm"
            style={{ width: 42, padding: 0, fontSize: 16, color: "rgba(255,255,255,0.8)", borderColor: "rgba(255,255,255,0.2)" }}
            onClick={() => setShowRules(true)} title="Spielanleitung">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5" fill="currentColor"/>
            </svg>
          </button>
          <button className="btn btn-outline btn-sm" onClick={toggleFavorite}
            style={{ width: 42, padding: 0, fontSize: 18, color: isFavorite ? "#facc15" : "rgba(255,255,255,0.8)", borderColor: isFavorite ? "#facc15" : "rgba(255,255,255,0.2)" }}>
            {isFavorite ? "★" : "☆"}
          </button>
        </div>
      </div>

      {/* ── Bonus-Status ────────────────────────────────────────────────────── */}
      <div style={{
        background: bonusBg, border: bonusBorder,
        borderRadius: 16, padding: "18px 20px",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
        textAlign: "center",
      }}>
        {bonusAvail ? (
          <>
            <div style={{ fontSize: 20, fontWeight: 800, color: GOLD }}>🌟 Tagesbonus verfügbar!</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Volle Punkte — bis zu 600 pro Runde</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Nächster Tagesbonus in</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
              {formatMs(nextBonusMs)}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Normales Spiel: 1/3 Punkte (bis zu 200)</div>
          </>
        )}
      </div>

      {/* ── Punkte gesamt ───────────────────────────────────────────────────── */}
      {lifetimePoints > 0 && (
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 12, padding: "12px 16px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ fontSize: 14, color: "var(--text-sub)" }}>Gesammelte Punkte</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: GOLD }}>{lifetimePoints} Pkt.</span>
        </div>
      )}

      {/* ── Punktetabelle ───────────────────────────────────────────────────── */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px 8px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1 }}>
            Bonusleiter
          </div>
        </div>
        <div style={{ padding: "4px 0 8px" }}>
          {/* Column headers */}
          <div style={{ display: "flex", padding: "4px 16px 4px", gap: 8 }}>
            <div style={{ flex: 1 }} />
            <div style={{ width: 80, textAlign: "right", fontSize: 11, fontWeight: 700, color: GOLD }}>Tagesbonus</div>
            <div style={{ width: 64, textAlign: "right", fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>Normal</div>
          </div>
          {([
            ["Stufe 6 — Maximum",    5],
            ["Stufe 5",              4],
            ["Stufe 4 — Jackpot ☀️", 3],
            ["Stufe 3",              2],
            ["Stufe 2",              1],
            ["Stufe 1",              0],
          ] as [string, number][]).map(([label, idx]) => (
            <div key={idx} style={{ display: "flex", alignItems: "center", padding: "6px 16px", gap: 8 }}>
              <div style={{ flex: 1, fontSize: 13, color: "var(--text-sub)" }}>{label}</div>
              <div style={{ width: 80, textAlign: "right", fontSize: 13, color: GOLD }}>{STEP_POINTS[idx + 1]} Pkt.</div>
              <div style={{ width: 64, textAlign: "right", fontSize: 13, color: "var(--text-muted)" }}>{NORMAL_STEP_POINTS[idx + 1]} Pkt.</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Spielen-Button ──────────────────────────────────────────────────── */}
      <button
        onClick={() => navigate("/sonnenrad/game")}
        style={{
          padding: 16, border: "none", borderRadius: 14, cursor: "pointer",
          fontSize: 17, fontWeight: 800,
          background: bonusAvail ? GOLD : "#0ea5e9",
          color: bonusAvail ? "#0a1628" : "#fff",
        }}
      >
        {bonusAvail ? "🌟 Tagesbonus spielen" : "Spielen"}
      </button>

      {/* ── Stats-Dialog ────────────────────────────────────────────────────── */}
      {showStats && (
        <div style={overlay} onClick={() => setShowStats(false)}>
          <div style={dialog} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <span style={{ fontSize: 17, fontWeight: 800, color: "var(--text)" }}>☀️ Sonnenrad — Statistik</span>
              <button onClick={() => setShowStats(false)} style={closeBtn}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", background: "var(--surface2)", borderRadius: 10, padding: "12px 14px" }}>
                <span style={{ fontSize: 14, color: "var(--text)" }}>Gesammelte Punkte</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: GOLD }}>{lifetimePoints}</span>
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
                Einmal täglich gibt es den vollen Tagesbonus. Normale Runden laufen jederzeit mit 1/3 der Punkte.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Regeln-Modal ────────────────────────────────────────────────────── */}
      {showRules && GAME_RULES["sonnenrad"] && (
        <GameRulesModal rule={GAME_RULES["sonnenrad"]} onClose={() => setShowRules(false)} />
      )}
    </div>
  );
}

const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 };
const dialog: React.CSSProperties  = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 20, padding: 24, width: "100%", maxWidth: 360 };
const closeBtn: React.CSSProperties = { background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, width: 32, height: 32, cursor: "pointer", color: "var(--text-muted)", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" };
