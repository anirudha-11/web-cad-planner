import type { DraftPrimitive } from "../rendering/draftPrimitives";
import type { RoomModel } from "../../model/RoomModel";
import type { Vec2 } from "../geometry/vec2";
import { dot, perp } from "../geometry/vec2";
import type { ViewKind } from "../view/ViewKind";
import type { WallOpeningEntity } from "../entities/entityTypes";
import { getDoorPlanRect, getDoorElevationRect } from "../entities/doorGeometry";

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

export function buildDoorPlanPrimitives(room: RoomModel, entity: WallOpeningEntity): DraftPrimitive[] {
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

export function buildDoorElevPrimitives(
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

  prims.push({ kind: "polygon" as const, outer, fill: DOOR_FILL, strokeOuter: DOOR_STROKE });

  const style = entity.doorStyle ?? "single-leaf";
  const midX = (r.x0 + r.x1) / 2;

  if (style === "double-leaf") {
    prims.push({ kind: "line" as const, a: { x: midX, y: r.y0 }, b: { x: midX, y: r.y1 }, stroke: DOOR_STROKE });
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
