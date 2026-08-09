"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { describeAdminRoute } from "./admin-route-state";

function Bars({ rows = 5 }: { rows?: number }) {
  return <div className="admin-progressive-rows">{Array.from({ length: rows }, (_, index) => <div className="admin-progressive-row" key={index}><i /><i /><i /><i /></div>)}</div>;
}

function Filters({ count = 4 }: { count?: number }) {
  return <div className="admin-progressive-filters">{Array.from({ length: count }, (_, index) => <i key={index} /> )}</div>;
}

export function AdminWorkspaceLoading({ pathname, search = "", optimistic = false }: { pathname: string; search?: string; optimistic?: boolean }) {
  const route = describeAdminRoute(pathname, search);
  const loadingLabel = optimistic ? "正在打开" : "正在读取";
  return <main className={`admin-progressive-loading kind-${route.loadingKind}`} aria-busy="true" aria-live="polite">
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
  if (pathname === "/admin/login") return <main className="backend-route-pending" aria-busy="true"><span>正在打开后台…</span></main>;
  return <AdminWorkspaceLoading pathname={pathname} search={search} />;
}
