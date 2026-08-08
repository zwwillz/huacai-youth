import { redirect } from "next/navigation";
import { getAdminViewer } from "../admin-viewer";
import { getCompetitionDashboardData } from "@/db/competition-dashboard";
import AdminWorkspaceShell from "../admin-workspace-shell";
import CompetitionOverviewClient from "./competition-overview-client";
import "./competition-context-bar.css";
import "./competition.css";

export const dynamic = "force-dynamic";

export default async function CompetitionWorkspacePage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  const query = await searchParams;
  const data = await getCompetitionDashboardData(viewer.username, query.event);
  if (!data.selectedEventId) redirect("/admin");

  return <AdminWorkspaceShell
    viewer={{ displayName: viewer.displayName, role: viewer.role }}
    events={data.events}
    active="competition"
    pageTitle="竞赛执行"
    pageHint="先选组别，再处理当前任务"
    currentEventId={data.selectedEventId}
    eventScoped
    eventSwitchMode="local"
    competitionTool="overview"
  >
    <CompetitionOverviewClient initialData={data} />
  </AdminWorkspaceShell>;
}
