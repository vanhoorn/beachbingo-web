import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, onSnapshot, updateDoc, arrayUnion, arrayRemove, deleteDoc, addDoc, collection } from "firebase/firestore";
import { QRCodeSVG } from "qrcode.react";
import { auth, db } from "../firebase";
import type { BingoGame, BingoPlayer } from "../types";
import { flatToGrid } from "./LobbyScreen";
import { GameHudBar, QuitConfirmDialog } from "../components/GameHudBar";
import { audioManager } from "../audio/AudioManager";

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

function DrumAnimation() {
  const [displayNum, setDisplayNum] = useState(() => Math.floor(Math.random() * 75) + 1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tick = useCallback(() => {
    setDisplayNum(Math.floor(Math.random() * 75) + 1);
  }, []);

  useEffect(() => {
    intervalRef.current = setInterval(tick, 120);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [tick]);

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>🥁 Ziehe…</div>
      <div className="drum-wrapper">
        <div className="drum-outer">
          <div className="drum-stripe" />
        </div>
        <div className="drum-inner-ring" />
        <div className="drum-ball">
          <span className="drum-ball-number">{displayNum}</span>
        </div>
      </div>
    </div>
  );
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

function EliminationOverlay({ name, avatar, number }: { name: string; avatar: string; number: number }) {
  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.88)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      zIndex: 100, gap: 16,
    }}>
      <div style={{ fontSize: 72 }}>😈</div>
      <div style={{ fontSize: 52 }}>{avatar}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: "#fff" }}>{name}</div>
      <div style={{ fontSize: 18, color: "var(--danger)", fontWeight: 600 }}>
        wirft die <strong style={{ fontSize: 24 }}>{number}</strong> zurück in die Lostrommel! 🎒
      </div>
    </div>
  );
}

function EliminationDialog({ drawnNumbers, onEliminate }: { drawnNumbers: number[]; onEliminate: (n: number) => void }) {
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200,
    }}>
      <div style={{
        background: "var(--surface)", borderRadius: "var(--radius)", padding: 24,
        maxWidth: 360, width: "90%", display: "flex", flexDirection: "column", gap: 16,
      }}>
        <div style={{ textAlign: "center", fontSize: 40 }}>😈</div>
        <div style={{ fontWeight: 700, color: "var(--danger)", textAlign: "center", fontSize: 18 }}>Du bist dran!</div>
        <div style={{ fontSize: 14, color: "var(--text-sub)" }}>
          Wähle eine Zahl, die zurück in die Lostrommel geworfen wird:
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {[...drawnNumbers].sort((a, b) => a - b).map(n => (
            <button key={n} onClick={() => setSelected(n)} style={{
              width: 44, height: 44, borderRadius: "50%", border: "none",
              background: selected === n ? "var(--danger)" : "var(--surface2)",
              color: selected === n ? "#fff" : "var(--text-sub)",
              fontWeight: 700, fontSize: 14, cursor: "pointer",
            }}>{n}</button>
          ))}
        </div>
        <button
          className="btn btn-primary"
          style={{ background: "var(--danger)", border: "none" }}
          disabled={selected === null}
          onClick={() => selected !== null && onEliminate(selected)}
        >
          Zurückwerfen! 😈
        </button>
      </div>
    </div>
  );
}

function QrShareCard({ gameId }: { gameId: string }) {
  const [tab, setTab] = useState<"android" | "web">("android");
  const webUrl = `${window.location.origin}/game/${gameId}`;

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
  const [showQuitDialog, setShowQuitDialog] = useState(false);

  useEffect(() => {
    if (!gameId) return;
    return onSnapshot(doc(db, "games", gameId), (snap) => {
      if (!snap.exists()) { navigate("/lobby"); return; }
      const data = snap.data() as Record<string, unknown>;
      if (data.players && !Array.isArray(data.players)) {
        data.players = Object.values(data.players as Record<string, unknown>);
      }
      setGame({ gameId: snap.id, ...data } as BingoGame);
    });
  }, [gameId, navigate]);

  useEffect(() => {
    if (game?.status !== "RUNNING") return;
    audioManager.startMusic("bingo");
    return () => audioManager.stopMusic();
  }, [game?.status]);

  // Elimination-Animation nach 3s ausblenden
  useEffect(() => {
    if (!game || !gameId) return;
    if (!game.eliminationAnimationActive) return;

    elimRef.current = setTimeout(async () => {
      await updateDoc(doc(db, "games", gameId), {
        eliminationAnimationActive: false,
      });
    }, 3000);

    return () => { if (elimRef.current) clearTimeout(elimRef.current); };
  }, [game?.eliminationAnimationActive, gameId]);

  if (!game || !uid) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
      <span style={{ fontSize: 48 }}>⏳</span>
    </div>
  );

  const me = game.players.find((p) => p.userId === uid);
  const isAdmin = game.adminId === uid;
  const winner = game.players.find((p) => p.hasBingo);
  const isBossLevel = game.gameMode === "BOSS_LEVEL" || game.gameMode === "MINI_BOSS_LEVEL";
  const isMiniBossLevel = game.gameMode === "MINI_BOSS_LEVEL";
  const isMyElimination = isBossLevel && game.eliminationPendingPlayerId === uid && !game.eliminationAnimationActive;

  async function startGame() {
    if (!gameId) return;
    await updateDoc(doc(db, "games", gameId), { status: "RUNNING" });
  }

  async function drawNumber() {
    if (!gameId || !game) return;
    if (game.eliminationAnimationActive) return;

    const nextCount = game.totalDrawCount + 1;

    const doUpdate = async (n: number) => {
      const updates: Record<string, unknown> = {
        drawnNumbers: arrayUnion(n),
        currentNumber: n,
        totalDrawCount: nextCount,
        drawAnimationActive: false,
      };

      // Boss Level: Elimination prüfen
      if (isBossLevel && nextCount % game.eliminationInterval === 0 && game.players.length > 1) {
        const randomPlayer = game.players[Math.floor(Math.random() * game.players.length)];
        updates.eliminationPendingPlayerId = randomPlayer.userId;
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
    await updateDoc(doc(db, "games", gameId), {
      [`players.${uid}.card.markedNumbers`]: newMarked,
      [`players.${uid}.hasBingo`]: hasBingo,
    });
    if (hasBingo) {
      await updateDoc(doc(db, "games", gameId), { status: "FINISHED" });
      await addDoc(collection(db, "gameResults"), {
        winnerId: uid,
        winnerName: me.displayName,
        winnerAvatar: me.avatarUrl,
        playerIds: game.playerIds,
        playerNames: game.players.map((p) => p.displayName),
        playerAvatars: game.players.map((p) => p.avatarUrl),
        drawnNumbersCount: game.drawnNumbers.length,
        finishedAt: Date.now(),
      });
    }
  }

  async function claimBingo() {
    if (!gameId || !game || !me) return;
    const hasBingo = checkBingo(game.drawnNumbers, me.card.grid);
    if (!hasBingo) { alert("Noch kein Bingo! 😅"); return; }
    await updateDoc(doc(db, "games", gameId), {
      [`players.${uid}.hasBingo`]: true,
      status: "FINISHED",
    });
    await addDoc(collection(db, "gameResults"), {
      winnerId: uid,
      winnerName: me.displayName,
      winnerAvatar: me.avatarUrl,
      playerIds: game.playerIds,
      playerNames: game.players.map((p) => p.displayName),
      playerAvatars: game.players.map((p) => p.avatarUrl),
      drawnNumbersCount: game.drawnNumbers.length,
      finishedAt: Date.now(),
    });
  }

  async function eliminateNumber(number: number) {
    if (!gameId || !game) return;
    const pendingId = game.eliminationPendingPlayerId;
    if (!pendingId) return;
    const eliminator = game.players.find((p) => p.userId === pendingId);
    const updates: Record<string, unknown> = {
      drawnNumbers: arrayRemove(number),
      currentNumber: game.currentNumber === number ? null : game.currentNumber,
      eliminationPendingPlayerId: null,
      eliminationAnimationActive: true,
      eliminationPlayerName: eliminator?.displayName || "",
      eliminationPlayerAvatar: eliminator?.avatarUrl || "",
      eliminationNumber: number,
    };
    // Remove eliminated number from each player's markedNumbers via field path
    // to preserve the Map structure Android relies on.
    for (const p of game.players) {
      if (p.card.markedNumbers.includes(number)) {
        updates[`players.${p.userId}.card.markedNumbers`] = p.card.markedNumbers.filter((n) => n !== number);
      }
    }
    await updateDoc(doc(db, "games", gameId), updates);
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
          <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>Einstellungen</div>
            {!isAdmin && (
              <span style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                👑 vom Spielleiter
              </span>
            )}
          </div>
          <div className="flex" style={{ gap: 10, flexWrap: "wrap" }}>
            <span className="badge badge-lobby">
              {game.gameMode === "AUTO_MARK" ? "🌊 Rookie" : game.gameMode === "MANUAL_MARK" ? "🎯 Sniper" : game.gameMode === "MINI_BOSS_LEVEL" ? "🔵 Mini Boss Level" : "💪 Boss Level"}
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
  const highlightDrawn = isMiniBossLevel || game.gameMode === "MANUAL_MARK";
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
          number={game.eliminationNumber || 0}
        />
      )}
      {isMyElimination && (
        <EliminationDialog
          drawnNumbers={game.drawnNumbers}
          onEliminate={eliminateNumber}
        />
      )}

      {/* Header mit Zurück */}
      <div className="flex items-center justify-between">
        <button className="btn btn-outline btn-sm" onClick={() => navigate("/lobby")}>
          ‹ Lobby
        </button>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
          {game.players.length} Spieler · {
            game.gameMode === "AUTO_MARK" ? "🌊 Rookie" :
            game.gameMode === "MANUAL_MARK" ? "🎯 Sniper" :
            game.gameMode === "MINI_BOSS_LEVEL" ? "🔵 Mini Boss Level" : "💪 Boss Level"
          }
        </span>
      </div>

      {/* Aktuelle Zahl */}
      <div className="card text-center">
        {game.drawAnimationActive ? (
          <DrumAnimation />
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
            disabled={game.drawAnimationActive || game.eliminationAnimationActive || !!game.eliminationPendingPlayerId}
          >
            Zahl ziehen
          </button>
        )}
      </div>

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

      {/* Bingo-Karte */}
      {me && (
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
                      border: highlightDrawn && isDrawn && !isMarked && !isFree ? "2px solid var(--primary)" : "2px solid transparent",
                      background: isFree
                        ? "var(--accent)"
                        : isMarked ? "var(--primary)" : "var(--surface2)",
                      color: isMarked || isFree ? "#fff" : (highlightDrawn && isDrawn) ? "var(--primary)" : "var(--text-sub)",
                      fontWeight: isMarked ? 800 : 500,
                      fontSize: 18,
                      cursor: isClickable ? "pointer" : "default",
                      opacity: (highlightDrawn && !isDrawn && !isFree && !isMarked) ? 0.45 : 1,
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
      {autoMark && (
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

      {/* HUD bar */}
      {game.status === "RUNNING" && (
        <GameHudBar
          paused={false}
          onPauseToggle={() => {}}
          onQuit={() => setShowQuitDialog(true)}
          pauseDisabled={true}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
            {game.players.length} Spieler · {game.drawnNumbers.length} Zahlen
          </div>
        </GameHudBar>
      )}

      {showQuitDialog && (
        <QuitConfirmDialog
          message="Du verlässt das Spiel."
          onConfirm={() => navigate("/lobby")}
          onDismiss={() => setShowQuitDialog(false)}
        />
      )}

    </div>
  );
}
