import React from "react";

export interface DrinkDef {
  id: string;
  name: string;
  color: string;
  shadowColor: string;
  Icon: React.FC;
}

// ─── Biere ────────────────────────────────────────────────────────────────────

function BeerMugIcon() {
  // Maßkrug: trapezförmiger Korpus + Henkel + Schaumkrone
  return (
    <>
      <path d="M5 22L4 7H18L17 22H5Z" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M18 10Q23 10 23 15Q23 20 18 20" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M4 7Q5.5 4 7 7Q8.5 4 10 7Q11.5 4 13 7Q14.5 4 16 7Q17.5 4 18 7" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
    </>
  );
}

function WeizenGlassIcon() {
  // Weizenbierglas: schmaler Fuß, nach oben stark ausladend (Tulpenform)
  return (
    <>
      <path d="M9 23L9 17Q8 13 6 3H18Q16 13 15 17L15 23Z" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
      <line x1="9" y1="23" x2="15" y2="23" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    </>
  );
}

function PintGlassIcon() {
  // Pintglas: oben breiter, leicht konisch, kein Henkel
  return (
    <>
      <path d="M6 22L7 3H17L18 22Z" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
      <line x1="6" y1="22" x2="18" y2="22" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <line x1="7.5" y1="10" x2="16.5" y2="10" stroke="rgba(255,255,255,0.35)" strokeWidth="0.8" strokeLinecap="round"/>
    </>
  );
}

// ─── Schaumwein ───────────────────────────────────────────────────────────────

function FluteIcon() {
  // Sektflöte: sehr schlank, mit Blasen
  return (
    <>
      <path d="M9 3L8 18Q8 21 12 21Q16 21 16 18L15 3H9Z" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
      <line x1="12" y1="21" x2="12" y2="23" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="9" y1="23" x2="15" y2="23" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="10.5" cy="9" r="0.9" fill="white"/>
      <circle cx="13" cy="13" r="0.9" fill="white"/>
      <circle cx="11" cy="16" r="0.9" fill="white"/>
    </>
  );
}

// ─── Weine ────────────────────────────────────────────────────────────────────

function BurgundyGlassIcon() {
  // Rotwein-Burgunder: sehr runder, breiter Kelch
  return (
    <>
      <ellipse cx="12" cy="11" rx="8.5" ry="9" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="1.5"/>
      <line x1="12" y1="20" x2="12" y2="23" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="8" y1="23" x2="16" y2="23" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    </>
  );
}

function WhiteWineGlassIcon() {
  // Weißwein: schmalerer, höherer U-Kelch
  return (
    <>
      <path d="M9 2Q6 7 6 12Q6 17 12 18Q18 17 18 12Q18 7 15 2Z" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
      <line x1="12" y1="18" x2="12" y2="22" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="8" y1="22" x2="16" y2="22" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    </>
  );
}

function CoupeGlassIcon() {
  // Rosé-Coupe: breiter, flacher Kelch — typische Coupe/Schalen-Form
  return (
    <>
      <path d="M2 9Q2 17 12 18Q22 17 22 9Q18 3 12 3Q6 3 2 9Z" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
      <line x1="12" y1="18" x2="12" y2="22" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="8" y1="22" x2="16" y2="22" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    </>
  );
}

// ─── Spirituosen ──────────────────────────────────────────────────────────────

function TumblerIcon() {
  // Whisky-Tumbler: niedrig, breit
  return (
    <>
      <path d="M4 21L5 11H19L20 21H4Z" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
      <line x1="5.5" y1="15" x2="18.5" y2="15" stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" strokeLinecap="round"/>
    </>
  );
}

function HighballIcon() {
  // Gin-Highball: hoch und schlank, mit Limettenscheibe
  return (
    <>
      <path d="M7 3H17V22H7V3Z" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
      <line x1="8" y1="9" x2="16" y2="9" stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" strokeLinecap="round"/>
      {/* Limettenscheibe */}
      <circle cx="15" cy="6" r="2.5" fill="none" stroke="white" strokeWidth="0.9"/>
      <line x1="15" y1="3.5" x2="15" y2="8.5" stroke="white" strokeWidth="0.6"/>
      <line x1="12.5" y1="6" x2="17.5" y2="6" stroke="white" strokeWidth="0.6"/>
    </>
  );
}

function HurricaneGlassIcon() {
  // Rum-Hurricane: Sanduhrenform — oben und unten breiter, in der Mitte schmaler
  return (
    <>
      <path d="M7 3H17L14 11Q16 14 16 18L14 23H10L8 18Q8 14 10 11L7 3Z" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
    </>
  );
}

function ShotGlassIcon() {
  // Tequila-Shot: kleines Glas mit Salzrand-Punkten
  return (
    <>
      <path d="M8 22L9 14H15L16 22H8Z" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
      <line x1="8" y1="22" x2="16" y2="22" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      {/* Salzrand */}
      <circle cx="9" cy="13.2" r="1.1" fill="white"/>
      <circle cx="12" cy="12.6" r="1.1" fill="white"/>
      <circle cx="15" cy="13.2" r="1.1" fill="white"/>
    </>
  );
}

function AperolGlassIcon() {
  // Aperol Spritz: großer Ballon-Kelch + Orangenscheibe im Kelch
  return (
    <>
      <path d="M4 2Q1 7 1 12Q1 19 12 20Q23 19 23 12Q23 7 20 2Z" fill="rgba(255,255,255,0.15)" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
      <line x1="12" y1="20" x2="12" y2="23" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="8" y1="23" x2="16" y2="23" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      {/* Orangenscheibe */}
      <circle cx="15" cy="10" r="4" fill="rgba(255,255,255,0.1)" stroke="white" strokeWidth="0.9"/>
      <line x1="15" y1="6" x2="15" y2="14" stroke="white" strokeWidth="0.7"/>
      <line x1="11" y1="10" x2="19" y2="10" stroke="white" strokeWidth="0.7"/>
      <line x1="12.2" y1="7.2" x2="17.8" y2="12.8" stroke="white" strokeWidth="0.5"/>
      <line x1="17.8" y1="7.2" x2="12.2" y2="12.8" stroke="white" strokeWidth="0.5"/>
    </>
  );
}

// ─── Drink-Definitionen ───────────────────────────────────────────────────────

export const DRINK_ICONS: DrinkDef[] = [
  { id: "lager",     name: "Lager",    color: "#D97706", shadowColor: "#F59E0B66", Icon: BeerMugIcon },
  { id: "weizen",    name: "Weizen",   color: "#B45309", shadowColor: "#D9770666", Icon: WeizenGlassIcon },
  { id: "dunkles",   name: "Dunkles",  color: "#6B2600", shadowColor: "#78350F66", Icon: PintGlassIcon },
  { id: "prosecco",  name: "Prosecco", color: "#A37C00", shadowColor: "#CA8A0466", Icon: FluteIcon },
  { id: "rotwein",   name: "Rotwein",  color: "#B91C1C", shadowColor: "#DC262666", Icon: BurgundyGlassIcon },
  { id: "weisswein", name: "Weißwein", color: "#A16207", shadowColor: "#CA8A0466", Icon: WhiteWineGlassIcon },
  { id: "rose",      name: "Rosé",     color: "#BE185D", shadowColor: "#EC489966", Icon: CoupeGlassIcon },
  { id: "whisky",    name: "Whisky",   color: "#92400E", shadowColor: "#B4530966", Icon: TumblerIcon },
  { id: "gin",       name: "Gin",      color: "#0369A1", shadowColor: "#0EA5E966", Icon: HighballIcon },
  { id: "rum",       name: "Rum",      color: "#7C2D12", shadowColor: "#9A3A1066", Icon: HurricaneGlassIcon },
  { id: "tequila",   name: "Tequila",  color: "#3F6212", shadowColor: "#65A30D66", Icon: ShotGlassIcon },
  { id: "aperol",    name: "Aperol",   color: "#C2410C", shadowColor: "#EA580C66", Icon: AperolGlassIcon },
];

export function getDrink(id: string): DrinkDef {
  return DRINK_ICONS.find(d => d.id === id) ?? DRINK_ICONS[0];
}

interface DrinkPieceProps {
  drinkId: string;
  size?: number;
  style?: React.CSSProperties;
}

export function DrinkPiece({ drinkId, size = 52, style }: DrinkPieceProps) {
  const drink = getDrink(drinkId);
  const { Icon } = drink;
  return (
    <div style={{
      width: size, height: size,
      borderRadius: "50%",
      background: `radial-gradient(circle at 38% 38%, ${drink.color}ee, ${drink.color})`,
      boxShadow: `0 3px 10px ${drink.shadowColor}, inset 0 1px 3px rgba(255,255,255,0.2)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
      ...style,
    }}>
      <svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62}>
        <Icon />
      </svg>
    </div>
  );
}
