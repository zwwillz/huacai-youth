import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminViewer } from "../../admin-viewer";
import { getAdminNavigationEventsForPrincipal } from "@/db/admin-principal-ui";
import { getEventManagementDataFast } from "@/db/event-management-fast";
import AdminWorkspaceShell from "../../admin-workspace-shell";
import EventEventWorkspaceClient from "../event-event-workspace-client";
import { captureAdminLoad } from "../../capture-admin-load";
import "../event-management-v2.css";

export const dynamic = "force-dynamic";

export default async function EventManagementPage({ params }: { params: Promise<{ eventId: string }> }) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  const { eventId } = await params;

  const result = await captureAdminLoad(Promise.all([
    getEventManagementDataFast(viewer, eventId),
    getAdminNavigationEventsForPrincipal(viewer),
  ]));
  if (!result.data) {
    return <main className="backend-state backend-denied"><div className="backend-state-logo">锁</div><small>赛事管理</small><h1>暂时不能打开这场赛事</h1><p>{result.error instanceof Error ? result.error.message : "赛事资料读取失败。"}</p><Link href="/admin/events">返回赛事管理</Link></main>;
  }
  const [data, navEvents] = result.data;
  return <AdminWorkspaceShell viewer={{ displayName: viewer.displayName, role: viewer.role }} events={navEvents} active="events" pageTitle="赛事管理" pageHint="赛事管理 · 基础主数据" currentEventId={eventId} eventScoped eventSwitchMode="local"><EventEventWorkspaceClient initialData={data} /></AdminWorkspaceShell>;
}
