import { getAdminNavigationEventsForPrincipal } from "./admin-principal-ui";
import { getSqlClient } from "./index";
import { assertAdminRole, resolveAdminPrincipal, type AdminPrincipalInput } from "./permissions";
import type { AdminNavEvent } from "./admin-ui";
import type {
  PlayerArchiveGroup,
  PlayerArchiveListItem,
  PlayerArchivePageData,
  PlayerArchiveScope,
} from "./player-archive";

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

function normalizeScope(value: string | undefined, role: string): PlayerArchiveScope {
  return role === "system_admin" && value === "all" ? "all" : "event";
}

function normalizeGroupFilter(value: string | undefined): PlayerArchiveGroup {
  return value === "少年组" || value === "青年组" ? value : "all";
}

function normalizeGender(value: string | null | undefined) {
  const normalized = (value || "").trim().toLowerCase();
  if (normalized === "male" || normalized === "男" || normalized === "m") return "男";
  if (normalized === "female" || normalized === "女" || normalized === "f") return "女";
  return null;
}

function normalizeProfileStatus(value: string | null | undefined): "approved" | "disabled" {
  return value === "disabled" ? "disabled" : "approved";
}

function mapListRow(row: ListRow): PlayerArchiveListItem {
  return {
    id: row.id,
    playerCode: row.player_code || row.id.slice(-6).toUpperCase(),
    fullName: row.full_name,
    displayName: row.display_name,
    gender: normalizeGender(row.gender),
    phone: row.phone,
    groupName: row.group_name,
    identityDisplay: row.identity_display || "待补",
    profileStatus: normalizeProfileStatus(row.profile_status),
  };
}

async function resolveWorkspace(
  inputPrincipal: AdminPrincipalInput,
  requestedEventId?: string | null,
  requestedScope?: string,
  knownEvents?: AdminNavEvent[],
) {
  const principal = await resolveAdminPrincipal(inputPrincipal);
  assertAdminRole(principal, ["system_admin", "committee"], "当前账号没有球员档案管理权限。");
  const events = knownEvents ?? await getAdminNavigationEventsForPrincipal(principal);
  const requestedEvent = requestedEventId && events.some((event) => event.id === requestedEventId) ? requestedEventId : null;
  const scope = normalizeScope(requestedScope, principal.role);
  const eventId = scope === "event" ? (requestedEvent || events[0]?.id || null) : null;
  return { scope, eventId };
}

/**
 * Formal player archive list.
 *
 * A players row may be created as soon as somebody submits a registration, but
 * it only enters the formal archive after at least one registration has been
 * approved. Event-scoped views are stricter: the registration for that event
 * itself must be approved.
 */
export async function getFormalPlayerArchivePage(
  inputPrincipal: AdminPrincipalInput,
  input: {
    eventId?: string | null;
    scope?: string;
    group?: string;
    query?: string;
    page?: number;
    pageSize?: number;
  },
  knownEvents?: AdminNavEvent[],
): Promise<PlayerArchivePageData> {
  const { scope, eventId } = await resolveWorkspace(inputPrincipal, input.eventId, input.scope, knownEvents);
  const group = normalizeGroupFilter(input.group);
  const query = (input.query || "").trim();
  const search = `%${query}%`;
  const pageSize = Math.min(80, Math.max(20, input.pageSize || 40));
  const page = Math.max(1, input.page || 1);
  const offset = (page - 1) * pageSize;
  const sql = getSqlClient();

  if (scope === "event") {
    if (!eventId) return { items: [], filteredTotal: 0, page, pageSize, scope, eventId: null };
    const rows = await sql<ListRow[]>`
      with formal_name_counts as (
        select p.full_name,count(*)::int as name_count
        from public.players p
        where p.merged_into_player_id is null
          and exists (
            select 1 from public.registrations formal_r
            where formal_r.player_id=p.id and formal_r.status='approved'
          )
        group by p.full_name
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
        join formal_name_counts nc on nc.full_name=p.full_name
        where r.event_id=${eventId} and r.status='approved' and p.merged_into_player_id is null
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
    with latest_approved_reg as (
      select distinct on (r.player_id) r.player_id,eg.name as group_name
      from public.registrations r
      join public.events e on e.id=r.event_id
      join public.event_groups eg on eg.id=r.group_id
      where r.status='approved'
      order by r.player_id,e.start_date desc,r.event_id desc
    ), formal_name_counts as (
      select p.full_name,count(*)::int as name_count
      from public.players p
      join latest_approved_reg lr on lr.player_id=p.id
      where p.merged_into_player_id is null
      group by p.full_name
    ), filtered as (
      select p.id,p.player_code,p.full_name,
        case when nc.name_count>1 then p.full_name || ' ' || coalesce(p.identity_no_last4,upper(right(nullif(p.identity_no_masked,''),4)),'待补') else p.full_name end as display_name,
        p.gender,p.phone,coalesce(p.current_group_name,lr.group_name) as group_name,
        case when nullif(p.identity_no_masked,'') is null then '待补'
          when length(p.identity_no_masked)<=8 then p.identity_no_masked
          else left(p.identity_no_masked,4) || repeat('*',greatest(length(p.identity_no_masked)-8,3)) || right(p.identity_no_masked,4) end as identity_display,
        p.profile_status
      from public.players p
      join latest_approved_reg lr on lr.player_id=p.id
      join formal_name_counts nc on nc.full_name=p.full_name
      where p.merged_into_player_id is null
        and (${group}='all' or coalesce(p.current_group_name,lr.group_name)=${group})
        and (${query}='' or p.full_name ilike ${search} or coalesce(p.player_code,'') ilike ${search}
          or coalesce(p.phone,'') ilike ${search} or coalesce(p.identity_no_last4,'') ilike ${search}
          or coalesce(p.identity_no_masked,'') ilike ${search}
          or exists(select 1 from public.guardians g where g.player_id=p.id and (g.full_name ilike ${search} or g.phone ilike ${search})))
    )
    select filtered.*,count(*) over()::int as filtered_total from filtered
    order by full_name,id limit ${pageSize} offset ${offset}
  `;
  return { items: rows.map(mapListRow), filteredTotal: Number(rows[0]?.filtered_total ?? 0), page, pageSize, scope, eventId: null };
}
