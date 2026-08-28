import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ALL_KLON_CHARACTERS } from "./klontauschCharacterLibrary";
import { KlontauschCharacterPart } from "./KlontauschCharacterPart";

const KT_COLOR = "#8B5CF6";

function FullCharacter({ characterId }: { characterId: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
      <KlontauschCharacterPart characterId={characterId} part="KOPF"
        style={{ width: "100%", aspectRatio: "1024/358", objectFit: "contain", display: "block" }} />
      <KlontauschCharacterPart characterId={characterId} part="KOERPER"
        style={{ width: "100%", aspectRatio: "1024/358", objectFit: "contain", display: "block" }} />
      <KlontauschCharacterPart characterId={characterId} part="BEINE"
        style={{ width: "100%", aspectRatio: "1024/308", objectFit: "contain", display: "block" }} />
    </div>
  );
}

export default function KlontauschGalleryScreen() {
  const navigate = useNavigate();
  const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);
  const touchStartX = useRef<number | null>(null);

  // Keyboard navigation in fullscreen mode
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (fullscreenIndex === null) return;
      if (e.key === "ArrowRight") setFullscreenIndex(i => i !== null ? Math.min(i + 1, ALL_KLON_CHARACTERS.length - 1) : null);
      if (e.key === "ArrowLeft")  setFullscreenIndex(i => i !== null ? Math.max(i - 1, 0) : null);
      if (e.key === "Escape")     setFullscreenIndex(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreenIndex]);

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 40) return;
    if (dx < 0) setFullscreenIndex(i => i !== null ? Math.min(i + 1, ALL_KLON_CHARACTERS.length - 1) : null);
    else        setFullscreenIndex(i => i !== null ? Math.max(i - 1, 0) : null);
  }

  const char = fullscreenIndex !== null ? ALL_KLON_CHARACTERS[fullscreenIndex] : null;

  return (
    <div className="screen" style={{ paddingBottom: 40 }}>
      <button className="btn btn-outline btn-sm" style={{ alignSelf: "flex-start" }}
        onClick={() => navigate("/klontausch/lobby")}>
        ‹ Klontausch
      </button>

      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, #3b0764 0%, ${KT_COLOR} 100%)`,
        borderRadius: "var(--radius)", padding: "20px",
        display: "flex", alignItems: "center", gap: 16,
      }}>
        <div style={{ fontSize: 44 }}>🖼️</div>
        <div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>Klontausch</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "white" }}>Figurengalerie</div>
        </div>
      </div>

      {/* Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
        gap: 16,
        marginTop: 8,
      }}>
        {ALL_KLON_CHARACTERS.map((ch, idx) => (
          <button
            key={ch.id}
            onClick={() => setFullscreenIndex(idx)}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              padding: "10px 8px 8px",
              cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
              transition: "border-color 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = KT_COLOR + "88")}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
          >
            <FullCharacter characterId={ch.id} />
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", textAlign: "center", lineHeight: 1.2 }}>{ch.name}</div>
            <div style={{ fontSize: 10, color: KT_COLOR, textAlign: "center" }}>{ch.category}</div>
          </button>
        ))}
      </div>

      {/* Fullscreen overlay */}
      {char !== null && fullscreenIndex !== null && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(10,22,40,0.97)",
            zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {/* Prev */}
          <button
            onClick={() => setFullscreenIndex(i => i !== null ? Math.max(i - 1, 0) : null)}
            disabled={fullscreenIndex === 0}
            style={{
              position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
              background: "var(--surface2)", border: "1px solid var(--border)",
              borderRadius: "50%", width: 40, height: 40, cursor: "pointer",
              color: "var(--text)", fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center",
              opacity: fullscreenIndex === 0 ? 0.3 : 1,
            }}>‹</button>

          {/* Character */}
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
            maxWidth: 320, width: "70vw",
          }}>
            <div style={{ width: "100%", background: "var(--surface)", borderRadius: "var(--radius)", overflow: "hidden" }}>
              <FullCharacter characterId={char.id} />
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)" }}>{char.name}</div>
              <div style={{ fontSize: 14, color: KT_COLOR, marginTop: 4 }}>{char.category}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
                {fullscreenIndex + 1} / {ALL_KLON_CHARACTERS.length}
              </div>
            </div>
          </div>

          {/* Next */}
          <button
            onClick={() => setFullscreenIndex(i => i !== null ? Math.min(i + 1, ALL_KLON_CHARACTERS.length - 1) : null)}
            disabled={fullscreenIndex === ALL_KLON_CHARACTERS.length - 1}
            style={{
              position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
              background: "var(--surface2)", border: "1px solid var(--border)",
              borderRadius: "50%", width: 40, height: 40, cursor: "pointer",
              color: "var(--text)", fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center",
              opacity: fullscreenIndex === ALL_KLON_CHARACTERS.length - 1 ? 0.3 : 1,
            }}>›</button>

          {/* Close */}
          <button
            onClick={() => setFullscreenIndex(null)}
            style={{
              position: "absolute", top: 16, left: 16,
              background: "var(--surface2)", border: "1px solid var(--border)",
              borderRadius: 8, padding: "6px 12px", cursor: "pointer",
              color: "var(--text)", fontSize: 13,
            }}>✕ Schließen</button>
        </div>
      )}
    </div>
  );
}
