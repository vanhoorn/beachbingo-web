import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase";
import type { PiratesDifficulty, User } from "../../types";

function DiffOption({ selected, onClick, title, description }: {
  selected: boolean; onClick: () => void; title: string; description: string;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: selected ? "rgba(168,85,247,0.12)" : "var(--surface)",
        border: `1.5px solid ${selected ? "#a855f7" : "var(--border)"}`,
        borderRadius: "var(--radius)",
        padding: "14px 18px",
        cursor: "pointer",
        transition: "border-color 0.15s, background 0.15s",
        display: "flex", alignItems: "center", gap: 12,
      }}
    >
      <div style={{
        width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
        border: `2px solid ${selected ? "#a855f7" : "var(--text-muted)"}`,
        background: selected ? "#a855f7" : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {selected && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff" }} />}
      </div>
      <div>
        <div style={{ fontWeight: 600, fontSize: 15 }}>{title}</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{description}</div>
      </div>
    </div>
  );
}

export default function PiratesLobbyScreen() {
  const [difficulty, setDifficulty] = useState<PiratesDifficulty>("ROOKIE");
  const [highScores, setHighScores] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const navigate = useNavigate();
  const uid = auth.currentUser?.uid;

  const [fireRate, setFireRate] = useState(5);
  const [controlMode, setControlMode] = useState<"BUTTONS" | "TOUCH">("BUTTONS");

  useEffect(() => {
    if (!uid) return;
    getDoc(doc(db, "users", uid)).then((snap) => {
      if (snap.exists()) {
        const u = snap.data() as User;
        setDifficulty(u.preferredPiratesDifficulty ?? "ROOKIE");
        setHighScores((u.piratesHighScores as Record<string, number>) ?? {});
        setFireRate(u.preferredPiratesFireRate ?? 5);
        setControlMode(u.preferredPiratesControlMode ?? "BUTTONS");
      }
      setIsFavorite((snap.data()?.favoriteGames as string[] ?? []).includes("pirates"));
      setLoading(false);
    });
  }, [uid]);

  async function toggleFavorite() {
    if (!uid) return;
    const next = !isFavorite;
    setIsFavorite(next);
    await updateDoc(doc(db, "users", uid), {
      favoriteGames: next ? arrayUnion("pirates") : arrayRemove("pirates"),
    });
  }

  if (loading) {
    return (
      <div className="screen" style={{ alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 48 }}>🐙</span>
      </div>
    );
  }

  return (
    <div className="screen" style={{ gap: 20, paddingTop: 16 }}>
      <div className="flex items-center" style={{ gap: 12 }}>
        <button className="btn btn-outline btn-sm" onClick={() => navigate("/home")}>‹ Zurück</button>
        <h2 style={{ fontSize: 20 }}>BeachPirates</h2>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={() => navigate("/pirates/highscores")}>🏆</button>
          <button
            className="btn btn-outline btn-sm"
            onClick={toggleFavorite}
            style={{ color: isFavorite ? "var(--accent)" : undefined, borderColor: isFavorite ? "var(--accent)" : undefined }}
          >
            {isFavorite ? "★" : "☆"}
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => navigate("/pirates/settings")}>⚙️</button>
        </div>
      </div>

      {/* Hero */}
      <div style={{
        background: "linear-gradient(135deg, rgba(168,85,247,0.15) 0%, rgba(168,85,247,0.05) 100%)",
        border: "1px solid rgba(168,85,247,0.3)",
        borderRadius: "var(--radius)",
        padding: "24px 20px",
        textAlign: "center",
      }}>
        <div style={{ fontSize: 56 }}>🐙</div>
        <div style={{ fontSize: 18, fontWeight: 800, marginTop: 8 }}>Verteidige den Strand!</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.5 }}>
          Besiege Quallen, Muscheln und Fische.<br />
          Schütze deine Sandburgen. Überlebe so lange wie möglich.
        </div>
      </div>

      {/* High Scores per Difficulty */}
      <div className="card" style={{ padding: "14px 16px" }}>
        <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10, textAlign: "center" }}>
          🏆 Rekorde
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {(["ROOKIE", "SNIPER", "BOSS_LEVEL"] as const).map((d) => {
            const active = difficulty === d;
            const hs = highScores[d] ?? 0;
            return (
              <div key={d} style={{
                background: active ? "rgba(168,85,247,0.12)" : "var(--surface2)",
                border: `1.5px solid ${active ? "#a855f7" : "var(--border)"}`,
                borderRadius: "var(--radius-sm)",
                padding: "10px 6px",
                textAlign: "center",
              }}>
                <div style={{ fontSize: 13 }}>{d === "ROOKIE" ? "🌊" : d === "SNIPER" ? "🎯" : "💪"}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                  {d === "ROOKIE" ? "Rookie" : d === "SNIPER" ? "Sniper" : "Boss"}
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "var(--accent)", marginTop: 4 }}>
                  {hs > 0 ? hs : "—"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Difficulty */}
      <div className="flex flex-col gap-2">
        <div className="card-title" style={{ paddingLeft: 4 }}>Schwierigkeit</div>
        <DiffOption
          selected={difficulty === "ROOKIE"}
          onClick={() => setDifficulty("ROOKIE")}
          title="🌊 Rookie"
          description="Speed 3/30, Schießen 3/30 — ideal zum Starten"
        />
        <DiffOption
          selected={difficulty === "SNIPER"}
          onClick={() => setDifficulty("SNIPER")}
          title="🎯 Sniper"
          description="Speed 6/30, Schießen 6/30 — echte Herausforderung"
        />
        <DiffOption
          selected={difficulty === "BOSS_LEVEL"}
          onClick={() => setDifficulty("BOSS_LEVEL")}
          title="💪 Boss Level"
          description="Speed 10/30, Schießen 10/30 — viel Spaß 😈"
        />
      </div>

      <button
        className="btn btn-primary"
        style={{ background: "#a855f7", borderColor: "#a855f7", fontSize: 17, padding: "16px" }}
        onClick={() => navigate("/pirates/game", { state: { difficulty, fireRate, controlMode } })}
      >
        🎮 Spielen
      </button>
    </div>
  );
}
