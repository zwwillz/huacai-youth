import { redirect } from "next/navigation";
import { getAdminHomeData } from "@/db/admin-ui";
import AdminWorkspaceShell from "./admin-workspace-shell";
import { getAdminViewer } from "./admin-viewer";
import DashboardClient from "./dashboard-client";
import "./admin-home.css";
import { eventStatusLabel } from "./admin-status";

export const dynamic = "force-dynamic";

type Section = "dashboard" | "registrations" | "rankings";

function normalizeSection(value?: string): Section {
  return (["registrations", "rankings"] as Section[]).includes(value as Section) ? value as Section : "dashboard";
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ section?: string; event?: string }> }) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  const query = await searchParams;
  if (query.section === "events") redirect("/admin/events");
  if (query.section === "content") redirect("/admin/content");
  if (query.section === "competition") redirect("/admin/competition");
  if (query.section === "players") redirect(`/admin/players${query.event ? `?event=${encodeURIComponent(query.event)}` : ""}`);
  if (query.section === "accounts") redirect("/admin/accounts");
  if (query.section === "logs") redirect("/admin/logs");

  let section = normalizeSection(query.section);
  if (viewer.role === "referee" && section !== "dashboard") section = "dashboard";

  // Structure first: the dashboard itself has no blocking business-data read.
  // Its real frame renders immediately and only the live metrics/recent events
  // are filled by a small private endpoint after paint.
  if (section === "dashboard") return <DashboardClient viewerKey={viewer.id} viewerRole={viewer.role} />;

  // These legacy secondary sections still use their existing server payload.
  // They can be migrated to the same structure-first pattern when their UI is
  // developed further.
  const data = await getAdminHomeData(viewer.username);
  const events = data.events.map((event) => ({ id: event.id, shortTitle: event.shortTitle, stationNo: event.stationNo, status: event.status, startDate: event.startDate, endDate: event.endDate }));
  const currentEventId = data.events.some((event) => event.id === query.event) ? query.event : data.events[0]?.id;
  const currentEvent = data.events.find((event) => event.id === currentEventId);
  const eventScoped = section === "registrations";
  const titles = {
    registrations: ["报名审核", "赛事运营 · 当前赛事"],
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
    {section === "registrations" && <ScopedPlaceholder title="报名审核" eventTitle={currentEvent?.shortTitle} description="报名审核后续会在这里处理报名资料、组别、审核状态和缴费/确认状态。当前先统一到新的后台结构。" />}
    {section === "rankings" && <RankingsOverview events={data.events} />}
  </AdminWorkspaceShell>;
}

function ScopedPlaceholder({ title, eventTitle, description }: { title: string; eventTitle?: string; description: string }) {
  return <main className="admin-simple-page"><section className="admin-simple-head"><small>CURRENT EVENT</small><h2>{title}</h2><p>{eventTitle ? `当前赛事：${eventTitle}。` : "请先选择当前赛事。"}{description}</p></section><section className="admin-simple-card"><div className="admin-simple-empty">该模块已经切换到新的后台框架，业务功能将在下一阶段继续接入。</div></section></main>;
}

function RankingsOverview({ events }: { events: Awaited<ReturnType<typeof getAdminHomeData>>["events"] }) {
  return <main className="admin-simple-page"><section className="admin-simple-head"><small>GLOBAL RANKING</small><h2>排名积分</h2><p>排名积分是全局工作区，不被顶部“当前赛事”绑定。后续这里会包含系列总积分榜、分站排名和积分流水。</p></section><section className="admin-simple-card"><h3>已建立赛事</h3><div className="admin-simple-table">{events.map((event) => <div className="admin-simple-row" key={event.id}><div><b>第 {event.stationNo} 站</b><br/><small>{event.shortTitle}</small></div><span>{event.city}</span><span>{eventStatusLabel(event.status)}</span></div>)}</div></section></main>;
}
