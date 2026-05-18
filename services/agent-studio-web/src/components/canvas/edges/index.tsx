import { memo, useState, useCallback } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  useReactFlow,
  useStore,
  type EdgeProps,
} from '@xyflow/react';

// ─── Edge data shape ──────────────────────────────────────────────────────────

interface SmartEdgeData extends Record<string, unknown> {
  arcDepth?: number;    // back-edge: extra px added to auto-computed arc bottom
  midYOffset?: number;  // forward-edge: shifts the horizontal mid-segment up / down
}

// ─── Back-edge detection ──────────────────────────────────────────────────────

function isBackEdge(sourceX: number, targetX: number): boolean {
  return sourceX > targetX + 40;
}

// ─── Path builders ────────────────────────────────────────────────────────────

/**
 * Orthogonal path — three straight segments with sharp 90° corners.
 * Horizontal mid-segment sits at midY = avg(sy, ty) + midYOffset.
 * Returns the SVG path string + the coordinates of the mid-segment centre
 * (used to place the drag handle and edge label).
 */
function buildForwardPath(
  sx: number, sy: number,
  tx: number, ty: number,
  midYOffset: number,
): { path: string; handleX: number; handleY: number } {
  const midY = (sy + ty) / 2 + midYOffset;

  const path = [
    `M ${sx} ${sy}`,
    `L ${sx} ${midY}`,
    `L ${tx} ${midY}`,
    `L ${tx} ${ty}`,
  ].join(' ');

  return { path, handleX: (sx + tx) / 2, handleY: midY };
}

/**
 * Cubic-bezier arc that dips below both node boxes.
 * arcDepth adds extra pixels on top of the auto-computed drop distance.
 */
function buildBackPath(
  sx: number, sy: number,
  tx: number, ty: number,
  arcDepth: number,
): { path: string; handleX: number; handleY: number } {
  const baseY  = Math.max(sy, ty) + 70;
  const arcY   = baseY + arcDepth;
  const handleX = (sx + tx) / 2;

  const path = `M ${sx} ${sy} C ${sx} ${arcY} ${tx} ${arcY} ${tx} ${ty}`;
  return { path, handleX, handleY: arcY };
}

// ─── SmartEdge ────────────────────────────────────────────────────────────────

/**
 * Draw.io-style smart edge:
 *
 * • Forward edges  → orthogonal path with rounded corners + draggable mid-segment
 * • Back-edges     → amber-dashed cubic arc below nodes + draggable arc depth
 *
 * Drag the small circle that appears at the path midpoint to re-route the edge
 * without it overlapping node boxes.  Positions are persisted in edge.data.
 */
export const SmartEdge = memo(function SmartEdge({
  id,
  sourceX, sourceY,
  targetX, targetY,
  sourcePosition, targetPosition,
  style,
  markerEnd,
  label,
  data,
  selected,
}: EdgeProps) {
  const { setEdges } = useReactFlow();
  // Current viewport zoom — used to convert screen-px drag delta → flow-unit delta
  const zoom = useStore((s) => s.transform[2]);

  const [hovered, setHovered] = useState(false);

  const edgeData  = (data ?? {}) as SmartEdgeData;
  const arcDepth  = edgeData.arcDepth  ?? 0;
  const midYOffset = edgeData.midYOffset ?? 0;

  const back = isBackEdge(sourceX, targetX);

  const { path: edgePath, handleX, handleY } = back
    ? buildBackPath(sourceX, sourceY, targetX, targetY, arcDepth)
    : buildForwardPath(sourceX, sourceY, targetX, targetY, midYOffset);

  // ── Drag the bend handle ────────────────────────────────────────────────────
  const onBendMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      const startY     = e.clientY;
      const startValue = back ? arcDepth : midYOffset;
      // Capture zoom at drag start so the conversion is consistent during drag
      const startZoom  = zoom;

      const onMove = (me: MouseEvent) => {
        const delta = (me.clientY - startY) / startZoom;
        setEdges((eds) =>
          eds.map((edge) => {
            if (edge.id !== id) return edge;
            if (back) {
              return {
                ...edge,
                data: {
                  ...edge.data,
                  arcDepth: Math.max(-60, startValue + delta),
                },
              };
            }
            return {
              ...edge,
              data: { ...edge.data, midYOffset: startValue + delta },
            };
          }),
        );
      };

      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup',   onUp);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup',   onUp);
    },
    [id, back, arcDepth, midYOffset, zoom, setEdges],
  );

  // ── Styles ──────────────────────────────────────────────────────────────────
  const edgeStyle: React.CSSProperties = back
    ? { stroke: '#f59e0b', strokeWidth: 1.5, strokeDasharray: '6 3', ...style }
    : { stroke: '#6366f1', strokeWidth: 1.5, ...style };

  // Amber arrow for back-edges, indigo for forward
  const resolvedMarker =
    back && markerEnd && typeof markerEnd === 'object' && !Array.isArray(markerEnd)
      ? { ...(markerEnd as object), color: '#f59e0b' }
      : markerEnd;

  const showHandle  = selected || hovered;
  const handleColor = back ? 'border-amber-400' : 'border-indigo-400';
  const labelStr    = typeof label === 'string' ? label : undefined;

  // Label sits just above the handle for back-edges, on the handle for forward
  const labelY = back ? handleY + 18 : handleY - 18;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={edgeStyle}
        markerEnd={resolvedMarker as string}
      />

      <EdgeLabelRenderer>
        {/* ── Bend handle ─────────────────────────────────────────────────── */}
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${handleX}px, ${handleY}px)`,
            pointerEvents: 'all',
            cursor: 'ns-resize',
            zIndex: 10,
          }}
          className="nodrag nopan"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onMouseDown={onBendMouseDown}
          title="Drag to adjust routing"
        >
          <div
            className={[
              'rounded-full border-2 bg-white transition-all duration-150',
              handleColor,
              showHandle
                ? 'w-3.5 h-3.5 shadow-md opacity-100'
                : 'w-2 h-2 opacity-20',
            ].join(' ')}
          />
        </div>

        {/* ── Edge label (true / false / custom) ──────────────────────────── */}
        {labelStr && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${handleX}px, ${labelY}px)`,
              pointerEvents: 'none',
            }}
          >
            <span
              className={[
                'inline-flex items-center px-2 py-0.5 rounded-full border text-[10px]',
                'font-semibold shadow-sm bg-white',
                labelStr === 'true'
                  ? 'text-emerald-700 border-emerald-300'
                  : labelStr === 'false'
                    ? 'text-red-600 border-red-200'
                    : 'text-gray-600 border-gray-200',
              ].join(' ')}
            >
              {labelStr}
            </span>
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
});
SmartEdge.displayName = 'SmartEdge';

export const edgeTypes = { smart: SmartEdge };
