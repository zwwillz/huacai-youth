import { redirect } from "next/navigation";
import { getAdminNavigationEventsForPrincipal } from "@/db/admin-principal-ui";
import AdminWorkspaceShell from "../admin-workspace-shell";
import { getAdminViewer } from "../admin-viewer";

export const dynamic = "force-dynamic";

export default async function ParticipantsPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
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
    active="participants"
    pageTitle="参赛人员"
    pageHint="赛事运营 · 名单确认与锁定"
    currentEventId={currentEventId}
    eventScoped
  >
    <main className="admin-simple-page">
      <section className="admin-simple-head">
        <small>PARTICIPANT ROSTER</small>
        <h2>参赛人员</h2>
        <p>{currentEvent ? `当前赛事：${currentEvent.shortTitle}。` : "请先选择当前赛事。"}这里负责汇总报名人员、确认最终参赛名单，并在报名截止后锁定名单。名单锁定后，才进入抽签、签表和后续竞赛执行流程。</p>
      </section>
      <section className="admin-simple-card">
        <h3>参赛名单状态</h3>
        <div className="admin-simple-table">
          <div className="admin-simple-row"><div><b>报名数据</b><br/><small>后续接入报名名单与审核结果</small></div><span>尚未接入</span><span>—</span></div>
          <div className="admin-simple-row"><div><b>名单确认</b><br/><small>确认少年组、青年组最终参赛人员</small></div><span>未确认</span><span>—</span></div>
          <div className="admin-simple-row"><div><b>名单锁定</b><br/><small>锁定后作为抽签与赛程编排基础名单</small></div><span>未锁定</span><span>—</span></div>
        </div>
        <div className="admin-simple-empty">当前先建立名单确认与锁定的页面位置。下一步再接入报名数据、异常处理、分组确认以及“锁定参赛名单”操作。</div>
      </section>
    </main>
  </AdminWorkspaceShell>;
}
