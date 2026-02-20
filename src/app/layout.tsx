import "./globals.css";
import { RoomHistoryProvider } from "./state/RoomHistoryContext";
import { ToolProvider } from "./state/ToolContext";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <RoomHistoryProvider>
          <ToolProvider>{children}</ToolProvider>
        </RoomHistoryProvider>
      </body>
    </html>
  );
}
