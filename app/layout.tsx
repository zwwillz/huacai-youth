import type { Metadata } from "next";
import "./globals.css";
import "./public-ux-polish.css";

export const metadata: Metadata = {
  title: "中国华彩十六球青少年系列赛｜官方赛事平台",
  description: "中国华彩十六球青少年系列赛官方赛事平台，提供赛事信息、赛程、对阵、排名及球员数据。",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
