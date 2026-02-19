"use client";

import EditorViewport2D from "./components/EditorViewport2D";
import { Group, Panel, Separator } from "react-resizable-panels";


function Handle({ vertical }: { vertical: boolean }) {
  return (
    <Separator
      className={[
        "bg-white/10 hover:bg-white/20 transition-colors",
        vertical ? "w-1 cursor-col-resize" : "h-1 cursor-row-resize",
      ].join(" ")}
    />
  );
}

export default function Home() {
  return (
    <div className="w-screen h-screen bg-black p-1">
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
                  <ViewportShell title="ELEVATION NORTH">
                    <EditorViewport2D view="north" title="ELEVATION NORTH" />
                  </ViewportShell>
                </Panel>

                <Handle vertical={true} />

                <Panel defaultSize={50} minSize={10}>
                  <ViewportShell title="ELEVATION EAST">
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
                  <ViewportShell title="ELEVATION SOUTH">
                    <EditorViewport2D view="south" title="ELEVATION SOUTH" />
                  </ViewportShell>
                </Panel>

                <Handle vertical={true} />

                <Panel defaultSize={50} minSize={10}>
                  <ViewportShell title="ELEVATION WEST">
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
    <div className="w-full h-full rounded-sm overflow-hidden border border-white/10 relative">
      <div className="absolute left-2 top-2 z-20 text-xs text-black/60 select-none pointer-events-none">
        {title}
      </div>
      {children}
    </div>
  );
}