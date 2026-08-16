import type { Metadata } from "next";
import SnookerVisitMonitor from "./snooker-visit-monitor";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "斯诺克用户访问监测",
  description: "世界斯诺克数据中心 POC 前台用户访问监测。",
  robots: { index: false, follow: false },
};

export default function SnookerSiteMonitorPage() {
  return <SnookerVisitMonitor />;
}
