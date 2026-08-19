import { redirect } from "next/navigation";
import { getSnookerOpsViewer } from "@/lib/snooker/data-ops-auth";
import MonitorModeNav from "./monitor-mode-nav";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SnookerMonitorLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getSnookerOpsViewer();
  if (!viewer || viewer.mustChangePassword) {
    redirect("/snooker/data-ops");
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f7f6fa" }}>
      <MonitorModeNav />
      {children}
    </div>
  );
}
