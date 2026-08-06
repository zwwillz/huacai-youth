import { redirect } from "next/navigation";
import { getAdminViewer } from "../../admin-viewer";
import { getAdminNavigationEvents } from "@/db/admin-ui";
import { getScoringWorkspaceData } from "@/db/scoring-engine";
import AdminWorkspaceShell from "../../admin-workspace-shell";
import ScoringWorkbenchClient from "./scoring-workbench-client";
import "./scoring-workbench.css";

export const dynamic = "force-dynamic";

export default async function ScoringPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  const query = await searchParams;
  const events = await getAdminNavigationEvents(viewer.username);
  const eventId = events.some((event) => event.id === query.event) ? String(query.event) : events[0]?.id;
  if (!eventId) redirect("/admin/competition");

  try {
    const data = await getScoringWorkspaceData(viewer.username, eventId);
    return <AdminWorkspaceShell
      viewer={{ displayName: viewer.displayName, role: viewer.role }}
      events={events}
      active="competition"
      pageTitle="比分录入"
      pageHint="竞赛执行 · 裁判现场录分"
      currentEventId={eventId}
      eventScoped
      competitionTool="scoring"
    >
      <ScoringWorkbenchClient initialData={data} />
    </AdminWorkspaceShell>;
  } catch (error) {
    return <AdminWorkspaceShell viewer={{ displayName: viewer.displayName, role: viewer.role }} events={events} active="competition" pageTitle="比分录入" pageHint="竞赛执行 · 裁判现场录分" currentEventId={eventId} eventScoped competitionTool="scoring">
      <main className="backend-state backend-denied"><div className="backend-state-logo">分</div><small>比分录入</small><h1>暂时不能进入比分录入</h1><p>{error instanceof Error ? error.message : "比分数据读取失败。"}</p><a href="/admin/competition">返回竞赛执行</a></main>
    </AdminWorkspaceShell>;
  }
}
