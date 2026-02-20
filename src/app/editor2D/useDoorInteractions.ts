"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RoomModel, Vec2 } from "../model/RoomModel";
import type { DraftPrimitive } from "./draftPrimitives";
import type { Viewport2D } from "./Viewport2D";
import type { ViewKind } from "../core/view/ViewKind";
import type { DoorConfig } from "../state/ToolContext";
import type { ToolMode } from "../state/ToolContext";
import type { WallOpeningEntity } from "../core/entities/entityTypes";
import {
  snapDoorToWall,
  getDoorPlanRect,
  hitTestDoors,
  hitTestDoorsElevation,
  doorEdgeDistances,
  getDoorElevationRect,
} from "../core/entities/doorGeometry";

export const DOOR_DIM_LEFT_SEG = -3000;
export const DOOR_DIM_RIGHT_SEG = -3001;
export const DOOR_DIM_ELEV_HEIGHT_SEG = -3002;

type Opts = {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  viewport: Viewport2D;
  view: ViewKind;
  room: RoomModel;
  commitSnapshot: (before: RoomModel, after: RoomModel) => void;
  previewRoom: (updater: (prev: RoomModel) => RoomModel) => void;
  toolMode: ToolMode;
  doorConfig: DoorConfig;
  selectedEntityId: string | null;
  setSelectedEntityId: (id: string | null) => void;
  setMode: (mode: ToolMode) => void;
  onViewportChange: () => void;
};

export function useDoorInteractions(opts: Opts) {
  const {
    canvasRef,
    viewport,
    view,
    room,
    commitSnapshot,
    previewRoom,
    toolMode,
    doorConfig,
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

  const enteredByClickRef = useRef(false);

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

  useEffect(() => {
    if (toolMode !== "door") enteredByClickRef.current = false;
  }, [toolMode]);

  // ── Placement mode (door tool, plan view) ──
  useEffect(() => {
    if (toolMode !== "door" || view !== "plan") {
      setPreviewPrimitives([]);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const onMove = (e: PointerEvent) => {
      if (dragRef.current) return;
      if (selectedEntityId) {
        setPreviewPrimitives([]);
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = viewport.screenToWorld({ x: sx, y: sy });

      const snap = snapDoorToWall(room, world, doorConfig.widthMm, toleranceMm() * 30);
      if (!snap) {
        setPreviewPrimitives([]);
        canvas.style.cursor = "not-allowed";
        return;
      }

      canvas.style.cursor = "crosshair";

      const fakeEntity: WallOpeningEntity = {
        id: "__preview__",
        kind: "wall-opening",
        openingType: "door",
        attach: { wallSegIndex: snap.wallSegIndex, t: snap.t },
        widthMm: doorConfig.widthMm,
        heightMm: doorConfig.heightMm,
        sillHeightMm: 0,
        doorStyle: doorConfig.doorStyle,
        doorLeafSide: doorConfig.leafSide,
        doorSwingDirection: doorConfig.swingDirection,
      };

      const prims = buildDoorPreviewPrimitives(room, fakeEntity);
      setPreviewPrimitives(prims);
    };

    const onClick = (e: PointerEvent) => {
      if (e.button !== 0 || dragRef.current) return;

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

      const hitId = hitTestDoors(room, world, toleranceMm());
      if (hitId) {
        setSelectedEntityId(hitId);
        return;
      }

      if (selectedEntityId) {
        scheduleDeselect();
        return;
      }

      const snap = snapDoorToWall(room, world, doorConfig.widthMm, toleranceMm() * 30);
      if (!snap) return;

      const id = `door-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const entity: WallOpeningEntity = {
        id,
        kind: "wall-opening",
        openingType: "door",
        attach: { wallSegIndex: snap.wallSegIndex, t: snap.t },
        widthMm: doorConfig.widthMm,
        heightMm: doorConfig.heightMm,
        sillHeightMm: 0,
        doorStyle: doorConfig.doorStyle,
        doorLeafSide: doorConfig.leafSide,
        doorSwingDirection: doorConfig.swingDirection,
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
  }, [toolMode, view, canvasRef, viewport, room, doorConfig, selectedEntityId, commitSnapshot, setSelectedEntityId, scheduleDeselect, toleranceMm]);

  // ── Drag in plan view (select or door mode) ──
  useEffect(() => {
    if (view !== "plan") return;
    if (toolMode !== "select" && toolMode !== "door") return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;

      if (e.detail >= 2) {
        if (deselectTimerRef.current) {
          clearTimeout(deselectTimerRef.current);
          deselectTimerRef.current = null;
        }
        return;
      }

      if (toolMode === "door" && !selectedEntityId) return;

      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = viewport.screenToWorld({ x: sx, y: sy });

      const hitId = hitTestDoors(room, world, toleranceMm());
      if (!hitId) {
        if (selectedEntityId && (toolMode === "select" || toolMode === "door")) {
          const selEntity = room.entities[selectedEntityId];
          if (selEntity?.kind === "wall-opening" && selEntity.openingType === "door") {
            scheduleDeselect();
          }
        }
        return;
      }

      e.stopPropagation();
      setSelectedEntityId(hitId);
      if (toolMode === "select") {
        setMode("door");
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

      const snap = snapDoorToWall(drag.beforeRoom, world, entity.widthMm, toleranceMm() * 30);
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

  // ── Drag in elevation view (select or door mode - adjust horizontal position only) ──
  useEffect(() => {
    if (view === "plan") return;
    if (toolMode !== "select" && toolMode !== "door") return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;

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

      const hitId = hitTestDoorsElevation(room, view as Exclude<ViewKind, "plan">, world, toleranceMm());
      if (!hitId) {
        if (selectedEntityId) {
          const selEntity = room.entities[selectedEntityId];
          if (selEntity?.kind === "wall-opening" && selEntity.openingType === "door") {
            scheduleDeselect();
          }
        }
        return;
      }

      e.stopPropagation();
      setSelectedEntityId(hitId);
      if (toolMode === "select") {
        setMode("door");
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

    const onMove = (_e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.mode !== "elevation") return;
      // Doors are always at floor level, no vertical drag in elevation
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

  // ── Selection overlay: dimension lines for selected door ──
  const selectionOverlays = useMemo<DraftPrimitive[]>(() => {
    if (!selectedEntityId) return [];
    const entity = room.entities[selectedEntityId];
    if (!entity || entity.kind !== "wall-opening" || entity.openingType !== "door") return [];
    if (view === "plan") {
      return buildDoorSelectionDimensions(room, entity as WallOpeningEntity);
    }
    return buildDoorElevationSelectionDimensions(room, entity as WallOpeningEntity, view as Exclude<ViewKind, "plan">);
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

function buildDoorPreviewPrimitives(room: RoomModel, entity: WallOpeningEntity): DraftPrimitive[] {
  const prims: DraftPrimitive[] = [];
  const rect = getDoorPlanRect(room, entity);
  const [c0, c1, c2, c3] = rect.corners;

  prims.push({
    kind: "polygon" as const,
    outer: [c0, c1, c2, c3],
    fill: { color: "rgba(59,130,246,0.12)" },
    strokeOuter: { color: "rgba(59,130,246,0.7)", widthMm: 2, dashMm: [15, 10] },
  });

  const dims = doorEdgeDistances(room, entity);
  const dimStroke = { color: "rgba(59,130,246,0.6)", widthMm: 0.8, dashMm: [8, 8] };

  if (dims.leftDist > 1) {
    prims.push({
      kind: "dimension" as const,
      segIndex: -1,
      a: dims.leftPt,
      b: dims.doorLeftPt,
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
      a: dims.doorRightPt,
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

function buildDoorSelectionDimensions(room: RoomModel, entity: WallOpeningEntity): DraftPrimitive[] {
  const prims: DraftPrimitive[] = [];
  const dims = doorEdgeDistances(room, entity);
  const dimStroke = { color: "rgba(0,0,0,0.7)", widthMm: 1 };

  if (dims.leftDist > 1) {
    prims.push({
      kind: "dimension" as const,
      segIndex: DOOR_DIM_LEFT_SEG,
      a: dims.leftPt,
      b: dims.doorLeftPt,
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
      segIndex: DOOR_DIM_RIGHT_SEG,
      a: dims.doorRightPt,
      b: dims.rightPt,
      offsetMm: 120,
      side: "out" as const,
      stroke: dimStroke,
      textSizeMm: 40,
      arrowSizeMm: 30,
      text: `${Math.round(dims.rightDist)}`,
    });
  }

  const rect = getDoorPlanRect(room, entity);
  const [c0, c1, c2, c3] = rect.corners;
  prims.push({
    kind: "polyline" as const,
    pts: [c0, c1, c2, c3],
    closed: true,
    stroke: { color: "rgba(59,130,246,0.8)", widthMm: 2 },
  });

  return prims;
}

function buildDoorElevationSelectionDimensions(
  room: RoomModel,
  entity: WallOpeningEntity,
  view: Exclude<ViewKind, "plan">,
): DraftPrimitive[] {
  const r = getDoorElevationRect(room, entity, view);
  if (!r) return [];

  const prims: DraftPrimitive[] = [];
  const dimStroke = { color: "rgba(0,0,0,0.7)", widthMm: 1 };

  // Door height dimension (no sill dimension since sill is always 0)
  if (entity.heightMm > 1) {
    prims.push({
      kind: "dimension" as const,
      segIndex: DOOR_DIM_ELEV_HEIGHT_SEG,
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
