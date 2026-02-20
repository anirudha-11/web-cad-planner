import type { Vec2 } from "./vec2";
import type { ViewKind } from "../view/ViewKind";

/*
 * For a CW inner loop in Y-down screen coords, the outward normal
 * of each directed edge (A->B) is (dy, -dx) normalised to the axis.
 *
 *   Edge going RIGHT (+X) -> outward normal  (0, -1) = NORTH
 *   Edge going LEFT  (-X) -> outward normal  (0, +1) = SOUTH
 *   Edge going DOWN  (+Y) -> outward normal (+1,  0) = EAST
 *   Edge going UP    (-Y) -> outward normal (-1,  0) = WEST
 */
export function edgeFacesDirection(
  loop: Vec2[],
  edgeIdx: number,
  dir: Exclude<ViewKind, "plan">,
): boolean {
  const a = loop[edgeIdx];
  const b = loop[(edgeIdx + 1) % loop.length];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const isH = Math.abs(dx) > Math.abs(dy);

  switch (dir) {
    case "north":
      return isH && dx > 0;
    case "south":
      return isH && dx < 0;
    case "east":
      return !isH && dy > 0;
    case "west":
      return !isH && dy < 0;
  }
}

/**
 * Find horizontal positions (in elevation coords) of return walls --
 * perpendicular edges that connect two facing segments at different depths.
 */
export function findElevationReturns(
  loop: Vec2[],
  view: Exclude<ViewKind, "plan">,
  originH: number,
  totalL: number,
): number[] {
  const n = loop.length;
  const isNS = view === "north" || view === "south";
  const seen = new Set<number>();

  for (let i = 0; i < n; i++) {
    const a = loop[i];
    const b = loop[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const isH = Math.abs(dx) > Math.abs(dy);

    const isReturnEdge = isNS ? !isH : isH;
    if (!isReturnEdge) continue;

    const prevIdx = (i - 1 + n) % n;
    const nextIdx = (i + 1) % n;
    if (!edgeFacesDirection(loop, prevIdx, view) && !edgeFacesDirection(loop, nextIdx, view)) continue;

    const pos = isNS ? a.x - originH : a.y - originH;
    if (pos > 0.5 && pos < totalL - 0.5) seen.add(Math.round(pos * 10) / 10);
  }

  return Array.from(seen).sort((a, b) => a - b);
}
