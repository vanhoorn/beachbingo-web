import type { CSSProperties, ReactNode } from "react";

interface GameHudBarProps {
  paused: boolean;
  onPauseToggle: () => void;
  onQuit: () => void;
  pauseDisabled?: boolean;
  children?: ReactNode;
}

export function GameHudBar({
  paused,
  onPauseToggle,
  onQuit,
  pauseDisabled = false,
  children,
}: GameHudBarProps) {
  const btnBase: CSSProperties = {
    borderRadius: 8, width: 36, height: 36, fontSize: 16,
    cursor: "pointer", display: "flex", alignItems: "center",
    justifyContent: "center", flexShrink: 0, border: "1px solid",
    transition: "all 0.15s",
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "6px 8px",
      background: "var(--surface)", borderTop: "1px solid var(--border)",
    }}>
      {/* Game-specific info */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
        {children}
      </div>

      {/* Pause / Play */}
      <button
        onClick={onPauseToggle}
        disabled={pauseDisabled}
        title="Pause"
        style={{
          ...btnBase,
          background: paused ? "rgba(14,165,233,0.2)" : "rgba(255,255,255,0.05)",
          borderColor: paused ? "var(--primary)" : "var(--border)",
          color: paused ? "var(--primary)" : "var(--text-muted)",
          opacity: pauseDisabled ? 0.4 : 1,
          cursor: pauseDisabled ? "default" : "pointer",
        }}
      >
        {paused ? "▶" : "⏸"}
      </button>

      {/* Quit */}
      <button
        onClick={onQuit}
        title="Spiel abbrechen"
        style={{
          ...btnBase,
          background: "rgba(239,68,68,0.12)",
          borderColor: "rgba(239,68,68,0.5)",
          color: "#ef4444",
        }}
      >
        ✕
      </button>
    </div>
  );
}

interface QuitDialogProps {
  emoji?: string;
  message?: string;
  onConfirm: () => void;
  onDismiss: () => void;
}

interface GameSaveQuitDialogProps {
  emoji?: string;
  message?: string;
  hideSave?: boolean;
  onContinue: () => void;
  onSaveAndQuit: () => void;
  onQuitWithoutSave: () => void;
}

const quitOverlay: CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999,
};
const quitDialog: CSSProperties = {
  background: "var(--surface)", borderRadius: 20,
  padding: "28px 24px", maxWidth: 340, width: "90%",
  border: "1.5px solid rgba(239,68,68,0.3)",
  display: "flex", flexDirection: "column", gap: 10, alignItems: "center",
};
const quitBtn = (bg: string, color: string, border = "none"): CSSProperties => ({
  width: "100%", padding: "13px 0", borderRadius: 10, border,
  background: bg, color, fontWeight: 700, cursor: "pointer", fontSize: 14,
});

export function GameSaveQuitDialog({
  emoji = "🏳️", message = "",
  hideSave = false,
  onContinue, onSaveAndQuit, onQuitWithoutSave,
}: GameSaveQuitDialogProps) {
  return (
    <div style={quitOverlay}>
      <div style={quitDialog}>
        <div style={{ fontSize: 40 }}>{emoji}</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>Spiel beenden?</div>
        {message && <div style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>{message}</div>}
        <button onClick={onContinue} style={quitBtn("var(--surface2)", "var(--text)", "1px solid var(--border)")}>Weiterspielen</button>
        {!hideSave && (
          <button onClick={onSaveAndQuit} style={quitBtn("#0ea5e9", "#fff")}>💾 Speichern &amp; Beenden</button>
        )}
        <button onClick={onQuitWithoutSave} style={quitBtn("transparent", "#ef4444", "1.5px solid rgba(239,68,68,0.55)")}>✕ Beenden ohne Speichern</button>
      </div>
    </div>
  );
}

export function QuitConfirmDialog({
  emoji = "🏳️", message = "Dein Fortschritt geht verloren.",
  onConfirm, onDismiss,
}: QuitDialogProps) {
  return (
    <div style={quitOverlay}>
      <div style={quitDialog}>
        <div style={{ fontSize: 40 }}>{emoji}</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>Spiel beenden?</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>{message}</div>
        <button onClick={onDismiss} style={quitBtn("var(--surface2)", "var(--text)", "1px solid var(--border)")}>Weiterspielen</button>
        <button onClick={onConfirm} style={quitBtn("transparent", "#ef4444", "1.5px solid rgba(239,68,68,0.55)")}>✕ Beenden</button>
      </div>
    </div>
  );
}
