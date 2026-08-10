import { redirect } from "next/navigation";
import { getAuditLogWorkspaceData } from "@/db/audit-log";
import { getAdminNavigationEventsForPrincipal } from "@/db/admin-principal-ui";
import { getAdminViewer } from "../admin-viewer";
import AdminWorkspaceShell from "../admin-workspace-shell";
import AuditLogView, { type AuditLogFilters } from "./audit-log-view";
import "../system-admin.css";
import "./audit-log.css";

export const dynamic = "force-dynamic";

type SearchParams = {
  q?: string;
  event?: string;
  module?: string;
  actor?: string;
  action?: string;
  from?: string;
  to?: string;
  page?: string;
  detail?: string;
};

function pageNumber(value?: string) {
  const parsed = Number.parseInt(value || "1", 10);
  return Number.isFinite(parsed) ? Math.max(1, parsed) : 1;
}

export default async function LogsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  if (viewer.role !== "system_admin") redirect("/admin");

  const query = await searchParams;
  const filters: AuditLogFilters = {
    q: query.q || "",
    event: query.event || "",
    module: query.module || "",
    actor: query.actor || "",
    action: query.action || "",
    from: query.from || "",
    to: query.to || "",
    page: pageNumber(query.page),
  };

  const [data, events] = await Promise.all([
    getAuditLogWorkspaceData(viewer.username, {
      query: filters.q,
      eventId: filters.event,
      moduleType: filters.module,
      actorUserId: filters.actor,
      action: filters.action,
      dateFrom: filters.from,
      dateTo: filters.to,
      page: filters.page,
      detailId: query.detail,
    }),
    getAdminNavigationEventsForPrincipal(viewer),
  ]);

  return <AdminWorkspaceShell
    viewer={{ displayName: viewer.displayName, role: viewer.role }}
    events={events}
    active="logs"
    pageTitle="操作日志"
    pageHint="系统 · 审计与操作记录"
  >
    <AuditLogView
      data={data}
      events={events.map((event) => ({ id: event.id, shortTitle: event.shortTitle }))}
      filters={filters}
    />
  </AdminWorkspaceShell>;
}
