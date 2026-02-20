import type { Vec2, RoomModel, HatchAssignment } from "../../model/RoomModel";
import type { ViewKind } from "../view/ViewKind";
import type { hatchFill } from "../../editor2D/draftPrimitives";
import { offsetOrthoLoop } from "../../editor2D/offsetOrthoLoop";
import { edgeFacesDirection, findElevationReturns } from "../projection/deriveDraftScene";

export type HatchZone = {
  id: string;
  label: string;
  outer: Vec2[];
  holes?: Vec2[][];
  isWall?: boolean;
};

const DEFAULT_WALL_HATCH: HatchAssignment = {
  patternId: "diagonal-right",
  color: "rgba(0,0,0,0.25)",
  bgColor: "#ffffff",
  spacingMm: 40,
  lineWidthMm: 0.8,
  angleDeg: 45,
  opacity: 1,
};

// ── Zone geometry for each view ──

export function getHatchZones(view: ViewKind, room: RoomModel): HatchZone[] {
  if (view === "plan") return getPlanZones(room);
  return getElevationZones(view, room);
}

function getPlanZones(room: RoomModel): HatchZone[] {
  const inner = room.innerLoop;
  const outer = offsetOrthoLoop(inner, room.wallThickness);

  return [
    { id: "plan:floor", label: "Floor", outer: inner },
    { id: "plan:wall", label: "Wall Section", outer, holes: [inner], isWall: true },
  ];
}

function getElevationZones(view: Exclude<ViewKind, "plan">, room: RoomModel): HatchZone[] {
  const inner = room.innerLoop;
  const n = inner.length;
  const b = bounds(inner);
  const T = room.wallThickness;
  const H = room.wallHeight;
  const isNS = view === "north" || view === "south";
  const L = isNS ? b.width : b.height;
  const originH = isNS ? b.minX : b.minY;

  const zones: HatchZone[] = [];

  // Wall thickness sections (always present)
  zones.push({ id: `${view}:wall-left`, label: "Left Section", outer: rect(-T, 0, 0, H), isWall: true });
  zones.push({ id: `${view}:wall-right`, label: "Right Section", outer: rect(L, 0, L + T, H), isWall: true });

  // Compute return positions to split the face into per-section zones
  const returns = findElevationReturns(inner, view, originH, L);

  // Collect facing segment horizontal ranges (sorted)
  const facingRanges: { startH: number; endH: number }[] = [];
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
    facingRanges.push({ startH, endH });
  }
  facingRanges.sort((a, b) => a.startH - b.startH);

  // Build dividers: [0, ...returns, L]
  const dividers = [0, ...returns, L];

  // Create a face zone for each section between dividers
  for (let i = 0; i < dividers.length - 1; i++) {
    const x0 = dividers[i];
    const x1 = dividers[i + 1];
    if (x1 - x0 < 0.5) continue;

    zones.push({
      id: `${view}:face:${i}`,
      label: `Face ${i + 1}`,
      outer: rect(x0, 0, x1, H),
    });
  }

  return zones;
}

// ── Hit testing ──

export function hitTestZone(
  worldPt: Vec2,
  zones: HatchZone[],
): HatchZone | null {
  for (const z of zones) {
    if (!pointInPolygon(worldPt, z.outer)) continue;
    if (z.holes) {
      let inHole = false;
      for (const hole of z.holes) {
        if (pointInPolygon(worldPt, hole)) { inHole = true; break; }
      }
      if (inHole) continue;
    }
    return z;
  }
  return null;
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

// ── Primitive generation ──

export function buildHatchPrimitives(
  view: ViewKind,
  room: RoomModel,
  previewZoneId?: string | null,
  previewConfig?: HatchAssignment | null,
): hatchFill[] {
  const zones = getHatchZones(view, room);
  const hatches = room.hatches ?? {};
  const prims: hatchFill[] = [];

  for (const zone of zones) {
    const isPreview = previewZoneId === zone.id;

    let config: HatchAssignment | undefined;

    if (isPreview) {
      config = previewConfig ?? undefined;
    } else if (zone.id in hatches) {
      // Explicit user assignment (may be "none" to suppress default)
      const a = hatches[zone.id];
      config = a.patternId !== "none" ? a : undefined;
    } else if (zone.isWall) {
      config = DEFAULT_WALL_HATCH;
    }

    if (!config) continue;

    prims.push({
      kind: "hatchFill",
      zoneId: zone.id,
      outer: zone.outer,
      holes: zone.holes,
      patternId: config.patternId,
      color: config.color,
      bgColor: config.bgColor,
      spacingMm: config.spacingMm,
      lineWidthMm: config.lineWidthMm,
      angleDeg: config.angleDeg,
      opacity: isPreview ? Math.min(config.opacity, 0.5) : config.opacity,
    });
  }

  return prims;
}

// ── Helpers ──

function rect(x0: number, y0: number, x1: number, y1: number): Vec2[] {
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}

function bounds(loop: Vec2[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of loop) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}
