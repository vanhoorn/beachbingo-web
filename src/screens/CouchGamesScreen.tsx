import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { COUCH_GAMES, type GameMetadata } from "../gameMetadata";
import { GAME_RULES } from "../gameRules";
import GameRulesModal from "../components/GameRulesModal";
import { isBonusAvailable } from "./sonnenrad/sonnenradLogic";

export default function CouchGamesScreen() {
  const navigate = useNavigate();
  const games = [...COUCH_GAMES].sort((a, b) => a.title.localeCompare(b.title));
  const [rulesGameId, setRulesGameId] = useState<string | null>(null);
  const activeRule = rulesGameId ? GAME_RULES[rulesGameId] : null;
  const sonnenradBonus = isBonusAvailable();

  return (
    <div className="screen" style={{ gap: 0, paddingTop: 0 }}>
      <style>{`@keyframes sr-lobby-pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.25)} }`}</style>
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
        <span style={{ fontSize: 32, lineHeight: 1 }}>🛋️</span>
        <div>
          <div style={{
            fontSize: 10, color: "var(--text-muted)", fontWeight: 700,
            letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 2,
          }}>KATEGORIE</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text)" }}>Couch</div>
        </div>
      </div>

      <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 14 }}>
        {games.map((game) => (
          <GameRow
            key={game.id}
            game={game}
            onClick={() => navigate(game.path)}
            onInfo={() => setRulesGameId(game.id)}
            badge={game.id === "sonnenrad" && sonnenradBonus ? "🌟" : undefined}
          />
        ))}
      </div>

      {activeRule && (
        <GameRulesModal rule={activeRule} onClose={() => setRulesGameId(null)} />
      )}
    </div>
  );
}

function GameRow({
  game,
  onClick,
  onInfo,
  badge,
}: {
  game: GameMetadata;
  onClick: () => void;
  onInfo: () => void;
  badge?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const [infoHovered, setInfoHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: 16, padding: 20,
        background: "var(--surface)",
        border: `1.5px solid ${hovered ? game.color : game.color + "59"}`,
        borderRadius: 16, cursor: "pointer", textAlign: "left",
        transition: "border-color 0.15s",
      }}
    >
      <div style={{ position: "relative", flexShrink: 0 }}>
        <div style={{
          width: 64, height: 64, borderRadius: 14,
          background: game.color + "26",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 32,
        }}>
          {game.emoji}
        </div>
        {badge && (
          <div style={{
            position: "absolute", top: -6, right: -6,
            fontSize: 16, lineHeight: 1,
            animation: "sr-lobby-pulse 1.4s ease-in-out infinite",
          }}>
            {badge}
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>{game.title}</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.4 }}>
          {game.description}
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onInfo(); }}
        onMouseEnter={(e) => { e.stopPropagation(); setInfoHovered(true); }}
        onMouseLeave={(e) => { e.stopPropagation(); setInfoHovered(false); }}
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
      <span style={{ fontSize: 20, color: "var(--text-muted)", flexShrink: 0 }}>›</span>
    </div>
  );
}
