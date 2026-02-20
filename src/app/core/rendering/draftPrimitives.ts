import type { Vec2 } from "../geometry/vec2";
export type { Vec2 } from "../geometry/vec2";

export type StrokeStyle = {
  color: string;       // e.g. "#111827"
  widthMm: number;     // CAD-like lineweights in mm (not px)
  dashMm?: number[];   // dash pattern in mm
};

export type FillStyle = {
  color: string; // solid fill for poche / feature tile zones
};

export type DraftScene = {
  primitives: DraftPrimitive[];
};

export type line = {
  kind: "line"; a: Vec2; b: Vec2; stroke: StrokeStyle
}

export type polyline= {
  kind: "polyline"; pts: Vec2[]; closed?: boolean; stroke: StrokeStyle; fill?: FillStyle
}

export type text = {
  kind: "text"; at: Vec2; text: string; sizeMm: number; color: string; angleDeg?: number
}

export type polygon = {
  kind: "polygon"; outer: Vec2[]; holes?: Vec2[][]; fill?: FillStyle; strokeOuter?: StrokeStyle; strokeHoles?: StrokeStyle;
}

export type dimension = {
  kind: "dimension";
  segIndex: number;
  a: Vec2;              // segment start (world mm)
  b: Vec2;              // segment end (world mm)
  offsetMm: number;     // perpendicular offset from segment to dimension line
  side?: "in" | "out";  // default "in" for plan inner-loop
  text?: string;        // optional override; otherwise computed length
  stroke?: StrokeStyle; // dimension line + ext lines
  textColor?: string;
  textSizeMm?: number;
  arrowSizeMm?: number; // arrowhead size
};

export type hatchFill = {
  kind: "hatchFill";
  zoneId: string;
  outer: Vec2[];
  holes?: Vec2[][];
  patternId: string;
  color: string;
  bgColor?: string;
  spacingMm: number;
  lineWidthMm: number;
  angleDeg: number;
  opacity: number;
  tileLengthMm?: number;
  tileWidthMm?: number;
  /** Pair-line options for poche (e.g. arch-cut-wall): draw two lines per stripe */
  pair?: { enabled: boolean; gapMm: number };
};

export type DraftPrimitive = line | polyline | text | polygon | dimension | hatchFill;
