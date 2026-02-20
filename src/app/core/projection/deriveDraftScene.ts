import type { DraftScene } from "../../editor2D/draftPrimitives";
import type { RoomModel } from "../../model/RoomModel";
import type { ViewKind } from "../view/ViewKind";
import { offsetOrthoLoop } from "../../editor2D/offsetOrthoLoop";
import type { Vec2 } from "../../editor2D/draftPrimitives";
import { DIMENSION_DEFAULTS } from "../../editor2D/dimensionDefaults";

export function deriveDraftScene(view: ViewKind, room: RoomModel): DraftScene {
  if (view === "plan") return derivePlanScene(room);
  return deriveElevationScene(view, room);
}

function derivePlanScene(room: RoomModel): DraftScene {
  const inner = room.innerLoop;
  const t = room.wallThickness;

  const outer = offsetOrthoLoop(inner, t);

  const wallFill = "rgb(255, 255, 255)";
  const outline = "rgba(0,0,0,0.9)";

  const primitives: DraftScene["primitives"] = [
    {
      kind: "polygon" as const,
      outer,
      holes: [inner],
      fill: { color: wallFill },
      strokeOuter: { color: outline, widthMm: 5 },
      strokeHoles: { color: outline, widthMm: 5 },
    },
  ];

  const dimOffset = DIMENSION_DEFAULTS.offsetMm;
  const dimStroke = { color: "rgba(0,0,0,0.8)", widthMm: 1 };

  for (let i = 0; i < inner.length; i++) {
    const a = inner[i];
    const c = inner[(i + 1) % inner.length];
    const rawLen = Math.hypot(c.x - a.x, c.y - a.y);
    const override = room.dimText?.[i];

    primitives.push({
      kind: "dimension" as const,
      segIndex: i,
      a,
      b: c,
      offsetMm: dimOffset,
      side: DIMENSION_DEFAULTS.side,
      stroke: dimStroke,
      textSizeMm: DIMENSION_DEFAULTS.textSizeMm,
      arrowSizeMm: DIMENSION_DEFAULTS.arrowSizeMm,
      text: override ?? `${Math.round(rawLen)}`,
    });
  }

  return { primitives };
}

function bounds(loop: Vec2[]) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of loop) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

/*
 * For a CW inner loop in Y-down screen coords, the outward normal
 * of each directed edge (A→B) is (dy, -dx) normalised to the axis.
 *
 *   Edge going RIGHT (+X) → outward normal  (0, -1) = NORTH
 *   Edge going LEFT  (-X) → outward normal  (0, +1) = SOUTH
 *   Edge going DOWN  (+Y) → outward normal (+1,  0) = EAST
 *   Edge going UP    (-Y) → outward normal (-1,  0) = WEST
 */
function edgeFacesDirection(
  loop: Vec2[],
  edgeIdx: number,
  dir: Exclude<ViewKind, "plan">,
): boolean {
  const a = loop[edgeIdx];
  const b = loop[(edgeIdx + 1) % loop.length];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const isH = Math.abs(dx) > Math.abs(dy);

  switch (dir) {
    case "north": return isH && dx > 0;
    case "south": return isH && dx < 0;
    case "east":  return !isH && dy > 0;
    case "west":  return !isH && dy < 0;
  }
}

/**
 * Find horizontal positions (in elevation coords) of return walls—
 * perpendicular edges that connect two facing segments at different depths.
 */
function findElevationReturns(
  loop: Vec2[],
  view: Exclude<ViewKind, "plan">,
  originH: number,
  totalL: number,
): number[] {
  const n = loop.length;
  const isNS = view === "north" || view === "south";
  const seen = new Set<number>();

  for (let i = 0; i < n; i++) {
    const a = loop[i];
    const b = loop[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const isH = Math.abs(dx) > Math.abs(dy);

    const isReturnEdge = isNS ? !isH : isH;
    if (!isReturnEdge) continue;

    const prevIdx = (i - 1 + n) % n;
    const nextIdx = (i + 1) % n;
    if (!edgeFacesDirection(loop, prevIdx, view) && !edgeFacesDirection(loop, nextIdx, view))
      continue;

    const pos = isNS ? a.x - originH : a.y - originH;
    if (pos > 0.5 && pos < totalL - 0.5) seen.add(Math.round(pos * 10) / 10);
  }

  return Array.from(seen).sort((a, b) => a - b);
}

function deriveElevationScene(
  view: Exclude<ViewKind, "plan">,
  room: RoomModel,
): DraftScene {
  const inner = room.innerLoop;
  const n = inner.length;
  const T = room.wallThickness;
  const H = room.wallHeight;
  const b = bounds(inner);

  const isNS = view === "north" || view === "south";
  const L = isNS ? b.width : b.height;
  const originH = isNS ? b.minX : b.minY;

  const outline = "rgba(0,0,0,0.9)";
  const primitives: DraftScene["primitives"] = [];

  // ── wall cross-section: outer boundary with inner-face hole ──
  // The filled ring shows wall thickness at left/right edges,
  // mirroring the plan-view wall rendering.
  primitives.push({
    kind: "polygon" as const,
    outer: [
      { x: -T, y: 0 },
      { x: L + T, y: 0 },
      { x: L + T, y: H },
      { x: -T, y: H },
    ],
    holes: [
      [
        { x: 0, y: 0 },
        { x: L, y: 0 },
        { x: L, y: H },
        { x: 0, y: H },
      ],
    ],
    fill: { color: "rgb(255, 255, 255)" },
    strokeOuter: { color: outline, widthMm: 5 },
    strokeHoles: { color: outline, widthMm: 5 },
  });

  // ── tile band at floor level (bottom of elevation, y = H-tileH … H) ──
  const tileH = Math.min(1200, H);
  primitives.push({
    kind: "polyline" as const,
    pts: [
      { x: 0, y: H - tileH },
      { x: L, y: H - tileH },
      { x: L, y: H },
      { x: 0, y: H },
    ],
    closed: true,
    fill: { color: "rgba(0, 0, 0, 0.08)" },
    stroke: { color: "rgba(0, 0, 0, 0.18)", widthMm: 0.13 },
  });

  // ── return-wall vertical lines for non-rectangular rooms ──
  const returns = findElevationReturns(inner, view, originH, L);
  for (const pos of returns) {
    primitives.push({
      kind: "line" as const,
      a: { x: pos, y: 0 },
      b: { x: pos, y: H },
      stroke: { color: "rgba(0,0,0,0.35)", widthMm: 1.5 },
    });
  }

  // ── dimensions for each facing wall segment ──
  const dimOffset = DIMENSION_DEFAULTS.offsetMm;
  const dimStroke = { color: "rgba(0,0,0,0.8)", widthMm: 1 };

  const facingSegs: { startH: number; endH: number; segIndex: number }[] = [];
  for (let i = 0; i < n; i++) {
    if (!edgeFacesDirection(inner, i, view)) continue;

    const a = inner[i];
    const bPt = inner[(i + 1) % n];
    let startH: number, endH: number;
    if (isNS) {
      startH = Math.min(a.x, bPt.x) - originH;
      endH = Math.max(a.x, bPt.x) - originH;
    } else {
      startH = Math.min(a.y, bPt.y) - originH;
      endH = Math.max(a.y, bPt.y) - originH;
    }
    facingSegs.push({ startH, endH, segIndex: i });
  }
  facingSegs.sort((a, b) => a.startH - b.startH);

  for (const seg of facingSegs) {
    const rawLen = seg.endH - seg.startH;
    const override = room.dimText?.[seg.segIndex];

    primitives.push({
      kind: "dimension" as const,
      segIndex: seg.segIndex,
      a: { x: seg.startH, y: H },
      b: { x: seg.endH, y: H },
      offsetMm: dimOffset,
      side: "out" as const,
      stroke: dimStroke,
      textSizeMm: DIMENSION_DEFAULTS.textSizeMm,
      arrowSizeMm: DIMENSION_DEFAULTS.arrowSizeMm,
      text: override ?? `${Math.round(rawLen)}`,
    });
  }

  // ── wall-height dimension (right side) ──
  primitives.push({
    kind: "dimension" as const,
    segIndex: -1,
    a: { x: L + T, y: H },
    b: { x: L + T, y: 0 },
    offsetMm: dimOffset,
    side: "out" as const,
    stroke: dimStroke,
    textSizeMm: DIMENSION_DEFAULTS.textSizeMm,
    arrowSizeMm: DIMENSION_DEFAULTS.arrowSizeMm,
    text: `${Math.round(H)}`,
  });

  return { primitives };
}

