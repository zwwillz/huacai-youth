import { getSqlClient } from "./index";

export const AUDIT_LOG_PAGE_SIZE = 50;

type AuditLogInput = {
  query?: string;
  eventId?: string;
  moduleType?: string;
  actorUserId?: string;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  detailId?: string;
};

export type AuditLogSummary = {
  id: string;
  createdAt: string;
  actorUserId: string | null;
  actorName: string;
  actorUsername: string;
  actorRole: string | null;
  eventId: string | null;
  eventTitle: string | null;
  moduleType: string;
  targetType: string;
  targetId: string | null;
  targetName: string | null;
  targetReference: string | null;
  action: string;
  reason: string | null;
};

export type AuditLogDetail = AuditLogSummary & {
  beforeJson: string | null;
  afterJson: string | null;
  ipAddress: string | null;
};

export type AuditLogActorOption = {
  id: string;
  displayName: string;
  username: string;
  role: string;
  status: string;
};

export type AuditLogWorkspaceData = {
  rows: AuditLogSummary[];
  actors: AuditLogActorOption[];
  detail: AuditLogDetail | null;
  page: number;
  pageSize: number;
  hasPrevious: boolean;
  hasNext: boolean;
};

type SummaryRow = Omit<AuditLogSummary, "actorName" | "actorUsername"> & {
  actorName: string | null;
  actorUsername: string | null;
};

type DetailRow = SummaryRow & {
  beforeJson: string | null;
  afterJson: string | null;
  ipAddress: string | null;
};

function clean(value: string | undefined, max = 100) {
  return (value || "").trim().slice(0, max);
}

function normalizePage(value: number | undefined) {
  return Number.isFinite(value) ? Math.max(1, Math.floor(value || 1)) : 1;
}

function chinaDayBoundary(value: string | undefined, nextDay = false) {
  const normalized = clean(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return "";
  const date = new Date(`${normalized}T00:00:00+08:00`);
  if (Number.isNaN(date.getTime())) return "";
  if (nextDay) date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString();
}

function mapSummary(row: SummaryRow): AuditLogSummary {
  return {
    ...row,
    actorName: row.actorName || "系统",
    actorUsername: row.actorUsername || "-",
  };
}

export async function getAuditLogWorkspaceData(username: string, input: AuditLogInput = {}): Promise<AuditLogWorkspaceData> {
  const sql = getSqlClient();
  const [viewer] = await sql<Array<{ id: string; role: string; status: string }>>`
    select id,role,status from public.users where username=${username} limit 1
  `;
  if (!viewer || viewer.status !== "active" || viewer.role !== "system_admin") {
    throw new Error("只有系统管理员可以查看操作日志。");
  }

  const query = clean(input.query, 80);
  const search = `%${query}%`;
  const eventId = clean(input.eventId, 80);
  const moduleType = clean(input.moduleType, 60);
  const actorUserId = clean(input.actorUserId, 80);
  const action = clean(input.action, 80);
  const dateFrom = chinaDayBoundary(input.dateFrom);
  const dateTo = chinaDayBoundary(input.dateTo, true);
  const page = normalizePage(input.page);
  const offset = (page - 1) * AUDIT_LOG_PAGE_SIZE;
  const detailId = clean(input.detailId, 100);

  const rowsPromise = sql<SummaryRow[]>`
    select
      al.id,
      al.created_at as "createdAt",
      al.actor_user_id as "actorUserId",
      actor.display_name as "actorName",
      actor.username as "actorUsername",
      actor.role as "actorRole",
      al.event_id as "eventId",
      evt.short_title as "eventTitle",
      al.module_type as "moduleType",
      al.target_type as "targetType",
      al.target_id as "targetId",
      coalesce(target_user.display_name,target_player.full_name,registration_player.full_name,target_group.name,evt.short_title) as "targetName",
      case when al.target_type='user' then target_user.username else null end as "targetReference",
      al.action,
      al.reason
    from public.audit_logs al
    left join public.users actor on actor.id=al.actor_user_id
    left join public.events evt on evt.id=al.event_id
    left join public.users target_user on al.target_type='user' and target_user.id=al.target_id
    left join public.players target_player on al.target_type='player' and target_player.id=al.target_id
    left join public.event_groups target_group on al.target_type='event_group' and target_group.id=al.target_id
    left join public.registrations target_registration on al.target_type='registration' and target_registration.id=al.target_id
    left join public.players registration_player on registration_player.id=target_registration.player_id
    where al.module_type<>'public_visit'
      and (${eventId}='' or al.event_id=${eventId})
      and (${moduleType}='' or al.module_type=${moduleType})
      and (${actorUserId}='' or al.actor_user_id=${actorUserId})
      and (${action}='' or al.action=${action})
      and (${dateFrom}='' or al.created_at>=${dateFrom})
      and (${dateTo}='' or al.created_at<${dateTo})
      and (
        ${query}=''
        or coalesce(al.target_id,'') ilike ${search}
        or al.target_type ilike ${search}
        or al.module_type ilike ${search}
        or al.action ilike ${search}
        or coalesce(al.reason,'') ilike ${search}
        or coalesce(actor.display_name,'') ilike ${search}
        or coalesce(actor.username,'') ilike ${search}
        or coalesce(evt.short_title,'') ilike ${search}
        or coalesce(target_user.display_name,'') ilike ${search}
        or coalesce(target_user.username,'') ilike ${search}
        or coalesce(target_player.full_name,'') ilike ${search}
        or coalesce(registration_player.full_name,'') ilike ${search}
        or coalesce(target_group.name,'') ilike ${search}
      )
    order by al.created_at desc,al.id desc
    limit ${AUDIT_LOG_PAGE_SIZE + 1} offset ${offset}
  `;

  const actorsPromise = sql<AuditLogActorOption[]>`
    select id,display_name as "displayName",username,role,status
    from public.users
    where role in ('system_admin','committee','referee')
    order by case when status='active' then 0 else 1 end,display_name,username
  `;

  const detailPromise = detailId ? sql<DetailRow[]>`
    select
      al.id,
      al.created_at as "createdAt",
      al.actor_user_id as "actorUserId",
      actor.display_name as "actorName",
      actor.username as "actorUsername",
      actor.role as "actorRole",
      al.event_id as "eventId",
      evt.short_title as "eventTitle",
      al.module_type as "moduleType",
      al.target_type as "targetType",
      al.target_id as "targetId",
      coalesce(target_user.display_name,target_player.full_name,registration_player.full_name,target_group.name,evt.short_title) as "targetName",
      case when al.target_type='user' then target_user.username else null end as "targetReference",
      al.action,
      al.reason,
      al.before_json as "beforeJson",
      al.after_json as "afterJson",
      al.ip_address as "ipAddress"
    from public.audit_logs al
    left join public.users actor on actor.id=al.actor_user_id
    left join public.events evt on evt.id=al.event_id
    left join public.users target_user on al.target_type='user' and target_user.id=al.target_id
    left join public.players target_player on al.target_type='player' and target_player.id=al.target_id
    left join public.event_groups target_group on al.target_type='event_group' and target_group.id=al.target_id
    left join public.registrations target_registration on al.target_type='registration' and target_registration.id=al.target_id
    left join public.players registration_player on registration_player.id=target_registration.player_id
    where al.id=${detailId}
      and al.module_type<>'public_visit'
    limit 1
  ` : Promise.resolve([] as DetailRow[]);

  const [rawRows, actors, detailRows] = await Promise.all([rowsPromise, actorsPromise, detailPromise]);
  const hasNext = rawRows.length > AUDIT_LOG_PAGE_SIZE;
  const rows = rawRows.slice(0, AUDIT_LOG_PAGE_SIZE).map(mapSummary);
  const detail = detailRows[0] ? ({ ...mapSummary(detailRows[0]), beforeJson: detailRows[0].beforeJson, afterJson: detailRows[0].afterJson, ipAddress: detailRows[0].ipAddress } satisfies AuditLogDetail) : null;

  return {
    rows,
    actors,
    detail,
    page,
    pageSize: AUDIT_LOG_PAGE_SIZE,
    hasPrevious: page > 1,
    hasNext,
  };
}
