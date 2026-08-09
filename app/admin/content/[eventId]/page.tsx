import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminViewer } from "../../admin-viewer";
import { getAdminNavigationEventsForPrincipal } from "@/db/admin-principal-ui";
import { getContentManagementDataFast } from "@/db/content-management-fast";
import { getEventManagementDataFast } from "@/db/event-management-fast";
import AdminWorkspaceShell from "../../admin-workspace-shell";
import ContentEventWorkspaceClient from "../content-event-workspace-client";
import { captureAdminLoad } from "../../capture-admin-load";
import "../content-publishing-v2.css";

export const dynamic = "force-dynamic";

export default async function ContentManagementPage({ params }: { params: Promise<{ eventId: string }> }) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  const { eventId } = await params;

  const result = await captureAdminLoad(Promise.all([
    getContentManagementDataFast(viewer, eventId),
    getEventManagementDataFast(viewer, eventId),
    getAdminNavigationEventsForPrincipal(viewer),
  ]));
  if (!result.data) {
    return <main className="backend-state backend-denied"><div className="backend-state-logo">锁</div><small>内容发布</small><h1>暂时不能打开这场赛事的内容后台</h1><p>{result.error instanceof Error ? result.error.message : "赛事内容读取失败。"}</p><Link href="/admin/content">返回内容发布</Link></main>;
  }
  const [contentData, eventData, navEvents] = result.data;
  return <AdminWorkspaceShell viewer={{ displayName: viewer.displayName, role: viewer.role }} events={navEvents} active="content" pageTitle="内容发布" pageHint="赛事运营 · 概览与竞赛规程" currentEventId={eventId} eventScoped eventSwitchMode="local"><ContentEventWorkspaceClient initialData={contentData} initialEventData={eventData} /></AdminWorkspaceShell>;
}
