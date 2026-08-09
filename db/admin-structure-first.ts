import { getSqlClient } from "./index";
import { assertAdminRole, resolveAdminPrincipal, type AdminPrincipalInput } from "./permissions";

export type DashboardRecentEvent = {
  id: string;
  shortTitle: string;
  stationNo: number;
  status: string;
  startDate: string;
  endDate: string;
  city: string;
  venueName: string;
};

export type AdminDashboardSummary = {
  metrics: {
    eventCount: number;
    activeEventCount: number;
    pendingRegistrationCount: number;
    draftPublicationCount: number;
  };
  recentEvents: DashboardRecentEvent[];
};

function normalizeRecentEvents(value: unknown): DashboardRecentEvent[] {
  if (Array.isArray(value)) return value as DashboardRecentEvent[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed as DashboardRecentEvent[] : [];
    } catch {
      return [];
    }
  }
  return [];
}

export async function getAdminDashboardSummaryFast(input: AdminPrincipalInput): Promise<AdminDashboardSummary> {
  const principal = await resolveAdminPrincipal(input);
  const sql = getSqlClient();
  const rows = await sql<Array<{
    eventCount: number;
    activeEventCount: number;
    pendingRegistrationCount: number;
    draftPublicationCount: number;
    recentEvents: unknown;
  }>>`
    with allowed_events as (
      select e.id,e.short_title,e.station_no,e.status,e.start_date,e.end_date,e.year,e.city,v.name as venue_name
      from public.events e
      left join public.venues v on v.id=e.venue_id
      where ${principal.role}='system_admin'
        or exists (
          select 1 from public.event_members em
          where em.event_id=e.id and em.user_id=${principal.id} and em.status='active'
        )
    ), recent as (
      select * from allowed_events
      order by year desc,station_no desc
      limit 4
    )
    select
      (select count(*) from allowed_events)::int as "eventCount",
      (select count(*) from allowed_events where status in ('registration_open','in_progress'))::int as "activeEventCount",
      (select count(*) from public.registrations r join allowed_events ae on ae.id=r.event_id where r.status='pending')::int as "pendingRegistrationCount",
      (select count(*) from public.publications p join allowed_events ae on ae.id=p.event_id where p.status='draft')::int as "draftPublicationCount",
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',id,
          'shortTitle',short_title,
          'stationNo',station_no,
          'status',status,
          'startDate',start_date,
          'endDate',end_date,
          'city',city,
          'venueName',coalesce(venue_name,'')
        ) order by year desc,station_no desc)
        from recent
      ), '[]'::jsonb) as "recentEvents"
  `;
  const row = rows[0];
  return {
    metrics: {
      eventCount: Number(row?.eventCount ?? 0),
      activeEventCount: Number(row?.activeEventCount ?? 0),
      pendingRegistrationCount: Number(row?.pendingRegistrationCount ?? 0),
      draftPublicationCount: Number(row?.draftPublicationCount ?? 0),
    },
    recentEvents: normalizeRecentEvents(row?.recentEvents),
  };
}

export type NewEventAccount = { id: string; username: string; displayName: string; role: string; status: string };
export type NewEventSuggestion = {
  latestYear: number;
  nextStationNo: number;
  viewerRole: string;
  assignableAccounts: NewEventAccount[];
};

export async function getNewEventSuggestionFast(input: AdminPrincipalInput): Promise<NewEventSuggestion> {
  const principal = await resolveAdminPrincipal(input);
  assertAdminRole(principal, ["system_admin", "committee"], "当前账号没有创建赛事的权限。");
  const currentYear = new Date().getFullYear();
  const sql = getSqlClient();
  const [rows, accounts] = await Promise.all([
    sql<Array<{ latestYear: number; nextStationNo: number }>>`
      with target as (
        select greatest(${currentYear}::int,coalesce(max(year),${currentYear}::int))::int as year
        from public.events
      )
      select target.year::int as "latestYear",
        (coalesce(max(e.station_no),0)+1)::int as "nextStationNo"
      from target
      left join public.events e on e.year=target.year
      group by target.year
    `,
    principal.role === "system_admin"
      ? sql<NewEventAccount[]>`
          select id, username, display_name as "displayName", role, status
          from public.users
          where role in ('committee','referee')
          order by case when status='active' then 0 else 1 end, display_name asc
        `
      : Promise.resolve([] as NewEventAccount[]),
  ]);
  return {
    latestYear: Number(rows[0]?.latestYear ?? currentYear),
    nextStationNo: Number(rows[0]?.nextStationNo ?? 1),
    viewerRole: principal.role,
    assignableAccounts: accounts,
  };
}
