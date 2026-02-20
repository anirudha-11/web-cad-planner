"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RoomModel } from "../model/RoomModel";
import type { Vec2 } from "../core/geometry/vec2";
import type { DraftPrimitive } from "../core/rendering/draftPrimitives";
import type { Viewport2D } from "./Viewport2D";
import type { ViewKind } from "../core/view/ViewKind";
import type { ToolMode } from "../state/ToolContext";
import type { WallOpeningEntity, EntityId } from "../core/entities/entityTypes";

export type SnapResult = {
  wallSegIndex: number;
  t: number;
  point: Vec2;
};

export type OpeningEdgeDistances = {
  leftDist: number;
  rightDist: number;
  leftPt: Vec2;
  rightPt: Vec2;
  openingLeftPt: Vec2;
  openingRightPt: Vec2;
};

export type PlanRect = {
  corners: [Vec2, Vec2, Vec2, Vec2];
  center: Vec2;
  dir: Vec2;
  normal: Vec2;
};

export type ElevRect = { x0: number; y0: number; x1: number; y1: number };

export type DimSentinels = {
  left: number;
  right: number;
  elevHeight: number;
  elevSill?: number;
};

export type OpeningInteractionConfig = {
  openingType: "window" | "door";
  toolMode: ToolMode;
  idPrefix: string;
  createEntity: (snap: SnapResult) => WallOpeningEntity;
  snapToWall: (room: RoomModel, pt: Vec2, width: number, tol: number) => SnapResult | null;
  hitTest: (room: RoomModel, pt: Vec2, tol: number) => EntityId | null;
  hitTestElev: (room: RoomModel, view: Exclude<ViewKind, "plan">, pt: Vec2, tol: number) => EntityId | null;
  getPlanRect: (room: RoomModel, entity: WallOpeningEntity) => PlanRect;
  getElevRect: (room: RoomModel, entity: WallOpeningEntity, view: Exclude<ViewKind, "plan">) => ElevRect | null;
  getEdgeDistances: (room: RoomModel, entity: WallOpeningEntity) => OpeningEdgeDistances;
  dimSentinels: DimSentinels;
  allowElevationDrag: boolean;
  configWidthMm: number;
};

type Opts = {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  viewport: Viewport2D;
  view: ViewKind;
  room: RoomModel;
  commitSnapshot: (before: RoomModel, after: RoomModel) => void;
  previewRoom: (updater: (prev: RoomModel) => RoomModel) => void;
  currentToolMode: ToolMode;
  selectedEntityId: string | null;
  setSelectedEntityId: (id: string | null) => void;
  setMode: (mode: ToolMode) => void;
  onViewportChange: () => void;
  config: OpeningInteractionConfig;
};

export function useOpeningInteractions(opts: Opts) {
  const {
    canvasRef,
    viewport,
    view,
    room,
    commitSnapshot,
    previewRoom,
    currentToolMode,
    selectedEntityId,
    setSelectedEntityId,
    setMode,
    onViewportChange,
    config,
  } = opts;

  const {
    openingType,
    toolMode: targetToolMode,
    snapToWall: snapFn,
    hitTest,
    hitTestElev,
    createEntity,
    getPlanRect,
    getElevRect,
    getEdgeDistances,
    dimSentinels,
    allowElevationDrag,
    configWidthMm,
  } = config;

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
    if (currentToolMode !== targetToolMode) enteredByClickRef.current = false;
  }, [currentToolMode, targetToolMode]);

  // ── Placement mode (tool active, plan view) ──
  useEffect(() => {
    if (currentToolMode !== targetToolMode || view !== "plan") {
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

      const snap = snapFn(room, world, configWidthMm, toleranceMm() * 30);
      if (!snap) {
        setPreviewPrimitives([]);
        canvas.style.cursor = "not-allowed";
        return;
      }

      canvas.style.cursor = "crosshair";
      const fakeEntity = createEntity(snap);
      const prims = buildPreviewPrimitives(room, fakeEntity, getPlanRect, getEdgeDistances);
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

      const hitId = hitTest(room, world, toleranceMm());
      if (hitId) {
        setSelectedEntityId(hitId);
        return;
      }

      if (selectedEntityId) {
        scheduleDeselect();
        return;
      }

      const snap = snapFn(room, world, configWidthMm, toleranceMm() * 30);
      if (!snap) return;

      const entity = createEntity(snap);
      const before = room;
      const after = { ...room, entities: { ...room.entities, [entity.id]: entity } };
      commitSnapshot(before, after);
      setSelectedEntityId(entity.id);
    };

    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerdown", onClick);
    return () => {
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onClick);
      canvas.style.cursor = "default";
      setPreviewPrimitives([]);
    };
  }, [currentToolMode, targetToolMode, view, canvasRef, viewport, room, configWidthMm, selectedEntityId, commitSnapshot, setSelectedEntityId, scheduleDeselect, toleranceMm, snapFn, hitTest, createEntity, getPlanRect, getEdgeDistances]);

  // ── Drag in plan view ──
  useEffect(() => {
    if (view !== "plan") return;
    if (currentToolMode !== "select" && currentToolMode !== targetToolMode) return;

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

      if (currentToolMode === targetToolMode && !selectedEntityId) return;

      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = viewport.screenToWorld({ x: sx, y: sy });

      const hitId = hitTest(room, world, toleranceMm());
      if (!hitId) {
        if (selectedEntityId && (currentToolMode === "select" || currentToolMode === targetToolMode)) {
          const selEntity = room.entities[selectedEntityId];
          if (selEntity?.kind === "wall-opening" && selEntity.openingType === openingType) {
            scheduleDeselect();
          }
        }
        return;
      }

      e.stopPropagation();
      setSelectedEntityId(hitId);
      if (currentToolMode === "select") {
        setMode(targetToolMode);
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

      const snap = snapFn(drag.beforeRoom, world, entity.widthMm, toleranceMm() * 30);
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
  }, [view, currentToolMode, targetToolMode, canvasRef, viewport, room, selectedEntityId, commitSnapshot, previewRoom, setSelectedEntityId, setMode, scheduleDeselect, onViewportChange, toleranceMm, openingType, hitTest, snapFn]);

  // ── Drag in elevation view ──
  useEffect(() => {
    if (view === "plan") return;
    if (currentToolMode !== "select" && currentToolMode !== targetToolMode) return;

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

      const hitId = hitTestElev(room, view as Exclude<ViewKind, "plan">, world, toleranceMm());
      if (!hitId) {
        if (selectedEntityId) {
          const selEntity = room.entities[selectedEntityId];
          if (selEntity?.kind === "wall-opening" && selEntity.openingType === openingType) {
            scheduleDeselect();
          }
        }
        return;
      }

      e.stopPropagation();
      setSelectedEntityId(hitId);
      if (currentToolMode === "select") {
        setMode(targetToolMode);
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

      if (!allowElevationDrag) return;

      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = viewport.screenToWorld({ x: sx, y: sy });

      const entity = drag.beforeRoom.entities[drag.entityId] as WallOpeningEntity | undefined;
      if (!entity) return;

      const H = room.wallHeight;
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
  }, [view, currentToolMode, targetToolMode, canvasRef, viewport, room, selectedEntityId, commitSnapshot, previewRoom, setSelectedEntityId, setMode, scheduleDeselect, onViewportChange, toleranceMm, openingType, hitTestElev, allowElevationDrag]);

  // ── Selection overlay dimensions ──
  const selectionOverlays = useMemo<DraftPrimitive[]>(() => {
    if (!selectedEntityId) return [];
    const entity = room.entities[selectedEntityId];
    if (!entity || entity.kind !== "wall-opening" || entity.openingType !== openingType) return [];
    if (view === "plan") {
      return buildSelectionDimensions(room, entity as WallOpeningEntity, dimSentinels, getPlanRect, getEdgeDistances);
    }
    return buildElevationSelectionDimensions(room, entity as WallOpeningEntity, view as Exclude<ViewKind, "plan">, dimSentinels, getElevRect);
  }, [selectedEntityId, room, view, openingType, dimSentinels, getPlanRect, getElevRect, getEdgeDistances]);

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

// ── Shared preview/selection helpers ──

function buildPreviewPrimitives(
  room: RoomModel,
  entity: WallOpeningEntity,
  getPlanRect: (room: RoomModel, entity: WallOpeningEntity) => PlanRect,
  getEdgeDistances: (room: RoomModel, entity: WallOpeningEntity) => OpeningEdgeDistances,
): DraftPrimitive[] {
  const prims: DraftPrimitive[] = [];
  const rect = getPlanRect(room, entity);
  const [c0, c1, c2, c3] = rect.corners;

  prims.push({
    kind: "polygon" as const,
    outer: [c0, c1, c2, c3],
    fill: { color: "rgba(59,130,246,0.12)" },
    strokeOuter: { color: "rgba(59,130,246,0.7)", widthMm: 2, dashMm: [15, 10] },
  });

  const dims = getEdgeDistances(room, entity);
  const dimStroke = { color: "rgba(59,130,246,0.6)", widthMm: 0.8, dashMm: [8, 8] };

  if (dims.leftDist > 1) {
    prims.push({
      kind: "dimension" as const,
      segIndex: -1,
      a: dims.leftPt,
      b: dims.openingLeftPt,
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
      a: dims.openingRightPt,
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

function buildSelectionDimensions(
  room: RoomModel,
  entity: WallOpeningEntity,
  sentinels: DimSentinels,
  getPlanRect: (room: RoomModel, entity: WallOpeningEntity) => PlanRect,
  getEdgeDistances: (room: RoomModel, entity: WallOpeningEntity) => OpeningEdgeDistances,
): DraftPrimitive[] {
  const prims: DraftPrimitive[] = [];
  const dims = getEdgeDistances(room, entity);
  const dimStroke = { color: "rgba(0,0,0,0.7)", widthMm: 1 };

  if (dims.leftDist > 1) {
    prims.push({
      kind: "dimension" as const,
      segIndex: sentinels.left,
      a: dims.leftPt,
      b: dims.openingLeftPt,
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
      segIndex: sentinels.right,
      a: dims.openingRightPt,
      b: dims.rightPt,
      offsetMm: 120,
      side: "out" as const,
      stroke: dimStroke,
      textSizeMm: 40,
      arrowSizeMm: 30,
      text: `${Math.round(dims.rightDist)}`,
    });
  }

  const rect = getPlanRect(room, entity);
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
  sentinels: DimSentinels,
  getElevRect: (room: RoomModel, entity: WallOpeningEntity, view: Exclude<ViewKind, "plan">) => ElevRect | null,
): DraftPrimitive[] {
  const r = getElevRect(room, entity, view);
  if (!r) return [];

  const prims: DraftPrimitive[] = [];
  const dimStroke = { color: "rgba(0,0,0,0.7)", widthMm: 1 };
  const H = room.wallHeight;

  if (sentinels.elevSill != null) {
    const sillH = entity.sillHeightMm ?? 900;
    if (sillH > 1) {
      prims.push({
        kind: "dimension" as const,
        segIndex: sentinels.elevSill,
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
  }

  if (entity.heightMm > 1) {
    prims.push({
      kind: "dimension" as const,
      segIndex: sentinels.elevHeight,
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
