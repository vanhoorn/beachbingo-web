import { useEffect, useRef, useState } from "react";
import { doc, setDoc, getDoc, onSnapshot, deleteDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { auth, db } from "../../firebase";
import type { User, VierDifficulty, VierGame } from "../../types";
import { DRINK_ICONS, DrinkPiece } from "./drinkIcons";

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

type Step = "mode" | "drink" | "lobby";
type Mode = "ai" | "online";
type OnlineStep = "choose" | "waiting";

export default function VierLobbyScreen() {
  const [step, setStep] = useState<Step>("mode");
  const [mode, setMode] = useState<Mode>("ai");
  const [myDrinkId, setMyDrinkId] = useState("lager");
  const [aiDifficulty, setAiDifficulty] = useState<VierDifficulty>("SNIPER");
  const [onlineStep, setOnlineStep] = useState<OnlineStep>("choose");
  const [gameCode, setGameCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [waitingGame, setWaitingGame] = useState<VierGame | null>(null);
  const [error, setError] = useState("");
  const [isFavorite, setIsFavorite] = useState(false);
  const navigate = useNavigate();
  const uid = auth.currentUser?.uid;
  const unsubWaitRef = useRef<(() => void) | null>(null);

  async function cancelWaiting() {
    unsubWaitRef.current?.();
    unsubWaitRef.current = null;
    if (gameCode) {
      try { await deleteDoc(doc(db, "vierGames", gameCode)); } catch { /* ignore */ }
    }
    setOnlineStep("choose");
    setGameCode("");
    setWaitingGame(null);
  }

  async function loadUser(): Promise<User | null> {
    if (!uid) return null;
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? (snap.data() as User) : null;
  }

  // Load preferred drink on mount
  useEffect(() => {
    if (!uid) return;
    getDoc(doc(db, "users", uid)).then((snap) => {
      if (snap.exists()) {
        const u = snap.data() as User;
        if (u.preferredVierDrinkId) setMyDrinkId(u.preferredVierDrinkId);
        if (u.preferredVierDifficulty) setAiDifficulty(u.preferredVierDifficulty);
      }
      setIsFavorite((snap.data()?.favoriteGames as string[] ?? []).includes("vier"));
    });
  }, [uid]);

  async function toggleFavorite() {
    if (!uid) return;
    const next = !isFavorite;
    setIsFavorite(next);
    await updateDoc(doc(db, "users", uid), {
      favoriteGames: next ? arrayUnion("vier") : arrayRemove("vier"),
    });
  }

  // Handle ?join= deep-link (QR scan)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const j = p.get("join");
    if (j) { setMode("online"); setStep("lobby"); setJoinCode(j.toUpperCase()); }
  }, []);

  function pickAiDrink(myId: string): string {
    const others = DRINK_ICONS.filter(d => d.id !== myId);
    return others[Math.floor(Math.random() * others.length)].id;
  }

  function startVsAi() {
    const aiDrinkId = pickAiDrink(myDrinkId);
    navigate("/vier/game", { state: { mode: "ai", myDrinkId, aiDrinkId, aiDifficulty } });
  }

  async function createOnlineGame() {
    const user = await loadUser();
    if (!user || !uid) return;
    setCreating(true);
    setError("");
    try {
      const code = generateCode();
      const game: Omit<VierGame, "gameId"> = {
        adminId: uid,
        status: "LOBBY",
        humanCount: 2,
        players: [{ userId: uid, displayName: user.displayName, avatarUrl: user.avatarUrl, drinkId: myDrinkId }],
        playerIds: [uid],
        board: new Array(42).fill(0),
        currentTurn: uid,
        winnerId: null,
        isDraw: false,
        createdAt: Date.now(),
      };
      await setDoc(doc(db, "vierGames", code), game);
      setGameCode(code);
      setOnlineStep("waiting");

      // listen for 2nd player joining
      const unsub = onSnapshot(doc(db, "vierGames", code), (snap) => {
        if (!snap.exists()) return;
        const g = { gameId: snap.id, ...snap.data() } as VierGame;
        setWaitingGame(g);
        if (g.players.length >= 2) {
          unsubWaitRef.current = null;
          unsub();
          navigate("/vier/game", { state: { mode: "online", gameId: code, myDrinkId } });
        }
      });
      unsubWaitRef.current = unsub;
    } catch {
      setError("Erstellen fehlgeschlagen. Bitte nochmal versuchen.");
    } finally {
      setCreating(false);
    }
  }


  return (
    <div className="screen">
      <button className="btn btn-outline btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => navigate("/home")}>
        ‹ Spielauswahl
      </button>

      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #7C2D12 0%, #C2410C 100%)",
        borderRadius: "var(--radius)",
        padding: "20px",
        display: "flex", alignItems: "center", gap: 16,
      }}>
        <div style={{ fontSize: 44 }}>🍺</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>Vier4Bier</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "white" }}>Vier in einer Reihe</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn btn-outline btn-sm"
            style={{ width: 42, padding: 0, fontSize: 18, color: "rgba(255,255,255,0.8)", borderColor: "rgba(255,255,255,0.2)" }}
            onClick={() => navigate("/vier/results")}
            title="Ergebnisse"
          >🏆</button>
          <button
            className="btn btn-outline btn-sm"
            onClick={toggleFavorite}
            style={{ width: 42, padding: 0, fontSize: 18, color: isFavorite ? "var(--accent)" : "rgba(255,255,255,0.8)", borderColor: isFavorite ? "var(--accent)" : "rgba(255,255,255,0.2)" }}
          >
            {isFavorite ? "★" : "☆"}
          </button>
          <button
            className="btn btn-outline btn-sm"
            style={{ width: 42, padding: 0, fontSize: 18, color: "rgba(255,255,255,0.8)", borderColor: "rgba(255,255,255,0.2)" }}
            onClick={() => navigate("/vier/settings")}
            title="Einstellungen"
          >⚙️</button>
        </div>
      </div>

      {/* Step: Mode */}
      {step === "mode" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>Spielmodus wählen</div>

          <ModeCard
            emoji="🤖"
            title="Gegen KI"
            description="Spiel allein gegen den Computer"
            color="#C2410C"
            onClick={() => { setMode("ai"); setStep("drink"); }}
          />
          <ModeCard
            emoji="📱"
            title="Online – 2 Spieler"
            description="Spielt gemeinsam in Echtzeit"
            color="#0EA5E9"
            onClick={() => { setMode("online"); setStep("drink"); }}
          />
        </div>
      )}

      {/* Step: Drink */}
      {step === "drink" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <button
            className="btn btn-outline btn-sm"
            style={{ alignSelf: "flex-start" }}
            onClick={() => setStep("mode")}
          >
            ‹ Zurück
          </button>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>Wähle dein Getränk</div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 10,
          }}>
            {DRINK_ICONS.map(drink => (
              <button
                key={drink.id}
                onClick={() => setMyDrinkId(drink.id)}
                style={{
                  background: myDrinkId === drink.id ? `${drink.color}33` : "var(--surface)",
                  border: `2px solid ${myDrinkId === drink.id ? drink.color : "var(--border)"}`,
                  borderRadius: "var(--radius-sm)",
                  padding: "12px 8px",
                  cursor: "pointer",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                  transition: "all 0.15s",
                }}
              >
                <DrinkPiece drinkId={drink.id} size={44} />
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-sub)" }}>{drink.name}</span>
              </button>
            ))}
          </div>

          <button
            className="btn btn-primary"
            onClick={() => {
              if (mode === "ai") startVsAi();
              else setStep("lobby");
            }}
            style={{ background: "#C2410C", borderColor: "#C2410C" }}
          >
            {mode === "ai" ? "Spiel starten 🍺" : "Weiter →"}
          </button>
        </div>
      )}

      {/* Step: Online Lobby */}
      {step === "lobby" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <button
            className="btn btn-outline btn-sm"
            style={{ alignSelf: "flex-start" }}
            onClick={async () => {
              if (onlineStep === "waiting") { await cancelWaiting(); }
              else { setStep("drink"); }
            }}
          >
            ‹ Zurück
          </button>

          {onlineStep === "choose" && (
            <>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>Online-Spiel</div>

              {/* Create */}
              <div style={{
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: "var(--radius)", padding: 20, display: "flex", flexDirection: "column", gap: 12,
              }}>
                <div style={{ fontWeight: 700, color: "var(--text)" }}>Spiel erstellen</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  Erstelle ein Spiel und teile den Code mit deinem Gegner.
                </div>
                <button
                  className="btn btn-primary"
                  onClick={createOnlineGame}
                  disabled={creating}
                  style={{ background: "#C2410C", borderColor: "#C2410C" }}
                >
                  {creating ? "Erstelle…" : "Neues Spiel erstellen"}
                </button>
              </div>


              {error && <div style={{ color: "var(--danger)", fontSize: 13, textAlign: "center" }}>{error}</div>}
            </>
          )}

          {onlineStep === "waiting" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, paddingTop: 8 }}>
              <div style={{ fontWeight: 800, fontSize: 20, color: "var(--text)" }}>⏳ Warte auf Gegner…</div>

              {/* Spielcode */}
              <div style={{
                background: "var(--surface2)", borderRadius: "var(--radius)",
                padding: "16px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                width: "100%",
              }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>Spielcode</div>
                <div style={{ fontSize: 36, fontWeight: 900, color: "var(--accent)", letterSpacing: 6, fontFamily: "monospace" }}>
                  {gameCode}
                </div>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => navigator.clipboard.writeText(gameCode)}
                >
                  📋 Kopieren
                </button>
              </div>

              {/* QR-Code */}
              <div style={{
                background: "white", borderRadius: 12, padding: 12,
                boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
              }}>
                <QRCodeSVG
                  value={`${window.location.origin}/vier/lobby?join=${gameCode}`}
                  size={160}
                  bgColor="#ffffff"
                  fgColor="#0a1628"
                  level="M"
                />
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
                Gegner scannt den QR-Code oder gibt den Code ein
              </div>

              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <DrinkPiece drinkId={myDrinkId} size={40} />
                <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
                  {waitingGame?.players.length ?? 1} / 2 Spieler
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ModeCard({ emoji, title, description, color, onClick }: {
  emoji: string; title: string; description: string; color: string; onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "var(--surface)",
        border: `1.5px solid ${hovered ? color : color + "55"}`,
        borderRadius: "var(--radius)",
        padding: "20px",
        cursor: "pointer", textAlign: "left",
        transform: hovered ? "translateY(-2px)" : "none",
        transition: "all 0.15s",
        display: "flex", alignItems: "center", gap: 16,
      }}
    >
      <div style={{
        width: 56, height: 56, borderRadius: 16, fontSize: 28,
        background: `${color}22`, display: "flex", alignItems: "center", justifyContent: "center",
      }}>{emoji}</div>
      <div>
        <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{description}</div>
      </div>
      <div style={{ marginLeft: "auto", fontSize: 20, color: "var(--text-muted)" }}>›</div>
    </button>
  );
}
