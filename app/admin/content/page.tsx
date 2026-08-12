import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminNavigationEventsForPrincipal } from "@/db/admin-principal-ui";
import { getContentManagementDataFast } from "@/db/content-management-fast";
import { getEventManagementDataFast } from "@/db/event-management-fast";
import { getAdminViewer } from "../admin-viewer";
import AdminWorkspaceShell from "../admin-workspace-shell";
import { captureAdminLoad } from "../capture-admin-load";
import ContentEventWorkspaceClient from "./content-event-workspace-client";

export const dynamic = "force-dynamic";

export default async function ContentPublishingIndexPage() {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  if (!["system_admin", "committee"].includes(viewer.role)) {
    return <main className="backend-state backend-denied"><div className="backend-state-logo">锁</div><small>内容发布</small><h1>当前账号没有内容发布权限</h1><p>赛事内容由系统管理员或组委会维护和发布。</p><Link href="/admin">返回赛事后台</Link></main>;
  }

  const events = await getAdminNavigationEventsForPrincipal(viewer);
  const target = events.find((event) => event.status !== "archived") ?? events[0];

  if (!target) {
    return <AdminWorkspaceShell viewer={{ displayName: viewer.displayName, role: viewer.role }} events={events} active="content" pageTitle="内容发布" pageHint="赛事运营" eventScoped>
      <main className="backend-state"><div className="backend-state-logo">赛</div><small>内容发布</small><h1>还没有可以维护的赛事</h1><p>请先在“赛事管理”中创建赛事，之后会直接进入对应赛事的内容发布页面。</p><Link href="/admin/events/new">创建新赛事</Link></main>
    </AdminWorkspaceShell>;
  }

  const result = await captureAdminLoad(Promise.all([
    getContentManagementDataFast(viewer, target.id),
    getEventManagementDataFast(viewer, target.id),
  ]));

  if (!result.data) {
    return <AdminWorkspaceShell viewer={{ displayName: viewer.displayName, role: viewer.role }} events={events} active="content" pageTitle="内容发布" pageHint="赛事运营 · 概览与竞赛规程" currentEventId={target.id} eventScoped eventSwitchMode="local">
      <main className="backend-state backend-denied"><div className="backend-state-logo">锁</div><small>内容发布</small><h1>暂时不能打开这场赛事的内容后台</h1><p>{result.error instanceof Error ? result.error.message : "赛事内容读取失败。"}</p><Link href="/admin/events">返回赛事管理</Link></main>
    </AdminWorkspaceShell>;
  }

  const [contentData, eventData] = result.data;
  return <AdminWorkspaceShell viewer={{ displayName: viewer.displayName, role: viewer.role }} events={events} active="content" pageTitle="内容发布" pageHint="赛事运营 · 概览与竞赛规程" currentEventId={target.id} eventScoped eventSwitchMode="local">
    <ContentEventWorkspaceClient initialData={contentData} initialEventData={eventData} />
  </AdminWorkspaceShell>;
}
