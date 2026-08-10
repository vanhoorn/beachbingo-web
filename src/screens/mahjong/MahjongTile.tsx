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
export const LAYER_DX = 5;  // px shift right per layer
export const LAYER_DY = -5; // px shift up per layer
const EDGE_R = 0.12; // right-edge width as fraction of tileW
const EDGE_B = 0.10; // bottom-edge height as fraction of tileH

export default function MahjongTileView({
  tile, tileW, tileH, selected, hinted, free, showFreeHighlight, removing = false, onClick,
}: Props) {
  if (tile.removed && !removing) return null;

  const tt = getTileType(tile.typeId);
  const accent = tt.color;

  const isFreeHint = showFreeHighlight && free && !selected;
  const isSuit = tt.group === "muscheln" || tt.group === "wellen" || tt.group === "fische";

  // All backgrounds fully opaque — avoids seeing tiles stacked below
  const faceBg = removing    ? "#FFF176"
               : selected    ? "#BEE3F8"
               : hinted      ? "#FFD6B0"
               : isFreeHint  ? "#DCF5E5"
               : free        ? "#FAF0DC"
               :               "#EDD9B8";

  const borderW = Math.max(1, tileW * 0.04);
  const edgeW   = tileW * EDGE_R;
  const edgeH   = tileH * EDGE_B;
  const innerW  = tileW - edgeW;
  const innerH  = tileH - edgeH;
  const cornerR = Math.max(2, tileW * 0.08);

  const borderColor = selected   ? "#0ea5e9"
                    : hinted     ? "#f97316"
                    : isFreeHint ? "#22c55e"
                    : free       ? accent
                    :              accent + "88";

  const iconColor = free ? accent : accent + "88";

  const faceStyle: CSSProperties = {
    position: "absolute",
    left: 0, top: 0,
    width: innerW, height: innerH,
    background: `linear-gradient(135deg, ${lighten(faceBg, 0.07)}, ${darkenFrac(faceBg, 0.06)})`,
    border: `${borderW}px solid ${borderColor}`,
    borderRadius: cornerR,
    boxSizing: "border-box",
    cursor: free ? "pointer" : "default",
    transition: "background 0.1s",
    userSelect: "none",
    overflow: "hidden",
    boxShadow: selected ? `0 0 0 1px #0ea5e9, 0 2px 8px rgba(0,0,0,0.35)`
             : hinted   ? `0 0 0 1px #f97316, 0 2px 8px rgba(0,0,0,0.35)`
             :             `0 2px 6px rgba(0,0,0,0.28)`,
  };

  const iconSize = Math.max(8, innerW * 0.52);

  return (
    <div
      onClick={free ? onClick : undefined}
      style={{
        position: "absolute",
        width: tileW, height: tileH,
        cursor: free ? "pointer" : "default",
        filter: "drop-shadow(2px 3px 4px rgba(0,0,0,0.22))",
        transition: removing ? "opacity 0.3s ease, transform 0.3s ease" : undefined,
        opacity: removing ? 0 : 1,
        transform: removing ? "scale(1.2)" : undefined,
        pointerEvents: removing ? "none" : undefined,
        zIndex: removing ? 10 : undefined,
      }}
    >
      {/* Right edge — gradient top-light to bottom-dark */}
      <div style={{
        position: "absolute", right: 0, top: edgeH,
        width: edgeW, height: innerH,
        background: `linear-gradient(to bottom, ${lighten("#D4B896", 0.08)}, ${darkenFrac("#D4B896", 0.12)})`,
        borderRadius: `0 ${cornerR}px ${cornerR}px 0`,
      }} />
      {/* Bottom edge — gradient left-light to right-dark */}
      <div style={{
        position: "absolute", bottom: 0, left: edgeW,
        width: innerW, height: edgeH,
        background: `linear-gradient(to right, ${lighten("#D4B896", 0.06)}, ${darkenFrac("#D4B896", 0.10)})`,
        borderRadius: `0 0 ${cornerR}px ${cornerR}px`,
      }} />
      {/* Face */}
      <div style={faceStyle}>
        {isSuit ? (
          <PipPattern
            svgIcon={tt.svgIcon}
            rank={tt.rank}
            color={iconColor}
            faceW={innerW}
            faceH={innerH}
          />
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}>
            <svg width={iconSize} height={iconSize} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              {renderIcon(tt.svgIcon, iconColor)}
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Pip pattern for suit tiles ────────────────────────────────────────────────
function PipPattern({ svgIcon, rank, color, faceW, faceH }: {
  svgIcon: string; rank: number; color: string; faceW: number; faceH: number;
}) {
  const pad    = faceW * 0.08;
  const availW = faceW - 2 * pad;
  const availH = faceH - 2 * pad;

  const pipScale = rank === 1 ? 0.52 : rank <= 3 ? 0.36 : rank <= 5 ? 0.30 : rank <= 8 ? 0.25 : 0.22;
  const pipSize  = Math.min(availW, availH) * pipScale;

  const positions: [number, number][] =
    rank === 1 ? [[0.5, 0.5]] :
    rank === 2 ? [[0.5, 0.25], [0.5, 0.75]] :
    rank === 3 ? [[0.5, 0.2], [0.5, 0.5], [0.5, 0.8]] :
    rank === 4 ? [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]] :
    rank === 5 ? [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]] :
    rank === 6 ? [[0.25, 0.2], [0.75, 0.2], [0.25, 0.5], [0.75, 0.5], [0.25, 0.8], [0.75, 0.8]] :
    rank === 7 ? [[0.25, 0.2], [0.75, 0.2], [0.5, 0.35], [0.25, 0.5], [0.75, 0.5], [0.25, 0.8], [0.75, 0.8]] :
    rank === 8 ? [[0.25, 0.2], [0.75, 0.2], [0.5, 0.3], [0.25, 0.5], [0.75, 0.5], [0.5, 0.7], [0.25, 0.8], [0.75, 0.8]] :
    [[0.2, 0.2], [0.5, 0.2], [0.8, 0.2], [0.2, 0.5], [0.5, 0.5], [0.8, 0.5], [0.2, 0.8], [0.5, 0.8], [0.8, 0.8]];

  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: faceW, height: faceH }}>
      {positions.map(([xf, yf], i) => {
        const cx = pad + availW * xf;
        const cy = pad + availH * yf;
        return (
          <div key={i} style={{
            position: "absolute",
            left: cx - pipSize / 2,
            top:  cy - pipSize / 2,
            width: pipSize,
            height: pipSize,
            lineHeight: 0,
          }}>
            <svg width={pipSize} height={pipSize} viewBox="0 0 32 32" fill="none">
              {renderIcon(svgIcon, color)}
            </svg>
          </div>
        );
      })}
    </div>
  );
}

// ── Icon renderer ─────────────────────────────────────────────────────────────
function renderIcon(svgIcon: string, color: string): React.ReactElement {
  const c = color;
  const w = 3.5;
  const ol = "rgba(0,0,0,0.25)"; // thin dark outline for filled shapes
  const ow = 0.8;                 // outline stroke width
  const eye = "rgba(0,0,0,0.7)"; // eyes / detail marks

  // ── Muscheln ────────────────────────────────────────────────────────────────
  if (svgIcon.startsWith("muscheln"))
    return <>
      <ellipse cx="16" cy="20" rx="11" ry="7" fill={c} stroke={ol} strokeWidth={ow}/>
      <path d="M16 13 C10 8 6 14 16 20 C26 14 22 8 16 13Z" fill={c} stroke={ol} strokeWidth={ow}/>
      <line x1="16" y1="13" x2="16" y2="20" stroke={eye} strokeWidth={w-1}/>
      <line x1="10" y1="15" x2="16" y2="20" stroke={eye} strokeWidth={w-1.5}/>
      <line x1="22" y1="15" x2="16" y2="20" stroke={eye} strokeWidth={w-1.5}/>
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
      <path d="M6 16 C10 8 22 8 24 16 C22 24 10 24 6 16Z" fill={c} stroke={ol} strokeWidth={ow}/>
      <path d="M24 16 L30 10 L30 22 Z" fill={c} stroke={ol} strokeWidth={ow} strokeLinejoin="round"/>
      <circle cx="11" cy="14" r="1.5" fill={eye}/>
    </>;

  // ── Winde ─────────────────────────────────────────────────────────────────────
  if (svgIcon === "wind_ost") // Sonnenaufgang
    return <>
      <circle cx="16" cy="16" r="6" fill={c} stroke={ol} strokeWidth={ow}/>
      <line x1="16" y1="4"  x2="16" y2="8"  stroke={c} strokeWidth={w}/>
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
      <path d="M16 16 C12 8 4 6 2 10 C6 10 10 14 16 16Z" fill={c} stroke={ol} strokeWidth={ow}/>
      <path d="M16 16 C20 8 28 6 30 10 C26 10 22 14 16 16Z" fill={c} stroke={ol} strokeWidth={ow}/>
      <path d="M16 16 C14 6 8 2 6 4 C8 8 12 12 16 16Z" fill={c} stroke={ol} strokeWidth={ow}/>
    </>;

  if (svgIcon === "wind_west") // Sonnenuntergang
    return <>
      <path d="M4 20 Q16 8 28 20" stroke={c} strokeWidth={w} fill="none" strokeLinecap="round"/>
      <line x1="4"  y1="24" x2="28" y2="24" stroke={c} strokeWidth={w}/>
      <line x1="16" y1="6"  x2="16" y2="10" stroke={c} strokeWidth={w} strokeLinecap="round"/>
      <line x1="6"  y1="10" x2="9"  y2="12" stroke={c} strokeWidth={w} strokeLinecap="round"/>
      <line x1="26" y1="10" x2="23" y2="12" stroke={c} strokeWidth={w} strokeLinecap="round"/>
    </>;

  if (svgIcon === "wind_nord") // Leuchtturm
    return <>
      <rect x="12" y="14" width="8" height="14" fill={c} stroke={ol} strokeWidth={ow}/>
      <polygon points="10,14 22,14 19,6 13,6" fill={c} stroke={ol} strokeWidth={ow}/>
      <rect x="14" y="4" width="4" height="3" fill={c} stroke={ol} strokeWidth={ow}/>
      <line x1="8"  y1="18" x2="12" y2="18" stroke={eye} strokeWidth={w-1}/>
      <line x1="20" y1="18" x2="24" y2="18" stroke={eye} strokeWidth={w-1}/>
      <line x1="12" y1="23" x2="20" y2="23" stroke={eye} strokeWidth={w-1}/>
      <line x1="14" y1="28" x2="18" y2="28" stroke={eye} strokeWidth={w-1}/>
    </>;

  // ── Drachen ───────────────────────────────────────────────────────────────────
  if (svgIcon === "drache_rot") // Hai
    return <>
      <path d="M4 22 Q10 10 20 14 Q28 18 28 22 Q20 28 12 26 Q6 24 4 22Z" fill={c} stroke={ol} strokeWidth={ow}/>
      <path d="M16 14 L18 6 L22 14 Z" fill={c} stroke={ol} strokeWidth={ow} strokeLinejoin="round"/>
      <ellipse cx="22" cy="20" rx="2" ry="1.5" fill={eye}/>
      <line x1="8"  y1="24" x2="6"  y2="28" stroke={eye} strokeWidth={w-1}/>
      <line x1="12" y1="26" x2="11" y2="30" stroke={eye} strokeWidth={w-1}/>
    </>;

  if (svgIcon === "drache_gruen") // Delfin
    return <>
      <path d="M4 18 Q10 8 20 12 Q28 16 26 22 Q20 28 10 24 Q4 20 4 18Z" fill={c} stroke={ol} strokeWidth={ow}/>
      <path d="M26 16 L30 10 L28 18 Z" fill={c} stroke={ol} strokeWidth={ow} strokeLinejoin="round"/>
      <path d="M16 8 Q19 4 22 8 Z" fill={c} stroke={ol} strokeWidth={ow}/>
      <circle cx="12" cy="16" r="1.5" fill={eye}/>
    </>;

  if (svgIcon === "drache_weiss") // Oktopus
    return <>
      <ellipse cx="16" cy="14" rx="8" ry="7" fill={c} stroke={ol} strokeWidth={ow}/>
      <path d="M8 18 Q6 24 8 28"   stroke={c} strokeWidth={w-0.5} fill="none" strokeLinecap="round"/>
      <path d="M11 20 Q10 26 12 29" stroke={c} strokeWidth={w-0.5} fill="none" strokeLinecap="round"/>
      <path d="M14 21 Q14 27 15 30" stroke={c} strokeWidth={w-0.5} fill="none" strokeLinecap="round"/>
      <path d="M17 21 Q18 27 17 30" stroke={c} strokeWidth={w-0.5} fill="none" strokeLinecap="round"/>
      <path d="M20 20 Q22 26 20 29" stroke={c} strokeWidth={w-0.5} fill="none" strokeLinecap="round"/>
      <path d="M23 18 Q26 24 24 28" stroke={c} strokeWidth={w-0.5} fill="none" strokeLinecap="round"/>
      <circle cx="12" cy="12" r="1.5" fill={eye}/>
      <circle cx="20" cy="12" r="1.5" fill={eye}/>
    </>;

  // ── Jahreszeiten ──────────────────────────────────────────────────────────────
  if (svgIcon === "jahreszeit_fruehling")
    return <>
      <path d="M16 28 L16 16" stroke={c} strokeWidth={w} strokeLinecap="round"/>
      <path d="M16 16 C10 12 6 6 10 4 C14 4 16 10 16 16Z" fill={c} stroke={ol} strokeWidth={ow}/>
      <path d="M16 20 C20 16 26 12 28 8 C24 6 18 14 16 20Z" fill={c} stroke={ol} strokeWidth={ow}/>
    </>;

  if (svgIcon === "jahreszeit_sommer")
    return <>
      <circle cx="16" cy="16" r="7" fill={c} stroke={ol} strokeWidth={ow}/>
      {[0,45,90,135,180,225,270,315].map((a,i) => {
        const rad = a * Math.PI / 180;
        const x1 = 16 + 9*Math.cos(rad), y1 = 16 + 9*Math.sin(rad);
        const x2 = 16 + 13*Math.cos(rad), y2 = 16 + 13*Math.sin(rad);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={c} strokeWidth={w-0.5} strokeLinecap="round"/>;
      })}
    </>;

  if (svgIcon === "jahreszeit_herbst")
    return <>
      <path d="M16 8 Q20 12 18 18 Q22 14 26 16 Q22 22 16 24 Q10 22 6 16 Q10 14 14 18 Q12 12 16 8Z" fill={c} stroke={ol} strokeWidth={ow}/>
      <line x1="16" y1="24" x2="16" y2="30" stroke={c} strokeWidth={w} strokeLinecap="round"/>
    </>;

  if (svgIcon === "jahreszeit_winter")
    return <>
      <line x1="16" y1="4"  x2="16" y2="28" stroke={c} strokeWidth={w}/>
      <line x1="4"  y1="16" x2="28" y2="16" stroke={c} strokeWidth={w}/>
      <line x1="8"  y1="8"  x2="24" y2="24" stroke={c} strokeWidth={w}/>
      <line x1="24" y1="8"  x2="8"  y2="24" stroke={c} strokeWidth={w}/>
      <circle cx="16" cy="16" r="2" fill={c}/>
    </>;

  // ── Blumen ────────────────────────────────────────────────────────────────────
  if (svgIcon === "blume_hibiskus")
    return <>
      {[0,72,144,216,288].map((a,i) => {
        const rad = a * Math.PI / 180;
        const cx = 16 + 8*Math.cos(rad), cy = 16 + 8*Math.sin(rad);
        return <ellipse key={i} cx={cx} cy={cy} rx="5" ry="3"
                 transform={`rotate(${a},${cx},${cy})`} fill={c} stroke={ol} strokeWidth={ow}/>;
      })}
      <circle cx="16" cy="16" r="3" fill={c} stroke={ol} strokeWidth={ow}/>
    </>;

  if (svgIcon === "blume_anemone")
    return <>
      {[0,60,120,180,240,300].map((a,i) => {
        const rad = a * Math.PI / 180;
        const x1=16+4*Math.cos(rad), y1=16+4*Math.sin(rad);
        const x2=16+12*Math.cos(rad), y2=16+12*Math.sin(rad);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={c} strokeWidth={w-0.5}/>;
      })}
      <circle cx="16" cy="16" r="4" fill={c} stroke={ol} strokeWidth={ow}/>
    </>;

  if (svgIcon === "blume_seerose")
    return <>
      {[0,90,180,270].map((a,i) => {
        const rad = a * Math.PI / 180;
        const cx = 16 + 7*Math.cos(rad), cy = 16 + 7*Math.sin(rad);
        return <ellipse key={i} cx={cx} cy={cy} rx="6" ry="4"
                 transform={`rotate(${a},${cx},${cy})`} fill={c} stroke={ol} strokeWidth={ow}/>;
      })}
      {[45,135,225,315].map((a,i) => {
        const rad = a * Math.PI / 180;
        const cx = 16 + 7*Math.cos(rad), cy = 16 + 7*Math.sin(rad);
        return <ellipse key={i} cx={cx} cy={cy} rx="5" ry="3"
                 transform={`rotate(${a},${cx},${cy})`} fill={c} stroke={ol} strokeWidth={ow}/>;
      })}
      <circle cx="16" cy="16" r="3" fill={c} stroke={ol} strokeWidth={ow}/>
    </>;

  if (svgIcon === "blume_stranddistel")
    return <>
      {[0,30,60,90,120,150,180,210,240,270,300,330].map((a,i) => {
        const rad = a * Math.PI / 180;
        const x2 = 16 + 11*Math.cos(rad), y2 = 16 + 11*Math.sin(rad);
        return <line key={i} x1="16" y1="16" x2={x2} y2={y2} stroke={c} strokeWidth={w-1.5} strokeLinecap="round"/>;
      })}
      <circle cx="16" cy="16" r="4" fill={c} stroke={ol} strokeWidth={ow}/>
    </>;

  // Fallback
  return <text x="16" y="20" textAnchor="middle" fontSize="14" fill={color}>{svgIcon.slice(0,2)}</text>;
}

function lighten(hex: string, f: number): string {
  const n = parseInt(hex.replace("#",""), 16);
  const ch = (v: number) => Math.min(255, Math.round(v + (255 - v) * f));
  return `rgb(${ch((n >> 16) & 0xff)},${ch((n >> 8) & 0xff)},${ch(n & 0xff)})`;
}

function darkenFrac(hex: string, f: number): string {
  const n = parseInt(hex.replace("#",""), 16);
  const ch = (v: number) => Math.max(0, Math.round(v * (1 - f)));
  return `rgb(${ch((n >> 16) & 0xff)},${ch((n >> 8) & 0xff)},${ch(n & 0xff)})`;
}
