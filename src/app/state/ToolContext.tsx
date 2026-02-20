"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { HatchConfig, HatchPatternId } from "../core/hatch/hatchPatterns";
import { defaultConfigFor } from "../core/hatch/hatchPatterns";
import type { WindowStyle } from "../core/entities/entityTypes";

export type WindowConfig = {
  widthMm: number;
  heightMm: number;
  sillHeightMm: number;
  windowStyle: WindowStyle;
};

export type ToolMode = "select" | "hatch" | "window";

type ToolContextValue = {
  mode: ToolMode;
  setMode: (mode: ToolMode) => void;
  hatchConfig: HatchConfig;
  setHatchConfig: (config: HatchConfig | ((prev: HatchConfig) => HatchConfig)) => void;
  selectPattern: (patternId: HatchPatternId) => void;
  hoverZoneId: string | null;
  setHoverZoneId: (id: string | null) => void;
  zoomExtentsTrigger: number;
  requestZoomExtents: () => void;
  windowConfig: WindowConfig;
  setWindowConfig: (config: WindowConfig | ((prev: WindowConfig) => WindowConfig)) => void;
  selectedEntityId: string | null;
  setSelectedEntityId: (id: string | null) => void;
};

const ToolContext = createContext<ToolContextValue | null>(null);

export function ToolProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeRaw] = useState<ToolMode>("select");
  const [hatchConfig, setHatchConfig] = useState<HatchConfig>(defaultConfigFor("diagonal-right"));
  const [hoverZoneId, setHoverZoneId] = useState<string | null>(null);
  const [zoomExtentsTrigger, setZoomExtentsTrigger] = useState(0);
  const [windowConfig, setWindowConfig] = useState<WindowConfig>({
    widthMm: 1200,
    heightMm: 1200,
    sillHeightMm: 900,
    windowStyle: "single-leaf",
  });
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

  const setMode = useCallback((m: ToolMode) => {
    setModeRaw(m);
    if (m !== "hatch") setHoverZoneId(null);
    if (m !== "select" && m !== "window") setSelectedEntityId(null);
  }, []);

  const selectPattern = useCallback(
    (patternId: HatchPatternId) => {
      const defaults = defaultConfigFor(patternId);
      setHatchConfig((prev) => ({
        ...defaults,
        color: prev.color !== "transparent" ? prev.color : defaults.color,
        bgColor: prev.bgColor,
        opacity: prev.opacity,
      }));
    },
    [],
  );

  const requestZoomExtents = useCallback(() => {
    setZoomExtentsTrigger((n) => n + 1);
  }, []);

  const value = useMemo<ToolContextValue>(
    () => ({ mode, setMode, hatchConfig, setHatchConfig, selectPattern, hoverZoneId, setHoverZoneId, zoomExtentsTrigger, requestZoomExtents, windowConfig, setWindowConfig, selectedEntityId, setSelectedEntityId }),
    [mode, setMode, hatchConfig, selectPattern, hoverZoneId, zoomExtentsTrigger, requestZoomExtents, windowConfig, selectedEntityId],
  );

  return <ToolContext.Provider value={value}>{children}</ToolContext.Provider>;
}

export function useTool() {
  const ctx = useContext(ToolContext);
  if (!ctx) throw new Error("useTool must be used inside <ToolProvider>");
  return ctx;
}
