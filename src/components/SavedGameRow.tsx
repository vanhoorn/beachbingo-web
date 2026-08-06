interface SavedGameRowProps {
  title: string;
  subtitle: string;
  color: string;
  onResume: () => void;
  onDelete: () => void;
}

export default function SavedGameRow({ title, subtitle, color, onResume, onDelete }: SavedGameRowProps) {
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 12, padding: "14px 16px",
      display: "flex", alignItems: "center", gap: 12,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{title}</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{subtitle}</div>
      </div>
      <button
        onClick={onResume}
        style={{
          padding: "8px 14px", background: color + "22",
          border: `1px solid ${color}55`, borderRadius: 8,
          cursor: "pointer", fontSize: 13, fontWeight: 700, color, flexShrink: 0,
        }}
      >Fortsetzen</button>
      <button
        onClick={onDelete}
        style={{
          padding: "8px 10px", background: "var(--danger)22",
          border: "1px solid var(--danger)55", borderRadius: 8,
          cursor: "pointer", fontSize: 13, color: "var(--danger)", flexShrink: 0,
        }}
      >✕</button>
    </div>
  );
}
