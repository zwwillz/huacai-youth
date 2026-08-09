"use client";

import type { CSSProperties } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { adminRouteLoadingDelayMs, describeAdminRoute, isAdminShelllessRoute } from "./admin-route-state";

function Bars({ rows = 5 }: { rows?: number }) {
  return <div className="admin-progressive-rows">{Array.from({ length: rows }, (_, index) => <div className="admin-progressive-row" key={index}><i /><i /><i /><i /></div>)}</div>;
}

function Filters({ count = 4 }: { count?: number }) {
  return <div className="admin-progressive-filters">{Array.from({ length: count }, (_, index) => <i key={index} /> )}</div>;
}

type LoadingProps = {
  pathname: string;
  search?: string;
  optimistic?: boolean;
  delayed?: boolean;
  overlay?: boolean;
};

export function AdminWorkspaceLoading({ pathname, search = "", optimistic = false, delayed = false, overlay = false }: LoadingProps) {
  const route = describeAdminRoute(pathname, search);
  const loadingLabel = optimistic ? "正在打开" : "正在读取";
  const delay = adminRouteLoadingDelayMs(pathname, search);
  const style = delayed && Number.isFinite(delay)
    ? ({ "--admin-loading-delay": `${delay}ms` } as CSSProperties)
    : undefined;
  const className = [
    "admin-progressive-loading",
    `kind-${route.loadingKind}`,
    delayed ? "is-delayed" : "",
    overlay ? "is-overlay" : "",
  ].filter(Boolean).join(" ");

  return <main className={className} style={style} aria-busy="true" aria-live="polite">
    <header className="admin-progressive-heading">
      <div><small>{route.pageHint}</small><h2>{route.pageTitle}</h2><p>{loadingLabel}工作区，页面框架已经就绪，数据会在原位置自动补齐。</p></div>
      <span><i />数据同步中</span>
    </header>

    {(route.loadingKind === "scoring" || route.loadingKind === "schedule" || route.loadingKind === "qualification" || route.loadingKind === "competition") && <>
      <Filters count={4} />
      <section className="admin-progressive-metrics"><article/><article/><article/><article/></section>
      <section className="admin-progressive-panel"><div className="admin-progressive-panel-head"><i/><i/></div><Bars rows={6}/></section>
    </>}

    {route.loadingKind === "players" && <>
      <section className="admin-progressive-toolbar"><i/><i/><i/></section>
      <section className="admin-progressive-panel"><div className="admin-progressive-panel-head"><i/><i/></div><Bars rows={7}/></section>
    </>}

    {(route.loadingKind === "events" || route.loadingKind === "dashboard") && <>
      <section className="admin-progressive-metrics"><article/><article/><article/><article/></section>
      <section className="admin-progressive-cards"><article/><article/><article/><article/></section>
    </>}

    {(route.loadingKind === "event-editor" || route.loadingKind === "content") && <>
      <section className="admin-progressive-editor"><div><i/><i/><i/><i/><i/></div><aside><i/><i/><i/></aside></section>
    </>}

    {route.loadingKind === "ranking" && <>
      <Filters count={3}/>
      <section className="admin-progressive-panel"><div className="admin-progressive-panel-head"><i/><i/></div><Bars rows={8}/></section>
    </>}

    {route.loadingKind === "system" && <section className="admin-progressive-panel"><div className="admin-progressive-panel-head"><i/><i/></div><Bars rows={7}/></section>}
  </main>;
}

export default function AdminRouteLoading() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  // Login and print are intentionally shellless. The login page is structure-first
  // and should never flash a white intermediate loading screen.
  if (pathname === "/admin/login" || isAdminShelllessRoute(pathname)) return null;
  return <AdminWorkspaceLoading pathname={pathname} search={search} delayed />;
}
