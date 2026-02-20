import type { RoomModel } from "../model/RoomModel";
import type { Vec2 } from "../core/geometry/vec2";

export type SegmentHit = {
  segIndex: number; // segment i -> i+1 (wraps)
  t: number;        // 0..1 along the segment
  distMm: number;
  point: Vec2;      // closest point on segment
};

export function hitTestInnerLoopSegment(room: RoomModel, p: Vec2, toleranceMm: number): SegmentHit | null {
  const loop = room.innerLoop;
  const n = loop.length;
  if (n < 2) return null;

  let best: SegmentHit | null = null;

  for (let i = 0; i < n; i++) {
    const a = loop[i];
    const b = loop[(i + 1) % n];

    const cp = closestPointOnSegment(p, a, b);
    const d = Math.hypot(p.x - cp.point.x, p.y - cp.point.y);

    if (d <= toleranceMm && (!best || d < best.distMm)) {
      best = { segIndex: i, t: cp.t, point: cp.point, distMm: d };
    }
  }

  return best;
}

export function getInnerLoopSegment(room: RoomModel, segIndex: number) {
  const loop = room.innerLoop;
  const n = loop.length;
  const a = loop[segIndex];
  const b = loop[(segIndex + 1) % n];
  return { a, b };
}

function closestPointOnSegment(p: Vec2, a: Vec2, b: Vec2) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = p.x - a.x;
  const apy = p.y - a.y;

  const abLen2 = abx * abx + aby * aby;
  if (abLen2 < 1e-9) return { t: 0, point: { x: a.x, y: a.y } };

  let t = (apx * abx + apy * aby) / abLen2;
  t = Math.max(0, Math.min(1, t));

  return { t, point: { x: a.x + t * abx, y: a.y + t * aby } };
}
