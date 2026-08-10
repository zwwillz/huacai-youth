import { redirect } from "next/navigation";
import { getAdminNavigationEventsForPrincipal } from "@/db/admin-principal-ui";
import { getParticipantRosterPage } from "@/db/participant-roster-page";
import AdminWorkspaceShell from "../admin-workspace-shell";
import { getAdminViewer } from "../admin-viewer";
import { ParticipantRosterWorkspace } from "./participant-workspace";
import "./participants.css";

export const dynamic = "force-dynamic";

type SearchParams = { event?: string; group?: string; q?: string; review?: string; fee?: string; page?: string };
function pageNumber(value?: string) {
  const parsed = Number.parseInt(value || "1", 10);
  return Number.isFinite(parsed) ? Math.max(1, parsed) : 1;
}

export default async function ParticipantsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  if (!["system_admin", "committee"].includes(viewer.role)) redirect("/admin");

  const query = await searchParams;
  const events = await getAdminNavigationEventsForPrincipal(viewer);
  const currentEventId = events.some((event) => event.id === query.event) ? String(query.event) : events[0]?.id || "";

  if (!currentEventId) {
    return <AdminWorkspaceShell
      viewer={{ displayName: viewer.displayName, role: viewer.role }}
      events={events}
      active="participants"
      pageTitle="参赛人员"
      pageHint="赛事运营 · 名单确认与锁定"
      eventScoped
    >
      <main className="participant-admin"><section className="participant-empty-card"><small>PARTICIPANT ROSTER</small><h2>参赛人员</h2><p>当前还没有可管理赛事。请先创建赛事，再进入参赛人员管理。</p></section></main>
    </AdminWorkspaceShell>;
  }

  const initialData = await getParticipantRosterPage(viewer, {
    eventId: currentEventId,
    groupId: query.group,
    query: query.q,
    review: query.review,
    fee: query.fee,
    page: pageNumber(query.page),
    pageSize: 40,
  });

  return <AdminWorkspaceShell
    viewer={{ displayName: viewer.displayName, role: viewer.role }}
    events={events}
    active="participants"
    pageTitle="参赛人员"
    pageHint="赛事运营 · 名单确认与锁定"
    currentEventId={currentEventId}
    eventScoped
  >
    <ParticipantRosterWorkspace
      key={currentEventId}
      viewerKey={viewer.id}
      viewerRole={viewer.role}
      initialData={initialData}
    />
  </AdminWorkspaceShell>;
}
