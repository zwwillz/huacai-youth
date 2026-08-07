import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminViewer } from "../../admin-viewer";
import { getAdminNavigationEvents } from "@/db/admin-ui";
import { getScheduleWorkspaceData } from "@/db/schedule-engine";
import { getCompetitionContextData } from "@/db/competition-context";
import AdminWorkspaceShell from "../../admin-workspace-shell";
import CompetitionContextBar from "../competition-context-bar";
import CompetitionPublicationBar from "../competition-publication-bar";
import ScheduleWorkbenchClient from "./schedule-workbench-client";
import "../competition-context-bar.css";
import "./schedule-workbench.css";

export const dynamic = "force-dynamic";
const PHASES = [
  { code: "qualifier-one", title: "资格赛第一场" },
  { code: "qualifier-two", title: "资格赛第二场" },
  { code: "main-one", title: "正赛第一阶段" },
  { code: "main-two", title: "正赛第二阶段" },
];

export default async function ScheduleWorkbenchPage({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  const query = await searchParams;
  const sessionId = String(query.session || "");
  if (!sessionId) redirect("/admin/competition/schedules");
  const events = await getAdminNavigationEvents(viewer.username);

  try {
    const data = await getScheduleWorkspaceData(viewer.username, sessionId);
    const context = await getCompetitionContextData(viewer.username, data.bracket.eventId);
    return <AdminWorkspaceShell viewer={{ displayName: viewer.displayName, role: viewer.role }} events={events} active="competition" pageTitle="赛程编排" pageHint="竞赛执行 · 当前阶段排程" currentEventId={data.bracket.eventId} eventScoped competitionTool="schedule">
      <CompetitionContextBar eventId={data.bracket.eventId} eventTitle={data.bracket.eventTitle} groups={context.groups} selectedGroupId={data.bracket.groupId} basePath="/admin/competition/schedules" phases={PHASES} selectedPhase={data.bracket.phaseCode} eyebrow="赛程编排" title={`${data.bracket.groupName} · ${data.bracket.phaseTitle}`} description="当前页面只编辑这一组别、这一阶段的时间、球台与裁判。保存后先在后台检查；用户端保持上一版正式赛程，确认无误后再发布更新。" />
      <CompetitionPublicationBar eventId={data.bracket.eventId} moduleType="schedule" title="签表与赛程" status={context.publications.schedule.status} hasUnpublishedChanges={context.publications.schedule.hasUnpublishedChanges} viewerRole={viewer.role} hint="时间、球台或签表调整只产生后台未发布更新；不会覆盖用户端上一版正式内容，直到再次发布。" />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 10 }}><Link href={`/admin/competition/print?session=${encodeURIComponent(sessionId)}`} style={{ padding: "9px 12px", borderRadius: 9, background: "#f1ebf7", color: "#67478f", fontSize: 9, fontWeight: 900, textDecoration: "none" }}>打印签表 / 赛程</Link></div>
      <ScheduleWorkbenchClient initialData={data} />
    </AdminWorkspaceShell>;
  } catch (error) {
    return <AdminWorkspaceShell viewer={{ displayName: viewer.displayName, role: viewer.role }} events={events} active="competition" pageTitle="赛程编排" pageHint="竞赛执行 · 当前阶段排程" eventScoped competitionTool="schedule">
      <main className="backend-state backend-denied"><div className="backend-state-logo">程</div><small>赛程编排</small><h1>暂时不能进入赛程编排</h1><p>{error instanceof Error ? error.message : "赛程数据读取失败。"}</p><a href="/admin/competition/schedules">返回赛程编排</a></main>
    </AdminWorkspaceShell>;
  }
}
