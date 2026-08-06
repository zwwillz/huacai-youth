import { redirect } from "next/navigation";
import { getAdminViewer } from "../../admin-viewer";
import { getAdminNavigationEvents } from "@/db/admin-ui";
import { getContentManagementData } from "@/db/content-management";
import AdminWorkspaceShell from "../../admin-workspace-shell";
import ContentManagementClient from "../content-management-client";
import "../content-management.css";
import "../content-extensions.css";

export const dynamic = "force-dynamic";

export default async function ContentManagementPage({ params }: { params: Promise<{ eventId: string }> }) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  const { eventId } = await params;

  try {
    const [data, navEvents] = await Promise.all([
      getContentManagementData(viewer.username, eventId),
      getAdminNavigationEvents(viewer.username),
    ]);
    return <AdminWorkspaceShell
      viewer={{ displayName: viewer.displayName, role: viewer.role }}
      events={navEvents}
      active="content"
      pageTitle="内容发布"
      pageHint="赛事运营 · 静态内容"
      currentEventId={eventId}
      eventScoped
    >
      <ContentManagementClient initialData={data} />
    </AdminWorkspaceShell>;
  } catch (error) {
    return <main className="backend-state backend-denied">
      <div className="backend-state-logo">锁</div>
      <small>内容发布</small>
      <h1>暂时不能打开这场赛事的内容后台</h1>
      <p>{error instanceof Error ? error.message : "赛事内容读取失败。"}</p>
      <a href="/admin/content">返回内容发布</a>
    </main>;
  }
}
