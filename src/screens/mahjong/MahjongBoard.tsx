import {
  useRef, useState, useCallback, useEffect, type PointerEvent,
} from "react";
import type { MahjongState } from "./MahjongLogic";
import { isFree } from "./MahjongLogic";
import MahjongTileView, { LAYER_DX, LAYER_DY } from "./MahjongTile";

interface Props {
  state: MahjongState;
  showFreeHighlight: boolean;
  hintIds: number[];
  flashIds: number[];
  onTileClick: (id: number) => void;
  containerW: number;
  containerH: number;
}

const TILE_ASPECT = 1.3; // height/width ratio of a tile

// ── Compute board metrics from container size ─────────────────────────────────
function useBoardMetrics(state: MahjongState, containerW: number, containerH: number) {
  const tiles = state.tiles.filter((t) => !t.removed);
  if (tiles.length === 0) return null;

  const maxLayer = Math.max(...tiles.map((t) => t.layer));
  const minCol   = Math.min(...tiles.map((t) => t.col));
  const maxCol   = Math.max(...tiles.map((t) => t.col));
  const minRow   = Math.min(...tiles.map((t) => t.row));
  const maxRow   = Math.max(...tiles.map((t) => t.row));

  // Natural column/row span in half-steps
  const colSpan = maxCol - minCol + 2; // +2 for one tile width
  const rowSpan = maxRow - minRow + 2;

  // Extra space consumed by layer offsets
  const layerExtraX = maxLayer * Math.abs(LAYER_DX) + 1;
  const layerExtraY = maxLayer * Math.abs(LAYER_DY) + 1;

  // Solve for tileW such that board fits in container (with 8px padding each side)
  const padX = 16, padY = 16;
  const availW = containerW - padX * 2 - layerExtraX;
  const availH = containerH - padY * 2 - layerExtraY;

  const tileWFromWidth  = availW / (colSpan / 2);
  const tileWFromHeight = (availH / (rowSpan / 2)) / TILE_ASPECT;
  const naturalTileW = Math.min(52, Math.min(tileWFromWidth, tileWFromHeight));
  const tileW        = Math.max(26, naturalTileW);
  const tileH        = tileW * TILE_ASPECT;
  const initialZoom  = Math.max(0.25, Math.min(1, naturalTileW / tileW));
  const halfW = tileW / 2;
  const halfH = tileH / 2;

  // Board pixel dimensions
  const boardW = colSpan * halfW + layerExtraX + padX * 2;
  const boardH = rowSpan * halfH + layerExtraY + padY * 2;

  function tilePos(col: number, row: number, layer: number) {
    return {
      x: padX + (col - minCol) * halfW + layer * LAYER_DX,
      y: padY + (row - minRow) * halfH + layer * LAYER_DY,
    };
  }

  return { tileW, tileH, boardW, boardH, tilePos, minCol, minRow, initialZoom };
}

// ── Render order: lower layers first, within layer row-major, then col ─────
function sortedTiles(state: MahjongState) {
  return [...state.tiles].sort((a, b) => {
    if (a.layer !== b.layer) return a.layer - b.layer;
    if (a.row   !== b.row)   return a.row   - b.row;
    return a.col - b.col;
  });
}

export default function MahjongBoard({
  state, showFreeHighlight, hintIds, flashIds, onTileClick,
  containerW, containerH,
}: Props) {
  const metrics = useBoardMetrics(state, containerW, containerH);

  // ── Zoom + Pan state ──────────────────────────────────────────────────────
  const [zoom, setZoom]     = useState(1);
  const [panX, setPanX]     = useState(0);
  const [panY, setPanY]     = useState(0);
  const panOrigin           = useRef<{ x: number; y: number } | null>(null);
  const pinchOrigin         = useRef<{ d: number; zoom: number; cx: number; cy: number; panX: number; panY: number } | null>(null);
  const containerRef        = useRef<HTMLDivElement>(null);
  const activePointers      = useRef<Map<number, { x: number; y: number }>>(new Map());

  // Reset zoom when layout changes
  useEffect(() => { setZoom(metrics?.initialZoom ?? 1); setPanX(0); setPanY(0); }, [state.layoutId]);

  const clampZoom = (z: number) => Math.min(3, Math.max(metrics?.initialZoom ?? 0.25, z));

  // ── Wheel zoom ─────────────────────────────────────────────────────────────
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    setZoom((z) => clampZoom(z * factor));
  }, []);

  // ── Pointer events for pinch + pan ────────────────────────────────────────
  const onPointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    if (activePointers.current.size === 2) {
      const pts = [...activePointers.current.values()];
      const dx = pts[1].x - pts[0].x, dy = pts[1].y - pts[0].y;
      pinchOrigin.current = {
        d: Math.hypot(dx, dy),
        zoom,
        cx: (pts[0].x + pts[1].x) / 2,
        cy: (pts[0].y + pts[1].y) / 2,
        panX,
        panY,
      };
      panOrigin.current = null;
    } else if (activePointers.current.size === 1) {
      panOrigin.current = { x: e.clientX - panX, y: e.clientY - panY };
    }
  }, [zoom, panX, panY]);

  const onPointerMove = useCallback((e: PointerEvent<HTMLDivElement>) => {
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.current.size === 2 && pinchOrigin.current) {
      const pts = [...activePointers.current.values()];
      const dx = pts[1].x - pts[0].x, dy = pts[1].y - pts[0].y;
      const d  = Math.hypot(dx, dy);
      const newZoom = clampZoom(pinchOrigin.current.zoom * (d / pinchOrigin.current.d));
      const ratio = newZoom / pinchOrigin.current.zoom;
      // Current pinch center relative to container center (transformOrigin: center center)
      const rect = containerRef.current?.getBoundingClientRect();
      const cx = rect ? pinchOrigin.current.cx - rect.left - rect.width / 2 : 0;
      const cy = rect ? pinchOrigin.current.cy - rect.top - rect.height / 2 : 0;
      // Adjust pan so the pinch center stays fixed
      setZoom(newZoom);
      setPanX(cx * (1 - ratio) + pinchOrigin.current.panX * ratio);
      setPanY(cy * (1 - ratio) + pinchOrigin.current.panY * ratio);
    } else if (activePointers.current.size === 1 && panOrigin.current && zoom > 1) {
      setPanX(e.clientX - panOrigin.current.x);
      setPanY(e.clientY - panOrigin.current.y);
    }
  }, [zoom]);

  const onPointerUp = useCallback((e: PointerEvent<HTMLDivElement>) => {
    activePointers.current.delete(e.pointerId);
    if (activePointers.current.size < 2) pinchOrigin.current = null;
    if (activePointers.current.size === 0) panOrigin.current = null;
  }, []);

  if (!metrics || containerW === 0 || containerH === 0) {
    return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ color: "var(--text-muted)", fontSize: 14 }}>Lade…</span>
    </div>;
  }

  const { tileW, tileH, boardW, boardH, tilePos } = metrics;
  const ordered = sortedTiles(state);
  const freeSet = new Set(
    state.tiles.filter((t) => !t.removed && isFree(t, state.tiles)).map((t) => t.id)
  );

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflow: "hidden",
        touchAction: "none",
        cursor: zoom > 1 ? "grab" : "default",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* Zoom hint / indicator */}
      <div style={{
        position: "absolute", bottom: 6, right: 8, zIndex: 10,
        fontSize: 10, color: "var(--text-muted)", pointerEvents: "none",
        background: zoom !== (metrics?.initialZoom ?? 1) ? "var(--surface2)" : undefined,
        borderRadius: 4, padding: zoom !== (metrics?.initialZoom ?? 1) ? "2px 6px" : undefined,
      }}>
        {zoom !== (metrics?.initialZoom ?? 1) ? `${Math.round(zoom * 100)}%` : "Pinch / Scroll zum Zoomen"}
      </div>

      {/* Board canvas */}
      <div
        style={{
          transform: `scale(${zoom}) translate(${panX / zoom}px, ${panY / zoom}px)`,
          transformOrigin: "center center",
          transition: pinchOrigin.current ? "none" : "transform 0.05s ease-out",
          position: "relative",
          width: boardW,
          height: boardH,
          flexShrink: 0,
        }}
      >
        {ordered.map((tile) => {
          const isFlashing = flashIds.includes(tile.id);
          if (tile.removed && !isFlashing) return null;
          const { x, y } = tilePos(tile.col, tile.row, tile.layer);
          return (
            <div
              key={tile.id}
              style={{ position: "absolute", left: x, top: y, width: tileW, height: tileH }}
            >
              <MahjongTileView
                tile={tile}
                tileW={tileW}
                tileH={tileH}
                selected={state.selectedId === tile.id}
                hinted={hintIds.includes(tile.id)}
                free={freeSet.has(tile.id)}
                showFreeHighlight={showFreeHighlight}
                removing={isFlashing}
                onClick={() => onTileClick(tile.id)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
