import { redirect } from "next/navigation";
import { getAdminViewer } from "../../admin-viewer";
import { getAdminNavigationEvents } from "@/db/admin-ui";
import { getScheduleWorkspaceData } from "@/db/schedule-engine";
import AdminWorkspaceShell from "../../admin-workspace-shell";
import ScheduleWorkbenchClient from "./schedule-workbench-client";
import "./schedule-workbench.css";

export const dynamic = "force-dynamic";

export default async function ScheduleWorkbenchPage({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  const query = await searchParams;
  const sessionId = String(query.session || "");
  if (!sessionId) redirect("/admin/competition");
  const events = await getAdminNavigationEvents(viewer.username);

  try {
    const data = await getScheduleWorkspaceData(viewer.username, sessionId);
    return <AdminWorkspaceShell
      viewer={{ displayName: viewer.displayName, role: viewer.role }}
      events={events}
      active="competition"
      pageTitle="赛程与球台"
      pageHint="竞赛执行 · 时间 / 球台 / 裁判"
      currentEventId={data.bracket.eventId}
      eventScoped
    >
      <ScheduleWorkbenchClient initialData={data} />
    </AdminWorkspaceShell>;
  } catch (error) {
    return <AdminWorkspaceShell
      viewer={{ displayName: viewer.displayName, role: viewer.role }}
      events={events}
      active="competition"
      pageTitle="赛程与球台"
      pageHint="竞赛执行 · 时间 / 球台 / 裁判"
      eventScoped
    >
      <main className="backend-state backend-denied"><div className="backend-state-logo">程</div><small>赛程编排</small><h1>暂时不能进入赛程编排</h1><p>{error instanceof Error ? error.message : "赛程数据读取失败。"}</p><a href="/admin/competition">返回竞赛执行</a></main>
    </AdminWorkspaceShell>;
  }
}
