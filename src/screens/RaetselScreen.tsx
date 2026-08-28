import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { RIDDLE_GAMES, type GameMetadata } from "../gameMetadata";
import { GAME_RULES } from "../gameRules";
import GameRulesModal from "../components/GameRulesModal";

export default function RaetselScreen() {
  const navigate = useNavigate();
  const games = [...RIDDLE_GAMES].sort((a, b) => a.title.localeCompare(b.title));
  const [rulesGameId, setRulesGameId] = useState<string | null>(null);
  const activeRule = rulesGameId ? GAME_RULES[rulesGameId] : null;

  return (
    <div className="screen" style={{ gap: 0, paddingTop: 0 }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, var(--surface) 0%, var(--surface2) 100%)",
        padding: "20px 20px",
        display: "flex", alignItems: "center", gap: 14,
      }}>
        <button
          onClick={() => navigate("/home", { replace: true })}
          style={{
            width: 40, height: 40, flexShrink: 0,
            background: "var(--surface2)", border: "1px solid var(--border)",
            borderRadius: 12, cursor: "pointer", fontSize: 18,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >‹</button>
        <span style={{ fontSize: 32, lineHeight: 1 }}>🧩</span>
        <div>
          <div style={{
            fontSize: 10, color: "var(--text-muted)", fontWeight: 700,
            letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 2,
          }}>KATEGORIE</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text)" }}>Rätsel</div>
        </div>
      </div>

      {/* Intro */}
      <div style={{
        margin: "16px 20px 0",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "14px 16px",
        fontSize: 13,
        color: "var(--text-muted)",
        lineHeight: 1.55,
      }}>
        🧠 Logik-Rätsel für Solo-Spieler — von Sudoku bis Schiffe Versenken. Tippe auf{" "}
        <strong style={{ color: "var(--text)" }}>ℹ</strong> für die Anleitung.
      </div>

      {/* Game list */}
      <div style={{ padding: "16px 20px 32px", display: "flex", flexDirection: "column", gap: 14 }}>
        {games.map((game) => (
          <RaetselRow
            key={game.id}
            game={game}
            onPlay={() => navigate(`/raetsel/${game.id}/lobby`)}
            onInfo={() => setRulesGameId(game.id)}
          />
        ))}
      </div>

      {activeRule && (
        <GameRulesModal rule={activeRule} onClose={() => setRulesGameId(null)} />
      )}
    </div>
  );
}

function RaetselRow({
  game,
  onPlay,
  onInfo,
}: {
  game: GameMetadata;
  onPlay: () => void;
  onInfo: () => void;
}) {
  const [infoHovered, setInfoHovered] = useState(false);

  return (
    <div
      onClick={onPlay}
      style={{
        display: "flex", alignItems: "center", gap: 16, padding: 20,
        background: "var(--surface)",
        border: `1.5px solid ${game.color}59`,
        borderRadius: 16,
        textAlign: "left",
        cursor: "pointer",
      }}
    >
      {/* Emoji icon */}
      <div style={{
        width: 64, height: 64, flexShrink: 0, borderRadius: 14,
        background: game.color + "26",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 30,
      }}>
        {game.emoji}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: "var(--text)" }}>
            {game.title}
          </span>
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.4 }}>
          {game.description}
        </div>
      </div>

      {/* Info button */}
      <button
        onClick={(e) => { e.stopPropagation(); onInfo(); }}
        onMouseEnter={() => setInfoHovered(true)}
        onMouseLeave={() => setInfoHovered(false)}
        title="Anleitung anzeigen"
        style={{
          width: 34, height: 34, flexShrink: 0,
          background: infoHovered ? game.color + "33" : "var(--surface2)",
          border: `1px solid ${infoHovered ? game.color : "var(--border)"}`,
          borderRadius: 10, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, color: game.color,
          transition: "background 0.15s, border-color 0.15s",
        }}
      >ℹ</button>
    </div>
  );
}
