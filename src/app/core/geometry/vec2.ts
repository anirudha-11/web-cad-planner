export type Vec2 = { x: number; y: number };

export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;
export const perp = (v: Vec2): Vec2 => ({ x: -v.y, y: v.x });
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (v: Vec2, s: number): Vec2 => ({ x: v.x * s, y: v.y * s });
export const len = (v: Vec2): number => Math.hypot(v.x, v.y);
export const normalize = (v: Vec2): Vec2 => {
  const l = len(v);
  return l < 1e-9 ? { x: 1, y: 0 } : { x: v.x / l, y: v.y / l };
};
