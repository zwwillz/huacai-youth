import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminViewer } from "../../admin-viewer";
import { getAdminNavigationEvents } from "@/db/admin-ui";
import { getCompetitionBracketIndex } from "@/db/competition-tool-index";
import AdminWorkspaceShell from "../../admin-workspace-shell";
import "./schedules-index.css";

export const dynamic = "force-dynamic";

export default async function CompetitionSchedulesPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  const query = await searchParams;
  const events = await getAdminNavigationEvents(viewer.username);
  const eventId = events.some((event) => event.id === query.event) ? String(query.event) : events[0]?.id;
  if (!eventId) redirect("/admin/competition");
  const currentEvent = events.find((event) => event.id === eventId);
  const items = await getCompetitionBracketIndex(viewer.username, eventId);

  return <AdminWorkspaceShell
    viewer={{ displayName: viewer.displayName, role: viewer.role }}
    events={events}
    active="competition"
    pageTitle="赛程编排"
    pageHint="竞赛执行 · 时间 / 球台 / 裁判"
    currentEventId={eventId}
    eventScoped
    competitionTool="schedule"
  >
    <main className="schedule-index-page">
      <section className="schedule-index-hero"><div><small>SCHEDULE CONTROL</small><h2>{currentEvent?.shortTitle || "赛程编排"}</h2><p>从已经确认并生成完整比赛树的阶段进入。这里统一管理时间段、球台、TV台、裁判分配以及打印输出。</p></div><span>{items.length} 个签表阶段</span></section>
      <section className="schedule-index-grid">{items.map((item) => <article key={item.drawSessionId}>
        <header><div><span>{item.groupName}</span><h3>{item.phaseTitle}</h3></div><em>{item.scheduleId ? "已生成赛程" : "待编排"}</em></header>
        <dl><div><dt>抽签版本</dt><dd>V{item.drawVersion}</dd></div><div><dt>实际比赛</dt><dd>{item.playableMatchCount} 场</dd></div><div><dt>已排赛程</dt><dd>{item.scheduledCount} 场</dd></div></dl>
        <div className="schedule-index-actions"><Link href={`/admin/competition/schedule?session=${encodeURIComponent(item.drawSessionId)}`}>{item.scheduleId ? "继续调整赛程" : "进入自动排程"}</Link><Link className="secondary" href={`/admin/competition/print?session=${encodeURIComponent(item.drawSessionId)}`}>打印签表 / 赛程</Link></div>
      </article>)}</section>
      {!items.length && <section className="schedule-index-empty"><strong>还没有可编排的完整签表</strong><p>请先进入“抽签与签表”，确认正式抽签并生成完整比赛树。</p><Link href={`/admin/competition?event=${encodeURIComponent(eventId)}`}>进入抽签与签表</Link></section>}
    </main>
  </AdminWorkspaceShell>;
}
