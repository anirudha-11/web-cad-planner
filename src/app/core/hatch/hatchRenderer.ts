import type { hatchFill } from "../../editor2D/draftPrimitives";
import type { Viewport2D, Vec2 } from "../../editor2D/Viewport2D";

function pathLoop(ctx: CanvasRenderingContext2D, viewport: Viewport2D, loop: Vec2[]): void {
  if (!loop.length) return;
  const p0 = viewport.worldToScreen(loop[0]);
  ctx.moveTo(p0.x, p0.y);
  for (let i = 1; i < loop.length; i++) {
    const pi = viewport.worldToScreen(loop[i]);
    ctx.lineTo(pi.x, pi.y);
  }
  ctx.closePath();
}

function screenBoundsOf(viewport: Viewport2D, pts: Vec2[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    const s = viewport.worldToScreen(p);
    minX = Math.min(minX, s.x);
    minY = Math.min(minY, s.y);
    maxX = Math.max(maxX, s.x);
    maxY = Math.max(maxY, s.y);
  }
  return { minX, minY, maxX, maxY };
}

function hatchAngles(patternId: string, fallback: number): number[] {
  switch (patternId) {
    case "diagonal-right": return [45];
    case "diagonal-left":  return [135];
    case "arch-cut-wall":  return [135];
    case "crosshatch":     return [45, 135];
    case "horizontal":     return [0];
    case "vertical":       return [90];
    case "grid":           return [0, 90];
    default:               return [fallback];
  }
}

function drawHatchLines(ctx: CanvasRenderingContext2D, viewport: Viewport2D, h: hatchFill, bb: { minX: number; minY: number; maxX: number; maxY: number }): void {
  const spacingPx = Math.max(4, h.spacingMm * viewport.scale);
  const lineWidthPx = Math.max(0.5, h.lineWidthMm * viewport.scale);
  const pairGapPx = h.pair?.enabled && h.pair.gapMm > 0
    ? Math.max(1, h.pair.gapMm * viewport.scale)
    : 0;
  const halfGap = pairGapPx * 0.5;

  ctx.strokeStyle = h.color;
  ctx.lineWidth = lineWidthPx;
  ctx.setLineDash([]);
  ctx.lineCap = "butt";

  const angles = hatchAngles(h.patternId, h.angleDeg);
  const cx = (bb.minX + bb.maxX) / 2;
  const cy = (bb.minY + bb.maxY) / 2;
  const diag = Math.hypot(bb.maxX - bb.minX, bb.maxY - bb.minY) * 0.75;

  for (const deg of angles) {
    const rad = (deg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const perpX = -sin;
    const perpY = cos;
    const count = Math.ceil(diag / spacingPx);

    const drawStripes = (offsetPerp: number) => {
      ctx.beginPath();
      for (let i = -count; i <= count; i++) {
        const off = i * spacingPx;
        const px = cx + perpX * off + perpX * offsetPerp;
        const py = cy + perpY * off + perpY * offsetPerp;
        ctx.moveTo(px - cos * diag, py - sin * diag);
        ctx.lineTo(px + cos * diag, py + sin * diag);
      }
      ctx.stroke();
    };

    if (halfGap > 0) {
      drawStripes(-halfGap);
      drawStripes(halfGap);
    } else {
      drawStripes(0);
    }
  }
}

function drawDots(ctx: CanvasRenderingContext2D, viewport: Viewport2D, h: hatchFill, bb: { minX: number; minY: number; maxX: number; maxY: number }): void {
  const spacingPx = Math.max(6, h.spacingMm * viewport.scale);
  const radius = Math.max(1, h.lineWidthMm * viewport.scale * 0.8);

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

function drawRectangleHatch(ctx: CanvasRenderingContext2D, viewport: Viewport2D, h: hatchFill, bb: { minX: number; minY: number; maxX: number; maxY: number }): void {
  const lengthMm = h.tileLengthMm ?? h.spacingMm;
  const widthMm = h.tileWidthMm ?? h.spacingMm;
  const stepXPx = Math.max(8, lengthMm * viewport.scale);
  const stepYPx = Math.max(8, widthMm * viewport.scale);
  const lineWidthPx = Math.max(0.5, h.lineWidthMm * viewport.scale);

  ctx.strokeStyle = h.color;
  ctx.lineWidth = lineWidthPx;
  ctx.setLineDash([]);
  ctx.lineCap = "butt";

  const startX = Math.floor(bb.minX / stepXPx) * stepXPx;
  const startY = Math.floor(bb.minY / stepYPx) * stepYPx;

  ctx.beginPath();
  for (let x = startX; x <= bb.maxX; x += stepXPx) {
    ctx.moveTo(x, bb.minY);
    ctx.lineTo(x, bb.maxY);
  }
  for (let y = startY; y <= bb.maxY; y += stepYPx) {
    ctx.moveTo(bb.minX, y);
    ctx.lineTo(bb.maxX, y);
  }
  ctx.stroke();
}

function drawBrickHatch(ctx: CanvasRenderingContext2D, viewport: Viewport2D, h: hatchFill, bb: { minX: number; minY: number; maxX: number; maxY: number }): void {
  const lengthMm = h.tileLengthMm ?? h.spacingMm;
  const widthMm = h.tileWidthMm ?? h.spacingMm * 0.5;
  const brickWPx = Math.max(8, lengthMm * viewport.scale);
  const brickHPx = Math.max(6, widthMm * viewport.scale);
  const lineWidthPx = Math.max(0.5, h.lineWidthMm * viewport.scale);

  ctx.strokeStyle = h.color;
  ctx.lineWidth = lineWidthPx;
  ctx.setLineDash([]);
  ctx.lineCap = "butt";

  const startY = Math.floor(bb.minY / brickHPx) * brickHPx;

  ctx.beginPath();
  for (let y = startY; y <= bb.maxY; y += brickHPx) {
    ctx.moveTo(bb.minX, y);
    ctx.lineTo(bb.maxX, y);
  }
  for (let row = 0; ; row++) {
    const y0 = startY + row * brickHPx;
    const y1 = y0 + brickHPx;
    if (y0 >= bb.maxY) break;
    const offsetX = row % 2 === 0 ? 0 : brickWPx / 2;
    const startX = Math.floor((bb.minX - offsetX) / brickWPx) * brickWPx + offsetX;
    for (let x = startX; x <= bb.maxX; x += brickWPx) {
      ctx.moveTo(x, Math.max(y0, bb.minY));
      ctx.lineTo(x, Math.min(y1, bb.maxY));
    }
  }
  ctx.stroke();
}

function drawHerringboneHatch(ctx: CanvasRenderingContext2D, viewport: Viewport2D, h: hatchFill, bb: { minX: number; minY: number; maxX: number; maxY: number }): void {
  const lengthMm = h.tileLengthMm ?? h.spacingMm;
  const widthMm = h.tileWidthMm ?? h.spacingMm * 0.5;
  const spacing1Px = Math.max(6, lengthMm * viewport.scale);
  const spacing2Px = Math.max(6, widthMm * viewport.scale);
  const lineWidthPx = Math.max(0.5, h.lineWidthMm * viewport.scale);

  ctx.strokeStyle = h.color;
  ctx.lineWidth = lineWidthPx;
  ctx.setLineDash([]);
  ctx.lineCap = "butt";

  const cx = (bb.minX + bb.maxX) / 2;
  const cy = (bb.minY + bb.maxY) / 2;
  const diag = Math.hypot(bb.maxX - bb.minX, bb.maxY - bb.minY) * 0.6;

  for (const [angleDeg, spacingPx, phase] of [
    [45, spacing1Px, 0],
    [-45, spacing2Px, 0.5],
  ] as const) {
    const rad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const perpX = -sin;
    const perpY = cos;
    const count = Math.ceil(diag / spacingPx) + 2;
    const phaseOff = phase * spacingPx;

    ctx.beginPath();
    for (let i = -count; i <= count; i++) {
      const off = i * spacingPx + phaseOff;
      const px = cx + perpX * off;
      const py = cy + perpY * off;
      ctx.moveTo(px - cos * diag, py - sin * diag);
      ctx.lineTo(px + cos * diag, py + sin * diag);
    }
    ctx.stroke();
  }
}

/**
 * Draw a single hatch fill primitive into the current canvas context.
 * Caller must have set up the context; this applies clip, optional background, and pattern.
 */
export function drawHatchFill(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport2D,
  h: hatchFill,
): void {
  ctx.save();

  if (h.opacity < 1) ctx.globalAlpha = h.opacity;

  ctx.beginPath();
  pathLoop(ctx, viewport, h.outer);
  if (h.holes) {
    for (const hole of h.holes) pathLoop(ctx, viewport, hole);
  }
  ctx.clip("evenodd");

  if (h.bgColor && h.bgColor !== "transparent") {
    ctx.fillStyle = h.bgColor;
    ctx.fill("evenodd");
  }

  if (h.patternId === "solid") {
    ctx.fillStyle = h.color;
    ctx.fill("evenodd");
  } else {
    const bb = screenBoundsOf(viewport, h.outer);
    if (h.patternId === "dots") {
      drawDots(ctx, viewport, h, bb);
    } else if (h.patternId === "rectangle") {
      drawRectangleHatch(ctx, viewport, h, bb);
    } else if (h.patternId === "brick") {
      drawBrickHatch(ctx, viewport, h, bb);
    } else if (h.patternId === "herringbone") {
      drawHerringboneHatch(ctx, viewport, h, bb);
    } else if (h.patternId !== "none") {
      drawHatchLines(ctx, viewport, h, bb);
    }
  }

  ctx.restore();
}
