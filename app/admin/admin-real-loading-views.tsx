"use client";

import type { EventManagementData } from "@/db/event-management";
import EventManagementClient from "./events/event-management-client";
import EventSettingsIndexView from "./events/event-settings-index-view";
import type { AccountManagementRow } from "@/db/account-management";
import AccountManagementClient from "./accounts/account-management-client";

function placeholderEvent(eventId: string): EventManagementData {
  return {
    viewerRole: "committee", publicationStatuses: {}, assignableAccounts: [],
    event: {
      id: eventId, year: 2026, stationNo: 0, fullTitle: "赛事资料正在读取", shortTitle: "当前赛事", slug: "", city: "城市读取中", startDate: "", endDate: "", registrationStartAt: "", registrationEndAt: "", coverImageKey: "", summary: "", status: "draft", publishStatus: "draft",
      venue: { id: null, name: "", province: "", city: "", district: "", address: "", tableCount: 0 },
      details: { sponsorLabel: "", durationLabel: "", qualifierDateLabel: "", mainDateLabel: "", totalPrizeLabel: "", mainSizeLabel: "", minimumAgeNote: "", signupNote: "" },
      sponsors: [], organizations: { host: "", support: "", operator: "", cooperator: "" }, groups: [], memberIds: [],
    },
  };
}

function SimpleWorkspaceLoading({ kicker, title, description, rows = 6 }: { kicker: string; title: string; description: string; rows?: number }) {
  return <main className="admin-simple-page" aria-busy="true" style={{ pointerEvents: "none" }}>
    <section className="admin-simple-head"><small>{kicker}</small><h2>{title}</h2><p>{description}</p></section>
    <section className="admin-simple-card">
      <div className="content-loading-lines"><i /><i /><i /></div>
      <div className="admin-simple-table">{Array.from({ length: rows }, (_, index) => <div className="admin-simple-row" key={index}><div><b>数据正在读取</b><br/><small>页面结构已经打开</small></div><span>—</span><span>读取中</span></div>)}</div>
    </section>
  </main>;
}

export function EventsLoadingView({ canDelete = false }: { canDelete?: boolean }) {
  return <EventSettingsIndexView events={null} canDelete={canDelete} />;
}

export function EventSettingsLoadingView({ eventId = "" }: { eventId?: string }) {
  return <div aria-busy="true" style={{ pointerEvents: "none" }}><EventManagementClient initialData={placeholderEvent(eventId)} /></div>;
}

export function ContentLoadingView({ eventId = "" }: { eventId?: string }) {
  return <main className="content-workspace" aria-busy="true" style={{ pointerEvents: "none" }}>
    <div className="content-layout">
      <aside className="content-sidebar">
        <small>当前赛事</small><h1>赛事内容正在读取</h1><p>{eventId ? "正在同步当前赛事资料" : "正在进入内容发布"}</p>
        <dl className="content-side-status"><div><dt>赛事概览</dt><dd>读取中</dd></div><div><dt>竞赛规程</dt><dd>读取中</dd></div></dl>
        <div className="content-side-note"><strong>内容发布</strong><p>页面结构已经就绪，赛事资料读取完成后会直接填入赛事概览和竞赛规程。</p></div>
      </aside>
      <section className="content-main">
        <section className="content-head-card content-publishing-head"><div><small>CONTENT PUBLISHING</small><h2>内容发布</h2><p>赛事概览与竞赛规程正在读取。</p><div className="content-top-tabs"><button className="active" type="button">赛事概览</button><button type="button">竞赛规程</button></div></div><span className="draft">读取中</span></section>
        {[0,1,2].map((item) => <section className="content-card content-loading-card" key={item}><div className="content-loading-lines"><i /><i /><i /></div></section>)}
      </section>
    </div>
  </main>;
}

export function PlayersLoadingView({ eventId = "" }: { viewerRole?: string; eventId?: string }) {
  return <SimpleWorkspaceLoading kicker="PLAYER ARCHIVE" title="球员档案" description={eventId ? "当前赛事球员资料正在读取，筛选、档案和参赛信息会在原位置补齐。" : "球员档案正在读取，搜索、筛选和球员资料会在原位置补齐。"} rows={7} />;
}

export function PointsLoadingView({ eventId = "" }: { viewerRole?: string; eventId?: string }) {
  return <SimpleWorkspaceLoading kicker="POINTS RANKING" title="积分排名" description={eventId ? "当前赛事积分和排名正在读取。" : "系列赛积分排名、分站成绩和积分规则正在读取。"} rows={7} />;
}

export function AccountsLoadingView() {
  const accounts: AccountManagementRow[] = [
    { id: "loading-admin", username: "admin", displayName: "系统管理员", role: "system_admin", roleLabel: "系统管理员", status: "active", lastLoginAt: null, createdAt: "", assignedEvents: [] },
    { id: "loading-committee", username: "—", displayName: "组委会账号读取中", role: "committee", roleLabel: "组委会", status: "active", lastLoginAt: null, createdAt: "", assignedEvents: [] },
    { id: "loading-referee", username: "—", displayName: "裁判账号读取中", role: "referee", roleLabel: "裁判", status: "active", lastLoginAt: null, createdAt: "", assignedEvents: [] },
  ];
  return <div aria-busy="true" style={{ pointerEvents: "none" }}><AccountManagementClient initialAccounts={accounts} /></div>;
}

export function LogsLoadingView() {
  return <SimpleWorkspaceLoading kicker="OPERATION LOG" title="操作日志" description="后台操作记录正在读取，账号、模块、操作内容和时间会在列表中自动补齐。" rows={8} />;
}
