import React, { useCallback, useEffect, useState } from "react";
import type { ViewKind } from "../core/view/ViewKind";
import type { DraftPrimitive } from "./draftPrimitives";
import type { RoomModel } from "../model/RoomModel";
import type { Viewport2D } from "./Viewport2D";
import type { Command } from "../core/commands/Command";
import { createCommitDimEditCommand } from "../core/commands/roomCommands";

type Vec2 = { x: number; y: number };
type ScreenPt = { x: number; y: number };

export type DimEditState = {
  segIndex: number;
  value: string;
  screen: { x: number; y: number };
};

type UseDimensionLabelEditingArgs = {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  view: ViewKind;
  room: RoomModel;
  viewport: Viewport2D;
  scenePrimitives: DraftPrimitive[];
  execute: (cmd: Command) => void;
  onDimEditOpen?: () => void;
};

export function useDimensionLabelEditing({
  canvasRef,
  view,
  room,
  viewport,
  scenePrimitives,
  execute,
  onDimEditOpen,
}: UseDimensionLabelEditingArgs) {
  const [dimEdit, setDimEdit] = useState<DimEditState | null>(null);

  const openDimEditorFromDim = useCallback(
    (d: Extract<DraftPrimitive, { kind: "dimension" }>) => {
      const labelWorld = dimLabelWorldPos(d);
      const labelScreen = viewport.worldToScreen(labelWorld);

      // For window dimension sentinels (negative segIndex), use the dimension's own text
      const currentText = d.segIndex < 0
        ? (d.text ?? "")
        : (room.dimText?.[d.segIndex] ?? d.text ?? "");

      setDimEdit({
        segIndex: d.segIndex,
        value: currentText,
        screen: labelScreen,
      });
    },
    [room.dimText, viewport]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onDblClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const click: ScreenPt = { x: e.clientX - rect.left, y: e.clientY - rect.top };

      const dims = scenePrimitives.filter(
        (p): p is Extract<DraftPrimitive, { kind: "dimension" }> => p.kind === "dimension"
      );

      const hitRadiusPx = 22;
      const hitR2 = hitRadiusPx * hitRadiusPx;

      let best: { d: (typeof dims)[number]; d2: number } | null = null;

      for (const d of dims) {
        const labelWorld = dimLabelWorldPos(d);
        const labelScreen = viewport.worldToScreen(labelWorld);
        const d2 = dist2(click, labelScreen);

        if (d2 <= hitR2 && (!best || d2 < best.d2)) best = { d, d2 };
      }

      if (best) {
        onDimEditOpen?.();
        openDimEditorFromDim(best.d);
      }
    };

    canvas.addEventListener("dblclick", onDblClick);
    return () => canvas.removeEventListener("dblclick", onDblClick);
  }, [canvasRef, view, scenePrimitives, viewport, openDimEditorFromDim, onDimEditOpen]);

  const commitDimEdit = useCallback(
    (segIndex: number, raw: string) => {
      execute(createCommitDimEditCommand({ before: room, segIndex, raw }));
    },
    [execute, room]
  );

  return { dimEdit, setDimEdit, commitDimEdit };
}

function dimLabelWorldPos(d: { a: Vec2; b: Vec2; offsetMm: number; side?: "in" | "out" }): Vec2 {
  const a = d.a,
    b = d.b;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const L = Math.hypot(dx, dy) || 1;

  const tx = dx / L;
  const ty = dy / L;

  const nx = -ty;
  const ny = tx;

  const side = d.side ?? "in";
  const sgn = side === "in" ? -1 : 1;
  const off = d.offsetMm * sgn;

  const a2 = { x: a.x + nx * off, y: a.y + ny * off };
  const b2 = { x: b.x + nx * off, y: b.y + ny * off };

  return { x: (a2.x + b2.x) / 2, y: (a2.y + b2.y) / 2 };
}

function dist2(a: ScreenPt, b: ScreenPt) {
  const dx = a.x - b.x,
    dy = a.y - b.y;
  return dx * dx + dy * dy;
}

