import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminNavigationEventsForPrincipal } from "@/db/admin-principal-ui";
import { getSchedulePublishData } from "@/db/schedule-publish";
import AdminWorkspaceShell from "../admin-workspace-shell";
import { getAdminViewer } from "../admin-viewer";
import SchedulePublishClient from "./schedule-publish-client";

export const dynamic = "force-dynamic";

export default async function SchedulePublishPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  if (!["system_admin", "committee"].includes(viewer.role)) redirect("/admin");

  const query = await searchParams;
  const events = await getAdminNavigationEventsForPrincipal(viewer);
  if (!events.length) {
    return <AdminWorkspaceShell viewer={{ displayName: viewer.displayName, role: viewer.role }} events={events} active="schedulePublish" pageTitle="赛程发布" pageHint="赛事运营 · 对外主赛程">
      <main className="admin-simple-page"><section className="admin-simple-head"><small>MASTER SCHEDULE</small><h2>赛程发布</h2><p>请先创建赛事，再维护面向公众的阶段主赛程。</p></section><section className="admin-simple-card"><div className="admin-simple-empty">当前还没有可以维护的赛事。<br/><Link href="/admin/events/new">创建新赛事 →</Link></div></section></main>
    </AdminWorkspaceShell>;
  }

  const currentEventId = events.some((event) => event.id === query.event) ? String(query.event) : events[0].id;
  try {
    const data = await getSchedulePublishData(viewer, currentEventId);
    return <AdminWorkspaceShell
      viewer={{ displayName: viewer.displayName, role: viewer.role }}
      events={events}
      active="schedulePublish"
      pageTitle="赛程发布"
      pageHint="赛事运营 · 对外主赛程"
      currentEventId={currentEventId}
      eventScoped
    >
      <SchedulePublishClient initialData={data} />
    </AdminWorkspaceShell>;
  } catch (error) {
    return <AdminWorkspaceShell viewer={{ displayName: viewer.displayName, role: viewer.role }} events={events} active="schedulePublish" pageTitle="赛程发布" pageHint="赛事运营 · 对外主赛程" currentEventId={currentEventId} eventScoped>
      <main className="backend-state backend-denied"><div className="backend-state-logo">赛</div><small>赛程发布</small><h1>暂时不能打开本站主赛程</h1><p>{error instanceof Error ? error.message : "主赛程读取失败。"}</p><Link href="/admin/events">返回赛事管理</Link></main>
    </AdminWorkspaceShell>;
  }
}
