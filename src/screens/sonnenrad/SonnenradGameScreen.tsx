import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { audioManager } from "../../audio/AudioManager";
import type { SonnenradPhase, SonnenradSymbol } from "./sonnenradLogic";
import {
  isBonusAvailable, msUntilBonus, formatMs,
  drawThreeCards, evaluateCards, pointsForStep,
  addLifetimePoints, claimBonus, getLifetimePoints,
  SYMBOL_COLORS, SYMBOL_LABELS,
} from "./sonnenradLogic";

const GOLD = "#D4A820";
const MAX_STEP = 6;

// ── Symbol SVG components (matching Android PlayingCardComponents + drawParasol) ─

function SonnenradSymbolSvg({ symbol, size }: { symbol: SonnenradSymbol; size: number }) {
  const color = SYMBOL_COLORS[symbol];
  const cx = size / 2, cy = size / 2, r = size / 2;

  if (symbol === "SONNE") return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
      <circle cx={cx} cy={cy} r={r * 0.50} fill={color} fillOpacity={0.22} />
      <circle cx={cx} cy={cy} r={r * 0.30} fill={color} />
      <circle cx={cx - r * 0.08} cy={cy - r * 0.09} r={r * 0.14} fill="white" fillOpacity={0.35} />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4;
        return <line key={i}
          x1={cx + Math.cos(a) * r * 0.38} y1={cy + Math.sin(a) * r * 0.38}
          x2={cx + Math.cos(a) * r * 0.62} y2={cy + Math.sin(a) * r * 0.62}
          stroke={color} strokeWidth={r * 0.13} strokeLinecap="round" />;
      })}
    </svg>
  );

  if (symbol === "WELLE") {
    const w1 = `M ${cx - r * 0.85} ${cy - r * 0.18} Q ${cx - r * 0.42} ${cy - r * 0.56} ${cx} ${cy - r * 0.18} Q ${cx + r * 0.42} ${cy + r * 0.20} ${cx + r * 0.85} ${cy - r * 0.18}`;
    const w2 = `M ${cx - r * 0.85} ${cy + r * 0.30} Q ${cx - r * 0.42} ${cy - r * 0.08} ${cx} ${cy + r * 0.30} Q ${cx + r * 0.42} ${cy + r * 0.68} ${cx + r * 0.85} ${cy + r * 0.30}`;
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
        <path d={w1} fill="none" stroke={color} strokeWidth={r * 0.18} strokeLinecap="round" />
        <path d={w2} fill="none" stroke={color} strokeOpacity={0.60} strokeWidth={r * 0.14} strokeLinecap="round" />
      </svg>
    );
  }

  if (symbol === "PALME") {
    const tx = cx + r * 0.05, ty = cy - r * 0.25;
    const bx = cx - r * 0.04, by = cy + r * 0.68;
    const fronds: [number, number][] = [[cx - r * 0.80, cy - r * 0.72], [cx + r * 0.82, cy - r * 0.65], [cx + r * 0.05, cy - r * 0.95]];
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
        <line x1={bx} y1={by} x2={tx} y2={ty} stroke="#7A5C2E" strokeWidth={r * 0.16} strokeLinecap="round" />
        {fronds.map(([ex, ey], i) => {
          const mx = (tx + ex) / 2, my = (ty + ey) / 2 - r * 0.10;
          return <path key={i} d={`M ${tx} ${ty} Q ${mx} ${my} ${ex} ${ey}`} fill="none" stroke={color} strokeWidth={r * 0.16} strokeLinecap="round" />;
        })}
      </svg>
    );
  }

  if (symbol === "MUSCHEL") {
    const botY = cy + r * 0.48, rad = r * 0.70;
    const ridges = [0, 0.25, 0.5, 0.75, 1.0].map((t) => {
      const a = Math.PI * (1 - t);
      return [cx + Math.cos(a) * rad * 0.82, botY - Math.sin(a) * rad * 0.82] as [number, number];
    });
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
        <path d={`M ${cx - rad} ${botY} A ${rad} ${rad} 0 0 0 ${cx + rad} ${botY}`}
          fill="none" stroke={color} strokeWidth={r * 0.14} strokeLinecap="round" />
        {ridges.map(([ex, ey], i) => (
          <line key={i} x1={cx} y1={botY} x2={ex} y2={ey}
            stroke={color} strokeOpacity={0.55} strokeWidth={r * 0.09} strokeLinecap="round" />
        ))}
        <circle cx={cx} cy={botY} r={r * 0.10} fill={color} />
      </svg>
    );
  }

  // SONNENSCHIRM — 6 alternating segments, scallop points, stiel, sockelkurve
  const segCount = 6;
  const purpleMain = "#A855F7", purpleLight = "#C084FC";
  const stielColor = "#7C3AED";
  const sandGold   = GOLD;
  const topY = cy - r * 0.72, openR = r * 0.85;
  const segments = Array.from({ length: segCount }, (_, i) => {
    const a0 = (i * 2 * Math.PI) / segCount - Math.PI / 2;
    const a1 = ((i + 1) * 2 * Math.PI) / segCount - Math.PI / 2;
    const x0 = cx + Math.cos(a0) * openR, y0 = topY + Math.sin(a0) * openR * 0.45;
    const x1 = cx + Math.cos(a1) * openR, y1 = topY + Math.sin(a1) * openR * 0.45;
    return `M ${cx} ${topY} L ${x0} ${y0} A ${openR} ${openR * 0.45} 0 0 1 ${x1} ${y1} Z`;
  });
  const scallops = Array.from({ length: segCount }, (_, i) => {
    const a = ((i + 0.5) * 2 * Math.PI) / segCount - Math.PI / 2;
    const sx = cx + Math.cos(a) * (openR + r * 0.09);
    const sy = topY + Math.sin(a) * (openR * 0.45 + r * 0.09);
    return { cx: sx, cy: sy, r: r * 0.07 };
  });
  const stielTop  = topY + r * 0.02;
  const stielBot  = cy + r * 0.88;
  const sockPath  = `M ${cx - r * 0.20} ${stielBot} Q ${cx} ${stielBot + r * 0.12} ${cx + r * 0.20} ${stielBot}`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
      {segments.map((d, i) => <path key={i} d={d} fill={i % 2 === 0 ? purpleMain : purpleLight} stroke="none" />)}
      {scallops.map((s, i) => <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={i % 2 === 0 ? purpleMain : purpleLight} />)}
      {/* Rim */}
      <path d={`M ${cx - openR} ${topY} A ${openR} ${openR * 0.45} 0 0 1 ${cx + openR} ${topY}`}
        fill="none" stroke={stielColor} strokeWidth={r * 0.05} />
      {/* Stiel */}
      <line x1={cx} y1={stielTop} x2={cx} y2={stielBot} stroke={stielColor} strokeWidth={r * 0.07} strokeLinecap="round" />
      {/* Sockelkurve */}
      <path d={sockPath} fill="none" stroke={sandGold} strokeWidth={r * 0.07} strokeLinecap="round" />
    </svg>
  );
}

// ── Card back (matches Android CardBackScene / PlayingCard face-down design) ───
function CardBack({ W, H }: { W: number; H: number }) {
  return (
    <div style={{
      width: W, height: H, borderRadius: W < 50 ? 6 : 10, overflow: "hidden",
      background: "linear-gradient(to bottom, #1a72c8 0%, #5ab8e8 55%, #1a8ab8 56%, #0a4a7a 100%)",
      border: `2px solid ${GOLD}55`,
      boxShadow: "0 3px 10px rgba(0,0,0,0.4)",
      flexShrink: 0,
    }}>
      <svg style={{ width: "100%", height: "100%" }} viewBox="0 0 58 84">
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
        <ellipse cx="29" cy="72" rx="12" ry="4.5" fill="#c8942a"/>
        <path d="M29,70 Q27,60 28,49 Q29.5,42 32,34" stroke="#7a5c2e" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
        <path d="M31,33 Q19,38 8,52 Q25,45 33,35 Z" fill="#2a7828"/>
        <path d="M31,35 Q38,45 54,52 Q44,38 33,33 Z" fill="#2a7828"/>
        <path d="M33,33 Q25,26 10,22 Q21,33 31,35 Z" fill="#36963a"/>
        <path d="M33,35 Q42,32 52,22 Q38,26 31,33 Z" fill="#36963a"/>
        <path d="M34,34 Q35,24 30,12 Q28,25 31,34 Z" fill="#2a7828"/>
      </svg>
    </div>
  );
}

// ── Symbol card (face-up, with colored background) ───────────────────────────
function SymbolCard({ symbol, W, H, glow }: { symbol: SonnenradSymbol; W: number; H: number; glow?: boolean }) {
  const color = SYMBOL_COLORS[symbol];
  return (
    <div style={{
      width: W, height: H, borderRadius: W < 50 ? 6 : 10, flexShrink: 0,
      background: "#f8f5ee",
      border: `2px solid ${glow ? color : color + "55"}`,
      boxShadow: glow ? `0 0 12px ${color}88, 0 3px 10px rgba(0,0,0,0.3)` : "0 3px 10px rgba(0,0,0,0.3)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <SonnenradSymbolSvg symbol={symbol} size={Math.round(W * 0.62)} />
    </div>
  );
}

// ── Flip card with CSS 3D transition ─────────────────────────────────────────
function FlipCard({ symbol, faceUp, W, H, shuffleAnim }: {
  symbol: SonnenradSymbol; faceUp: boolean; W: number; H: number; shuffleAnim?: string;
}) {
  return (
    <div style={{ perspective: 800, width: W, height: H, flexShrink: 0, animation: shuffleAnim }}>
      <div style={{
        width: W, height: H, position: "relative",
        transformStyle: "preserve-3d",
        transition: "transform 0.6s cubic-bezier(0.4,0,0.2,1)",
        transform: faceUp ? "rotateY(180deg)" : "rotateY(0deg)",
      }}>
        <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden" }}>
          <CardBack W={W} H={H} />
        </div>
        <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
          <SymbolCard symbol={symbol} W={W} H={H} glow />
        </div>
      </div>
    </div>
  );
}

// ── Sonnenrad Ladder ──────────────────────────────────────────────────────────
function SonnenradLadder({ securedStep, isTargetZone, isClimbing, isBonusRound }: {
  securedStep: number; isTargetZone: boolean; isClimbing: boolean; isBonusRound: boolean;
}) {
  const rows = [
    { step: 6, label: "Stufe 6 — Maximum" },
    { step: 5, label: "Stufe 5" },
    { step: 4, label: "Stufe 4 — Jackpot ☀️" },
    { step: 3, label: "Stufe 3" },
    { step: 2, label: "Stufe 2" },
    { step: 1, label: "Stufe 1" },
  ];
  const nextStep = securedStep + 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {rows.map(({ step, label }) => {
        const isMarkerBase   = step === securedStep;
        const isMarkerTarget = isClimbing && step === nextStep && isTargetZone;
        const isSecured      = step < securedStep;
        let bg = "var(--surface)", border = "1px solid var(--border)";
        if (isMarkerTarget) { bg = "rgba(34,197,94,0.30)"; border = "1px solid rgba(34,197,94,0.6)"; }
        else if (isMarkerBase) { bg = `${GOLD}59`; border = `1px solid ${GOLD}88`; }
        else if (isSecured)    { bg = `${GOLD}2E`; border = `1px solid ${GOLD}44`; }

        const pts = isBonusRound
          ? [0, 50, 100, 175, 275, 400, 600][step]
          : [0, 17, 33, 58, 92, 133, 200][step];

        return (
          <div key={step} style={{
            display: "flex", alignItems: "center", padding: "10px 14px",
            borderRadius: 10, background: bg, border,
            transition: "background 0.13s, border-color 0.13s",
          }}>
            <div style={{ flex: 1, fontSize: 13, fontWeight: isMarkerBase ? 700 : 400, color: isMarkerBase ? GOLD : "var(--text-sub)" }}>
              {label}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: isMarkerBase ? GOLD : isSecured ? `${GOLD}88` : "var(--text-muted)" }}>
              {pts} Pkt.
            </div>
            {isMarkerTarget && <div style={{ marginLeft: 8, fontSize: 16 }}>⬆️</div>}
            {isMarkerBase && !isClimbing && <div style={{ marginLeft: 8, fontSize: 16 }}>◀</div>}
          </div>
        );
      })}
    </div>
  );
}

// ── Match badge ───────────────────────────────────────────────────────────────
function MatchBadge({ cards }: { cards: [SonnenradSymbol, SonnenradSymbol, SonnenradSymbol] }) {
  const [a, b, c] = cards;
  let text = "Kein Treffer";
  if (a === "SONNENSCHIRM" && b === "SONNENSCHIRM" && c === "SONNENSCHIRM")
    text = "3× Sonnenschirm — Jackpot! ☀️";
  else if (a === b && b === c)
    text = `3× ${SYMBOL_LABELS[a]}`;
  else if (a === b) text = `2× ${SYMBOL_LABELS[a]}`;
  else if (b === c) text = `2× ${SYMBOL_LABELS[b]}`;
  else if (a === c) text = `2× ${SYMBOL_LABELS[a]}`;

  return (
    <div style={{
      background: "var(--surface2)", border: "1px solid var(--border)",
      borderRadius: 10, padding: "8px 14px", fontSize: 13,
      fontWeight: 700, color: "var(--text)", textAlign: "center",
    }}>
      {text}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const CSS_KEYFRAMES = `
@keyframes sr-shuffle-0 { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-28px)} 75%{transform:translateX(20px)} }
@keyframes sr-shuffle-1 { 0%,100%{transform:translateX(0)} 33%{transform:translateX(28px)} 66%{transform:translateX(-18px)} }
@keyframes sr-shuffle-2 { 0%,100%{transform:translateX(0)} 20%{transform:translateX(20px)} 70%{transform:translateX(-28px)} }
@keyframes sr-pulse { 0%,100%{box-shadow:0 0 0 0px ${GOLD}44} 50%{box-shadow:0 0 0 6px ${GOLD}00} }
`;

const CARD_W_LG = 90, CARD_H_LG = 130;
const CARD_W_SM = 52, CARD_H_SM = 75;

export default function SonnenradGameScreen() {
  const navigate = useNavigate();

  const [phase, setPhase]               = useState<SonnenradPhase>("BONUS_READY");
  const [cards, setCards]               = useState<[SonnenradSymbol, SonnenradSymbol, SonnenradSymbol]>(["SONNE", "SONNE", "SONNE"]);
  const [cardsFaceUp, setCardsFaceUp]   = useState(false);
  const [securedStep, setSecuredStep]   = useState(0);
  const [isTargetZone, setIsTargetZone] = useState(false);
  const [isBonusRound, setIsBonusRound] = useState(() => isBonusAvailable());
  const [nextBonusMs, setNextBonusMs]   = useState(() => msUntilBonus());
  const [roundPoints, setRoundPoints]   = useState(0);

  const climbRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown timer (only in BONUS_READY when no bonus)
  useEffect(() => {
    if (phase !== "BONUS_READY" || isBonusRound) return;
    countdownRef.current = setInterval(() => {
      const ms = msUntilBonus();
      setNextBonusMs(ms);
      if (ms <= 0) { setIsBonusRound(true); clearInterval(countdownRef.current!); }
    }, 1000);
    return () => clearInterval(countdownRef.current!);
  }, [phase, isBonusRound]);

  // SHUFFLING → REVEALING (1300ms)
  useEffect(() => {
    if (phase !== "SHUFFLING") return;
    const t = setTimeout(() => setPhase("REVEALING"), 1300);
    return () => clearTimeout(t);
  }, [phase]);

  // REVEALING: 80ms → flip, 830ms → evaluate
  useEffect(() => {
    if (phase !== "REVEALING") return;
    const t1 = setTimeout(() => {
      setCardsFaceUp(true);
      audioManager.playSound("sr_reveal");
    }, 80);
    const t2 = setTimeout(() => {
      const step = evaluateCards(cards);
      setSecuredStep(step);
      if (step === 0) {
        if (isBonusRound) claimBonus();
        addLifetimePoints(0);
        setRoundPoints(0);
        setPhase("FINISHED");
      } else {
        setPhase("AWAITING_CHOICE");
      }
    }, 830);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [phase, cards, isBonusRound]);

  // CLIMBING: 175ms marker toggle
  useEffect(() => {
    if (phase !== "CLIMBING") return;
    setIsTargetZone(false);
    climbRef.current = setInterval(() => {
      setIsTargetZone((prev) => {
        if (!prev) audioManager.playSound("sr_tick");
        return !prev;
      });
    }, 175);
    return () => clearInterval(climbRef.current!);
  }, [phase]);

  function startGame() {
    const newCards = drawThreeCards();
    setCards(newCards);
    setCardsFaceUp(false);
    setSecuredStep(0);
    setIsTargetZone(false);
    setPhase("SHUFFLING");
  }

  function handleCollect() {
    const pts = pointsForStep(securedStep, isBonusRound);
    addLifetimePoints(pts);
    if (isBonusRound) claimBonus();
    if (pts > 0) audioManager.playSound("sr_secure");
    setRoundPoints(pts);
    setPhase("FINISHED");
  }

  const handleJetzt = useCallback(() => {
    clearInterval(climbRef.current!);
    if (isTargetZone) {
      const next = securedStep + 1;
      audioManager.playSound("sr_step_up");
      if (next >= MAX_STEP) {
        // max reached — automatically collect
        const pts = pointsForStep(MAX_STEP, isBonusRound);
        addLifetimePoints(pts);
        if (isBonusRound) claimBonus();
        audioManager.playSound("sr_secure");
        setSecuredStep(MAX_STEP);
        setRoundPoints(pts);
        setPhase("FINISHED");
      } else {
        setSecuredStep(next);
        setIsTargetZone(false);
        setPhase("AWAITING_CHOICE");
      }
    } else {
      // miss — collect current secured step
      const pts = pointsForStep(securedStep, isBonusRound);
      addLifetimePoints(pts);
      if (isBonusRound) claimBonus();
      if (pts > 0) audioManager.playSound("sr_secure");
      setRoundPoints(pts);
      setIsTargetZone(false);
      setPhase("FINISHED");
    }
  }, [isTargetZone, securedStep, isBonusRound]);

  function handleReset() {
    const bonus = isBonusAvailable();
    setIsBonusRound(bonus);
    setNextBonusMs(msUntilBonus());
    setCardsFaceUp(false);
    setSecuredStep(0);
    setIsTargetZone(false);
    setRoundPoints(0);
    setPhase("BONUS_READY");
  }

  const bonusGlow = isBonusRound ? `0 0 16px ${GOLD}66` : "none";
  const headerBadge = isBonusRound ? (
    <div style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: `${GOLD}33`, color: GOLD, letterSpacing: 0.5 }}>
      🌟 TAGESBONUS
    </div>
  ) : null;

  return (
    <div className="screen" style={{ gap: 20 }}>
      <style>{CSS_KEYFRAMES}</style>

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button className="btn btn-outline btn-sm"
          style={{ width: 40, height: 40, padding: 0, fontSize: 20, flexShrink: 0 }}
          onClick={() => navigate(-1)}>‹</button>
        <div style={{ fontSize: 28, lineHeight: 1 }}>☀️</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text)" }}>Sonnenrad</div>
          {headerBadge}
        </div>
      </div>

      {/* ── BONUS_READY ──────────────────────────────────────────────────────── */}
      {phase === "BONUS_READY" && (
        <>
          <div
            onClick={startGame}
            style={{
              display: "flex", gap: 16, justifyContent: "center", alignItems: "center",
              padding: "32px 20px", cursor: "pointer",
              border: `2px solid ${isBonusRound ? GOLD : "var(--border)"}`,
              borderRadius: 16, background: "var(--surface)",
              boxShadow: bonusGlow,
              animation: isBonusRound ? "sr-pulse 1.5s ease-in-out infinite" : "none",
            }}
          >
            {[0, 1, 2].map((i) => <CardBack key={i} W={CARD_W_LG} H={CARD_H_LG} />)}
          </div>
          <div style={{ textAlign: "center", fontSize: 14, color: "var(--text-muted)" }}>
            {isBonusRound
              ? "Tippe auf die Karten um den Tagesbonus zu spielen"
              : `Normales Spiel — nächster Tagesbonus in ${formatMs(nextBonusMs)}`}
          </div>
          {!isBonusRound && (
            <div style={{ textAlign: "center", fontSize: 13, color: `${GOLD}cc` }}>
              Tippe zum Spielen (1/3 Punkte)
            </div>
          )}
          <button className="btn btn-primary" onClick={startGame}
            style={{ background: isBonusRound ? GOLD : "#0ea5e9", color: isBonusRound ? "#0a1628" : "#fff", fontWeight: 800 }}>
            {isBonusRound ? "🌟 Tagesbonus spielen" : "Spielen"}
          </button>
        </>
      )}

      {/* ── SHUFFLING ────────────────────────────────────────────────────────── */}
      {phase === "SHUFFLING" && (
        <div style={{ display: "flex", gap: 16, justifyContent: "center", alignItems: "center", padding: "32px 20px" }}>
          {[0, 1, 2].map((i) => (
            <CardBack key={i} W={CARD_W_LG} H={CARD_H_LG} />
          ))}
        </div>
      )}
      {/* Overlay animation div for shuffle (separate from card rendering) */}
      {phase === "SHUFFLING" && (
        <style>{`
          /* Shuffle card wrappers get offset animation */
        `}</style>
      )}

      {/* ── REVEALING ────────────────────────────────────────────────────────── */}
      {phase === "REVEALING" && (
        <div style={{ display: "flex", gap: 16, justifyContent: "center", alignItems: "center", padding: "32px 20px" }}>
          {cards.map((sym, i) => (
            <FlipCard key={i} symbol={sym} faceUp={cardsFaceUp} W={CARD_W_LG} H={CARD_H_LG} />
          ))}
        </div>
      )}

      {/* ── AWAITING_CHOICE ──────────────────────────────────────────────────── */}
      {phase === "AWAITING_CHOICE" && (
        <>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            {cards.map((sym, i) => <SymbolCard key={i} symbol={sym} W={CARD_W_SM} H={CARD_H_SM} />)}
          </div>
          <MatchBadge cards={cards} />
          <SonnenradLadder securedStep={securedStep} isTargetZone={false} isClimbing={false} isBonusRound={isBonusRound} />
          <div style={{ display: "flex", gap: 12 }}>
            <button className="btn btn-outline" style={{ flex: 1, fontWeight: 700 }} onClick={handleCollect}>
              Einsammeln
            </button>
            {securedStep < MAX_STEP && (
              <button className="btn btn-primary" style={{ flex: 1, fontWeight: 800, background: GOLD, color: "#0a1628" }}
                onClick={() => setPhase("CLIMBING")}>
                Klettern ↑
              </button>
            )}
          </div>
        </>
      )}

      {/* ── CLIMBING ─────────────────────────────────────────────────────────── */}
      {phase === "CLIMBING" && (
        <>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            {cards.map((sym, i) => <SymbolCard key={i} symbol={sym} W={CARD_W_SM} H={CARD_H_SM} />)}
          </div>
          <SonnenradLadder securedStep={securedStep} isTargetZone={isTargetZone} isClimbing isBonusRound={isBonusRound} />
          <button
            onClick={handleJetzt}
            style={{
              padding: 18, border: `3px solid ${isTargetZone ? "#22c55e" : GOLD}`,
              borderRadius: 14, cursor: "pointer", fontSize: 20, fontWeight: 900,
              background: isTargetZone ? "rgba(34,197,94,0.18)" : `${GOLD}22`,
              color: isTargetZone ? "#22c55e" : GOLD,
              transition: "background 0.13s, border-color 0.13s, color 0.13s",
            }}
          >
            Jetzt! ⚡
          </button>
        </>
      )}

      {/* ── FINISHED ─────────────────────────────────────────────────────────── */}
      {phase === "FINISHED" && (
        <>
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
            padding: "32px 20px",
            background: "var(--surface)", border: `1.5px solid ${roundPoints > 0 ? GOLD : "var(--border)"}`,
            borderRadius: 16,
          }}>
            {roundPoints > 0 ? (
              <>
                <div style={{ fontSize: 14, color: "var(--text-muted)" }}>Runde abgeschlossen!</div>
                <div style={{ fontSize: 48, fontWeight: 900, color: GOLD }}>{roundPoints}</div>
                <div style={{ fontSize: 16, color: GOLD }}>Punkte</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 36 }}>🌊</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>Kein Treffer</div>
                <div style={{ fontSize: 14, color: "var(--text-muted)" }}>Beim nächsten Mal klappt es besser!</div>
              </>
            )}
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
              Gesamt: {getLifetimePoints()} Punkte
            </div>
          </div>
          <button className="btn btn-primary" style={{ background: "#0ea5e9", fontWeight: 800 }} onClick={handleReset}>
            Nochmal spielen
          </button>
          <button className="btn btn-outline" onClick={() => navigate(-1)}>
            Zurück
          </button>
        </>
      )}
    </div>
  );
}
