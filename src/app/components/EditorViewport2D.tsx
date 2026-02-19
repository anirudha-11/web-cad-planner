"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Viewport2D } from "../editor2D/Viewport2D";
import { CanvasRenderer2D } from "../editor2D/CanvasRenderer2D";
import { useRoomHistory } from "../state/RoomHistoryContext";
import { deriveDraftScene } from "../core/projection/deriveDraftScene";
import { getWorldBounds } from "../core/projection/getWorldBounds";
import { getInnerLoopSegment } from "../editor2D/hitTestRoomEdges";
import type { ViewKind } from "../core/view/ViewKind";
import { useViewport2DInteractions } from "../editor2D/useViewport2DInteractions";
import { useDimensionLabelEditing } from "../editor2D/useDimensionLabelEditing";

export type { ViewKind };

export default function EditorViewport2D({ view, title }: { view: ViewKind; title?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewport = useMemo(() => new Viewport2D(), []);
  const [version, setVersion] = useState(0);

  const { room, execute, previewRoom, commitSnapshot, undo, redo, canUndo, canRedo } = useRoomHistory();

  const [hoverSeg, setHoverSeg] = useState<number | null>(null);
  const [selectedSeg, setSelectedSeg] = useState<number | null>(null);

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

  // Dimension label double-click + inline editor (plan view)
  const { dimEdit, setDimEdit, commitDimEdit } = useDimensionLabelEditing({
    canvasRef,
    view,
    room,
    viewport,
    scenePrimitives: scene.primitives,
    execute,
  });

  // Pointer interactions: pan, zoom, wall drag, hover highlight
  useViewport2DInteractions({
    canvasRef,
    viewport,
    view,
    room,
    previewRoom,
    commitSnapshot,
    setHoverSeg,
    setSelectedSeg,
    onViewportChange: () => setVersion((v) => v + 1),
  });

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

  // Undo/redo keyboard shortcuts (Ctrl/Cmd+Z, Ctrl+Shift+Z / Ctrl+Y)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toLowerCase().includes("mac");
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) return;

      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        if (canUndo) {
          e.preventDefault();
          undo();
        }
        return;
      }
      if ((key === "z" && e.shiftKey) || key === "y") {
        if (canRedo) {
          e.preventDefault();
          redo();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo, canUndo, canRedo]);

  // Interactions are now handled by useViewport2DInteractions hook above.



  return (
    <div className="relative w-full h-full bg-[#ffffff] overflow-hidden">
      <div className="absolute left-2 top-2 z-10 text-xs text-black/55 select-none pointer-events-none">
        {title ?? view.toUpperCase()}
      </div>
      <div className="absolute right-2 top-2 z-10 flex gap-1">
        <button
          className="px-2 py-1 text-[11px] rounded bg-black/5 hover:bg-black/10 text-black/70 disabled:opacity-40 disabled:cursor-default"
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl/Cmd+Z)"
        >
          Undo
        </button>
        <button
          className="px-2 py-1 text-[11px] rounded bg-black/5 hover:bg-black/10 text-black/70 disabled:opacity-40 disabled:cursor-default"
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z / Ctrl+Y)"
        >
          Redo
        </button>
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
