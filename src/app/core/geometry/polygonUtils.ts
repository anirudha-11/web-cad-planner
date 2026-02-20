import type { Vec2 } from "./vec2";

export function pointInQuad(p: Vec2, corners: Vec2[], tol: number): boolean {
  const expanded = expandQuad(corners, tol);
  return pointInPolygon(p, expanded);
}

export function expandQuad(corners: Vec2[], tol: number): Vec2[] {
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

export function pointInPolygon(p: Vec2, poly: Vec2[]): boolean {
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
