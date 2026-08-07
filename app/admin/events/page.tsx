import Link from "next/link";
import { redirect } from "next/navigation";
import { getEventIndexData } from "@/db/admin-index";
import { getAdminViewer } from "../admin-viewer";
import AdminWorkspaceShell from "../admin-workspace-shell";
import EventListClient from "./event-list-client";
import "./event-settings-index.css";

export const dynamic = "force-dynamic";

export default async function EventSettingsIndexPage() {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  if (!["system_admin", "committee"].includes(viewer.role)) {
    return <main className="backend-state backend-denied"><div className="backend-state-logo">锁</div><small>赛事管理</small><h1>当前账号没有赛事编辑权限</h1><p>裁判账号主要用于抽签、赛程和比分执行；赛事资料由系统管理员或组委会维护。</p><a href="/admin">返回赛事后台</a></main>;
  }

  const listEvents = await getEventIndexData(viewer.username);
  const navEvents = listEvents.map((event) => ({ id: event.id, shortTitle: event.shortTitle, stationNo: event.stationNo, status: event.status, startDate: event.startDate, endDate: event.endDate }));

  return <AdminWorkspaceShell viewer={{ displayName: viewer.displayName, role: viewer.role }} events={navEvents} active="events" pageTitle="赛事管理" pageHint="全局 · 创建与管理分站">
    <main className="event-settings-index">
      <header className="event-settings-index-head">
        <div><small>赛事管理</small><h1>赛事设置</h1><p>这里是所有后续业务的起点：先创建赛事，再进入本站的内容发布、报名审核、球员管理与竞赛执行。创建赛事本身不受“当前赛事”切换影响。</p></div>
        <div className="event-settings-index-head-actions"><Link className="event-settings-create" href="/admin/events/new">＋ 创建新赛事</Link><span>{listEvents.length} 场赛事</span></div>
      </header>
      <EventListClient events={listEvents} canDelete={viewer.role === "system_admin"} />
    </main>
  </AdminWorkspaceShell>;
}
