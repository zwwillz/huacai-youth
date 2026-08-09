import { redirect } from "next/navigation";
import { getAdminViewer } from "../admin-viewer";
import { getAdminNavigationEventsForPrincipal } from "@/db/admin-principal-ui";
import AdminWorkspaceShell from "../admin-workspace-shell";
import CompetitionOverviewClient from "./competition-overview-client";
import "./competition-context-bar.css";
import "./competition.css";

export const dynamic = "force-dynamic";

export default async function CompetitionWorkspacePage({ searchParams }: { searchParams: Promise<{ event?: string; group?: string }> }) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  const query = await searchParams;
  const events = await getAdminNavigationEventsForPrincipal(viewer);
  const selectedEventId = events.some((event) => event.id === query.event) ? String(query.event) : events[0]?.id || "";
  if (!selectedEventId) redirect("/admin");

  return <AdminWorkspaceShell
    viewer={{ displayName: viewer.displayName, role: viewer.role }}
    events={events}
    active="competition"
    pageTitle="竞赛执行"
    pageHint="先选组别，再处理当前任务"
    currentEventId={selectedEventId}
    eventScoped
    eventSwitchMode="local"
    competitionTool="overview"
  >
    <CompetitionOverviewClient initialEventId={selectedEventId} initialGroupId={query.group || ""} />
  </AdminWorkspaceShell>;
}
