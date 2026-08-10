"use client";

import type { EventManagementData } from "@/db/event-management";
import EventManagementClient from "./events/event-management-client";
import EventSettingsIndexView from "./events/event-settings-index-view";
import type { AccountManagementRow } from "@/db/account-management";
import AccountManagementClient from "./accounts/account-management-client";
import OperationLogClient from "./logs/operation-log-client";
import PlayerManagementWorkspace from "./players/player-management-workspace";
import PointsRankingWorkspace from "./points/points-ranking-workspace";
import type { PlayerPointsPageData } from "@/db/player-points-fast";

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

export function PlayersLoadingView({ viewerRole = "committee", eventId = "" }: { viewerRole?: string; eventId?: string }) {
  const items = Array.from({ length: 6 }, (_, index) => ({
    id: `loading-${index}`, playerCode: "—", fullName: "球员读取中", displayName: "球员读取中", gender: null, phone: null,
    groupName: null, identityDisplay: "—", profileStatus: "pending",
  }));
  return <div aria-busy="true" style={{ pointerEvents: "none" }}><PlayerManagementWorkspace
    viewerRole={viewerRole}
    events={eventId ? [{ id: eventId, shortTitle: "当前赛事", stationNo: 0, status: "draft", startDate: "", endDate: "", city: "" }] : []}
    initialState={{ event: eventId, scope: viewerRole === "system_admin" && !eventId ? "all" : "event", group: "all", q: "", page: 1 }}
    initialPageData={{ items, filteredTotal: 0, page: 1, pageSize: 50, scope: viewerRole === "system_admin" && !eventId ? "all" : "event", eventId: eventId || null }}
  /></div>;
}

export function PointsLoadingView({ viewerRole = "committee", eventId = "" }: { viewerRole?: string; eventId?: string }) {
  const year = new Date().getFullYear();
  const overview = viewerRole === "system_admin" && !eventId;
  const pageData: PlayerPointsPageData = {
    items: Array.from({ length: 7 }, (_, index) => ({ id: `loading-${index}`, rank: index + 1, fullName: "球员读取中", displayName: "球员读取中", groupName: null, eventCount: 0, prizeCents: 0, points: 0 })),
    filteredTotal: 0,
    page: 1,
    pageSize: 40,
    year,
    scope: overview ? "all" : "event",
    eventId: overview ? null : eventId || null,
    rule: { year, participationPoints: 1, prizeUnitYuan: 100, prizePointsPerUnit: 1 },
  };
  const events = eventId ? [{ id: eventId, shortTitle: "当前赛事", stationNo: 0, status: "draft", startDate: "", endDate: "", city: "" }] : [];
  return <div aria-busy="true" style={{ pointerEvents: "none" }}><PointsRankingWorkspace
    viewerRole={viewerRole}
    events={events}
    initialState={{ event: eventId, scope: overview ? "all" : "event", group: "all", q: "", page: 1 }}
    initialPageData={pageData}
  /></div>;
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
  return <div aria-busy="true" style={{ pointerEvents: "none" }}><OperationLogClient initialLogs={[]} /></div>;
}
