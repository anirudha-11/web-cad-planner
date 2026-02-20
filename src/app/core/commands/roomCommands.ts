import type { RoomModel } from "../../model/RoomModel";
import type { Command } from "./Command";
import type { Entity, EntityId } from "../entities/entityTypes";
import { applySegmentLength_Ortho, clearDimOverridesForMovedVertices, moveWallLine } from "../geometry/orthoLoopEdit";

export function createMoveWallLineCommand(args: {
  before: RoomModel;
  axis: "x" | "y";
  coord: number;
  delta: number;
  reason?: string;
}): Command {
  const { before, axis, coord, delta } = args;
  const moved = moveWallLine(before.innerLoop, axis, coord, delta);
  const after = clearDimOverridesForMovedVertices({ ...before, innerLoop: moved.loop }, moved.movedVertexIdxs);

  return {
    name: "move-wall-line",
    do: () => after,
    undo: () => before,
  };
}

export function createSetSegmentLengthCommand(args: {
  before: RoomModel;
  segIndex: number;
  newLenMm: number;
}): Command {
  const { before, segIndex, newLenMm } = args;
  const after = applySegmentLength_Ortho(before, segIndex, newLenMm);
  return {
    name: "set-segment-length",
    do: () => after,
    undo: () => before,
  };
}

export function createEditDimensionTextCommand(args: {
  before: RoomModel;
  segIndex: number;
  text: string;
}): Command {
  const { before, segIndex, text } = args;
  const after: RoomModel = {
    ...before,
    dimText: { ...(before.dimText ?? {}), [segIndex]: text },
  };

  return {
    name: "edit-dimension-text",
    do: () => after,
    undo: () => before,
  };
}

export function createCommitDimEditCommand(args: { before: RoomModel; segIndex: number; raw: string }): Command {
  const cleaned = args.raw.trim();
  const withText: RoomModel = {
    ...args.before,
    dimText: { ...(args.before.dimText ?? {}), [args.segIndex]: cleaned },
  };

  const n = Number(cleaned);
  const after =
    Number.isFinite(n) && n > 0 ? applySegmentLength_Ortho(withText, args.segIndex, n) : withText;

  return {
    name: "edit-dimension-text",
    do: () => after,
    undo: () => args.before,
  };
}

export function createAddEntityCommand(before: RoomModel, entity: Entity): Command {
  const after: RoomModel = {
    ...before,
    entities: { ...before.entities, [entity.id]: entity },
  };
  return { name: "add-entity", do: () => after, undo: () => before };
}

export function createUpdateEntityCommand(before: RoomModel, entity: Entity): Command {
  const after: RoomModel = {
    ...before,
    entities: { ...before.entities, [entity.id]: entity },
  };
  return { name: "update-entity", do: () => after, undo: () => before };
}

export function createRemoveEntityCommand(before: RoomModel, entityId: EntityId): Command {
  const { [entityId]: _, ...rest } = before.entities;
  const after: RoomModel = { ...before, entities: rest };
  return { name: "remove-entity", do: () => after, undo: () => before };
}

