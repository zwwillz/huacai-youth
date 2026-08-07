import { redirect } from "next/navigation";
import { getAdminViewer } from "../../admin-viewer";
import { getAdminNavigationEvents } from "@/db/admin-ui";
import { type DrawPhaseCode } from "@/db/draw-engine";
import { getCompetitionDrawWorkspaceData } from "@/db/competition-draw-workspace";
import AdminWorkspaceShell from "../../admin-workspace-shell";
import DrawWorkbenchClient from "./draw-workbench-client";
import "./draw-workbench.css";

export const dynamic = "force-dynamic";

export default async function DrawWorkbenchPage({ searchParams }: { searchParams: Promise<{ event?: string; group?: string; phase?: string }> }) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  const query = await searchParams;
  const events = await getAdminNavigationEvents(viewer.username);
  const eventId = events.some((event) => event.id === query.event) ? String(query.event) : events[0]?.id;
  if (!eventId) redirect("/admin/events");
  const phaseCode = (["qualifier-one", "qualifier-two", "main-one", "main-two"].includes(String(query.phase)) ? query.phase : "qualifier-one") as DrawPhaseCode;

  try {
    const data = await getCompetitionDrawWorkspaceData(viewer.username, eventId, query.group, phaseCode);
    if (data.latestSession?.status === "void") data.latestSession = null;
    return <AdminWorkspaceShell
      viewer={{ displayName: viewer.displayName, role: viewer.role }}
      events={events}
      active="competition"
      pageTitle="抽签与签表"
      pageHint="竞赛执行 · 抽签引擎"
      currentEventId={eventId}
      eventScoped
      competitionTool="draw"
    >
      <DrawWorkbenchClient initialData={data} />
    </AdminWorkspaceShell>;
  } catch (error) {
    return <AdminWorkspaceShell
      viewer={{ displayName: viewer.displayName, role: viewer.role }}
      events={events}
      active="competition"
      pageTitle="抽签与签表"
      pageHint="竞赛执行 · 抽签引擎"
      currentEventId={eventId}
      eventScoped
      competitionTool="draw"
    >
      <main className="backend-state backend-denied"><div className="backend-state-logo">签</div><small>抽签引擎</small><h1>当前还不能开始抽签</h1><p>{error instanceof Error ? error.message : "抽签数据读取失败。"}</p><a href={`/admin/competition?event=${encodeURIComponent(eventId)}`}>返回竞赛执行</a></main>
    </AdminWorkspaceShell>;
  }
}
