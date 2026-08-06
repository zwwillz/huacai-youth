import { redirect } from "next/navigation";
import { getAdminViewer } from "../../admin-viewer";
import { getAdminSnapshot } from "@/db/admin";
import { getEventManagementData } from "@/db/event-management";
import AdminWorkspaceShell from "../../admin-workspace-shell";
import EventManagementClient from "../event-management-client";
import "../event-management.css";

export const dynamic = "force-dynamic";

export default async function EventManagementPage({ params }: { params: Promise<{ eventId: string }> }) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  const { eventId } = await params;

  try {
    const [data, snapshot] = await Promise.all([
      getEventManagementData(viewer.username, eventId),
      getAdminSnapshot(viewer.username),
    ]);
    return <AdminWorkspaceShell
      viewer={{ displayName: viewer.displayName, role: viewer.role }}
      events={snapshot.events.map((event) => ({ id: event.id, shortTitle: event.shortTitle, stationNo: event.stationNo, status: event.status, startDate: event.startDate, endDate: event.endDate }))}
      active="events"
      pageTitle="赛事设置"
      pageHint="赛事管理 · 分站主数据"
      currentEventId={eventId}
    >
      <EventManagementClient initialData={data} />
    </AdminWorkspaceShell>;
  } catch (error) {
    return <main className="backend-state backend-denied">
      <div className="backend-state-logo">锁</div>
      <small>赛事管理</small>
      <h1>暂时不能打开这场赛事</h1>
      <p>{error instanceof Error ? error.message : "赛事资料读取失败。"}</p>
      <a href="/admin/events">返回赛事管理</a>
    </main>;
  }
}
