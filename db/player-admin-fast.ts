import { getSqlClient } from "./index";
import { getAdminNavigationEventsForPrincipal } from "./admin-principal-ui";
import { assertAdminRole, resolveAdminPrincipal, type AdminPrincipalInput } from "./permissions";
import type { AdminNavEvent } from "./admin-ui";
import type { PlayerAdminDetail, PlayerAdminGroup, PlayerAdminListItem, PlayerAdminPageData, PlayerAdminScope } from "./player-admin-v2";

type ListRow = {
  id: string;
  player_code: string | null;
  full_name: string;
  display_name: string;
  gender: string | null;
  phone: string | null;
  group_name: string | null;
  identity_display: string | null;
  profile_status: string;
  filtered_total: number | string;
};
type DetailRow = {
  id: string;
  playerCode: string | null;
  fullName: string;
  nickname: string | null;
  gender: string | null;
  birthDate: string | null;
  nationalityCode: string | null;
  province: string | null;
  city: string | null;
  identityType: string | null;
  identityNumber: string | null;
  identityLast4: string | null;
  identityReviewStatus: string | null;
  phone: string | null;
  email: string | null;
  wechatId: string | null;
  clubName: string | null;
  schoolName: string | null;
  mentorName: string | null;
  profileStatus: string;
  guardianName: string | null;
  guardianRelationship: string | null;
  guardianPhone: string | null;
  events: PlayerAdminDetail["events"] | null;
};

function normalizeScope(value: string | undefined, role: string): PlayerAdminScope {
  return role === "system_admin" && value === "all" ? "all" : "event";
}
function normalizeGroup(value: string | undefined): PlayerAdminGroup {
  return value === "少年组" || value === "青年组" ? value : "all";
}
function mapListRow(row: ListRow): PlayerAdminListItem {
  return {
    id: row.id,
    playerCode: row.player_code || row.id.slice(-6).toUpperCase(),
    fullName: row.full_name,
    displayName: row.display_name,
    gender: row.gender,
    phone: row.phone,
    groupName: row.group_name,
    identityDisplay: row.identity_display || "待补",
    profileStatus: row.profile_status,
  };
}

export async function getPlayerAdminPageFast(inputPrincipal: AdminPrincipalInput, input: {
  eventId?: string | null;
  scope?: string;
  group?: string;
  query?: string;
  page?: number;
  pageSize?: number;
}, knownEvents?: AdminNavEvent[]): Promise<PlayerAdminPageData> {
  const principal = await resolveAdminPrincipal(inputPrincipal);
  assertAdminRole(principal, ["system_admin", "committee"], "当前账号没有球员资料管理权限。");
  const events = knownEvents ?? await getAdminNavigationEventsForPrincipal(principal);
  const eventId = input.eventId && events.some((event) => event.id === input.eventId) ? input.eventId : events[0]?.id ?? null;
  const scope = normalizeScope(input.scope, principal.role);
  const group = normalizeGroup(input.group);
  const query = (input.query || "").trim();
  const search = `%${query}%`;
  const pageSize = Math.min(80, Math.max(20, input.pageSize || 40));
  const page = Math.max(1, input.page || 1);
  const offset = (page - 1) * pageSize;
  const sql = getSqlClient();

  if (scope === "event") {
    if (!eventId) return { items: [], filteredTotal: 0, page, pageSize, scope, eventId: null };
    const rows = await sql<ListRow[]>`
      with name_counts as (
        select full_name,count(*)::int as name_count from public.players where merged_into_player_id is null group by full_name
      ), filtered as (
        select distinct on (p.id)
          p.id,p.player_code,p.full_name,
          case when nc.name_count>1 then p.full_name || ' ' || coalesce(p.identity_no_last4,upper(right(nullif(p.identity_no_masked,''),4)),'待补') else p.full_name end as display_name,
          p.gender,p.phone,eg.name as group_name,
          case when nullif(p.identity_no_masked,'') is null then '待补'
            when length(p.identity_no_masked)<=8 then p.identity_no_masked
            else left(p.identity_no_masked,4) || repeat('*',greatest(length(p.identity_no_masked)-8,3)) || right(p.identity_no_masked,4) end as identity_display,
          p.profile_status
        from public.registrations r
        join public.players p on p.id=r.player_id
        join public.event_groups eg on eg.id=r.group_id
        join name_counts nc on nc.full_name=p.full_name
        where r.event_id=${eventId} and r.status<>'withdrawn' and p.merged_into_player_id is null
          and (${group}='all' or eg.name=${group})
          and (${query}='' or p.full_name ilike ${search} or coalesce(p.player_code,'') ilike ${search}
            or coalesce(p.phone,'') ilike ${search} or coalesce(p.identity_no_last4,'') ilike ${search}
            or coalesce(p.identity_no_masked,'') ilike ${search}
            or exists(select 1 from public.guardians g where g.player_id=p.id and (g.full_name ilike ${search} or g.phone ilike ${search})))
        order by p.id,eg.name
      )
      select filtered.*,count(*) over()::int as filtered_total
      from filtered order by full_name,id limit ${pageSize} offset ${offset}
    `;
    return { items: rows.map(mapListRow), filteredTotal: Number(rows[0]?.filtered_total ?? 0), page, pageSize, scope, eventId };
  }

  const rows = await sql<ListRow[]>`
    with latest_reg as (
      select distinct on (r.player_id) r.player_id,eg.name as group_name
      from public.registrations r join public.events e on e.id=r.event_id join public.event_groups eg on eg.id=r.group_id
      where r.status<>'withdrawn' order by r.player_id,e.start_date desc,r.event_id desc
    ), name_counts as (
      select full_name,count(*)::int as name_count from public.players where merged_into_player_id is null group by full_name
    ), filtered as (
      select p.id,p.player_code,p.full_name,
        case when nc.name_count>1 then p.full_name || ' ' || coalesce(p.identity_no_last4,upper(right(nullif(p.identity_no_masked,''),4)),'待补') else p.full_name end as display_name,
        p.gender,p.phone,lr.group_name,
        case when nullif(p.identity_no_masked,'') is null then '待补'
          when length(p.identity_no_masked)<=8 then p.identity_no_masked
          else left(p.identity_no_masked,4) || repeat('*',greatest(length(p.identity_no_masked)-8,3)) || right(p.identity_no_masked,4) end as identity_display,
        p.profile_status
      from public.players p left join latest_reg lr on lr.player_id=p.id join name_counts nc on nc.full_name=p.full_name
      where p.merged_into_player_id is null
        and (${group}='all' or lr.group_name=${group})
        and (${query}='' or p.full_name ilike ${search} or coalesce(p.player_code,'') ilike ${search}
          or coalesce(p.phone,'') ilike ${search} or coalesce(p.identity_no_last4,'') ilike ${search}
          or coalesce(p.identity_no_masked,'') ilike ${search}
          or exists(select 1 from public.guardians g where g.player_id=p.id and (g.full_name ilike ${search} or g.phone ilike ${search})))
    )
    select filtered.*,count(*) over()::int as filtered_total from filtered
    order by full_name,id limit ${pageSize} offset ${offset}
  `;
  return { items: rows.map(mapListRow), filteredTotal: Number(rows[0]?.filtered_total ?? 0), page, pageSize, scope, eventId };
}

export async function getPlayerAdminDetailFast(inputPrincipal: AdminPrincipalInput, playerId: string, requestedEventId?: string | null, knownEvents?: AdminNavEvent[]): Promise<PlayerAdminDetail | null> {
  const principal = await resolveAdminPrincipal(inputPrincipal);
  assertAdminRole(principal, ["system_admin", "committee"], "当前账号没有球员资料管理权限。");
  const events = knownEvents ?? await getAdminNavigationEventsForPrincipal(principal);
  const safeEventId = requestedEventId && events.some((event) => event.id === requestedEventId) ? requestedEventId : events[0]?.id ?? null;
  if (principal.role !== "system_admin" && !safeEventId) return null;
  const sql = getSqlClient();
  const rows = await sql<DetailRow[]>`
    select p.id,p.player_code as "playerCode",p.full_name as "fullName",p.nickname,p.gender,p.birth_date as "birthDate",
      p.nationality_code as "nationalityCode",p.province,p.city,p.identity_type as "identityType",p.identity_no_masked as "identityNumber",
      p.identity_no_last4 as "identityLast4",p.identity_review_status as "identityReviewStatus",p.phone,p.email,p.wechat_id as "wechatId",
      p.club_name as "clubName",p.school_name as "schoolName",p.mentor_name as "mentorName",p.profile_status as "profileStatus",
      g.full_name as "guardianName",g.relationship as "guardianRelationship",g.phone as "guardianPhone",
      coalesce((select jsonb_agg(jsonb_build_object(
        'eventId',r.event_id,'eventTitle',e.short_title,'startDate',e.start_date,'groupName',eg.name,
        'registrationStatus',r.status,'placementLabel',er.placement_label
      ) order by e.start_date desc,r.event_id desc)
        from public.registrations r
        join public.events e on e.id=r.event_id
        join public.event_groups eg on eg.id=r.group_id
        left join public.event_rankings er on er.event_id=r.event_id and er.group_id=r.group_id and er.player_id=r.player_id
        where r.player_id=p.id and r.status<>'withdrawn' and (${principal.role}='system_admin' or r.event_id=${safeEventId || ""})
      ),'[]'::jsonb) as events
    from public.players p
    left join lateral (
      select full_name,relationship,phone from public.guardians where player_id=p.id order by is_primary desc,created_at asc limit 1
    ) g on true
    where p.id=${playerId} and p.merged_into_player_id is null
      and (${principal.role}='system_admin' or exists(
        select 1 from public.registrations access_r where access_r.player_id=p.id and access_r.event_id=${safeEventId || ""} and access_r.status<>'withdrawn'
      ))
    limit 1
  `;
  const player = rows[0];
  if (!player) return null;
  return {
    id: player.id,
    playerCode: player.playerCode || player.id.slice(-6).toUpperCase(),
    fullName: player.fullName,
    nickname: player.nickname,
    gender: player.gender,
    birthDate: player.birthDate,
    nationalityCode: player.nationalityCode || "CN",
    province: player.province,
    city: player.city,
    identityType: player.identityType,
    identityNumber: player.identityNumber,
    identityLast4: player.identityLast4 || (player.identityNumber ? player.identityNumber.slice(-4).toUpperCase() : null),
    identityReviewStatus: player.identityReviewStatus || "missing",
    phone: player.phone,
    email: player.email,
    wechatId: player.wechatId,
    guardianName: player.guardianName,
    guardianRelationship: player.guardianRelationship,
    guardianPhone: player.guardianPhone,
    clubName: player.clubName,
    schoolName: player.schoolName,
    mentorName: player.mentorName,
    profileStatus: player.profileStatus,
    events: player.events ?? [],
  };
}
