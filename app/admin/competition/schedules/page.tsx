import { redirect } from "next/navigation";
import { getAdminViewer } from "../../admin-viewer";
import { getAdminNavigationEvents } from "@/db/admin-ui";
import { getCompetitionBracketIndex } from "@/db/competition-tool-index";
import { getCompetitionContextData } from "@/db/competition-context";
import AdminWorkspaceShell from "../../admin-workspace-shell";
import ScheduleIndexClient from "./schedule-index-client";
import "../competition-context-bar.css";
import "./schedules-index.css";

export const dynamic = "force-dynamic";

const PHASES = ["qualifier-one", "qualifier-two", "main-one", "main-two"] as const;
const PHASE_ORDER: Record<string, number> = Object.fromEntries(PHASES.map((code, index) => [code, index]));

export default async function CompetitionSchedulesPage({ searchParams }: { searchParams: Promise<{ event?: string; group?: string; phase?: string }> }) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  const query = await searchParams;
  const events = await getAdminNavigationEvents(viewer.username);
  const eventId = events.some((event) => event.id === query.event) ? String(query.event) : events[0]?.id;
  if (!eventId) redirect("/admin/competition");
  const [context, allItems] = await Promise.all([
    getCompetitionContextData(viewer.username, eventId),
    getCompetitionBracketIndex(viewer.username, eventId),
  ]);
  const selectedGroupId = context.groups.some((group) => group.id === query.group) ? String(query.group) : context.groups[0]?.id || "";
  const availablePhases = [...new Set(allItems.filter((item) => item.groupId === selectedGroupId).map((item) => item.phaseCode))];
  const selectedPhase = PHASES.some((code) => code === query.phase)
    ? String(query.phase)
    : [...availablePhases].sort((a, b) => (PHASE_ORDER[b] ?? -1) - (PHASE_ORDER[a] ?? -1))[0] || "qualifier-one";

  return <AdminWorkspaceShell viewer={{ displayName: viewer.displayName, role: viewer.role }} events={events} active="competition" pageTitle="赛程编排" pageHint="竞赛执行 · 按组别与阶段编排" currentEventId={eventId} eventScoped eventSwitchMode="local" competitionTool="schedule">
    <ScheduleIndexClient initialEventId={eventId} initialContext={context} initialItems={allItems} initialGroupId={selectedGroupId} initialPhase={selectedPhase} viewerRole={viewer.role} />
  </AdminWorkspaceShell>;
}
