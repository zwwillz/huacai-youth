import { redirect } from "next/navigation";
import { getAdminViewer } from "../../admin-viewer";
import { getAdminNavigationEvents } from "@/db/admin-ui";
import { getScoringWorkspaceData } from "@/db/scoring-engine";
import { getCompetitionContextData } from "@/db/competition-context";
import AdminWorkspaceShell from "../../admin-workspace-shell";
import CompetitionContextBar from "../competition-context-bar";
import CompetitionPublicationBar from "../competition-publication-bar";
import ScoringWorkbenchClient from "./scoring-workbench-client";
import "../competition-context-bar.css";
import "./scoring-workbench.css";

export const dynamic = "force-dynamic";

export default async function ScoringPage({ searchParams }: { searchParams: Promise<{ event?: string; group?: string; phase?: string; date?: string; view?: string }> }) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  const query = await searchParams;
  const events = await getAdminNavigationEvents(viewer.username);
  const eventId = events.some((event) => event.id === query.event) ? String(query.event) : events[0]?.id;
  if (!eventId) redirect("/admin/competition");

  try {
    const [data, context] = await Promise.all([
      getScoringWorkspaceData(viewer.username, eventId, { groupId: query.group, phaseCode: query.phase, date: query.date, showConfirmed: query.view === "all" }),
      getCompetitionContextData(viewer.username, eventId),
    ]);
    const phases = data.phases.map((phase) => ({ code: phase.code, title: phase.title, hint: phase.actionableCount ? `${phase.actionableCount}场待处理` : `${phase.confirmedCount}场已确认` }));
    return <AdminWorkspaceShell
      viewer={{ displayName: viewer.displayName, role: viewer.role }}
      events={events}
      active="competition"
      pageTitle="比分录入"
      pageHint="竞赛执行 · 当前待办优先"
      currentEventId={eventId}
      eventScoped
      competitionTool="scoring"
    >
      <CompetitionContextBar
        eventId={eventId}
        eventTitle={data.event.shortTitle}
        groups={data.groups}
        selectedGroupId={data.filters.groupId}
        basePath="/admin/competition/scoring"
        phases={phases}
        selectedPhase={data.filters.phaseCode}
        eyebrow="比分录入"
        title={`${data.groups.find((group) => group.id === data.filters.groupId)?.name || "当前组别"} · ${data.phases.find((phase) => phase.code === data.filters.phaseCode)?.title || "当前阶段"}`}
        description="默认只显示当前组别、当前阶段和当前日期尚未完成的比赛；已经确认的场次自动收起，需要复核时可单独查看。"
      />
      <CompetitionPublicationBar eventId={eventId} moduleType="matches" title="对阵与比分" status={context.publications.matches.status} viewerRole={viewer.role} hint="比分确认只保存在后台；点击发布后，用户端才显示本次已确认的对阵与比分。后续继续确认比分会重新进入待发布状态。" />
      <ScoringWorkbenchClient initialData={data} />
    </AdminWorkspaceShell>;
  } catch (error) {
    return <AdminWorkspaceShell viewer={{ displayName: viewer.displayName, role: viewer.role }} events={events} active="competition" pageTitle="比分录入" pageHint="竞赛执行 · 当前待办优先" currentEventId={eventId} eventScoped competitionTool="scoring">
      <main className="backend-state backend-denied"><div className="backend-state-logo">分</div><small>比分录入</small><h1>暂时不能进入比分录入</h1><p>{error instanceof Error ? error.message : "比分数据读取失败。"}</p><a href="/admin/competition">返回竞赛执行</a></main>
    </AdminWorkspaceShell>;
  }
}
