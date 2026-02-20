import type { RoomModel, Vec2 } from "../../model/RoomModel";

type Axis = "x" | "y";

const EPS = 1e-3;

function nearlyEqual(a: number, b: number, eps = EPS) {
  return Math.abs(a - b) <= eps;
}

function segIsHorizontal(loop: Vec2[], segIndex: number) {
  const n = loop.length;
  const a = loop[segIndex];
  const b = loop[(segIndex + 1) % n];
  return Math.abs(a.y - b.y) <= Math.abs(a.x - b.x);
}

function vertexIsCorner(loop: Vec2[], vIdx: number) {
  const n = loop.length;
  if (n < 3) return false;

  const prevSegIdx = (vIdx - 1 + n) % n; // segment (vIdx-1 -> vIdx)
  const nextSegIdx = vIdx;              // segment (vIdx -> vIdx+1)

  const prevIsH = segIsHorizontal(loop, prevSegIdx);
  const nextIsH = segIsHorizontal(loop, nextSegIdx);

  // Corner if adjacent segments differ in orientation
  return prevIsH !== nextIsH;
}

/**
 * Offset ONLY the selected segment by `delta` perpendicular to itself.
 * Inserts TWO returns by default (A' and B'), BUT:
 * - If an endpoint is a corner (shared by H+V), move that endpoint instead of inserting a return there.
 *
 * This yields:
 * - middle segment B-C: A-B-B'-C'-C-D
 * - end segment A-B where A is corner: A(moved)-B'-B-C-D
 */
export function offsetSegmentWithReturns_Ortho(loop: Vec2[], segIndex: number, delta: number) {
  const n = loop.length;
  if (n < 2) return { loop, movedVertexIdxs: [] as number[] };

  const aIdx = segIndex;
  const bIdx = (segIndex + 1) % n;

  const a = loop[aIdx];
  const b = loop[bIdx];

  const isH = segIsHorizontal(loop, segIndex);

  const aOff: Vec2 = isH ? { x: a.x, y: a.y + delta } : { x: a.x + delta, y: a.y };
  const bOff: Vec2 = isH ? { x: b.x, y: b.y + delta } : { x: b.x + delta, y: b.y };

  const aIsCorner = vertexIsCorner(loop, aIdx);
  const bIsCorner = vertexIsCorner(loop, bIdx);

  const out: Vec2[] = [];
  const movedNewIdxs: number[] = []; // indices in the NEW loop (inserted or moved corner)

  // Rebuild loop in one pass (wrap-around safe)
  for (let i = 0; i < n; i++) {
    const v = loop[i];

    if (i === aIdx) {
      if (aIsCorner) {
        // Move the corner itself (no extra return point)
        movedNewIdxs.push(out.length);
        out.push({ ...aOff });
      } else {
        // Keep A, then insert A'
        out.push({ ...v });
        movedNewIdxs.push(out.length);
        out.push({ ...aOff });
      }
      continue;
    }

    if (i === bIdx) {
      if (bIsCorner) {
        // Move the corner itself (no extra return point)
        movedNewIdxs.push(out.length);
        out.push({ ...bOff });
      } else {
        // Insert B', then keep B
        movedNewIdxs.push(out.length);
        out.push({ ...bOff });
        out.push({ ...v });
      }
      continue;
    }

    out.push({ ...v });
  }

  return { loop: out, movedVertexIdxs: movedNewIdxs };
}

function segDir(loop: Vec2[], segIndex: number): "h" | "v" {
  const n = loop.length;
  const a = loop[segIndex];
  const b = loop[(segIndex + 1) % n];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.abs(dx) >= Math.abs(dy) ? "h" : "v";
}

export function segLineCoord(loop: Vec2[], segIndex: number): { axis: Axis; coord: number } {
  const a = loop[segIndex];
  const b = loop[(segIndex + 1) % loop.length];
  const dir = segDir(loop, segIndex);
  if (dir === "h") return { axis: "y", coord: (a.y + b.y) * 0.5 };
  return { axis: "x", coord: (a.x + b.x) * 0.5 };
}

function verticesOnLine(loop: Vec2[], axis: Axis, coord: number, eps = EPS) {
  const idxs: number[] = [];
  for (let i = 0; i < loop.length; i++) {
    const v = loop[i];
    const c = axis === "x" ? v.x : v.y;
    if (nearlyEqual(c, coord, eps)) idxs.push(i);
  }
  return idxs;
}

export function movedVerticesToTouchedSegments(loopLen: number, movedVertexIdxs: number[]) {
  const moved = new Set(movedVertexIdxs);
  const touchedSegs = new Set<number>();

  for (let i = 0; i < loopLen; i++) {
    const i0 = i;
    const i1 = (i + 1) % loopLen;
    if (moved.has(i0) || moved.has(i1)) touchedSegs.add(i);
  }
  return touchedSegs;
}

function translateVertices(loop: Vec2[], idxs: number[], dx: number, dy: number) {
  const out = loop.map((p) => ({ ...p }));
  for (const i of idxs) out[i] = { x: out[i].x + dx, y: out[i].y + dy };
  return out;
}

export function moveWallLine(loop: Vec2[], axis: Axis, coord: number, delta: number) {
  const vIdxs = verticesOnLine(loop, axis, coord);
  const dx = axis === "x" ? delta : 0;
  const dy = axis === "y" ? delta : 0;
  return { loop: translateVertices(loop, vIdxs, dx, dy), movedVertexIdxs: vIdxs };
}

export function setSegmentLength_Ortho(loop: Vec2[], segIndex: number, newLen: number) {
  const n = loop.length;
  if (n < 2) return { loop, movedVertexIdxs: [] as number[] };

  const a = loop[segIndex];
  const b = loop[(segIndex + 1) % n];

  const dir = segDir(loop, segIndex);
  if (dir === "h") {
    const sign = b.x - a.x >= 0 ? 1 : -1;
    const targetBx = a.x + sign * newLen;
    const dx = targetBx - b.x;
    return moveWallLine(loop, "x", b.x, dx);
  }

  const sign = b.y - a.y >= 0 ? 1 : -1;
  const targetBy = a.y + sign * newLen;
  const dy = targetBy - b.y;
  return moveWallLine(loop, "y", b.y, dy);
}

export function clearDimOverridesForMovedVertices(
  room: RoomModel,
  movedVertexIdxs: number[],
  keepSegs: Set<number> = new Set()
): RoomModel {
  const map = { ...(room.dimText ?? {}) };
  if (!Object.keys(map).length) return room;

  const touchedSegs = movedVerticesToTouchedSegments(room.innerLoop.length, movedVertexIdxs);
  for (const seg of touchedSegs) {
    if (keepSegs.has(seg)) continue;
    delete map[seg];
  }

  return { ...room, dimText: map };
}

export function applySegmentLength_Ortho(room: RoomModel, segIndex: number, newLen: number): RoomModel {
  const loop0 = room.innerLoop;
  if (loop0.length < 2) return room;

  const { loop: movedLoop, movedVertexIdxs } = setSegmentLength_Ortho(loop0, segIndex, newLen);

  const keep = new Set<number>([segIndex]);
  const next: RoomModel = { ...room, innerLoop: movedLoop };
  return clearDimOverridesForMovedVertices(next, movedVertexIdxs, keep);
}

/**
 * Insert a vertex on segment segIndex at the given point (assumed to lie on the segment).
 * Returns a new RoomModel with updated innerLoop and dimText remapped.
 */
export function insertVertexOnSegment(room: RoomModel, segIndex: number, point: Vec2): RoomModel {
  const loop = room.innerLoop;
  const n = loop.length;
  if (n < 2) return room;

  // Decide insert index in vertex array:
  // for segment i (i -> i+1) we insert after i, except for the closing segment (n-1 -> 0)
  // where we append at the end.
  const insertIdx = segIndex === n - 1 ? n : segIndex + 1;

  const newLoop = loop.slice();
  newLoop.splice(insertIdx, 0, { x: point.x, y: point.y });

  // Remap dimText: keep labels before segIndex, shift those after by +1,
  // and clear labels on the split segment(s).
  const oldDim = room.dimText ?? {};
  const newDim: Record<number, string> = {};
  const oldSegmentCount = loop.length;

  for (const [kStr, v] of Object.entries(oldDim)) {
    const k = Number(kStr);
    if (!Number.isFinite(k)) continue;
    if (k < segIndex) {
      newDim[k] = v;
    } else if (k > segIndex && k < oldSegmentCount) {
      newDim[k + 1] = v;
    }
    // k === segIndex is dropped because that segment has changed length.
  }

  return { ...room, innerLoop: newLoop, dimText: newDim };
}


