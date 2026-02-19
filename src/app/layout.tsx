import "./globals.css";
import { RoomProvider } from "./store/RoomContext";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <RoomProvider>{children}</RoomProvider>
      </body>
    </html>
  );
}
