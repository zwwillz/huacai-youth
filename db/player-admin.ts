import { createHash } from "node:crypto";
import { getAdminNavigationEvents } from "./admin-ui";
import { getSqlClient } from "./index";

export type PlayerAdminScope = "event" | "all";
export type PlayerAdminGroup = "all" | "少年组" | "青年组";

export type PlayerAdminListItem = {
  id: string;
  fullName: string;
  displayName: string;
  gender: string | null;
  birthDate: string | null;
  province: string | null;
  city: string | null;
  clubName: string | null;
  schoolName: string | null;
  phone: string | null;
  groupName: string | null;
  eventCount: number;
  identityType: string | null;
  identityLast4: string | null;
  identityReviewStatus: string;
  profileStatus: string;
};

export type PlayerAdminStats = {
  total: number;
  youth: number;
  young: number;
  identityConflict: number;
  identityMissing: number;
};

export type PlayerAdminPageData = {
  items: PlayerAdminListItem[];
  stats: PlayerAdminStats;
  filteredTotal: number;
  page: number;
  pageSize: number;
  scope: PlayerAdminScope;
  eventId: string | null;
};

export type PlayerAdminDetail = {
  id: string;
  fullName: string;
  gender: string | null;
  birthDate: string | null;
  province: string | null;
  city: string | null;
  clubName: string | null;
  schoolName: string | null;
  phone: string | null;
  email: string | null;
  nationalityCode: string;
  identityType: string | null;
  identityLast4: string | null;
  identityReviewStatus: string;
  profileStatus: string;
  guardianName: string | null;
  guardianRelationship: string | null;
  guardianPhone: string | null;
  events: Array<{
    eventId: string;
    eventTitle: string;
    startDate: string;
    groupName: string;
    registrationStatus: string;
    placementLabel: string | null;
  }>;
};

type AccountRow = { id: string; role: string };
type ListRow = {
  id: string;
  full_name: string;
  display_name: string;
  gender: string | null;
  birth_date: string | null;
  province: string | null;
  city: string | null;
  club_name: string | null;
  school_name: string | null;
  phone: string | null;
  group_name: string | null;
  event_count: number | string | null;
  identity_type: string | null;
  identity_no_last4: string | null;
  identity_review_status: string | null;
  profile_status: string;
  filtered_total: number | string;
};

type StatsRow = {
  total: number | string;
  youth: number | string;
  young: number | string;
  identity_conflict: number | string;
  identity_missing: number | string;
};

function normalizeScope(value: string | undefined, role: string): PlayerAdminScope {
  return role === "system_admin" && value === "all" ? "all" : "event";
}

function normalizeGroup(value: string | undefined): PlayerAdminGroup {
  return value === "少年组" || value === "青年组" ? value : "all";
}

function normalizedIdentity(type: string, value: string) {
  const identityType = type === "passport" ? "passport" : "id_card";
  const number = value.replace(/\s+/g, "").toUpperCase();
  if (identityType === "id_card" && !/^\d{17}[\dX]$/.test(number)) throw new Error("身份证号码需为18位有效格式。");
  if (identityType === "passport" && !/^[A-Z0-9]{5,32}$/.test(number)) throw new Error("护照号码需为5至32位字母或数字。");
  const key = createHash("sha256").update(`${identityType}:${number}`).digest("hex");
  return { identityType, number, key, last4: number.slice(-4) };
}

function now() {
  return new Date().toISOString();
}

function newId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

async function getAccount(username: string) {
  const sql = getSqlClient();
  const rows = await sql<AccountRow[]>`
    select id, role
    from public.users
    where username = ${username} and status = 'active'
    limit 1
  `;
  const account = rows[0];
  if (!account) throw new Error("当前账号尚未获得后台权限。");
  return account;
}

async function requirePlayerWorkspace(username: string, requestedEventId?: string | null) {
  const [account, events] = await Promise.all([getAccount(username), getAdminNavigationEvents(username)]);
  if (account.role === "referee") throw new Error("裁判账号没有球员资料管理权限。");
  const eventId = requestedEventId && events.some((event) => event.id === requestedEventId)
    ? requestedEventId
    : events[0]?.id ?? null;
  return { account, events, eventId };
}

function mapListRow(row: ListRow): PlayerAdminListItem {
  return {
    id: row.id,
    fullName: row.full_name,
    displayName: row.display_name,
    gender: row.gender,
    birthDate: row.birth_date,
    province: row.province,
    city: row.city,
    clubName: row.club_name,
    schoolName: row.school_name,
    phone: row.phone,
    groupName: row.group_name,
    eventCount: Number(row.event_count ?? 0),
    identityType: row.identity_type,
    identityLast4: row.identity_no_last4,
    identityReviewStatus: row.identity_review_status || "missing",
    profileStatus: row.profile_status,
  };
}

function mapStats(row: StatsRow | undefined): PlayerAdminStats {
  return {
    total: Number(row?.total ?? 0),
    youth: Number(row?.youth ?? 0),
    young: Number(row?.young ?? 0),
    identityConflict: Number(row?.identity_conflict ?? 0),
    identityMissing: Number(row?.identity_missing ?? 0),
  };
}

export async function getPlayerAdminPage(username: string, input: {
  eventId?: string | null;
  scope?: string;
  group?: string;
  query?: string;
  page?: number;
  pageSize?: number;
}): Promise<PlayerAdminPageData> {
  const { account, eventId } = await requirePlayerWorkspace(username, input.eventId);
  const scope = normalizeScope(input.scope, account.role);
  const group = normalizeGroup(input.group);
  const query = (input.query || "").trim();
  const search = `%${query}%`;
  const pageSize = Math.min(80, Math.max(20, input.pageSize || 40));
  const page = Math.max(1, input.page || 1);
  const offset = (page - 1) * pageSize;
  const sql = getSqlClient();

  if (scope === "event") {
    if (!eventId) return { items: [], stats: mapStats(undefined), filteredTotal: 0, page, pageSize, scope, eventId: null };

    const [statsRows, listRows] = await Promise.all([
      sql<StatsRow[]>`
        select
          count(distinct p.id)::int as total,
          count(distinct p.id) filter (where eg.name = '少年组')::int as youth,
          count(distinct p.id) filter (where eg.name = '青年组')::int as young,
          count(distinct p.id) filter (where p.identity_review_status = 'conflict')::int as identity_conflict,
          count(distinct p.id) filter (where p.identity_review_status = 'missing')::int as identity_missing
        from public.registrations r
        join public.players p on p.id = r.player_id
        join public.event_groups eg on eg.id = r.group_id
        where r.event_id = ${eventId}
          and r.status <> 'withdrawn'
          and p.merged_into_player_id is null
      `,
      sql<ListRow[]>`
        with name_counts as (
          select full_name, count(*)::int as name_count
          from public.players
          where merged_into_player_id is null
          group by full_name
        ), filtered as (
          select distinct on (p.id)
            p.id, p.full_name,
            case
              when nc.name_count > 1 then p.full_name || ' ' || coalesce(p.identity_no_last4, upper(right(nullif(p.identity_no_masked, ''), 4)), '证件待补')
              else p.full_name
            end as display_name,
            p.gender, p.birth_date, p.province, p.city, p.club_name, p.school_name, p.phone,
            eg.name as group_name,
            1::int as event_count,
            p.identity_type, coalesce(p.identity_no_last4, upper(right(nullif(p.identity_no_masked, ''), 4))) as identity_no_last4,
            p.identity_review_status, p.profile_status
          from public.registrations r
          join public.players p on p.id = r.player_id
          join public.event_groups eg on eg.id = r.group_id
          join name_counts nc on nc.full_name = p.full_name
          where r.event_id = ${eventId}
            and r.status <> 'withdrawn'
            and p.merged_into_player_id is null
            and (${group} = 'all' or eg.name = ${group})
            and (
              ${query} = ''
              or p.full_name ilike ${search}
              or coalesce(p.phone, '') ilike ${search}
              or coalesce(p.identity_no_last4, '') ilike ${search}
              or coalesce(p.identity_no_masked, '') ilike ${search}
              or exists (
                select 1 from public.guardians g
                where g.player_id = p.id
                  and (g.full_name ilike ${search} or g.phone ilike ${search})
              )
            )
          order by p.id, eg.name
        )
        select filtered.*, count(*) over()::int as filtered_total
        from filtered
        order by full_name asc, id asc
        limit ${pageSize} offset ${offset}
      `,
    ]);
    return {
      items: listRows.map(mapListRow),
      stats: mapStats(statsRows[0]),
      filteredTotal: Number(listRows[0]?.filtered_total ?? 0),
      page,
      pageSize,
      scope,
      eventId,
    };
  }

  const [statsRows, listRows] = await Promise.all([
    sql<StatsRow[]>`
      with latest_reg as (
        select distinct on (r.player_id) r.player_id, eg.name as group_name
        from public.registrations r
        join public.events e on e.id = r.event_id
        join public.event_groups eg on eg.id = r.group_id
        where r.status <> 'withdrawn'
        order by r.player_id, e.start_date desc, r.event_id desc
      )
      select
        count(*)::int as total,
        count(*) filter (where lr.group_name = '少年组')::int as youth,
        count(*) filter (where lr.group_name = '青年组')::int as young,
        count(*) filter (where p.identity_review_status = 'conflict')::int as identity_conflict,
        count(*) filter (where p.identity_review_status = 'missing')::int as identity_missing
      from public.players p
      left join latest_reg lr on lr.player_id = p.id
      where p.merged_into_player_id is null
    `,
    sql<ListRow[]>`
      with latest_reg as (
        select distinct on (r.player_id) r.player_id, eg.name as group_name
        from public.registrations r
        join public.events e on e.id = r.event_id
        join public.event_groups eg on eg.id = r.group_id
        where r.status <> 'withdrawn'
        order by r.player_id, e.start_date desc, r.event_id desc
      ), event_counts as (
        select player_id, count(distinct event_id)::int as event_count
        from public.registrations
        where status <> 'withdrawn'
        group by player_id
      ), name_counts as (
        select full_name, count(*)::int as name_count
        from public.players
        where merged_into_player_id is null
        group by full_name
      ), filtered as (
        select
          p.id, p.full_name,
          case
            when nc.name_count > 1 then p.full_name || ' ' || coalesce(p.identity_no_last4, upper(right(nullif(p.identity_no_masked, ''), 4)), '证件待补')
            else p.full_name
          end as display_name,
          p.gender, p.birth_date, p.province, p.city, p.club_name, p.school_name, p.phone,
          lr.group_name,
          coalesce(ec.event_count, 0)::int as event_count,
          p.identity_type, coalesce(p.identity_no_last4, upper(right(nullif(p.identity_no_masked, ''), 4))) as identity_no_last4,
          p.identity_review_status, p.profile_status
        from public.players p
        left join latest_reg lr on lr.player_id = p.id
        left join event_counts ec on ec.player_id = p.id
        join name_counts nc on nc.full_name = p.full_name
        where p.merged_into_player_id is null
          and (${group} = 'all' or lr.group_name = ${group})
          and (
            ${query} = ''
            or p.full_name ilike ${search}
            or coalesce(p.phone, '') ilike ${search}
            or coalesce(p.identity_no_last4, '') ilike ${search}
            or coalesce(p.identity_no_masked, '') ilike ${search}
            or exists (
              select 1 from public.guardians g
              where g.player_id = p.id
                and (g.full_name ilike ${search} or g.phone ilike ${search})
            )
          )
      )
      select filtered.*, count(*) over()::int as filtered_total
      from filtered
      order by full_name asc, id asc
      limit ${pageSize} offset ${offset}
    `,
  ]);

  return {
    items: listRows.map(mapListRow),
    stats: mapStats(statsRows[0]),
    filteredTotal: Number(listRows[0]?.filtered_total ?? 0),
    page,
    pageSize,
    scope,
    eventId,
  };
}

export async function getPlayerAdminDetail(username: string, playerId: string, eventId?: string | null): Promise<PlayerAdminDetail | null> {
  const { account, events, eventId: safeEventId } = await requirePlayerWorkspace(username, eventId);
  const sql = getSqlClient();

  if (account.role !== "system_admin") {
    if (!safeEventId || !events.some((event) => event.id === safeEventId)) return null;
    const permitted = await sql<{ ok: number }[]>`
      select 1 as ok
      from public.registrations
      where player_id = ${playerId} and event_id = ${safeEventId} and status <> 'withdrawn'
      limit 1
    `;
    if (!permitted[0]) return null;
  }

  const players = await sql<Array<{
    id: string;
    full_name: string;
    gender: string | null;
    birth_date: string | null;
    province: string | null;
    city: string | null;
    club_name: string | null;
    school_name: string | null;
    phone: string | null;
    email: string | null;
    nationality_code: string | null;
    identity_type: string | null;
    identity_no_last4: string | null;
    identity_no_masked: string | null;
    identity_review_status: string | null;
    profile_status: string;
    guardian_name: string | null;
    guardian_relationship: string | null;
    guardian_phone: string | null;
  }>>`
    select p.id, p.full_name, p.gender, p.birth_date, p.province, p.city, p.club_name, p.school_name,
           p.phone, p.email, p.nationality_code, p.identity_type, p.identity_no_last4, p.identity_no_masked,
           p.identity_review_status, p.profile_status,
           g.full_name as guardian_name, g.relationship as guardian_relationship, g.phone as guardian_phone
    from public.players p
    left join lateral (
      select full_name, relationship, phone
      from public.guardians
      where player_id = p.id
      order by is_primary desc, created_at asc
      limit 1
    ) g on true
    where p.id = ${playerId} and p.merged_into_player_id is null
    limit 1
  `;
  const player = players[0];
  if (!player) return null;

  const history = account.role === "system_admin"
    ? await sql<Array<{ event_id: string; event_title: string; start_date: string; group_name: string; registration_status: string; placement_label: string | null }>>`
        select r.event_id, e.short_title as event_title, e.start_date, eg.name as group_name,
               r.status as registration_status, er.placement_label
        from public.registrations r
        join public.events e on e.id = r.event_id
        join public.event_groups eg on eg.id = r.group_id
        left join public.event_rankings er
          on er.event_id = r.event_id and er.group_id = r.group_id and er.player_id = r.player_id
        where r.player_id = ${playerId} and r.status <> 'withdrawn'
        order by e.start_date desc, r.event_id desc
      `
    : await sql<Array<{ event_id: string; event_title: string; start_date: string; group_name: string; registration_status: string; placement_label: string | null }>>`
        select r.event_id, e.short_title as event_title, e.start_date, eg.name as group_name,
               r.status as registration_status, er.placement_label
        from public.registrations r
        join public.events e on e.id = r.event_id
        join public.event_groups eg on eg.id = r.group_id
        left join public.event_rankings er
          on er.event_id = r.event_id and er.group_id = r.group_id and er.player_id = r.player_id
        where r.player_id = ${playerId} and r.event_id = ${safeEventId} and r.status <> 'withdrawn'
        order by e.start_date desc, r.event_id desc
      `;

  return {
    id: player.id,
    fullName: player.full_name,
    gender: player.gender,
    birthDate: player.birth_date,
    province: player.province,
    city: player.city,
    clubName: player.club_name,
    schoolName: player.school_name,
    phone: player.phone,
    email: player.email,
    nationalityCode: player.nationality_code || "CN",
    identityType: player.identity_type,
    identityLast4: player.identity_no_last4 || (player.identity_no_masked ? player.identity_no_masked.slice(-4).toUpperCase() : null),
    identityReviewStatus: player.identity_review_status || "missing",
    profileStatus: player.profile_status,
    guardianName: player.guardian_name,
    guardianRelationship: player.guardian_relationship,
    guardianPhone: player.guardian_phone,
    events: history.map((row) => ({
      eventId: row.event_id,
      eventTitle: row.event_title,
      startDate: row.start_date,
      groupName: row.group_name,
      registrationStatus: row.registration_status,
      placementLabel: row.placement_label,
    })),
  };
}

async function assertIdentityAvailable(identityType: string, identityNo: string, excludePlayerId?: string) {
  const sql = getSqlClient();
  const normalized = normalizedIdentity(identityType, identityNo);
  const rows = await sql<Array<{ id: string }>>`
    select id
    from public.players
    where merged_into_player_id is null
      and (${excludePlayerId || ""} = '' or id <> ${excludePlayerId || ""})
      and (
        identity_unique_key = ${normalized.key}
        or upper(btrim(coalesce(identity_no_masked, ''))) = ${normalized.number}
      )
    limit 1
  `;
  if (rows[0]) throw new Error("该身份证/护照号码已经关联其他球员，请先核对或后续使用球员合并功能处理。");
  return normalized;
}

export async function createAdminPlayer(username: string, input: {
  fullName: string;
  gender?: string;
  birthDate?: string;
  province?: string;
  city?: string;
  clubName?: string;
  schoolName?: string;
  phone?: string;
  email?: string;
  nationalityCode?: string;
  identityType: string;
  identityNo: string;
}) {
  const account = await getAccount(username);
  if (account.role !== "system_admin") throw new Error("第一版仅系统管理员可以从球员总库直接新增球员。");
  const fullName = input.fullName.trim();
  if (!fullName) throw new Error("请填写球员姓名。");
  const identity = await assertIdentityAvailable(input.identityType, input.identityNo);
  const sql = getSqlClient();
  const createdAt = now();
  const playerId = newId("ply");
  await sql`
    insert into public.players (
      id, full_name, gender, birth_date, province, city, club_name, school_name, phone, email,
      nationality_code, identity_no_masked, identity_type, identity_no_last4, identity_unique_key,
      identity_review_status, profile_status, created_at, updated_at
    ) values (
      ${playerId}, ${fullName}, ${input.gender?.trim() || null}, ${input.birthDate?.trim() || null},
      ${input.province?.trim() || null}, ${input.city?.trim() || null}, ${input.clubName?.trim() || null},
      ${input.schoolName?.trim() || null}, ${input.phone?.trim() || null}, ${input.email?.trim() || null},
      ${(input.nationalityCode || "CN").trim().toUpperCase()}, ${identity.number}, ${identity.identityType},
      ${identity.last4}, ${identity.key}, 'verified', 'approved', ${createdAt}, ${createdAt}
    )
  `;
  await sql`
    insert into public.audit_logs (id, actor_user_id, event_id, module_type, target_type, target_id, action, after_json, created_at)
    values (${newId("log")}, ${account.id}, null, 'players', 'player', ${playerId}, 'create_player', ${JSON.stringify({ fullName, identityType: identity.identityType, identityLast4: identity.last4 })}, ${createdAt})
  `;
  return playerId;
}

export async function updateAdminPlayer(username: string, input: {
  playerId: string;
  eventId?: string | null;
  fullName: string;
  gender?: string;
  birthDate?: string;
  province?: string;
  city?: string;
  clubName?: string;
  schoolName?: string;
  phone?: string;
  email?: string;
  nationalityCode?: string;
  profileStatus?: string;
  identityType?: string;
  identityNo?: string;
}) {
  const { account, eventId } = await requirePlayerWorkspace(username, input.eventId);
  const sql = getSqlClient();
  if (account.role !== "system_admin") {
    if (!eventId) throw new Error("请先选择当前赛事。");
    const permitted = await sql<{ ok: number }[]>`
      select 1 as ok from public.registrations
      where player_id = ${input.playerId} and event_id = ${eventId} and status <> 'withdrawn'
      limit 1
    `;
    if (!permitted[0]) throw new Error("当前账号只能修改所分配赛事中的球员资料。");
  }

  const fullName = input.fullName.trim();
  if (!fullName) throw new Error("请填写球员姓名。");
  const updatedAt = now();
  const profileStatus = ["approved", "pending", "disabled"].includes(input.profileStatus || "") ? input.profileStatus! : "approved";
  const identity = input.identityNo?.trim()
    ? await assertIdentityAvailable(input.identityType || "id_card", input.identityNo, input.playerId)
    : null;

  if (identity) {
    await sql`
      update public.players
      set full_name = ${fullName}, gender = ${input.gender?.trim() || null}, birth_date = ${input.birthDate?.trim() || null},
          province = ${input.province?.trim() || null}, city = ${input.city?.trim() || null},
          club_name = ${input.clubName?.trim() || null}, school_name = ${input.schoolName?.trim() || null},
          phone = ${input.phone?.trim() || null}, email = ${input.email?.trim() || null},
          nationality_code = ${(input.nationalityCode || "CN").trim().toUpperCase()}, profile_status = ${profileStatus},
          identity_no_masked = ${identity.number}, identity_type = ${identity.identityType},
          identity_no_last4 = ${identity.last4}, identity_unique_key = ${identity.key}, identity_review_status = 'verified',
          updated_at = ${updatedAt}
      where id = ${input.playerId} and merged_into_player_id is null
    `;
  } else {
    await sql`
      update public.players
      set full_name = ${fullName}, gender = ${input.gender?.trim() || null}, birth_date = ${input.birthDate?.trim() || null},
          province = ${input.province?.trim() || null}, city = ${input.city?.trim() || null},
          club_name = ${input.clubName?.trim() || null}, school_name = ${input.schoolName?.trim() || null},
          phone = ${input.phone?.trim() || null}, email = ${input.email?.trim() || null},
          nationality_code = ${(input.nationalityCode || "CN").trim().toUpperCase()}, profile_status = ${profileStatus},
          updated_at = ${updatedAt}
      where id = ${input.playerId} and merged_into_player_id is null
    `;
  }

  await sql`
    insert into public.audit_logs (id, actor_user_id, event_id, module_type, target_type, target_id, action, after_json, created_at)
    values (${newId("log")}, ${account.id}, ${eventId}, 'players', 'player', ${input.playerId}, 'update_player', ${JSON.stringify({ fullName, identityChanged: Boolean(identity) })}, ${updatedAt})
  `;
  return { ok: true };
}
