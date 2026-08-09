import { getSqlClient } from "./index";
import { getAdminNavigationEventsForPrincipal } from "./admin-principal-ui";
import { assertAdminRole, resolveAdminPrincipal, type AdminPrincipalInput } from "./permissions";
import type { AdminNavEvent } from "./admin-ui";
import type { PlayerPointsDetail, PlayerPointsGroup, PlayerPointsListItem, PlayerPointsPageData, PlayerPointsRule, PlayerPointsScope } from "./player-points";

type PointsRow = {
  id: string;
  full_name: string;
  display_name: string;
  group_name: string | null;
  event_count: number | string;
  prize_cents: number | string;
  total_points: number | string;
  points_rank: number | string;
  filtered_total: number | string;
};

type HistoryRow = {
  event_id: string;
  event_title: string;
  start_date: string;
  group_name: string;
  placement_label: string | null;
  prize_cents: number | string;
  display_order: number | null;
};

function normalizeScope(value: string | undefined, role: string): PlayerPointsScope {
  return role === "system_admin" && value === "all" ? "all" : "event";
}
function normalizeGroup(value: string | undefined): PlayerPointsGroup {
  return value === "少年组" || value === "青年组" ? value : "all";
}
function mapRow(row: PointsRow): PlayerPointsListItem {
  return {
    id: row.id,
    rank: Number(row.points_rank),
    fullName: row.full_name,
    displayName: row.display_name,
    groupName: row.group_name,
    eventCount: Number(row.event_count),
    prizeCents: Number(row.prize_cents),
    points: Number(row.total_points),
  };
}

async function loadRule(requestedYear?: number): Promise<PlayerPointsRule> {
  const sql = getSqlClient();
  let year = requestedYear;
  if (!year) {
    const years = await sql<Array<{ year: number | null }>>`select max(year)::int as year from public.events`;
    year = Number(years[0]?.year || new Date().getFullYear());
  }
  const rows = await sql<Array<{ year: number; participation_points: number; prize_unit_yuan: number; prize_points_per_unit: number }>>`
    select year,participation_points,prize_unit_yuan,prize_points_per_unit
    from public.player_points_rules where year=${year} limit 1
  `;
  const row = rows[0];
  return row
    ? { year: row.year, participationPoints: row.participation_points, prizeUnitYuan: row.prize_unit_yuan, prizePointsPerUnit: row.prize_points_per_unit }
    : { year, participationPoints: 10, prizeUnitYuan: 100, prizePointsPerUnit: 1 };
}

async function resolveWorkspace(inputPrincipal: AdminPrincipalInput, requestedEventId?: string | null, requestedScope?: string, knownEvents?: AdminNavEvent[]) {
  const principal = await resolveAdminPrincipal(inputPrincipal);
  assertAdminRole(principal, ["system_admin", "committee"], "当前账号没有积分排名查看权限。");
  const events = knownEvents ?? await getAdminNavigationEventsForPrincipal(principal);
  const requestedEvent = requestedEventId && events.some((event) => event.id === requestedEventId) ? requestedEventId : null;
  const scope = normalizeScope(requestedScope, principal.role);
  const eventId = scope === "event" ? (requestedEvent || events[0]?.id || null) : null;
  return { principal, events, scope, eventId };
}

export async function getPlayerPointsPageFast(inputPrincipal: AdminPrincipalInput, input: {
  eventId?: string | null;
  scope?: string;
  group?: string;
  query?: string;
  page?: number;
  pageSize?: number;
  year?: number;
}, knownEvents?: AdminNavEvent[]): Promise<PlayerPointsPageData> {
  const [{ scope, eventId }, rule] = await Promise.all([
    resolveWorkspace(inputPrincipal, input.eventId, input.scope, knownEvents),
    loadRule(input.year),
  ]);
  const group = normalizeGroup(input.group);
  const query = (input.query || "").trim();
  const search = `%${query}%`;
  const pageSize = Math.min(80, Math.max(20, input.pageSize || 40));
  const page = Math.max(1, input.page || 1);
  const offset = (page - 1) * pageSize;
  const sql = getSqlClient();
  const unitCents = rule.prizeUnitYuan * 100;

  if (scope === "event") {
    if (!eventId) return { items: [], filteredTotal: 0, page, pageSize, year: rule.year, scope, eventId: null, rule };
    const rows = await sql<PointsRow[]>`
      with name_counts as (
        select full_name,count(*)::int as name_count
        from public.players where merged_into_player_id is null group by full_name
      ), prize_stats as (
        select player_id,coalesce(sum(prize_amount_cents),0)::bigint as prize_cents
        from public.event_rankings
        where event_id=${eventId} and status='published' and player_id is not null
        group by player_id
      ), base as (
        select distinct on (p.id)
          p.id,p.full_name,
          case when nc.name_count>1 then p.full_name || ' ' || coalesce(p.identity_no_last4,upper(right(nullif(p.identity_no_masked,''),4)),'待补') else p.full_name end as display_name,
          eg.name as group_name,1::int as event_count,coalesce(ps.prize_cents,0)::bigint as prize_cents,
          (${rule.participationPoints} + floor(coalesce(ps.prize_cents,0)::numeric / ${unitCents})::int * ${rule.prizePointsPerUnit})::int as total_points,
          coalesce(p.player_code,'') as player_code
        from public.registrations r
        join public.players p on p.id=r.player_id and p.merged_into_player_id is null
        join public.event_groups eg on eg.id=r.group_id
        join name_counts nc on nc.full_name=p.full_name
        left join prize_stats ps on ps.player_id=p.id
        where r.event_id=${eventId} and r.status='approved'
        order by p.id,eg.name
      ), grouped as (
        select * from base where (${group}='all' or group_name=${group})
      ), ranked as (
        select grouped.*,dense_rank() over(order by total_points desc)::int as points_rank
        from grouped
      ), searched as (
        select * from ranked where ${query}='' or full_name ilike ${search} or player_code ilike ${search}
      )
      select searched.*,count(*) over()::int as filtered_total
      from searched order by points_rank,prize_cents desc,full_name,id limit ${pageSize} offset ${offset}
    `;
    return { items: rows.map(mapRow), filteredTotal: Number(rows[0]?.filtered_total ?? 0), page, pageSize, year: rule.year, scope, eventId, rule };
  }

  const rows = await sql<PointsRow[]>`
    with scoped_regs as (
      select r.player_id,r.event_id,r.group_id,e.start_date
      from public.registrations r join public.events e on e.id=r.event_id
      where r.status='approved' and e.year=${rule.year}
    ), reg_stats as (
      select player_id,count(distinct event_id)::int as event_count from scoped_regs group by player_id
    ), latest_group as (
      select distinct on (sr.player_id) sr.player_id,eg.name as group_name
      from scoped_regs sr join public.event_groups eg on eg.id=sr.group_id
      order by sr.player_id,sr.start_date desc,sr.event_id desc
    ), prize_stats as (
      select er.player_id,coalesce(sum(er.prize_amount_cents),0)::bigint as prize_cents
      from public.event_rankings er join public.events e on e.id=er.event_id
      where e.year=${rule.year} and er.status='published' and er.player_id is not null
      group by er.player_id
    ), name_counts as (
      select full_name,count(*)::int as name_count from public.players where merged_into_player_id is null group by full_name
    ), base as (
      select p.id,p.full_name,
        case when nc.name_count>1 then p.full_name || ' ' || coalesce(p.identity_no_last4,upper(right(nullif(p.identity_no_masked,''),4)),'待补') else p.full_name end as display_name,
        lg.group_name,rs.event_count,coalesce(ps.prize_cents,0)::bigint as prize_cents,
        (rs.event_count * ${rule.participationPoints} + floor(coalesce(ps.prize_cents,0)::numeric / ${unitCents})::int * ${rule.prizePointsPerUnit})::int as total_points,
        coalesce(p.player_code,'') as player_code
      from reg_stats rs
      join public.players p on p.id=rs.player_id and p.merged_into_player_id is null
      join latest_group lg on lg.player_id=p.id
      join name_counts nc on nc.full_name=p.full_name
      left join prize_stats ps on ps.player_id=p.id
    ), grouped as (
      select * from base where (${group}='all' or group_name=${group})
    ), ranked as (
      select grouped.*,dense_rank() over(order by total_points desc)::int as points_rank from grouped
    ), searched as (
      select * from ranked where ${query}='' or full_name ilike ${search} or player_code ilike ${search}
    )
    select searched.*,count(*) over()::int as filtered_total
    from searched order by points_rank,prize_cents desc,full_name,id limit ${pageSize} offset ${offset}
  `;
  return { items: rows.map(mapRow), filteredTotal: Number(rows[0]?.filtered_total ?? 0), page, pageSize, year: rule.year, scope, eventId: null, rule };
}

export async function getPlayerPointsDetailFast(inputPrincipal: AdminPrincipalInput, playerId: string, input: {
  eventId?: string | null;
  scope?: string;
  year?: number;
}, knownEvents?: AdminNavEvent[]): Promise<PlayerPointsDetail | null> {
  const [{ principal, events, scope, eventId }, rule] = await Promise.all([
    resolveWorkspace(inputPrincipal, input.eventId, input.scope, knownEvents),
    loadRule(input.year),
  ]);
  const sql = getSqlClient();
  if (principal.role !== "system_admin") {
    if (!eventId || !events.some((event) => event.id === eventId)) return null;
    const allowed = await sql<Array<{ ok: number }>>`
      select 1 as ok from public.registrations where player_id=${playerId} and event_id=${eventId} and status='approved' limit 1
    `;
    if (!allowed[0]) return null;
  }

  const players = await sql<Array<{ id: string; full_name: string; identity_no_last4: string | null; identity_no_masked: string | null }>>`
    select id,full_name,identity_no_last4,identity_no_masked from public.players
    where id=${playerId} and merged_into_player_id is null limit 1
  `;
  const player = players[0];
  if (!player) return null;

  const history = scope === "event" && eventId
    ? await sql<HistoryRow[]>`
        select r.event_id,e.short_title as event_title,e.start_date,eg.name as group_name,
          er.placement_label,coalesce(er.prize_amount_cents,0)::bigint as prize_cents,er.display_order
        from public.registrations r
        join public.events e on e.id=r.event_id
        join public.event_groups eg on eg.id=r.group_id
        left join public.event_rankings er on er.event_id=r.event_id and er.group_id=r.group_id and er.player_id=r.player_id and er.status='published'
        where r.player_id=${playerId} and r.status='approved' and r.event_id=${eventId}
        order by e.start_date desc
      `
    : await sql<HistoryRow[]>`
        select r.event_id,e.short_title as event_title,e.start_date,eg.name as group_name,
          er.placement_label,coalesce(er.prize_amount_cents,0)::bigint as prize_cents,er.display_order
        from public.registrations r
        join public.events e on e.id=r.event_id
        join public.event_groups eg on eg.id=r.group_id
        left join public.event_rankings er on er.event_id=r.event_id and er.group_id=r.group_id and er.player_id=r.player_id and er.status='published'
        where r.player_id=${playerId} and r.status='approved' and e.year=${rule.year}
        order by e.start_date desc,r.event_id desc
      `;

  const unitCents = rule.prizeUnitYuan * 100;
  const calculated = history.map((row) => {
    const prizeCents = Number(row.prize_cents || 0);
    return {
      eventId: row.event_id,
      eventTitle: row.event_title,
      startDate: row.start_date,
      groupName: row.group_name,
      placementLabel: row.placement_label,
      prizeCents,
      points: rule.participationPoints + Math.floor(prizeCents / unitCents) * rule.prizePointsPerUnit,
      displayOrder: row.display_order,
    };
  });
  const best = [...calculated].filter((event) => event.placementLabel && event.displayOrder != null).sort((a,b) => Number(a.displayOrder) - Number(b.displayOrder))[0];
  const nameCount = await sql<Array<{ n: number | string }>>`
    select count(*)::int as n from public.players where merged_into_player_id is null and full_name=${player.full_name}
  `;
  const last4 = player.identity_no_last4 || (player.identity_no_masked ? player.identity_no_masked.slice(-4).toUpperCase() : null);
  const displayName = Number(nameCount[0]?.n || 0) > 1 ? `${player.full_name} ${last4 || "待补"}` : player.full_name;
  return {
    id: player.id,
    fullName: player.full_name,
    displayName,
    groupName: calculated[0]?.groupName || null,
    eventCount: calculated.length,
    totalPrizeCents: calculated.reduce((sum,event) => sum + event.prizeCents,0),
    totalPoints: calculated.reduce((sum,event) => sum + event.points,0),
    bestResult: best?.placementLabel || null,
    events: calculated.map((event) => ({
      eventId: event.eventId,
      eventTitle: event.eventTitle,
      startDate: event.startDate,
      groupName: event.groupName,
      placementLabel: event.placementLabel,
      prizeCents: event.prizeCents,
      points: event.points,
    })),
  };
}
