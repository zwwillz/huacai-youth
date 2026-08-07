import { redirect } from "next/navigation";
import { getAdminViewer } from "../../admin-viewer";
import { getAdminNavigationEvents } from "@/db/admin-ui";
import { getQualificationWorkspaceData } from "@/db/qualification-engine";
import { getMainRosterControlData } from "@/db/main-competition-flow";
import AdminWorkspaceShell from "../../admin-workspace-shell";
import QualificationWorkbenchClient from "./qualification-workbench-client";
import MainRosterControlClient from "./main-roster-control-client";
import "./qualification.css";
import "./main-roster-control.css";

export const dynamic = "force-dynamic";

export default async function QualificationPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  const query = await searchParams;
  const events = await getAdminNavigationEvents(viewer.username);
  const eventId = events.some((event) => event.id === query.event) ? String(query.event) : events[0]?.id;
  if (!eventId) redirect("/admin/competition");

  try {
    const [data, mainRosterControl] = await Promise.all([
      getQualificationWorkspaceData(viewer.username, eventId),
      getMainRosterControlData(viewer.username, eventId),
    ]);
    return <AdminWorkspaceShell
      viewer={{ displayName: viewer.displayName, role: viewer.role }}
      events={events}
      active="competition"
      pageTitle="晋级与正赛名单"
      pageHint="竞赛执行 · 晋级、种子、递补与名单锁定"
      currentEventId={eventId}
      eventScoped
      competitionTool="qualification"
    >
      <QualificationWorkbenchClient initialData={data} />
      <MainRosterControlClient initialData={mainRosterControl} />
    </AdminWorkspaceShell>;
  } catch (error) {
    return <AdminWorkspaceShell viewer={{ displayName: viewer.displayName, role: viewer.role }} events={events} active="competition" pageTitle="晋级与正赛名单" pageHint="竞赛执行 · 晋级、种子、递补与名单锁定" currentEventId={eventId} eventScoped competitionTool="qualification">
      <main className="backend-state backend-denied"><div className="backend-state-logo">晋</div><small>晋级与正赛名单</small><h1>暂时不能进入晋级与正赛名单</h1><p>{error instanceof Error ? error.message : "竞赛名单数据读取失败。"}</p><a href="/admin/competition">返回竞赛执行</a></main>
    </AdminWorkspaceShell>;
  }
}
