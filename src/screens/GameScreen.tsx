import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, onSnapshot, updateDoc, arrayUnion, arrayRemove, deleteDoc } from "firebase/firestore";
import { QRCodeSVG } from "qrcode.react";
import { auth, db } from "../firebase";
import type { BingoGame, BingoPlayer } from "../types";
import { flatToGrid } from "./LobbyScreen";

const WEB_BASE_URL = "https://thebeachbingo.netlify.app";

function checkBingo(marked: number[], flatGrid: number[]): boolean {
  const grid = flatToGrid(flatGrid);
  const s = new Set(marked);
  for (let r = 0; r < 5; r++) {
    if (grid[r].every((n) => n === 0 || s.has(n))) return true;
  }
  for (let c = 0; c < 5; c++) {
    if (grid.every((row) => row[c] === 0 || s.has(row[c]))) return true;
  }
  if ([0,1,2,3,4].every((i) => grid[i][i] === 0 || s.has(grid[i][i]))) return true;
  if ([0,1,2,3,4].every((i) => grid[i][4-i] === 0 || s.has(grid[i][4-i]))) return true;
  return false;
}

function drawRandomNumber(drawn: number[]): number | null {
  const all = Array.from({ length: 75 }, (_, i) => i + 1);
  const remaining = all.filter((n) => !drawn.includes(n));
  if (remaining.length === 0) return null;
  return remaining[Math.floor(Math.random() * remaining.length)];
}

function countMarked(player: BingoPlayer, drawnNumbers: number[]): number {
  return player.card.grid.filter((n) => n !== 0 && drawnNumbers.includes(n)).length;
}

function Fireworks({ winner }: { winner: BingoPlayer }) {
  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.9)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      zIndex: 100, gap: 20,
    }}>
      <div style={{ fontSize: 100 }}>🎉</div>
      <div style={{ fontSize: 56 }}>{winner.avatarUrl}</div>
      <div style={{ fontSize: 32, fontWeight: 700, color: "#fff" }}>{winner.displayName}</div>
      <div style={{ fontSize: 22, color: "var(--accent)", fontWeight: 600 }}>BINGO! 🎊</div>
    </div>
  );
}

function EliminationOverlay({ name, avatar }: { name: string; avatar: string }) {
  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.88)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      zIndex: 100, gap: 16,
    }}>
      <div style={{ fontSize: 72 }}>💀</div>
      <div style={{ fontSize: 52 }}>{avatar}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: "#fff" }}>{name}</div>
      <div style={{ fontSize: 18, color: "var(--danger)", fontWeight: 600 }}>
        ist raus! 😬
      </div>
    </div>
  );
}

function QrShareCard({ gameId }: { gameId: string }) {
  const [tab, setTab] = useState<"android" | "web">("android");
  const webUrl = `${WEB_BASE_URL}/game/${gameId}`;

  return (
    <div className="card" style={{ textAlign: "center" }}>
      <div className="card-title" style={{ textAlign: "left" }}>Mitspieler einladen</div>

      {/* Tab-Leiste */}
      <div style={{
        display: "flex",
        background: "var(--surface2)",
        borderRadius: 10,
        padding: 4,
        marginBottom: 20,
        gap: 4,
      }}>
        {(["android", "web"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: "8px 0",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
              transition: "background 0.15s, color 0.15s",
              background: tab === t ? "var(--primary)" : "transparent",
              color: tab === t ? "#fff" : "var(--text-muted)",
            }}
          >
            {t === "android" ? "🤖 Android" : "🍎 iPhone / Web"}
          </button>
        ))}
      </div>

      {/* QR-Code */}
      <div style={{
        display: "inline-block",
        background: "#fff",
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
      }}>
        <QRCodeSVG
          value={tab === "android" ? gameId : webUrl}
          size={180}
          bgColor="#ffffff"
          fgColor="#0a1628"
          level="M"
        />
      </div>

      {tab === "android" ? (
        <>
          <div style={{
            background: "var(--surface2)",
            borderRadius: "var(--radius-sm)",
            padding: "12px 16px",
            fontFamily: "monospace",
            fontSize: 15,
            letterSpacing: 1,
            wordBreak: "break-all",
            marginBottom: 8,
          }}>
            {gameId}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            QR-Code scannen oder Code in der App eingeben
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>
            QR-Code mit iPhone scannen — öffnet BeachBingo direkt im Browser
          </div>
          <div style={{ fontSize: 12, color: "var(--primary)", marginTop: 4 }}>
            {webUrl}
          </div>
        </>
      )}
    </div>
  );
}

export default function GameScreen() {
  const { gameId } = useParams<{ gameId: string }>();
  const [game, setGame] = useState<BingoGame | null>(null);
  const navigate = useNavigate();
  const uid = auth.currentUser?.uid;
  const drumRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elimRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!gameId) return;
    return onSnapshot(doc(db, "games", gameId), (snap) => {
      if (!snap.exists()) { navigate("/lobby"); return; }
      setGame({ gameId: snap.id, ...snap.data() } as BingoGame);
    });
  }, [gameId, navigate]);

  // Elimination abschließen nach Animation
  useEffect(() => {
    if (!game || !gameId) return;
    if (!game.eliminationAnimationActive || !game.eliminationPendingPlayerId) return;

    elimRef.current = setTimeout(async () => {
      const eliminatedId = game.eliminationPendingPlayerId!;
      const remaining = game.players.filter((p) => p.userId !== eliminatedId);

      if (remaining.length === 1) {
        const updatedPlayers = remaining.map((p) => ({ ...p, hasBingo: true }));
        await updateDoc(doc(db, "games", gameId), {
          players: updatedPlayers,
          playerIds: arrayRemove(eliminatedId),
          status: "FINISHED",
          eliminationAnimationActive: false,
          eliminationPendingPlayerId: null,
        });
      } else {
        await updateDoc(doc(db, "games", gameId), {
          players: remaining,
          playerIds: arrayRemove(eliminatedId),
          eliminationAnimationActive: false,
          eliminationPendingPlayerId: null,
        });
      }
    }, 3000);

    return () => { if (elimRef.current) clearTimeout(elimRef.current); };
  }, [game?.eliminationAnimationActive, game?.eliminationPendingPlayerId, gameId]);

  if (!game || !uid) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
      <span style={{ fontSize: 48 }}>⏳</span>
    </div>
  );

  const me = game.players.find((p) => p.userId === uid);
  const isAdmin = game.adminId === uid;
  const winner = game.players.find((p) => p.hasBingo);
  const isBossLevel = game.gameMode === "BOSS_LEVEL";
  const isEliminated = isBossLevel && !game.players.find((p) => p.userId === uid);

  async function startGame() {
    if (!gameId) return;
    await updateDoc(doc(db, "games", gameId), { status: "RUNNING" });
  }

  async function drawNumber() {
    if (!gameId || !game) return;
    if (game.eliminationAnimationActive) return;

    const nextCount = game.totalDrawCount + 1;

    const doUpdate = async (n: number) => {
      const newDrawn = [...game.drawnNumbers, n];
      const updates: Record<string, unknown> = {
        drawnNumbers: arrayUnion(n),
        currentNumber: n,
        totalDrawCount: nextCount,
        drawAnimationActive: false,
      };

      // Boss Level: Elimination prüfen
      if (isBossLevel && nextCount % game.eliminationInterval === 0 && game.players.length > 1) {
        const loser = game.players.reduce((worst, p) =>
          countMarked(p, newDrawn) < countMarked(worst, newDrawn) ? p : worst
        );
        updates.eliminationPendingPlayerId = loser.userId;
        updates.eliminationAnimationActive = true;
        updates.eliminationPlayerName = loser.displayName;
        updates.eliminationPlayerAvatar = loser.avatarUrl;
        updates.eliminationNumber = n;
      }

      await updateDoc(doc(db, "games", gameId), updates);
    };

    if (game.drawStyle === "DRUM") {
      await updateDoc(doc(db, "games", gameId), { drawAnimationActive: true });
      drumRef.current = setTimeout(async () => {
        const n = drawRandomNumber(game.drawnNumbers);
        if (n === null) return;
        await doUpdate(n);
      }, 3000);
    } else {
      const n = drawRandomNumber(game.drawnNumbers);
      if (n === null) return;
      await doUpdate(n);
    }
  }

  async function markNumber(n: number) {
    if (!gameId || !game || !me || n === 0) return;
    if (game.gameMode === "AUTO_MARK") return;
    if (!game.drawnNumbers.includes(n)) return;
    if (me.card.markedNumbers.includes(n)) return;
    const newMarked = [...me.card.markedNumbers, n];
    const hasBingo = checkBingo(newMarked, me.card.grid);
    const updatedPlayers = game.players.map((p) =>
      p.userId === uid ? { ...p, card: { ...p.card, markedNumbers: newMarked }, hasBingo } : p
    );
    await updateDoc(doc(db, "games", gameId), { players: updatedPlayers });
    if (hasBingo) {
      await updateDoc(doc(db, "games", gameId), { status: "FINISHED" });
    }
  }

  async function claimBingo() {
    if (!gameId || !game || !me) return;
    const hasBingo = checkBingo(game.drawnNumbers, me.card.grid);
    if (!hasBingo) { alert("Noch kein Bingo! 😅"); return; }
    const updatedPlayers = game.players.map((p) =>
      p.userId === uid ? { ...p, hasBingo: true } : p
    );
    await updateDoc(doc(db, "games", gameId), { players: updatedPlayers, status: "FINISHED" });
  }

  async function deleteGame() {
    if (!gameId || !confirm("Spiel wirklich löschen?")) return;
    await deleteDoc(doc(db, "games", gameId));
    navigate("/lobby");
  }

  // ── LOBBY ────────────────────────────────────────────
  if (game.status === "LOBBY") {
    return (
      <div className="screen">
        <div className="flex items-center justify-between">
          <button className="btn btn-outline btn-sm" onClick={() => navigate("/lobby")}>
            ‹ Zurück
          </button>
          <h2>Lobby</h2>
          <div style={{ width: 80 }} />
        </div>

        <QrShareCard gameId={gameId!} />

        <div className="card">
          <div className="card-title">Spieler ({game.players.length})</div>
          <div className="flex flex-col gap-2">
            {game.players.map((p) => (
              <div key={p.userId} className="flex items-center" style={{ gap: 12, padding: "6px 0" }}>
                <span style={{ fontSize: 28 }}>{p.avatarUrl}</span>
                <span style={{ fontWeight: 600 }}>{p.displayName}</span>
                {p.userId === game.adminId && (
                  <span className="badge badge-running" style={{ marginLeft: "auto" }}>Admin</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-title">Einstellungen</div>
          <div className="flex" style={{ gap: 10, flexWrap: "wrap" }}>
            <span className="badge badge-lobby">
              {game.gameMode === "AUTO_MARK" ? "🌊 Rookie" : game.gameMode === "MANUAL_MARK" ? "🎯 Sniper" : "💪 Boss Level"}
            </span>
            <span className="badge badge-lobby">
              {game.drawStyle === "DRUM" ? "🥁 Lostrommel" : "⚡ Sofort"}
            </span>
            {isBossLevel && (
              <span className="badge badge-lobby">
                💀 Elimination alle {game.eliminationInterval} Züge
              </span>
            )}
          </div>
        </div>

        {isAdmin && (
          <div className="flex flex-col gap-2">
            <button className="btn btn-accent" onClick={startGame} disabled={game.players.length < 1}>
              🎮 Spiel starten
            </button>
            <button
              className="btn btn-outline"
              style={{ color: "var(--danger)", borderColor: "rgba(239,68,68,0.3)" }}
              onClick={deleteGame}
            >
              Spiel löschen
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── FINISHED ─────────────────────────────────────────
  if (game.status === "FINISHED" && winner) {
    return (
      <div className="screen justify-center text-center">
        <Fireworks winner={winner} />
        <div style={{ position: "relative", zIndex: 101, marginTop: "60vh" }}>
          <button className="btn btn-accent" style={{ maxWidth: 240, margin: "0 auto" }} onClick={() => navigate("/lobby")}>
            Super! 🎉
          </button>
        </div>
      </div>
    );
  }

  // ── RUNNING ──────────────────────────────────────────
  const autoMark = game.gameMode === "AUTO_MARK";
  const displayedMarked = autoMark ? game.drawnNumbers : (me?.card.markedNumbers || []);

  // Nächste Elimination in X Zügen (Boss Level)
  const nextElimIn = isBossLevel && game.eliminationInterval > 0
    ? game.eliminationInterval - (game.totalDrawCount % game.eliminationInterval)
    : null;

  return (
    <div className="screen">
      {winner && <Fireworks winner={winner} />}
      {game.eliminationAnimationActive && game.eliminationPlayerName && (
        <EliminationOverlay
          name={game.eliminationPlayerName}
          avatar={game.eliminationPlayerAvatar || "👤"}
        />
      )}

      {/* Eliminiert-Banner */}
      {isEliminated && (
        <div style={{
          background: "var(--danger-bg)",
          border: "1px solid var(--danger)",
          borderRadius: "var(--radius)",
          padding: "16px 20px",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 32, marginBottom: 6 }}>💀</div>
          <div style={{ fontWeight: 700, color: "var(--danger)" }}>Du wurdest eliminiert!</div>
          <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
            Du kannst das Spiel noch beobachten.
          </div>
        </div>
      )}

      {/* Aktuelle Zahl */}
      <div className="card text-center">
        {game.drawAnimationActive ? (
          <>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>🥁 Ziehe Zahl…</div>
            <div style={{
              fontSize: 80, fontWeight: 800, color: "var(--accent)",
              animation: "pulse 0.5s infinite", lineHeight: 1,
            }}>
              {Math.floor(Math.random() * 75) + 1}
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>Aktuelle Zahl</div>
            <div style={{ fontSize: 88, fontWeight: 800, color: "var(--primary)", lineHeight: 1 }}>
              {game.currentNumber ?? "–"}
            </div>
          </>
        )}

        {isBossLevel && nextElimIn !== null && !game.eliminationAnimationActive && (
          <div style={{
            marginTop: 10, fontSize: 13,
            color: nextElimIn <= 2 ? "var(--danger)" : "var(--text-muted)",
          }}>
            💀 Nächste Elimination in {nextElimIn} Zug{nextElimIn !== 1 ? "en" : ""}
          </div>
        )}

        {isAdmin && (
          <button
            className="btn btn-primary"
            style={{ marginTop: 16, maxWidth: 240, margin: "16px auto 0" }}
            onClick={drawNumber}
            disabled={game.drawAnimationActive || game.eliminationAnimationActive}
          >
            Zahl ziehen
          </button>
        )}
      </div>

      {/* Bingo-Karte */}
      {me && !isEliminated && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 16 }}>Deine Karte</div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, marginBottom: 6 }}>
            {["B","I","N","G","O"].map((l) => (
              <div key={l} style={{
                textAlign: "center", fontWeight: 800,
                color: "var(--accent)", fontSize: 20, letterSpacing: 2,
              }}>{l}</div>
            ))}
          </div>

          {flatToGrid(me.card.grid).map((row, r) => (
            <div key={r} style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, marginBottom: 6 }}>
              {row.map((n, c) => {
                const isFree     = n === 0;
                const isMarked   = isFree || displayedMarked.includes(n);
                const isDrawn    = game.drawnNumbers.includes(n);
                const isClickable = !autoMark && isDrawn && !isFree && !isMarked;
                return (
                  <button
                    key={c}
                    onClick={() => markNumber(n)}
                    disabled={autoMark || isFree || !isClickable}
                    style={{
                      aspectRatio: "1",
                      borderRadius: 10,
                      border: isDrawn && !isMarked && !isFree ? "2px solid var(--primary)" : "2px solid transparent",
                      background: isFree
                        ? "var(--accent)"
                        : isMarked ? "var(--primary)" : "var(--surface2)",
                      color: isMarked || isFree ? "#fff" : isDrawn ? "var(--primary)" : "var(--text-sub)",
                      fontWeight: isMarked ? 800 : 500,
                      fontSize: 18,
                      cursor: isClickable ? "pointer" : "default",
                      opacity: (!isDrawn && !isFree && !isMarked) ? 0.45 : 1,
                      transition: "background 0.15s",
                    }}
                  >
                    {isFree ? "⭐" : n}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* BINGO-Button (AUTO_MARK) */}
      {autoMark && !isEliminated && (
        <button
          className="btn btn-accent"
          style={{ fontSize: 20, padding: "20px", fontWeight: 800, letterSpacing: 1 }}
          onClick={claimBingo}
        >
          🎉 BINGO!
        </button>
      )}

      {/* Spielerliste (Boss Level) */}
      {isBossLevel && (
        <div className="card">
          <div className="card-title">Noch im Spiel ({game.players.length})</div>
          <div className="flex flex-col gap-2">
            {game.players.map((p) => (
              <div key={p.userId} className="flex items-center" style={{ gap: 10 }}>
                <span style={{ fontSize: 22 }}>{p.avatarUrl}</span>
                <span style={{ fontWeight: p.userId === uid ? 700 : 400 }}>{p.displayName}</span>
                <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--text-muted)" }}>
                  {countMarked(p, game.drawnNumbers)} Treffer
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gezogene Zahlen */}
      <div className="card">
        <div className="card-title">
          Gezogene Zahlen ({game.drawnNumbers.length})
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {game.drawnNumbers.map((n) => (
            <span
              key={n}
              style={{
                background: n === game.currentNumber ? "var(--accent)" : "var(--surface2)",
                color: n === game.currentNumber ? "#000" : "var(--text-sub)",
                borderRadius: 8,
                padding: "5px 10px",
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              {n}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
