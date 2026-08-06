import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminViewer } from "../admin-viewer";
import { getAdminSnapshot } from "@/db/admin";
import "./competition.css";

export const dynamic = "force-dynamic";

export default async function CompetitionWorkspacePage() {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  const snapshot = await getAdminSnapshot(viewer.username);

  return <main className="competition-workspace-page">
    <header className="competition-workspace-topbar"><div><Link href="/admin">← 返回赛事后台</Link><span>竞赛执行</span></div><div><Link href="/admin/events">赛事设置</Link><Link href="/admin/content">内容发布</Link></div></header>
    <section className="competition-workspace-shell">
      <header className="competition-workspace-head"><div><small>COMPETITION OPERATIONS</small><h1>竞赛执行工作区</h1><p>赛程签表、对阵、比分和排名属于动态竞赛数据，由裁判组与组委会在这里形成闭环，不再混在普通内容发布中。</p></div><b>规划版</b></header>

      <section className="competition-flow">
        <article><span>01</span><h2>抽签与签表</h2><p>种子、签位、分区/分组、轮空、单败/双败关系。</p><b>裁判组生成 · 组委会确认</b></article>
        <i>→</i>
        <article><span>02</span><h2>赛程与球台</h2><p>比赛日期、时间、球台、TV台、阶段顺序与临时调整。</p><b>由签表产生，可手工调整</b></article>
        <i>→</i>
        <article><span>03</span><h2>对阵与比分</h2><p>当天对阵、比赛状态、比分录入、更正、晋级关系。</p><b>动态数据</b></article>
        <i>→</i>
        <article><span>04</span><h2>排名与积分</h2><p>根据最终赛果生成名次，允许组委会确认和人工修正。</p><b>确认后发布</b></article>
      </section>

      <section className="competition-event-list"><header><div><small>选择赛事</small><h2>分站竞赛工作区</h2></div><span>{snapshot.events.length} 场赛事</span></header>{snapshot.events.map((event) => <article key={event.id}><div><b>第 {event.stationNo} 站</b><h3>{event.shortTitle}</h3><p>{event.city} · {event.venueName || "场馆待设置"}</p></div><dl><div><dt>赛事状态</dt><dd>{event.status}</dd></div><div><dt>内容模块</dt><dd>{event.publicationCount} / 6</dd></div></dl><button disabled>竞赛引擎下一阶段开放</button></article>)}</section>

      <section className="competition-principles"><article><strong>权限</strong><p>裁判可操作抽签、球台、比分；组委会负责关键确认和最终发布。</p></article><article><strong>自动 + 手工</strong><p>系统自动生成能生成的关系，但所有关键数据保留人工调整入口，并记录审计日志。</p></article><article><strong>发布逻辑</strong><p>赛程、对阵、排名各自具备“草稿 / 已确认 / 已发布”状态，公众端只读取已发布版本。</p></article></section>
    </section>
  </main>;
}
