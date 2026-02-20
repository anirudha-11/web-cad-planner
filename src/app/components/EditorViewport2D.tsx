"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Viewport2D } from "../editor2D/Viewport2D";
import { CanvasRenderer2D } from "../editor2D/CanvasRenderer2D";
import { useRoomHistory } from "../state/RoomHistoryContext";
import { useTool } from "../state/ToolContext";
import { deriveDraftScene } from "../core/projection/deriveDraftScene";
import { getWorldBounds } from "../core/projection/getWorldBounds";
import { getInnerLoopSegment } from "../editor2D/hitTestRoomEdges";
import { getHatchZones, hitTestZone, buildHatchPrimitives } from "../core/hatch/hatchZones";
import type { DraftPrimitive } from "../editor2D/draftPrimitives";
import type { ViewKind } from "../core/view/ViewKind";
import type { HatchAssignment } from "../model/RoomModel";
import { useViewport2DInteractions } from "../editor2D/useViewport2DInteractions";
import { useDimensionLabelEditing } from "../editor2D/useDimensionLabelEditing";
import { useWindowInteractions, WIN_DIM_LEFT_SEG, WIN_DIM_RIGHT_SEG, WIN_DIM_ELEV_SILL_SEG, WIN_DIM_ELEV_HEIGHT_SEG } from "../editor2D/useWindowInteractions";
import { repositionWindowByDim } from "../core/entities/windowGeometry";
import type { WallOpeningEntity } from "../core/entities/entityTypes";

export type { ViewKind };

export default function EditorViewport2D({ view, title }: { view: ViewKind; title?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewport = useMemo(() => new Viewport2D(), []);
  const [version, setVersion] = useState(0);

  const { room, execute, previewRoom, commitSnapshot, undo, redo, canUndo, canRedo } = useRoomHistory();
  const { mode: toolMode, setMode, hatchConfig, hoverZoneId, setHoverZoneId, zoomExtentsTrigger, windowConfig, selectedEntityId, setSelectedEntityId } = useTool();

  const [hoverSeg, setHoverSeg] = useState<number | null>(null);
  const [selectedSeg, setSelectedSeg] = useState<number | null>(null);

  // Local hover zone ID scoped to this viewport
  const [localHoverZone, setLocalHoverZone] = useState<string | null>(null);

  // ── Window tool interactions ──
  const { previewPrimitives: windowPreviewPrims, cancelPendingDeselect } = useWindowInteractions({
    canvasRef,
    viewport,
    view,
    room,
    commitSnapshot,
    previewRoom,
    toolMode,
    windowConfig,
    selectedEntityId,
    setSelectedEntityId,
    setMode,
    onViewportChange: () => setVersion((v) => v + 1),
  });

  const activePreviewZone = toolMode === "hatch" ? localHoverZone : null;
  const activePreviewConfig: HatchAssignment | null =
    toolMode === "hatch" && activePreviewZone
      ? {
          patternId: hatchConfig.patternId,
          color: hatchConfig.color,
          bgColor: hatchConfig.bgColor,
          spacingMm: hatchConfig.spacingMm,
          lineWidthMm: hatchConfig.lineWidthMm,
          angleDeg: hatchConfig.angleDeg,
          opacity: hatchConfig.opacity,
        }
      : null;

  // Derived scene: hatches first (lowest z), then base geometry, then overlays on top
  const scene = useMemo(() => {
    const base = deriveDraftScene(view, room);
    const hatchPrims = buildHatchPrimitives(view, room, activePreviewZone, activePreviewConfig);

    const overlays: DraftPrimitive[] = [];

    if (view === "plan") {
      const segIndex = hoverSeg ?? selectedSeg;
      if (segIndex != null && toolMode === "select") {
        const { a, b } = getInnerLoopSegment(room, segIndex);
        overlays.push({
          kind: "line" as const,
          a,
          b,
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

    return { primitives: [...hatchPrims, ...base.primitives, ...overlays, ...windowPreviewPrims] };
  }, [view, room, hoverSeg, selectedSeg, toolMode, activePreviewZone, activePreviewConfig, windowPreviewPrims]);

  // Dimension label double-click + inline editor
  const { dimEdit, setDimEdit, commitDimEdit: commitWallDimEdit } = useDimensionLabelEditing({
    canvasRef,
    view,
    room,
    viewport,
    scenePrimitives: scene.primitives,
    execute,
    onDimEditOpen: cancelPendingDeselect,
  });

  const commitDimEdit = useCallback(
    (segIndex: number, raw: string) => {
      const isWindowDim =
        segIndex === WIN_DIM_LEFT_SEG ||
        segIndex === WIN_DIM_RIGHT_SEG ||
        segIndex === WIN_DIM_ELEV_SILL_SEG ||
        segIndex === WIN_DIM_ELEV_HEIGHT_SEG;

      if (isWindowDim) {
        if (!selectedEntityId) return;
        const entity = room.entities[selectedEntityId];
        if (!entity || entity.kind !== "wall-opening") return;
        const n = Number(raw.trim());
        if (!Number.isFinite(n) || n <= 0) return;
        const we = entity as WallOpeningEntity;

        let updated: WallOpeningEntity;
        if (segIndex === WIN_DIM_LEFT_SEG || segIndex === WIN_DIM_RIGHT_SEG) {
          const side = segIndex === WIN_DIM_LEFT_SEG ? "left" : "right";
          updated = repositionWindowByDim(room, we, side, n);
        } else if (segIndex === WIN_DIM_ELEV_SILL_SEG) {
          const clamped = Math.max(0, Math.min(room.wallHeight - we.heightMm, n));
          updated = { ...we, sillHeightMm: clamped };
        } else {
          const maxH = room.wallHeight - (we.sillHeightMm ?? 0);
          const clamped = Math.max(100, Math.min(maxH, n));
          updated = { ...we, heightMm: clamped };
        }

        const before = room;
        const after = { ...room, entities: { ...room.entities, [updated.id]: updated } };
        commitSnapshot(before, after);
      } else {
        commitWallDimEdit(segIndex, raw);
      }
    },
    [commitWallDimEdit, selectedEntityId, room, commitSnapshot],
  );

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
    toolMode,
  });

  // ── Hatch tool interactions ──
  const applyHatch = useCallback(
    (zoneId: string) => {
      const assignment: HatchAssignment = {
        patternId: hatchConfig.patternId,
        color: hatchConfig.color,
        bgColor: hatchConfig.bgColor,
        spacingMm: hatchConfig.spacingMm,
        lineWidthMm: hatchConfig.lineWidthMm,
        angleDeg: hatchConfig.angleDeg,
        opacity: hatchConfig.opacity,
        ...(hatchConfig.tileLengthMm != null && { tileLengthMm: hatchConfig.tileLengthMm }),
        ...(hatchConfig.tileWidthMm != null && { tileWidthMm: hatchConfig.tileWidthMm }),
      };
      const before = room;
      const prevHatches = { ...(room.hatches ?? {}) };
      prevHatches[zoneId] = assignment;
      const after = { ...room, hatches: prevHatches };
      commitSnapshot(before, after);
    },
    [room, hatchConfig, commitSnapshot],
  );

  useEffect(() => {
    if (toolMode !== "hatch") {
      setLocalHoverZone(null);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const zones = getHatchZones(view, room);

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = viewport.screenToWorld({ x: sx, y: sy });
      const hit = hitTestZone(world, zones);
      const zone = hit ? zones.find((z) => z.id === hit.id) : null;
      const canApply = hit && zone && !zone.isWall;
      setLocalHoverZone(canApply ? hit.id : null);
      canvas.style.cursor = canApply ? "crosshair" : "default";
    };

    const onClick = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = viewport.screenToWorld({ x: sx, y: sy });
      const hit = hitTestZone(world, zones);
      if (hit) {
        const zone = zones.find((z) => z.id === hit.id);
        if (zone?.isWall) return; // Wall hatch is fixed by default; don't allow override
        applyHatch(hit.id);
      }
    };

    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerdown", onClick);
    return () => {
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onClick);
      canvas.style.cursor = "default";
    };
  }, [toolMode, canvasRef, viewport, view, room, applyHatch]);

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
