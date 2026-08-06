import { redirect } from "next/navigation";
import { getAdminViewer } from "../../admin-viewer";
import { getEventManagementData } from "@/db/event-management";
import EventManagementClient from "../event-management-client";
import "../event-management.css";

export const dynamic = "force-dynamic";

export default async function EventManagementPage({ params }: { params: Promise<{ eventId: string }> }) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  const { eventId } = await params;

  try {
    const data = await getEventManagementData(viewer.username, eventId);
    return <EventManagementClient initialData={data} />;
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
