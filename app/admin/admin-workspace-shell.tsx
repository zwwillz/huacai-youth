"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReactNode, useState } from "react";
import { eventStatusLabel, eventStatusTone } from "./admin-status";

export type AdminWorkspaceEvent = { id: string; shortTitle: string; stationNo: number; status: string; startDate: string; endDate: string };
type ActiveSection = "dashboard" | "events" | "content" | "registrations" | "players" | "competition" | "rankings" | "accounts" | "logs";
export type CompetitionTool = "overview" | "schedule" | "scoring" | "qualification" | "ranking";
type Props = { viewer: { displayName: string; role: string; roleLabel?: string }; events: AdminWorkspaceEvent[]; active: ActiveSection; pageTitle: string; pageHint?: string; currentEventId?: string; eventScoped?: boolean; competitionTool?: CompetitionTool; children: ReactNode };

const navGroups: Array<{ label?: string; items: Array<{ id: ActiveSection; icon: string; title: string; hint: string }> }> = [
  { items: [{ id: "dashboard", icon: "首", title: "工作台", hint: "全局总览与待办" },{ id: "events", icon: "赛", title: "赛事管理", hint: "创建赛事与基础设置" }] },
  { label: "赛事运营", items: [{ id: "content", icon: "发", title: "内容发布", hint: "概览、规程与参赛提示" }] },
  { label: "竞赛", items: [{ id: "competition", icon: "执", title: "竞赛执行", hint: "抽签、赛程、比分与晋级" }] },
  { label: "球员", items: [{ id: "players", icon: "员", title: "球员管理", hint: "球员档案维护与查询" }] },
  { label: "系统", items: [{ id: "accounts", icon: "权", title: "账号与权限", hint: "账号、角色与赛事分配" },{ id: "logs", icon: "志", title: "操作日志", hint: "系统操作与审计记录" }] },
];
const competitionTools: Array<{ id: CompetitionTool; title: string; icon: string }> = [
  { id: "overview", title: "抽签与签表", icon: "签" },
  { id: "schedule", title: "赛程编排", icon: "程" },
  { id: "scoring", title: "比分录入", icon: "分" },
  { id: "qualification", title: "晋级", icon: "晋" },
  { id: "ranking", title: "最终排名", icon: "榜" },
];
function competitionToolHref(tool: CompetitionTool, eventId?: string) { const suffix = eventId ? `?event=${encodeURIComponent(eventId)}` : ""; if (tool === "schedule") return `/admin/competition/schedules${suffix}`; if (tool === "scoring") return `/admin/competition/scoring${suffix}`; if (tool === "qualification") return `/admin/competition/qualification${suffix}`; if (tool === "ranking") return `/admin/competition/final-ranking${suffix}`; return `/admin/competition${suffix}`; }
function sectionHref(id: ActiveSection, eventId?: string) { if (id === "dashboard") return "/admin"; if (id === "events") return "/admin/events"; if (id === "content") return eventId ? `/admin/content/${eventId}` : "/admin/content"; if (id === "competition") return competitionToolHref("overview", eventId); if (id === "players") return "/admin/players"; if (id === "registrations") return `/admin?section=registrations${eventId ? `&event=${encodeURIComponent(eventId)}` : ""}`; if (id === "rankings") return "/admin?section=rankings"; if (id === "accounts") return "/admin/accounts"; if (id === "logs") return "/admin/logs"; return "/admin"; }

export default function AdminWorkspaceShell({ viewer, events, active, pageTitle, pageHint, currentEventId, eventScoped = false, competitionTool = "overview", children }: Props) {
  const router = useRouter(); const [menuOpen, setMenuOpen] = useState(false); const currentEvent = events.find((event) => event.id === currentEventId);
  const visibleGroups = navGroups.map((group) => ({ ...group, items: group.items.filter((item) => { if (viewer.role === "system_admin") return true; if (viewer.role === "committee") return !["accounts", "logs"].includes(item.id); return ["dashboard", "competition"].includes(item.id); }) })).filter((group) => group.items.length > 0);
  const switchEvent = (eventId: string) => {
    if (!eventId) return;
    const target = active === "competition" ? competitionToolHref(competitionTool, eventId) : sectionHref(active, eventId);
    window.dispatchEvent(new CustomEvent("admin:navigation-start", { detail: { target, label: "所选赛事" } }));
    router.push(target);
  };
  return <main className="backend-shell admin-workspace-shell">
    {menuOpen && <button className="admin-sidebar-scrim" type="button" aria-label="关闭后台菜单" onClick={() => setMenuOpen(false)} />}
    <aside className={menuOpen ? "backend-sidebar admin-workspace-sidebar open" : "backend-sidebar admin-workspace-sidebar"}>
      <Link prefetch={false} href="/admin" className="backend-brand admin-workspace-brand"><span>华</span><div><strong>华彩赛事后台</strong><small>赛事运营与竞赛执行</small></div></Link>
      <nav className="admin-workspace-nav">{visibleGroups.map((group, groupIndex) => <div className="admin-nav-group" key={group.label || groupIndex}>{group.label && <small className="admin-nav-group-label">{group.label}</small>}{group.items.map((item) => <div className="admin-nav-item-wrap" key={item.id}><Link prefetch={false} href={sectionHref(item.id, currentEventId)} className={active === item.id ? "active" : ""} aria-current={active === item.id ? "page" : undefined} onClick={() => setMenuOpen(false)}><span>{item.icon}</span><div><strong>{item.title}</strong><small>{item.hint}</small></div></Link>{item.id === "competition" && <div className="admin-competition-subnav">{competitionTools.map((tool) => <Link prefetch={false} key={tool.id} href={competitionToolHref(tool.id, currentEventId)} className={active === "competition" && competitionTool === tool.id ? "active" : ""} aria-current={active === "competition" && competitionTool === tool.id ? "page" : undefined} onClick={() => setMenuOpen(false)}><span>{tool.icon}</span><strong>{tool.title}</strong></Link>)}</div>}</div>)}</div>)}</nav>
      <div className="backend-sidebar-foot"><Link prefetch={false} href="/" target="_blank" rel="noopener noreferrer">查看公众前端</Link><a href="/api/auth/logout">退出后台</a></div>
    </aside>
    <section className="backend-main admin-workspace-main"><header className="backend-topbar admin-workspace-topbar"><button className="backend-menu" type="button" aria-label={menuOpen ? "关闭后台菜单" : "打开后台菜单"} aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}>☰</button><div className="admin-workspace-title"><small>{pageHint || "后台管理"}</small><h1>{pageTitle}</h1></div>{eventScoped ? <label className="backend-event-select admin-workspace-event-select"><span>当前赛事</span><select value={currentEventId || ""} aria-label="切换当前赛事" onChange={(event) => switchEvent(event.target.value)}><option value="" disabled>请选择赛事</option>{events.map((event) => <option value={event.id} key={event.id}>第 {event.stationNo} 站 · {event.shortTitle} · {eventStatusLabel(event.status)}</option>)}</select>{currentEvent && <em><b className={eventStatusTone(currentEvent.status)}>{eventStatusLabel(currentEvent.status)}</b>{currentEvent.startDate} — {currentEvent.endDate}</em>}</label> : <div className="admin-workspace-global-context"><span>全局工作区</span><small>不受“当前赛事”切换影响</small></div>}<div className="backend-user"><span>{viewer.displayName.slice(0, 1)}</span><div><strong>{viewer.displayName}</strong><small>{viewer.roleLabel || (viewer.role === "system_admin" ? "系统管理员" : viewer.role === "committee" ? "组委会" : "裁判")}</small></div></div></header><div className="admin-workspace-content">{children}</div></section>
  </main>;
}
