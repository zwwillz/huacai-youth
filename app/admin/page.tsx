import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminHomeData } from "@/db/admin-ui";
import AdminWorkspaceShell from "./admin-workspace-shell";
import { getAdminViewer } from "./admin-viewer";
import "./admin-home.css";

export const dynamic = "force-dynamic";

type Section = "dashboard" | "registrations" | "players" | "rankings";

function normalizeSection(value?: string): Section {
  return (["registrations", "players", "rankings"] as Section[]).includes(value as Section) ? value as Section : "dashboard";
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ section?: string; event?: string }> }) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  const query = await searchParams;
  if (query.section === "events") redirect("/admin/events");
  if (query.section === "content") redirect("/admin/content");
  if (query.section === "competition") redirect("/admin/competition");
  if (query.section === "accounts") redirect("/admin/accounts");
  if (query.section === "logs") redirect("/admin/logs");

  const data = await getAdminHomeData(viewer.username);
  let section = normalizeSection(query.section);
  if (viewer.role === "referee" && !["dashboard", "players"].includes(section)) section = "dashboard";

  const events = data.events.map((event) => ({ id: event.id, shortTitle: event.shortTitle, stationNo: event.stationNo, status: event.status, startDate: event.startDate, endDate: event.endDate }));
  const currentEventId = data.events.some((event) => event.id === query.event) ? query.event : data.events[0]?.id;
  const currentEvent = data.events.find((event) => event.id === currentEventId);
  const eventScoped = section === "registrations" || section === "players";
  const titles = {
    dashboard: ["工作台", "全局总览与待办"],
    registrations: ["报名审核", "赛事运营 · 当前赛事"],
    players: ["球员管理", "赛事运营 · 本站球员与球员总库"],
    rankings: ["排名积分", "全局 · 总积分与分站排名"],
  } as const;
  const [pageTitle, pageHint] = titles[section];

  return <AdminWorkspaceShell
    viewer={{ displayName: viewer.displayName, role: viewer.role }}
    events={events}
    active={section}
    pageTitle={pageTitle}
    pageHint={pageHint}
    currentEventId={eventScoped ? currentEventId : undefined}
    eventScoped={eventScoped}
  >
    {section === "dashboard" && <Dashboard data={data} viewerRole={viewer.role} />}
    {section === "registrations" && <ScopedPlaceholder title="报名审核" eventTitle={currentEvent?.shortTitle} description="报名审核后续会在这里处理报名资料、组别、审核状态和缴费/确认状态。当前先统一到新的后台结构。" />}
    {section === "players" && <ScopedPlaceholder title="球员管理" eventTitle={currentEvent?.shortTitle} description="这里将分为“本站参赛球员”和“球员总库”。当前先统一页面入口，下一阶段再接球员档案、监护人和重复球员合并等功能。" />}
    {section === "rankings" && <RankingsOverview events={data.events} />}
  </AdminWorkspaceShell>;
}

function Dashboard({ data, viewerRole }: { data: Awaited<ReturnType<typeof getAdminHomeData>>; viewerRole: string }) {
  const recentEvents = data.events.slice(0, 4);
  const currentEventId = recentEvents[0]?.id;
  const primary = viewerRole === "system_admin"
    ? { href: "/admin/events/new", label: "＋ 创建新赛事" }
    : viewerRole === "referee"
      ? { href: currentEventId ? `/admin/competition/scoring?event=${encodeURIComponent(currentEventId)}` : "/admin/competition", label: "进入比分录入" }
      : { href: currentEventId ? `/admin/competition?event=${encodeURIComponent(currentEventId)}` : "/admin/competition", label: "进入当前赛事" };
  const eventHref = (eventId: string) => viewerRole === "referee"
    ? `/admin/competition/scoring?event=${encodeURIComponent(eventId)}`
    : `/admin/competition?event=${encodeURIComponent(eventId)}`;

  return <main className="admin-home">
    <section className="admin-home-hero"><div><small>HUACAI EVENT ADMIN</small><h2>华彩赛事管理后台</h2><p>{viewerRole === "referee" ? "这里只显示分配给你的赛事。进入比分录入后，默认只看当前需要处理的比赛。" : "先选择一场赛事，再按内容发布、抽签、赛程、比分、晋级和排名的顺序处理。"}</p></div><Link href={primary.href}>{primary.label}</Link></section>
    <section className="admin-home-metrics">
      <article><span>可管理赛事</span><strong>{data.metrics.eventCount}</strong><small>{viewerRole === "system_admin" ? "系统内全部赛事" : "已分配给当前账号"}</small></article>
      <article><span>进行中赛事</span><strong>{data.metrics.activeEventCount}</strong><small>报名中或比赛中</small></article>
      <article><span>待审核报名</span><strong>{data.metrics.pendingRegistrationCount}</strong><small>后续报名模块接入后处理</small></article>
      <article><span>待发布内容</span><strong>{data.metrics.draftPublicationCount}</strong><small>仍处于草稿状态</small></article>
    </section>
    <section className="admin-home-grid">
      <article className="admin-home-panel"><header><div><small>MY EVENTS</small><h3>{viewerRole === "system_admin" ? "最近赛事" : "已分配赛事"}</h3></div>{viewerRole === "system_admin" && <Link href="/admin/events">查看全部赛事 →</Link>}</header>
        {recentEvents.length ? recentEvents.map((event) => <div className="admin-home-event" key={event.id}><span>{event.stationNo}</span><div><strong>{event.shortTitle}</strong><small>{event.city} · {event.venueName || "场馆待设置"} · {event.startDate} — {event.endDate}</small></div><Link href={eventHref(event.id)}>{viewerRole === "referee" ? "录入比分" : "继续处理"}</Link></div>) : <div className="admin-simple-empty">{viewerRole === "system_admin" ? "尚未创建赛事。" : "当前账号尚未分配赛事，请联系系统管理员。"}</div>}
      </article>
      <article className="admin-home-panel"><header><div><small>NEXT ACTION</small><h3>常用入口</h3></div></header><div className="admin-home-links">
        {viewerRole === "system_admin" && <Link href="/admin/events"><span>赛事管理</span><b>创建 / 设置 →</b></Link>}
        {viewerRole !== "referee" && <Link href={currentEventId ? `/admin/content/${currentEventId}` : "/admin/content"}><span>内容发布</span><b>概览 / 规程 →</b></Link>}
        <Link href={currentEventId ? `/admin/competition?event=${encodeURIComponent(currentEventId)}` : "/admin/competition"}><span>竞赛执行</span><b>查看当前待办 →</b></Link>
        <Link href={currentEventId ? `/admin/competition/scoring?event=${encodeURIComponent(currentEventId)}` : "/admin/competition/scoring"}><span>比分录入</span><b>进入工作台 →</b></Link>
      </div></article>
    </section>
  </main>;
}

function ScopedPlaceholder({ title, eventTitle, description }: { title: string; eventTitle?: string; description: string }) {
  return <main className="admin-simple-page"><section className="admin-simple-head"><small>CURRENT EVENT</small><h2>{title}</h2><p>{eventTitle ? `当前赛事：${eventTitle}。` : "请先选择当前赛事。"}{description}</p></section><section className="admin-simple-card"><div className="admin-simple-empty">该模块已经切换到新的后台框架，业务功能将在下一阶段继续接入。</div></section></main>;
}

function RankingsOverview({ events }: { events: Awaited<ReturnType<typeof getAdminHomeData>>["events"] }) {
  return <main className="admin-simple-page"><section className="admin-simple-head"><small>GLOBAL RANKING</small><h2>排名积分</h2><p>排名积分是全局工作区，不被顶部“当前赛事”绑定。后续这里会包含系列总积分榜、分站排名和积分流水。</p></section><section className="admin-simple-card"><h3>已建立赛事</h3><div className="admin-simple-table">{events.map((event) => <div className="admin-simple-row" key={event.id}><div><b>第 {event.stationNo} 站</b><br/><small>{event.shortTitle}</small></div><span>{event.city}</span><span>{event.status}</span></div>)}</div></section></main>;
}
