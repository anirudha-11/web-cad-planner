import type { DraftScene } from "../../editor2D/draftPrimitives";
import type { RoomModel } from "../../model/RoomModel";
import type { ViewKind } from "../view/ViewKind";
import { offsetOrthoLoop } from "../../editor2D/offsetOrthoLoop";
import type { Vec2 } from "../../editor2D/draftPrimitives";
import { DIMENSION_DEFAULTS } from "../../editor2D/dimensionDefaults";

export function deriveDraftScene(view: ViewKind, room: RoomModel): DraftScene {
  if (view === "plan") return derivePlanScene(room);
  return deriveElevationScene(view, room);
}

function derivePlanScene(room: RoomModel): DraftScene {
  const inner = room.innerLoop;
  const t = room.wallThickness;

  const outer = offsetOrthoLoop(inner, t);

  const wallFill = "rgb(255, 255, 255)";
  const outline = "rgba(0,0,0,0.9)";

  const primitives: DraftScene["primitives"] = [
    {
      kind: "polygon" as const,
      outer,
      holes: [inner],
      fill: { color: wallFill },
      strokeOuter: { color: outline, widthMm: 5 },
      strokeHoles: { color: outline, widthMm: 5 },
    },
  ];

  const dimOffset = DIMENSION_DEFAULTS.offsetMm;
  const dimStroke = { color: "rgba(0,0,0,0.8)", widthMm: 1 };

  for (let i = 0; i < inner.length; i++) {
    const a = inner[i];
    const c = inner[(i + 1) % inner.length];
    const rawLen = Math.hypot(c.x - a.x, c.y - a.y);
    const override = room.dimText?.[i];

    primitives.push({
      kind: "dimension" as const,
      segIndex: i,
      a,
      b: c,
      offsetMm: dimOffset,
      side: DIMENSION_DEFAULTS.side,
      stroke: dimStroke,
      textSizeMm: DIMENSION_DEFAULTS.textSizeMm,
      arrowSizeMm: DIMENSION_DEFAULTS.arrowSizeMm,
      text: override ?? `${Math.round(rawLen)}`,
    });
  }

  return { primitives };
}

function bounds(loop: Vec2[]) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of loop) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

function deriveElevationScene(view: Exclude<ViewKind, "plan">, room: RoomModel): DraftScene {
  const L = wallLengthFor(view, room);
  const H = room.wallHeight;

  const frame = {
    kind: "polyline" as const,
    pts: [
      { x: 0, y: 0 },
      { x: L, y: 0 },
      { x: L, y: H },
      { x: 0, y: H },
    ],
    closed: true,
    stroke: { color: "rgba(0, 0, 0, 0.85)", widthMm: 0.25 },
  };

  const tileBand = {
    kind: "polyline" as const,
    pts: [
      { x: 0, y: 0 },
      { x: L, y: 0 },
      { x: L, y: Math.min(1200, H) },
      { x: 0, y: Math.min(1200, H) },
    ],
    closed: true,
    fill: { color: "rgba(0, 0, 0, 0.08)" },
    stroke: { color: "rgba(0, 0, 0, 0.18)", widthMm: 0.13 },
  };

  return {
    primitives: [
      frame,
      tileBand,
      {
        kind: "text",
        at: { x: 0, y: H + 200 },
        text: `L=${Math.round(L)}  H=${Math.round(H)}`,
        sizeMm: 90,
        color: "rgba(0, 0, 0, 0.65)",
      },
    ],
  };
}

function wallLengthFor(view: Exclude<ViewKind, "plan">, room: RoomModel) {
  const b = bounds(room.innerLoop);
  if (view === "north" || view === "south") return b.width;
  return b.height;
}

