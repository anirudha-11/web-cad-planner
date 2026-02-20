"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { HatchConfig, HatchPatternId } from "../core/hatch/hatchPatterns";
import { defaultConfigFor } from "../core/hatch/hatchPatterns";

export type ToolMode = "select" | "hatch";

type ToolContextValue = {
  mode: ToolMode;
  setMode: (mode: ToolMode) => void;
  hatchConfig: HatchConfig;
  setHatchConfig: (config: HatchConfig | ((prev: HatchConfig) => HatchConfig)) => void;
  selectPattern: (patternId: HatchPatternId) => void;
  hoverZoneId: string | null;
  setHoverZoneId: (id: string | null) => void;
};

const ToolContext = createContext<ToolContextValue | null>(null);

export function ToolProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeRaw] = useState<ToolMode>("select");
  const [hatchConfig, setHatchConfig] = useState<HatchConfig>(defaultConfigFor("diagonal-right"));
  const [hoverZoneId, setHoverZoneId] = useState<string | null>(null);

  const setMode = useCallback((m: ToolMode) => {
    setModeRaw(m);
    if (m !== "hatch") setHoverZoneId(null);
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

  const value = useMemo<ToolContextValue>(
    () => ({ mode, setMode, hatchConfig, setHatchConfig, selectPattern, hoverZoneId, setHoverZoneId }),
    [mode, setMode, hatchConfig, selectPattern, hoverZoneId],
  );

  return <ToolContext.Provider value={value}>{children}</ToolContext.Provider>;
}

export function useTool() {
  const ctx = useContext(ToolContext);
  if (!ctx) throw new Error("useTool must be used inside <ToolProvider>");
  return ctx;
}
