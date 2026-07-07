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
  message?: string;
  onConfirm: () => void;
  onDismiss: () => void;
}

export function QuitConfirmDialog({ message = "Dein Fortschritt geht verloren.", onConfirm, onDismiss }: QuitDialogProps) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999,
    }}>
      <div style={{
        background: "var(--surface)", borderRadius: 16,
        padding: "28px 24px", maxWidth: 320, width: "90%",
        border: "1.5px solid rgba(239,68,68,0.3)",
        display: "flex", flexDirection: "column", gap: 16, alignItems: "center",
      }}>
        <div style={{ fontSize: 36 }}>🏳️</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>Spiel abbrechen?</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>{message}</div>
        <div style={{ display: "flex", gap: 10, width: "100%" }}>
          <button
            onClick={onDismiss}
            style={{
              flex: 1, padding: "10px 0", borderRadius: 10, border: "1px solid var(--border)",
              background: "var(--surface2)", color: "var(--text)", fontWeight: 600, cursor: "pointer",
            }}
          >
            Weiterspielen
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1, padding: "10px 0", borderRadius: 10, border: "none",
              background: "rgba(239,68,68,0.85)", color: "#fff", fontWeight: 600, cursor: "pointer",
            }}
          >
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}
