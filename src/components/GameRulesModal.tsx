import { useEffect } from "react";
import type { GameRule } from "../gameRules";

interface Props {
  rule: GameRule;
  onClose: () => void;
}

export default function GameRulesModal({ rule, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.85)",
        zIndex: 200,
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          borderRadius: "24px 24px 0 0",
          width: "100%", maxWidth: 480,
          maxHeight: "85vh",
          overflowY: "auto",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.5)",
          display: "flex", flexDirection: "column",
        }}
      >
        {/* Drag handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0", flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--border)" }} />
        </div>

        {/* Header */}
        <div style={{
          padding: "16px 20px 20px",
          borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", gap: 14,
          flexShrink: 0,
        }}>
          <div style={{
            width: 56, height: 56, flexShrink: 0, borderRadius: 14,
            background: rule.color + "26",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 28,
          }}>
            {rule.emoji}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text)" }}>{rule.title}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2, lineHeight: 1.4 }}>
              {rule.tagline}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, flexShrink: 0,
              background: "var(--surface2)", border: "1px solid var(--border)",
              borderRadius: 8, cursor: "pointer", fontSize: 16,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--text-muted)",
            }}
          >✕</button>
        </div>

        {/* Content */}
        <div style={{ padding: "20px 20px 32px", overflowY: "auto" }}>
          {/* Goal */}
          <div style={{
            background: rule.color + "1a",
            border: `1px solid ${rule.color}55`,
            borderRadius: 12,
            padding: "14px 16px",
            marginBottom: 20,
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: rule.color,
              letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6,
            }}>
              🎯 Ziel
            </div>
            <div style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.5 }}>{rule.goal}</div>
          </div>

          {/* Rules */}
          <div style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: 12, fontWeight: 700, color: "var(--text-muted)",
              letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 12,
            }}>
              📋 Spielregeln
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {rule.rules.map((r, i) => (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{
                    width: 22, height: 22, flexShrink: 0, borderRadius: "50%",
                    background: rule.color + "26",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 700, color: rule.color,
                  }}>{i + 1}</div>
                  <div style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.5, paddingTop: 2 }}>{r}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Pro Tip */}
          <div style={{
            background: "var(--surface2)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "14px 16px",
            display: "flex", gap: 12, alignItems: "flex-start",
          }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>💡</span>
            <div>
              <div style={{
                fontSize: 11, fontWeight: 700, color: "var(--text-muted)",
                letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4,
              }}>
                Pro-Tipp
              </div>
              <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5, fontStyle: "italic" }}>
                {rule.proTip}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
