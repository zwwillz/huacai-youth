import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "世界斯诺克数据中心｜赛事·比分·球员·数据",
  description: "面向中文用户的世界斯诺克赛事、赛程比分、球员资料、世界排名与数据统计移动端数据中心。",
  robots: { index: false, follow: false },
};

export default function SnookerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
