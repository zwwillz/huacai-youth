import { redirect } from "next/navigation";
import { getAdminNavigationEventsForPrincipal } from "@/db/admin-principal-ui";
import AdminWorkspaceShell from "../admin-workspace-shell";
import { getAdminViewer } from "../admin-viewer";

export const dynamic = "force-dynamic";

export default async function RegistrationPublishPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
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
    active="registrationPublish"
    pageTitle="报名发布"
    pageHint="赛事运营 · 报名信息与入口"
    currentEventId={currentEventId}
    eventScoped
  >
    <main className="admin-simple-page">
      <section className="admin-simple-head">
        <small>REGISTRATION PUBLISHING</small>
        <h2>报名发布</h2>
        <p>{currentEvent ? `当前赛事：${currentEvent.shortTitle}。` : "请先选择当前赛事。"}这里用于设置报名说明、报名入口和报名开放时间，并控制报名信息是否在赛事概览页展示。</p>
      </section>
      <section className="admin-simple-card">
        <h3>报名发布设置</h3>
        <div className="admin-simple-table">
          <div className="admin-simple-row"><div><b>报名状态</b><br/><small>后续接入草稿 / 已发布 / 已截止状态</small></div><span>未配置</span><span>—</span></div>
          <div className="admin-simple-row"><div><b>报名入口</b><br/><small>可配置报名页面或外部报名链接</small></div><span>尚未设置</span><span>—</span></div>
          <div className="admin-simple-row"><div><b>报名时间</b><br/><small>开放时间与截止时间</small></div><span>待设置</span><span>—</span></div>
        </div>
        <div className="admin-simple-empty">当前先建立最简页面结构。下一步再接入报名链接、开放时间、发布状态和前端赛事概览页展示逻辑。</div>
      </section>
    </main>
  </AdminWorkspaceShell>;
}
