export type HatchPatternId =
  | "none"
  | "solid"
  | "diagonal-right"
  | "diagonal-left"
  | "crosshatch"
  | "horizontal"
  | "vertical"
  | "grid"
  | "dots"
  | "rectangle"
  | "brick"
  | "arch-cut-wall"
  | "herringbone";

export type HatchConfig = {
  patternId: HatchPatternId;
  color: string;
  bgColor: string;
  spacingMm: number;
  lineWidthMm: number;
  angleDeg: number;
  opacity: number;
  /** Tile length (mm); used by rectangle, brick, herringbone instead of spacing */
  tileLengthMm?: number;
  /** Tile width (mm); used by rectangle, brick, herringbone instead of spacing */
  tileWidthMm?: number;
  /** Pair-line options; used by arch-cut-wall and similar patterns */
  pair?: { enabled: boolean; gapMm: number };
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
    defaultConfig: { patternId: "solid", color: "rgba(0,0,0,0.15)", bgColor: "#ffffff", spacingMm: 0, lineWidthMm: 0, angleDeg: 0, opacity: 1 },
    cssPreview: "linear-gradient(rgba(0,0,0,0.15), rgba(0,0,0,0.15))",
  },
  {
    id: "diagonal-right",
    name: "Diagonal ╲",
    defaultConfig: { patternId: "diagonal-right", color: "rgb(122, 122, 122)", bgColor: "#ffffff", spacingMm: 80, lineWidthMm: 1, angleDeg: 45, opacity: 1 },
    cssPreview: bg(45, "rgba(0,0,0,0.5)", 8, 1),
  },
  {
    id: "diagonal-left",
    name: "Diagonal ╱",
    defaultConfig: { patternId: "diagonal-left", color: "rgb(122, 122, 122)", bgColor: "#ffffff", spacingMm: 80, lineWidthMm: 1, angleDeg: 135, opacity: 1 },
    cssPreview: bg(135, "rgba(0,0,0,0.5)", 8, 1),
  },
  {
    id: "arch-cut-wall",
    name: "Wall Cut (Architectural)",
    defaultConfig: {
      patternId: "arch-cut-wall",
      color: "rgb(126, 126, 126)",
      bgColor: "#ffffff",
      spacingMm: 60,
      lineWidthMm: 1,
      angleDeg: 45,
      opacity: 1,
      pair: {
        enabled: true,
        gapMm: 20,
      },
    },
    cssPreview: bg(45, "rgba(0,0,0,0.6)", 6, 1),
  },
  {
    id: "crosshatch",
    name: "Cross Hatch",
    defaultConfig: { patternId: "crosshatch", color: "rgb(122, 122, 122)", bgColor: "#ffffff", spacingMm: 80, lineWidthMm: 1, angleDeg: 45, opacity: 1 },
    cssPreview: `${bg(45, "rgba(0,0,0,0.4)", 8, 1)}, ${bg(135, "rgba(0,0,0,0.4)", 8, 1)}`,
  },
  {
    id: "horizontal",
    name: "Horizontal",
    defaultConfig: { patternId: "horizontal", color: "rgb(122, 122, 122)", bgColor: "#ffffff", spacingMm: 80, lineWidthMm: 1, angleDeg: 0, opacity: 1 },
    cssPreview: bg(0, "rgba(0,0,0,0.45)", 8, 1),
  },
  {
    id: "vertical",
    name: "Vertical",
    defaultConfig: { patternId: "vertical", color: "rgb(122, 122, 122)", bgColor: "#ffffff", spacingMm: 80, lineWidthMm: 1, angleDeg: 90, opacity: 1 },
    cssPreview: bg(90, "rgba(0,0,0,0.45)", 8, 1),
  },
  {
    id: "grid",
    name: "Grid",
    defaultConfig: { patternId: "grid", color: "rgb(122, 122, 122)", bgColor: "#ffffff", spacingMm: 100, lineWidthMm: 1, angleDeg: 0, opacity: 1 },
    cssPreview: `${bg(0, "rgba(0,0,0,0.35)", 8, 1)}, ${bg(90, "rgba(0,0,0,0.35)", 8, 1)}`,
  },
  {
    id: "dots",
    name: "Dots",
    defaultConfig: { patternId: "dots", color: "rgb(122, 122, 122)", bgColor: "#ffffff", spacingMm: 60, lineWidthMm: 2, angleDeg: 0, opacity: 1 },
    cssPreview: "radial-gradient(circle, rgba(0,0,0,0.5) 1.5px, transparent 1.5px)",
  },
  {
    id: "rectangle",
    name: "Rectangle",
    defaultConfig: { patternId: "rectangle", color: "rgb(122, 122, 122)", bgColor: "#ffffff", spacingMm: 100, lineWidthMm: 1, angleDeg: 0, opacity: 1, tileLengthMm: 600, tileWidthMm: 300 },
    cssPreview: "repeating-linear-gradient(to right, transparent, transparent 7px, rgba(0,0,0,0.45) 7px, rgba(0,0,0,0.45) 8px), repeating-linear-gradient(to bottom, transparent, transparent 7px, rgba(0,0,0,0.45) 7px, rgba(0,0,0,0.45) 8px)",
  },
  {
    id: "brick",
    name: "Brick",
    defaultConfig: { patternId: "brick", color: "rgb(122, 122, 122)", bgColor: "#ffffff", spacingMm: 120, lineWidthMm: 1, angleDeg: 0, opacity: 1, tileLengthMm: 300, tileWidthMm: 100 },
    cssPreview: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cdefs%3E%3Cpattern id='b' width='12' height='8' patternUnits='userSpaceOnUse'%3E%3Cpath d='M0 0H12M0 4H12M0 8H12' fill='none' stroke='rgba(0,0,0,0.45)' stroke-width='0.5'/%3E%3Cpath d='M0 0V4M6 0V4M12 0V4' fill='none' stroke='rgba(0,0,0,0.45)' stroke-width='0.5'/%3E%3Cpath d='M3 4V8M9 4V8' fill='none' stroke='rgba(0,0,0,0.45)' stroke-width='0.5'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='url(%23b)'/%3E%3C/svg%3E\")",
  },
  {
    id: "herringbone",
    name: "Herringbone",
    defaultConfig: { patternId: "herringbone", color: "rgb(122, 122, 122)", bgColor: "#ffffff", spacingMm: 80, lineWidthMm: 1, angleDeg: 0, opacity: 1, tileLengthMm: 80, tileWidthMm: 40 },
    cssPreview: "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.45) 4px, rgba(0,0,0,0.45) 5px), repeating-linear-gradient(-45deg, transparent 2px, transparent 6px, rgba(0,0,0,0.45) 6px, rgba(0,0,0,0.45) 7px)",
  },
];

export function defaultConfigFor(patternId: HatchPatternId): HatchConfig {
  const def = HATCH_PATTERNS.find((p) => p.id === patternId);
  return def ? { ...def.defaultConfig } : { ...HATCH_PATTERNS[0].defaultConfig };
}

export function getPatternDef(patternId: HatchPatternId): HatchPatternDef | undefined {
  return HATCH_PATTERNS.find((p) => p.id === patternId);
}
