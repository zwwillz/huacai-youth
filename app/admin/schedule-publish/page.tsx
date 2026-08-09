import { redirect } from "next/navigation";
import { getAdminNavigationEventsForPrincipal } from "@/db/admin-principal-ui";
import AdminWorkspaceShell from "../admin-workspace-shell";
import { getAdminViewer } from "../admin-viewer";

export const dynamic = "force-dynamic";

export default async function SchedulePublishPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  if (!["system_admin", "committee"].includes(viewer.role)) redirect("/admin");

  const query = await searchParams;
  const events = await getAdminNavigationEventsForPrincipal(viewer);
  const currentEventId = events.some((event) => event.id === query.event) ? String(query.event) : events[0]?.id || "";
  const currentEvent = events.find((event) => event.id === currentEventId);

  return <AdminWorkspaceShell
    viewer={{ displayName: viewer.displayName, role: viewer.role }}
    events={events}
    active="schedulePublish"
    pageTitle="赛程发布"
    pageHint="赛事运营 · 对外主赛程"
    currentEventId={currentEventId}
    eventScoped
  >
    <main className="admin-simple-page">
      <section className="admin-simple-head">
        <small>MASTER SCHEDULE</small>
        <h2>赛程发布</h2>
        <p>{currentEvent ? `当前赛事：${currentEvent.shortTitle}。` : "请先选择当前赛事。"}这里发布的是面向参赛人员和观众的赛事主赛程，例如各比赛日、资格赛阶段和正赛阶段安排；具体场次、台号和对阵仍在“竞赛执行 → 赛程编排”中处理。</p>
      </section>
      <section className="admin-simple-card">
        <h3>主赛程</h3>
        <div className="admin-simple-table">
          <div className="admin-simple-row"><div><b>赛事日程</b><br/><small>比赛日期与阶段安排</small></div><span>尚未配置</span><span>—</span></div>
          <div className="admin-simple-row"><div><b>发布状态</b><br/><small>后续接入草稿与正式发布状态</small></div><span>未发布</span><span>—</span></div>
        </div>
        <div className="admin-simple-empty">当前先建立主赛程发布入口。下一步再增加“新增日程、排序、保存草稿、正式发布”等操作。</div>
      </section>
    </main>
  </AdminWorkspaceShell>;
}
