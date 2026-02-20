"use client";

import { useTool, type ToolMode } from "../state/ToolContext";

const tools: { id: ToolMode; label: string; icon: React.ReactNode }[] = [
  {
    id: "select",
    label: "Select",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
        <path d="M13 13l6 6" />
      </svg>
    ),
  },
  {
    id: "hatch",
    label: "Hatch / Fill",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="6" y1="3" x2="3" y2="6" />
        <line x1="10" y1="3" x2="3" y2="10" />
        <line x1="14" y1="3" x2="3" y2="14" />
        <line x1="18" y1="3" x2="3" y2="18" />
        <line x1="21" y1="4" x2="4" y2="21" />
        <line x1="21" y1="8" x2="8" y2="21" />
        <line x1="21" y1="12" x2="12" y2="21" />
        <line x1="21" y1="16" x2="16" y2="21" />
        <line x1="21" y1="20" x2="20" y2="21" />
      </svg>
    ),
  },
];

export default function Toolbar() {
  const { mode, setMode } = useTool();

  return (
    <div className="flex flex-col gap-1 bg-neutral-900 py-2 px-1 items-center shrink-0">
      {tools.map((t) => (
        <button
          key={t.id}
          title={t.label}
          onClick={() => setMode(t.id)}
          className={[
            "w-9 h-9 flex items-center justify-center rounded-md transition-colors",
            mode === t.id
              ? "bg-blue-600 text-white"
              : "text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200",
          ].join(" ")}
        >
          {t.icon}
        </button>
      ))}
    </div>
  );
}
