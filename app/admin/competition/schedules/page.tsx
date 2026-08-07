import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminViewer } from "../../admin-viewer";
import { getAdminNavigationEvents } from "@/db/admin-ui";
import { getCompetitionBracketIndex } from "@/db/competition-tool-index";
import { getCompetitionContextData } from "@/db/competition-context";
import AdminWorkspaceShell from "../../admin-workspace-shell";
import CompetitionContextBar from "../competition-context-bar";
import CompetitionPublicationBar from "../competition-publication-bar";
import "../competition-context-bar.css";
import "./schedules-index.css";

export const dynamic = "force-dynamic";

const PHASES = [
  ["qualifier-one", "资格赛第一场"],
  ["qualifier-two", "资格赛第二场"],
  ["main-one", "正赛第一阶段"],
  ["main-two", "正赛第二阶段"],
] as const;
const PHASE_ORDER = new Map(PHASES.map(([code], index) => [code, index]));

export default async function CompetitionSchedulesPage({ searchParams }: { searchParams: Promise<{ event?: string; group?: string; phase?: string }> }) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  const query = await searchParams;
  const events = await getAdminNavigationEvents(viewer.username);
  const eventId = events.some((event) => event.id === query.event) ? String(query.event) : events[0]?.id;
  if (!eventId) redirect("/admin/competition");
  const context = await getCompetitionContextData(viewer.username, eventId);
  const selectedGroupId = context.groups.some((group) => group.id === query.group) ? String(query.group) : context.groups[0]?.id || "";
  const items = selectedGroupId ? await getCompetitionBracketIndex(viewer.username, eventId, { groupId: selectedGroupId }) : [];
  const availablePhases = [...new Set(items.map((item) => item.phaseCode))];
  const selectedPhase = PHASES.some(([code]) => code === query.phase)
    ? String(query.phase)
    : [...availablePhases].sort((a, b) => (PHASE_ORDER.get(b) ?? -1) - (PHASE_ORDER.get(a) ?? -1))[0] || "qualifier-one";
  const current = items.filter((item) => item.phaseCode === selectedPhase).sort((a, b) => b.drawVersion - a.drawVersion)[0] ?? null;
  const phaseOptions = PHASES.map(([code, title]) => {
    const item = items.filter((row) => row.phaseCode === code).sort((a, b) => b.drawVersion - a.drawVersion)[0];
    return { code, title, hint: item ? (item.scheduleId ? `${item.scheduledCount}/${item.playableMatchCount}场已排` : "签表已就绪") : "等待签表" };
  });

  return <AdminWorkspaceShell viewer={{ displayName: viewer.displayName, role: viewer.role }} events={events} active="competition" pageTitle="赛程编排" pageHint="竞赛执行 · 按组别与阶段编排" currentEventId={eventId} eventScoped competitionTool="schedule">
    <main className="schedule-index-page">
      <CompetitionContextBar eventId={eventId} eventTitle={context.event.shortTitle} groups={context.groups} selectedGroupId={selectedGroupId} basePath="/admin/competition/schedules" phases={phaseOptions} selectedPhase={selectedPhase} eyebrow="赛程编排" title={`${context.groups.find((group) => group.id === selectedGroupId)?.name || "当前组别"} · ${PHASES.find(([code]) => code === selectedPhase)?.[1] || "当前阶段"}`} description="每次只处理一个组别、一个阶段。先配置时间与球台并保存，用户端继续保持上一版正式赛程；确认无误后再发布更新。" />
      <CompetitionPublicationBar eventId={eventId} moduleType="schedule" title="签表与赛程" status={context.publications.schedule.status} hasUnpublishedChanges={context.publications.schedule.hasUnpublishedChanges} viewerRole={viewer.role} hint="抽签、时间、球台等后台调整不会直接覆盖用户端；点击发布更新后，用户端才整体切换到本次正式版本。" />

      {current ? <section className="schedule-current-stage">
        <article>
          <header><div><span>{current.groupName}</span><h3>{current.phaseTitle}</h3><p>抽签 V{current.drawVersion}</p></div><em>{current.scheduleId ? "已生成赛程" : "等待编排"}</em></header>
          <div className="schedule-current-metrics"><div><small>实际比赛</small><strong>{current.playableMatchCount}</strong><span>场</span></div><div><small>已排赛程</small><strong>{current.scheduledCount}</strong><span>场</span></div><div><small>完成度</small><strong>{current.playableMatchCount ? Math.round(current.scheduledCount / current.playableMatchCount * 100) : 0}</strong><span>%</span></div></div>
          <div className="schedule-index-actions"><Link href={`/admin/competition/schedule?session=${encodeURIComponent(current.drawSessionId)}`}>{current.scheduleId ? "继续调整当前阶段" : "进入自动排程"}</Link><Link className="secondary" href={`/admin/competition/print?session=${encodeURIComponent(current.drawSessionId)}`}>打印签表 / 赛程</Link></div>
        </article>
      </section> : <section className="schedule-index-empty"><strong>当前阶段还没有可编排的正式签表</strong><p>请先在“抽签与签表”中完成当前组别、当前阶段的正式抽签并生成比赛关系。赛程页面会自动开放，不需要手工创建阶段。</p><Link href={`/admin/competition/draw?event=${encodeURIComponent(eventId)}&group=${encodeURIComponent(selectedGroupId)}&phase=${encodeURIComponent(selectedPhase)}`}>进入当前阶段抽签</Link></section>}
    </main>
  </AdminWorkspaceShell>;
}
