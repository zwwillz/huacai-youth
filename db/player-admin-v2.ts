import { createHash } from "node:crypto";
import { getAdminNavigationEvents } from "./admin-ui";
import { getSqlClient } from "./index";

export type PlayerAdminScope = "event" | "all";
export type PlayerAdminGroup = "all" | "少年组" | "青年组";

export type PlayerAdminListItem = {
  id: string;
  playerCode: string;
  fullName: string;
  displayName: string;
  gender: string | null;
  phone: string | null;
  groupName: string | null;
  identityDisplay: string;
  profileStatus: string;
};

export type PlayerAdminPageData = {
  items: PlayerAdminListItem[];
  filteredTotal: number;
  page: number;
  pageSize: number;
  scope: PlayerAdminScope;
  eventId: string | null;
};

export type PlayerAdminDetail = {
  id: string;
  playerCode: string;
  fullName: string;
  nickname: string | null;
  gender: string | null;
  birthDate: string | null;
  nationalityCode: string;
  province: string | null;
  city: string | null;
  identityType: string | null;
  identityNumber: string | null;
  identityLast4: string | null;
  identityReviewStatus: string;
  phone: string | null;
  email: string | null;
  wechatId: string | null;
  guardianName: string | null;
  guardianRelationship: string | null;
  guardianPhone: string | null;
  clubName: string | null;
  schoolName: string | null;
  mentorName: string | null;
  profileStatus: string;
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

function now() { return new Date().toISOString(); }
function newId(prefix: string) { return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`; }

async function getAccount(username: string) {
  const sql = getSqlClient();
  const rows = await sql<AccountRow[]>`
    select id, role from public.users
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
    if (!eventId) return { items: [], filteredTotal: 0, page, pageSize, scope, eventId: null };
    const rows = await sql<ListRow[]>`
      with name_counts as (
        select full_name, count(*)::int as name_count
        from public.players where merged_into_player_id is null group by full_name
      ), filtered as (
        select distinct on (p.id)
          p.id, p.player_code, p.full_name,
          case when nc.name_count > 1
            then p.full_name || ' ' || coalesce(p.identity_no_last4, upper(right(nullif(p.identity_no_masked, ''), 4)), '待补')
            else p.full_name end as display_name,
          p.gender, p.phone, eg.name as group_name,
          case
            when nullif(p.identity_no_masked, '') is null then '待补'
            when length(p.identity_no_masked) <= 8 then p.identity_no_masked
            else left(p.identity_no_masked, 4) || repeat('*', greatest(length(p.identity_no_masked) - 8, 3)) || right(p.identity_no_masked, 4)
          end as identity_display,
          p.profile_status
        from public.registrations r
        join public.players p on p.id = r.player_id
        join public.event_groups eg on eg.id = r.group_id
        join name_counts nc on nc.full_name = p.full_name
        where r.event_id = ${eventId}
          and r.status <> 'withdrawn'
          and p.merged_into_player_id is null
          and (${group} = 'all' or eg.name = ${group})
          and (
            ${query} = '' or p.full_name ilike ${search} or coalesce(p.player_code, '') ilike ${search}
            or coalesce(p.phone, '') ilike ${search} or coalesce(p.identity_no_last4, '') ilike ${search}
            or coalesce(p.identity_no_masked, '') ilike ${search}
            or exists (select 1 from public.guardians g where g.player_id = p.id and (g.full_name ilike ${search} or g.phone ilike ${search}))
          )
        order by p.id, eg.name
      )
      select filtered.*, count(*) over()::int as filtered_total
      from filtered order by full_name asc, id asc
      limit ${pageSize} offset ${offset}
    `;
    return { items: rows.map(mapListRow), filteredTotal: Number(rows[0]?.filtered_total ?? 0), page, pageSize, scope, eventId };
  }

  const rows = await sql<ListRow[]>`
    with latest_reg as (
      select distinct on (r.player_id) r.player_id, eg.name as group_name
      from public.registrations r
      join public.events e on e.id = r.event_id
      join public.event_groups eg on eg.id = r.group_id
      where r.status <> 'withdrawn'
      order by r.player_id, e.start_date desc, r.event_id desc
    ), name_counts as (
      select full_name, count(*)::int as name_count
      from public.players where merged_into_player_id is null group by full_name
    ), filtered as (
      select p.id, p.player_code, p.full_name,
        case when nc.name_count > 1
          then p.full_name || ' ' || coalesce(p.identity_no_last4, upper(right(nullif(p.identity_no_masked, ''), 4)), '待补')
          else p.full_name end as display_name,
        p.gender, p.phone, lr.group_name,
        case
          when nullif(p.identity_no_masked, '') is null then '待补'
          when length(p.identity_no_masked) <= 8 then p.identity_no_masked
          else left(p.identity_no_masked, 4) || repeat('*', greatest(length(p.identity_no_masked) - 8, 3)) || right(p.identity_no_masked, 4)
        end as identity_display,
        p.profile_status
      from public.players p
      left join latest_reg lr on lr.player_id = p.id
      join name_counts nc on nc.full_name = p.full_name
      where p.merged_into_player_id is null
        and (${group} = 'all' or lr.group_name = ${group})
        and (
          ${query} = '' or p.full_name ilike ${search} or coalesce(p.player_code, '') ilike ${search}
          or coalesce(p.phone, '') ilike ${search} or coalesce(p.identity_no_last4, '') ilike ${search}
          or coalesce(p.identity_no_masked, '') ilike ${search}
          or exists (select 1 from public.guardians g where g.player_id = p.id and (g.full_name ilike ${search} or g.phone ilike ${search}))
        )
    )
    select filtered.*, count(*) over()::int as filtered_total
    from filtered order by full_name asc, id asc
    limit ${pageSize} offset ${offset}
  `;
  return { items: rows.map(mapListRow), filteredTotal: Number(rows[0]?.filtered_total ?? 0), page, pageSize, scope, eventId };
}

export async function getPlayerAdminDetail(username: string, playerId: string, eventId?: string | null): Promise<PlayerAdminDetail | null> {
  const { account, events, eventId: safeEventId } = await requirePlayerWorkspace(username, eventId);
  const sql = getSqlClient();
  if (account.role !== "system_admin") {
    if (!safeEventId || !events.some((event) => event.id === safeEventId)) return null;
    const permitted = await sql<{ ok: number }[]>`
      select 1 as ok from public.registrations
      where player_id = ${playerId} and event_id = ${safeEventId} and status <> 'withdrawn' limit 1
    `;
    if (!permitted[0]) return null;
  }

  const players = await sql<Array<{
    id: string; player_code: string | null; full_name: string; nickname: string | null; gender: string | null;
    birth_date: string | null; nationality_code: string | null; province: string | null; city: string | null;
    identity_type: string | null; identity_no_masked: string | null; identity_no_last4: string | null;
    identity_review_status: string | null; phone: string | null; email: string | null; wechat_id: string | null;
    club_name: string | null; school_name: string | null; mentor_name: string | null; profile_status: string;
    guardian_name: string | null; guardian_relationship: string | null; guardian_phone: string | null;
  }>>`
    select p.id, p.player_code, p.full_name, p.nickname, p.gender, p.birth_date, p.nationality_code,
           p.province, p.city, p.identity_type, p.identity_no_masked, p.identity_no_last4,
           p.identity_review_status, p.phone, p.email, p.wechat_id, p.club_name, p.school_name,
           p.mentor_name, p.profile_status,
           g.full_name as guardian_name, g.relationship as guardian_relationship, g.phone as guardian_phone
    from public.players p
    left join lateral (
      select full_name, relationship, phone from public.guardians
      where player_id = p.id order by is_primary desc, created_at asc limit 1
    ) g on true
    where p.id = ${playerId} and p.merged_into_player_id is null limit 1
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
        left join public.event_rankings er on er.event_id = r.event_id and er.group_id = r.group_id and er.player_id = r.player_id
        where r.player_id = ${playerId} and r.status <> 'withdrawn'
        order by e.start_date desc, r.event_id desc
      `
    : await sql<Array<{ event_id: string; event_title: string; start_date: string; group_name: string; registration_status: string; placement_label: string | null }>>`
        select r.event_id, e.short_title as event_title, e.start_date, eg.name as group_name,
               r.status as registration_status, er.placement_label
        from public.registrations r
        join public.events e on e.id = r.event_id
        join public.event_groups eg on eg.id = r.group_id
        left join public.event_rankings er on er.event_id = r.event_id and er.group_id = r.group_id and er.player_id = r.player_id
        where r.player_id = ${playerId} and r.event_id = ${safeEventId} and r.status <> 'withdrawn'
        order by e.start_date desc, r.event_id desc
      `;

  return {
    id: player.id,
    playerCode: player.player_code || player.id.slice(-6).toUpperCase(),
    fullName: player.full_name,
    nickname: player.nickname,
    gender: player.gender,
    birthDate: player.birth_date,
    nationalityCode: player.nationality_code || "CN",
    province: player.province,
    city: player.city,
    identityType: player.identity_type,
    identityNumber: player.identity_no_masked,
    identityLast4: player.identity_no_last4 || (player.identity_no_masked ? player.identity_no_masked.slice(-4).toUpperCase() : null),
    identityReviewStatus: player.identity_review_status || "missing",
    phone: player.phone,
    email: player.email,
    wechatId: player.wechat_id,
    guardianName: player.guardian_name,
    guardianRelationship: player.guardian_relationship,
    guardianPhone: player.guardian_phone,
    clubName: player.club_name,
    schoolName: player.school_name,
    mentorName: player.mentor_name,
    profileStatus: player.profile_status,
    events: history.map((row) => ({ eventId: row.event_id, eventTitle: row.event_title, startDate: row.start_date, groupName: row.group_name, registrationStatus: row.registration_status, placementLabel: row.placement_label })),
  };
}

async function assertIdentityAvailable(identityType: string, identityNo: string, excludePlayerId?: string) {
  const sql = getSqlClient();
  const normalized = normalizedIdentity(identityType, identityNo);
  const rows = await sql<Array<{ id: string }>>`
    select id from public.players
    where merged_into_player_id is null
      and (${excludePlayerId || ""} = '' or id <> ${excludePlayerId || ""})
      and (identity_unique_key = ${normalized.key} or upper(btrim(coalesce(identity_no_masked, ''))) = ${normalized.number})
    limit 1
  `;
  if (rows[0]) throw new Error("该身份证/护照号码已经关联其他球员，请先核对或后续使用球员合并功能处理。");
  return normalized;
}

async function generatePlayerCode(seed: string) {
  const sql = getSqlClient();
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const hex = createHash("sha256").update(`${seed}:${attempt}`).digest("hex").slice(0, 12);
    const code = BigInt(`0x${hex}`).toString(36).toUpperCase().padStart(6, "0").slice(-6);
    const rows = await sql<Array<{ id: string }>>`select id from public.players where player_code = ${code} limit 1`;
    if (!rows[0]) return code;
  }
  throw new Error("暂时无法生成唯一球员编号，请重试。");
}

function normalizeGuardian(input: { guardianName?: string; guardianRelationship?: string; guardianPhone?: string }) {
  const name = input.guardianName?.trim() || "";
  const relationship = input.guardianRelationship?.trim() || "";
  const phone = input.guardianPhone?.trim() || "";
  if (!name && !relationship && !phone) return null;
  if (!name || !relationship || !phone) throw new Error("家长信息填写后，家长姓名、关系和联系方式都需要填写。");
  return { name, relationship, phone };
}

async function savePrimaryGuardian(playerId: string, guardian: { name: string; relationship: string; phone: string } | null, timestamp: string) {
  if (!guardian) return;
  const sql = getSqlClient();
  const existing = await sql<Array<{ id: string }>>`
    select id from public.guardians where player_id = ${playerId}
    order by is_primary desc, created_at asc limit 1
  `;
  if (existing[0]) {
    await sql`update public.guardians set full_name = ${guardian.name}, relationship = ${guardian.relationship}, phone = ${guardian.phone}, is_primary = true, updated_at = ${timestamp} where id = ${existing[0].id}`;
  } else {
    await sql`insert into public.guardians (id, player_id, full_name, relationship, phone, is_primary, created_at, updated_at) values (${newId("gua")}, ${playerId}, ${guardian.name}, ${guardian.relationship}, ${guardian.phone}, true, ${timestamp}, ${timestamp})`;
  }
}

type PlayerMutationInput = {
  fullName: string; nickname?: string; gender?: string; birthDate?: string; nationalityCode?: string;
  province?: string; city?: string; identityType?: string; identityNo?: string; phone?: string; email?: string;
  wechatId?: string; guardianName?: string; guardianRelationship?: string; guardianPhone?: string;
  clubName?: string; schoolName?: string; mentorName?: string;
};

export async function createAdminPlayer(username: string, input: PlayerMutationInput & { identityType: string; identityNo: string }) {
  const account = await getAccount(username);
  if (account.role !== "system_admin") throw new Error("仅系统管理员可以直接新增球员。");
  const fullName = input.fullName.trim();
  if (!fullName) throw new Error("请填写球员姓名。");
  const guardian = normalizeGuardian(input);
  const identity = await assertIdentityAvailable(input.identityType, input.identityNo);
  const sql = getSqlClient();
  const createdAt = now();
  const playerId = newId("ply");
  const playerCode = await generatePlayerCode(playerId);
  await sql`
    insert into public.players (
      id, player_code, full_name, nickname, gender, birth_date, nationality_code, province, city,
      identity_no_masked, identity_type, identity_no_last4, identity_unique_key, identity_review_status,
      phone, email, wechat_id, club_name, school_name, mentor_name, profile_status, created_at, updated_at
    ) values (
      ${playerId}, ${playerCode}, ${fullName}, ${input.nickname?.trim() || null}, ${input.gender?.trim() || null},
      ${input.birthDate?.trim() || null}, ${(input.nationalityCode || "CN").trim().toUpperCase()}, ${input.province?.trim() || null}, ${input.city?.trim() || null},
      ${identity.number}, ${identity.identityType}, ${identity.last4}, ${identity.key}, 'verified',
      ${input.phone?.trim() || null}, ${input.email?.trim() || null}, ${input.wechatId?.trim() || null},
      ${input.clubName?.trim() || null}, ${input.schoolName?.trim() || null}, ${input.mentorName?.trim() || null}, 'approved', ${createdAt}, ${createdAt}
    )
  `;
  await savePrimaryGuardian(playerId, guardian, createdAt);
  await sql`insert into public.audit_logs (id, actor_user_id, event_id, module_type, target_type, target_id, action, after_json, created_at) values (${newId("log")}, ${account.id}, null, 'players', 'player', ${playerId}, 'create_player', ${JSON.stringify({ playerCode, fullName, identityType: identity.identityType, identityLast4: identity.last4 })}, ${createdAt})`;
  return playerId;
}

export async function updateAdminPlayer(username: string, input: PlayerMutationInput & { playerId: string; eventId?: string | null; profileStatus?: string }) {
  const { account, eventId } = await requirePlayerWorkspace(username, input.eventId);
  const sql = getSqlClient();
  if (account.role !== "system_admin") {
    if (!eventId) throw new Error("请先选择赛事。");
    const permitted = await sql<{ ok: number }[]>`select 1 as ok from public.registrations where player_id = ${input.playerId} and event_id = ${eventId} and status <> 'withdrawn' limit 1`;
    if (!permitted[0]) throw new Error("当前账号只能修改所分配赛事中的球员资料。");
  }
  const fullName = input.fullName.trim();
  if (!fullName) throw new Error("请填写球员姓名。");
  const guardian = normalizeGuardian(input);
  const updatedAt = now();
  const profileStatus = ["approved", "pending", "disabled"].includes(input.profileStatus || "") ? input.profileStatus! : "approved";
  const identity = input.identityNo?.trim() ? await assertIdentityAvailable(input.identityType || "id_card", input.identityNo, input.playerId) : null;

  if (identity) {
    await sql`
      update public.players set
        full_name = ${fullName}, nickname = ${input.nickname?.trim() || null}, gender = ${input.gender?.trim() || null}, birth_date = ${input.birthDate?.trim() || null},
        nationality_code = ${(input.nationalityCode || "CN").trim().toUpperCase()}, province = ${input.province?.trim() || null}, city = ${input.city?.trim() || null},
        identity_no_masked = ${identity.number}, identity_type = ${identity.identityType}, identity_no_last4 = ${identity.last4}, identity_unique_key = ${identity.key}, identity_review_status = 'verified',
        phone = ${input.phone?.trim() || null}, email = ${input.email?.trim() || null}, wechat_id = ${input.wechatId?.trim() || null},
        club_name = ${input.clubName?.trim() || null}, school_name = ${input.schoolName?.trim() || null}, mentor_name = ${input.mentorName?.trim() || null},
        profile_status = ${profileStatus}, updated_at = ${updatedAt}
      where id = ${input.playerId} and merged_into_player_id is null
    `;
  } else {
    await sql`
      update public.players set
        full_name = ${fullName}, nickname = ${input.nickname?.trim() || null}, gender = ${input.gender?.trim() || null}, birth_date = ${input.birthDate?.trim() || null},
        nationality_code = ${(input.nationalityCode || "CN").trim().toUpperCase()}, province = ${input.province?.trim() || null}, city = ${input.city?.trim() || null},
        phone = ${input.phone?.trim() || null}, email = ${input.email?.trim() || null}, wechat_id = ${input.wechatId?.trim() || null},
        club_name = ${input.clubName?.trim() || null}, school_name = ${input.schoolName?.trim() || null}, mentor_name = ${input.mentorName?.trim() || null},
        profile_status = ${profileStatus}, updated_at = ${updatedAt}
      where id = ${input.playerId} and merged_into_player_id is null
    `;
  }
  await savePrimaryGuardian(input.playerId, guardian, updatedAt);
  await sql`insert into public.audit_logs (id, actor_user_id, event_id, module_type, target_type, target_id, action, after_json, created_at) values (${newId("log")}, ${account.id}, ${eventId}, 'players', 'player', ${input.playerId}, 'update_player', ${JSON.stringify({ fullName, identityChanged: Boolean(identity) })}, ${updatedAt})`;
  return { ok: true };
}
