"use client";

import React, { createContext, useContext, useMemo, useReducer } from "react";
import type { RoomModel } from "../model/RoomModel";
import { createDefaultRoom } from "../model/RoomModel";

type RoomAction =
  | { type: "SET_ROOM"; updater: (prev: RoomModel) => RoomModel }
  | { type: "REPLACE_ROOM"; room: RoomModel };

function roomReducer(state: RoomModel, action: RoomAction): RoomModel {
  switch (action.type) {
    case "SET_ROOM":
      return action.updater(state);
    case "REPLACE_ROOM":
      return action.room;
    default:
      return state;
  }
}

type RoomContextValue = {
  room: RoomModel;
  setRoom: (updater: (prev: RoomModel) => RoomModel) => void;
  replaceRoom: (room: RoomModel) => void;
};

const RoomContext = createContext<RoomContextValue | null>(null);

export function RoomProvider({ children }: { children: React.ReactNode }) {
  const [room, dispatch] = useReducer(roomReducer, undefined, createDefaultRoom);

  const value = useMemo<RoomContextValue>(() => {
    return {
      room,
      setRoom: (updater) => dispatch({ type: "SET_ROOM", updater }),
      replaceRoom: (r) => dispatch({ type: "REPLACE_ROOM", room: r }),
    };
  }, [room]);

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoom() {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error("useRoom must be used inside <RoomProvider>");
  return ctx;
}
