export type HatchPatternId =
  | "none"
  | "solid"
  | "diagonal-right"
  | "diagonal-left"
  | "crosshatch"
  | "horizontal"
  | "vertical"
  | "grid"
  | "dots";

export type HatchConfig = {
  patternId: HatchPatternId;
  color: string;
  bgColor: string;
  spacingMm: number;
  lineWidthMm: number;
  angleDeg: number;
  opacity: number;
};

export type HatchPatternDef = {
  id: HatchPatternId;
  name: string;
  defaultConfig: HatchConfig;
  cssPreview: string;
};

function bg(angle: number, color: string, spacing: number, width: number): string {
  return `repeating-linear-gradient(${angle}deg, transparent, transparent ${spacing - width}px, ${color} ${spacing - width}px, ${color} ${spacing}px)`;
}

export const HATCH_PATTERNS: HatchPatternDef[] = [
  {
    id: "none",
    name: "None",
    defaultConfig: { patternId: "none", color: "transparent", bgColor: "transparent", spacingMm: 0, lineWidthMm: 0, angleDeg: 0, opacity: 1 },
    cssPreview: "linear-gradient(45deg, #f1f1f1 25%, transparent 25%, transparent 75%, #f1f1f1 75%), linear-gradient(45deg, #f1f1f1 25%, transparent 25%, transparent 75%, #f1f1f1 75%)",
  },
  {
    id: "solid",
    name: "Solid",
    defaultConfig: { patternId: "solid", color: "rgba(0,0,0,0.15)", bgColor: "transparent", spacingMm: 0, lineWidthMm: 0, angleDeg: 0, opacity: 1 },
    cssPreview: "linear-gradient(rgba(0,0,0,0.15), rgba(0,0,0,0.15))",
  },
  {
    id: "diagonal-right",
    name: "Diagonal ╲",
    defaultConfig: { patternId: "diagonal-right", color: "rgba(0,0,0,0.5)", bgColor: "transparent", spacingMm: 80, lineWidthMm: 1.5, angleDeg: 45, opacity: 1 },
    cssPreview: bg(45, "rgba(0,0,0,0.5)", 8, 1),
  },
  {
    id: "diagonal-left",
    name: "Diagonal ╱",
    defaultConfig: { patternId: "diagonal-left", color: "rgba(0,0,0,0.5)", bgColor: "transparent", spacingMm: 80, lineWidthMm: 1.5, angleDeg: 135, opacity: 1 },
    cssPreview: bg(135, "rgba(0,0,0,0.5)", 8, 1),
  },
  {
    id: "crosshatch",
    name: "Cross Hatch",
    defaultConfig: { patternId: "crosshatch", color: "rgba(0,0,0,0.4)", bgColor: "transparent", spacingMm: 80, lineWidthMm: 1, angleDeg: 45, opacity: 1 },
    cssPreview: `${bg(45, "rgba(0,0,0,0.4)", 8, 1)}, ${bg(135, "rgba(0,0,0,0.4)", 8, 1)}`,
  },
  {
    id: "horizontal",
    name: "Horizontal",
    defaultConfig: { patternId: "horizontal", color: "rgba(0,0,0,0.45)", bgColor: "transparent", spacingMm: 80, lineWidthMm: 1.5, angleDeg: 0, opacity: 1 },
    cssPreview: bg(0, "rgba(0,0,0,0.45)", 8, 1),
  },
  {
    id: "vertical",
    name: "Vertical",
    defaultConfig: { patternId: "vertical", color: "rgba(0,0,0,0.45)", bgColor: "transparent", spacingMm: 80, lineWidthMm: 1.5, angleDeg: 90, opacity: 1 },
    cssPreview: bg(90, "rgba(0,0,0,0.45)", 8, 1),
  },
  {
    id: "grid",
    name: "Grid",
    defaultConfig: { patternId: "grid", color: "rgba(0,0,0,0.35)", bgColor: "transparent", spacingMm: 100, lineWidthMm: 1, angleDeg: 0, opacity: 1 },
    cssPreview: `${bg(0, "rgba(0,0,0,0.35)", 8, 1)}, ${bg(90, "rgba(0,0,0,0.35)", 8, 1)}`,
  },
  {
    id: "dots",
    name: "Dots",
    defaultConfig: { patternId: "dots", color: "rgba(0,0,0,0.5)", bgColor: "transparent", spacingMm: 60, lineWidthMm: 2, angleDeg: 0, opacity: 1 },
    cssPreview: "radial-gradient(circle, rgba(0,0,0,0.5) 1.5px, transparent 1.5px)",
  },
];

export function defaultConfigFor(patternId: HatchPatternId): HatchConfig {
  const def = HATCH_PATTERNS.find((p) => p.id === patternId);
  return def ? { ...def.defaultConfig } : { ...HATCH_PATTERNS[0].defaultConfig };
}

export function getPatternDef(patternId: HatchPatternId): HatchPatternDef | undefined {
  return HATCH_PATTERNS.find((p) => p.id === patternId);
}
