import type { RoomModel } from "../../model/RoomModel";

export type CommandName =
  | "move-wall-line"
  | "set-segment-length"
  | "edit-dimension-text"
  | "replace-room";

export type Command = {
  name: CommandName;
  do(room: RoomModel): RoomModel;
  undo(room: RoomModel): RoomModel;
};

