import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "世界斯诺克数据中心｜POC",
  description: "面向中文用户的世界斯诺克赛事、比分、球员与数据统计移动端 POC。",
  robots: {
    index: false,
    follow: false,
  },
};

export default function SnookerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
