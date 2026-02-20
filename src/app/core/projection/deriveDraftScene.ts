// src/editor2D/deriveDraftScene.ts
import type { DraftPrimitive, DraftScene } from "../../editor2D/draftPrimitives";
import type { RoomModel } from "../../model/RoomModel";
import type { ViewKind } from "../view/ViewKind";
import { offsetOrthoLoop } from "../../editor2D/offsetOrthoLoop";
import type { Vec2 } from "../../editor2D/draftPrimitives";
import { DIMENSION_DEFAULTS } from "../../editor2D/dimensionDefaults";
import type { WallOpeningEntity } from "../entities/entityTypes";
import { getWindowPlanRect, getWindowElevationRect } from "../entities/windowGeometry";
import { getDoorPlanRect, getDoorElevationRect } from "../entities/doorGeometry";

export function deriveDraftScene(view: ViewKind, room: RoomModel): DraftScene {
  if (view === "plan") return derivePlanScene(room);
  return deriveElevationScene(view, room);
}

function derivePlanScene(room: RoomModel): DraftScene {
  const inner = room.innerLoop;
  const t = room.wallThickness;

  const outer = offsetOrthoLoop(inner, t);

  const outline = "rgba(0,0,0,0.9)";

  const primitives: DraftScene["primitives"] = [
    {
      kind: "polygon" as const,
      outer,
      holes: [inner],
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

  for (const entity of Object.values(room.entities)) {
    if (entity.kind !== "wall-opening") continue;
    if (entity.openingType === "window") {
      primitives.push(...buildWindowPlanPrimitives(room, entity));
    } else if (entity.openingType === "door") {
      primitives.push(...buildDoorPlanPrimitives(room, entity));
    }
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
export function edgeFacesDirection(
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
    case "north":
      return isH && dx > 0;
    case "south":
      return isH && dx < 0;
    case "east":
      return !isH && dy > 0;
    case "west":
      return !isH && dy < 0;
  }
}

/**
 * Find horizontal positions (in elevation coords) of return walls—
 * perpendicular edges that connect two facing segments at different depths.
 */
export function findElevationReturns(
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
    if (!edgeFacesDirection(loop, prevIdx, view) && !edgeFacesDirection(loop, nextIdx, view)) continue;

    const pos = isNS ? a.x - originH : a.y - originH;
    if (pos > 0.5 && pos < totalL - 0.5) seen.add(Math.round(pos * 10) / 10);
  }

  return Array.from(seen).sort((a, b) => a - b);
}

function deriveElevationScene(view: Exclude<ViewKind, "plan">, room: RoomModel): DraftScene {
  const inner = room.innerLoop;
  const n = inner.length;
  const H = room.wallHeight;
  const b = bounds(inner);
  const strokeMm = room.wallConfig?.strokeWidthMm ?? 5;

  const isNS = view === "north" || view === "south";
  const L = isNS ? b.width : b.height;
  const originH = isNS ? b.minX : b.minY;

  const outline = "rgba(0,0,0,0.9)";
  const primitives: DraftScene["primitives"] = [];

  // ── elevation face only (no wall thickness); hatch system can still fill zones
  primitives.push({
    kind: "polygon" as const,
    outer: [
      { x: 0, y: 0 },
      { x: L, y: 0 },
      { x: L, y: H },
      { x: 0, y: H },
    ],
    strokeOuter: { color: outline, widthMm: strokeMm },
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

  for (const entity of Object.values(room.entities)) {
    if (entity.kind !== "wall-opening") continue;
    if (entity.openingType === "window") {
      primitives.push(...buildWindowElevPrimitives(room, entity, view));
    } else if (entity.openingType === "door") {
      primitives.push(...buildDoorElevPrimitives(room, entity, view));
    }
  }

  // ── wall-height dimension (right side) ──
  primitives.push({
    kind: "dimension" as const,
    segIndex: -1,
    a: { x: L, y: H },
    b: { x: L, y: 0 },
    offsetMm: dimOffset,
    side: "out" as const,
    stroke: dimStroke,
    textSizeMm: DIMENSION_DEFAULTS.textSizeMm,
    arrowSizeMm: DIMENSION_DEFAULTS.arrowSizeMm,
    text: `${Math.round(H)}`,
  });

  return { primitives };
}

// ── Window rendering helpers ──

const WIN_STROKE = { color: "rgb(0, 0, 0)", widthMm: 5 };
const WIN_FILL = { color: "rgb(255, 255, 255)" };
const WIN_STROKE_RECT = { color: "rgb(255, 255, 255)", widthMm: 1 };

// --- small vector helpers ---
const dot = (a: Vec2, b: Vec2) => a.x * b.x + a.y * b.y;
const perp = (v: Vec2): Vec2 => ({ x: -v.y, y: v.x });

function buildWindowPlanPrimitives(room: RoomModel, entity: WallOpeningEntity): DraftPrimitive[] {
  const prims: DraftPrimitive[] = [];
  const rect = getWindowPlanRect(room, entity);

  // Robust corner classification so "jamb" lines are ALWAYS perpendicular to wall
  const corners = rect.corners as Vec2[];
  const n = rect.normal as Vec2; // wall normal (perp to wall)
  const t = perp(n); // wall tangent (along wall)

  // Project corners into local (s,u) frame:
  //  s = along wall (t), u = across thickness (n)
  const proj = corners.map((p) => ({ p, s: dot(p, t), u: dot(p, n) }));
  const sMin = Math.min(...proj.map((q) => q.s));
  const sMax = Math.max(...proj.map((q) => q.s));
  const uMin = Math.min(...proj.map((q) => q.u));
  const uMax = Math.max(...proj.map((q) => q.u));

  const epsS = Math.max(1e-6, (sMax - sMin) * 1e-6);

  const pickEdgeAtS = (targetS: number) => {
    let pts = proj.filter((q) => Math.abs(q.s - targetS) <= epsS).map((q) => q.p);
    // Fallback for numeric jitter / unexpected ordering
    if (pts.length !== 2) {
      pts = proj
        .slice()
        .sort((a, b) => Math.abs(a.s - targetS) - Math.abs(b.s - targetS))
        .slice(0, 2)
        .map((q) => q.p);
    }
    // Order by u for stability
    pts.sort((a, b) => dot(a, n) - dot(b, n));
    return pts as [Vec2, Vec2];
  };

  const pickCornerNear = (sT: number, uT: number): Vec2 => {
    let best = proj[0];
    let bestD = Infinity;
    for (const q of proj) {
      const ds = q.s - sT;
      const du = q.u - uT;
      const d = ds * ds + du * du;
      if (d < bestD) {
        bestD = d;
        best = q;
      }
    }
    return best.p;
  };

  // Rebuild stable corners in local frame:
  // c0=(sMin,uMin), c1=(sMax,uMin), c2=(sMax,uMax), c3=(sMin,uMax)
  const c0 = pickCornerNear(sMin, uMin);
  const c1 = pickCornerNear(sMax, uMin);
  const c2 = pickCornerNear(sMax, uMax);
  const c3 = pickCornerNear(sMin, uMax);

  prims.push({
    kind: "polygon" as const,
    outer: [c0, c1, c2, c3],
    fill: WIN_FILL,
    strokeOuter: WIN_STROKE_RECT,
  });

  // These two lines are now GUARANTEED to be the perpendicular jamb lines (short edges)
  const [j0a, j0b] = pickEdgeAtS(sMin);
  const [j1a, j1b] = pickEdgeAtS(sMax);

  prims.push(
    { kind: "line" as const, a: j0a, b: j0b, stroke: WIN_STROKE },
    { kind: "line" as const, a: j1a, b: j1b, stroke: WIN_STROKE },
  );

  const style = entity.windowStyle ?? "single-leaf";
  const T = room.wallThickness;

  const mid0 = { x: (c0.x + c1.x) / 2, y: (c0.y + c1.y) / 2 };
  const mid2 = { x: (c3.x + c2.x) / 2, y: (c3.y + c2.y) / 2 };

  if (style === "double-leaf") {
    prims.push({
      kind: "line" as const,
      a: mid0,
      b: mid2,
      stroke: WIN_STROKE,
    });
  } else if (style === "fixed") {
    prims.push(
      { kind: "line" as const, a: c0, b: c2, stroke: { ...WIN_STROKE, widthMm: 1 } },
      { kind: "line" as const, a: c1, b: c3, stroke: { ...WIN_STROKE, widthMm: 1 } },
    );
  } else if (style === "sliding") {
    prims.push({
      kind: "line" as const,
      a: mid0,
      b: mid2,
      stroke: { color: "rgba(0,0,0,0.5)", widthMm: 1, dashMm: [20, 20] },
    });
  }

  // Glass lines parallel to wall (two lines inside the rectangle)
  const glassOffset1 = T * 0.4;
  const glassOffset2 = T * 0.6;
  for (const off of [glassOffset1, glassOffset2]) {
    const p0 = { x: c0.x + n.x * off, y: c0.y + n.y * off };
    const p1 = { x: c1.x + n.x * off, y: c1.y + n.y * off };
    prims.push({
      kind: "line" as const,
      a: p0,
      b: p1,
      stroke: { color: "rgb(0, 0, 0)", widthMm: 3 },
    });
  }

  return prims;
}

// ── Door rendering helpers ──

const DOOR_STROKE = { color: "rgb(0, 0, 0)", widthMm: 5 };
const DOOR_FILL = { color: "rgb(255, 255, 255)" };
const DOOR_STROKE_RECT = { color: "rgb(255, 255, 255)", widthMm: 5 };
const ARC_SEGMENTS = 32;

function arcPoints(center: Vec2, radius: number, startAngle: number, endAngle: number): Vec2[] {
  const pts: Vec2[] = [];
  for (let i = 0; i <= ARC_SEGMENTS; i++) {
    const a = startAngle + (endAngle - startAngle) * (i / ARC_SEGMENTS);
    pts.push({ x: center.x + radius * Math.cos(a), y: center.y + radius * Math.sin(a) });
  }
  return pts;
}

function buildDoorPlanPrimitives(room: RoomModel, entity: WallOpeningEntity): DraftPrimitive[] {
  const prims: DraftPrimitive[] = [];
  const rect = getDoorPlanRect(room, entity);

  const corners = rect.corners as Vec2[];
  const n = rect.normal as Vec2;
  const t = perp(n);

  const proj = corners.map((p) => ({ p, s: dot(p, t), u: dot(p, n) }));
  const sMin = Math.min(...proj.map((q) => q.s));
  const sMax = Math.max(...proj.map((q) => q.s));
  const uMin = Math.min(...proj.map((q) => q.u));
  const uMax = Math.max(...proj.map((q) => q.u));

  const pickCornerNear = (sT: number, uT: number): Vec2 => {
    let best = proj[0];
    let bestD = Infinity;
    for (const q of proj) {
      const ds = q.s - sT;
      const du = q.u - uT;
      const d = ds * ds + du * du;
      if (d < bestD) { bestD = d; best = q; }
    }
    return best.p;
  };

  const epsS = Math.max(1e-6, (sMax - sMin) * 1e-6);
  const pickEdgeAtS = (targetS: number) => {
    let pts = proj.filter((q) => Math.abs(q.s - targetS) <= epsS).map((q) => q.p);
    if (pts.length !== 2) {
      pts = proj.slice().sort((a, b) => Math.abs(a.s - targetS) - Math.abs(b.s - targetS)).slice(0, 2).map((q) => q.p);
    }
    pts.sort((a, b) => dot(a, n) - dot(b, n));
    return pts as [Vec2, Vec2];
  };

  // c0=(sMin,uMin) inner-left, c1=(sMax,uMin) inner-right
  // c2=(sMax,uMax) outer-right, c3=(sMin,uMax) outer-left
  const c0 = pickCornerNear(sMin, uMin);
  const c1 = pickCornerNear(sMax, uMin);
  const c2 = pickCornerNear(sMax, uMax);
  const c3 = pickCornerNear(sMin, uMax);

  prims.push({
    kind: "polygon" as const,
    outer: [c0, c1, c2, c3],
    fill: DOOR_FILL,
    strokeOuter: DOOR_STROKE_RECT,
  });

  const [j0a, j0b] = pickEdgeAtS(sMin);
  const [j1a, j1b] = pickEdgeAtS(sMax);
  prims.push(
    { kind: "line" as const, a: j0a, b: j0b, stroke: DOOR_STROKE },
    { kind: "line" as const, a: j1a, b: j1b, stroke: DOOR_STROKE },
  );

  const style = entity.doorStyle ?? "single-leaf";
  const leafSide = entity.doorLeafSide ?? "left";
  const swingDir = entity.doorSwingDirection ?? "inside";
  const W = entity.widthMm;

  const arcStroke = { color: "rgb(182, 182, 182)", widthMm: 1, dashMm: [30, 30] };
  const panelStroke = { color: "rgb(182, 182, 182)", widthMm: 1, dashMm: [30, 30] };

  // "inside" = toward uMin (inner wall face), "outside" = toward uMax (exterior)
  // "left" = hinge at sMin jamb, "right" = hinge at sMax jamb
  if (style === "single-leaf") {
    const hingeOuter = leafSide === "left" ? c3 : c2;
    const hingeInner = leafSide === "left" ? c0 : c1;
    const hinge = swingDir === "outside" ? hingeOuter : hingeInner;

    const tAngle = leafSide === "left" ? Math.atan2(t.y, t.x) : Math.atan2(-t.y, -t.x);
    const nAngle = swingDir === "outside" ? Math.atan2(n.y, n.x) : Math.atan2(-n.y, -n.x);

    const arc = arcPoints(hinge, W, nAngle, tAngle);
    prims.push({ kind: "polyline" as const, pts: arc, stroke: arcStroke });
    prims.push({ kind: "line" as const, a: hinge, b: arc[0], stroke: panelStroke });
  } else if (style === "double-leaf") {
    const halfW = W / 2;
    if (swingDir === "outside") {
      const baseAngle = Math.atan2(t.y, t.x);
      const normalAngle = Math.atan2(n.y, n.x);
      const negT = Math.atan2(-t.y, -t.x);
      const arcL = arcPoints(c3, halfW, normalAngle, baseAngle);
      prims.push({ kind: "polyline" as const, pts: arcL, stroke: arcStroke });
      prims.push({ kind: "line" as const, a: c3, b: arcL[arcL.length - 1], stroke: panelStroke });
      const arcR = arcPoints(c2, halfW, normalAngle, negT);
      prims.push({ kind: "polyline" as const, pts: arcR, stroke: arcStroke });
      prims.push({ kind: "line" as const, a: c2, b: arcR[arcR.length - 1], stroke: panelStroke });
    } else {
      const negN = Math.atan2(-n.y, -n.x);
      const baseAngle = Math.atan2(t.y, t.x);
      const negT = Math.atan2(-t.y, -t.x);
      const arcL = arcPoints(c0, halfW, negN, baseAngle);
      prims.push({ kind: "polyline" as const, pts: arcL, stroke: arcStroke });
      prims.push({ kind: "line" as const, a: c0, b: arcL[arcL.length - 1], stroke: panelStroke });
      const arcR = arcPoints(c1, halfW, negN, negT);
      prims.push({ kind: "polyline" as const, pts: arcR, stroke: arcStroke });
      prims.push({ kind: "line" as const, a: c1, b: arcR[arcR.length - 1], stroke: panelStroke });
    }
    const midInner = { x: (c0.x + c1.x) / 2, y: (c0.y + c1.y) / 2 };
    const midOuter = { x: (c3.x + c2.x) / 2, y: (c3.y + c2.y) / 2 };
    prims.push({ kind: "line" as const, a: midInner, b: midOuter, stroke: DOOR_STROKE });
  } else if (style === "sliding") {
    const mid0 = { x: (c0.x + c1.x) / 2, y: (c0.y + c1.y) / 2 };
    const mid2 = { x: (c3.x + c2.x) / 2, y: (c3.y + c2.y) / 2 };
    prims.push({
      kind: "line" as const,
      a: mid0,
      b: mid2,
      stroke: { color: "rgba(0,0,0,0.5)", widthMm: 1, dashMm: [20, 20] },
    });
    const arrowTip = { x: c1.x + t.x * W * 0.15, y: c1.y + t.y * W * 0.15 };
    prims.push({ kind: "line" as const, a: c1, b: arrowTip, stroke: { color: "rgba(0,0,0,0.5)", widthMm: 2 } });
  } else if (style === "pocket") {
    const mid0 = { x: (c0.x + c1.x) / 2, y: (c0.y + c1.y) / 2 };
    const mid2 = { x: (c3.x + c2.x) / 2, y: (c3.y + c2.y) / 2 };
    prims.push({
      kind: "line" as const,
      a: mid0,
      b: mid2,
      stroke: { color: "rgba(0,0,0,0.4)", widthMm: 1, dashMm: [15, 10] },
    });
    const cx = (c0.x + c1.x + c2.x + c3.x) / 4;
    const cy = (c0.y + c1.y + c2.y + c3.y) / 4;
    const arrLen = W * 0.25;
    const arrTip = { x: cx + t.x * arrLen, y: cy + t.y * arrLen };
    prims.push({ kind: "line" as const, a: { x: cx, y: cy }, b: arrTip, stroke: { color: "rgba(0,0,0,0.6)", widthMm: 2 } });
  }

  return prims;
}

function buildDoorElevPrimitives(
  room: RoomModel,
  entity: WallOpeningEntity,
  view: Exclude<ViewKind, "plan">,
): DraftPrimitive[] {
  const r = getDoorElevationRect(room, entity, view);
  if (!r) return [];

  const prims: DraftPrimitive[] = [];
  const outer: Vec2[] = [
    { x: r.x0, y: r.y0 },
    { x: r.x1, y: r.y0 },
    { x: r.x1, y: r.y1 },
    { x: r.x0, y: r.y1 },
  ];

  prims.push({
    kind: "polygon" as const,
    outer,
    fill: DOOR_FILL,
    strokeOuter: DOOR_STROKE,
  });

  const style = entity.doorStyle ?? "single-leaf";
  const midX = (r.x0 + r.x1) / 2;

  if (style === "double-leaf") {
    prims.push({
      kind: "line" as const,
      a: { x: midX, y: r.y0 },
      b: { x: midX, y: r.y1 },
      stroke: DOOR_STROKE,
    });
  } else if (style === "sliding") {
    prims.push({
      kind: "line" as const,
      a: { x: midX, y: r.y0 },
      b: { x: midX, y: r.y1 },
      stroke: { color: "rgba(0,0,0,0.5)", widthMm: 1, dashMm: [20, 20] },
    });
  }

  return prims;
}

function buildWindowElevPrimitives(
  room: RoomModel,
  entity: WallOpeningEntity,
  view: Exclude<ViewKind, "plan">,
): DraftPrimitive[] {
  const r = getWindowElevationRect(room, entity, view);
  if (!r) return [];

  const prims: DraftPrimitive[] = [];
  const outer: Vec2[] = [
    { x: r.x0, y: r.y0 },
    { x: r.x1, y: r.y0 },
    { x: r.x1, y: r.y1 },
    { x: r.x0, y: r.y1 },
  ];

  prims.push({
    kind: "polygon" as const,
    outer,
    fill: WIN_FILL,
    strokeOuter: WIN_STROKE,
  });

  const style = entity.windowStyle ?? "single-leaf";
  const midX = (r.x0 + r.x1) / 2;

  if (style === "double-leaf") {
    prims.push({
      kind: "line" as const,
      a: { x: midX, y: r.y0 },
      b: { x: midX, y: r.y1 },
      stroke: WIN_STROKE,
    });
  } else if (style === "fixed") {
    prims.push(
      {
        kind: "line" as const,
        a: { x: r.x0, y: r.y0 },
        b: { x: r.x1, y: r.y1 },
        stroke: { ...WIN_STROKE, widthMm: 1 },
      },
      {
        kind: "line" as const,
        a: { x: r.x1, y: r.y0 },
        b: { x: r.x0, y: r.y1 },
        stroke: { ...WIN_STROKE, widthMm: 1 },
      },
    );
  } else if (style === "sliding") {
    prims.push({
      kind: "line" as const,
      a: { x: midX, y: r.y0 },
      b: { x: midX, y: r.y1 },
      stroke: { color: "rgba(0,0,0,0.5)", widthMm: 1, dashMm: [20, 20] },
    });
  }

  return prims;
}