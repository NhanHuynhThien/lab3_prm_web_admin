import type { Metadata, Viewport } from "next";
import "../styles.css";
import { Providers } from "./providers";
export const metadata: Metadata = {
  title: "TokenLedger Admin",
  description: "Quản trị vận hành TokenLedger",
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
