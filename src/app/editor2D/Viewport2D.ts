export type Vec2 = { x: number; y: number };

export class Viewport2D {
  // world mm → screen px: screen = (world - origin) * scale
  public origin: Vec2 = { x: -2000, y: -2000 }; // top-left world mm
  public scale = 0.2; // px per mm (0.2 => 1m = 200px)
  public readonly minScale = 0.02;
  public readonly maxScale = 5;

  worldToScreen(p: Vec2): Vec2 {
    return { x: (p.x - this.origin.x) * this.scale, y: (p.y - this.origin.y) * this.scale };
  }

  screenToWorld(p: Vec2): Vec2 {
    return { x: p.x / this.scale + this.origin.x, y: p.y / this.scale + this.origin.y };
  }

  panByScreen(dxPx: number, dyPx: number) {
    this.origin.x -= dxPx / this.scale;
    this.origin.y -= dyPx / this.scale;
  }

    fitToWorldBounds(bounds: { min: Vec2; max: Vec2 }, viewportPx: { w: number; h: number }, paddingPx = 24) {
    const wPx = Math.max(1, viewportPx.w - paddingPx * 2);
    const hPx = Math.max(1, viewportPx.h - paddingPx * 2);

    const bw = Math.max(1e-6, bounds.max.x - bounds.min.x);
    const bh = Math.max(1e-6, bounds.max.y - bounds.min.y);

    // choose scale that fits both directions
    const sx = wPx / bw;
    const sy = hPx / bh;
    this.scale = clamp(Math.min(sx, sy), this.minScale, this.maxScale);

    // center bounds in viewport
    const contentWWorld = wPx / this.scale;
    const contentHWorld = hPx / this.scale;

    const cx = (bounds.min.x + bounds.max.x) * 0.5;
    const cy = (bounds.min.y + bounds.max.y) * 0.5;

    this.origin.x = cx - contentWWorld * 0.5;
    this.origin.y = cy - contentHWorld * 0.5;
  }


  zoomAtScreen(factor: number, anchorPx: Vec2) {
    const before = this.screenToWorld(anchorPx);
    this.scale = clamp(this.scale * factor, this.minScale, this.maxScale);
    const after = this.screenToWorld(anchorPx);
    // keep anchor world point under cursor
    this.origin.x += before.x - after.x;
    this.origin.y += before.y - after.y;
  }
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}
