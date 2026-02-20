import type { RoomModel, Vec2 } from "../../model/RoomModel";
import type { WallOpeningEntity, EntityId } from "./entityTypes";
import type { ViewKind } from "../view/ViewKind";
import { edgeFacesDirection } from "../projection/deriveDraftScene";

// ── Segment helpers (same as windowGeometry) ──

function segEndpoints(room: RoomModel, segIdx: number): { a: Vec2; b: Vec2 } {
  const loop = room.innerLoop;
  const n = loop.length;
  return { a: loop[segIdx], b: loop[(segIdx + 1) % n] };
}

function segLen(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function segDir(a: Vec2, b: Vec2): Vec2 {
  const l = segLen(a, b);
  if (l < 1e-9) return { x: 1, y: 0 };
  return { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
}

function outwardNormal(dir: Vec2): Vec2 {
  return { x: dir.y, y: -dir.x };
}

// ── Plan rectangle ──

export type DoorPlanRect = {
  corners: [Vec2, Vec2, Vec2, Vec2];
  center: Vec2;
  dir: Vec2;
  normal: Vec2;
};

export function getDoorPlanRect(room: RoomModel, entity: WallOpeningEntity): DoorPlanRect {
  const { a, b } = segEndpoints(room, entity.attach.wallSegIndex);
  const d = segDir(a, b);
  const n = outwardNormal(d);
  const t = entity.attach.t;
  const hw = entity.widthMm / 2;
  const T = room.wallThickness;

  const cx = a.x + t * (b.x - a.x);
  const cy = a.y + t * (b.y - a.y);

  const corners: [Vec2, Vec2, Vec2, Vec2] = [
    { x: cx - d.x * hw, y: cy - d.y * hw },
    { x: cx + d.x * hw, y: cy + d.y * hw },
    { x: cx + d.x * hw + n.x * T, y: cy + d.y * hw + n.y * T },
    { x: cx - d.x * hw + n.x * T, y: cy - d.y * hw + n.y * T },
  ];

  return { corners, center: { x: cx, y: cy }, dir: d, normal: n };
}

// ── Elevation rectangle ──

export type DoorElevRect = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

export function getDoorElevationRect(
  room: RoomModel,
  entity: WallOpeningEntity,
  view: Exclude<ViewKind, "plan">,
): DoorElevRect | null {
  const segIdx = entity.attach.wallSegIndex;
  if (!edgeFacesDirection(room.innerLoop, segIdx, view)) return null;

  const loop = room.innerLoop;
  const isNS = view === "north" || view === "south";

  let minX = Infinity, maxX = -Infinity;
  for (const p of loop) {
    const v = isNS ? p.x : p.y;
    minX = Math.min(minX, v);
    maxX = Math.max(maxX, v);
  }
  const originH = minX;

  const { a, b } = segEndpoints(room, segIdx);
  const aH = (isNS ? a.x : a.y) - originH;
  const bH = (isNS ? b.x : b.y) - originH;
  const startH = Math.min(aH, bH);
  const segLength = Math.abs(bH - aH);

  const centerH = startH + entity.attach.t * segLength;
  const hw = entity.widthMm / 2;

  const sillH = entity.sillHeightMm ?? 0;
  const H = room.wallHeight;

  const y0 = H - sillH - entity.heightMm;
  const y1 = H - sillH;

  return { x0: centerH - hw, y0, x1: centerH + hw, y1 };
}

// ── Snap to wall ──

export type SnapResult = {
  wallSegIndex: number;
  t: number;
  point: Vec2;
};

export function snapDoorToWall(
  room: RoomModel,
  worldPt: Vec2,
  doorWidthMm: number,
  toleranceMm: number,
): SnapResult | null {
  const loop = room.innerLoop;
  const n = loop.length;
  let best: (SnapResult & { dist: number }) | null = null;

  for (let i = 0; i < n; i++) {
    const a = loop[i];
    const b = loop[(i + 1) % n];
    const ab = { x: b.x - a.x, y: b.y - a.y };
    const abLen2 = ab.x * ab.x + ab.y * ab.y;
    if (abLen2 < 1) continue;

    const ap = { x: worldPt.x - a.x, y: worldPt.y - a.y };
    let rawT = (ap.x * ab.x + ap.y * ab.y) / abLen2;

    const sLen = Math.sqrt(abLen2);
    const halfW = doorWidthMm / 2;
    const minT = halfW / sLen;
    const maxT = 1 - halfW / sLen;
    if (maxT < minT) continue;

    rawT = Math.max(minT, Math.min(maxT, rawT));

    const px = a.x + rawT * ab.x;
    const py = a.y + rawT * ab.y;
    const dist = Math.hypot(worldPt.x - px, worldPt.y - py);

    if (dist <= toleranceMm && (!best || dist < best.dist)) {
      best = { wallSegIndex: i, t: rawT, point: { x: px, y: py }, dist };
    }
  }

  return best ? { wallSegIndex: best.wallSegIndex, t: best.t, point: best.point } : null;
}

// ── Hit test door entities ──

export function hitTestDoors(
  room: RoomModel,
  worldPt: Vec2,
  toleranceMm: number,
): EntityId | null {
  for (const entity of Object.values(room.entities)) {
    if (entity.kind !== "wall-opening" || entity.openingType !== "door") continue;
    const rect = getDoorPlanRect(room, entity);
    if (pointInQuad(worldPt, rect.corners, toleranceMm)) return entity.id;
  }
  return null;
}

export function hitTestDoorsElevation(
  room: RoomModel,
  view: Exclude<ViewKind, "plan">,
  worldPt: Vec2,
  toleranceMm: number,
): EntityId | null {
  for (const entity of Object.values(room.entities)) {
    if (entity.kind !== "wall-opening" || entity.openingType !== "door") continue;
    const r = getDoorElevationRect(room, entity, view);
    if (!r) continue;
    if (
      worldPt.x >= r.x0 - toleranceMm &&
      worldPt.x <= r.x1 + toleranceMm &&
      worldPt.y >= r.y0 - toleranceMm &&
      worldPt.y <= r.y1 + toleranceMm
    ) {
      return entity.id;
    }
  }
  return null;
}

function pointInQuad(p: Vec2, corners: Vec2[], tol: number): boolean {
  const expanded = expandQuad(corners, tol);
  return pointInPolygon(p, expanded);
}

function expandQuad(corners: Vec2[], tol: number): Vec2[] {
  const cx = corners.reduce((s, c) => s + c.x, 0) / corners.length;
  const cy = corners.reduce((s, c) => s + c.y, 0) / corners.length;
  return corners.map((c) => {
    const dx = c.x - cx;
    const dy = c.y - cy;
    const d = Math.hypot(dx, dy);
    if (d < 1e-9) return c;
    return { x: c.x + (dx / d) * tol, y: c.y + (dy / d) * tol };
  });
}

function pointInPolygon(p: Vec2, poly: Vec2[]): boolean {
  let inside = false;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    if ((yi > p.y) !== (yj > p.y) && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// ── Reposition by dimension value ──

export function repositionDoorByDim(
  room: RoomModel,
  entity: WallOpeningEntity,
  side: "left" | "right",
  newDistMm: number,
): WallOpeningEntity {
  const { a, b } = segEndpoints(room, entity.attach.wallSegIndex);
  const sLen = segLen(a, b);
  const hw = entity.widthMm / 2;

  let centerDist: number;
  if (side === "left") {
    centerDist = newDistMm + hw;
  } else {
    centerDist = sLen - newDistMm - hw;
  }

  const minCenter = hw;
  const maxCenter = sLen - hw;
  centerDist = Math.max(minCenter, Math.min(maxCenter, centerDist));

  const newT = sLen > 0 ? centerDist / sLen : 0.5;
  return { ...entity, attach: { ...entity.attach, t: newT } };
}

// ── Edge distances (for dimension lines during placement) ──

export type DoorEdgeDistances = {
  leftDist: number;
  rightDist: number;
  leftPt: Vec2;
  rightPt: Vec2;
  doorLeftPt: Vec2;
  doorRightPt: Vec2;
};

export function doorEdgeDistances(
  room: RoomModel,
  entity: WallOpeningEntity,
): DoorEdgeDistances {
  const { a, b } = segEndpoints(room, entity.attach.wallSegIndex);
  const sLen = segLen(a, b);
  const t = entity.attach.t;
  const hw = entity.widthMm / 2;

  const centerDist = t * sLen;
  const leftDist = centerDist - hw;
  const rightDist = sLen - centerDist - hw;

  const d = segDir(a, b);
  const doorLeftPt = { x: a.x + d.x * (centerDist - hw), y: a.y + d.y * (centerDist - hw) };
  const doorRightPt = { x: a.x + d.x * (centerDist + hw), y: a.y + d.y * (centerDist + hw) };

  return {
    leftDist: Math.max(0, leftDist),
    rightDist: Math.max(0, rightDist),
    leftPt: a,
    rightPt: b,
    doorLeftPt,
    doorRightPt,
  };
}
