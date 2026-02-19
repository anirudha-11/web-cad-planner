import "./globals.css";
import { RoomHistoryProvider } from "./state/RoomHistoryContext";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <RoomHistoryProvider>{children}</RoomHistoryProvider>
      </body>
    </html>
  );
}
