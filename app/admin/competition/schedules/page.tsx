import { redirect } from "next/navigation";
import { getAdminViewer } from "../../admin-viewer";
import { getAdminNavigationEventsForPrincipal } from "@/db/admin-principal-ui";
import AdminWorkspaceShell from "../../admin-workspace-shell";
import ScheduleIndexClient from "./schedule-index-client";
import "../competition-context-bar.css";
import "./schedules-index.css";

export const dynamic = "force-dynamic";
const PHASES = ["qualifier-one", "qualifier-two", "main-one", "main-two"] as const;

export default async function CompetitionSchedulesPage({ searchParams }: { searchParams: Promise<{ event?: string; group?: string; phase?: string }> }) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  const query = await searchParams;
  const events = await getAdminNavigationEventsForPrincipal(viewer);
  const eventId = events.some((event) => event.id === query.event) ? String(query.event) : events[0]?.id;
  if (!eventId) redirect("/admin/competition");
  const initialPhase = PHASES.some((phase) => phase === query.phase) ? String(query.phase) : "qualifier-one";
  return <AdminWorkspaceShell viewer={{ displayName: viewer.displayName, role: viewer.role }} events={events} active="competition" pageTitle="赛程编排" pageHint="竞赛执行 · 按组别与阶段编排" currentEventId={eventId} eventScoped eventSwitchMode="local" competitionTool="schedule"><ScheduleIndexClient initialEventId={eventId} initialGroupId={query.group || ""} initialPhase={initialPhase} viewerRole={viewer.role} /></AdminWorkspaceShell>;
}
