"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Viewport2D } from "../editor2D/Viewport2D";
import { CanvasRenderer2D } from "../editor2D/CanvasRenderer2D";
import { useRoom } from "../store/RoomContext";
import { deriveDraftScene } from "../editor2D/deriveDraftScene";
import { getWorldBounds } from "../editor2D/getWorldBounds";
import { hitTestInnerLoopSegment, getInnerLoopSegment } from "../editor2D/hitTestRoomEdges";
import type { RoomModel } from "../model/RoomModel";
import { DIMENSION_DEFAULTS } from "../editor2D/dimensionDefaults";
import { DraftPrimitive } from "../editor2D/draftPrimitives";

export type ViewKind = "plan" | "north" | "south" | "east" | "west";

type Vec2 = { x: number; y: number };
type ScreenPt = { x: number; y: number };
type Axis = "x" | "y";

const EPS = 1e-6;

export default function EditorViewport2D({ view, title }: { view: ViewKind; title?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewport = useMemo(() => new Viewport2D(), []);
  const [version, setVersion] = useState(0);

  // ✅ Ensure your RoomStore is typed to return { room: RoomModel; setRoom: (updater) => void }
  const { room, setRoom } = useRoom() as {
    room: RoomModel;
    setRoom: (updater: (prev: RoomModel) => RoomModel) => void;
  };

  const [hoverSeg, setHoverSeg] = useState<number | null>(null);
  const [selectedSeg, setSelectedSeg] = useState<number | null>(null);

  const [dimEdit, setDimEdit] = useState<null | {
  segIndex: number;
  value: string;
  screen: { x: number; y: number };
}>(null);

const openDimEditorFromDim = (d: Extract<DraftPrimitive, { kind: "dimension" }>) => {
  const labelWorld = dimLabelWorldPos(d);
  const labelScreen = viewport.worldToScreen(labelWorld);

  // value shown in the input (existing override or current displayed text)
  const currentText = room.dimText?.[d.segIndex] ?? d.text ?? "";

  setDimEdit({
    segIndex: d.segIndex,
    value: currentText,
    screen: labelScreen, // ✅ exact label position
  });
};

function dimLabelWorldPos(d: { a: Vec2; b: Vec2; offsetMm: number; side?: "in" | "out" }): Vec2 {
  const a = d.a, b = d.b;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const L = Math.hypot(dx, dy) || 1;

  // unit tangent
  const tx = dx / L;
  const ty = dy / L;

  // unit normal
  const nx = -ty;
  const ny = tx;

  const side = d.side ?? "in";
  const sgn = side === "in" ? -1 : 1;
  const off = d.offsetMm * sgn;

  const a2 = { x: a.x + nx * off, y: a.y + ny * off };
  const b2 = { x: b.x + nx * off, y: b.y + ny * off };

  return { x: (a2.x + b2.x) / 2, y: (a2.y + b2.y) / 2 };
}

function dist2(a: ScreenPt, b: ScreenPt) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return dx * dx + dy * dy;
}

  const dragRef = useRef<{
    segIndex: number;
    startWorld: Vec2;
    startLoop: Vec2[];
  } | null>(null);

  // Derived scene from shared model + overlay highlight
  const scene = useMemo(() => {
    const base = deriveDraftScene(view, room);
    if (view !== "plan") return base;

    const segIndex = hoverSeg ?? selectedSeg;
    if (segIndex == null) return base;

    const { a, b } = getInnerLoopSegment(room, segIndex);

    return {
      primitives: [
        ...base.primitives,
        {
          kind: "line" as const,
          a,
          b,
          stroke: { color: "rgba(0,120,255,0.85)", widthMm: 0.6 },
        },
      ],
    };
  }, [view, room, hoverSeg, selectedSeg]);

  const zoomExtents = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const w = Math.max(1, parent.clientWidth);
    const h = Math.max(1, parent.clientHeight);

    const bounds = getWorldBounds(view, room);
    viewport.fitToWorldBounds(bounds, { w, h }, 28);
    setVersion((v) => v + 1);
  };

useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas) return;

  const onDblClick = (e: MouseEvent) => {
    if (view !== "plan") return;

    const rect = canvas.getBoundingClientRect();
    const click: ScreenPt = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    // hit-test only dimensions from the current scene (so it always matches rendering)
    const dims = scene.primitives.filter((p): p is Extract<DraftPrimitive, { kind: "dimension" }> => p.kind === "dimension");

    const hitRadiusPx = 22; // tweak to taste
    const hitR2 = hitRadiusPx * hitRadiusPx;

    let best: { d: (typeof dims)[number]; d2: number } | null = null;

    for (const d of dims) {
      const labelWorld = dimLabelWorldPos(d);
      const labelScreen = viewport.worldToScreen(labelWorld);
      const d2 = dist2(click, labelScreen);

      if (d2 <= hitR2 && (!best || d2 < best.d2)) best = { d, d2 };
    }

    if (best) openDimEditorFromDim(best.d);
  };

  canvas.addEventListener("dblclick", onDblClick);
  return () => canvas.removeEventListener("dblclick", onDblClick);
}, [scene, viewport, view, room.dimText]); // room.dimText so the latest text appears in editor



  // Auto zoom extents on mount / view change / room id change
  useEffect(() => {
    zoomExtents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, room.id]);

  // Resize observer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const ro = new ResizeObserver(() => setVersion((v) => v + 1));
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  // Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const w = Math.max(1, parent.clientWidth);
    const h = Math.max(1, parent.clientHeight);

    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const renderer = new CanvasRenderer2D(ctx, viewport);
    renderer.draw(scene, w, h);
  }, [scene, viewport, version]);

  // Interactions (pointer + wheel)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let isPanning = false;
    let lastX = 0;
    let lastY = 0;

    const mmToleranceFromPx = (px: number) => px / viewport.scale;

    const screenToWorldFromEvent = (e: PointerEvent): Vec2 => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      return viewport.screenToWorld({ x: sx, y: sy });
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const zoomFactor = Math.exp(-e.deltaY * 0.001);
      viewport.zoomAtScreen(zoomFactor, { x: mx, y: my });
      setVersion((v) => v + 1);
    };

    const onPointerDown = (e: PointerEvent) => {
      // Right mouse: pan
      if (e.button === 2) {
        e.preventDefault();
        isPanning = true;
        lastX = e.clientX;
        lastY = e.clientY;
        canvas.setPointerCapture(e.pointerId);
        return;
      }

      // Left mouse: select segment + start drag (plan only)
      if (e.button === 0 && view === "plan") {
        const pWorld = screenToWorldFromEvent(e);
        const tolMm = mmToleranceFromPx(10);

        const hit = hitTestInnerLoopSegment(room, pWorld, tolMm);
        setSelectedSeg(hit ? hit.segIndex : null);

        if (hit) {
          dragRef.current = {
            segIndex: hit.segIndex,
            startWorld: pWorld,
            startLoop: room.innerLoop.map((p: Vec2) => ({ ...p })),
          };
          e.preventDefault();
          canvas.setPointerCapture(e.pointerId);
        }
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      // Pan mode
      if (isPanning) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;

        viewport.panByScreen(dx, dy);
        setVersion((v) => v + 1);
        return;
      }

      // Drag segment
      if (dragRef.current && view === "plan") {
        const { segIndex, startWorld, startLoop } = dragRef.current;
        const pWorld = screenToWorldFromEvent(e);

        const dxW = pWorld.x - startWorld.x;
        const dyW = pWorld.y - startWorld.y;

        // Determine which wall line we’re moving (perpendicular to segment direction)
        const { axis, coord } = segLineCoord(startLoop, segIndex);

        // For a horizontal segment => axis is "y" (we move y by dyW)
        // For a vertical segment   => axis is "x" (we move x by dxW)
        const delta = axis === "x" ? dxW : dyW;

        setRoom((prev: RoomModel) => {
          // We intentionally apply the move to the snapshot captured on pointer-down (startLoop)
          // so the drag stays stable even if prev changes mid-drag.
          const { loop: movedLoop, movedVertexIdxs } = moveWallLine(startLoop, axis, coord, delta);

          // keep prev's other properties, but replace the loop
          const next = { ...prev, innerLoop: movedLoop };
          return clearDimOverridesForMovedVertices(next, movedVertexIdxs);
        });

        return;
      }

      // Hover segment (plan only)
      if (view === "plan") {
        const pWorld = screenToWorldFromEvent(e);
        const tolMm = mmToleranceFromPx(10);

        const hit = hitTestInnerLoopSegment(room, pWorld, tolMm);
        setHoverSeg(hit ? hit.segIndex : null);

        if (!hit) {
          canvas.style.cursor = "default";
        } else {
          const { a, b } = getInnerLoopSegment(room, hit.segIndex);
          const horizontal = Math.abs(a.y - b.y) <= Math.abs(a.x - b.x);
          canvas.style.cursor = horizontal ? "ns-resize" : "ew-resize";
        }
      } else {
        canvas.style.cursor = "default";
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (isPanning) {
        isPanning = false;
        try {
          canvas.releasePointerCapture(e.pointerId);
        } catch {}
        canvas.style.cursor = "default";
        return;
      }

      if (dragRef.current) {
        dragRef.current = null;
        try {
          canvas.releasePointerCapture(e.pointerId);
        } catch {}
      }
    };

    canvas.addEventListener("contextmenu", onContextMenu);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);

    return () => {
      canvas.removeEventListener("contextmenu", onContextMenu);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.style.cursor = "default";
    };
  }, [viewport, view, room, setRoom]);

  const commitDimEdit = (segIndex: number, raw: string) => {
  const cleaned = raw.trim();

  // Store label text always
  setRoom((prev) => ({
    ...prev,
    dimText: { ...(prev.dimText ?? {}), [segIndex]: cleaned },
  }));

  // If numeric, apply geometry edit
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return;

  setRoom((prev) => applySegmentLength_Ortho(prev, segIndex, n));
};

function clearDimOverridesForMovedVertices(
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

function applySegmentLength_Ortho(room: RoomModel, segIndex: number, newLen: number): RoomModel {
  const loop0 = room.innerLoop;
  if (loop0.length < 2) return room;

  const { loop: movedLoop, movedVertexIdxs } = setSegmentLength_Ortho(loop0, segIndex, newLen);

  // Clear overrides for any touched segments EXCEPT the one the user just edited
  const keep = new Set<number>([segIndex]);
  const next: RoomModel = { ...room, innerLoop: movedLoop };
  return clearDimOverridesForMovedVertices(next, movedVertexIdxs, keep);
}


function nearlyEqual(a: number, b: number, eps = EPS) {
  return Math.abs(a - b) <= eps;
}

function segDir(loop: Vec2[], segIndex: number): "h" | "v" {
  const n = loop.length;
  const a = loop[segIndex];
  const b = loop[(segIndex + 1) % n];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  // choose dominant axis (and tolerate tiny noise)
  return Math.abs(dx) >= Math.abs(dy) ? "h" : "v";
}

function segLineCoord(loop: Vec2[], segIndex: number): { axis: Axis; coord: number } {
  const n = loop.length;
  const a = loop[segIndex];
  const b = loop[(segIndex + 1) % n];
  const dir = segDir(loop, segIndex);
  if (dir === "h") {
    // horizontal => constant y
    return { axis: "y", coord: (a.y + b.y) * 0.5 };
  }
  // vertical => constant x
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

function movedVerticesToTouchedSegments(loopLen: number, movedVertexIdxs: number[]) {
  // segment i is between vertex i and i+1
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
  for (const i of idxs) {
    out[i] = { x: out[i].x + dx, y: out[i].y + dy };
  }
  return out;
}

/**
 * Move an entire wall line (all vertices with x=const or y=const).
 * - axis "x": moves a vertical wall line by dx
 * - axis "y": moves a horizontal wall line by dy
 */
function moveWallLine(loop: Vec2[], axis: Axis, coord: number, delta: number) {
  const vIdxs = verticesOnLine(loop, axis, coord);
  const dx = axis === "x" ? delta : 0;
  const dy = axis === "y" ? delta : 0;
  return {
    loop: translateVertices(loop, vIdxs, dx, dy),
    movedVertexIdxs: vIdxs,
  };
}

/**
 * Stretch along segment tangent by moving the "far end" wall line.
 * For a horizontal segment (a->b), length = |bx-ax|.
 * We keep the "anchor end" (a side) fixed and move the "far end" wall line (b side).
 * This generalizes rectangle to any orthogonal polygon by shifting ALL vertices on that end-line.
 */
function setSegmentLength_Ortho(loop: Vec2[], segIndex: number, newLen: number) {
  const n = loop.length;
  if (n < 2) return { loop, movedVertexIdxs: [] as number[] };

  const a = loop[segIndex];
  const b = loop[(segIndex + 1) % n];

  const dir = segDir(loop, segIndex);
  if (dir === "h") {
    // move the vertical line at x = b.x to make |bx-ax| = newLen
    const sign = (b.x - a.x) >= 0 ? 1 : -1;
    const targetBx = a.x + sign * newLen;
    const dx = targetBx - b.x;
    return moveWallLine(loop, "x", b.x, dx);
  } else {
    // vertical: move the horizontal line at y = b.y to make |by-ay| = newLen
    const sign = (b.y - a.y) >= 0 ? 1 : -1;
    const targetBy = a.y + sign * newLen;
    const dy = targetBy - b.y;
    return moveWallLine(loop, "y", b.y, dy);
  }
}



  return (
    <div className="relative w-full h-full bg-[#ffffff] overflow-hidden">
      <div className="absolute left-2 top-2 z-10 text-xs text-black/55 select-none pointer-events-none">
        {title ?? view.toUpperCase()}
      </div>
      <div className="absolute right-2 top-2 z-10 flex gap-1">
        <button
          className="px-2 py-1 text-[11px] rounded bg-black/5 hover:bg-black/10 text-black/70"
          onClick={zoomExtents}
          title="Zoom Extents"
        >
          Zoom to fit
        </button>
      </div>
      {dimEdit && (
        <div
          className="absolute z-20"
          style={{
            left: dimEdit.screen.x,
            top: dimEdit.screen.y,
            transform: "translate(-50%, -50%)", // ✅ anchor center exactly at label point
          }}
        >
          <input
            autoFocus
            value={dimEdit.value}
            onChange={(e) => setDimEdit((s) => (s ? { ...s, value: e.target.value } : s))}
            onKeyDown={(e) => {
              if (e.key === "Escape") setDimEdit(null);
              if (e.key === "Enter") {
                commitDimEdit(dimEdit.segIndex, dimEdit.value);
                setDimEdit(null);
              }
            }}
            onBlur={() => {
              commitDimEdit(dimEdit.segIndex, dimEdit.value);
              setDimEdit(null);
            }}
             className="
              w-24 px-2 py-1 text-xs rounded
              bg-white border border-black/20 shadow
              text-black font-medium
              focus:outline-none focus:ring-2 focus:ring-blue-400/40
            "
          />
        </div>
      )}

      <canvas ref={canvasRef} className="block w-full h-full touch-none" />
    </div>
  );
}
