"use client";

import { useCallback } from "react";
import type { RoomModel } from "../model/RoomModel";
import type { Viewport2D } from "./Viewport2D";
import type { ViewKind } from "../core/view/ViewKind";
import type { WindowConfig, ToolMode } from "../state/ToolContext";
import type { WallOpeningEntity } from "../core/entities/entityTypes";
import {
  snapToWall,
  getWindowPlanRect,
  hitTestWindows,
  hitTestWindowsElevation,
  windowEdgeDistances,
  getWindowElevationRect,
} from "../core/entities/windowGeometry";
import { useOpeningInteractions, type OpeningEdgeDistances } from "./useOpeningInteractions";

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

function adaptEdgeDistances(room: RoomModel, entity: WallOpeningEntity): OpeningEdgeDistances {
  const d = windowEdgeDistances(room, entity);
  return {
    leftDist: d.leftDist,
    rightDist: d.rightDist,
    leftPt: d.leftPt,
    rightPt: d.rightPt,
    openingLeftPt: d.windowLeftPt,
    openingRightPt: d.windowRightPt,
  };
}

export function useWindowInteractions(opts: Opts) {
  const { windowConfig, ...rest } = opts;

  const createEntity = useCallback(
    (snap: { wallSegIndex: number; t: number }) => {
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
      return entity;
    },
    [windowConfig],
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
      openingType: "window",
      toolMode: "window",
      idPrefix: "window-",
      createEntity,
      snapToWall,
      hitTest: hitTestWindows,
      hitTestElev: hitTestWindowsElevation,
      getPlanRect: getWindowPlanRect,
      getElevRect: getWindowElevationRect,
      getEdgeDistances: adaptEdgeDistances,
      dimSentinels: {
        left: WIN_DIM_LEFT_SEG,
        right: WIN_DIM_RIGHT_SEG,
        elevHeight: WIN_DIM_ELEV_HEIGHT_SEG,
        elevSill: WIN_DIM_ELEV_SILL_SEG,
      },
      allowElevationDrag: true,
      configWidthMm: windowConfig.widthMm,
    },
  });
}
