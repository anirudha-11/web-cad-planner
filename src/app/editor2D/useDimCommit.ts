"use client";

import { useCallback } from "react";
import type { RoomModel } from "../model/RoomModel";
import type { WallOpeningEntity } from "../core/entities/entityTypes";
import { repositionWindowByDim } from "../core/entities/windowGeometry";
import { repositionDoorByDim } from "../core/entities/doorGeometry";
import { WIN_DIM_LEFT_SEG, WIN_DIM_RIGHT_SEG, WIN_DIM_ELEV_SILL_SEG, WIN_DIM_ELEV_HEIGHT_SEG } from "./useWindowInteractions";
import { DOOR_DIM_LEFT_SEG, DOOR_DIM_RIGHT_SEG, DOOR_DIM_ELEV_HEIGHT_SEG } from "./useDoorInteractions";

type Opts = {
  room: RoomModel;
  selectedEntityId: string | null;
  commitSnapshot: (before: RoomModel, after: RoomModel) => void;
  commitWallDimEdit: (segIndex: number, raw: string) => void;
};

export function useDimCommit(opts: Opts) {
  const { room, selectedEntityId, commitSnapshot, commitWallDimEdit } = opts;

  const commitDimEdit = useCallback(
    (segIndex: number, raw: string) => {
      const isWindowDim =
        segIndex === WIN_DIM_LEFT_SEG ||
        segIndex === WIN_DIM_RIGHT_SEG ||
        segIndex === WIN_DIM_ELEV_SILL_SEG ||
        segIndex === WIN_DIM_ELEV_HEIGHT_SEG;

      const isDoorDim =
        segIndex === DOOR_DIM_LEFT_SEG ||
        segIndex === DOOR_DIM_RIGHT_SEG ||
        segIndex === DOOR_DIM_ELEV_HEIGHT_SEG;

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
      } else if (isDoorDim) {
        if (!selectedEntityId) return;
        const entity = room.entities[selectedEntityId];
        if (!entity || entity.kind !== "wall-opening") return;
        const n = Number(raw.trim());
        if (!Number.isFinite(n) || n <= 0) return;
        const we = entity as WallOpeningEntity;

        let updated: WallOpeningEntity;
        if (segIndex === DOOR_DIM_LEFT_SEG || segIndex === DOOR_DIM_RIGHT_SEG) {
          const side = segIndex === DOOR_DIM_LEFT_SEG ? "left" : "right";
          updated = repositionDoorByDim(room, we, side, n);
        } else {
          const maxH = room.wallHeight;
          const clamped = Math.max(100, Math.min(maxH, n));
          updated = { ...we, heightMm: clamped };
        }

        const before = room;
        const after = { ...room, entities: { ...room.entities, [updated.id]: updated } };
        commitSnapshot(before, after);
      } else if (segIndex === -1) {
        const n = Number(raw.trim());
        if (!Number.isFinite(n) || n <= 0) return;
        const clamped = Math.max(100, n);
        const before = room;
        const after = { ...before, wallHeight: clamped };
        commitSnapshot(before, after);
      } else {
        commitWallDimEdit(segIndex, raw);
      }
    },
    [commitWallDimEdit, selectedEntityId, room, commitSnapshot],
  );

  return { commitDimEdit };
}
