import type { DraftPrimitive } from "../rendering/draftPrimitives";
import type { RoomModel } from "../../model/RoomModel";
import type { Vec2 } from "../geometry/vec2";
import { dot, perp } from "../geometry/vec2";
import type { ViewKind } from "../view/ViewKind";
import type { WallOpeningEntity } from "../entities/entityTypes";
import { getWindowPlanRect, getWindowElevationRect } from "../entities/windowGeometry";

const WIN_STROKE = { color: "rgb(0, 0, 0)", widthMm: 5 };
const WIN_FILL = { color: "rgb(255, 255, 255)" };
const WIN_STROKE_RECT = { color: "rgb(255, 255, 255)", widthMm: 1 };

export function buildWindowPlanPrimitives(room: RoomModel, entity: WallOpeningEntity): DraftPrimitive[] {
  const prims: DraftPrimitive[] = [];
  const rect = getWindowPlanRect(room, entity);

  const corners = rect.corners as Vec2[];
  const n = rect.normal as Vec2;
  const t = perp(n);

  const proj = corners.map((p) => ({ p, s: dot(p, t), u: dot(p, n) }));
  const sMin = Math.min(...proj.map((q) => q.s));
  const sMax = Math.max(...proj.map((q) => q.s));
  const uMin = Math.min(...proj.map((q) => q.u));
  const uMax = Math.max(...proj.map((q) => q.u));

  const epsS = Math.max(1e-6, (sMax - sMin) * 1e-6);

  const pickEdgeAtS = (targetS: number) => {
    let pts = proj.filter((q) => Math.abs(q.s - targetS) <= epsS).map((q) => q.p);
    if (pts.length !== 2) {
      pts = proj
        .slice()
        .sort((a, b) => Math.abs(a.s - targetS) - Math.abs(b.s - targetS))
        .slice(0, 2)
        .map((q) => q.p);
    }
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
    prims.push({ kind: "line" as const, a: mid0, b: mid2, stroke: WIN_STROKE });
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

export function buildWindowElevPrimitives(
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

  prims.push({ kind: "polygon" as const, outer, fill: WIN_FILL, strokeOuter: WIN_STROKE });

  const style = entity.windowStyle ?? "single-leaf";
  const midX = (r.x0 + r.x1) / 2;

  if (style === "double-leaf") {
    prims.push({ kind: "line" as const, a: { x: midX, y: r.y0 }, b: { x: midX, y: r.y1 }, stroke: WIN_STROKE });
  } else if (style === "fixed") {
    prims.push(
      { kind: "line" as const, a: { x: r.x0, y: r.y0 }, b: { x: r.x1, y: r.y1 }, stroke: { ...WIN_STROKE, widthMm: 1 } },
      { kind: "line" as const, a: { x: r.x1, y: r.y0 }, b: { x: r.x0, y: r.y1 }, stroke: { ...WIN_STROKE, widthMm: 1 } },
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
