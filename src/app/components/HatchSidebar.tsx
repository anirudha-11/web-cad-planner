"use client";

import React, { useEffect } from "react";
import { useTool } from "../state/ToolContext";
import { HATCH_PATTERNS, type HatchPatternId, getPatternDef } from "../core/hatch/hatchPatterns";

const TILE_PATTERN_IDS = ["rectangle", "brick", "herringbone"] as const;
const TILE_PATTERNS = HATCH_PATTERNS.filter((p) => TILE_PATTERN_IDS.includes(p.id as (typeof TILE_PATTERN_IDS)[number]));

export default function HatchSidebar() {
  const { hatchConfig, setHatchConfig, selectPattern } = useTool();
  const activeDef = getPatternDef(hatchConfig.patternId as HatchPatternId);

  // When sidebar is for tile patterns only, ensure selection is one of them
  useEffect(() => {
    if (!TILE_PATTERN_IDS.includes(hatchConfig.patternId as (typeof TILE_PATTERN_IDS)[number])) {
      selectPattern("rectangle");
    }
  }, [hatchConfig.patternId, selectPattern]);

  return (
    <div className="w-52 border-l border-gray-200 flex flex-col text-gray-700 max-h-[70vh] overflow-y-auto shrink-0">
      {/* Pattern grid: only rectangle, brick, herringbone */}
      <div className="px-3 pt-3 pb-1">
        <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Patterns
        </h3>
        <div className="grid grid-cols-3 gap-1.5">
          {TILE_PATTERNS.map((p) => {
            const active = hatchConfig.patternId === p.id;
            return (
              <button
                key={p.id}
                title={p.name}
                onClick={() => selectPattern(p.id)}
                className={[
                  "aspect-square rounded-md border transition-all flex items-center justify-center",
                  active
                    ? "border-blue-500 ring-1 ring-blue-500/40 shadow-sm"
                    : "border-gray-200 hover:border-gray-300",
                ].join(" ")}
              >
                <PatternSwatch
                  cssPreview={p.cssPreview}
                  patternId={p.id}
                  color={active ? hatchConfig.color : p.defaultConfig.color}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Active pattern label */}
      <div className="px-3 pt-1.5 pb-1">
        <span className="text-[11px] text-gray-400">{activeDef?.name ?? "—"}</span>
      </div>

      <div className="h-px bg-gray-100 mx-3 my-1" />

      {/* Customization: tile length, tile width, background only (no color, line weight, opacity) */}
      <div className="px-3 py-2 flex flex-col gap-2.5 text-[11px]">
        <h3 className="font-semibold text-gray-400 uppercase tracking-wider text-[10px]">
          Customize
        </h3>

        <Field label="Background">
          <ColorInput
            value={hatchConfig.bgColor}
            onChange={(bgColor) => setHatchConfig((c) => ({ ...c, bgColor }))}
            allowTransparent
          />
        </Field>

        <Field label={`Tile length (${Math.round(hatchConfig.tileLengthMm ?? hatchConfig.spacingMm)} mm)`}>
          <input
            type="range"
            min={100}
            max={1000}
            step={10}
            value={hatchConfig.tileLengthMm ?? hatchConfig.spacingMm}
            onChange={(e) =>
              setHatchConfig((c) => ({ ...c, tileLengthMm: Number(e.target.value) }))
            }
            className="w-full accent-blue-500"
          />
        </Field>
        <Field label={`Tile width (${Math.round(hatchConfig.tileWidthMm ?? (hatchConfig.patternId === "rectangle" ? hatchConfig.spacingMm : hatchConfig.spacingMm / 2))} mm)`}>
          <input
            type="range"
            min={100}
            max={1000}
            step={10}
            value={hatchConfig.tileWidthMm ?? (hatchConfig.patternId === "rectangle" ? hatchConfig.spacingMm : hatchConfig.spacingMm / 2)}
            onChange={(e) =>
              setHatchConfig((c) => ({ ...c, tileWidthMm: Number(e.target.value) }))
            }
            className="w-full accent-blue-500"
          />
        </Field>
      </div>

      <div className="px-3 py-2 text-[10px] text-gray-400 leading-relaxed">
        Hover a zone to preview, click to apply.
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-gray-500">{label}</span>
      {children}
    </label>
  );
}

function ColorInput({
  value,
  onChange,
  allowTransparent,
}: {
  value: string;
  onChange: (v: string) => void;
  allowTransparent?: boolean;
}) {
  const isTransparent = value === "transparent";
  const htmlColor = isTransparent ? "#ffffff" : toHex(value);

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="color"
        value={htmlColor}
        onChange={(e) => onChange(e.target.value)}
        className="w-7 h-7 rounded border border-gray-200 bg-white cursor-pointer p-0"
      />
      <span className="text-gray-400 text-[10px] font-mono flex-1 truncate">
        {isTransparent ? "transparent" : htmlColor}
      </span>
      {allowTransparent && (
        <button
          onClick={() => onChange(isTransparent ? "#ffffff" : "transparent")}
          className={[
            "px-1.5 py-0.5 rounded text-[9px] border",
            isTransparent
              ? "border-blue-500 text-blue-500"
              : "border-gray-200 text-gray-400 hover:text-gray-600",
          ].join(" ")}
        >
          {isTransparent ? "Clear" : "None"}
        </button>
      )}
    </div>
  );
}

function PatternSwatch({
  cssPreview,
  patternId,
  color,
}: {
  cssPreview: string;
  patternId: string;
  color: string;
}) {
  const size = patternId === "dots" ? "6px 6px" : undefined;

  return (
    <div
      className="w-full h-full rounded-sm"
      style={{
        backgroundImage: cssPreview,
        backgroundSize: size,
        backgroundColor: patternId === "none" ? "#f3f4f6" : undefined,
      }}
    />
  );
}

function toHex(color: string): string {
  if (color.startsWith("#")) return color;
  const m = color.match(/\d+/g);
  if (!m || m.length < 3) return "#000000";
  const [r, g, b] = m.map(Number);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
