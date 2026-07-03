import { useEffect, useState } from "react";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import type { GameResult } from "../types";

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function ResultsScreen() {
  const [results, setResults] = useState<GameResult[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, "gameResults"),
      where("playerIds", "array-contains", uid),
      orderBy("finishedAt", "desc")
    );
    getDocs(q).then((snap) => {
      setResults(snap.docs.map((d) => ({ resultId: d.id, ...d.data() } as GameResult)));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [uid]);

  return (
    <div className="screen" style={{ gap: 16, paddingTop: 16 }}>
      <div className="flex items-center" style={{ gap: 12 }}>
        <button className="btn btn-outline btn-sm" onClick={() => navigate("/lobby")}>
          ‹ Zurück
        </button>
        <h2 style={{ fontSize: 20 }}>Ergebnisse 🏆</h2>
      </div>

      {loading ? (
        <div className="text-center" style={{ paddingTop: 60 }}>
          <div style={{ fontSize: 40 }}>⏳</div>
        </div>
      ) : results.length === 0 ? (
        <div className="text-center" style={{ paddingTop: 60 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🏖️</div>
          <div style={{ fontWeight: 600, fontSize: 17, marginBottom: 6 }}>Noch keine Ergebnisse</div>
          <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
            Beende ein Spiel, um es hier zu sehen.
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {results.map((r) => {
            const isWinner = r.winnerId === uid;
            return (
              <div key={r.resultId} className="card" style={{ padding: "20px" }}>
                <div className="flex items-center" style={{ gap: 16, marginBottom: 12 }}>
                  <div style={{ fontSize: 44 }}>{r.winnerAvatar || "🏆"}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 16, color: "var(--primary)" }}>
                      {r.winnerName} hat gewonnen!
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                      {r.drawnNumbersCount} Zahlen · {formatDate(r.finishedAt)}
                    </div>
                  </div>
                  {isWinner && (
                    <span className="badge badge-running">🏆 Du!</span>
                  )}
                </div>

                {r.playerNames?.length > 0 && (
                  <>
                    <div className="divider" style={{ marginBottom: 10 }} />
                    <div className="card-title" style={{ marginBottom: 8 }}>Spieler</div>
                    <div className="flex flex-col gap-1">
                      {r.playerNames.map((name, i) => {
                        const av = r.playerAvatars?.[i] || "🏄";
                        const won = name === r.winnerName;
                        return (
                          <div key={i} className="flex items-center" style={{ gap: 10, padding: "4px 0" }}>
                            <span style={{ fontSize: 20 }}>{av}</span>
                            <span style={{
                              fontSize: 14,
                              fontWeight: won ? 700 : 400,
                              color: won ? "var(--primary)" : "var(--text)",
                              flex: 1,
                            }}>
                              {name}
                            </span>
                            {won && <span style={{ fontSize: 14 }}>🏆</span>}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
