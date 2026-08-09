"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { eventStatusLabel, eventStatusTone } from "./admin-status";
import { AdminWorkspaceLoading } from "./admin-workspace-loading";
import {
  adminRouteKey,
  describeAdminRoute,
  type AdminActiveSection,
  type AdminCompetitionTool,
  type AdminEventSwitchMode,
} from "./admin-route-state";

export type AdminWorkspaceEvent = { id: string; shortTitle: string; stationNo: number; status: string; startDate: string; endDate: string };
type ActiveSection = AdminActiveSection;
export type CompetitionTool = AdminCompetitionTool;
type EventSwitchMode = AdminEventSwitchMode;
type Props = { viewer: { displayName: string; role: string; roleLabel?: string }; events: AdminWorkspaceEvent[]; active: ActiveSection; pageTitle: string; pageHint?: string; currentEventId?: string; eventScoped?: boolean; competitionTool?: CompetitionTool; eventSwitchMode?: EventSwitchMode; children: ReactNode };

type RegisteredPage = {
  routeKey: string;
  active: ActiveSection;
  pageTitle: string;
  pageHint: string;
  currentEventId: string;
  eventScoped: boolean;
  competitionTool: CompetitionTool;
  eventSwitchMode: EventSwitchMode;
  events: AdminWorkspaceEvent[];
};
type PersistentShellContextValue = { registerPage: (page: RegisteredPage) => void };
const PersistentShellContext = createContext<PersistentShellContextValue | null>(null);

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

function PageMetadataBridge(props: Props & { bridge: PersistentShellContextValue }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const routeKey = adminRouteKey(pathname, search);
  const { bridge } = props;
  useEffect(() => {
    bridge.registerPage({
      routeKey,
      active: props.active,
      pageTitle: props.pageTitle,
      pageHint: props.pageHint || "后台管理",
      currentEventId: props.currentEventId || "",
      eventScoped: Boolean(props.eventScoped),
      competitionTool: props.competitionTool || "overview",
      eventSwitchMode: props.eventSwitchMode || "route",
      events: props.events,
    });
  }, [bridge, routeKey, props.active, props.pageTitle, props.pageHint, props.currentEventId, props.eventScoped, props.competitionTool, props.eventSwitchMode, props.events]);
  return <>{props.children}</>;
}

export default function AdminWorkspaceShell(props: Props) {
  const bridge = useContext(PersistentShellContext);
  if (bridge) return <PageMetadataBridge {...props} bridge={bridge} />;
  return <PersistentWorkspaceRoot {...props} />;
}

function PersistentWorkspaceRoot(props: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const currentKey = adminRouteKey(pathname, search);
  const routeDescriptor = useMemo(() => describeAdminRoute(pathname, search), [pathname, search]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [events, setEvents] = useState<AdminWorkspaceEvent[]>(props.events);
  const [registeredPage, setRegisteredPage] = useState<RegisteredPage | null>(null);
  const [localEventId, setLocalEventId] = useState(props.currentEventId || routeDescriptor.currentEventId || "");
  const [pending, setPending] = useState<null | { origin: string; targetKey: string; pathname: string; search: string; label: string }>(null);

  const registerPage = useCallback((page: RegisteredPage) => {
    setRegisteredPage(page);
    setEvents(page.events);
  }, []);
  const bridgeValue = useMemo(() => ({ registerPage }), [registerPage]);

  const registeredCurrent = registeredPage?.routeKey === currentKey ? registeredPage : null;
  const currentMeta = registeredCurrent ? {
    ...routeDescriptor,
    active: registeredCurrent.active,
    pageTitle: registeredCurrent.pageTitle,
    pageHint: registeredCurrent.pageHint,
    currentEventId: registeredCurrent.currentEventId || routeDescriptor.currentEventId,
    eventScoped: registeredCurrent.eventScoped,
    competitionTool: registeredCurrent.competitionTool,
    eventSwitchMode: registeredCurrent.eventSwitchMode,
  } : routeDescriptor;
  const pendingMeta = pending ? describeAdminRoute(pending.pathname, pending.search) : null;
  const visualMeta = pendingMeta || currentMeta;

  useEffect(() => {
    if (pending?.targetKey === currentKey) setPending(null);
  }, [currentKey, pending]);

  useEffect(() => {
    if (pending) return;
    setLocalEventId(currentMeta.currentEventId || "");
  }, [currentKey, currentMeta.currentEventId, currentMeta.eventSwitchMode, pending]);

  useEffect(() => {
    if (!pending) return;
    const targetKey = pending.targetKey;
    const timer = window.setTimeout(() => setPending((current) => current?.targetKey === targetKey ? null : current), 15000);
    return () => window.clearTimeout(timer);
  }, [pending]);

  const beginNavigation = useCallback((target: string, label = "后台页面") => {
    const url = new URL(target, window.location.href);
    if (url.origin !== window.location.origin || !url.pathname.startsWith("/admin") || url.pathname === "/admin/login") return;
    const targetSearch = url.searchParams.toString();
    const targetKey = adminRouteKey(url.pathname, targetSearch);
    if (targetKey === currentKey) return;
    setPending({ origin: currentKey, targetKey, pathname: url.pathname, search: targetSearch, label });
    setMenuOpen(false);
  }, [currentKey]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest("a");
      if (!anchor || anchor.target || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || !url.pathname.startsWith("/admin")) return;
      beginNavigation(url.toString(), anchor.textContent?.replace(/\s+/g, " ").trim().slice(0, 28) || "后台页面");
    };
    const onProgrammaticNavigation = (event: Event) => {
      const detail = (event as CustomEvent<{ target?: string; label?: string }>).detail;
      if (detail?.target) beginNavigation(detail.target, detail.label || "后台页面");
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("admin:navigation-start", onProgrammaticNavigation);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("admin:navigation-start", onProgrammaticNavigation);
    };
  }, [beginNavigation]);

  useEffect(() => {
    const revert = (event: Event) => {
      const detail = (event as CustomEvent<{ eventId?: string }>).detail;
      if (detail?.eventId) setLocalEventId(detail.eventId);
    };
    window.addEventListener("admin:event-switch-revert", revert);
    return () => window.removeEventListener("admin:event-switch-revert", revert);
  }, []);

  const effectiveEventId = currentMeta.eventSwitchMode === "local"
    ? (localEventId || currentMeta.currentEventId || "")
    : (visualMeta.currentEventId || currentMeta.currentEventId || "");
  const currentEvent = events.find((event) => event.id === effectiveEventId);
  const visibleGroups = navGroups.map((group) => ({ ...group, items: group.items.filter((item) => { if (props.viewer.role === "system_admin") return true; if (props.viewer.role === "committee") return !["accounts", "logs"].includes(item.id); return ["dashboard", "competition"].includes(item.id); }) })).filter((group) => group.items.length > 0);

  const switchEvent = (eventId: string) => {
    if (!eventId || eventId === effectiveEventId || pending) return;
    if (currentMeta.eventSwitchMode === "local") {
      const previousEventId = effectiveEventId;
      setLocalEventId(eventId);
      window.dispatchEvent(new CustomEvent("admin:event-switch", { detail: { eventId, previousEventId, active: currentMeta.active, competitionTool: currentMeta.competitionTool } }));
      return;
    }
    const target = currentMeta.active === "competition" ? competitionToolHref(currentMeta.competitionTool, eventId) : sectionHref(currentMeta.active, eventId);
    beginNavigation(target, "所选赛事");
    router.push(target);
  };

  return <PersistentShellContext.Provider value={bridgeValue}>
    <main className="backend-shell admin-workspace-shell">
      {pending && <div className="admin-navigation-feedback immediate" role="status" aria-live="polite" aria-label={`正在打开${pending.label}`}><span className="admin-navigation-progress" /></div>}
      {menuOpen && <button className="admin-sidebar-scrim" type="button" aria-label="关闭后台菜单" onClick={() => setMenuOpen(false)} />}
      <aside className={menuOpen ? "backend-sidebar admin-workspace-sidebar open" : "backend-sidebar admin-workspace-sidebar"}>
        <Link prefetch={false} href="/admin" className="backend-brand admin-workspace-brand"><span>华</span><div><strong>华彩赛事后台</strong><small>赛事运营与竞赛执行</small></div></Link>
        <nav className="admin-workspace-nav">{visibleGroups.map((group, groupIndex) => <div className="admin-nav-group" key={group.label || groupIndex}>{group.label && <small className="admin-nav-group-label">{group.label}</small>}{group.items.map((item) => <div className="admin-nav-item-wrap" key={item.id}><Link prefetch={false} href={sectionHref(item.id, effectiveEventId)} className={visualMeta.active === item.id ? "active" : ""} aria-current={visualMeta.active === item.id ? "page" : undefined} onClick={() => setMenuOpen(false)}><span>{item.icon}</span><div><strong>{item.title}</strong><small>{item.hint}</small></div></Link>{item.id === "competition" && <div className="admin-competition-subnav">{competitionTools.map((tool) => <Link prefetch={false} key={tool.id} href={competitionToolHref(tool.id, effectiveEventId)} className={visualMeta.active === "competition" && visualMeta.competitionTool === tool.id ? "active" : ""} aria-current={visualMeta.active === "competition" && visualMeta.competitionTool === tool.id ? "page" : undefined} onClick={() => setMenuOpen(false)}><span>{tool.icon}</span><strong>{tool.title}</strong></Link>)}</div>}</div>)}</div>)}</nav>
        <div className="backend-sidebar-foot"><Link prefetch={false} href="/" target="_blank" rel="noopener noreferrer">查看公众前端</Link><a href="/api/auth/logout">退出后台</a></div>
      </aside>
      <section className="backend-main admin-workspace-main"><header className="backend-topbar admin-workspace-topbar"><button className="backend-menu" type="button" aria-label={menuOpen ? "关闭后台菜单" : "打开后台菜单"} aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}>☰</button><div className="admin-workspace-title"><small>{visualMeta.pageHint || "后台管理"}</small><h1>{visualMeta.pageTitle}</h1></div>{visualMeta.eventScoped ? <label className="backend-event-select admin-workspace-event-select"><span>当前赛事</span><select value={effectiveEventId} aria-label="切换当前赛事" disabled={Boolean(pending)} onChange={(event) => switchEvent(event.target.value)}><option value="" disabled>请选择赛事</option>{effectiveEventId && !currentEvent && <option value={effectiveEventId}>正在读取所选赛事…</option>}{events.map((event) => <option value={event.id} key={event.id}>第 {event.stationNo} 站 · {event.shortTitle} · {eventStatusLabel(event.status)}</option>)}</select>{currentEvent && <em><b className={eventStatusTone(currentEvent.status)}>{eventStatusLabel(currentEvent.status)}</b>{currentEvent.startDate} — {currentEvent.endDate}</em>}</label> : <div className="admin-workspace-global-context"><span>全局工作区</span><small>不受“当前赛事”切换影响</small></div>}<div className="backend-user"><span>{props.viewer.displayName.slice(0, 1)}</span><div><strong>{props.viewer.displayName}</strong><small>{props.viewer.roleLabel || (props.viewer.role === "system_admin" ? "系统管理员" : props.viewer.role === "committee" ? "组委会" : "裁判")}</small></div></div></header>
        <div className="admin-workspace-content">
          <div className={pending ? "admin-workspace-live is-pending" : "admin-workspace-live"}>{props.children}</div>
          {pending && <AdminWorkspaceLoading pathname={pending.pathname} search={pending.search} optimistic />}
        </div>
      </section>
    </main>
  </PersistentShellContext.Provider>;
}
