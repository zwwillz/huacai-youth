"use client";

import type { ContentManagementData } from "@/db/content-management";
import type { EventManagementData } from "@/db/event-management";
import type { AccountManagementRow } from "@/db/account-admin";
import type { PlayerPointsPageData } from "@/db/player-points";
import EventSettingsIndexView from "./events/event-settings-index-view";
import EventManagementClient from "./events/event-management-client";
import ContentManagementClient from "./content/content-management-client";
import { PlayerManagementWorkspace } from "./players/player-management-client";
import { PointsRankingWorkspace } from "./points/points-client";
import AccountManagementClient from "./accounts/account-management-client";
import AuditLogView, { type AuditLogRow } from "./logs/audit-log-view";

function placeholderEvent(eventId: string): EventManagementData {
  const year = new Date().getFullYear();
  return {
    viewerRole: "committee",
    publicationStatuses: { overview: "draft", regulation: "draft", documents: "draft", schedule: "draft", matches: "draft", rankings: "draft" },
    event: {
      id: eventId, year, stationNo: 0, fullTitle: "赛事完整名称正在读取", shortTitle: "当前赛事", slug: "", city: "城市读取中",
      startDate: "", endDate: "", registrationStartAt: "", registrationEndAt: "", coverImageKey: "", summary: "赛事简介正在读取…",
      status: "draft", publishStatus: "draft",
      venue: { id: null, name: "场馆读取中", province: "", city: "", district: "", address: "", tableCount: 0 },
      details: { sponsorLabel: "", durationLabel: "", qualifierDateLabel: "", mainDateLabel: "", totalPrizeLabel: "", mainSizeLabel: "", minimumAgeNote: "", signupNote: "" },
      sponsors: [], organizations: { host: "", support: "", operator: "", cooperator: "" },
      groups: [
        { id: "u16", name: "少年组", code: "U16", birthDateFrom: "", birthDateTo: "", minimumAge: null, registrationFeeYuan: 0, registrationLimit: null, mainDrawSize: 64, status: "active", ageRuleText: "年龄规则正在读取" },
        { id: "u20", name: "青年组", code: "U20", birthDateFrom: "", birthDateTo: "", minimumAge: null, registrationFeeYuan: 0, registrationLimit: null, mainDrawSize: 64, status: "active", ageRuleText: "年龄规则正在读取" },
      ],
      memberIds: [],
    },
    assignableAccounts: [],
  };
}

function placeholderContent(eventId: string): ContentManagementData {
  const modules = [
    ["overview", "赛事概览"], ["regulation", "竞赛规程"], ["documents", "赛事文件"],
    ["schedule", "赛程"], ["matches", "对阵与比分"], ["rankings", "排名"],
  ];
  return {
    event: { id: eventId, shortTitle: "当前赛事", fullTitle: "赛事名称正在读取", city: "城市读取中", status: "draft", publishStatus: "draft", summary: "赛事简介正在读取…" },
    publications: modules.map(([moduleType, moduleTitle], index) => ({ id: `loading-${index}`, moduleType, moduleTitle, versionNo: 0, status: "draft", publishedAt: "" })),
    details: {
      competitionFormat: [["资格赛第一场", "正在读取", "—", "—"], ["资格赛第二场", "正在读取", "—", "—"], ["正赛第一阶段", "正在读取", "—", "—"], ["正赛第二阶段", "正在读取", "—", "—"]],
      drawRules: ["抽签规则正在读取…", "种子与递补规则正在读取…"],
      prizes: { 少年组: [["冠军", "—"], ["亚军", "—"], ["季军", "—"]], 青年组: [["冠军", "—"], ["亚军", "—"], ["季军", "—"]] },
    },
    documents: [
      { id: "loading-regulation", documentType: "regulation", title: "竞赛规程", url: "", isPublished: false },
      { id: "loading-referee", documentType: "referee_list", title: "裁判员名单", url: "", isPublished: false },
    ],
    guides: [
      { id: "loading-transport", guideType: "transport", title: "交通住宿攻略", body: "", publishStatus: "draft" },
      { id: "loading-clothing", guideType: "clothing", title: "服装要求", body: "", publishStatus: "draft" },
    ],
  };
}

export function EventsLoadingView({ canDelete = false }: { canDelete?: boolean }) {
  return <EventSettingsIndexView events={null} canDelete={canDelete} />;
}

export function EventSettingsLoadingView({ eventId = "" }: { eventId?: string }) {
  return <div aria-busy="true" style={{ pointerEvents: "none" }}><EventManagementClient initialData={placeholderEvent(eventId)} /></div>;
}

export function ContentLoadingView({ eventId = "" }: { eventId?: string }) {
  return <div aria-busy="true" style={{ pointerEvents: "none" }}><ContentManagementClient initialData={placeholderContent(eventId)} /></div>;
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
  const logs: AuditLogRow[] = Array.from({ length: 7 }, (_, index) => ({ id: `loading-${index}`, createdAt: "", actorName: "操作人读取中", actorUsername: "—", moduleType: "模块读取中", action: "update", targetType: "对象读取中", targetId: null, eventId: null }));
  return <AuditLogView logs={logs} loading />;
}
