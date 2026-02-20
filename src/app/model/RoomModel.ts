import type { EntityMap } from "../core/entities/entityTypes";
import type { Vec2 } from "../core/geometry/vec2";
import { bounds as _bounds } from "../core/geometry/boundsUtils";

export type { Vec2 } from "../core/geometry/vec2";

export type HatchAssignment = {
  patternId: string;
  color: string;
  bgColor: string;
  spacingMm: number;
  lineWidthMm: number;
  angleDeg: number;
  opacity: number;
  tileLengthMm?: number;
  tileWidthMm?: number;
  /** Pair-line options; used by arch-cut-wall and similar patterns */
  pair?: { enabled: boolean; gapMm: number };
};

/** Wall display defaults: outline stroke weight and default hatch for wall zones */
export type WallConfig = {
  /** Stroke width (mm) for wall outline in plan and elevation */
  strokeWidthMm?: number;
  /** Default hatch applied to wall zones when no zone-specific hatch is set */
  defaultWallHatch?: HatchAssignment;
};

export type RoomModel = {
  id: string;

  // ✅ INNER (clear) boundary loop, closed (first != last, but implied closed)
  // Clockwise recommended.
  innerLoop: Vec2[];

  wallThickness: number; // mm
  wallHeight: number; // mm
  dimText?: Record<number, string>;

  // Future-proof: doors/windows/fixtures/annotations etc.
  entities: EntityMap;

  hatches?: Record<string, HatchAssignment>;
  /** Wall outline and default wall hatch; when absent, app defaults are used */
  wallConfig?: WallConfig;
};


export const createDefaultRoom = (): RoomModel => {
  const x0 = 0;
  const y0 = 0;
  const width = 2500;
  const depth = 4000;

  return {
    id: "room-1",
    innerLoop: [
      { x: x0, y: y0 },
      { x: x0 + width, y: y0 },
      { x: x0 + width, y: y0 + depth },
      { x: x0, y: y0 + depth },
    ],
    wallThickness: 90,
    wallHeight: 2400,
    entities: {},
  };
};

export const innerBounds = _bounds;
