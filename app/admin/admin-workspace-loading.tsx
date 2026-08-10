"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { isAdminShelllessRoute } from "./admin-route-state";
import CompetitionOverviewView, { makeCompetitionOverviewLoadingModel } from "./competition/competition-overview-view";
import ScheduleIndexView, { makeScheduleIndexLoadingModel } from "./competition/schedules/schedule-index-view";
import ScoringWorkspaceView, { scoringPhases } from "./competition/scoring/scoring-workspace-view";
import { DrawLoadingView, FinalRankingLoadingView, QualificationLoadingView } from "./competition/competition-loading-views";
import { BracketLoadingView, ScheduleWorkbenchLoadingView } from "./competition/competition-deep-loading-views";
import { AccountsLoadingView, ContentLoadingView, EventSettingsLoadingView, EventsLoadingView, LogsLoadingView, PlayersLoadingView, PointsLoadingView } from "./admin-real-loading-views";
import { ContentIndexLoadingView, GlobalRankingsLoadingView, GuidesLoadingView, RegistrationsLoadingView, SchedulePublishLoadingView } from "./admin-secondary-loading-views";

type LoadingProps = { pathname: string; search?: string; overlay?: boolean; viewerRole?: string };

function DashboardLoadingView() {
  return <main className="admin-home" aria-busy="true" style={{ pointerEvents: "none" }}>
    <section className="admin-home-hero"><div><small>HUACAI EVENT ADMIN</small><h2>华彩赛事管理后台</h2><p>赛事工作区已经打开，实时统计会在对应位置自动补齐。</p></div><Link href="/admin/events/new" tabIndex={-1}>＋ 创建新赛事</Link></section>
    <section className="admin-home-metrics">{["可管理赛事", "进行中赛事", "待审核报名", "待发布内容"].map((label) => <article key={label}><span>{label}</span><strong>—</strong><small>数据正在补齐</small></article>)}</section>
    <section className="admin-home-grid"><article className="admin-home-panel"><header><div><small>MY EVENTS</small><h3>最近赛事</h3></div><Link href="/admin/events" tabIndex={-1}>查看全部赛事 →</Link></header><div className="admin-simple-empty">赛事列表正在补齐，页面结构已经可以使用。</div></article><article className="admin-home-panel"><header><div><small>NEXT ACTION</small><h3>常用入口</h3></div></header><div className="admin-home-links"><Link href="/admin/events" tabIndex={-1}><span>赛事管理</span><b>创建 / 设置 →</b></Link><Link href="/admin/content" tabIndex={-1}><span>内容发布</span><b>概览 / 规程 →</b></Link><Link href="/admin/competition" tabIndex={-1}><span>竞赛执行</span><b>查看当前待办 →</b></Link><Link href="/admin/competition/scoring" tabIndex={-1}><span>比分录入</span><b>进入工作台 →</b></Link></div></article></section>
  </main>;
}

function NewEventLoadingView() {
  const year = new Date().getFullYear();
  return <main className="new-event-page" aria-busy="true" style={{ pointerEvents: "none" }}>
    <section className="new-event-head"><div><small>CREATE EVENT</small><h2>创建新赛事</h2><p>这里只建立一场赛事的基础主数据。建议年份与站次会在表单出现后自动补齐。</p></div><Link href="/admin/events" tabIndex={-1}>← 返回赛事列表</Link></section>
    <div className="new-event-form"><section className="new-event-main"><header><div><small>01 · BASIC INFORMATION</small><h3>赛事基础信息</h3></div><span className="new-event-suggestion loading">正在补充建议年份 / 站次</span></header><div className="new-event-grid"><label className="wide"><span>完整赛事名称 *</span><input defaultValue={`${year}中国华彩十六球青少年系列赛`} readOnly /></label><label className="wide"><span>前端显示简称 *</span><input defaultValue={`${year}华彩青少年系列赛新分站`} readOnly /></label><label><span>赛季年份 *</span><input type="number" defaultValue={year} readOnly /></label><label><span>第几站 *</span><input type="number" defaultValue={1} readOnly /></label><label><span>城市 *</span><input placeholder="例如：山东济南" readOnly /></label><label><span>比赛场馆</span><input placeholder="可先填写场馆名称，详细地址后补" readOnly /></label><label><span>比赛开始日期 *</span><input type="date" readOnly /></label><label><span>比赛结束日期 *</span><input type="date" readOnly /></label><label><span>报名开始时间</span><input type="datetime-local" readOnly /></label><label><span>报名截止时间</span><input type="datetime-local" readOnly /></label><label><span>赛事状态</span><select defaultValue="draft" disabled><option value="draft">草稿</option></select></label><label><span>前端发布</span><select defaultValue="draft" disabled><option value="draft">先保存草稿</option></select></label><label className="wide"><span>赛事简介</span><textarea rows={4} placeholder="可先写一句简要说明，完整内容之后继续完善" readOnly /></label></div></section><aside className="new-event-side"><small>创建后的系统动作</small><h3>先建立赛事，再进入本站工作区</h3><p>新赛事创建后，系统会自动准备基础结构，不需要重复创建后续模块。</p><ul><li>建立赛事主记录</li><li>自动建立少年组 U16</li><li>自动建立青年组 U20</li><li>建立概览 / 规程 / 文件发布模块</li><li>预留赛程 / 对阵 / 排名动态模块</li></ul><div className="new-event-actions"><button type="button" disabled>创建赛事并继续设置</button><Link href="/admin/events" tabIndex={-1}>取消创建</Link></div></aside></div>
  </main>;
}

function UnknownAdminLoadingView() {
  return <main className="admin-simple-page" aria-busy="true"><section className="admin-simple-head"><small>ADMIN WORKSPACE</small><h2>后台工作区</h2><p>页面结构正在打开，当前模块数据随后补齐。</p></section><section className="admin-simple-card"><div className="admin-simple-empty">当前页面正在读取。</div></section></main>;
}

function RealPageLoading({ pathname, search, viewerRole = "committee" }: { pathname: string; search: string; viewerRole?: string }) {
  const params = new URLSearchParams(search);
  const segments = pathname.split("/").filter(Boolean);
  const eventId = params.get("event") || "";
  const groupId = params.get("group") || "u16";
  const phase = params.get("phase") || "qualifier-one";
  const sessionId = params.get("session") || "";
  const section = params.get("section") || "";

  if ((pathname === "/admin" || pathname === "/admin/") && !section) return <DashboardLoadingView />;
  if ((pathname === "/admin" || pathname === "/admin/") && section === "registrations") return <RegistrationsLoadingView />;
  if ((pathname === "/admin" || pathname === "/admin/") && section === "rankings") return <GlobalRankingsLoadingView />;
  if (pathname === "/admin/events/new") return <NewEventLoadingView />;
  if (pathname === "/admin/events" || pathname === "/admin/events/") return <EventsLoadingView canDelete={viewerRole === "system_admin"} />;
  if (pathname.startsWith("/admin/events/") && segments[2]) return <EventSettingsLoadingView eventId={decodeURIComponent(segments[2])} />;
  if (pathname === "/admin/content" || pathname === "/admin/content/") return <ContentIndexLoadingView />;
  if (pathname.startsWith("/admin/content/") && segments[2] && segments[3] === "guides") return <GuidesLoadingView eventId={decodeURIComponent(segments[2])} />;
  if (pathname.startsWith("/admin/content/") && segments[2]) return <ContentLoadingView eventId={decodeURIComponent(segments[2])} />;
  if (pathname.startsWith("/admin/schedule-publish")) return <SchedulePublishLoadingView />;
  if (pathname.startsWith("/admin/players")) return <PlayersLoadingView viewerRole={viewerRole} eventId={eventId} />;
  if (pathname.startsWith("/admin/points")) return <PointsLoadingView viewerRole={viewerRole} eventId={eventId} />;
  if (pathname === "/admin/competition" || pathname === "/admin/competition/") return <CompetitionOverviewView model={makeCompetitionOverviewLoadingModel(eventId, groupId)} />;
  if (pathname === "/admin/competition/schedule" || pathname === "/admin/competition/schedule/") return <ScheduleWorkbenchLoadingView sessionId={sessionId} />;
  if (pathname === "/admin/competition/bracket" || pathname === "/admin/competition/bracket/") return <BracketLoadingView sessionId={sessionId} eventId={eventId} />;
  if (pathname.startsWith("/admin/competition/draw") && !pathname.includes("/screen")) return <DrawLoadingView eventId={eventId} groupId={groupId} phase={phase} />;
  if (pathname.startsWith("/admin/competition/schedules")) return <ScheduleIndexView model={makeScheduleIndexLoadingModel(eventId, groupId, phase)} />;
  if (pathname.startsWith("/admin/competition/scoring")) return <ScoringWorkspaceView data={null} context={null} selectedGroupId={groupId} selectedPhase={phase} phaseOptions={scoringPhases.map((item) => ({ ...item, hint: "数据读取中" }))} drafts={{}} query="" busyId="" message="" loading publicationDirty={false} />;
  if (pathname.startsWith("/admin/competition/qualification")) return <QualificationLoadingView eventId={eventId} groupId={groupId} phase={phase} />;
  if (pathname.startsWith("/admin/competition/final-ranking")) return <FinalRankingLoadingView eventId={eventId} groupId={groupId} />;
  if (pathname.startsWith("/admin/accounts")) return <AccountsLoadingView />;
  if (pathname.startsWith("/admin/logs")) return <LogsLoadingView />;
  return <UnknownAdminLoadingView />;
}

export function AdminWorkspaceLoading({ pathname, search = "", overlay = false, viewerRole = "committee" }: LoadingProps) {
  const page = <RealPageLoading pathname={pathname} search={search} viewerRole={viewerRole} />;
  return overlay ? <div className="admin-structure-overlay">{page}</div> : page;
}

export default function AdminRouteLoading() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  if (pathname === "/admin/login" || isAdminShelllessRoute(pathname)) return null;
  return <AdminWorkspaceLoading pathname={pathname} search={search} />;
}
