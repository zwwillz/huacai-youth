import Link from "next/link";
import type { AuditLogDetail, AuditLogWorkspaceData } from "@/db/audit-log";

export type AuditLogFilters = {
  q: string;
  event: string;
  module: string;
  actor: string;
  action: string;
  from: string;
  to: string;
  page: number;
};

type EventOption = { id: string; shortTitle: string };

type ChangeRow = {
  key: string;
  label: string;
  before: unknown;
  after: unknown;
};

const moduleLabels: Record<string, string> = {
  system: "系统",
  accounts: "账号与权限",
  events: "赛事管理",
  content: "内容发布",
  publications: "内容发布",
  registration_publish: "报名发布",
  schedule_publish: "赛程发布",
  participants: "参赛人员",
  players: "球员档案",
  competition: "竞赛执行",
  points: "积分规则",
};

const actionLabels: Record<string, string> = {
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
  enable_account: "启用账号",
  disable_account: "停用账号",
  reset_password: "重置密码",
  change_role: "修改角色",
  delete_account: "删除账号",
  create_player: "创建球员档案",
  update_player: "修改球员档案",
  delete_player: "删除球员档案",
  update_registration: "修改报名信息",
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
};

const targetLabels: Record<string, string> = {
  user: "后台账号",
  event: "赛事",
  event_management: "赛事",
  publication: "发布内容",
  event_overview: "赛事概览",
  player: "球员",
  registration: "报名记录",
  event_group: "参赛组别",
  master_schedule: "总赛程",
  match: "比赛",
  draw: "抽签",
  draw_session: "抽签",
  bracket: "签表",
  competition: "竞赛数据",
  points_rule: "积分规则",
};

const fieldLabels: Record<string, string> = {
  status: "状态",
  publishStatus: "发布状态",
  isHidden: "是否隐藏",
  fullTitle: "完整赛事名称",
  shortTitle: "赛事简称",
  city: "城市",
  stationNo: "站次",
  year: "赛季年份",
  sponsorCount: "赞助商数量",
  versionNo: "版本号",
  role: "角色",
  username: "用户名",
  fullName: "姓名",
  playerCode: "球员编号",
  identityType: "证件类型",
  identityLast4: "证件后四位",
  group: "组别",
  groupName: "组别",
  rosterCount: "名单人数",
  stages: "阶段数量",
  scoreA: "A方比分",
  scoreB: "B方比分",
  tableName: "台号",
  matchTime: "比赛时间",
  feeStatus: "报名费状态",
  reviewStatus: "审核状态",
  reviewNote: "审核备注",
  moduleType: "模块",
  hasUnpublishedChanges: "有未发布修改",
  hasSnapshot: "已有发布快照",
  snapshotUpdated: "更新发布快照",
};

const valueLabels: Record<string, string> = {
  draft: "草稿",
  published: "已发布",
  active: "启用",
  disabled: "停用",
  archived: "已归档",
  registration_open: "报名中",
  in_progress: "进行中",
  approved: "审核通过",
  pending: "待审核",
  rejected: "未通过",
  withdrawn: "退赛",
  paid: "已缴",
  unpaid: "未缴",
  waived: "免缴",
  exempt: "免缴",
  system_admin: "系统管理员",
  committee: "组委会",
  referee: "裁判",
  schedule: "赛程",
  regulation: "竞赛规程",
  overview: "赛事概览",
};

const moduleOptions = [
  ["events", "赛事管理"],
  ["content", "内容发布"],
  ["schedule_publish", "赛程发布"],
  ["participants", "参赛人员"],
  ["players", "球员档案"],
  ["competition", "竞赛执行"],
  ["points", "积分规则"],
  ["accounts", "账号与权限"],
  ["system", "系统"],
] as const;

const actionOptions = [
  ["create", "创建赛事"],
  ["update", "修改赛事"],
  ["publish", "发布内容"],
  ["unpublish", "撤回内容"],
  ["event_hide", "隐藏赛事"],
  ["event_archive", "归档赛事"],
  ["update_registration", "修改报名信息"],
  ["confirm_participant_roster", "确认参赛名单"],
  ["lock_participant_roster", "锁定参赛名单"],
  ["unlock_participant_roster", "解除名单锁定"],
  ["confirm_draw", "确认抽签"],
  ["void_draw", "作废抽签"],
  ["submit_match_result", "提交比分"],
  ["confirm_match_result", "确认比赛结果"],
  ["create_account", "创建账号"],
  ["disable_account", "停用账号"],
  ["reset_password", "重置密码"],
] as const;

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const valueOf = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "";
  return `${valueOf("year")}-${valueOf("month")}-${valueOf("day")} ${valueOf("hour")}:${valueOf("minute")}:${valueOf("second")}`;
}

function actionTone(action: string) {
  if (action.includes("delete") || action === "void_draw" || action === "reset_password") return "danger";
  if (action.includes("unpublish") || action === "event_hide" || action === "event_archive" || action === "unlock_participant_roster" || action === "disable_account") return "warning";
  if (action.includes("publish") || action.startsWith("confirm_") || action === "lock_participant_roster" || action === "event_show" || action === "event_restore" || action === "enable_account") return "success";
  return "normal";
}

function safeParse(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function sameValue(a: unknown, b: unknown) {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return a === b;
  }
}

function changes(detail: AuditLogDetail): ChangeRow[] {
  const before = safeParse(detail.beforeJson);
  const after = safeParse(detail.afterJson);
  if (!before && !after) return [];
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  return [...keys]
    .filter((key) => !sameValue(before?.[key], after?.[key]))
    .map((key) => ({ key, label: fieldLabels[key] || key, before: before?.[key], after: after?.[key] }));
}

function displayValue(key: string, value: unknown) {
  if (/(password|token|secret|hash)/i.test(key)) return "已隐藏";
  if (value === undefined) return "—";
  if (value === null || value === "") return "空";
  if (typeof value === "boolean") return value ? "是" : "否";
  if (typeof value === "string") return valueLabels[value] || value;
  if (typeof value === "number") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function targetTitle(log: AuditLogWorkspaceData["rows"][number] | AuditLogDetail) {
  return log.targetName || targetLabels[log.targetType] || log.targetType || "系统记录";
}

function targetHint(log: AuditLogWorkspaceData["rows"][number] | AuditLogDetail) {
  if (log.targetReference) return log.targetReference;
  if (log.eventTitle && log.eventTitle !== log.targetName) return log.eventTitle;
  return targetLabels[log.targetType] || "—";
}

function roleLabel(value: string | null) {
  return value ? valueLabels[value] || value : "系统";
}

function filteredParams(filters: AuditLogFilters, page?: number) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.event) params.set("event", filters.event);
  if (filters.module) params.set("module", filters.module);
  if (filters.actor) params.set("actor", filters.actor);
  if (filters.action) params.set("action", filters.action);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  const resolvedPage = page ?? filters.page;
  if (resolvedPage > 1) params.set("page", String(resolvedPage));
  return params;
}

function pageHref(filters: AuditLogFilters, page: number) {
  const params = filteredParams(filters, page);
  return `/admin/logs${params.size ? `?${params.toString()}` : ""}`;
}

function detailHref(filters: AuditLogFilters, id: string) {
  const params = filteredParams(filters);
  params.set("detail", id);
  return `/admin/logs?${params.toString()}`;
}

function AuditDetailDrawer({ detail, filters }: { detail: AuditLogDetail; filters: AuditLogFilters }) {
  const diff = changes(detail);
  return <div className="audit-drawer-layer" role="presentation">
    <Link className="audit-drawer-backdrop" href={pageHref(filters, filters.page)} prefetch={false} aria-label="关闭操作详情" />
    <aside className="audit-drawer" aria-label="操作详情">
      <header className="audit-drawer-head">
        <div><small>OPERATION DETAIL</small><h3>操作详情</h3></div>
        <Link href={pageHref(filters, filters.page)} prefetch={false} aria-label="关闭">×</Link>
      </header>
      <div className="audit-detail-body">
        <section className="audit-detail-summary">
          <dl>
            <div><dt>操作时间</dt><dd>{formatTime(detail.createdAt)}</dd></div>
            <div><dt>操作人员</dt><dd><strong>{detail.actorName}</strong><small>{detail.actorUsername} · {roleLabel(detail.actorRole)}</small></dd></div>
            <div><dt>所属赛事</dt><dd>{detail.eventTitle || "系统级操作"}</dd></div>
            <div><dt>功能模块</dt><dd>{moduleLabels[detail.moduleType] || detail.moduleType}</dd></div>
            <div><dt>操作类型</dt><dd><span className={`audit-action ${actionTone(detail.action)}`}>{actionLabels[detail.action] || detail.action}</span></dd></div>
            <div><dt>操作对象</dt><dd><strong>{targetTitle(detail)}</strong><small>{targetHint(detail)}</small></dd></div>
            <div><dt>操作结果</dt><dd><span className="audit-result">成功</span></dd></div>
          </dl>
        </section>
        {detail.reason ? <section className="audit-detail-section"><h4>操作原因</h4><p className="audit-reason">{detail.reason}</p></section> : null}
        <section className="audit-detail-section">
          <h4>数据变化</h4>
          {diff.length ? <div className="audit-change-list">
            <div className="audit-change-head"><span>字段</span><span>修改前</span><span>修改后</span></div>
            {diff.map((item) => <div className="audit-change-row" key={item.key}>
              <strong>{item.label}</strong><span>{displayValue(item.key, item.before)}</span><span>{displayValue(item.key, item.after)}</span>
            </div>)}
          </div> : <div className="audit-no-change">该操作没有记录字段级变化，或属于创建、确认等单向操作。</div>}
        </section>
        <details className="audit-technical">
          <summary>技术信息</summary>
          <dl>
            <div><dt>日志 ID</dt><dd>{detail.id}</dd></div>
            <div><dt>对象 ID</dt><dd>{detail.targetId || "—"}</dd></div>
            <div><dt>IP 地址</dt><dd>{detail.ipAddress || "未记录"}</dd></div>
          </dl>
        </details>
      </div>
    </aside>
  </div>;
}

export default function AuditLogView({ data, events, filters }: { data: AuditLogWorkspaceData; events: EventOption[]; filters: AuditLogFilters }) {
  return <main className="admin-system-page admin-audit-page">
    <section className="admin-system-head audit-page-head">
      <div><small>AUDIT LOG</small><h2>操作日志</h2><p>记录后台重要数据修改及管理操作。日志只读，用于快速确认谁在什么时间对什么内容做了什么操作。</p></div>
      <span className="audit-readonly">只读记录 · 每页 50 条</span>
    </section>

    <form className="audit-filter-card" action="/admin/logs" method="get">
      <div className="audit-filter-search"><label htmlFor="audit-q">搜索</label><input id="audit-q" name="q" defaultValue={filters.q} placeholder="搜索球员、赛事、账号或操作内容" /></div>
      <label><span>赛事</span><select name="event" defaultValue={filters.event}><option value="">全部赛事</option>{events.map((event) => <option key={event.id} value={event.id}>{event.shortTitle}</option>)}</select></label>
      <label><span>模块</span><select name="module" defaultValue={filters.module}><option value="">全部模块</option>{moduleOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label><span>操作人</span><select name="actor" defaultValue={filters.actor}><option value="">全部操作人</option>{data.actors.map((actor) => <option key={actor.id} value={actor.id}>{actor.displayName}（{actor.username}）</option>)}</select></label>
      <label><span>操作类型</span><select name="action" defaultValue={filters.action}><option value="">全部类型</option>{actionOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label><span>开始日期</span><input type="date" name="from" defaultValue={filters.from} /></label>
      <label><span>结束日期</span><input type="date" name="to" defaultValue={filters.to} /></label>
      <div className="audit-filter-actions"><button type="submit">查询</button><Link href="/admin/logs" prefetch={false}>重置</Link></div>
    </form>

    <section className="admin-system-card audit-table-card">
      <div className="audit-table-meta"><span>第 {data.page} 页 · 每页最多 {data.pageSize} 条</span><small>仅加载当前页，操作详情按需读取</small></div>
      <div className="audit-table-scroll">
        <div className="audit-log-head"><span>时间</span><span>操作人</span><span>模块</span><span>操作内容</span><span>操作对象</span><span>结果</span><span>操作</span></div>
        {data.rows.length ? data.rows.map((log) => <div className="audit-log-row" key={log.id}>
          <time dateTime={log.createdAt}>{formatTime(log.createdAt)}</time>
          <span className="audit-actor"><strong>{log.actorName}</strong><small>{log.actorUsername}</small></span>
          <span>{moduleLabels[log.moduleType] || log.moduleType}</span>
          <span><b className={`audit-action ${actionTone(log.action)}`}>{actionLabels[log.action] || log.action}</b></span>
          <span className="audit-target"><strong>{targetTitle(log)}</strong><small>{targetHint(log)}</small></span>
          <span><b className="audit-result">成功</b></span>
          <span><Link className="audit-detail-link" href={detailHref(filters, log.id)} prefetch={false}>详情</Link></span>
        </div>) : <div className="admin-log-empty">没有找到符合条件的操作日志</div>}
      </div>
      <footer className="audit-pagination">
        <div>{data.hasPrevious ? <Link href={pageHref(filters, data.page - 1)} prefetch={false}>← 上一页</Link> : <span>← 上一页</span>}</div>
        <strong>第 {data.page} 页</strong>
        <div>{data.hasNext ? <Link href={pageHref(filters, data.page + 1)} prefetch={false}>下一页 →</Link> : <span>下一页 →</span>}</div>
      </footer>
    </section>
    {data.detail ? <AuditDetailDrawer detail={data.detail} filters={filters} /> : null}
  </main>;
}

export function AuditLogLoadingView() {
  return <main className="admin-system-page admin-audit-page" aria-busy="true" style={{ pointerEvents: "none" }}>
    <section className="admin-system-head audit-page-head"><div><small>AUDIT LOG</small><h2>操作日志</h2><p>记录后台重要数据修改及管理操作。日志只读，用于快速确认谁在什么时间对什么内容做了什么操作。</p></div><span className="audit-readonly">只读记录 · 每页 50 条</span></section>
    <div className="audit-filter-card audit-filter-loading"><input placeholder="搜索球员、赛事、账号或操作内容" disabled />{Array.from({ length: 6 }, (_, index) => <select key={index} disabled><option>读取中</option></select>)}<div className="audit-filter-actions"><button disabled>查询</button><span>重置</span></div></div>
    <section className="admin-system-card audit-table-card"><div className="audit-table-meta"><span>每页最多 50 条</span><small>正在读取当前页</small></div><div className="audit-table-scroll"><div className="audit-log-head"><span>时间</span><span>操作人</span><span>模块</span><span>操作内容</span><span>操作对象</span><span>结果</span><span>操作</span></div>{Array.from({ length: 8 }, (_, index) => <div className="audit-log-row audit-loading-row" key={index}><time>正在读取…</time><span><strong>操作人员</strong><small>账号</small></span><span>模块</span><span>操作内容</span><span><strong>操作对象</strong><small>赛事</small></span><span>—</span><span>—</span></div>)}</div></section>
  </main>;
}
