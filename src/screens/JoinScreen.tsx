import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";
import jsQR from "jsqr";
import { auth, db } from "../firebase";
import type { BingoGame, PongGame, PongPlayer, PongSide, VierGame, User, BrandungGame, MeermauGame } from "../types";
import { DRINK_ICONS } from "./vier/drinkIcons";

// ── helpers to generate a bingo card (same as LobbyScreen) ──────────────────
function generateCard(): number[] {
  const cols: number[][] = [];
  const ranges = [[1,15],[16,30],[31,45],[46,60],[61,75]];
  for (let col = 0; col < 5; col++) {
    const [min, max] = ranges[col];
    const nums: number[] = [];
    while (nums.length < 5) {
      const n = Math.floor(Math.random() * (max - min + 1)) + min;
      if (!nums.includes(n)) nums.push(n);
    }
    cols.push(nums);
  }
  const flat: number[] = [];
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 5; c++)
      flat.push(cols[c][r]);
  flat[12] = 0;
  return flat;
}

function sidesForPaddles(total: number): PongSide[] {
  if (total === 2) return ["left", "right"];
  if (total === 3) return ["left", "right", "top"];
  return ["left", "right", "top", "bottom"];
}

type ScanState = "idle" | "scanning" | "loading" | "error";

export default function JoinScreen() {
  const navigate = useNavigate();
  const uid  = auth.currentUser?.uid ?? "";

  const [code,      setCode]      = useState("");
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [errorMsg,  setErrorMsg]  = useState("");
  const [cameraOn,  setCameraOn]  = useState(false);

  const videoRef   = useRef<HTMLVideoElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);
  const rafRef     = useRef<number>(0);
  const userRef    = useRef<User | null>(null);

  // Load user profile once
  useEffect(() => {
    if (!uid) return;
    getDoc(doc(db, "users", uid)).then((snap) => {
      if (snap.exists()) userRef.current = snap.data() as User;
    });
  }, [uid]);

  // Stop camera on unmount
  useEffect(() => {
    return () => stopCamera();
  }, []);

  // ── Camera ───────────────────────────────────────────────────────────────

  async function startCamera() {
    setErrorMsg("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraOn(true);
      scanFrame();
    } catch {
      setErrorMsg("Kamera nicht verfügbar. Bitte Code manuell eingeben.");
    }
  }

  function stopCamera() {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }

  function scanFrame() {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(scanFrame);
      return;
    }
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const qr = jsQR(imageData.data, imageData.width, imageData.height);
    if (qr?.data) {
      const scanned = qr.data.trim();
      stopCamera();
      // The QR code may be a gameId directly or a URL containing the gameId
      const match = scanned.match(/[A-Za-z0-9]{20,}/);
      const gameId = match ? match[0] : scanned;
      setCode(gameId);
      joinWithCode(gameId);
    } else {
      rafRef.current = requestAnimationFrame(scanFrame);
    }
  }

  // ── Join logic ────────────────────────────────────────────────────────────

  async function handleJoin() {
    const trimmed = code.trim();
    if (!trimmed) return;
    await joinWithCode(trimmed);
  }

  async function joinWithCode(rawCode: string) {
    const user = userRef.current;
    if (!user || !uid) { setErrorMsg("Nicht angemeldet."); return; }
    setScanState("loading");
    setErrorMsg("");

    // Try all collections in parallel
    const [bingoSnap, pongSnap, vierSnap, brandungSnap, meermauSnap] = await Promise.all([
      getDoc(doc(db, "games",         rawCode)),
      getDoc(doc(db, "pongGames",     rawCode)),
      getDoc(doc(db, "vierGames",     rawCode)),
      getDoc(doc(db, "brandungGames", rawCode)),
      getDoc(doc(db, "meermauGames",  rawCode)),
    ]);

    try {
      if (bingoSnap.exists()) {
        await joinBingo(rawCode, bingoSnap.data() as BingoGame, user);
      } else if (pongSnap.exists()) {
        await joinPong(rawCode, { gameId: pongSnap.id, ...pongSnap.data() } as PongGame, user);
      } else if (vierSnap.exists()) {
        await joinVier(rawCode, { gameId: vierSnap.id, ...vierSnap.data() } as VierGame, user);
      } else if (brandungSnap.exists()) {
        await joinBrandung(rawCode, { gameId: rawCode, ...brandungSnap.data() } as BrandungGame, user);
      } else if (meermauSnap.exists()) {
        await joinMeerMau(rawCode, { gameId: rawCode, ...meermauSnap.data() } as MeermauGame, user);
      } else {
        setErrorMsg("Kein Spiel mit diesem Code gefunden.");
        setScanState("error");
      }
    } catch {
      setErrorMsg("Beitreten fehlgeschlagen. Bitte nochmal versuchen.");
      setScanState("error");
    }
  }

  async function joinBingo(code: string, game: BingoGame, user: User) {
    if (game.status === "FINISHED") { setErrorMsg("Dieses Spiel ist bereits beendet."); setScanState("error"); return; }
    if (game.playerIds.includes(uid)) { navigate(`/game/${code}`); return; }
    const card = generateCard();
    await updateDoc(doc(db, "games", code), {
      playerIds: arrayUnion(uid),
      [`players.${uid}`]: {
        userId: uid, displayName: user.displayName, avatarUrl: user.avatarUrl,
        card: { grid: card, markedNumbers: [] as number[] }, hasBingo: false,
      },
    });
    navigate(`/game/${code}`);
  }

  async function joinPong(code: string, game: PongGame, user: User) {
    if (game.status !== "LOBBY")              { setErrorMsg("Dieses Spiel läuft bereits."); setScanState("error"); return; }
    if (game.players.length >= game.humanCount) { setErrorMsg("Das Spiel ist voll."); setScanState("error"); return; }
    if (game.playerIds.includes(uid)) {
      navigate("/pong/game", { state: buildPongState(game, game.adminId === uid) });
      return;
    }
    const takenSides = game.players.map((p) => p.side);
    const freeSide   = sidesForPaddles(game.totalPaddles).find((s) => !takenSides.includes(s)) ?? "right";
    const player: PongPlayer = { userId: uid, displayName: user.displayName, avatarUrl: user.avatarUrl, side: freeSide };
    await updateDoc(doc(db, "pongGames", code), {
      players:   arrayUnion(player),
      playerIds: arrayUnion(uid),
    });
    navigate("/pong/game", { state: buildPongState({ ...game, players: [...game.players, player] }, false) });
  }

  function buildPongState(game: PongGame, asHost: boolean) {
    const me = game.players.find((p) => p.userId === uid);
    return {
      totalPaddles: game.totalPaddles, humanCount: game.humanCount,
      difficulty: game.difficulty, scoreLimit: game.scoreLimit,
      gameId: game.gameId, isHost: asHost, mySide: me?.side ?? "right",
      guestSides: game.players.filter((p) => p.userId !== uid).map((p) => p.side),
    };
  }

  async function joinBrandung(code: string, game: BrandungGame, user: User) {
    if (game.status === "FINISHED") { setErrorMsg("Dieses Spiel ist bereits beendet."); setScanState("error"); return; }
    if (game.playerIds.includes(uid)) { navigate("/brandung/game", { state: { mode: "online", gameId: code } }); return; }
    if (Object.keys(game.players).length >= 6) { setErrorMsg("Das Spiel ist voll (max. 6 Spieler)."); setScanState("error"); return; }
    await updateDoc(doc(db, "brandungGames", code), {
      playerIds: arrayUnion(uid),
      [`players.${uid}`]: { userId: uid, displayName: user.displayName, avatarUrl: user.avatarUrl, hand: [], lives: 3, eliminated: false, isAI: false },
    });
    navigate("/brandung/game", { state: { mode: "online", gameId: code } });
  }

  async function joinMeerMau(code: string, game: MeermauGame, user: User) {
    if (game.status === "FINISHED") { setErrorMsg("Dieses Spiel ist bereits beendet."); setScanState("error"); return; }
    if (game.status === "RUNNING")  { setErrorMsg("Das Spiel läuft bereits."); setScanState("error"); return; }
    if (game.playerIds.includes(uid)) { navigate("/meermau/game", { state: { mode: "online", gameId: code } }); return; }
    if (game.playerIds.length >= 4) { setErrorMsg("Das Spiel ist voll (max. 4 Spieler)."); setScanState("error"); return; }
    await updateDoc(doc(db, "meermauGames", code), {
      playerIds: arrayUnion(uid),
      [`players.${uid}`]: { userId: uid, displayName: user.displayName, avatarUrl: user.avatarUrl, hand: [], totalScore: 0, eliminated: false, isAI: false as const },
    });
    navigate("/meermau/game", { state: { mode: "online", gameId: code } });
  }

  async function joinVier(code: string, game: VierGame, user: User) {
    if (game.status !== "LOBBY")        { setErrorMsg("Dieses Spiel läuft bereits."); setScanState("error"); return; }
    if (game.players.length >= 2)       { setErrorMsg("Das Spiel ist voll."); setScanState("error"); return; }
    if (game.playerIds.includes(uid))   { navigate("/vier/game", { state: { mode: "online", gameId: code, myDrinkId: game.players.find(p => p.userId === uid)?.drinkId } }); return; }
    const takenDrinks = game.players.map((p) => p.drinkId);
    const defaultDrinkId = DRINK_ICONS[0].id;
    const myDrinkId = takenDrinks.includes(defaultDrinkId)
      ? (DRINK_ICONS.find((d) => !takenDrinks.includes(d.id))?.id ?? defaultDrinkId)
      : defaultDrinkId;
    await updateDoc(doc(db, "vierGames", code), {
      playerIds: arrayUnion(uid),
      players: [...game.players, { userId: uid, displayName: user.displayName, avatarUrl: user.avatarUrl, drinkId: myDrinkId }],
      status: "RUNNING",
    });
    navigate("/vier/game", { state: { mode: "online", gameId: code, myDrinkId } });
  }

  const isLoading = scanState === "loading";

  return (
    <div className="screen" style={{ gap: 0, paddingTop: 0 }}>

      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, var(--surface) 0%, var(--surface2) 100%)",
        padding: "28px 20px 24px",
        display: "flex", alignItems: "center", gap: 14,
      }}>
        <button
          onClick={() => navigate("/home")}
          style={{ background: "none", border: "none", color: "var(--primary)", fontSize: 15, fontWeight: 700, cursor: "pointer", padding: 0 }}
        >
          ‹ Zurück
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 2 }}>
            BeachBande
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)" }}>
            Spiel beitreten
          </div>
        </div>
      </div>

      <div style={{ padding: "24px 20px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* QR Scanner */}
        <div style={{
          background: "var(--surface)",
          border: "1.5px solid var(--border)",
          borderRadius: "var(--radius)",
          overflow: "hidden",
        }}>
          <div style={{ padding: "18px 20px 14px", borderBottom: cameraOn ? "1px solid var(--border)" : "none" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>📷 QR-Code scannen</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Halte die Kamera auf den QR-Code des Gastgebers
            </div>
          </div>

          {/* Camera viewfinder */}
          {cameraOn && (
            <div style={{ position: "relative", background: "#000", maxHeight: 280, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <video ref={videoRef} playsInline muted style={{ width: "100%", maxHeight: 280, objectFit: "cover", display: "block" }} />
              {/* Scan overlay */}
              <div style={{
                position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none",
              }}>
                <div style={{
                  width: 180, height: 180,
                  border: "2.5px solid var(--primary)",
                  borderRadius: 16,
                  boxShadow: "0 0 0 2000px rgba(0,0,0,0.45)",
                }} />
              </div>
            </div>
          )}
          <canvas ref={canvasRef} style={{ display: "none" }} />

          <div style={{ padding: "14px 20px 18px" }}>
            {!cameraOn ? (
              <button
                onClick={startCamera}
                className="btn btn-primary"
                style={{ width: "100%" }}
              >
                📷 Kamera starten
              </button>
            ) : (
              <button
                onClick={stopCamera}
                className="btn btn-outline"
                style={{ width: "100%" }}
              >
                ✕ Kamera stoppen
              </button>
            )}
          </div>
        </div>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>oder Code eingeben</span>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        </div>

        {/* Manual code input */}
        <div style={{
          background: "var(--surface)",
          border: "1.5px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "18px 20px",
          display: "flex", flexDirection: "column", gap: 14,
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>🔑 Einladungscode</div>
          <input
            value={code}
            onChange={(e) => { setCode(e.target.value); setErrorMsg(""); setScanState("idle"); }}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            placeholder="Code eingeben…"
            disabled={isLoading}
            autoCapitalize="characters"
            style={{
              background: "var(--surface2)",
              border: `1.5px solid ${errorMsg ? "var(--danger)" : "var(--border)"}`,
              borderRadius: 10,
              color: "var(--text)",
              fontSize: 16,
              fontWeight: 600,
              padding: "12px 14px",
              outline: "none",
              letterSpacing: 1,
              fontFamily: "monospace",
            }}
          />
          {errorMsg && (
            <div style={{ fontSize: 13, color: "var(--danger)", fontWeight: 600 }}>
              ⚠️ {errorMsg}
            </div>
          )}
          <button
            onClick={handleJoin}
            disabled={isLoading || !code.trim()}
            className="btn btn-primary"
            style={{ width: "100%", opacity: isLoading || !code.trim() ? 0.6 : 1 }}
          >
            {isLoading ? "Suche Spiel…" : "Beitreten →"}
          </button>
        </div>

        {/* Info */}
        <div style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "14px 16px",
          display: "flex", gap: 12, alignItems: "flex-start",
        }}>
          <span style={{ fontSize: 20 }}>💡</span>
          <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
            Der Gastgeber findet den Einladungscode und QR-Code in der Spiellobby.
            Du kannst an BeachBingo, BeachVolley und Vier4Bier beitreten.
          </div>
        </div>

      </div>
    </div>
  );
}
