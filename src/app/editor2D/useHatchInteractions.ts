"use client";

import { useCallback, useEffect, useState } from "react";
import type { RoomModel, HatchAssignment } from "../model/RoomModel";
import type { Viewport2D } from "./Viewport2D";
import type { ViewKind } from "../core/view/ViewKind";
import type { ToolMode } from "../state/ToolContext";
import { getHatchZones, hitTestZone } from "../core/hatch/hatchZones";

type HatchConfig = {
  patternId: string;
  color: string;
  bgColor: string;
  spacingMm: number;
  lineWidthMm: number;
  angleDeg: number;
  opacity: number;
  tileLengthMm?: number;
  tileWidthMm?: number;
};

type Opts = {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  viewport: Viewport2D;
  view: ViewKind;
  room: RoomModel;
  commitSnapshot: (before: RoomModel, after: RoomModel) => void;
  toolMode: ToolMode;
  hatchConfig: HatchConfig;
};

export function useHatchInteractions(opts: Opts) {
  const { canvasRef, viewport, view, room, commitSnapshot, toolMode, hatchConfig } = opts;

  const [localHoverZone, setLocalHoverZone] = useState<string | null>(null);

  const activePreviewZone = toolMode === "hatch" ? localHoverZone : null;
  const activePreviewConfig: HatchAssignment | null =
    toolMode === "hatch" && activePreviewZone
      ? {
          patternId: hatchConfig.patternId,
          color: hatchConfig.color,
          bgColor: hatchConfig.bgColor,
          spacingMm: hatchConfig.spacingMm,
          lineWidthMm: hatchConfig.lineWidthMm,
          angleDeg: hatchConfig.angleDeg,
          opacity: hatchConfig.opacity,
        }
      : null;

  const applyHatch = useCallback(
    (zoneId: string) => {
      const assignment: HatchAssignment = {
        patternId: hatchConfig.patternId,
        color: hatchConfig.color,
        bgColor: hatchConfig.bgColor,
        spacingMm: hatchConfig.spacingMm,
        lineWidthMm: hatchConfig.lineWidthMm,
        angleDeg: hatchConfig.angleDeg,
        opacity: hatchConfig.opacity,
        ...(hatchConfig.tileLengthMm != null && { tileLengthMm: hatchConfig.tileLengthMm }),
        ...(hatchConfig.tileWidthMm != null && { tileWidthMm: hatchConfig.tileWidthMm }),
      };
      const before = room;
      const prevHatches = { ...(room.hatches ?? {}) };
      prevHatches[zoneId] = assignment;
      const after = { ...room, hatches: prevHatches };
      commitSnapshot(before, after);
    },
    [room, hatchConfig, commitSnapshot],
  );

  useEffect(() => {
    if (toolMode !== "hatch") {
      setLocalHoverZone(null);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const zones = getHatchZones(view, room);

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = viewport.screenToWorld({ x: sx, y: sy });
      const hit = hitTestZone(world, zones);
      const zone = hit ? zones.find((z) => z.id === hit.id) : null;
      const canApply = hit && zone && !zone.isWall;
      setLocalHoverZone(canApply ? hit.id : null);
      canvas.style.cursor = canApply ? "crosshair" : "default";
    };

    const onClick = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = viewport.screenToWorld({ x: sx, y: sy });
      const hit = hitTestZone(world, zones);
      if (hit) {
        const zone = zones.find((z) => z.id === hit.id);
        if (zone?.isWall) return;
        applyHatch(hit.id);
      }
    };

    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerdown", onClick);
    return () => {
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onClick);
      canvas.style.cursor = "default";
    };
  }, [toolMode, canvasRef, viewport, view, room, applyHatch]);

  return { activePreviewZone, activePreviewConfig };
}
