export type AdminActiveSection = "dashboard" | "events" | "content" | "registrations" | "players" | "competition" | "rankings" | "accounts" | "logs";
export type AdminCompetitionTool = "overview" | "schedule" | "scoring" | "qualification" | "ranking";
export type AdminEventSwitchMode = "route" | "local";

export type AdminRouteDescriptor = {
  active: AdminActiveSection;
  pageTitle: string;
  pageHint: string;
  eventScoped: boolean;
  currentEventId: string;
  competitionTool: AdminCompetitionTool;
  eventSwitchMode: AdminEventSwitchMode;
  loadingKind: "dashboard" | "events" | "event-editor" | "content" | "players" | "competition" | "schedule" | "scoring" | "qualification" | "ranking" | "system";
};

function safeDecode(value: string | undefined) {
  if (!value) return "";
  try { return decodeURIComponent(value); } catch { return value; }
}

export function adminRouteKey(pathname: string, search: string) {
  return `${pathname}${search ? `?${search}` : ""}`;
}

export function isAdminShelllessRoute(pathname: string) {
  return pathname === "/admin/competition/print";
}

/**
 * Route-level skeletons are a fallback, not the first paint.
 * Structure-first pages get a longer grace period because their real UI should
 * normally arrive before a full-page skeleton is useful.
 */
export function adminRouteLoadingDelayMs(pathname: string, search = "") {
  if (pathname === "/admin/login" || isAdminShelllessRoute(pathname)) return Number.POSITIVE_INFINITY;
  const params = new URLSearchParams(search);
  const isDashboard = (pathname === "/admin" || pathname === "/admin/") && !params.get("section");
  const isNewEvent = pathname === "/admin/events/new";
  return isDashboard || isNewEvent ? 360 : 180;
}

export function describeAdminRoute(pathname: string, search = ""): AdminRouteDescriptor {
  const params = new URLSearchParams(search);
  const segments = pathname.split("/").filter(Boolean);
  const section = params.get("section") || "";
  const eventFromQuery = params.get("event") || "";
  const base: AdminRouteDescriptor = {
    active: "dashboard",
    pageTitle: "工作台",
    pageHint: "全局总览与待办",
    eventScoped: false,
    currentEventId: "",
    competitionTool: "overview",
    eventSwitchMode: "route",
    loadingKind: "dashboard",
  };

  if (pathname === "/admin" || pathname === "/admin/") {
    if (section === "registrations") return { ...base, active: "registrations", pageTitle: "报名审核", pageHint: "赛事运营 · 当前赛事", eventScoped: true, currentEventId: eventFromQuery, loadingKind: "content" };
    if (section === "rankings") return { ...base, active: "rankings", pageTitle: "排名积分", pageHint: "全局 · 总积分与分站排名", loadingKind: "ranking" };
    return base;
  }

  if (pathname.startsWith("/admin/events")) {
    const eventId = segments[2] && segments[2] !== "new" ? safeDecode(segments[2]) : "";
    if (segments[2] === "new") return { ...base, active: "events", pageTitle: "创建新赛事", pageHint: "赛事管理 · 全局", loadingKind: "event-editor" };
    if (eventId) return { ...base, active: "events", pageTitle: "赛事设置", pageHint: "赛事管理 · 分站主数据", eventScoped: true, currentEventId: eventId, eventSwitchMode: "local", loadingKind: "event-editor" };
    return { ...base, active: "events", pageTitle: "赛事管理", pageHint: "全局 · 创建与管理分站", loadingKind: "events" };
  }

  if (pathname.startsWith("/admin/content")) {
    const eventId = safeDecode(segments[2]);
    if (eventId && segments[3] === "guides") return { ...base, active: "content", pageTitle: "参赛友好提示", pageHint: "内容发布 · 富内容编辑", eventScoped: true, currentEventId: eventId, loadingKind: "content" };
    if (eventId) return { ...base, active: "content", pageTitle: "内容发布", pageHint: "赛事运营 · 静态内容", eventScoped: true, currentEventId: eventId, eventSwitchMode: "local", loadingKind: "content" };
    return { ...base, active: "content", pageTitle: "内容发布", pageHint: "赛事运营 · 请选择赛事", eventScoped: true, loadingKind: "content" };
  }

  if (pathname.startsWith("/admin/players")) return { ...base, active: "players", pageTitle: "球员管理", pageHint: "球员档案管理", loadingKind: "players" };

  if (pathname.startsWith("/admin/competition")) {
    if (pathname.startsWith("/admin/competition/schedules")) return { ...base, active: "competition", pageTitle: "赛程编排", pageHint: "竞赛执行 · 按组别与阶段编排", eventScoped: true, currentEventId: eventFromQuery, eventSwitchMode: "local", competitionTool: "schedule", loadingKind: "schedule" };
    if (pathname.startsWith("/admin/competition/schedule")) return { ...base, active: "competition", pageTitle: "赛程编排", pageHint: "竞赛执行 · 当前阶段排程", eventScoped: true, currentEventId: eventFromQuery, competitionTool: "schedule", loadingKind: "schedule" };
    if (pathname.startsWith("/admin/competition/scoring")) return { ...base, active: "competition", pageTitle: "比分录入", pageHint: "竞赛执行 · 当前待办优先", eventScoped: true, currentEventId: eventFromQuery, eventSwitchMode: "local", competitionTool: "scoring", loadingKind: "scoring" };
    if (pathname.startsWith("/admin/competition/qualification")) return { ...base, active: "competition", pageTitle: "晋级", pageHint: "竞赛执行 · 当前阶段晋级确认", eventScoped: true, currentEventId: eventFromQuery, competitionTool: "qualification", loadingKind: "qualification" };
    if (pathname.startsWith("/admin/competition/final-ranking")) return { ...base, active: "competition", pageTitle: "最终排名", pageHint: "竞赛执行 · 自动生成 / 人工调整 / 确认 / 发布", eventScoped: true, currentEventId: eventFromQuery, competitionTool: "ranking", loadingKind: "ranking" };
    if (pathname.startsWith("/admin/competition/draw")) return { ...base, active: "competition", pageTitle: "抽签与签表", pageHint: "竞赛执行 · 当前组别与阶段", eventScoped: true, currentEventId: eventFromQuery, competitionTool: "overview", loadingKind: "competition" };
    if (pathname.startsWith("/admin/competition/print")) return { ...base, active: "competition", pageTitle: "打印签表 / 赛程", pageHint: "竞赛执行 · 打印视图", competitionTool: "schedule", loadingKind: "schedule" };
    return { ...base, active: "competition", pageTitle: "竞赛执行", pageHint: "先选组别，再处理当前任务", eventScoped: true, currentEventId: eventFromQuery, eventSwitchMode: "local", competitionTool: "overview", loadingKind: "competition" };
  }

  if (pathname.startsWith("/admin/accounts")) return { ...base, active: "accounts", pageTitle: "账号与权限", pageHint: "系统 · 用户、角色与赛事权限", loadingKind: "system" };
  if (pathname.startsWith("/admin/logs")) return { ...base, active: "logs", pageTitle: "操作日志", pageHint: "系统 · 审计与操作记录", loadingKind: "system" };
  return base;
}
