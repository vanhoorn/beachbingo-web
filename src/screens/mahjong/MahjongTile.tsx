import type { CSSProperties } from "react";
import type { MahjongTile } from "./MahjongLogic";
import { getTileType } from "./MahjongTiles";

interface Props {
  tile: MahjongTile;
  tileW: number;
  tileH: number;
  selected: boolean;
  hinted: boolean;
  free: boolean;
  showFreeHighlight: boolean;
  removing?: boolean;
  onClick: () => void;
}

// ── 3-D offset per layer (isometric feel) ────────────────────────────────────
export const LAYER_DX = 3;  // px shift right per layer
export const LAYER_DY = -3; // px shift up per layer
const EDGE_R = 0.12; // right-edge width as fraction of tileW
const EDGE_B = 0.10; // bottom-edge height as fraction of tileH

export default function MahjongTileView({
  tile, tileW, tileH, selected, hinted, free, showFreeHighlight, removing = false, onClick,
}: Props) {
  if (tile.removed && !removing) return null;

  const tt = getTileType(tile.typeId);
  const accent = tt.color;

  const isFreeHint = showFreeHighlight && free && !selected;

  // All backgrounds fully opaque — avoids seeing tiles stacked below
  const faceBg = removing    ? "#FFF176"   // gold flash on match
               : selected    ? "#BEE3F8"
               : hinted      ? "#FFD6B0"
               : isFreeHint  ? "#DCF5E5"
               : free        ? "#FAF0DC"
               :               "#EDD9B8";  // blocked: slightly dimmed sand

  const edgeR  = darken("#D4B896", 20);
  const edgeB  = darken("#D4B896", 35);
  const borderW = Math.max(1, tileW * 0.04);
  const edgeW   = tileW * EDGE_R;
  const edgeH   = tileH * EDGE_B;
  const innerW  = tileW - edgeW;
  const innerH  = tileH - edgeH;

  const borderColor = selected   ? "#0ea5e9"
                    : hinted     ? "#f97316"
                    : isFreeHint ? "#22c55e"
                    : free       ? accent
                    :              accent + "88";  // blocked: dimmed border

  const iconColor = free ? accent : accent + "88";

  const faceStyle: CSSProperties = {
    position: "absolute",
    left: 0, top: 0,
    width: innerW, height: innerH,
    background: faceBg,
    border: `${borderW}px solid ${borderColor}`,
    borderRadius: Math.max(2, tileW * 0.08),
    boxSizing: "border-box",
    cursor: free ? "pointer" : "default",
    transition: "background 0.1s",
    display: "flex", alignItems: "center", justifyContent: "center",
    userSelect: "none",
    boxShadow: selected ? `0 0 0 1px #0ea5e9, 0 2px 8px rgba(0,0,0,0.3)`
             : hinted   ? `0 0 0 1px #f97316, 0 2px 8px rgba(0,0,0,0.3)`
             :             `0 1px 3px rgba(0,0,0,0.2)`,
  };

  const iconSize = Math.max(8, innerW * 0.52);

  return (
    <div
      onClick={free ? onClick : undefined}
      style={{
        position: "absolute",
        width: tileW, height: tileH,
        cursor: free ? "pointer" : "default",
        transition: removing ? "opacity 0.3s ease, transform 0.3s ease" : undefined,
        opacity: removing ? 0 : 1,
        transform: removing ? "scale(1.2)" : undefined,
        pointerEvents: removing ? "none" : undefined,
        zIndex: removing ? 10 : undefined,
      }}
    >
      {/* Right edge */}
      <div style={{
        position: "absolute", right: 0, top: edgeH,
        width: edgeW, height: innerH,
        background: edgeR,
        borderRadius: `0 ${Math.max(2, tileW * 0.08)}px ${Math.max(2, tileW * 0.08)}px 0`,
      }} />
      {/* Bottom edge */}
      <div style={{
        position: "absolute", bottom: 0, left: edgeW,
        width: innerW, height: edgeH,
        background: edgeB,
        borderRadius: `0 0 ${Math.max(2, tileW * 0.08)}px ${Math.max(2, tileW * 0.08)}px`,
      }} />
      {/* Face */}
      <div style={faceStyle}>
        <TileIcon svgIcon={tt.svgIcon} size={iconSize} color={iconColor} rank={tt.rank} group={tt.group as string} />
      </div>
    </div>
  );
}

// ── Icon renderer ─────────────────────────────────────────────────────────────
function TileIcon({ svgIcon, size, color, rank, group }: {
  svgIcon: string; size: number; color: string; rank: number; group: string;
}) {
  const s = size;
  const isSuit = group === "muscheln" || group === "wellen" || group === "fische";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        {renderIcon(svgIcon, color)}
      </svg>
      {isSuit && s >= 10 && (
        <div style={{
          fontSize: Math.max(6, s * 0.45),
          fontWeight: 900,
          color,
          lineHeight: 1,
          marginTop: -Math.max(1, s * 0.05),
          fontVariantNumeric: "tabular-nums",
        }}>
          {rank}
        </div>
      )}
    </div>
  );
}

function renderIcon(svgIcon: string, color: string): React.ReactElement {
  const c = color;
  const w = 3.5;

  // ── Muscheln ────────────────────────────────────────────────────────────────
  if (svgIcon.startsWith("muscheln"))
    return <>
      <ellipse cx="16" cy="20" rx="11" ry="7" stroke={c} strokeWidth={w} fill="none"/>
      <path d="M16 13 C10 8 6 14 16 20 C26 14 22 8 16 13Z" stroke={c} strokeWidth={w-0.5} fill="none"/>
      <line x1="16" y1="13" x2="16" y2="20" stroke={c} strokeWidth={w-1}/>
      <line x1="10" y1="15" x2="16" y2="20" stroke={c} strokeWidth={w-1.5}/>
      <line x1="22" y1="15" x2="16" y2="20" stroke={c} strokeWidth={w-1.5}/>
    </>;

  // ── Wellen ───────────────────────────────────────────────────────────────────
  if (svgIcon.startsWith("wellen"))
    return <>
      <path d="M4 10 Q8 6 12 10 Q16 14 20 10 Q24 6 28 10" stroke={c} strokeWidth={w} fill="none" strokeLinecap="round"/>
      <path d="M4 17 Q8 13 12 17 Q16 21 20 17 Q24 13 28 17" stroke={c} strokeWidth={w} fill="none" strokeLinecap="round"/>
      <path d="M4 24 Q8 20 12 24 Q16 28 20 24 Q24 20 28 24" stroke={c} strokeWidth={w} fill="none" strokeLinecap="round"/>
    </>;

  // ── Fische ────────────────────────────────────────────────────────────────────
  if (svgIcon.startsWith("fische"))
    return <>
      <path d="M6 16 C10 8 22 8 24 16 C22 24 10 24 6 16Z" stroke={c} strokeWidth={w} fill="none"/>
      <path d="M24 16 L30 10 L30 22 Z" stroke={c} strokeWidth={w-0.5} fill="none" strokeLinejoin="round"/>
      <circle cx="11" cy="14" r="1.5" fill={c}/>
    </>;

  // ── Winde ─────────────────────────────────────────────────────────────────────
  if (svgIcon === "wind_ost") // Sonnenaufgang
    return <>
      <circle cx="16" cy="16" r="6" stroke={c} strokeWidth={w} fill="none"/>
      <line x1="16" y1="4" x2="16" y2="8"  stroke={c} strokeWidth={w}/>
      <line x1="16" y1="24" x2="16" y2="28" stroke={c} strokeWidth={w}/>
      <line x1="4"  y1="16" x2="8"  y2="16" stroke={c} strokeWidth={w}/>
      <line x1="24" y1="16" x2="28" y2="16" stroke={c} strokeWidth={w}/>
      <line x1="8"  y1="8"  x2="11" y2="11" stroke={c} strokeWidth={w}/>
      <line x1="21" y1="21" x2="24" y2="24" stroke={c} strokeWidth={w}/>
      <line x1="24" y1="8"  x2="21" y2="11" stroke={c} strokeWidth={w}/>
      <line x1="8"  y1="24" x2="11" y2="21" stroke={c} strokeWidth={w}/>
    </>;

  if (svgIcon === "wind_sued") // Palme
    return <>
      <line x1="16" y1="30" x2="16" y2="16" stroke={c} strokeWidth={w} strokeLinecap="round"/>
      <path d="M16 16 C12 8 4 6 2 10 C6 10 10 14 16 16Z" stroke={c} strokeWidth={w-0.5} fill="none"/>
      <path d="M16 16 C20 8 28 6 30 10 C26 10 22 14 16 16Z" stroke={c} strokeWidth={w-0.5} fill="none"/>
      <path d="M16 16 C14 6 8 2 6 4 C8 8 12 12 16 16Z" stroke={c} strokeWidth={w-0.5} fill="none"/>
    </>;

  if (svgIcon === "wind_west") // Sonnenuntergang
    return <>
      <path d="M4 20 Q16 8 28 20" stroke={c} strokeWidth={w} fill="none" strokeLinecap="round"/>
      <line x1="4" y1="24" x2="28" y2="24" stroke={c} strokeWidth={w}/>
      <line x1="16" y1="6" x2="16" y2="10" stroke={c} strokeWidth={w} strokeLinecap="round"/>
      <line x1="6"  y1="10" x2="9"  y2="12" stroke={c} strokeWidth={w} strokeLinecap="round"/>
      <line x1="26" y1="10" x2="23" y2="12" stroke={c} strokeWidth={w} strokeLinecap="round"/>
    </>;

  if (svgIcon === "wind_nord") // Leuchtturm
    return <>
      <rect x="12" y="14" width="8" height="14" stroke={c} strokeWidth={w-0.5} fill="none"/>
      <polygon points="10,14 22,14 19,6 13,6" stroke={c} strokeWidth={w-0.5} fill="none"/>
      <rect x="14" y="4" width="4" height="3" stroke={c} strokeWidth={w-1} fill="none"/>
      <line x1="8" y1="18" x2="12" y2="18" stroke={c} strokeWidth={w-1}/>
      <line x1="20" y1="18" x2="24" y2="18" stroke={c} strokeWidth={w-1}/>
      <line x1="12" y1="23" x2="20" y2="23" stroke={c} strokeWidth={w-1}/>
      <line x1="14" y1="28" x2="18" y2="28" stroke={c} strokeWidth={w-1}/>
    </>;

  // ── Drachen ───────────────────────────────────────────────────────────────────
  if (svgIcon === "drache_rot") // Hai
    return <>
      <path d="M4 22 Q10 10 20 14 Q28 18 28 22" stroke={c} strokeWidth={w} fill="none" strokeLinecap="round"/>
      <path d="M16 14 L18 6 L22 14" stroke={c} strokeWidth={w-0.5} fill="none" strokeLinejoin="round"/>
      <path d="M28 22 Q20 28 12 26 Q6 24 4 22" stroke={c} strokeWidth={w} fill="none"/>
      <ellipse cx="22" cy="20" rx="2" ry="1.5" fill={c}/>
      <path d="M8 24 L6 28 M12 26 L11 30" stroke={c} strokeWidth={w-1}/>
    </>;

  if (svgIcon === "drache_gruen") // Delfin
    return <>
      <path d="M4 18 Q10 8 20 12 Q28 16 26 22 Q20 28 10 24 Q4 20 4 18Z" stroke={c} strokeWidth={w} fill="none"/>
      <path d="M26 16 L30 10 L28 18" stroke={c} strokeWidth={w-0.5} fill="none" strokeLinejoin="round"/>
      <circle cx="12" cy="16" r="1.5" fill={c}/>
      <path d="M16 8 C18 4 22 4 22 8" stroke={c} strokeWidth={w-0.5} fill="none"/>
    </>;

  if (svgIcon === "drache_weiss") // Oktopus
    return <>
      <ellipse cx="16" cy="14" rx="8" ry="7" stroke={c} strokeWidth={w} fill="none"/>
      <path d="M8 18 Q6 24 8 28" stroke={c} strokeWidth={w-0.5} fill="none" strokeLinecap="round"/>
      <path d="M11 20 Q10 26 12 29" stroke={c} strokeWidth={w-0.5} fill="none" strokeLinecap="round"/>
      <path d="M14 21 Q14 27 15 30" stroke={c} strokeWidth={w-0.5} fill="none" strokeLinecap="round"/>
      <path d="M17 21 Q18 27 17 30" stroke={c} strokeWidth={w-0.5} fill="none" strokeLinecap="round"/>
      <path d="M20 20 Q22 26 20 29" stroke={c} strokeWidth={w-0.5} fill="none" strokeLinecap="round"/>
      <path d="M23 18 Q26 24 24 28" stroke={c} strokeWidth={w-0.5} fill="none" strokeLinecap="round"/>
      <circle cx="12" cy="12" r="1.5" fill={c}/>
      <circle cx="20" cy="12" r="1.5" fill={c}/>
    </>;

  // ── Jahreszeiten ──────────────────────────────────────────────────────────────
  if (svgIcon === "jahreszeit_fruehling") // Pflanze/Welle
    return <>
      <path d="M16 28 L16 16" stroke={c} strokeWidth={w} strokeLinecap="round"/>
      <path d="M16 16 C10 12 6 6 10 4 C14 4 16 10 16 16Z" stroke={c} strokeWidth={w-0.5} fill="none"/>
      <path d="M16 20 C20 16 26 12 28 8 C24 6 18 14 16 20Z" stroke={c} strokeWidth={w-0.5} fill="none"/>
    </>;

  if (svgIcon === "jahreszeit_sommer")
    return <>
      <circle cx="16" cy="16" r="7" stroke={c} strokeWidth={w} fill="none"/>
      {[0,45,90,135,180,225,270,315].map((a,i) => {
        const rad = a * Math.PI / 180;
        const x1 = 16 + 9*Math.cos(rad), y1 = 16 + 9*Math.sin(rad);
        const x2 = 16 + 13*Math.cos(rad), y2 = 16 + 13*Math.sin(rad);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={c} strokeWidth={w-0.5} strokeLinecap="round"/>;
      })}
    </>;

  if (svgIcon === "jahreszeit_herbst")
    return <>
      <path d="M16 8 Q20 12 18 18 Q22 14 26 16 Q22 22 16 24 Q10 22 6 16 Q10 14 14 18 Q12 12 16 8Z" stroke={c} strokeWidth={w-0.5} fill="none"/>
      <line x1="16" y1="24" x2="16" y2="30" stroke={c} strokeWidth={w} strokeLinecap="round"/>
    </>;

  if (svgIcon === "jahreszeit_winter")
    return <>
      <line x1="16" y1="4" x2="16" y2="28" stroke={c} strokeWidth={w}/>
      <line x1="4"  y1="16" x2="28" y2="16" stroke={c} strokeWidth={w}/>
      <line x1="8"  y1="8"  x2="24" y2="24" stroke={c} strokeWidth={w}/>
      <line x1="24" y1="8"  x2="8"  y2="24" stroke={c} strokeWidth={w}/>
      {[16,16,4,28,28,4].map(() => null)}
      <circle cx="16" cy="16" r="2" fill={c}/>
    </>;

  // ── Blumen ────────────────────────────────────────────────────────────────────
  if (svgIcon === "blume_hibiskus")
    return <>
      {[0,72,144,216,288].map((a,i) => {
        const rad = a * Math.PI / 180;
        const cx = 16 + 8*Math.cos(rad), cy = 16 + 8*Math.sin(rad);
        return <ellipse key={i} cx={cx} cy={cy} rx="5" ry="3" transform={`rotate(${a},${cx},${cy})`} stroke={c} strokeWidth={w-1} fill="none"/>;
      })}
      <circle cx="16" cy="16" r="3" stroke={c} strokeWidth={w-0.5} fill="none"/>
    </>;

  if (svgIcon === "blume_anemone")
    return <>
      {[0,60,120,180,240,300].map((a,i) => {
        const rad = a * Math.PI / 180;
        const x1=16+4*Math.cos(rad), y1=16+4*Math.sin(rad);
        const x2=16+12*Math.cos(rad), y2=16+12*Math.sin(rad);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={c} strokeWidth={w-0.5}/>;
      })}
      <circle cx="16" cy="16" r="4" stroke={c} strokeWidth={w} fill="none"/>
    </>;

  if (svgIcon === "blume_seerose")
    return <>
      {[0,90,180,270].map((a,i) => {
        const rad = a * Math.PI / 180;
        const cx = 16 + 7*Math.cos(rad), cy = 16 + 7*Math.sin(rad);
        return <ellipse key={i} cx={cx} cy={cy} rx="6" ry="4" transform={`rotate(${a},${cx},${cy})`} stroke={c} strokeWidth={w-1} fill="none"/>;
      })}
      {[45,135,225,315].map((a,i) => {
        const rad = a * Math.PI / 180;
        const cx = 16 + 7*Math.cos(rad), cy = 16 + 7*Math.sin(rad);
        return <ellipse key={i} cx={cx} cy={cy} rx="5" ry="3" transform={`rotate(${a},${cx},${cy})`} stroke={c} strokeWidth={w-1} fill="none"/>;
      })}
      <circle cx="16" cy="16" r="3" fill={c}/>
    </>;

  if (svgIcon === "blume_stranddistel")
    return <>
      {[0,30,60,90,120,150,180,210,240,270,300,330].map((a,i) => {
        const rad = a * Math.PI / 180;
        const x2 = 16 + 11*Math.cos(rad), y2 = 16 + 11*Math.sin(rad);
        return <line key={i} x1="16" y1="16" x2={x2} y2={y2} stroke={c} strokeWidth={w-1.5} strokeLinecap="round"/>;
      })}
      <circle cx="16" cy="16" r="4" stroke={c} strokeWidth={w-0.5} fill="none"/>
    </>;

  // Fallback
  return <text x="16" y="20" textAnchor="middle" fontSize="14" fill={color}>{svgIcon.slice(0,2)}</text>;
}

function darken(hex: string, amt: number): string {
  const n = parseInt(hex.replace("#",""), 16);
  const r = Math.max(0, (n >> 16) - amt);
  const g = Math.max(0, ((n >> 8) & 0xff) - amt);
  const b = Math.max(0, (n & 0xff) - amt);
  return `rgb(${r},${g},${b})`;
}
