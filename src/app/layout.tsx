import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "ISOLA · 우리의 작은 낙원",
  description: "좋아하는 것들로 채운 작은 섬. 친구들과 함께, 나답게 머무는 곳.",
  appleWebApp: { capable: true, title: "ISOLA", statusBarStyle: "default" },
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
