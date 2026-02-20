import type { Vec2 } from "./vec2";
import type { RoomModel } from "../../model/RoomModel";

export function segEndpoints(room: RoomModel, segIdx: number): { a: Vec2; b: Vec2 } {
  const loop = room.innerLoop;
  const n = loop.length;
  return { a: loop[segIdx], b: loop[(segIdx + 1) % n] };
}

export function segLen(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function segDir(a: Vec2, b: Vec2): Vec2 {
  const l = segLen(a, b);
  if (l < 1e-9) return { x: 1, y: 0 };
  return { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
}

/** CW outward normal: (dy, -dx) of the direction vector */
export function outwardNormal(dir: Vec2): Vec2 {
  return { x: dir.y, y: -dir.x };
}
