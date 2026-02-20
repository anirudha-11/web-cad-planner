"use client";

import React from "react";
import { useTool } from "../state/ToolContext";
import { HATCH_PATTERNS, type HatchPatternId, getPatternDef } from "../core/hatch/hatchPatterns";

export default function HatchSidebar() {
  const { hatchConfig, setHatchConfig, selectPattern } = useTool();
  const activeDef = getPatternDef(hatchConfig.patternId as HatchPatternId);

  return (
    <div className="w-56 bg-neutral-900 border-r border-white/10 flex flex-col shrink-0 overflow-y-auto text-neutral-200">
      {/* Pattern grid */}
      <div className="px-3 pt-3 pb-1">
        <h3 className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
          Patterns
        </h3>
        <div className="grid grid-cols-3 gap-1.5">
          {HATCH_PATTERNS.map((p) => {
            const active = hatchConfig.patternId === p.id;
            return (
              <button
                key={p.id}
                title={p.name}
                onClick={() => selectPattern(p.id)}
                className={[
                  "aspect-square rounded border transition-all flex items-center justify-center",
                  active
                    ? "border-blue-500 ring-1 ring-blue-500/50"
                    : "border-white/10 hover:border-white/30",
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
      <div className="px-3 pt-2 pb-1">
        <span className="text-xs text-neutral-400">{activeDef?.name ?? "None"}</span>
      </div>

      <div className="h-px bg-white/10 mx-3 my-1" />

      {/* Customization */}
      <div className="px-3 py-2 flex flex-col gap-2.5 text-[11px]">
        <h3 className="font-semibold text-neutral-400 uppercase tracking-wider">
          Customize
        </h3>

        <Field label="Color">
          <ColorInput
            value={hatchConfig.color}
            onChange={(color) => setHatchConfig((c) => ({ ...c, color }))}
          />
        </Field>

        <Field label="Background">
          <ColorInput
            value={hatchConfig.bgColor}
            onChange={(bgColor) => setHatchConfig((c) => ({ ...c, bgColor }))}
            allowTransparent
          />
        </Field>

        {hatchConfig.patternId !== "solid" && hatchConfig.patternId !== "none" && (
          <>
            <Field label={`Spacing (${Math.round(hatchConfig.spacingMm)} mm)`}>
              <input
                type="range"
                min={20}
                max={300}
                step={5}
                value={hatchConfig.spacingMm}
                onChange={(e) =>
                  setHatchConfig((c) => ({ ...c, spacingMm: Number(e.target.value) }))
                }
                className="w-full accent-blue-500"
              />
            </Field>

            <Field label={`Line Weight (${hatchConfig.lineWidthMm.toFixed(1)} mm)`}>
              <input
                type="range"
                min={0.5}
                max={5}
                step={0.25}
                value={hatchConfig.lineWidthMm}
                onChange={(e) =>
                  setHatchConfig((c) => ({ ...c, lineWidthMm: Number(e.target.value) }))
                }
                className="w-full accent-blue-500"
              />
            </Field>
          </>
        )}

        <Field label={`Opacity (${Math.round(hatchConfig.opacity * 100)}%)`}>
          <input
            type="range"
            min={0.05}
            max={1}
            step={0.05}
            value={hatchConfig.opacity}
            onChange={(e) =>
              setHatchConfig((c) => ({ ...c, opacity: Number(e.target.value) }))
            }
            className="w-full accent-blue-500"
          />
        </Field>
      </div>

      <div className="flex-1" />

      <div className="px-3 py-3 text-[10px] text-neutral-500 leading-relaxed">
        Hover over a zone to preview, click to apply.
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-neutral-400">{label}</span>
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
        className="w-7 h-7 rounded border border-white/20 bg-transparent cursor-pointer p-0"
      />
      <span className="text-neutral-400 text-[10px] font-mono flex-1 truncate">
        {isTransparent ? "transparent" : htmlColor}
      </span>
      {allowTransparent && (
        <button
          onClick={() => onChange(isTransparent ? "#ffffff" : "transparent")}
          className={[
            "px-1.5 py-0.5 rounded text-[9px] border",
            isTransparent
              ? "border-blue-500 text-blue-400"
              : "border-white/15 text-neutral-500 hover:text-neutral-300",
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
        backgroundColor: patternId === "none" ? "#1a1a1a" : undefined,
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
