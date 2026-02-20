"use client";

import { useCallback } from "react";
import type { RoomModel } from "../model/RoomModel";
import type { Viewport2D } from "./Viewport2D";
import type { ViewKind } from "../core/view/ViewKind";
import type { DoorConfig, ToolMode } from "../state/ToolContext";
import type { WallOpeningEntity } from "../core/entities/entityTypes";
import {
  snapDoorToWall,
  getDoorPlanRect,
  hitTestDoors,
  hitTestDoorsElevation,
  doorEdgeDistances,
  getDoorElevationRect,
} from "../core/entities/doorGeometry";
import { useOpeningInteractions, type OpeningEdgeDistances } from "./useOpeningInteractions";

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

function adaptEdgeDistances(room: RoomModel, entity: WallOpeningEntity): OpeningEdgeDistances {
  const d = doorEdgeDistances(room, entity);
  return {
    leftDist: d.leftDist,
    rightDist: d.rightDist,
    leftPt: d.leftPt,
    rightPt: d.rightPt,
    openingLeftPt: d.doorLeftPt,
    openingRightPt: d.doorRightPt,
  };
}

export function useDoorInteractions(opts: Opts) {
  const { doorConfig, ...rest } = opts;

  const createEntity = useCallback(
    (snap: { wallSegIndex: number; t: number }) => {
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
      return entity;
    },
    [doorConfig],
  );

  return useOpeningInteractions({
    canvasRef: rest.canvasRef,
    viewport: rest.viewport,
    view: rest.view,
    room: rest.room,
    commitSnapshot: rest.commitSnapshot,
    previewRoom: rest.previewRoom,
    currentToolMode: rest.toolMode,
    selectedEntityId: rest.selectedEntityId,
    setSelectedEntityId: rest.setSelectedEntityId,
    setMode: rest.setMode,
    onViewportChange: rest.onViewportChange,
    config: {
      openingType: "door",
      toolMode: "door",
      idPrefix: "door-",
      createEntity,
      snapToWall: snapDoorToWall,
      hitTest: hitTestDoors,
      hitTestElev: hitTestDoorsElevation,
      getPlanRect: getDoorPlanRect,
      getElevRect: getDoorElevationRect,
      getEdgeDistances: adaptEdgeDistances,
      dimSentinels: {
        left: DOOR_DIM_LEFT_SEG,
        right: DOOR_DIM_RIGHT_SEG,
        elevHeight: DOOR_DIM_ELEV_HEIGHT_SEG,
      },
      allowElevationDrag: false,
      configWidthMm: doorConfig.widthMm,
    },
  });
}
