import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./capy-plaza.css";
export const metadata: Metadata = {
  title: "CAPY COVE · 카피바라들의 노을 마을",
  description: "카피바라가 되어 걷고, 친구의 작은 세계에 놀러 가요.",
  appleWebApp: { capable: true, title: "CAPY COVE", statusBarStyle: "default" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f6ef",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
