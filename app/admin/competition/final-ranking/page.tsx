import { redirect } from "next/navigation";
import { getAdminViewer } from "../../admin-viewer";
import { getAdminNavigationEvents } from "@/db/admin-ui";
import { getFinalRankingWorkspaceData } from "@/db/main-competition-flow";
import AdminWorkspaceShell from "../../admin-workspace-shell";
import FinalRankingClient from "./final-ranking-client";
import "./final-ranking.css";

export const dynamic = "force-dynamic";

export default async function FinalRankingPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  const query = await searchParams;
  const events = await getAdminNavigationEvents(viewer.username);
  const eventId = events.some((event) => event.id === query.event) ? String(query.event) : events[0]?.id;
  if (!eventId) redirect("/admin/competition");
  try {
    const data = await getFinalRankingWorkspaceData(viewer.username, eventId);
    return <AdminWorkspaceShell viewer={{ displayName: viewer.displayName, role: viewer.role }} events={events} active="competition" pageTitle="最终排名" pageHint="竞赛执行 · 排名确认与发布" currentEventId={eventId} eventScoped competitionTool="ranking">
      <FinalRankingClient initialData={data} />
    </AdminWorkspaceShell>;
  } catch (error) {
    return <AdminWorkspaceShell viewer={{ displayName: viewer.displayName, role: viewer.role }} events={events} active="competition" pageTitle="最终排名" pageHint="竞赛执行 · 排名确认与发布" currentEventId={eventId} eventScoped competitionTool="ranking">
      <main className="backend-state backend-denied"><div className="backend-state-logo">榜</div><small>最终排名</small><h1>暂时不能进入最终排名</h1><p>{error instanceof Error ? error.message : "最终排名读取失败。"}</p><a href="/admin/competition">返回竞赛执行</a></main>
    </AdminWorkspaceShell>;
  }
}
