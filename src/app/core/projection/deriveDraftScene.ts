import type { DraftScene } from "../rendering/draftPrimitives";
import type { RoomModel } from "../../model/RoomModel";
import type { ViewKind } from "../view/ViewKind";
import { offsetOrthoLoop } from "../geometry/offsetOrthoLoop";
import { bounds } from "../geometry/boundsUtils";
import { edgeFacesDirection, findElevationReturns } from "../geometry/elevationUtils";
import { DIMENSION_DEFAULTS } from "../rendering/dimensionDefaults";
import { buildWindowPlanPrimitives, buildWindowElevPrimitives } from "./windowPrimitives";
import { buildDoorPlanPrimitives, buildDoorElevPrimitives } from "./doorPrimitives";

export function deriveDraftScene(view: ViewKind, room: RoomModel): DraftScene {
  if (view === "plan") return derivePlanScene(room);
  return deriveElevationScene(view, room);
}

function derivePlanScene(room: RoomModel): DraftScene {
  const inner = room.innerLoop;
  const t = room.wallThickness;

  const outer = offsetOrthoLoop(inner, t);

  const outline = "rgba(0,0,0,0.9)";

  const primitives: DraftScene["primitives"] = [
    {
      kind: "polygon" as const,
      outer,
      holes: [inner],
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

  for (const entity of Object.values(room.entities)) {
    if (entity.kind !== "wall-opening") continue;
    if (entity.openingType === "window") {
      primitives.push(...buildWindowPlanPrimitives(room, entity));
    } else if (entity.openingType === "door") {
      primitives.push(...buildDoorPlanPrimitives(room, entity));
    }
  }

  return { primitives };
}

function deriveElevationScene(view: Exclude<ViewKind, "plan">, room: RoomModel): DraftScene {
  const inner = room.innerLoop;
  const n = inner.length;
  const H = room.wallHeight;
  const b = bounds(inner);
  const strokeMm = room.wallConfig?.strokeWidthMm ?? 5;

  const isNS = view === "north" || view === "south";
  const L = isNS ? b.width : b.height;
  const originH = isNS ? b.minX : b.minY;

  const outline = "rgb(0, 0, 0)";
  const primitives: DraftScene["primitives"] = [];

  primitives.push({
    kind: "polygon" as const,
    outer: [
      { x: 0, y: 0 },
      { x: L, y: 0 },
      { x: L, y: H },
      { x: 0, y: H },
    ],
    strokeOuter: { color: outline, widthMm: strokeMm },
  });

  const returns = findElevationReturns(inner, view, originH, L);
  for (const pos of returns) {
    primitives.push({
      kind: "line" as const,
      a: { x: pos, y: 0 },
      b: { x: pos, y: H },
      stroke: { color: "rgba(0,0,0,0.35)", widthMm: 1.5 },
    });
  }

  const dimOffset = DIMENSION_DEFAULTS.offsetMm;
  const dimStroke = { color: "rgba(0,0,0,0.8)", widthMm: 1 };

  const facingSegs: { startH: number; endH: number; segIndex: number }[] = [];
  for (let i = 0; i < n; i++) {
    if (!edgeFacesDirection(inner, i, view)) continue;

    const a = inner[i];
    const bPt = inner[(i + 1) % n];
    let startH: number, endH: number;
    if (isNS) {
      startH = Math.min(a.x, bPt.x) - originH;
      endH = Math.max(a.x, bPt.x) - originH;
    } else {
      startH = Math.min(a.y, bPt.y) - originH;
      endH = Math.max(a.y, bPt.y) - originH;
    }
    facingSegs.push({ startH, endH, segIndex: i });
  }
  facingSegs.sort((a, bSeg) => a.startH - bSeg.startH);

  for (const seg of facingSegs) {
    const rawLen = seg.endH - seg.startH;
    const override = room.dimText?.[seg.segIndex];

    primitives.push({
      kind: "dimension" as const,
      segIndex: seg.segIndex,
      a: { x: seg.startH, y: H },
      b: { x: seg.endH, y: H },
      offsetMm: dimOffset,
      side: "out" as const,
      stroke: dimStroke,
      textSizeMm: DIMENSION_DEFAULTS.textSizeMm,
      arrowSizeMm: DIMENSION_DEFAULTS.arrowSizeMm,
      text: override ?? `${Math.round(rawLen)}`,
    });
  }

  for (const entity of Object.values(room.entities)) {
    if (entity.kind !== "wall-opening") continue;
    if (entity.openingType === "window") {
      primitives.push(...buildWindowElevPrimitives(room, entity, view));
    } else if (entity.openingType === "door") {
      primitives.push(...buildDoorElevPrimitives(room, entity, view));
    }
  }

  primitives.push({
    kind: "dimension" as const,
    segIndex: -1,
    a: { x: L, y: H },
    b: { x: L, y: 0 },
    offsetMm: dimOffset,
    side: "out" as const,
    stroke: dimStroke,
    textSizeMm: DIMENSION_DEFAULTS.textSizeMm,
    arrowSizeMm: DIMENSION_DEFAULTS.arrowSizeMm,
    text: `${Math.round(H)}`,
  });

  return { primitives };
}
