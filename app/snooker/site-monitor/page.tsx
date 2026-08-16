import type { Metadata } from "next";
import { getDashboardWithLiveOverlay } from "@/lib/snooker/live-overlay";
import SnookerSiteMonitor from "./snooker-site-monitor";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "斯诺克数据监测",
  description: "世界斯诺克数据中心 POC 实时数据源与比分同步监测。",
  robots: { index: false, follow: false },
};

export default async function SnookerSiteMonitorPage() {
  const { snapshot, sourceHealth } = await getDashboardWithLiveOverlay();

  return (
    <SnookerSiteMonitor
      initialSnapshot={snapshot}
      initialSourceHealth={sourceHealth}
    />
  );
}
