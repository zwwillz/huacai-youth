import { redirect } from "next/navigation";
import { getAdminNavigationEventsForPrincipal } from "@/db/admin-principal-ui";
import { getAdminViewer } from "../admin-viewer";
import AdminWorkspaceShell from "../admin-workspace-shell";

export const dynamic = "force-dynamic";

export default async function ContentPublishingIndexPage() {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  if (!["system_admin", "committee"].includes(viewer.role)) {
    return <main className="backend-state backend-denied"><div className="backend-state-logo">锁</div><small>内容发布</small><h1>当前账号没有内容发布权限</h1><p>赛事内容由系统管理员或组委会维护和发布。</p><a href="/admin">返回赛事后台</a></main>;
  }

  const events = await getAdminNavigationEventsForPrincipal(viewer);
  const target = events.find((event) => event.status !== "archived") ?? events[0];
  if (target) redirect(`/admin/content/${target.id}`);

  return <AdminWorkspaceShell viewer={{ displayName: viewer.displayName, role: viewer.role }} events={events} active="content" pageTitle="内容发布" pageHint="赛事运营" eventScoped>
    <main className="backend-state"><div className="backend-state-logo">赛</div><small>内容发布</small><h1>还没有可以维护的赛事</h1><p>请先在“赛事管理”中创建赛事，之后会直接进入对应赛事的内容发布页面。</p><a href="/admin/events/new">创建新赛事</a></main>
  </AdminWorkspaceShell>;
}
