import { useCallback, useEffect, useRef, useState } from "react";
import { doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase";
import {
  dealGame, executeNehmen, openOffer, respondToOffer, declineOffer,
  selectPartnerAndSwap, cancelOffer, aiDecideMove, hasWon,
  fromFirestoreDoc, playerStateToFirestore, offerToFirestore,
  EMPTY_OFFER,
} from "./klontauschLogic";
import type { KlonGameState, KlonCard, KlonPart } from "./klontauschLogic";
import { klonCharacterById } from "./klontauschCharacterLibrary";
import { KlontauschCharacterPart, KlontauschSilhouette } from "./KlontauschCharacterPart";
import { GameSaveQuitDialog } from "../../components/GameHudBar";
import { getGameSave, saveGame, deleteGameSave, generateGameSaveId } from "../../gameSave";
import { audioManager } from "../../audio/AudioManager";

const KT_COLOR  = "#8B5CF6";
const KT_DIM    = "rgba(139,92,246,0.12)";
const OFFER_TIMEOUT_S = 10;

const AI_AVATARS = ["🤖", "🦀", "🐟", "🦈", "🐬"];
const AI_NAMES   = ["Möwe", "Krabbe", "Fisch", "Hai", "Delfin"];

function categoryColor(category: string): string {
  switch (category) {
    case "Beruf": return "#3b82f6";
    case "Tier":  return "#22c55e";
    case "Show":  return "#f97316";
    case "Alien": return "#a855f7";
    case "Meer":  return "#06b6d4";
    case "Pflanze": return "#84cc16";
    case "Comic": return "#ef4444";
    default:       return KT_COLOR;
  }
}

function partLabel(part: KlonPart): string {
  switch (part) {
    case "KOPF":    return "Kopf";
    case "KOERPER": return "Körper";
    case "BEINE":   return "Beine";
  }
}

function checkWin(state: KlonGameState, allTargets: Record<string, string[]>): string | null {
  for (const uid of state.playerIds) {
    const player = state.players[uid];
    const targets = allTargets[uid] ?? [];
    if (player && targets.length > 0 && hasWon(player, targets)) return uid;
  }
  return null;
}

// ── TargetColumn ──────────────────────────────────────────────────────────────

function TargetColumn({
  characterId, heldCards, colW,
}: {
  characterId: string;
  heldCards: KlonCard[];
  colW: number;
}) {
  const ch    = klonCharacterById(characterId);
  const parts: KlonPart[] = ["KOPF", "KOERPER", "BEINE"];
  const partH = [0.35, 0.35, 0.30];
  const totalH = colW * 2.2;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: colW }}>
      <div style={{ width: colW, height: totalH, border: `1.5px solid ${KT_COLOR}44`, borderRadius: 8, overflow: "hidden" }}>
        {parts.map((p, i) => {
          const h = totalH * partH[i];
          const hasCard = heldCards.some(c => c.characterId === characterId && c.part === p);
          return (
            <div key={p} style={{ width: colW, height: h, position: "relative" }}>
              {hasCard ? (
                <KlontauschCharacterPart characterId={characterId} part={p} />
              ) : (
                <KlontauschSilhouette />
              )}
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4, textAlign: "center", maxWidth: colW, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {ch.name}
      </div>
    </div>
  );
}

// ── HandCard ──────────────────────────────────────────────────────────────────

function HandCard({
  card, isTarget, isSelected, onClick,
}: {
  card: KlonCard;
  isTarget: boolean;
  isSelected: boolean;
  onClick?: () => void;
}) {
  const ch    = klonCharacterById(card.characterId);
  const color = categoryColor(ch.category);
  return (
    <div
      onClick={onClick}
      style={{
        width: 64, height: 92, borderRadius: 8, flexShrink: 0,
        background: isSelected
          ? `linear-gradient(135deg, ${KT_COLOR}55, ${KT_COLOR}22)`
          : `linear-gradient(135deg, ${color}22, ${color}11)`,
        border: isSelected
          ? `2px solid ${KT_COLOR}`
          : isTarget
            ? `2px solid #22c55e`
            : `1.5px solid ${color}55`,
        boxShadow: isSelected
          ? `0 0 10px ${KT_COLOR}88`
          : isTarget
            ? "0 0 8px rgba(34,197,94,0.5)"
            : "0 2px 6px rgba(0,0,0,0.25)",
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", gap: 4, cursor: onClick ? "pointer" : "default",
        transition: "all 0.15s", userSelect: "none",
        transform: isSelected ? "translateY(-6px)" : "none",
        padding: "4px 2px",
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 700, color: isTarget ? "#22c55e" : color, letterSpacing: 0.3, textTransform: "uppercase" }}>
        {partLabel(card.part)}
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text)", textAlign: "center", lineHeight: 1.2,
        maxWidth: 58, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box",
        WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
        {ch.name}
      </div>
      {isTarget && (
        <div style={{ fontSize: 8, color: "#22c55e", fontWeight: 700 }}>ZIEL ✓</div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function KlontauschGameScreen() {
  const navigate = useNavigate();
  const uid = auth.currentUser?.uid ?? "";

  const gameData = JSON.parse(sessionStorage.getItem("klontauschGame") ?? "{}") as {
    mode?: string; aiCount?: number; myName?: string; myAvatar?: string;
    gameId?: string; saveId?: string;
  };
  const mode    = gameData.mode ?? "ai";
  const gameId  = gameData.gameId ?? "";
  const saveId  = gameData.saveId ?? null;

  // ── Game state ───────────────────────────────────────────────────────────────
  const [local, setLocal]           = useState<KlonGameState | null>(null);
  const [allTargets, setAllTargets] = useState<Record<string, string[]>>({});
  const [myTargets, setMyTargets]   = useState<string[]>([]);
  const localRef = useRef<KlonGameState | null>(null);
  useEffect(() => { localRef.current = local; }, [local]);

  // Online state
  const [online, setOnline]         = useState<KlonGameState | null>(null);

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [choosingCard, setChoosingCard]     = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [showQuit, setShowQuit]             = useState(false);
  const [offerStartTs, setOfferStartTs]     = useState<number | null>(null);
  const [offerCountdown, setOfferCountdown] = useState(OFFER_TIMEOUT_S);

  const aiTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offerTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Audio ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    audioManager.startMusic("strandraeuber"); // reuse a card-game track
    return () => audioManager.stopMusic();
  }, []);

  // ── Init AI mode ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== "ai") return;

    // Restore from save?
    if (saveId) {
      const save = getGameSave("klontausch");
      if (save && save.id === saveId) {
        try {
          const saved = JSON.parse(save.gameState) as { gameState: KlonGameState; allTargets: Record<string, string[]> };
          setLocal(saved.gameState);
          setAllTargets(saved.allTargets);
          const humanUid = saved.gameState.playerIds.find(id => !saved.gameState.players[id]?.isAI) ?? (uid || "human");
          setMyTargets(saved.allTargets[humanUid] ?? []);
        } catch { /* fall through to new game */ }
        return;
      }
    }

    const aiCount    = gameData.aiCount ?? 2;
    const humanUid   = uid || "human";
    const myName     = gameData.myName ?? "Du";
    const myAvatar   = gameData.myAvatar ?? "👤";

    const playerIds   = [humanUid, ...Array.from({ length: aiCount }, (_, i) => `ai_${i}`)];

    const playerMap: Record<string, import("./klontauschLogic").KlonPlayerState> = {};
    playerIds.forEach((pid, i) => {
      playerMap[pid] = {
        userId:      pid,
        displayName: i === 0 ? myName : AI_NAMES[i - 1] ?? `KI ${i}`,
        avatarUrl:   i === 0 ? myAvatar : AI_AVATARS[i - 1] ?? "🤖",
        heldCards: [], cardCount: 0, isAI: i > 0, isEliminated: false,
      };
    });

    const { players, targets } = dealGame(playerMap, playerIds);

    const initState: KlonGameState = {
      players,
      playerIds,
      turnIndex: 0,
      offer: EMPTY_OFFER,
      status: "PLAYING",
      winnerId: "",
      adminId: humanUid,
    };

    setLocal(initState);
    setAllTargets(targets);
    setMyTargets(targets[humanUid] ?? []);
    audioManager.playSound("card_deal");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Init online mode ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== "online" || !gameId || !uid) return;

    // Load my private targets
    getDoc(doc(db, "klontauschGames", gameId, "private", uid)).then((snap) => {
      if (snap.exists()) setMyTargets(snap.data().targetCharacterIds ?? []);
    });

    const unsub = onSnapshot(doc(db, "klontauschGames", gameId), (snap) => {
      if (!snap.exists()) return;
      const g = fromFirestoreDoc(snap.data());
      setOnline(g);
      if (g.status === "FINISHED" && g.winnerId) {
        const winner = g.players[g.winnerId];
        sessionStorage.setItem("klontauschResult", JSON.stringify({
          winnerId: g.winnerId,
          winnerName: winner?.displayName ?? "?",
          winnerAvatar: winner?.avatarUrl ?? "🏆",
          players: g.playerIds.map(pid => ({
            userId: pid,
            displayName: g.players[pid]?.displayName ?? pid,
            avatarUrl: g.players[pid]?.avatarUrl ?? "👤",
            cardCount: g.players[pid]?.cardCount ?? 0,
          })),
        }));
        navigate("/klontausch/results", { replace: true });
      }
    });
    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, gameId, uid]);

  // ── Offer countdown ───────────────────────────────────────────────────────────
  const gs = mode === "ai" ? local : online;

  useEffect(() => {
    if (gs?.offer.type === "OPEN") {
      setOfferStartTs(Date.now());
      setOfferCountdown(OFFER_TIMEOUT_S);
    } else {
      setOfferStartTs(null);
      if (offerTimerRef.current) clearInterval(offerTimerRef.current);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gs?.offer.type, gs?.offer.fromUserId]);

  useEffect(() => {
    if (!offerStartTs) return;
    offerTimerRef.current = setInterval(() => {
      const elapsed = (Date.now() - offerStartTs) / 1000;
      const remaining = Math.max(0, Math.ceil(OFFER_TIMEOUT_S - elapsed));
      setOfferCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(offerTimerRef.current!);
        if (mode === "ai") {
          setLocal(prev => prev ? { ...cancelOffer(prev), status: "PLAYING" } : prev);
          setChoosingCard(false);
          setSelectedCardId(null);
        }
      }
    }, 200);
    return () => { if (offerTimerRef.current) clearInterval(offerTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offerStartTs]);

  // ── AI loop (AI mode only) ────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== "ai" || !local || local.status !== "PLAYING") return;

    const state = local;
    const offer = state.offer;
    const currentUid = state.playerIds[state.turnIndex % state.playerIds.length];

    // Process AI responses to an open offer
    if (offer.type === "OPEN") {
      const aisPending = state.playerIds.filter(pid => {
        const p = state.players[pid];
        return p?.isAI
          && pid !== offer.fromUserId
          && !offer.responderIds.includes(pid)
          && !offer.declinedIds.includes(pid);
      });

      if (aisPending.length > 0) {
        aiTimerRef.current = setTimeout(() => {
          setLocal(prev => {
            if (!prev || prev.offer.type !== "OPEN") return prev;
            let s = prev;
            for (const aiUid of aisPending) {
              s = aiDecideMove(s, aiUid, allTargets[aiUid] ?? []);
            }
            return s;
          });
        }, 700);
        return () => { if (aiTimerRef.current) clearTimeout(aiTimerRef.current); };
      }

      // Offerer is AI and there are responders → pick partner
      if (offer.fromUserId === currentUid && state.players[currentUid]?.isAI
          && offer.responderIds.length > 0) {
        aiTimerRef.current = setTimeout(() => {
          setLocal(prev => {
            if (!prev || prev.offer.type !== "OPEN") return prev;
            const nextState = aiDecideMove(prev, currentUid, allTargets[currentUid] ?? []);
            const winner = checkWin(nextState, allTargets);
            if (winner) {
              finishGame(nextState, winner);
              return { ...nextState, status: "FINISHED", winnerId: winner };
            }
            return nextState;
          });
        }, 900);
        return () => { if (aiTimerRef.current) clearTimeout(aiTimerRef.current); };
      }

      return; // wait for human to respond/decide
    }

    // No open offer; if it's an AI's turn, decide
    if (state.players[currentUid]?.isAI) {
      aiTimerRef.current = setTimeout(() => {
        setLocal(prev => {
          if (!prev || prev.status !== "PLAYING") return prev;
          const cur = prev.playerIds[prev.turnIndex % prev.playerIds.length];
          if (!prev.players[cur]?.isAI) return prev;
          const nextState = aiDecideMove(prev, cur, allTargets[cur] ?? []);
          const winner = checkWin(nextState, allTargets);
          if (winner) {
            finishGame(nextState, winner);
            return { ...nextState, status: "FINISHED", winnerId: winner };
          }
          return nextState;
        });
      }, 1200);
      return () => { if (aiTimerRef.current) clearTimeout(aiTimerRef.current); };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local?.turnIndex, local?.offer, local?.status]);

  function finishGame(state: KlonGameState, winnerId: string) {
    const winner = state.players[winnerId];
    sessionStorage.setItem("klontauschResult", JSON.stringify({
      winnerId,
      winnerName: winner?.displayName ?? "?",
      winnerAvatar: winner?.avatarUrl ?? "🏆",
      players: state.playerIds.map(pid => ({
        userId: pid,
        displayName: state.players[pid]?.displayName ?? pid,
        avatarUrl: state.players[pid]?.avatarUrl ?? "👤",
        cardCount: state.players[pid]?.cardCount ?? 0,
      })),
      targets: allTargets,
    }));
  }

  // ── Human actions (AI mode) ───────────────────────────────────────────────────

  const humanUid = mode === "ai"
    ? (local?.playerIds.find(id => !local?.players[id]?.isAI) ?? uid ?? "human")
    : uid;

  const handleNehmen = useCallback(() => {
    if (!local || local.status !== "PLAYING") return;
    const cur = local.playerIds[local.turnIndex % local.playerIds.length];
    if (cur !== humanUid) return;
    audioManager.playSound("card_draw");
    setLocal(prev => {
      if (!prev) return prev;
      const next = executeNehmen(prev, humanUid);
      const winner = checkWin(next, allTargets);
      if (winner) { finishGame(next, winner); return { ...next, status: "FINISHED", winnerId: winner }; }
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local, humanUid, allTargets]);

  const handleConfirmTauschen = useCallback(() => {
    if (!local || !selectedCardId) return;
    const cur = local.playerIds[local.turnIndex % local.playerIds.length];
    if (cur !== humanUid) return;
    setChoosingCard(false);
    setLocal(prev => {
      if (!prev) return prev;
      return openOffer(prev, humanUid, selectedCardId);
    });
    setSelectedCardId(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local, humanUid, selectedCardId]);

  const handleRespondToOffer = useCallback((respond: boolean) => {
    if (!local) return;
    setLocal(prev => {
      if (!prev) return prev;
      const next = respond
        ? respondToOffer(prev, humanUid)
        : declineOffer(prev, humanUid);
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local, humanUid]);

  const handlePickPartner = useCallback((responderId: string) => {
    if (!local) return;
    audioManager.playSound("card_deal");
    setLocal(prev => {
      if (!prev) return prev;
      const next = selectPartnerAndSwap(prev, responderId);
      const winner = checkWin(next, allTargets);
      if (winner) { finishGame(next, winner); return { ...next, status: "FINISHED", winnerId: winner }; }
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local, allTargets]);

  const handleCancelOffer = useCallback(() => {
    setLocal(prev => prev ? cancelOffer(prev) : prev);
  }, []);

  // ── Online: actions ───────────────────────────────────────────────────────────

  async function onlineNehmen() {
    if (!online || !gameId) return;
    const cur = online.playerIds[online.turnIndex % online.playerIds.length];
    if (cur !== uid) return;
    const next = executeNehmen(online, uid);
    const winner = checkWin(next, { [uid]: myTargets });
    await updateDoc(doc(db, "klontauschGames", gameId), {
      players: Object.fromEntries(Object.entries(next.players).map(([k, v]) => [k, playerStateToFirestore(v)])),
      turnIndex: next.turnIndex,
      offer: offerToFirestore(next.offer),
      ...(winner ? { status: "FINISHED", winnerId: winner } : {}),
    });
  }

  async function onlineOpenOffer(cardId: string) {
    if (!online || !gameId) return;
    const next = openOffer(online, uid, cardId);
    await updateDoc(doc(db, "klontauschGames", gameId), {
      offer: offerToFirestore(next.offer),
    });
    setChoosingCard(false);
    setSelectedCardId(null);
  }

  async function onlineRespond(respond: boolean) {
    if (!online || !gameId) return;
    const next = respond ? respondToOffer(online, uid) : declineOffer(online, uid);
    await updateDoc(doc(db, "klontauschGames", gameId), {
      offer: offerToFirestore(next.offer),
    });
  }

  async function onlinePickPartner(responderId: string) {
    if (!online || !gameId) return;
    const next = selectPartnerAndSwap(online, responderId);
    const winner = checkWin(next, { [uid]: myTargets });
    await updateDoc(doc(db, "klontauschGames", gameId), {
      players: Object.fromEntries(Object.entries(next.players).map(([k, v]) => [k, playerStateToFirestore(v)])),
      turnIndex: next.turnIndex,
      offer: offerToFirestore(next.offer),
      ...(winner ? { status: "FINISHED", winnerId: winner } : {}),
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (!gs) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a1628" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48 }}>🃏</div>
          <div style={{ marginTop: 12, color: "var(--text-sub)" }}>Wird geladen…</div>
        </div>
      </div>
    );
  }

  const state         = gs;
  const currentTurnUid = state.playerIds[state.turnIndex % state.playerIds.length];
  const isMyTurn      = currentTurnUid === humanUid;
  const offer         = state.offer;
  const iAmOfferer    = offer.type === "OPEN" && offer.fromUserId === humanUid;
  const iAmResponder  = offer.type === "OPEN" && offer.fromUserId !== humanUid
                        && !offer.responderIds.includes(humanUid)
                        && !offer.declinedIds.includes(humanUid);
  const iAlreadyResponded = offer.type === "OPEN"
    && (offer.responderIds.includes(humanUid) || offer.declinedIds.includes(humanUid));

  const humanPlayer = state.players[humanUid];
  const humanHand   = humanPlayer?.heldCards ?? [];

  const leftIdx     = state.playerIds.indexOf(humanUid);
  const leftNeighborUid = state.playerIds[(leftIdx - 1 + state.playerIds.length) % state.playerIds.length];
  const leftNeighbor    = state.players[leftNeighborUid];

  const opponents = state.playerIds
    .filter(pid => pid !== humanUid)
    .map(pid => state.players[pid])
    .filter(Boolean);

  const isGameOver = state.status === "FINISHED";

  const screenW = window.innerWidth;
  const colW    = Math.min(100, Math.floor((screenW - 32 - 16) / 3));

  const isCardTarget = (card: KlonCard) =>
    myTargets.includes(card.characterId);

  // ── UI helper: action area content ───────────────────────────────────────────

  function renderActionArea() {
    // Game over: nothing (overlay handles it)
    if (isGameOver) return null;

    // Open offer
    if (offer.type === "OPEN") {
      const offererPlayer = state.players[offer.fromUserId];
      return (
        <div style={{ background: KT_DIM, border: `1px solid ${KT_COLOR}66`, borderRadius: 10, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: KT_COLOR }}>
              {offererPlayer?.displayName} tauscht {partLabel(offer.part as KlonPart)}
            </div>
            <div style={{
              width: 28, height: 28, borderRadius: 14,
              background: offerCountdown <= 3 ? "#ef444444" : "rgba(139,92,246,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 700, color: offerCountdown <= 3 ? "#ef4444" : KT_COLOR,
              flexShrink: 0,
            }}>
              {offerCountdown}
            </div>
          </div>

          {/* Offerer: see responders, pick one */}
          {iAmOfferer && (
            offer.responderIds.length === 0 ? (
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)", flex: 1 }}>
                  Warte auf Meldungen…
                </span>
                <button
                  onClick={() => mode === "ai" ? handleCancelOffer() : undefined}
                  style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, background: "none", border: "1px solid var(--border)", color: "var(--text-sub)", cursor: "pointer" }}>
                  Zurückziehen
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Tauschpartner wählen:</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {offer.responderIds.map(rid => {
                    const rp = state.players[rid];
                    return (
                      <button key={rid}
                        onClick={() => mode === "ai" ? handlePickPartner(rid) : onlinePickPartner(rid)}
                        style={{ padding: "6px 12px", borderRadius: 8, background: "#22c55e22", border: "1px solid #22c55e66", color: "#22c55e", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                        {rp?.avatarUrl} {rp?.displayName}
                      </button>
                    );
                  })}
                </div>
              </div>
            )
          )}

          {/* Responder: melden oder ablehnen */}
          {iAmResponder && humanHand.some(c => c.part === offer.part) && (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => mode === "ai" ? handleRespondToOffer(true) : onlineRespond(true)}
                style={{ flex: 1, padding: "8px 0", borderRadius: 8, background: "#22c55e22", border: "1px solid #22c55e66", color: "#22c55e", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                ✋ Interesse
              </button>
              <button
                onClick={() => mode === "ai" ? handleRespondToOffer(false) : onlineRespond(false)}
                style={{ flex: 1, padding: "8px 0", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.35)", color: "#ef4444", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                ✗ Ablehnen
              </button>
            </div>
          )}
          {iAmResponder && !humanHand.some(c => c.part === offer.part) && (
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Du hast keine {partLabel(offer.part as KlonPart)}-Karte zum Tauschen.
            </div>
          )}
          {iAlreadyResponded && !iAmOfferer && (
            <div style={{ fontSize: 12, color: offer.responderIds.includes(humanUid) ? "#22c55e" : "var(--text-muted)" }}>
              {offer.responderIds.includes(humanUid) ? "✋ Du hast Interesse gemeldet." : "Du hast abgelehnt."}
            </div>
          )}
        </div>
      );
    }

    // My turn: choose action
    if (isMyTurn && !choosingCard) {
      return (
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => mode === "ai" ? handleNehmen() : onlineNehmen()}
            style={{
              flex: 1, padding: "12px 8px", borderRadius: 10,
              background: KT_DIM, border: `1.5px solid ${KT_COLOR}66`,
              color: KT_COLOR, fontWeight: 700, fontSize: 14, cursor: "pointer",
            }}>
            👋 Nehmen
            <div style={{ fontSize: 10, fontWeight: 400, color: "var(--text-muted)", marginTop: 2 }}>
              von {leftNeighbor?.displayName}
            </div>
          </button>
          <button
            onClick={() => setChoosingCard(true)}
            disabled={humanHand.length === 0}
            style={{
              flex: 1, padding: "12px 8px", borderRadius: 10,
              background: humanHand.length > 0 ? "rgba(34,197,94,0.12)" : "var(--surface2)",
              border: `1.5px solid ${humanHand.length > 0 ? "#22c55e66" : "var(--border)"}`,
              color: humanHand.length > 0 ? "#22c55e" : "var(--text-muted)",
              fontWeight: 700, fontSize: 14, cursor: humanHand.length > 0 ? "pointer" : "not-allowed",
              opacity: humanHand.length > 0 ? 1 : 0.5,
            }}>
            🔄 Tauschen
            <div style={{ fontSize: 10, fontWeight: 400, color: "var(--text-muted)", marginTop: 2 }}>
              Karte anbieten
            </div>
          </button>
        </div>
      );
    }

    // My turn: choosing card for Tauschen
    if (isMyTurn && choosingCard) {
      return (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ flex: 1, fontSize: 12, color: "var(--text-sub)" }}>
            {selectedCardId
              ? "Karte tippen zum Bestätigen, oder andere Karte wählen"
              : "Wähle eine Karte zum Anbieten:"}
          </div>
          {selectedCardId && (
            <button
              onClick={() => mode === "ai" ? handleConfirmTauschen() : onlineOpenOffer(selectedCardId)}
              style={{ padding: "8px 14px", borderRadius: 8, background: "#22c55e", border: "none", color: "white", fontWeight: 700, cursor: "pointer", fontSize: 13, flexShrink: 0 }}>
              ✓ Anbieten
            </button>
          )}
          <button
            onClick={() => { setChoosingCard(false); setSelectedCardId(null); }}
            style={{ padding: "8px 10px", borderRadius: 8, background: "none", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer", fontSize: 13, flexShrink: 0 }}>
            ✗
          </button>
        </div>
      );
    }

    // Not my turn
    return (
      <div style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "4px 0" }}>
        {state.players[currentTurnUid]?.isAI
          ? `🤖 ${state.players[currentTurnUid]?.displayName} ist am Zug…`
          : `⏳ Warte auf ${state.players[currentTurnUid]?.displayName}…`}
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#0a1628", display: "flex", flexDirection: "column" }}>

      {/* ── Header ── */}
      <div style={{
        background: `linear-gradient(135deg, #3b0764 0%, ${KT_COLOR} 100%)`,
        padding: "10px 14px", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>🃏</span>
          <div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", letterSpacing: 1, textTransform: "uppercase" }}>Klontausch</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "white" }}>
              {isMyTurn && offer.type === "NONE" && !isGameOver
                ? "Du bist dran!"
                : offer.type === "OPEN"
                  ? `Tauschangebot: ${partLabel(offer.part as KlonPart)}`
                  : isGameOver
                    ? `${state.players[state.winnerId]?.displayName} gewinnt!`
                    : `${state.players[currentTurnUid]?.displayName} ist dran`}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)" }}>
            {humanHand.length} Karten
          </div>
          <button onClick={() => setShowQuit(true)} style={{
            background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 6,
            width: 32, height: 32, fontSize: 16, cursor: "pointer", color: "white",
          }}>✕</button>
        </div>
      </div>

      {/* ── Action area (fixed) ── */}
      <div style={{ padding: "10px 12px", background: "var(--surface)", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        {renderActionArea()}
      </div>

      {/* ── Target figures (fixed) ── */}
      <div style={{
        padding: "10px 12px 8px", background: "#0d1e35",
        borderBottom: "1px solid var(--border)", flexShrink: 0,
      }}>
        <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 6, letterSpacing: 0.5 }}>
          MEINE ZIELFIGUREN
        </div>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2, scrollbarWidth: "none" }}>
          {myTargets.length > 0
            ? myTargets.map(charId => (
                <TargetColumn key={charId} characterId={charId} heldCards={humanHand} colW={colW} />
              ))
            : (
              <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "8px 0" }}>Lade Zielfiguren…</div>
            )}
        </div>
      </div>

      {/* ── Scrollable area: opponents + hand ── */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>

        {/* Opponents */}
        <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", gap: 10, overflowX: "auto", scrollbarWidth: "none" }}>
            {opponents.map(opp => {
              if (!opp) return null;
              const isActive = opp.userId === currentTurnUid;
              const hasResponded = offer.responderIds.includes(opp.userId);
              const hasDeclined  = offer.declinedIds.includes(opp.userId);
              return (
                <div key={opp.userId} style={{
                  display: "flex", flexDirection: "column", alignItems: "center",
                  minWidth: 64, padding: "6px 8px", borderRadius: 8,
                  background: isActive ? KT_DIM : "transparent",
                  border: `1px solid ${isActive ? KT_COLOR + "55" : "transparent"}`,
                  flexShrink: 0,
                }}>
                  <div style={{ fontSize: 22 }}>{opp.avatarUrl}</div>
                  <div style={{ fontSize: 10, fontWeight: isActive ? 700 : 400, color: isActive ? KT_COLOR : "var(--text-sub)", marginTop: 2, maxWidth: 64, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {opp.displayName}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                    {opp.cardCount} Karten
                  </div>
                  {offer.type === "OPEN" && opp.userId !== offer.fromUserId && (
                    <div style={{ fontSize: 10, marginTop: 2, color: hasResponded ? "#22c55e" : hasDeclined ? "#ef4444" : "var(--text-muted)" }}>
                      {hasResponded ? "✋" : hasDeclined ? "✗" : "…"}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* My hand */}
        <div style={{ padding: "12px 12px 20px", flex: 1 }}>
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 8, letterSpacing: 0.5 }}>
            MEINE HAND ({humanHand.length} Karten)
            {choosingCard && <span style={{ color: KT_COLOR, marginLeft: 6 }}>— Karte wählen</span>}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {humanHand.map(card => (
              <HandCard
                key={card.cardId}
                card={card}
                isTarget={isCardTarget(card)}
                isSelected={selectedCardId === card.cardId}
                onClick={choosingCard ? () => setSelectedCardId(card.cardId === selectedCardId ? null : card.cardId) : undefined}
              />
            ))}
            {humanHand.length === 0 && (
              <div style={{ fontSize: 14, color: "var(--text-muted)", padding: "20px 0" }}>
                Keine Karten auf der Hand.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Game Over Overlay ── */}
      {isGameOver && (
        <GameOverOverlay
          state={state}
          winnerId={state.winnerId}
          humanUid={humanUid}
          onResults={() => navigate("/klontausch/results", { replace: true })}
          onHome={() => navigate("/home", { replace: true })}
          onLobby={() => navigate("/klontausch/lobby", { replace: true })}
        />
      )}

      {/* ── Quit dialog ── */}
      {showQuit && (
        <GameSaveQuitDialog
          emoji="🃏"
          message={`${state.playerIds.length} Spieler · ${humanHand.length} Karten auf der Hand`}
          onContinue={() => setShowQuit(false)}
          onSaveAndQuit={() => {
            if (mode === "ai" && local) {
              saveGame({
                id: saveId ?? generateGameSaveId(),
                gameType: "klontausch",
                difficulty: "",
                gameState: JSON.stringify({ gameState: local, allTargets, aiCount: gameData.aiCount ?? 2 }),
                displayLabel: `${local.playerIds.length} Spieler · Zug ${local.turnIndex + 1}`,
                savedAt: Date.now(),
              });
            }
            navigate("/klontausch/lobby", { replace: true });
          }}
          onQuitWithoutSave={() => {
            deleteGameSave("klontausch");
            navigate("/klontausch/lobby", { replace: true });
          }}
          hideSave={mode !== "ai"}
        />
      )}
    </div>
  );
}

// ── GameOverOverlay ────────────────────────────────────────────────────────────

function GameOverOverlay({
  state, winnerId, humanUid,
  onResults, onHome, onLobby,
}: {
  state: KlonGameState;
  winnerId: string;
  humanUid: string;
  onResults: () => void;
  onHome: () => void;
  onLobby: () => void;
}) {
  const KT_COLOR  = "#8B5CF6";
  const KT_DIM    = "rgba(139,92,246,0.12)";
  const winner    = state.players[winnerId];
  const iWon      = winnerId === humanUid;

  useEffect(() => {
    audioManager.playSound(iWon ? "level_complete" : "sp_gameover");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(10,22,40,0.93)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50,
    }}>
      <div className="card" style={{ width: "min(360px,92vw)", padding: 24, textAlign: "center" }}>
        <div style={{ fontSize: 64 }}>{iWon ? "🏆" : "🃏"}</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "white", marginTop: 8 }}>
          {iWon ? "Du gewinnst!" : `${winner?.displayName} gewinnt!`}
        </div>
        <div style={{ fontSize: 14, color: iWon ? "#22c55e" : "var(--text-sub)", marginTop: 4 }}>
          {iWon ? "Alle 3 Zielfiguren komplett!" : "Hat alle 3 Zielfiguren gesammelt."}
        </div>

        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 6 }}>
          {state.playerIds.map(pid => {
            const p = state.players[pid];
            return (
              <div key={pid} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8,
                background: pid === winnerId ? KT_DIM : "rgba(255,255,255,0.04)",
                border: `1px solid ${pid === winnerId ? KT_COLOR + "44" : "var(--border)"}`,
              }}>
                <span style={{ fontSize: 20 }}>{p?.avatarUrl}</span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, textAlign: "left" }}>{p?.displayName}</span>
                <span style={{ fontSize: 12, color: pid === winnerId ? KT_COLOR : "var(--text-muted)" }}>
                  {pid === winnerId ? "🏆 Sieger" : `${p?.cardCount ?? 0} Karten`}
                </span>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button className="btn btn-outline" style={{ flex: 1 }} onClick={onHome}>🏠 Home</button>
          <button className="btn btn-outline" style={{ flex: 1 }} onClick={onResults}>📊 Ergebnis</button>
          <button className="btn" style={{ flex: 1, background: KT_COLOR, color: "white" }} onClick={onLobby}>Nochmal</button>
        </div>
      </div>
    </div>
  );
}
