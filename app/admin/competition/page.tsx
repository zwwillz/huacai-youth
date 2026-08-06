import { redirect } from "next/navigation";
import { getAdminViewer } from "../admin-viewer";
import { getAdminSnapshot } from "@/db/admin";
import AdminWorkspaceShell from "../admin-workspace-shell";
import "./competition.css";

export const dynamic = "force-dynamic";

export default async function CompetitionWorkspacePage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  const snapshot = await getAdminSnapshot(viewer.username);
  const query = await searchParams;
  const currentEventId = snapshot.events.some((event) => event.id === query.event) ? query.event : snapshot.events[0]?.id;
  const events = snapshot.events.map((event) => ({ id: event.id, shortTitle: event.shortTitle, stationNo: event.stationNo, status: event.status, startDate: event.startDate, endDate: event.endDate }));
  const currentEvent = snapshot.events.find((event) => event.id === currentEventId);

  return <AdminWorkspaceShell viewer={{ displayName: viewer.displayName, role: viewer.role }} events={events} active="competition" pageTitle="竞赛执行" pageHint="裁判工作区 · 动态竞赛数据" currentEventId={currentEventId} eventScoped>
    <main className="competition-workspace-page">
      <section className="competition-workspace-shell">
        <header className="competition-workspace-head"><div><small>COMPETITION OPERATIONS</small><h1>{currentEvent?.shortTitle || "竞赛执行工作区"}</h1><p>签表、赛程、球台、对阵、比分和晋级属于动态竞赛数据。裁判组负责执行，组委会负责关键确认和最终发布。</p></div><b>规划版</b></header>

        <section className="competition-flow">
          <article><span>01</span><h2>抽签与签表</h2><p>种子、签位、分区/分组、轮空、单败/双败关系。</p><b>裁判组生成 · 组委会确认</b></article>
          <i>→</i>
          <article><span>02</span><h2>赛程与球台</h2><p>比赛日期、时间、球台、TV台、阶段顺序与临时调整。</p><b>由签表产生，可手工调整</b></article>
          <i>→</i>
          <article><span>03</span><h2>对阵与比分</h2><p>当天对阵、比赛状态、比分录入、更正、晋级关系。</p><b>动态数据</b></article>
          <i>→</i>
          <article><span>04</span><h2>排名与积分</h2><p>根据最终赛果生成名次，允许组委会确认和人工修正。</p><b>确认后发布</b></article>
        </section>

        {currentEvent && <section className="competition-event-list"><header><div><small>当前赛事</small><h2>竞赛工作区准备状态</h2></div><span>第 {currentEvent.stationNo} 站</span></header><article><div><b>{currentEvent.status}</b><h3>{currentEvent.shortTitle}</h3><p>{currentEvent.city} · {currentEvent.venueName || "场馆待设置"}</p></div><dl><div><dt>赛事状态</dt><dd>{currentEvent.status}</dd></div><div><dt>内容模块</dt><dd>{currentEvent.publicationCount} / 6</dd></div></dl><button disabled>竞赛引擎下一阶段开放</button></article></section>}

        <section className="competition-principles"><article><strong>权限</strong><p>当前先按系统角色收敛菜单；竞赛引擎阶段再启用“裁判只看到被分配赛事”的严格赛事成员权限，并继续细分普通裁判、裁判长等职责。</p></article><article><strong>自动 + 手工</strong><p>系统自动生成能生成的关系，但所有关键数据保留人工调整入口，并记录审计日志。</p></article><article><strong>发布逻辑</strong><p>赛程、对阵、排名各自具备“草稿 / 已确认 / 已发布”状态，公众端只读取已发布版本。</p></article></section>
      </section>
    </main>
  </AdminWorkspaceShell>;
}
