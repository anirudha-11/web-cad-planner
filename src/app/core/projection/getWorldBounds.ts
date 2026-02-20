import type { RoomModel } from "../../model/RoomModel";
import type { ViewKind } from "../view/ViewKind";

type Vec2 = { x: number; y: number };
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

