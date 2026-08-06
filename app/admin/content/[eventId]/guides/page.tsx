import { redirect } from "next/navigation";
import { getAdminViewer } from "../../../admin-viewer";
import { getAdminNavigationEvents } from "@/db/admin-ui";
import { getGuideManagementData } from "@/db/guides";
import AdminWorkspaceShell from "../../../admin-workspace-shell";
import GuideManagementClient from "./guide-management-client";
import "./guide-management.css";

export const dynamic = "force-dynamic";

export default async function GuideManagementPage({ params }: { params: Promise<{ eventId: string }> }) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  if (!["system_admin", "committee"].includes(viewer.role)) {
    return <main className="backend-state backend-denied"><div className="backend-state-logo">锁</div><small>参赛提示</small><h1>当前账号没有内容编辑权限</h1><p>参赛友好提示由系统管理员或组委会维护。</p><a href="/admin">返回赛事后台</a></main>;
  }
  const { eventId } = await params;
  try {
    const [data, navEvents] = await Promise.all([
      getGuideManagementData(viewer.username, eventId),
      getAdminNavigationEvents(viewer.username),
    ]);
    return <AdminWorkspaceShell
      viewer={{ displayName: viewer.displayName, role: viewer.role }}
      events={navEvents}
      active="content"
      pageTitle="参赛友好提示"
      pageHint="内容发布 · 富内容编辑"
      currentEventId={eventId}
      eventScoped
    >
      <GuideManagementClient initialData={data} />
    </AdminWorkspaceShell>;
  } catch (error) {
    return <main className="backend-state backend-denied"><div className="backend-state-logo">!</div><small>参赛提示</small><h1>暂时不能打开这场赛事</h1><p>{error instanceof Error ? error.message : "数据读取失败。"}</p><a href="/admin/content">返回内容发布</a></main>;
  }
}
