import type { RoomModel } from "../../model/RoomModel";

export type CommandName =
  | "move-wall-line"
  | "set-segment-length"
  | "edit-dimension-text"
  | "replace-room"
  | "add-entity"
  | "update-entity"
  | "remove-entity";

export type Command = {
  name: CommandName;
  do(room: RoomModel): RoomModel;
  undo(room: RoomModel): RoomModel;
};

