import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSnapshot } from "@/db/admin";
import { getAdminViewer } from "../admin-viewer";
import AdminWorkspaceShell from "../admin-workspace-shell";
import "../events/event-settings-index.css";

export const dynamic = "force-dynamic";

export default async function ContentPublishingIndexPage() {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  if (!["system_admin", "committee"].includes(viewer.role)) {
    return <main className="backend-state backend-denied"><div className="backend-state-logo">锁</div><small>内容发布</small><h1>当前账号没有内容发布权限</h1><p>赛事内容由系统管理员或组委会维护和发布。</p><a href="/admin">返回赛事后台</a></main>;
  }

  const snapshot = await getAdminSnapshot(viewer.username);
  const events = snapshot.events.map((event) => ({ id: event.id, shortTitle: event.shortTitle, stationNo: event.stationNo, status: event.status, startDate: event.startDate, endDate: event.endDate }));

  return <AdminWorkspaceShell viewer={{ displayName: viewer.displayName, role: viewer.role, roleLabel: viewer.roleLabel }} events={events} active="content" pageTitle="内容发布" pageHint="赛事运营 · 请选择赛事" eventScoped>
    <main className="event-settings-index">
      <header className="event-settings-index-head">
        <div><small>静态内容发布</small><h1>选择赛事</h1><p>赛事创建后，才会进入本站的内容发布。这里维护赛事简介、竞赛规程、赛事文件和参赛友好提示；赛程签表、对阵、比分和排名交给“竞赛执行”。</p></div>
        <span>{snapshot.events.length} 场赛事</span>
      </header>
      <section className="event-settings-index-grid">{snapshot.events.map((event) => <article key={event.id}>
        <header><span>第 {event.stationNo} 站</span><b>{event.publicationCount} / 6 当前模块已公开</b></header>
        <h2>{event.shortTitle}</h2>
        <p>{event.city} · {event.venueName || "场馆待设置"}</p>
        <dl><div><dt>比赛时间</dt><dd>{event.startDate} — {event.endDate}</dd></div><div><dt>赛事状态</dt><dd>{event.status}</dd></div><div><dt>前端状态</dt><dd>{event.publishStatus === "published" ? "已发布" : "草稿"}</dd></div></dl>
        <div className="event-settings-card-actions"><Link href={`/admin/content/${event.id}`}>进入内容发布 →</Link><Link href={`/admin/content/${event.id}/guides`}>参赛提示 →</Link><Link href={`/admin/events/${event.id}`}>赛事设置 →</Link></div>
      </article>)}</section>
    </main>
  </AdminWorkspaceShell>;
}
