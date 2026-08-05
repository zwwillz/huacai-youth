import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "华彩十六球青少年系列赛｜河北廊坊站",
  description: "2026中国华彩十六球青少年系列赛河北廊坊站赛事、赛程、对阵与球员数据。",
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
