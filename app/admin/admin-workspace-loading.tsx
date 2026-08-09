"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { describeAdminRoute, isAdminShelllessRoute, type AdminRouteDescriptor } from "./admin-route-state";

type LoadingProps = { pathname: string; search?: string; overlay?: boolean };

type FrameTableProps = { columns: string[]; rows?: number };

function FrameHead({ route, action }: { route: AdminRouteDescriptor; action?: string }) {
  return <header className="admin-structure-head">
    <div><small>{route.pageHint}</small><h2>{route.pageTitle}</h2><p>页面结构已经打开，业务数据会在对应区域自动补齐。</p></div>
    {action ? <button type="button" disabled>{action}</button> : null}
  </header>;
}

function FrameTabs({ labels }: { labels: string[] }) {
  return <nav className="admin-structure-tabs" aria-label="页面分区">{labels.map((label) => <button type="button" disabled key={label}>{label}</button>)}</nav>;
}

function FrameMetrics({ labels }: { labels: string[] }) {
  return <section className="admin-structure-metrics">{labels.map((label) => <article key={label}><span>{label}</span><strong>—</strong><small>数据正在补齐</small></article>)}</section>;
}

function FrameTable({ columns, rows = 6 }: FrameTableProps) {
  const columnClass = columns.length >= 6 ? "cols-6" : columns.length === 5 ? "cols-5" : "cols-4";
  return <section className="admin-structure-table" aria-label="数据区域正在补齐">
    <div className={`admin-structure-row ${columnClass}`}>{columns.map((column) => <span key={column}>{column}</span>)}</div>
    {Array.from({ length: rows }, (_, index) => <div className={`admin-structure-row ${columnClass}`} key={index}>{columns.map((column, columnIndex) => <span key={`${column}-${columnIndex}`}>{columnIndex === 0 ? "数据正在读取…" : "—"}</span>)}</div>)}
  </section>;
}

function DashboardStructureFrame() {
  return <main className="admin-home" aria-busy="true" style={{ pointerEvents: "none" }}>
    <section className="admin-home-hero">
      <div><small>HUACAI EVENT ADMIN</small><h2>华彩赛事管理后台</h2><p>赛事工作区已经打开，实时统计会在对应位置自动补齐。</p></div>
      <Link href="/admin/events/new" tabIndex={-1}>＋ 创建新赛事</Link>
    </section>
    <section className="admin-home-metrics">
      {["可管理赛事", "进行中赛事", "待审核报名", "待发布内容"].map((label) => <article key={label}><span>{label}</span><strong>—</strong><small>数据正在补齐</small></article>)}
    </section>
    <section className="admin-home-grid">
      <article className="admin-home-panel">
        <header><div><small>MY EVENTS</small><h3>最近赛事</h3></div><Link href="/admin/events" tabIndex={-1}>查看全部赛事 →</Link></header>
        <div className="admin-simple-empty">赛事列表正在补齐，页面结构已经可以使用。</div>
      </article>
      <article className="admin-home-panel">
        <header><div><small>NEXT ACTION</small><h3>常用入口</h3></div></header>
        <div className="admin-home-links">
          <Link href="/admin/events" tabIndex={-1}><span>赛事管理</span><b>创建 / 设置 →</b></Link>
          <Link href="/admin/content" tabIndex={-1}><span>内容发布</span><b>概览 / 规程 →</b></Link>
          <Link href="/admin/competition" tabIndex={-1}><span>竞赛执行</span><b>查看当前待办 →</b></Link>
          <Link href="/admin/competition/scoring" tabIndex={-1}><span>比分录入</span><b>进入工作台 →</b></Link>
        </div>
      </article>
    </section>
  </main>;
}

function NewEventStructureFrame() {
  const year = new Date().getFullYear();
  return <main className="new-event-page" aria-busy="true" style={{ pointerEvents: "none" }}>
    <section className="new-event-head"><div><small>CREATE EVENT</small><h2>创建新赛事</h2><p>这里只建立一场赛事的基础主数据。建议年份与站次会在表单出现后自动补齐。</p></div><Link href="/admin/events" tabIndex={-1}>← 返回赛事列表</Link></section>
    <div className="new-event-form">
      <section className="new-event-main">
        <header><div><small>01 · BASIC INFORMATION</small><h3>赛事基础信息</h3></div><span className="new-event-suggestion loading">正在补充建议年份 / 站次</span></header>
        <div className="new-event-grid">
          <label className="wide"><span>完整赛事名称 *</span><input defaultValue={`${year}中国华彩十六球青少年系列赛`} readOnly /></label>
          <label className="wide"><span>前端显示简称 *</span><input defaultValue={`${year}华彩青少年系列赛新分站`} readOnly /></label>
          <label><span>赛季年份 *</span><input type="number" defaultValue={year} readOnly /></label>
          <label><span>第几站 *</span><input type="number" defaultValue={1} readOnly /></label>
          <label><span>城市 *</span><input placeholder="例如：山东济南" readOnly /></label>
          <label><span>比赛场馆</span><input placeholder="可先填写场馆名称，详细地址后补" readOnly /></label>
          <label><span>比赛开始日期 *</span><input type="date" readOnly /></label>
          <label><span>比赛结束日期 *</span><input type="date" readOnly /></label>
          <label><span>报名开始时间</span><input type="datetime-local" readOnly /></label>
          <label><span>报名截止时间</span><input type="datetime-local" readOnly /></label>
          <label><span>赛事状态</span><select defaultValue="draft" disabled><option value="draft">草稿</option></select></label>
          <label><span>前端发布</span><select defaultValue="draft" disabled><option value="draft">先保存草稿</option></select></label>
          <label className="wide"><span>赛事简介</span><textarea rows={4} placeholder="可先写一句简要说明，完整内容之后继续完善" readOnly /></label>
        </div>
      </section>
      <aside className="new-event-side"><small>创建后的系统动作</small><h3>先建立赛事，再进入本站工作区</h3><p>新赛事创建后，系统会自动准备基础结构，不需要重复创建后续模块。</p><ul><li>建立赛事主记录</li><li>自动建立少年组 U16</li><li>自动建立青年组 U20</li><li>建立概览 / 规程 / 文件发布模块</li><li>预留赛程 / 对阵 / 排名动态模块</li></ul><div className="new-event-actions"><button type="button" disabled>创建赛事并继续设置</button><Link href="/admin/events" tabIndex={-1}>取消创建</Link></div></aside>
    </div>
  </main>;
}

function EventsStructureFrame({ route }: { route: AdminRouteDescriptor }) {
  return <main className="admin-structure-frame" aria-busy="true">
    <FrameHead route={route} action="＋ 创建新赛事" />
    <FrameMetrics labels={["全部赛事", "报名中", "比赛中", "已结束"]} />
    <div className="admin-structure-actions"><button type="button" disabled>全部年份</button><button type="button" disabled>全部状态</button></div>
    <section className="admin-structure-cards">{["最近赛事", "赛事分站", "赛事分站", "赛事分站"].map((title, index) => <article key={`${title}-${index}`}><b>{title}</b><span>赛事名称、时间、场馆和发布状态正在补齐。</span></article>)}</section>
  </main>;
}

function EventEditorStructureFrame({ route }: { route: AdminRouteDescriptor }) {
  return <main className="admin-structure-frame" aria-busy="true">
    <FrameHead route={route} action="保存设置" />
    <FrameTabs labels={["基础信息", "场馆与组别", "组织与赞助", "后台成员"]} />
    <section className="admin-structure-editor">
      <article className="admin-structure-panel"><header><div><small>EVENT SETTINGS</small><h3>赛事基础设置</h3></div></header><div className="admin-structure-fields"><label className="wide"><span>赛事名称</span><input disabled /></label><label><span>赛季年份</span><input disabled /></label><label><span>站次</span><input disabled /></label><label><span>城市</span><input disabled /></label><label><span>比赛场馆</span><input disabled /></label><label><span>开始日期</span><input disabled /></label><label><span>结束日期</span><input disabled /></label><label className="wide"><span>赛事简介</span><textarea rows={4} disabled /></label></div></article>
      <aside className="admin-structure-panel"><header><div><small>STATUS</small><h3>发布与权限</h3></div></header><div className="admin-structure-status"><span>赛事状态读取中</span><span>发布状态读取中</span></div><p className="admin-structure-note">组别、组织机构、赞助商与后台成员会在对应区域补齐。</p></aside>
    </section>
  </main>;
}

function RegistrationStructureFrame({ route }: { route: AdminRouteDescriptor }) {
  return <main className="admin-structure-frame" aria-busy="true"><FrameHead route={route} /><div className="admin-structure-toolbar"><input disabled placeholder="搜索报名人 / 球员" /><select disabled><option>全部组别</option></select><select disabled><option>全部状态</option></select><select disabled><option>当前赛事</option></select></div><FrameMetrics labels={["报名总数", "待审核", "已通过", "已驳回"]} /><FrameTable columns={["球员", "组别", "报名时间", "审核状态", "操作"]} /></main>;
}

function ContentStructureFrame({ route }: { route: AdminRouteDescriptor }) {
  if (route.active === "registrations") return <RegistrationStructureFrame route={route} />;
  return <main className="admin-structure-frame" aria-busy="true">
    <FrameHead route={route} action="保存内容" />
    <FrameTabs labels={["赛事概览", "竞赛规程", "参赛提示", "文件与发布"]} />
    <section className="admin-structure-editor"><article className="admin-structure-panel"><header><div><small>CONTENT EDITOR</small><h3>内容编辑</h3></div></header><div className="admin-structure-fields"><label className="wide"><span>标题</span><input disabled /></label><label className="wide"><span>正文内容</span><textarea rows={8} disabled /></label><label><span>模块状态</span><select disabled><option>正在读取</option></select></label><label><span>前端发布</span><select disabled><option>正在读取</option></select></label></div></article><aside className="admin-structure-panel"><header><div><small>PUBLISH</small><h3>发布状态</h3></div></header><div className="admin-structure-status"><span>草稿状态</span><span>文件状态</span></div><p className="admin-structure-note">页面已经可以编辑，具体赛事内容和发布状态正在同步。</p></aside></section>
  </main>;
}

function PlayersStructureFrame({ route }: { route: AdminRouteDescriptor }) {
  return <main className="admin-structure-frame" aria-busy="true"><FrameHead route={route} action="＋ 新增球员" /><div className="admin-structure-toolbar"><input disabled placeholder="搜索姓名 / 编号 / 手机号" /><select disabled><option>全部范围</option></select><select disabled><option>全部组别</option></select><select disabled><option>第 1 页</option></select></div><FrameTable columns={["球员", "球员编号", "组别", "最近赛事", "状态", "操作"]} rows={7} /></main>;
}

function CompetitionOverviewStructureFrame({ route }: { route: AdminRouteDescriptor }) {
  return <main className="admin-structure-frame" aria-busy="true"><FrameHead route={route} /><FrameTabs labels={["少年组", "青年组"]} /><FrameMetrics labels={["资格赛", "正赛第一阶段", "正赛第二阶段", "已确认比赛"]} /><section className="admin-structure-cards">{["抽签与签表", "赛程编排", "比分录入", "晋级", "最终排名"].map((title) => <article key={title}><b>{title}</b><span>当前阶段状态与可执行操作正在补齐。</span></article>)}</section></main>;
}

function ScheduleStructureFrame({ route }: { route: AdminRouteDescriptor }) {
  return <main className="admin-structure-frame" aria-busy="true"><FrameHead route={route} action="发布赛程" /><FrameTabs labels={["少年组", "青年组"]} /><div className="admin-structure-actions"><button type="button" disabled>资格赛第一场</button><button type="button" disabled>资格赛第二场</button><button type="button" disabled>正赛第一阶段</button><button type="button" disabled>正赛第二阶段</button></div><FrameTable columns={["场次", "球员 / 对阵", "比赛时间", "台号", "状态", "操作"]} /></main>;
}

function ScoringStructureFrame({ route }: { route: AdminRouteDescriptor }) {
  return <main className="admin-structure-frame" aria-busy="true"><FrameHead route={route} /><FrameTabs labels={["少年组", "青年组"]} /><div className="admin-structure-toolbar"><select disabled><option>当前阶段</option></select><select disabled><option>比赛日期</option></select><select disabled><option>待处理比赛</option></select><select disabled><option>全部台号</option></select></div><FrameMetrics labels={["待录入", "待确认", "已确认", "当前比赛"]} /><FrameTable columns={["比赛", "比分", "时间", "台号", "状态", "操作"]} rows={7} /></main>;
}

function QualificationStructureFrame({ route }: { route: AdminRouteDescriptor }) {
  return <main className="admin-structure-frame" aria-busy="true"><FrameHead route={route} action="确认晋级" /><FrameTabs labels={["少年组", "青年组"]} /><div className="admin-structure-actions"><button type="button" disabled>资格赛第一场</button><button type="button" disabled>资格赛第二场</button><button type="button" disabled>正赛晋级</button></div><FrameMetrics labels={["参赛人数", "已确认比赛", "直接晋级", "待确认名额"]} /><FrameTable columns={["排名", "球员", "胜场", "局胜率", "净胜局", "晋级状态"]} rows={8} /></main>;
}

function RankingStructureFrame({ route }: { route: AdminRouteDescriptor }) {
  return <main className="admin-structure-frame" aria-busy="true"><FrameHead route={route} action={route.active === "rankings" ? "导出排名" : "确认 / 发布"} /><FrameTabs labels={route.active === "rankings" ? ["总积分", "分站排名", "少年组", "青年组"] : ["少年组", "青年组", "自动排名", "人工调整"]} /><FrameMetrics labels={["排名人数", "已确认", "已发布", "待处理"]} /><FrameTable columns={["名次", "球员", "组别", "赛事 / 成绩", "积分 / 奖金", "状态"]} rows={8} /></main>;
}

function SystemStructureFrame({ route }: { route: AdminRouteDescriptor }) {
  const accounts = route.active === "accounts";
  return <main className="admin-structure-frame" aria-busy="true"><FrameHead route={route} action={accounts ? "＋ 新增账号" : "导出日志"} />{accounts ? <><FrameMetrics labels={["系统管理员", "组委会", "裁判", "启用账号"]} /><div className="admin-structure-toolbar"><input disabled placeholder="搜索账号 / 姓名" /><select disabled><option>全部角色</option></select><select disabled><option>全部状态</option></select><select disabled><option>赛事权限</option></select></div><FrameTable columns={["账号", "姓名", "角色", "赛事权限", "状态", "操作"]} /></> : <><div className="admin-structure-toolbar"><input disabled placeholder="搜索操作人 / 操作内容" /><select disabled><option>全部模块</option></select><select disabled><option>全部操作人</option></select><select disabled><option>最近时间</option></select></div><FrameTable columns={["时间", "操作人", "模块", "操作内容", "结果"]} rows={8} /></>}</main>;
}

function GenericStructureFrame({ route }: { route: AdminRouteDescriptor }) {
  return <main className="admin-structure-frame" aria-busy="true"><FrameHead route={route} /><section className="admin-structure-panel"><p className="admin-structure-note">目标页面已经打开，当前模块数据正在补齐。</p></section></main>;
}

function StructureFirstFrame({ pathname, search, overlay }: { pathname: string; search: string; overlay: boolean }) {
  const route = describeAdminRoute(pathname, search);
  const params = new URLSearchParams(search);
  const dashboard = (pathname === "/admin" || pathname === "/admin/") && !params.get("section");
  let frame;
  if (dashboard) frame = <DashboardStructureFrame />;
  else if (pathname === "/admin/events/new") frame = <NewEventStructureFrame />;
  else if (route.loadingKind === "events") frame = <EventsStructureFrame route={route} />;
  else if (route.loadingKind === "event-editor") frame = <EventEditorStructureFrame route={route} />;
  else if (route.loadingKind === "content") frame = <ContentStructureFrame route={route} />;
  else if (route.loadingKind === "players") frame = <PlayersStructureFrame route={route} />;
  else if (route.loadingKind === "competition") frame = <CompetitionOverviewStructureFrame route={route} />;
  else if (route.loadingKind === "schedule") frame = <ScheduleStructureFrame route={route} />;
  else if (route.loadingKind === "scoring") frame = <ScoringStructureFrame route={route} />;
  else if (route.loadingKind === "qualification") frame = <QualificationStructureFrame route={route} />;
  else if (route.loadingKind === "ranking") frame = <RankingStructureFrame route={route} />;
  else if (route.loadingKind === "system") frame = <SystemStructureFrame route={route} />;
  else frame = <GenericStructureFrame route={route} />;
  return overlay ? <div className="admin-structure-overlay">{frame}</div> : frame;
}

export function AdminWorkspaceLoading({ pathname, search = "", overlay = false }: LoadingProps) {
  return <StructureFirstFrame pathname={pathname} search={search} overlay={overlay} />;
}

export default function AdminRouteLoading() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  if (pathname === "/admin/login" || isAdminShelllessRoute(pathname)) return null;
  return <AdminWorkspaceLoading pathname={pathname} search={search} />;
}
