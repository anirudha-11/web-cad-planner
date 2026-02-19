import { useEffect, useRef } from "react";
import type { Viewport2D } from "./Viewport2D";
import type { ViewKind } from "../core/view/ViewKind";
import type { RoomModel, Vec2 } from "../model/RoomModel";
import { hitTestInnerLoopSegment, getInnerLoopSegment } from "./hitTestRoomEdges";
import { clearDimOverridesForMovedVertices, insertVertexOnSegment, moveWallLine, segLineCoord } from "../core/geometry/orthoLoopEdit";

type UseViewport2DInteractionsArgs = {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  viewport: Viewport2D;
  view: ViewKind;
  room: RoomModel;
  previewRoom: (updater: (prev: RoomModel) => RoomModel) => void;
  commitSnapshot: (before: RoomModel, after: RoomModel) => void;
  setHoverSeg: (segIndex: number | null) => void;
  setSelectedSeg: (segIndex: number | null) => void;
  onViewportChange?: () => void;
};

export function useViewport2DInteractions({
  canvasRef,
  viewport,
  view,
  room,
  previewRoom,
  commitSnapshot,
  setHoverSeg,
  setSelectedSeg,
  onViewportChange,
}: UseViewport2DInteractionsArgs) {
  const dragRef = useRef<{
    segIndex: number;
    startWorld: Vec2;
    startRoom: RoomModel;
    startLoop: Vec2[];
  } | null>(null);

  const panRef = useRef<{ isPanning: boolean; lastX: number; lastY: number }>({
    isPanning: false,
    lastX: 0,
    lastY: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

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
      onViewportChange?.();
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button === 2) {
        e.preventDefault();
        panRef.current.isPanning = true;
        panRef.current.lastX = e.clientX;
        panRef.current.lastY = e.clientY;
        canvas.setPointerCapture(e.pointerId);
        return;
      }

      if (e.button === 0 && view === "plan") {
        const pWorld = screenToWorldFromEvent(e);
        const tolMm = mmToleranceFromPx(10);

        const hit = hitTestInnerLoopSegment(room, pWorld, tolMm);
        setSelectedSeg(hit ? hit.segIndex : null);

        // Shift+click: insert a new vertex on the hit segment (for L-shaped rooms, etc.)
        if (e.shiftKey && hit) {
          const newRoom = insertVertexOnSegment(room, hit.segIndex, hit.point);
          commitSnapshot(room, newRoom);
          return;
        }

        // Plain left-click: start wall drag if a segment was hit
        if (hit) {
          dragRef.current = {
            segIndex: hit.segIndex,
            startWorld: pWorld,
            startRoom: room,
            startLoop: room.innerLoop.map((p: Vec2) => ({ ...p })),
          };
          e.preventDefault();
          canvas.setPointerCapture(e.pointerId);
        }
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (panRef.current.isPanning) {
        const dx = e.clientX - panRef.current.lastX;
        const dy = e.clientY - panRef.current.lastY;
        panRef.current.lastX = e.clientX;
        panRef.current.lastY = e.clientY;

        viewport.panByScreen(dx, dy);
        onViewportChange?.();
        return;
      }

      if (dragRef.current && view === "plan") {
        const { segIndex, startWorld, startLoop, startRoom } = dragRef.current;
        const pWorld = screenToWorldFromEvent(e);

        const dxW = pWorld.x - startWorld.x;
        const dyW = pWorld.y - startWorld.y;

        // Determine wall orientation for this segment
        const dir = segLineCoord(startLoop, segIndex);

        // If this segment is the *only* one on its line, we move the entire wall line
        // (original rectangle behavior). If there are additional collinear vertices,
        // we create a small orthogonal “return” so only this segment moves, allowing L-shaped rooms.
        const aIdx = segIndex;
        const bIdx = (segIndex + 1) % startLoop.length;
        const a = startLoop[aIdx];
        const b = startLoop[bIdx];

        const isHorizontal = Math.abs(a.y - b.y) <= Math.abs(a.x - b.x);

        // Count collinear vertices on this line
        let collinearCount = 0;
        for (let i = 0; i < startLoop.length; i++) {
          const v = startLoop[i];
          if (isHorizontal ? Math.abs(v.y - a.y) < 1e-3 : Math.abs(v.x - a.x) < 1e-3) {
            collinearCount++;
          }
        }

        let movedLoop: Vec2[];
        let movedVertexIdxs: number[];

        if (collinearCount <= 2) {
          // Single wall segment on this line: move entire wall line (old behavior)
          const delta = isHorizontal ? dyW : dxW;
          const axis = isHorizontal ? ("y" as const) : ("x" as const);
          const coord = isHorizontal ? a.y : a.x;
          const res = moveWallLine(startLoop, axis, coord, delta);
          movedLoop = res.loop;
          movedVertexIdxs = res.movedVertexIdxs;
        } else {
          // Line has multiple collinear vertices (e.g. after splitting with Shift+click).
          // Keep the "near" endpoint (a) fixed, insert a new corner vertex below/right of it,
          // and move the far endpoint (b) to that new level → orthogonal return and L-shape.
          movedLoop = startLoop.map((p) => ({ ...p })) as Vec2[];

          if (isHorizontal) {
            const newY = a.y + dyW;
            const insertIdx = aIdx + 1;
            // Insert corner directly below/above a
            movedLoop.splice(insertIdx, 0, { x: a.x, y: newY });
            // After splice, b shifts by +1
            const newBIdx = bIdx + 1;
            movedLoop[newBIdx] = { x: movedLoop[newBIdx].x, y: newY };
            movedVertexIdxs = [insertIdx, newBIdx];
          } else {
            const newX = a.x + dxW;
            const insertIdx = aIdx + 1;
            // Insert corner directly left/right of a
            movedLoop.splice(insertIdx, 0, { x: newX, y: a.y });
            const newBIdx = bIdx + 1;
            movedLoop[newBIdx] = { x: newX, y: movedLoop[newBIdx].y };
            movedVertexIdxs = [insertIdx, newBIdx];
          }
        }

        const next = clearDimOverridesForMovedVertices({ ...startRoom, innerLoop: movedLoop }, movedVertexIdxs);
        previewRoom(() => next);

        return;
      }

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
      if (panRef.current.isPanning) {
        panRef.current.isPanning = false;
        try {
          canvas.releasePointerCapture(e.pointerId);
        } catch {}
        canvas.style.cursor = "default";
        return;
      }

      if (dragRef.current) {
        const { startRoom } = dragRef.current;
        commitSnapshot(startRoom, room);
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
  }, [canvasRef, viewport, view, room, previewRoom, commitSnapshot, setHoverSeg, setSelectedSeg, onViewportChange]);
}

