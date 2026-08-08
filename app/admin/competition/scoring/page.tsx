import { redirect } from "next/navigation";
import { getAdminViewer } from "../../admin-viewer";
import { getAdminNavigationEventsForPrincipal } from "@/db/admin-principal-ui";
import { getScoringWorkspaceBundleFast } from "@/db/scoring-fast";
import type { ScoringWorkspaceData } from "@/db/scoring-engine";
import AdminWorkspaceShell from "../../admin-workspace-shell";
import ScoringLocalWorkspaceClient from "./scoring-local-workspace-client";
import { captureAdminLoad } from "../../capture-admin-load";
import "../competition-context-bar.css";
import "./scoring-workbench.css";

export const dynamic = "force-dynamic";
const ALL_PHASES = ["qualifier-one", "qualifier-two", "main-one", "main-two"];

export default async function ScoringPage({ searchParams }: { searchParams: Promise<{ event?: string; group?: string; phase?: string; date?: string; view?: string }> }) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  const query = await searchParams;
  const events = await getAdminNavigationEventsForPrincipal(viewer);
  const eventId = events.some((event) => event.id === query.event) ? String(query.event) : events[0]?.id;
  if (!eventId) redirect("/admin/competition");

  const result = await captureAdminLoad(getScoringWorkspaceBundleFast(viewer, eventId, {
    groupId: query.group,
    phaseCode: query.phase,
    date: query.date,
    showConfirmed: query.view === "all",
  }));
  if (!result.data) {
    return <AdminWorkspaceShell viewer={{ displayName: viewer.displayName, role: viewer.role }} events={events} active="competition" pageTitle="比分录入" pageHint="竞赛执行 · 当前待办优先" currentEventId={eventId} eventScoped competitionTool="scoring">
      <main className="backend-state backend-denied"><div className="backend-state-logo">分</div><small>比分录入</small><h1>暂时不能进入比分录入</h1><p>{result.error instanceof Error ? result.error.message : "比分数据读取失败。"}</p><a href="/admin/competition">返回竞赛执行</a></main>
    </AdminWorkspaceShell>;
  }
  const { data: rawData, context } = result.data;
  const requestedPhase = ALL_PHASES.includes(String(query.phase || "")) ? String(query.phase) : rawData.filters.phaseCode;
  const data: ScoringWorkspaceData = requestedPhase !== rawData.filters.phaseCode
    ? { ...rawData, filters: { ...rawData.filters, phaseCode: requestedPhase, date: "" }, dates: [], matches: [], counts: { actionable: 0, submitted: 0, confirmed: 0, visible: 0 } }
    : rawData;

  return <AdminWorkspaceShell viewer={{ displayName: viewer.displayName, role: viewer.role }} events={events} active="competition" pageTitle="比分录入" pageHint="竞赛执行 · 当前待办优先" currentEventId={eventId} eventScoped eventSwitchMode="local" competitionTool="scoring">
    <ScoringLocalWorkspaceClient initialData={data} initialContext={context} />
  </AdminWorkspaceShell>;
}
