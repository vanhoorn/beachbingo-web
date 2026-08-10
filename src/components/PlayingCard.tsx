import React from "react";

interface CardData {
  rank: string;
  suit: string;
  id?: string;
}

export const SUIT_COLORS: Record<string, string> = {
  "♥": "#F59E0B",  // Sonne – SandGold
  "♦": "#0D9488",  // Welle – Teal
  "♠": "#22C55E",  // Palme – Success
  "♣": "#F97316",  // Muschel – Coral
};

export const SUIT_NAMES: Record<string, string> = {
  "♥": "Sonne",
  "♦": "Welle",
  "♠": "Palme",
  "♣": "Muschel",
};

// ── Beach suit SVG icons ──────────────────────────────────────────────────────

function SunPaths({ cx, cy, r, color }: { cx: number; cy: number; r: number; color: string }) {
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    return (
      <line key={i}
        x1={cx + Math.cos(a) * r * 0.38} y1={cy + Math.sin(a) * r * 0.38}
        x2={cx + Math.cos(a) * r * 0.62} y2={cy + Math.sin(a) * r * 0.62}
        stroke={color} strokeWidth={r * 0.13} strokeLinecap="round" />
    );
  });
  return (
    <>
      <circle cx={cx} cy={cy} r={r * 0.50} fill={color} fillOpacity={0.22} />
      <circle cx={cx} cy={cy} r={r * 0.30} fill={color} />
      <circle cx={cx - r * 0.08} cy={cy - r * 0.09} r={r * 0.14} fill="white" fillOpacity={0.35} />
      {rays}
    </>
  );
}

function WavePaths({ cx, cy, r, color }: { cx: number; cy: number; r: number; color: string }) {
  const w1 = `M ${cx - r * 0.85} ${cy - r * 0.18} Q ${cx - r * 0.42} ${cy - r * 0.56} ${cx} ${cy - r * 0.18} Q ${cx + r * 0.42} ${cy + r * 0.20} ${cx + r * 0.85} ${cy - r * 0.18}`;
  const w2 = `M ${cx - r * 0.85} ${cy + r * 0.30} Q ${cx - r * 0.42} ${cy - r * 0.08} ${cx} ${cy + r * 0.30} Q ${cx + r * 0.42} ${cy + r * 0.68} ${cx + r * 0.85} ${cy + r * 0.30}`;
  return (
    <>
      <path d={w1} fill="none" stroke={color} strokeWidth={r * 0.18} strokeLinecap="round" />
      <path d={w2} fill="none" stroke={color} strokeOpacity={0.60} strokeWidth={r * 0.14} strokeLinecap="round" />
    </>
  );
}

function PalmPaths({ cx, cy, r, color }: { cx: number; cy: number; r: number; color: string }) {
  const tx = cx + r * 0.05, ty = cy - r * 0.25;
  const bx = cx - r * 0.04, by = cy + r * 0.68;
  const fronds: [number, number][] = [
    [cx - r * 0.80, cy - r * 0.72],
    [cx + r * 0.82, cy - r * 0.65],
    [cx + r * 0.05, cy - r * 0.95],
  ];
  return (
    <>
      <line x1={bx} y1={by} x2={tx} y2={ty} stroke="#7A5C2E" strokeWidth={r * 0.16} strokeLinecap="round" />
      {fronds.map(([ex, ey], i) => {
        const mx = (tx + ex) / 2, my = (ty + ey) / 2 - r * 0.10;
        return <path key={i} d={`M ${tx} ${ty} Q ${mx} ${my} ${ex} ${ey}`} fill="none" stroke={color} strokeWidth={r * 0.16} strokeLinecap="round" />;
      })}
    </>
  );
}

function ShellPaths({ cx, cy, r, color }: { cx: number; cy: number; r: number; color: string }) {
  const botY = cy + r * 0.48, rad = r * 0.70;
  const ridges = [0, 0.25, 0.5, 0.75, 1.0].map(t => {
    const a = Math.PI * (1 - t);
    return [cx + Math.cos(a) * rad * 0.82, botY - Math.sin(a) * rad * 0.82] as [number, number];
  });
  return (
    <>
      <path d={`M ${cx - rad} ${botY} A ${rad} ${rad} 0 0 0 ${cx + rad} ${botY}`}
        fill="none" stroke={color} strokeWidth={r * 0.14} strokeLinecap="round" />
      {ridges.map(([ex, ey], i) => (
        <line key={i} x1={cx} y1={botY} x2={ex} y2={ey}
          stroke={color} strokeOpacity={0.55} strokeWidth={r * 0.09} strokeLinecap="round" />
      ))}
      <circle cx={cx} cy={botY} r={r * 0.10} fill={color} />
    </>
  );
}

export function SuitIcon({ suit, size }: { suit: string; size: number }) {
  const color = SUIT_COLORS[suit] ?? "#1a1a2e";
  const cx = size / 2, cy = size / 2, r = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block", flexShrink: 0 }}>
      {suit === "♥" && <SunPaths cx={cx} cy={cy} r={r} color={color} />}
      {suit === "♦" && <WavePaths cx={cx} cy={cy} r={r} color={color} />}
      {suit === "♠" && <PalmPaths cx={cx} cy={cy} r={r} color={color} />}
      {suit === "♣" && <ShellPaths cx={cx} cy={cy} r={r} color={color} />}
    </svg>
  );
}

// ── PlayingCard ───────────────────────────────────────────────────────────────

export function PlayingCard({
  card, faceUp = true, selected = false, selectable = false,
  playable = true, small = false, accentColor = "#0d9488",
  onClick, style = {}, w, h,
}: {
  card?: CardData; faceUp?: boolean; selected?: boolean; selectable?: boolean;
  playable?: boolean; small?: boolean; accentColor?: string;
  onClick?: () => void; style?: React.CSSProperties;
  w?: number; h?: number;
}) {
  const sColor = card ? (SUIT_COLORS[card.suit] ?? "#1a1a2e") : "#1a1a2e";
  const W = w ?? (small ? 36 : 58);
  const H = h ?? (small ? 52 : 84);
  const fontScale = W / 58;

  return (
    <div onClick={onClick} style={{
      width: W, height: H, borderRadius: W < 45 ? 5 : 8, flexShrink: 0,
      cursor: (selectable || onClick) ? "pointer" : "default",
      userSelect: "none", position: "relative",
      transition: "transform 0.15s, box-shadow 0.15s, opacity 0.15s",
      transform: selected ? "translateY(-10px)" : undefined,
      opacity: faceUp && !playable ? 0.38 : 1,
      ...(faceUp ? {
        background: "#f8f5ee",
        border: `${W < 45 ? 1 : 2}px solid ${selected ? accentColor : "rgba(0,0,0,0.12)"}`,
        boxShadow: selected
          ? `0 0 0 2px ${accentColor}, 0 6px 18px rgba(0,0,0,0.35)`
          : "0 3px 10px rgba(0,0,0,0.3)",
      } : {
        background: "linear-gradient(to bottom, #1a72c8 0%, #5ab8e8 55%, #1a8ab8 56%, #0a4a7a 100%)",
        border: `${W < 45 ? 1 : 2}px solid ${accentColor}66`,
        boxShadow: "0 3px 10px rgba(0,0,0,0.3)",
        overflow: "hidden",
      }),
      ...style,
    }}>
      {faceUp && card ? (
        <>
          <div style={{
            position: "absolute",
            top: small ? 2 : Math.round(4 * fontScale),
            left: small ? 3 : Math.round(5 * fontScale),
            color: sColor, lineHeight: 1,
          }}>
            <div style={{ fontWeight: 900, fontSize: small ? Math.round(9 * (W / 36)) : Math.round(13 * fontScale) }}>{card.rank}</div>
            {!small && <SuitIcon suit={card.suit} size={Math.round(12 * fontScale)} />}
          </div>
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%,-50%)",
          }}>
            <SuitIcon suit={card.suit} size={small ? Math.round(18 * (W / 36)) : Math.round(26 * fontScale)} />
          </div>
          {!small && (
            <div style={{
              position: "absolute",
              bottom: Math.round(4 * fontScale),
              right: Math.round(5 * fontScale),
              color: sColor, lineHeight: 1,
              transform: "rotate(180deg)",
            }}>
              <div style={{ fontWeight: 900, fontSize: Math.round(13 * fontScale) }}>{card.rank}</div>
              <SuitIcon suit={card.suit} size={Math.round(12 * fontScale)} />
            </div>
          )}
        </>
      ) : !faceUp ? (
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} viewBox="0 0 58 84">
          <circle cx="45" cy="11" r="9.5" fill="rgba(255,224,51,0.28)"/>
          <circle cx="45" cy="11" r="5.8" fill="#ffd700"/>
          <circle cx="43.3" cy="9.8" r="3.4" fill="#ffed4a"/>
          <line x1="45" y1="2.5" x2="45" y2="0.2" stroke="#ffd700" strokeWidth="1.4" opacity="0.75"/>
          <line x1="52.2" y1="4.8" x2="53.8" y2="3.2" stroke="#ffd700" strokeWidth="1.4" opacity="0.75"/>
          <line x1="54.5" y1="11" x2="57" y2="11" stroke="#ffd700" strokeWidth="1.4" opacity="0.75"/>
          <line x1="52.2" y1="17.2" x2="53.8" y2="18.8" stroke="#ffd700" strokeWidth="1.4" opacity="0.75"/>
          <line x1="45" y1="19.5" x2="45" y2="21.8" stroke="#ffd700" strokeWidth="1.4" opacity="0.75"/>
          <line x1="37.8" y1="17.2" x2="36.2" y2="18.8" stroke="#ffd700" strokeWidth="1.4" opacity="0.75"/>
          <line x1="35.5" y1="11" x2="33" y2="11" stroke="#ffd700" strokeWidth="1.4" opacity="0.75"/>
          <line x1="37.8" y1="4.8" x2="36.2" y2="3.2" stroke="#ffd700" strokeWidth="1.4" opacity="0.75"/>
          <path d="M0,57 Q7,54.5 14,57 Q21,59.5 29,57 Q37,54.5 44,57 Q51,59.5 58,57" stroke="rgba(255,255,255,0.35)" strokeWidth="0.9" fill="none"/>
          <path d="M0,67 Q8,64.5 16,67 Q24,69.5 32,67 Q40,64.5 48,67 Q56,69.5 58,67" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" fill="none"/>
          <path d="M0,76 Q9,73.5 18,76 Q27,78.5 36,76 Q45,73.5 54,76" stroke="rgba(255,255,255,0.18)" strokeWidth="0.7" fill="none"/>
          <ellipse cx="29" cy="72" rx="12" ry="4.5" fill="#c8942a"/>
          <ellipse cx="26" cy="70.5" rx="6.5" ry="2.5" fill="#e4b44a" opacity="0.5"/>
          <path d="M29,70 Q27,60 28,49 Q29.5,42 32,34" stroke="#7a5c2e" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
          <path d="M31,33 Q19,38 8,52 Q25,45 33,35 Z" fill="#2a7828"/>
          <path d="M31,35 Q38,45 54,52 Q44,38 33,33 Z" fill="#2a7828"/>
          <path d="M33,33 Q25,26 10,22 Q21,33 31,35 Z" fill="#36963a"/>
          <path d="M33,35 Q42,32 52,22 Q38,26 31,33 Z" fill="#36963a"/>
          <path d="M34,34 Q35,24 30,12 Q28,25 31,34 Z" fill="#2a7828"/>
        </svg>
      ) : null}
    </div>
  );
}
