import { redirect } from "next/navigation";
import { getAdminViewer } from "../../admin-viewer";
import { getAdminNavigationEvents } from "@/db/admin-ui";
import { getScoringWorkspaceData, type ScoringWorkspaceData } from "@/db/scoring-engine";
import { getCompetitionContextData } from "@/db/competition-context";
import AdminWorkspaceShell from "../../admin-workspace-shell";
import CompetitionContextBar from "../competition-context-bar";
import CompetitionPublicationBar from "../competition-publication-bar";
import ScoringWorkbenchClient from "./scoring-workbench-client";
import "../competition-context-bar.css";
import "./scoring-workbench.css";

export const dynamic = "force-dynamic";
const ALL_PHASES = [
  { code: "qualifier-one", title: "资格赛第一场" },
  { code: "qualifier-two", title: "资格赛第二场" },
  { code: "main-one", title: "正赛第一阶段" },
  { code: "main-two", title: "正赛第二阶段" },
];

export default async function ScoringPage({ searchParams }: { searchParams: Promise<{ event?: string; group?: string; phase?: string; date?: string; view?: string }> }) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  const query = await searchParams;
  const events = await getAdminNavigationEvents(viewer.username);
  const eventId = events.some((event) => event.id === query.event) ? String(query.event) : events[0]?.id;
  if (!eventId) redirect("/admin/competition");

  try {
    const [rawData, context] = await Promise.all([
      getScoringWorkspaceData(viewer.username, eventId, { groupId: query.group, phaseCode: query.phase, date: query.date, showConfirmed: query.view === "all" }),
      getCompetitionContextData(viewer.username, eventId),
    ]);
    const requestedPhase = ALL_PHASES.some((phase) => phase.code === query.phase) ? String(query.phase) : rawData.filters.phaseCode;
    const data: ScoringWorkspaceData = requestedPhase !== rawData.filters.phaseCode
      ? { ...rawData, filters: { ...rawData.filters, phaseCode: requestedPhase, date: "" }, dates: [], matches: [], counts: { actionable: 0, submitted: 0, confirmed: 0, visible: 0 } }
      : rawData;
    const statMap = new Map(rawData.phases.map((phase) => [phase.code, phase]));
    const phases = ALL_PHASES.map((phase) => {
      const stat = statMap.get(phase.code);
      return { ...phase, hint: stat ? (stat.actionableCount ? `${stat.actionableCount}场待处理` : `${stat.confirmedCount}场已确认`) : "等待赛程" };
    });
    const selectedPhaseTitle = ALL_PHASES.find((phase) => phase.code === data.filters.phaseCode)?.title || "当前阶段";
    return <AdminWorkspaceShell viewer={{ displayName: viewer.displayName, role: viewer.role }} events={events} active="competition" pageTitle="比分录入" pageHint="竞赛执行 · 当前待办优先" currentEventId={eventId} eventScoped competitionTool="scoring">
      <CompetitionContextBar eventId={eventId} eventTitle={data.event.shortTitle} groups={data.groups} selectedGroupId={data.filters.groupId} basePath="/admin/competition/scoring" phases={phases} selectedPhase={data.filters.phaseCode} eyebrow="比分录入" title={`${data.groups.find((group) => group.id === data.filters.groupId)?.name || "当前组别"} · ${selectedPhaseTitle}`} description="默认只显示当前组别、当前阶段和当前日期尚未完成的比赛；已经确认的场次自动收起，需要复核时可单独查看。尚未排赛程的阶段仍可提前进入查看等待状态。" />
      <CompetitionPublicationBar eventId={eventId} moduleType="matches" title="对阵与比分" status={context.publications.matches.status} hasUnpublishedChanges={context.publications.matches.hasUnpublishedChanges} viewerRole={viewer.role} hint="比分确认后先进入后台未发布更新。用户端仍保持上一版已发布比分；点击“发布更新”后才整体切换。" />
      <ScoringWorkbenchClient initialData={data} />
    </AdminWorkspaceShell>;
  } catch (error) {
    return <AdminWorkspaceShell viewer={{ displayName: viewer.displayName, role: viewer.role }} events={events} active="competition" pageTitle="比分录入" pageHint="竞赛执行 · 当前待办优先" currentEventId={eventId} eventScoped competitionTool="scoring">
      <main className="backend-state backend-denied"><div className="backend-state-logo">分</div><small>比分录入</small><h1>暂时不能进入比分录入</h1><p>{error instanceof Error ? error.message : "比分数据读取失败。"}</p><a href="/admin/competition">返回竞赛执行</a></main>
    </AdminWorkspaceShell>;
  }
}
