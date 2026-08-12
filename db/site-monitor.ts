import { describeDevice } from "@/lib/site-monitor";
import { getSqlClient } from "./index";

export type SiteMonitorRange = "today" | "yesterday" | "7d" | "30d";

export type SiteMonitorRow = {
  id: string;
  time: string;
  type: "前台访问" | "后台登录" | "后台操作";
  visitor: string;
  ip: string;
  region: string;
  device: string;
  page: string;
  event: string;
  action: string;
};

type PublicVisitRow = {
  id: string;
  createdAt: string;
  visitorId: string | null;
  ipAddress: string | null;
  eventTitle: string | null;
  afterJson: string | null;
};

type AdminActionRow = {
  id: string;
  createdAt: string;
  actorName: string | null;
  actorUsername: string | null;
  ipAddress: string | null;
  eventTitle: string | null;
  moduleType: string;
  action: string;
  userAgent: string | null;
};

type LoginRow = {
  id: string;
  attemptedAt: string;
  username: string;
  ipAddress: string | null;
  userAgent: string | null;
  success: boolean;
};

type MonitorMeta = {
  path?: string;
  pageLabel?: string;
  eventLabel?: string;
  region?: string;
  device?: string;
};

const MODULE_LABELS: Record<string, string> = {
  system: "系统",
  accounts: "账号与权限",
  events: "赛事管理",
  event_management: "赛事管理",
  event_overview: "赛事概览",
  content: "内容发布",
  publications: "内容发布",
  content_publication: "内容发布",
  registration: "报名发布",
  registration_publish: "报名发布",
  registration_publication: "报名发布",
  schedule_publish: "赛程发布",
  schedule: "赛程编排",
  participants: "参赛人员",
  participant_roster: "参赛人员",
  players: "球员档案",
  competition: "竞赛执行",
  draw: "抽签与签表",
  competition_draw: "抽签与签表",
  competition_schedule: "赛程编排",
  scoring: "比分录入",
  competition_scoring: "比分录入",
  advancement: "晋级",
  competition_advancement: "晋级",
  ranking: "比赛排名",
  rankings: "比赛排名",
  final_ranking: "比赛排名",
  points: "积分规则",
  account_management: "账号与权限",
  audit_log: "操作日志",
  asset: "赛事文件",
};

const ACTION_LABELS: Record<string, string> = {
  bootstrap_admin: "初始化管理员",
  resume_bootstrap: "补充初始化",
  create: "创建赛事",
  update: "修改赛事",
  event_hide: "隐藏赛事",
  event_show: "恢复展示",
  event_archive: "归档赛事",
  event_restore: "恢复赛事",
  delete_event: "删除赛事",
  save_overview: "保存赛事概览",
  save_content: "保存内容",
  save_guides: "保存参赛提示",
  publish: "发布内容",
  unpublish: "撤回内容",
  create_account: "创建账号",
  create_system_admin: "创建系统管理员",
  enable_account: "启用账号",
  disable_account: "停用账号",
  reset_password: "重置密码",
  change_role: "修改角色",
  delete_account: "删除账号",
  create_player: "创建球员档案",
  update_player: "修改球员档案",
  delete_player: "删除球员档案",
  update_registration: "修改报名信息",
  save_registration_draft: "保存报名设置",
  publish_registration: "发布报名",
  confirm_participant_roster: "确认参赛名单",
  lock_participant_roster: "锁定参赛名单",
  unlock_participant_roster: "解除名单锁定",
  create_draw_draft: "生成抽签草稿",
  confirm_draw: "确认抽签",
  void_draw: "作废抽签",
  generate_bracket: "生成签表",
  save_tables: "保存台号",
  save_time_slots: "保存时间段",
  auto_schedule: "自动编排赛程",
  submit_match_result: "提交比分",
  confirm_match_result: "确认比赛结果",
  publish_competition_module: "发布竞赛模块",
  unpublish_competition_module: "撤回竞赛模块",
  save_master_schedule: "保存总赛程",
  save_master_schedule_group: "保存组别赛程",
  publish_master_schedule: "发布总赛程",
  publish_master_schedule_group: "发布组别赛程",
  unpublish_master_schedule: "撤回总赛程",
  update_points_rule: "修改积分规则",
  create: "创建",
  save: "保存",
  delete: "删除",
  confirm: "确认",
  lock: "锁定",
  unlock: "解除锁定",
  generate: "生成",
  regenerate: "重新生成",
  submit: "提交",
  score: "录入比分",
  archive: "归档",
  restore: "恢复",
  enable: "启用",
  disable: "停用",
};

function clean(value: string | undefined, max = 100) {
  return (value || "").trim().slice(0, max);
}

function parseMeta(value: string | null): MonitorMeta {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" ? parsed as MonitorMeta : {};
  } catch {
    return {};
  }
}

function chinaDayStart(offsetDays = 0) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const base = new Date(`${value.year}-${value.month}-${value.day}T00:00:00+08:00`);
  base.setUTCDate(base.getUTCDate() + offsetDays);
  return base.toISOString();
}

function rangeBounds(range: SiteMonitorRange) {
  const now = new Date();
  if (range === "today") return { from: chinaDayStart(), to: "" };
  if (range === "yesterday") return { from: chinaDayStart(-1), to: chinaDayStart() };
  if (range === "30d") return { from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(), to: "" };
  return { from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(), to: "" };
}

function moduleLabel(value: string) {
  return MODULE_LABELS[value] || value || "后台";
}

function actionLabel(value: string) {
  return ACTION_LABELS[value] || value || "操作";
}

function visitorLabel(visitorId: string | null) {
  const compact = (visitorId || "").replace(/[^a-zA-Z0-9]/g, "");
  return `游客 ${compact.slice(-4).toUpperCase() || "----"}`;
}

function matchesQuery(row: SiteMonitorRow, query: string) {
  if (!query) return true;
  const haystack = [row.type, row.visitor, row.ip, row.region, row.device, row.page, row.event, row.action]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

export async function getSiteMonitorRows(
  username: string,
  input: { range?: SiteMonitorRange; query?: string } = {},
): Promise<SiteMonitorRow[]> {
  const sql = getSqlClient();
  const [viewer] = await sql<Array<{ role: string; status: string }>>`
    select role,status from public.users where username=${username} limit 1
  `;
  if (username !== "admin" || !viewer || viewer.status !== "active" || viewer.role !== "system_admin") {
    throw new Error("只有根管理员 admin 可以查看网站监测。");
  }

  const range = input.range || "today";
  const query = clean(input.query, 80);
  const { from, to } = rangeBounds(range);

  const publicPromise = sql<PublicVisitRow[]>`
    select
      al.id,
      al.created_at as "createdAt",
      al.target_id as "visitorId",
      al.ip_address as "ipAddress",
      evt.short_title as "eventTitle",
      al.after_json as "afterJson"
    from public.audit_logs al
    left join public.events evt on evt.id=al.event_id
    where al.module_type='public_visit'
      and al.created_at::timestamptz>=${from}::timestamptz
      and (${to}='' or al.created_at::timestamptz<${to}::timestamptz)
    order by al.created_at::timestamptz desc,al.id desc
    limit 700
  `;

  const adminPromise = sql<AdminActionRow[]>`
    select
      al.id,
      al.created_at as "createdAt",
      actor.display_name as "actorName",
      actor.username as "actorUsername",
      coalesce(al.ip_address,session_device.ip_address) as "ipAddress",
      evt.short_title as "eventTitle",
      al.module_type as "moduleType",
      al.action,
      session_device.user_agent as "userAgent"
    from public.audit_logs al
    left join public.users actor on actor.id=al.actor_user_id
    left join public.events evt on evt.id=al.event_id
    left join lateral (
      select s.user_agent,s.ip_address
      from public.admin_sessions s
      where s.user_id=al.actor_user_id
        and s.created_at::timestamptz<=al.created_at::timestamptz
        and s.created_at::timestamptz>=al.created_at::timestamptz-interval '24 hours'
        and (al.ip_address is null or s.ip_address=al.ip_address)
      order by s.created_at::timestamptz desc
      limit 1
    ) session_device on true
    where al.module_type<>'public_visit'
      and al.created_at::timestamptz>=${from}::timestamptz
      and (${to}='' or al.created_at::timestamptz<${to}::timestamptz)
    order by al.created_at::timestamptz desc,al.id desc
    limit 700
  `;

  const loginPromise = sql<LoginRow[]>`
    select
      id,
      attempted_at as "attemptedAt",
      username_key as username,
      ip_address as "ipAddress",
      user_agent as "userAgent",
      success
    from public.admin_login_attempts
    where attempted_at::timestamptz>=${from}::timestamptz
      and (${to}='' or attempted_at::timestamptz<${to}::timestamptz)
    order by attempted_at::timestamptz desc,id desc
    limit 700
  `;

  const [publicRows, adminRows, loginRows] = await Promise.all([publicPromise, adminPromise, loginPromise]);

  const rows: SiteMonitorRow[] = [
    ...publicRows.map((row) => {
      const meta = parseMeta(row.afterJson);
      return {
        id: `public-${row.id}`,
        time: row.createdAt,
        type: "前台访问" as const,
        visitor: visitorLabel(row.visitorId),
        ip: row.ipAddress || "未知",
        region: meta.region || "未知",
        device: meta.device || "未知",
        page: meta.pageLabel || meta.path || "前台页面",
        event: row.eventTitle || meta.eventLabel || "—",
        action: "浏览页面",
      };
    }),
    ...loginRows.map((row) => ({
      id: `login-${row.id}`,
      time: row.attemptedAt,
      type: "后台登录" as const,
      visitor: row.username || "未知账号",
      ip: row.ipAddress || "未知",
      region: "—",
      device: describeDevice(row.userAgent || ""),
      page: "后台登录",
      event: "—",
      action: row.success ? "登录成功" : "登录失败",
    })),
    ...adminRows.map((row) => ({
      id: `admin-${row.id}`,
      time: row.createdAt,
      type: "后台操作" as const,
      visitor: row.actorName && row.actorUsername && row.actorName !== row.actorUsername
        ? `${row.actorName} · ${row.actorUsername}`
        : row.actorUsername || row.actorName || "系统",
      ip: row.ipAddress || "未知",
      region: "—",
      device: describeDevice(row.userAgent || ""),
      page: moduleLabel(row.moduleType),
      event: row.eventTitle || "—",
      action: actionLabel(row.action),
    })),
  ];

  return rows
    .filter((row) => matchesQuery(row, query))
    .sort((a, b) => Date.parse(b.time) - Date.parse(a.time))
    .slice(0, 500);
}
