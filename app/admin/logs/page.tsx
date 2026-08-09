import { redirect } from "next/navigation";
import { getAuditLogData } from "@/db/admin-ui";
import { getAdminNavigationEventsForPrincipal } from "@/db/admin-principal-ui";
import { getAdminViewer } from "../admin-viewer";
import AdminWorkspaceShell from "../admin-workspace-shell";
import AuditLogView from "./audit-log-view";
import "../system-admin.css";

export const dynamic = "force-dynamic";

export default async function LogsPage() {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  if (viewer.role !== "system_admin") redirect("/admin");
  const [logs, events] = await Promise.all([
    getAuditLogData(viewer.username, 150),
    getAdminNavigationEventsForPrincipal(viewer),
  ]);

  return <AdminWorkspaceShell viewer={{ displayName: viewer.displayName, role: viewer.role }} events={events} active="logs" pageTitle="操作日志" pageHint="系统 · 审计与操作记录">
    <AuditLogView logs={logs} />
  </AdminWorkspaceShell>;
}
