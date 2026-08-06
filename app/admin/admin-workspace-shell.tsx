"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReactNode, useState } from "react";

export type AdminWorkspaceEvent = {
  id: string;
  shortTitle: string;
  stationNo: number;
  status: string;
  startDate: string;
  endDate: string;
};

type ActiveSection = "dashboard" | "events" | "content" | "registrations" | "players" | "competition" | "rankings" | "accounts";

type Props = {
  viewer: { displayName: string; role: string; roleLabel?: string };
  events: AdminWorkspaceEvent[];
  active: ActiveSection;
  pageTitle: string;
  pageHint?: string;
  currentEventId?: string;
  eventScoped?: boolean;
  children: ReactNode;
};

const navGroups: Array<{ label?: string; items: Array<{ id: ActiveSection; icon: string; title: string; hint: string }> }> = [
  { items: [
    { id: "dashboard", icon: "首", title: "工作台", hint: "全局总览与待办" },
    { id: "events", icon: "赛", title: "赛事管理", hint: "创建赛事与基础设置" },
  ] },
  { label: "赛事运营", items: [
    { id: "content", icon: "发", title: "内容发布", hint: "概览、规程与参赛提示" },
    { id: "registrations", icon: "审", title: "报名审核", hint: "本站报名与审核" },
    { id: "players", icon: "员", title: "球员管理", hint: "本站球员与球员总库" },
  ] },
  { label: "竞赛", items: [
    { id: "competition", icon: "执", title: "竞赛执行", hint: "抽签、赛程、比分" },
    { id: "rankings", icon: "榜", title: "排名积分", hint: "总积分与分站排名" },
  ] },
  { label: "系统", items: [
    { id: "accounts", icon: "权", title: "账号与日志", hint: "用户、权限与操作记录" },
  ] },
];

function sectionHref(id: ActiveSection, eventId?: string) {
  if (id === "dashboard") return "/admin";
  if (id === "events") return "/admin/events";
  if (id === "content") return eventId ? `/admin/content/${eventId}` : "/admin/content";
  if (id === "competition") return eventId ? `/admin/competition?event=${encodeURIComponent(eventId)}` : "/admin/competition";
  if (id === "registrations" || id === "players") return `/admin?section=${id}${eventId ? `&event=${encodeURIComponent(eventId)}` : ""}`;
  if (id === "rankings" || id === "accounts") return `/admin?section=${id}`;
  return "/admin";
}

export default function AdminWorkspaceShell({ viewer, events, active, pageTitle, pageHint, currentEventId, eventScoped = false, children }: Props) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const currentEvent = events.find((event) => event.id === currentEventId);

  const visibleGroups = navGroups.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (viewer.role === "system_admin") return true;
      if (viewer.role === "committee") return item.id !== "accounts";
      return ["dashboard", "players", "competition"].includes(item.id);
    }),
  })).filter((group) => group.items.length > 0);

  const switchEvent = (eventId: string) => {
    if (!eventId) return;
    router.push(sectionHref(active, eventId));
  };

  return <main className="backend-shell admin-workspace-shell">
    <aside className={menuOpen ? "backend-sidebar admin-workspace-sidebar open" : "backend-sidebar admin-workspace-sidebar"}>
      <Link href="/admin" className="backend-brand admin-workspace-brand"><span>华</span><div><strong>华彩赛事后台</strong><small>赛事运营与竞赛执行</small></div></Link>
      <nav className="admin-workspace-nav">{visibleGroups.map((group, groupIndex) => <div className="admin-nav-group" key={group.label || groupIndex}>
        {group.label && <small className="admin-nav-group-label">{group.label}</small>}
        {group.items.map((item) => <Link key={item.id} href={sectionHref(item.id, currentEventId)} className={active === item.id ? "active" : ""} onClick={() => setMenuOpen(false)}><span>{item.icon}</span><div><strong>{item.title}</strong><small>{item.hint}</small></div></Link>)}
      </div>)}</nav>
      <div className="backend-sidebar-foot"><Link href="/" target="_blank">查看公众前端</Link><a href="/api/auth/logout">退出后台</a></div>
    </aside>

    <section className="backend-main admin-workspace-main">
      <header className="backend-topbar admin-workspace-topbar">
        <button className="backend-menu" type="button" onClick={() => setMenuOpen((value) => !value)}>☰</button>
        <div className="admin-workspace-title"><small>{pageHint || "后台管理"}</small><h1>{pageTitle}</h1></div>
        {eventScoped ? <label className="backend-event-select admin-workspace-event-select"><span>当前赛事</span><select value={currentEventId || ""} onChange={(event) => switchEvent(event.target.value)}><option value="" disabled>请选择赛事</option>{events.map((event) => <option value={event.id} key={event.id}>第 {event.stationNo} 站 · {event.shortTitle}</option>)}</select>{currentEvent && <em>{currentEvent.startDate} — {currentEvent.endDate}</em>}</label> : <div className="admin-workspace-global-context"><span>全局工作区</span><small>不受“当前赛事”切换影响</small></div>}
        <div className="backend-user"><span>{viewer.displayName.slice(0, 1)}</span><div><strong>{viewer.displayName}</strong><small>{viewer.roleLabel || (viewer.role === "system_admin" ? "系统管理员" : viewer.role === "committee" ? "组委会" : "裁判")}</small></div></div>
      </header>
      <div className="admin-workspace-content">{children}</div>
    </section>
  </main>;
}
