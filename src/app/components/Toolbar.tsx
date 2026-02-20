"use client";

import React, { useCallback, useRef, useState } from "react";
import { useTool, type ToolMode } from "../state/ToolContext";
import { useRoomHistory } from "../state/RoomHistoryContext";
import HatchSidebar from "./HatchSidebar";
import WindowToolPanel from "./WindowToolPanel";

const tools: { id: ToolMode; label: string; icon: React.ReactNode }[] = [
  {
    id: "select",
    label: "Select",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
        <path d="M13 13l6 6" />
      </svg>
    ),
  },
  {
    id: "hatch",
    label: "Tile /Hatch / Fill",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="6" y1="3" x2="3" y2="6" />
        <line x1="10" y1="3" x2="3" y2="10" />
        <line x1="14" y1="3" x2="3" y2="14" />
        <line x1="18" y1="3" x2="3" y2="18" />
        <line x1="21" y1="4" x2="4" y2="21" />
        <line x1="21" y1="8" x2="8" y2="21" />
        <line x1="21" y1="12" x2="12" y2="21" />
        <line x1="21" y1="16" x2="16" y2="21" />
        <line x1="21" y1="20" x2="20" y2="21" />
      </svg>
    ),
  },
  {
    id: "window",
    label: "Window",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="1" />
        <line x1="12" y1="3" x2="12" y2="21" />
        <line x1="3" y1="12" x2="21" y2="12" />
      </svg>
    ),
  },
];

export default function Toolbar() {
  const { mode, setMode, requestZoomExtents } = useTool();
  const { undo, redo, canUndo, canRedo } = useRoomHistory();

  const [pos, setPos] = useState({ x: 16, y: 16 });
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  const onGripDown = useCallback(
    (e: React.PointerEvent) => {
      dragRef.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [pos],
  );

  const onGripMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setPos({ x: d.ox + e.clientX - d.sx, y: d.oy + e.clientY - d.sy });
  }, []);

  const onGripUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  return (
    <div
      className="fixed z-50 rounded-xl bg-white/95 backdrop-blur-sm border border-gray-200 shadow-xl shadow-black/8 overflow-hidden select-none"
      style={{ left: pos.x, top: pos.y }}
    >
      {/* Drag grip */}
      <div
        className="h-5 bg-gray-50 cursor-grab active:cursor-grabbing flex items-center justify-center border-b border-gray-100"
        onPointerDown={onGripDown}
        onPointerMove={onGripMove}
        onPointerUp={onGripUp}
      >
        <svg viewBox="0 0 20 6" className="w-5 h-1.5 text-gray-300">
          <circle cx="4" cy="1.5" r="1.2" fill="currentColor" />
          <circle cx="10" cy="1.5" r="1.2" fill="currentColor" />
          <circle cx="16" cy="1.5" r="1.2" fill="currentColor" />
          <circle cx="4" cy="4.5" r="1.2" fill="currentColor" />
          <circle cx="10" cy="4.5" r="1.2" fill="currentColor" />
          <circle cx="16" cy="4.5" r="1.2" fill="currentColor" />
        </svg>
      </div>

      {/* Row: vertical tool strip + hatch panel (when active) */}
      <div className="flex items-stretch">
        {/* Tool buttons + Undo / Redo / Zoom (vertical) */}
        <div className="flex flex-col gap-0.5 p-1.5 items-center shrink-0">
          {tools.map((t) => (
            <button
              key={t.id}
              title={t.label}
              onClick={() => setMode(t.id)}
              className={[
                "w-9 h-9 flex items-center justify-center rounded-lg transition-colors",
                mode === t.id
                  ? "bg-blue-500 text-white shadow-sm"
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-700",
              ].join(" ")}
            >
              {t.icon}
            </button>
          ))}
          <div className="h-px w-6 bg-gray-200 my-0.5" aria-hidden />
          <button
            title="Undo (Ctrl/Cmd+Z)"
            onClick={undo}
            disabled={!canUndo}
            className="w-9 h-9 flex items-center justify-center rounded-lg transition-colors text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40 disabled:cursor-default disabled:hover:bg-transparent"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 10h10a5 5 0 0 1 5 5v2" />
              <path d="M3 10l4-4M3 10l4 4" />
          </svg>
        </button>
        <button
          title="Redo (Ctrl+Shift+Z / Ctrl+Y)"
          onClick={redo}
          disabled={!canRedo}
          className="w-9 h-9 flex items-center justify-center rounded-lg transition-colors text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40 disabled:cursor-default disabled:hover:bg-transparent"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10H11a5 5 0 0 0-5 5v2" />
            <path d="M21 10l-4-4M21 10l-4 4" />
          </svg>
        </button>
        <button
          title="Zoom to fit"
          onClick={requestZoomExtents}
          className="w-9 h-9 flex items-center justify-center rounded-lg transition-colors text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3" />
            <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
            <path d="M3 16v3a2 2 0 0 0 2 2h3" />
            <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
          </svg>
        </button>
      </div>

      {/* Tool panels expand to the right when active */}
      {mode === "hatch" && <HatchSidebar />}
      {mode === "window" && <WindowToolPanel />}
      </div>
    </div>
  );
}
