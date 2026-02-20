"use client";

import EditorViewport2D from "./components/EditorViewport2D";
import Toolbar from "./components/Toolbar";
import { Group, Panel, Separator } from "react-resizable-panels";


function Handle({ vertical }: { vertical: boolean }) {
  return (
    <Separator
      className={[
        "bg-gray-700 hover:bg-gray-900 transition-colors",
        vertical ? "w-1 cursor-col-resize" : "h-1 cursor-row-resize",
      ].join(" ")}
    />
  );
}

export default function Home() {
  return (
    <div className="w-screen h-screen bg-gray-700">
      {/* Floating toolbar overlay */}
      <Toolbar />

      <Group orientation="vertical">
        {/* Top: Plan */}
        <Panel defaultSize={55} minSize={20}>
          <ViewportShell title="PLAN">
            <EditorViewport2D view="plan" title="PLAN" />
          </ViewportShell>
        </Panel>

        <Handle vertical={false} />

        {/* Bottom: 4 elevations */}
        <Panel defaultSize={45} minSize={15}>
          <Group orientation="vertical">
            {/* Row 1 */}
            <Panel defaultSize={50} minSize={10}>
              <Group orientation="horizontal">
                <Panel defaultSize={50} minSize={10}>
                  <ViewportShell title="NORTH">
                    <EditorViewport2D view="north" title="ELEVATION NORTH" />
                  </ViewportShell>
                </Panel>

                <Handle vertical={true} />

                <Panel defaultSize={50} minSize={10}>
                  <ViewportShell title="EAST">
                    <EditorViewport2D view="east" title="ELEVATION EAST" />
                  </ViewportShell>
                </Panel>
              </Group>
            </Panel>

            <Handle vertical={false} />

            {/* Row 2 */}
            <Panel defaultSize={50} minSize={10}>
              <Group orientation="horizontal">
                <Panel defaultSize={50} minSize={10}>
                  <ViewportShell title="SOUTH">
                    <EditorViewport2D view="south" title="ELEVATION SOUTH" />
                  </ViewportShell>
                </Panel>

                <Handle vertical={true} />

                <Panel defaultSize={50} minSize={10}>
                  <ViewportShell title="WEST">
                    <EditorViewport2D view="west" title="ELEVATION WEST" />
                  </ViewportShell>
                </Panel>
              </Group>
            </Panel>
          </Group>
        </Panel>
      </Group>
    </div>
  );
}

function ViewportShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full h-full rounded-md overflow-hidden relative">
      <div className="absolute -left-0 -top-2 z-20 select-none pointer-events-none">
        <span className="bg-gray-700 text-[10px] font-medium tracking-widest text-white uppercase border-b border-white/10 px-1 py-1 rounded-br-md">
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}