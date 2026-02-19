"use client";

import React, { createContext, useCallback, useContext, useMemo, useReducer } from "react";
import type { RoomModel } from "../model/RoomModel";
import { createDefaultRoom } from "../model/RoomModel";
import type { Command } from "../core/commands/Command";

type HistoryState = {
  past: RoomModel[];
  present: RoomModel;
  future: RoomModel[];
};

type HistoryAction =
  | { type: "EXECUTE"; cmd: Command }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "PREVIEW_SET"; updater: (prev: RoomModel) => RoomModel }
  | { type: "COMMIT_SNAPSHOT"; before: RoomModel; after: RoomModel }
  | { type: "REPLACE_PRESENT"; room: RoomModel };

function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case "EXECUTE": {
      const before = state.present;
      const after = action.cmd.do(before);
      if (after === before) return state;
      return { past: [...state.past, before], present: after, future: [] };
    }
    case "UNDO": {
      if (!state.past.length) return state;
      const before = state.present;
      const prev = state.past[state.past.length - 1];
      return { past: state.past.slice(0, -1), present: prev, future: [before, ...state.future] };
    }
    case "REDO": {
      if (!state.future.length) return state;
      const before = state.present;
      const next = state.future[0];
      return { past: [...state.past, before], present: next, future: state.future.slice(1) };
    }
    case "PREVIEW_SET": {
      return { ...state, present: action.updater(state.present) };
    }
    case "COMMIT_SNAPSHOT": {
      const { before, after } = action;
      if (after === before) return state;
      return { past: [...state.past, before], present: after, future: [] };
    }
    case "REPLACE_PRESENT": {
      return { ...state, present: action.room };
    }
    default:
      return state;
  }
}

type RoomHistoryContextValue = {
  room: RoomModel;
  execute: (cmd: Command) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // For continuous interactions (dragging): update without pushing history.
  previewRoom: (updater: (prev: RoomModel) => RoomModel) => void;
  commitSnapshot: (before: RoomModel, after: RoomModel) => void;
  replaceRoom: (room: RoomModel) => void;
};

const RoomHistoryContext = createContext<RoomHistoryContextValue | null>(null);

export function RoomHistoryProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(historyReducer, undefined, () => ({
    past: [],
    present: createDefaultRoom(),
    future: [],
  }));

  const execute = useCallback((cmd: Command) => dispatch({ type: "EXECUTE", cmd }), []);
  const undo = useCallback(() => dispatch({ type: "UNDO" }), []);
  const redo = useCallback(() => dispatch({ type: "REDO" }), []);
  const previewRoom = useCallback(
    (updater: (prev: RoomModel) => RoomModel) => dispatch({ type: "PREVIEW_SET", updater }),
    []
  );
  const commitSnapshot = useCallback((before: RoomModel, after: RoomModel) => {
    dispatch({ type: "COMMIT_SNAPSHOT", before, after });
  }, []);
  const replaceRoom = useCallback((room: RoomModel) => dispatch({ type: "REPLACE_PRESENT", room }), []);

  const value = useMemo<RoomHistoryContextValue>(() => {
    return {
      room: state.present,
      execute,
      undo,
      redo,
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
      previewRoom,
      commitSnapshot,
      replaceRoom,
    };
  }, [state.present, state.past.length, state.future.length, execute, undo, redo, previewRoom, commitSnapshot, replaceRoom]);

  return <RoomHistoryContext.Provider value={value}>{children}</RoomHistoryContext.Provider>;
}

export function useRoomHistory() {
  const ctx = useContext(RoomHistoryContext);
  if (!ctx) throw new Error("useRoomHistory must be used inside <RoomHistoryProvider>");
  return ctx;
}

