"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useTool, type WindowConfig } from "../state/ToolContext";
import { useRoomHistory } from "../state/RoomHistoryContext";
import type { WindowStyle, WallOpeningEntity } from "../core/entities/entityTypes";

const WINDOW_STYLES: { id: WindowStyle; label: string }[] = [
  { id: "single-leaf", label: "Single" },
  // { id: "double-leaf", label: "Double" },
  // { id: "fixed", label: "Fixed" },
  // { id: "sliding", label: "Sliding" },
];

export default function WindowToolPanel() {
  const { windowConfig, setWindowConfig, selectedEntityId, setSelectedEntityId } = useTool();
  const { room, commitSnapshot } = useRoomHistory();

  const selectedEntity =
    selectedEntityId && room.entities[selectedEntityId]?.kind === "wall-opening"
      ? (room.entities[selectedEntityId] as WallOpeningEntity)
      : null;

  const setField = useCallback(
    <K extends keyof WindowConfig>(key: K, value: WindowConfig[K]) => {
      setWindowConfig((prev) => ({ ...prev, [key]: value }));
    },
    [setWindowConfig],
  );

  const updateEntity = useCallback(
    (patch: Partial<WallOpeningEntity>) => {
      if (!selectedEntity) return;
      const before = room;
      const updated = { ...selectedEntity, ...patch };
      const after = { ...room, entities: { ...room.entities, [selectedEntity.id]: updated } };
      commitSnapshot(before, after);
    },
    [room, selectedEntity, commitSnapshot],
  );

  const deleteEntity = useCallback(() => {
    if (!selectedEntity) return;
    const before = room;
    const { [selectedEntity.id]: _, ...rest } = room.entities;
    const after = { ...room, entities: rest };
    commitSnapshot(before, after);
    setSelectedEntityId(null);
  }, [room, selectedEntity, commitSnapshot, setSelectedEntityId]);

  const activeStyle = selectedEntity?.windowStyle ?? windowConfig.windowStyle;
  const activeWidth = selectedEntity?.widthMm ?? windowConfig.widthMm;
  const activeHeight = selectedEntity?.heightMm ?? windowConfig.heightMm;
  const activeSill = selectedEntity?.sillHeightMm ?? windowConfig.sillHeightMm;

  return (
    <div className="w-52 border-l border-gray-200 flex flex-col text-gray-700 max-h-[70vh] overflow-y-auto shrink-0">
      <div className="px-3 pt-3 pb-1">
        <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Window type
        </h3>
        <div className="grid grid-cols-2 gap-1.5">
          {WINDOW_STYLES.map((s) => {
            const active = activeStyle === s.id;
            return (
              <button
                key={s.id}
                onClick={() => {
                  setField("windowStyle", s.id);
                  if (selectedEntity) updateEntity({ windowStyle: s.id });
                }}
                className={[
                  "px-2 py-1.5 rounded-md border text-[11px] transition-all",
                  active
                    ? "border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500/40"
                    : "border-gray-200 hover:border-gray-300 text-gray-500",
                ].join(" ")}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-px bg-gray-100 mx-3 my-2" />

      <div className="px-3 py-2 flex flex-col gap-2.5 text-[11px]">
        <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
          Dimensions
        </h3>

        <NumField
          label="Width (mm)"
          value={activeWidth}
          min={100}
          max={5000}
          step={10}
          onChange={(v) => {
            setField("widthMm", v);
            if (selectedEntity) updateEntity({ widthMm: v });
          }}
        />
        <NumField
          label="Height (mm)"
          value={activeHeight}
          min={100}
          max={3000}
          step={10}
          onChange={(v) => {
            setField("heightMm", v);
            if (selectedEntity) updateEntity({ heightMm: v });
          }}
        />
        <NumField
          label="Sill height (mm)"
          value={activeSill}
          min={0}
          max={3000}
          step={10}
          onChange={(v) => {
            setField("sillHeightMm", v);
            if (selectedEntity) updateEntity({ sillHeightMm: v });
          }}
        />
      </div>

      {selectedEntity && (
        <>
          <div className="h-px bg-gray-100 mx-3 my-1" />
          <div className="px-3 py-2">
            <button
              onClick={deleteEntity}
              className="w-full text-[11px] py-1.5 rounded-md border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
            >
              Delete window
            </button>
          </div>
        </>
      )}

      <div className="px-3 py-2 text-[10px] text-gray-400 leading-relaxed">
        {selectedEntity ? "Editing selected window." : "Click on a wall in plan view to place."}
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const n = Number(draft);
    if (Number.isFinite(n) && n >= min && n <= max) {
      onChange(n);
    } else {
      setDraft(String(value));
    }
  };

  return (
    <label className="flex flex-col gap-1">
      <span className="text-gray-500">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit();
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="w-full px-2 py-1 rounded border border-gray-200 text-[11px] focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 outline-none"
      />
    </label>
  );
}
