import type { RoomModel } from "../../model/RoomModel";
import type { ViewKind } from "../view/ViewKind";
import type { Vec2 } from "../geometry/vec2";
import { bounds } from "../geometry/boundsUtils";

export type Bounds2D = { min: Vec2; max: Vec2 };

export function getWorldBounds(view: ViewKind, room: RoomModel): Bounds2D {
  if (view === "plan") {
    const b = bounds(room.innerLoop);
    const t = room.wallThickness;
    const margin = 400;

    return {
      min: { x: b.minX - t - margin, y: b.minY - t - margin },
      max: { x: b.maxX + t + margin, y: b.maxY + t + margin },
    };
  }

  const b = bounds(room.innerLoop);
  const T = room.wallThickness;
  const L = view === "north" || view === "south" ? b.width : b.height;
  const H = room.wallHeight;

  const marginX = 500;
  const marginY = 500;

  return {
    min: { x: -T - marginX, y: -marginY },
    max: { x: L + T + marginX, y: H + marginY },
  };
}

