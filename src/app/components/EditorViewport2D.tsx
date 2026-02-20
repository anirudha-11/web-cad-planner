"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Viewport2D } from "../editor2D/Viewport2D";
import { CanvasRenderer2D } from "../editor2D/CanvasRenderer2D";
import { useRoomHistory } from "../state/RoomHistoryContext";
import { useTool } from "../state/ToolContext";
import { deriveDraftScene } from "../core/projection/deriveDraftScene";
import { getWorldBounds } from "../core/projection/getWorldBounds";
import { getInnerLoopSegment } from "../editor2D/hitTestRoomEdges";
import { getHatchZones, buildHatchPrimitives } from "../core/hatch/hatchZones";
import type { DraftPrimitive } from "../core/rendering/draftPrimitives";
import type { ViewKind } from "../core/view/ViewKind";
import { useViewport2DInteractions } from "../editor2D/useViewport2DInteractions";
import { useDimensionLabelEditing } from "../editor2D/useDimensionLabelEditing";
import { useWindowInteractions } from "../editor2D/useWindowInteractions";
import { useDoorInteractions } from "../editor2D/useDoorInteractions";
import { useHatchInteractions } from "../editor2D/useHatchInteractions";
import { useDimCommit } from "../editor2D/useDimCommit";

export type { ViewKind };

export default function EditorViewport2D({ view, title }: { view: ViewKind; title?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewport = useMemo(() => new Viewport2D(), []);
  const [version, setVersion] = useState(0);

  const { room, execute, previewRoom, commitSnapshot, undo, redo, canUndo, canRedo } = useRoomHistory();
  const { mode: toolMode, setMode, hatchConfig, zoomExtentsTrigger, windowConfig, doorConfig, selectedEntityId, setSelectedEntityId } = useTool();

  const [hoverSeg, setHoverSeg] = useState<number | null>(null);
  const [selectedSeg, setSelectedSeg] = useState<number | null>(null);

  const onViewportChange = useCallback(() => setVersion((v) => v + 1), []);

  // ── Window tool interactions ──
  const { previewPrimitives: windowPreviewPrims, cancelPendingDeselect: cancelWindowDeselect } = useWindowInteractions({
    canvasRef, viewport, view, room, commitSnapshot, previewRoom,
    toolMode, windowConfig, selectedEntityId, setSelectedEntityId, setMode,
    onViewportChange,
  });

  // ── Door tool interactions ──
  const { previewPrimitives: doorPreviewPrims, cancelPendingDeselect: cancelDoorDeselect } = useDoorInteractions({
    canvasRef, viewport, view, room, commitSnapshot, previewRoom,
    toolMode, doorConfig, selectedEntityId, setSelectedEntityId, setMode,
    onViewportChange,
  });

  const cancelPendingDeselect = useCallback(() => {
    cancelWindowDeselect();
    cancelDoorDeselect();
  }, [cancelWindowDeselect, cancelDoorDeselect]);

  // ── Hatch tool interactions ──
  const { activePreviewZone, activePreviewConfig } = useHatchInteractions({
    canvasRef, viewport, view, room, commitSnapshot, toolMode, hatchConfig,
  });

  // Derived scene
  const scene = useMemo(() => {
    const base = deriveDraftScene(view, room);
    const hatchPrims = buildHatchPrimitives(view, room, activePreviewZone, activePreviewConfig);

    const overlays: DraftPrimitive[] = [];

    if (view === "plan") {
      const segIndex = hoverSeg ?? selectedSeg;
      if (segIndex != null && toolMode === "select") {
        const { a, b } = getInnerLoopSegment(room, segIndex);
        overlays.push({
          kind: "line" as const, a, b,
          stroke: { color: "rgba(0,120,255,0.85)", widthMm: 0.6 },
        });
      }
    }

    if (toolMode === "hatch" && activePreviewZone) {
      const zones = getHatchZones(view, room);
      const zone = zones.find((z) => z.id === activePreviewZone);
      if (zone) {
        overlays.push({
          kind: "polyline" as const,
          pts: zone.outer,
          closed: true,
          stroke: { color: "rgba(59,130,246,0.7)", widthMm: 2, dashMm: [20, 15] },
        });
      }
    }

    return { primitives: [...hatchPrims, ...base.primitives, ...overlays, ...windowPreviewPrims, ...doorPreviewPrims] };
  }, [view, room, hoverSeg, selectedSeg, toolMode, activePreviewZone, activePreviewConfig, windowPreviewPrims, doorPreviewPrims]);

  // Dimension label double-click + inline editor
  const { dimEdit, setDimEdit, commitDimEdit: commitWallDimEdit } = useDimensionLabelEditing({
    canvasRef, view, room, viewport,
    scenePrimitives: scene.primitives,
    execute,
    onDimEditOpen: cancelPendingDeselect,
  });

  const { commitDimEdit } = useDimCommit({
    room, selectedEntityId, commitSnapshot, commitWallDimEdit,
  });

  // Pointer interactions: pan, zoom, wall drag, hover highlight
  useViewport2DInteractions({
    canvasRef, viewport, view, room, previewRoom, commitSnapshot,
    setHoverSeg, setSelectedSeg, onViewportChange, toolMode,
  });

  const zoomExtents = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const w = Math.max(1, parent.clientWidth);
    const h = Math.max(1, parent.clientHeight);

    const bounds = getWorldBounds(view, room);
    viewport.fitToWorldBounds(bounds, { w, h }, 28);
    setVersion((v) => v + 1);
  }, [view, room, viewport]);

  // Auto zoom extents on mount / view change / room id change
  useEffect(() => {
    zoomExtents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, room.id]);

  // React to toolbar "Zoom to fit" (all viewports zoom)
  useEffect(() => {
    if (zoomExtentsTrigger > 0) zoomExtents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomExtentsTrigger]);

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

  // Undo/redo keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toLowerCase().includes("mac");
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) return;

      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        if (canUndo) { e.preventDefault(); undo(); }
        return;
      }
      if ((key === "z" && e.shiftKey) || key === "y") {
        if (canRedo) { e.preventDefault(); redo(); }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo, canUndo, canRedo]);

  return (
    <div className="relative w-full h-full bg-[#ffffff] overflow-hidden">
      {dimEdit && (
        <div
          className="absolute z-20"
          style={{
            left: dimEdit.screen.x,
            top: dimEdit.screen.y,
            transform: "translate(-50%, -50%)",
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
