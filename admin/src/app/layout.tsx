import type { Metadata } from "next";
import "../styles.css";
import { Providers } from "./providers";
export const metadata: Metadata = {
  title: "TokenLedger Admin",
  description: "Quản trị vận hành TokenLedger",
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
