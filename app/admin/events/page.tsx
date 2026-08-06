import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSnapshot } from "@/db/admin";
import { getAdminViewer } from "../admin-viewer";
import "./event-management.css";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  draft: "草稿",
  registration_open: "报名中",
  registration_closed: "报名截止",
  in_progress: "比赛中",
  finished: "已结束",
  archived: "已归档",
};

export default async function EventSettingsIndexPage() {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  if (!['system_admin', 'committee'].includes(viewer.role)) {
    return <main className="backend-state backend-denied"><div className="backend-state-logo">锁</div><small>赛事管理</small><h1>当前账号没有赛事编辑权限</h1><p>裁判账号主要用于抽签、赛程和比分执行；赛事资料由系统管理员或组委会维护。</p><a href="/admin">返回赛事后台</a></main>;
  }

  const snapshot = await getAdminSnapshot(viewer.username);
  return <main className="event-settings-index">
    <header className="event-settings-index-head">
      <div><Link href="/admin">← 返回赛事后台</Link><small>赛事主数据</small><h1>赛事完整设置</h1><p>集中维护每一站的基本信息、场馆、组别、组织机构，以及组委会 / 裁判账号分配。</p></div>
      <span>{snapshot.events.length} 场赛事</span>
    </header>
    <section className="event-settings-index-grid">{snapshot.events.map((event) => <article key={event.id}>
      <header><span>第 {event.stationNo} 站</span><b>{statusLabels[event.status] ?? event.status}</b></header>
      <h2>{event.shortTitle}</h2>
      <p>{event.city} · {event.venueName || "场馆待设置"}</p>
      <dl><div><dt>比赛时间</dt><dd>{event.startDate} — {event.endDate}</dd></div><div><dt>前端状态</dt><dd>{event.publishStatus === "published" ? "已发布" : "草稿"}</dd></div><div><dt>发布模块</dt><dd>{event.publicationCount} / 6</dd></div></dl>
      <Link href={`/admin/events/${event.id}`}>进入完整设置 →</Link>
    </article>)}</section>
  </main>;
}
