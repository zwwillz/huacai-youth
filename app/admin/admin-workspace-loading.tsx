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

function DashboardStructureFrame() {
  return <main className="admin-home admin-structure-first-frame" aria-busy="true">
    <section className="admin-home-hero">
      <div><small>HUACAI EVENT ADMIN</small><h2>华彩赛事管理后台</h2><p>赛事工作区已经打开，实时统计会在对应位置自动补齐。</p></div>
      <span className="admin-structure-action">＋ 创建新赛事</span>
    </section>
    <section className="admin-home-metrics">
      {["可管理赛事", "进行中赛事", "待审核报名", "待发布内容"].map((label) => <article key={label}><span>{label}</span><strong className="admin-home-metric-value">—</strong><small>数据正在补齐</small></article>)}
    </section>
    <section className="admin-home-grid">
      <article className="admin-home-panel">
        <header><div><small>MY EVENTS</small><h3>最近赛事</h3></div></header>
        <div className="admin-simple-empty">赛事列表正在补齐，页面结构已经可以使用。</div>
      </article>
      <article className="admin-home-panel">
        <header><div><small>NEXT ACTION</small><h3>常用入口</h3></div></header>
        <div className="admin-home-links admin-structure-links">
          <span><b>赛事管理</b><em>创建 / 设置 →</em></span>
          <span><b>内容发布</b><em>概览 / 规程 →</em></span>
          <span><b>竞赛执行</b><em>查看当前待办 →</em></span>
          <span><b>比分录入</b><em>进入工作台 →</em></span>
        </div>
      </article>
    </section>
  </main>;
}

function NewEventStructureFrame() {
  const year = new Date().getFullYear();
  return <main className="new-event-page admin-structure-first-frame" aria-busy="true">
    <section className="new-event-head"><div><small>CREATE EVENT</small><h2>创建新赛事</h2><p>先填写一场赛事的基础主数据，建议年份与站次会在页面内自动补齐。</p></div><span>← 返回赛事列表</span></section>
    <div className="new-event-form">
      <section className="new-event-main">
        <header><div><small>01 · BASIC INFORMATION</small><h3>赛事基础信息</h3></div><span className="new-event-suggestion loading">正在补充建议年份 / 站次</span></header>
        <div className="new-event-grid">
          <label className="wide"><span>完整赛事名称 *</span><input defaultValue={`${year}中国华彩十六球青少年系列赛`} disabled /></label>
          <label className="wide"><span>前端显示简称 *</span><input defaultValue={`${year}华彩青少年系列赛新分站`} disabled /></label>
          <label><span>赛季年份 *</span><input type="number" defaultValue={year} disabled /></label>
          <label><span>第几站 *</span><input type="number" defaultValue={1} disabled /></label>
          <label><span>城市 *</span><input placeholder="例如：山东济南" disabled /></label>
          <label><span>比赛场馆</span><input placeholder="可先填写场馆名称，详细地址后补" disabled /></label>
          <label><span>比赛开始日期 *</span><input type="date" disabled /></label>
          <label><span>比赛结束日期 *</span><input type="date" disabled /></label>
          <label><span>报名开始时间</span><input type="datetime-local" disabled /></label>
          <label><span>报名截止时间</span><input type="datetime-local" disabled /></label>
          <label><span>赛事状态</span><select defaultValue="draft" disabled><option value="draft">草稿</option></select></label>
          <label><span>前端发布</span><select defaultValue="draft" disabled><option value="draft">先保存草稿</option></select></label>
          <label className="wide"><span>赛事简介</span><textarea rows={4} placeholder="可先写一句简要说明" disabled /></label>
        </div>
      </section>
      <aside className="new-event-side"><small>创建后的系统动作</small><h3>先建立赛事，再进入本站工作区</h3><p>新赛事创建后，系统会自动准备基础结构，不需要重复创建后续模块。</p><ul><li>建立赛事主记录</li><li>自动建立少年组 U16</li><li>自动建立青年组 U20</li><li>建立概览 / 规程 / 文件发布模块</li><li>预留赛程 / 对阵 / 排名动态模块</li></ul><div className="new-event-actions"><button type="button" disabled>创建赛事并继续设置</button><span>取消创建</span></div></aside>
    </div>
  </main>;
}

function StructureFirstFrame({ pathname, search }: { pathname: string; search: string }) {
  const params = new URLSearchParams(search);
  const dashboard = (pathname === "/admin" || pathname === "/admin/") && !params.get("section");
  if (dashboard) return <DashboardStructureFrame />;
  if (pathname === "/admin/events/new") return <NewEventStructureFrame />;
  return null;
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

  if (!Number.isFinite(delay)) return <StructureFirstFrame pathname={pathname} search={search} />;

  const style = delayed
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
  if (pathname === "/admin/login" || isAdminShelllessRoute(pathname)) return null;
  return <AdminWorkspaceLoading pathname={pathname} search={search} delayed />;
}
