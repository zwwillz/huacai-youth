import { redirect } from "next/navigation";
import { getAdminViewer } from "../../admin-viewer";
import { getAdminNavigationEventsForPrincipal } from "@/db/admin-principal-ui";
import AdminWorkspaceShell from "../../admin-workspace-shell";
import ScoringLocalWorkspaceClient from "./scoring-local-workspace-client";
import "../competition-context-bar.css";
import "./scoring-workbench.css";

export const dynamic = "force-dynamic";
const ALL_PHASES = ["qualifier-one", "qualifier-two", "main-one", "main-two"] as const;

export default async function ScoringPage({ searchParams }: { searchParams: Promise<{ event?: string; group?: string; phase?: string; date?: string; view?: string }> }) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  const query = await searchParams;
  const events = await getAdminNavigationEventsForPrincipal(viewer);
  const eventId = events.some((event) => event.id === query.event) ? String(query.event) : events[0]?.id;
  if (!eventId) redirect("/admin/competition");
  const initialPhase = ALL_PHASES.some((phase) => phase === query.phase) ? String(query.phase) : "qualifier-one";

  return <AdminWorkspaceShell viewer={{ displayName: viewer.displayName, role: viewer.role }} events={events} active="competition" pageTitle="比分录入" pageHint="竞赛执行 · 当前待办优先" currentEventId={eventId} eventScoped eventSwitchMode="local" competitionTool="scoring">
    <ScoringLocalWorkspaceClient initialEventId={eventId} initialGroupId={query.group || ""} initialPhase={initialPhase} initialDate={query.date || ""} initialShowConfirmed={query.view === "all"} />
  </AdminWorkspaceShell>;
}
