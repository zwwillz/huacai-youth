import { redirect } from "next/navigation";
import { getAdminNavigationEventsForPrincipal } from "@/db/admin-principal-ui";
import { getPlayerAdminPageFast } from "@/db/player-admin-fast";
import AdminWorkspaceShell from "../admin-workspace-shell";
import { getAdminViewer } from "../admin-viewer";
import { PlayerManagementWorkspace } from "./player-management-client";
import "./player-management.css";
import "./player-management-performance.css";

export const dynamic = "force-dynamic";

type SearchParams = { event?: string; scope?: string; group?: string; q?: string; page?: string; player?: string; success?: string; error?: string };
type QueryState = { event: string; scope: "event" | "all"; group: "all" | "少年组" | "青年组"; q: string; page: number };

function asGroup(value?: string): QueryState["group"] {
  return value === "少年组" || value === "青年组" ? value : "all";
}
function pageNumber(value?: string) {
  const parsed = Number.parseInt(value || "1", 10);
  return Number.isFinite(parsed) ? Math.max(1, parsed) : 1;
}

export default async function PlayersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  if (viewer.role === "referee") redirect("/admin");

  const query = await searchParams;
  const events = await getAdminNavigationEventsForPrincipal(viewer);
  const requestedEvent = events.find((event) => event.id === query.event);
  const overview = viewer.role === "system_admin" && !requestedEvent && (query.scope === "all" || !query.event);
  const state: QueryState = {
    event: overview ? "" : (requestedEvent?.id || events[0]?.id || ""),
    scope: overview ? "all" : "event",
    group: asGroup(query.group),
    q: (query.q || "").trim(),
    page: pageNumber(query.page),
  };

  const pageData = await getPlayerAdminPageFast(viewer, {
    eventId: state.event || null,
    scope: state.scope,
    group: state.group,
    query: state.q,
    page: state.page,
    pageSize: 40,
  }, events);

  const eventOptions = events.map((event) => ({
    id: event.id,
    shortTitle: event.shortTitle,
    stationNo: event.stationNo,
    status: event.status,
    startDate: event.startDate,
    endDate: event.endDate,
    city: event.city,
  }));

  return <AdminWorkspaceShell
    viewer={{ displayName: viewer.displayName, role: viewer.role }}
    events={eventOptions}
    active="players"
    pageTitle="球员档案"
    pageHint="球员 · 档案管理"
  >
    <PlayerManagementWorkspace
      viewerRole={viewer.role}
      events={eventOptions}
      initialState={state}
      initialPageData={pageData}
      initialPlayerId={query.player || ""}
      initialSuccess={query.success || ""}
      initialError={query.error || ""}
    />
  </AdminWorkspaceShell>;
}
