import type { DraftPrimitive, DraftScene, StrokeStyle, polygon, dimension, hatchFill } from "./draftPrimitives";
import type { Viewport2D, Vec2 } from "./Viewport2D";

export class CanvasRenderer2D {
  constructor(private ctx: CanvasRenderingContext2D, private viewport: Viewport2D) {}

  draw(scene: DraftScene, canvasW: number, canvasH: number) {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvasW, canvasH);

    this.drawGrid(canvasW, canvasH);

    for (const p of scene.primitives) this.drawPrim(p);
  }

  private drawPrim(p: DraftPrimitive) {
    const ctx = this.ctx;

    if (p.kind === "line") {
      const a = this.viewport.worldToScreen(p.a);
      const b = this.viewport.worldToScreen(p.b);

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);

      applyStroke(ctx, p.stroke, this.viewport);
      ctx.stroke();
      ctx.setLineDash([]);
      return;
    }

    if (p.kind === "polygon") {
      this.drawPolygon(p);
      return;
    }

    if (p.kind === "hatchFill") {
      this.drawHatchFill(p);
      return;
    }

    if (p.kind === "dimension") {
      this.drawDimension(p);
      return;
    }

    if (p.kind === "polyline") {
      if (p.pts.length < 2) return;
      const pts = p.pts.map((q) => this.viewport.worldToScreen(q));

      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      if (p.closed) ctx.closePath();

      if (p.fill) {
        ctx.fillStyle = p.fill.color;
        ctx.fill();
      }

      applyStroke(ctx, p.stroke, this.viewport);
      ctx.stroke();
      ctx.setLineDash([]);
      return;
    }

    if (p.kind === "text") {
      const at = this.viewport.worldToScreen(p.at);
      const px = mmToPx(p.sizeMm, this.viewport);

      ctx.save();
      ctx.translate(at.x, at.y);
      if (p.angleDeg) ctx.rotate((p.angleDeg * Math.PI) / 180);

      ctx.fillStyle = p.color;
      ctx.font = `${px}px Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial`;
      ctx.textBaseline = "alphabetic";
      ctx.fillText(p.text, 0, 0);
      ctx.restore();
    }
  }

  private drawGrid(w: number, h: number) {
    const ctx = this.ctx;

    const major = 1000; // 1m
    const minor = 100;  // 100mm

    const tl = this.viewport.screenToWorld({ x: 0, y: 0 });
    const br = this.viewport.screenToWorld({ x: w, y: h });

    const minorPx = mmToPx(minor, this.viewport);
    const drawMinor = minorPx >= 6;

    if (drawMinor) {
      ctx.strokeStyle = "rgba(0, 0, 0, 0.05)";
      ctx.lineWidth = 1;
      ctx.setLineDash([]);

      const startX = Math.floor(tl.x / minor) * minor;
      const endX = Math.ceil(br.x / minor) * minor;
      for (let x = startX; x <= endX; x += minor) {
        const a = this.viewport.worldToScreen({ x, y: tl.y });
        const b = this.viewport.worldToScreen({ x, y: br.y });
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      const startY = Math.floor(tl.y / minor) * minor;
      const endY = Math.ceil(br.y / minor) * minor;
      for (let y = startY; y <= endY; y += minor) {
        const a = this.viewport.worldToScreen({ x: tl.x, y });
        const b = this.viewport.worldToScreen({ x: br.x, y });
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
    ctx.lineWidth = 1;
    ctx.setLineDash([]);

    const startX2 = Math.floor(tl.x / major) * major;
    const endX2 = Math.ceil(br.x / major) * major;
    for (let x = startX2; x <= endX2; x += major) {
      const a = this.viewport.worldToScreen({ x, y: tl.y });
      const b = this.viewport.worldToScreen({ x, y: br.y });
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    const startY2 = Math.floor(tl.y / major) * major;
    const endY2 = Math.ceil(br.y / major) * major;
    for (let y = startY2; y <= endY2; y += major) {
      const a = this.viewport.worldToScreen({ x: tl.x, y });
      const b = this.viewport.worldToScreen({ x: br.x, y });
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  private drawPolygon(p: polygon) {
    const ctx = this.ctx;

    // Fill with even-odd rule so holes work
    if (p.fill) {
      ctx.save();
      ctx.fillStyle = p.fill.color;

      ctx.beginPath();
      this.pathLoop(p.outer);

      if (p.holes) {
        for (const hole of p.holes) this.pathLoop(hole);
      }

      ctx.fill("evenodd");
      ctx.restore();
    }

    // Stroke only the rings you want (no seams)
    if (p.strokeOuter) {
      this.strokeLoop(p.outer, p.strokeOuter);
    }
    if (p.strokeHoles && p.holes) {
      for (const hole of p.holes) this.strokeLoop(hole, p.strokeHoles);
    }
  }

  private pathLoop(loop: Vec2[]) {
    const ctx = this.ctx;
    if (!loop.length) return;

    const p0 = this.viewport.worldToScreen(loop[0]);
    ctx.moveTo(p0.x, p0.y);

    for (let i = 1; i < loop.length; i++) {
      const pi = this.viewport.worldToScreen(loop[i]);
      ctx.lineTo(pi.x, pi.y);
    }

    ctx.closePath();
  }

  private strokeLoop(loop: Vec2[], stroke: StrokeStyle) {
    const ctx = this.ctx;
    if (!loop.length) return;

    ctx.save();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = mmToPx(stroke.widthMm, this.viewport);
    ctx.setLineDash(stroke.dashMm?.length ? stroke.dashMm.map((d) => mmToPx(d, this.viewport)) : []);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    const p0 = this.viewport.worldToScreen(loop[0]);
    ctx.moveTo(p0.x, p0.y);
    for (let i = 1; i < loop.length; i++) {
      const pi = this.viewport.worldToScreen(loop[i]);
      ctx.lineTo(pi.x, pi.y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  private drawDimension(d: dimension) {
    const stroke: StrokeStyle = d.stroke ?? { color: "rgba(0,0,0,0.65)", widthMm: 0.18 };
    const textColor = d.textColor ?? "rgba(0,0,0,0.75)";
    const textSizeMm = d.textSizeMm ?? 90;
    const tickSizeMm = d.arrowSizeMm ?? 90;

    const a = d.a;
    const b = d.b;

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const L = Math.hypot(dx, dy);
    if (L < 1e-6) return;

    const tx = dx / L;
    const ty = dy / L;

    // Unit normal (perp)
    const nx = -ty;
    const ny = tx;

    const side = d.side ?? "in";
    const sgn = side === "in" ? -1 : 1;

    const off = (d.offsetMm ?? 200) * sgn;

    const a2: Vec2 = { x: a.x + nx * off, y: a.y + ny * off };
    const b2: Vec2 = { x: b.x + nx * off, y: b.y + ny * off };

    // Extension + dimension line
    this.strokeLine(a, a2, stroke);
    this.strokeLine(b, b2, stroke);
    this.strokeLine(a2, b2, stroke);

    // Architectural ticks (CAD-style)
    const thickTick: StrokeStyle = { color: "rgba(0,0,0,0.85)", widthMm: 2 };
    this.drawTick(a2, { tx, ty }, tickSizeMm, thickTick);
    this.drawTick(b2, { tx, ty }, tickSizeMm, thickTick);

    // Text at mid
    const mid: Vec2 = { x: (a2.x + b2.x) / 2, y: (a2.y + b2.y) / 2 };
    const label = d.text ?? `${Math.round(L)}`;

    this.drawDimText(label, mid, { tx, ty }, textSizeMm, textColor);
  }

  private drawTick(
    atWorld: Vec2,
    t: { tx: number; ty: number },
    sizeMm: number,
    stroke: StrokeStyle
  ) {
    const half = sizeMm * 0.5;

    const nx = -t.ty;
    const ny = t.tx;

    const vx = t.tx + nx;
    const vy = t.ty + ny;
    const vLen = Math.hypot(vx, vy) || 1;

    const ux = vx / vLen;
    const uy = vy / vLen;

    const p0: Vec2 = { x: atWorld.x + ux * half, y: atWorld.y - uy * half };
    const p1: Vec2 = { x: atWorld.x - ux * half, y: atWorld.y + uy * half };

    this.strokeLine(p0, p1, stroke);
  }

  private strokeLine(a: Vec2, b: Vec2, stroke: StrokeStyle) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = mmToPx(stroke.widthMm, this.viewport);
    ctx.setLineDash(stroke.dashMm?.length ? stroke.dashMm.map((d) => mmToPx(d, this.viewport)) : []);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const A = this.viewport.worldToScreen(a);
    const B = this.viewport.worldToScreen(b);

    ctx.beginPath();
    ctx.moveTo(A.x, A.y);
    ctx.lineTo(B.x, B.y);
    ctx.stroke();
    ctx.restore();
  }

  private drawDimText(
    text: string,
    atWorld: Vec2,
    t: { tx: number; ty: number },
    sizeMm: number,
    color: string
  ) {
    const ctx = this.ctx;
    const p = this.viewport.worldToScreen(atWorld);

    let ang = Math.atan2(t.ty, t.tx);
    if (ang > Math.PI / 2 || ang < -Math.PI / 2) ang += Math.PI;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(ang);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${mmToPx(sizeMm, this.viewport)}px system-ui`;

    const pad = mmToPx(40, this.viewport);
    const w = ctx.measureText(text).width;

    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillRect(-w / 2 - pad, -pad, w + pad * 2, pad * 2);

    ctx.fillStyle = color;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  // ── Hatch fill rendering ──

  private drawHatchFill(h: hatchFill) {
    const ctx = this.ctx;
    ctx.save();

    if (h.opacity < 1) ctx.globalAlpha = h.opacity;

    ctx.beginPath();
    this.pathLoop(h.outer);
    if (h.holes) {
      for (const hole of h.holes) this.pathLoop(hole);
    }
    ctx.clip("evenodd");

    if (h.bgColor && h.bgColor !== "transparent") {
      ctx.fillStyle = h.bgColor;
      ctx.fill("evenodd");
    }

    if (h.patternId === "solid") {
      ctx.fillStyle = h.color;
      ctx.fill("evenodd");
    } else if (h.patternId === "dots") {
      this.drawDots(h);
    } else if (h.patternId !== "none") {
      this.drawHatchLines(h);
    }

    ctx.restore();
  }

  private screenBoundsOf(pts: Vec2[]) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
      const s = this.viewport.worldToScreen(p);
      minX = Math.min(minX, s.x);
      minY = Math.min(minY, s.y);
      maxX = Math.max(maxX, s.x);
      maxY = Math.max(maxY, s.y);
    }
    return { minX, minY, maxX, maxY };
  }

  private hatchAngles(patternId: string, fallback: number): number[] {
    switch (patternId) {
      case "diagonal-right": return [45];
      case "diagonal-left":  return [135];
      case "crosshatch":     return [45, 135];
      case "horizontal":     return [0];
      case "vertical":       return [90];
      case "grid":           return [0, 90];
      default:               return [fallback];
    }
  }

  private drawHatchLines(h: hatchFill) {
    const bb = this.screenBoundsOf(h.outer);
    const spacingPx = Math.max(4, h.spacingMm * this.viewport.scale);
    const lineWidthPx = Math.max(0.5, h.lineWidthMm * this.viewport.scale);

    const ctx = this.ctx;
    ctx.strokeStyle = h.color;
    ctx.lineWidth = lineWidthPx;
    ctx.setLineDash([]);
    ctx.lineCap = "butt";

    const angles = this.hatchAngles(h.patternId, h.angleDeg);

    for (const deg of angles) {
      const rad = (deg * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const perpX = -sin;
      const perpY = cos;

      const cx = (bb.minX + bb.maxX) / 2;
      const cy = (bb.minY + bb.maxY) / 2;
      const diag = Math.hypot(bb.maxX - bb.minX, bb.maxY - bb.minY) * 0.75;
      const count = Math.ceil(diag / spacingPx);

      ctx.beginPath();
      for (let i = -count; i <= count; i++) {
        const off = i * spacingPx;
        const px = cx + perpX * off;
        const py = cy + perpY * off;
        ctx.moveTo(px - cos * diag, py - sin * diag);
        ctx.lineTo(px + cos * diag, py + sin * diag);
      }
      ctx.stroke();
    }
  }

  private drawDots(h: hatchFill) {
    const bb = this.screenBoundsOf(h.outer);
    const spacingPx = Math.max(6, h.spacingMm * this.viewport.scale);
    const radius = Math.max(1, h.lineWidthMm * this.viewport.scale * 0.8);

    const ctx = this.ctx;
    ctx.fillStyle = h.color;

    ctx.beginPath();
    for (let x = bb.minX; x <= bb.maxX; x += spacingPx) {
      for (let y = bb.minY; y <= bb.maxY; y += spacingPx) {
        ctx.moveTo(x + radius, y);
        ctx.arc(x, y, radius, 0, Math.PI * 2);
      }
    }
    ctx.fill();
  }
}

// helpers (typed)

function mmToPx(mm: number, viewport: Viewport2D) {
  return mm * viewport.scale;
}

function applyStroke(ctx: CanvasRenderingContext2D, stroke: StrokeStyle, viewport: Viewport2D) {
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = Math.max(1, stroke.widthMm * viewport.scale);

  if (stroke.dashMm?.length) {
    ctx.setLineDash(stroke.dashMm.map((d) => d * viewport.scale));
  } else {
    ctx.setLineDash([]);
  }

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}
