"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RoomModel, Vec2 } from "../model/RoomModel";
import type { DraftPrimitive } from "./draftPrimitives";
import type { Viewport2D } from "./Viewport2D";
import type { ViewKind } from "../core/view/ViewKind";
import type { WindowConfig } from "../state/ToolContext";
import type { ToolMode } from "../state/ToolContext";
import type { WallOpeningEntity } from "../core/entities/entityTypes";
import {
  snapToWall,
  getWindowPlanRect,
  hitTestWindows,
  hitTestWindowsElevation,
  windowEdgeDistances,
  getWindowElevationRect,
} from "../core/entities/windowGeometry";

export const WIN_DIM_LEFT_SEG = -2000;
export const WIN_DIM_RIGHT_SEG = -2001;
export const WIN_DIM_ELEV_SILL_SEG = -2002;
export const WIN_DIM_ELEV_HEIGHT_SEG = -2003;

type Opts = {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  viewport: Viewport2D;
  view: ViewKind;
  room: RoomModel;
  commitSnapshot: (before: RoomModel, after: RoomModel) => void;
  previewRoom: (updater: (prev: RoomModel) => RoomModel) => void;
  toolMode: ToolMode;
  windowConfig: WindowConfig;
  selectedEntityId: string | null;
  setSelectedEntityId: (id: string | null) => void;
  setMode: (mode: ToolMode) => void;
  onViewportChange: () => void;
};

export function useWindowInteractions(opts: Opts) {
  const {
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
    onViewportChange,
  } = opts;

  const [previewPrimitives, setPreviewPrimitives] = useState<DraftPrimitive[]>([]);
  const dragRef = useRef<{
    entityId: string;
    beforeRoom: RoomModel;
    mode: "plan" | "elevation";
    startWorld: Vec2;
  } | null>(null);

  // Tracks whether window mode was entered by clicking an existing window
  // (as opposed to clicking the toolbar button). When true, clicking away
  // should return to select mode rather than staying in placement mode.
  const enteredByClickRef = useRef(false);

  // Delayed deselect so that a double-click on a dimension label is not
  // pre-empted by the first pointerdown deselecting the window.
  const deselectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleDeselect = useCallback(() => {
    if (deselectTimerRef.current) clearTimeout(deselectTimerRef.current);
    deselectTimerRef.current = setTimeout(() => {
      deselectTimerRef.current = null;
      setSelectedEntityId(null);
      if (enteredByClickRef.current) {
        enteredByClickRef.current = false;
        setMode("select");
      }
    }, 300);
  }, [setSelectedEntityId, setMode]);

  const toleranceMm = useCallback(() => 10 / viewport.scale, [viewport.scale]);

  // Reset the entered-by-click flag when leaving window mode
  useEffect(() => {
    if (toolMode !== "window") enteredByClickRef.current = false;
  }, [toolMode]);

  // ── Placement mode (window tool, plan view) ──
  useEffect(() => {
    if (toolMode !== "window" || view !== "plan") {
      setPreviewPrimitives([]);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const onMove = (e: PointerEvent) => {
      if (dragRef.current) return;
      // When editing a selected window, don't show placement preview
      if (selectedEntityId) {
        setPreviewPrimitives([]);
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = viewport.screenToWorld({ x: sx, y: sy });

      const snap = snapToWall(room, world, windowConfig.widthMm, toleranceMm() * 30);
      if (!snap) {
        setPreviewPrimitives([]);
        canvas.style.cursor = "not-allowed";
        return;
      }

      canvas.style.cursor = "crosshair";

      const fakeEntity: WallOpeningEntity = {
        id: "__preview__",
        kind: "wall-opening",
        openingType: "window",
        attach: { wallSegIndex: snap.wallSegIndex, t: snap.t },
        widthMm: windowConfig.widthMm,
        heightMm: windowConfig.heightMm,
        sillHeightMm: windowConfig.sillHeightMm,
        windowStyle: windowConfig.windowStyle,
      };

      const prims = buildPreviewPrimitives(room, fakeEntity);
      setPreviewPrimitives(prims);
    };

    const onClick = (e: PointerEvent) => {
      if (e.button !== 0 || dragRef.current) return;

      // Second click of a double-click: cancel pending deselect, skip placement
      if (e.detail >= 2) {
        if (deselectTimerRef.current) {
          clearTimeout(deselectTimerRef.current);
          deselectTimerRef.current = null;
        }
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = viewport.screenToWorld({ x: sx, y: sy });

      // If clicking on an existing window, just select it (don't place)
      const hitId = hitTestWindows(room, world, toleranceMm());
      if (hitId) {
        setSelectedEntityId(hitId);
        return;
      }

      // If a window was selected, clicking away deselects after a delay
      // so that a double-click on a dimension label is not pre-empted.
      if (selectedEntityId) {
        scheduleDeselect();
        return;
      }

      // Place a new window
      const snap = snapToWall(room, world, windowConfig.widthMm, toleranceMm() * 30);
      if (!snap) return;

      const id = `window-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const entity: WallOpeningEntity = {
        id,
        kind: "wall-opening",
        openingType: "window",
        attach: { wallSegIndex: snap.wallSegIndex, t: snap.t },
        widthMm: windowConfig.widthMm,
        heightMm: windowConfig.heightMm,
        sillHeightMm: windowConfig.sillHeightMm,
        windowStyle: windowConfig.windowStyle,
      };

      const before = room;
      const after = { ...room, entities: { ...room.entities, [id]: entity } };
      commitSnapshot(before, after);
      setSelectedEntityId(id);
    };

    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerdown", onClick);
    return () => {
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onClick);
      canvas.style.cursor = "default";
      setPreviewPrimitives([]);
    };
  }, [toolMode, view, canvasRef, viewport, room, windowConfig, selectedEntityId, commitSnapshot, setSelectedEntityId, scheduleDeselect, toleranceMm]);

  // ── Drag in plan view (select or window mode) ──
  useEffect(() => {
    if (view !== "plan") return;
    if (toolMode !== "select" && toolMode !== "window") return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;

      // Second click of a double-click: cancel pending deselect, skip
      if (e.detail >= 2) {
        if (deselectTimerRef.current) {
          clearTimeout(deselectTimerRef.current);
          deselectTimerRef.current = null;
        }
        return;
      }

      if (toolMode === "window" && !selectedEntityId) return;

      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = viewport.screenToWorld({ x: sx, y: sy });

      const hitId = hitTestWindows(room, world, toleranceMm());
      if (!hitId) {
        if (selectedEntityId && (toolMode === "select" || toolMode === "window")) {
          scheduleDeselect();
        }
        return;
      }

      e.stopPropagation();
      setSelectedEntityId(hitId);
      if (toolMode === "select") {
        setMode("window");
        enteredByClickRef.current = true;
      }
      dragRef.current = {
        entityId: hitId,
        beforeRoom: room,
        mode: "plan",
        startWorld: world,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.mode !== "plan") return;

      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = viewport.screenToWorld({ x: sx, y: sy });

      const entity = drag.beforeRoom.entities[drag.entityId] as WallOpeningEntity | undefined;
      if (!entity) return;

      const snap = snapToWall(drag.beforeRoom, world, entity.widthMm, toleranceMm() * 30);
      if (!snap) return;

      const updated: WallOpeningEntity = {
        ...entity,
        attach: { wallSegIndex: snap.wallSegIndex, t: snap.t },
      };

      previewRoom((prev) => ({
        ...prev,
        entities: { ...prev.entities, [drag.entityId]: updated },
      }));
      onViewportChange();
    };

    const onUp = () => {
      const drag = dragRef.current;
      if (!drag || drag.mode !== "plan") return;
      dragRef.current = null;

      commitSnapshot(drag.beforeRoom, room);
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
    };
  }, [view, toolMode, canvasRef, viewport, room, selectedEntityId, commitSnapshot, previewRoom, setSelectedEntityId, setMode, scheduleDeselect, onViewportChange, toleranceMm]);

  // ── Drag in elevation view (select mode - adjust sill height) ──
  useEffect(() => {
    if (view === "plan") return;
    if (toolMode !== "select" && toolMode !== "window") return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;

      // Second click of a double-click: cancel pending deselect, skip
      if (e.detail >= 2) {
        if (deselectTimerRef.current) {
          clearTimeout(deselectTimerRef.current);
          deselectTimerRef.current = null;
        }
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = viewport.screenToWorld({ x: sx, y: sy });

      const hitId = hitTestWindowsElevation(room, view as Exclude<ViewKind, "plan">, world, toleranceMm());
      if (!hitId) {
        if (selectedEntityId) {
          scheduleDeselect();
        }
        return;
      }

      e.stopPropagation();
      setSelectedEntityId(hitId);
      if (toolMode === "select") {
        setMode("window");
        enteredByClickRef.current = true;
      }
      dragRef.current = {
        entityId: hitId,
        beforeRoom: room,
        mode: "elevation",
        startWorld: world,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.mode !== "elevation") return;

      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = viewport.screenToWorld({ x: sx, y: sy });

      const entity = drag.beforeRoom.entities[drag.entityId] as WallOpeningEntity | undefined;
      if (!entity) return;

      const H = room.wallHeight;
      // In elevation, y=0 is ceiling, y=H is floor. sill = H - y_bottom
      const yBottom = world.y;
      let sill = H - yBottom;
      sill = Math.max(0, Math.min(H - entity.heightMm, sill));
      sill = Math.round(sill / 10) * 10;

      const updated: WallOpeningEntity = { ...entity, sillHeightMm: sill };

      previewRoom((prev) => ({
        ...prev,
        entities: { ...prev.entities, [drag.entityId]: updated },
      }));
      onViewportChange();
    };

    const onUp = () => {
      const drag = dragRef.current;
      if (!drag || drag.mode !== "elevation") return;
      dragRef.current = null;

      commitSnapshot(drag.beforeRoom, room);
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
    };
  }, [view, toolMode, canvasRef, viewport, room, selectedEntityId, commitSnapshot, previewRoom, setSelectedEntityId, setMode, scheduleDeselect, onViewportChange, toleranceMm]);

  // ── Selection overlay: dimension lines for selected window ──
  const selectionOverlays = useMemo<DraftPrimitive[]>(() => {
    if (!selectedEntityId) return [];
    const entity = room.entities[selectedEntityId];
    if (!entity || entity.kind !== "wall-opening" || entity.openingType !== "window") return [];
    if (view === "plan") {
      return buildSelectionDimensions(room, entity as WallOpeningEntity);
    }
    return buildElevationSelectionDimensions(room, entity as WallOpeningEntity, view as Exclude<ViewKind, "plan">);
  }, [selectedEntityId, room, view]);

  const allPreview = useMemo(
    () => [...previewPrimitives, ...selectionOverlays],
    [previewPrimitives, selectionOverlays],
  );

  const cancelPendingDeselect = useCallback(() => {
    if (deselectTimerRef.current) {
      clearTimeout(deselectTimerRef.current);
      deselectTimerRef.current = null;
    }
  }, []);

  return { previewPrimitives: allPreview, cancelPendingDeselect };
}

// ── Preview helpers ──

function buildPreviewPrimitives(room: RoomModel, entity: WallOpeningEntity): DraftPrimitive[] {
  const prims: DraftPrimitive[] = [];
  const rect = getWindowPlanRect(room, entity);
  const [c0, c1, c2, c3] = rect.corners;

  prims.push({
    kind: "polygon" as const,
    outer: [c0, c1, c2, c3],
    fill: { color: "rgba(59,130,246,0.12)" },
    strokeOuter: { color: "rgba(59,130,246,0.7)", widthMm: 2, dashMm: [15, 10] },
  });

  // Dimension lines from window edges to nearest wall vertices
  const dims = windowEdgeDistances(room, entity);
  const dimStroke = { color: "rgba(59,130,246,0.6)", widthMm: 0.8, dashMm: [8, 8] };

  if (dims.leftDist > 1) {
    prims.push({
      kind: "dimension" as const,
      segIndex: -1,
      a: dims.leftPt,
      b: dims.windowLeftPt,
      offsetMm: 120,
      side: "out" as const,
      stroke: dimStroke,
      textSizeMm: 40,
      arrowSizeMm: 30,
      text: `${Math.round(dims.leftDist)}`,
    });
  }

  if (dims.rightDist > 1) {
    prims.push({
      kind: "dimension" as const,
      segIndex: -1,
      a: dims.windowRightPt,
      b: dims.rightPt,
      offsetMm: 120,
      side: "out" as const,
      stroke: dimStroke,
      textSizeMm: 40,
      arrowSizeMm: 30,
      text: `${Math.round(dims.rightDist)}`,
    });
  }

  return prims;
}

function buildSelectionDimensions(room: RoomModel, entity: WallOpeningEntity): DraftPrimitive[] {
  const prims: DraftPrimitive[] = [];
  const dims = windowEdgeDistances(room, entity);
  const dimStroke = { color: "rgba(0,0,0,0.7)", widthMm: 1 };

  if (dims.leftDist > 1) {
    prims.push({
      kind: "dimension" as const,
      segIndex: WIN_DIM_LEFT_SEG,
      a: dims.leftPt,
      b: dims.windowLeftPt,
      offsetMm: 120,
      side: "out" as const,
      stroke: dimStroke,
      textSizeMm: 40,
      arrowSizeMm: 30,
      text: `${Math.round(dims.leftDist)}`,
    });
  }

  if (dims.rightDist > 1) {
    prims.push({
      kind: "dimension" as const,
      segIndex: WIN_DIM_RIGHT_SEG,
      a: dims.windowRightPt,
      b: dims.rightPt,
      offsetMm: 120,
      side: "out" as const,
      stroke: dimStroke,
      textSizeMm: 40,
      arrowSizeMm: 30,
      text: `${Math.round(dims.rightDist)}`,
    });
  }

  // Highlight outline of the selected window
  const rect = getWindowPlanRect(room, entity);
  const [c0, c1, c2, c3] = rect.corners;
  prims.push({
    kind: "polyline" as const,
    pts: [c0, c1, c2, c3],
    closed: true,
    stroke: { color: "rgba(59,130,246,0.8)", widthMm: 2 },
  });

  return prims;
}

function buildElevationSelectionDimensions(
  room: RoomModel,
  entity: WallOpeningEntity,
  view: Exclude<ViewKind, "plan">,
): DraftPrimitive[] {
  const r = getWindowElevationRect(room, entity, view);
  if (!r) return [];

  const prims: DraftPrimitive[] = [];
  const dimStroke = { color: "rgba(0,0,0,0.7)", widthMm: 1 };
  const H = room.wallHeight;

  // Sill height dimension: floor (y=H) to bottom of window (y=y1)
  const sillH = entity.sillHeightMm ?? 900;
  if (sillH > 1) {
    prims.push({
      kind: "dimension" as const,
      segIndex: WIN_DIM_ELEV_SILL_SEG,
      a: { x: r.x1, y: H },
      b: { x: r.x1, y: r.y1 },
      offsetMm: 120,
      side: "out" as const,
      stroke: dimStroke,
      textSizeMm: 40,
      arrowSizeMm: 30,
      text: `${Math.round(sillH)}`,
    });
  }

  // Window height dimension: top of window (y=y0) to bottom (y=y1)
  if (entity.heightMm > 1) {
    prims.push({
      kind: "dimension" as const,
      segIndex: WIN_DIM_ELEV_HEIGHT_SEG,
      a: { x: r.x0, y: r.y0 },
      b: { x: r.x0, y: r.y1 },
      offsetMm: 120,
      side: "in" as const,
      stroke: dimStroke,
      textSizeMm: 40,
      arrowSizeMm: 30,
      text: `${Math.round(entity.heightMm)}`,
    });
  }

  // Highlight outline
  prims.push({
    kind: "polyline" as const,
    pts: [
      { x: r.x0, y: r.y0 },
      { x: r.x1, y: r.y0 },
      { x: r.x1, y: r.y1 },
      { x: r.x0, y: r.y1 },
    ],
    closed: true,
    stroke: { color: "rgba(59,130,246,0.8)", widthMm: 2 },
  });

  return prims;
}
