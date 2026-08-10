import { createHash } from "node:crypto";
import { getAdminNavigationEventsForPrincipal } from "./admin-principal-ui";
import { getSqlClient } from "./index";
import { assertAdminRole, resolveAdminPrincipal, type AdminPrincipalInput } from "./permissions";
import type { AdminNavEvent } from "./admin-ui";

export type PlayerArchiveScope = "event" | "all";
export type PlayerArchiveGroup = "all" | "少年组" | "青年组";
export type PlayerProfileGroup = "少年组" | "青年组";

export type PlayerArchiveListItem = {
  id: string;
  playerCode: string;
  fullName: string;
  displayName: string;
  gender: string | null;
  phone: string | null;
  groupName: string | null;
  identityDisplay: string;
  profileStatus: "approved" | "disabled";
};

export type PlayerArchivePageData = {
  items: PlayerArchiveListItem[];
  filteredTotal: number;
  page: number;
  pageSize: number;
  scope: PlayerArchiveScope;
  eventId: string | null;
};

export type PlayerArchiveDetail = {
  id: string;
  playerCode: string;
  fullName: string;
  nickname: string | null;
  gender: string | null;
  birthDate: string | null;
  nationalityCode: string;
  province: string | null;
  city: string | null;
  currentGroupName: string | null;
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
  profileStatus: "approved" | "disabled";
  events: Array<{
    eventId: string;
    eventTitle: string;
    startDate: string;
    groupName: string;
    registrationStatus: string;
    placementLabel: string | null;
  }>;
};

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
  currentGroupName: string | null;
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
  events: PlayerArchiveDetail["events"] | null;
};

type PlayerMutationInput = {
  fullName: string;
  nickname?: string;
  gender?: string;
  birthDate?: string;
  nationalityCode?: string;
  province?: string;
  city?: string;
  groupName?: string;
  identityType?: string;
  identityNo?: string;
  phone?: string;
  email?: string;
  wechatId?: string;
  guardianName?: string;
  guardianRelationship?: string;
  guardianPhone?: string;
  clubName?: string;
  schoolName?: string;
  mentorName?: string;
  profileStatus?: string;
};

function normalizeScope(value: string | undefined, role: string): PlayerArchiveScope {
  return role === "system_admin" && value === "all" ? "all" : "event";
}

function normalizeGroupFilter(value: string | undefined): PlayerArchiveGroup {
  return value === "少年组" || value === "青年组" ? value : "all";
}

function normalizeProfileGroup(value: string | undefined): PlayerProfileGroup | null {
  return value === "少年组" || value === "青年组" ? value : null;
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

async function resolveWorkspace(inputPrincipal: AdminPrincipalInput, requestedEventId?: string | null, requestedScope?: string, knownEvents?: AdminNavEvent[]) {
  const principal = await resolveAdminPrincipal(inputPrincipal);
  assertAdminRole(principal, ["system_admin", "committee"], "当前账号没有球员档案管理权限。");
  const events = knownEvents ?? await getAdminNavigationEventsForPrincipal(principal);
  const requestedEvent = requestedEventId && events.some((event) => event.id === requestedEventId) ? requestedEventId : null;
  const scope = normalizeScope(requestedScope, principal.role);
  const eventId = scope === "event" ? (requestedEvent || events[0]?.id || null) : null;
  return { principal, events, scope, eventId };
}

export async function getPlayerArchivePage(inputPrincipal: AdminPrincipalInput, input: {
  eventId?: string | null;
  scope?: string;
  group?: string;
  query?: string;
  page?: number;
  pageSize?: number;
}, knownEvents?: AdminNavEvent[]): Promise<PlayerArchivePageData> {
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
        p.gender,p.phone,coalesce(p.current_group_name,lr.group_name) as group_name,
        case when nullif(p.identity_no_masked,'') is null then '待补'
          when length(p.identity_no_masked)<=8 then p.identity_no_masked
          else left(p.identity_no_masked,4) || repeat('*',greatest(length(p.identity_no_masked)-8,3)) || right(p.identity_no_masked,4) end as identity_display,
        p.profile_status
      from public.players p left join latest_reg lr on lr.player_id=p.id join name_counts nc on nc.full_name=p.full_name
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

export async function getPlayerArchiveDetail(inputPrincipal: AdminPrincipalInput, playerId: string, requestedEventId?: string | null, knownEvents?: AdminNavEvent[]): Promise<PlayerArchiveDetail | null> {
  const principal = await resolveAdminPrincipal(inputPrincipal);
  assertAdminRole(principal, ["system_admin", "committee"], "当前账号没有球员档案管理权限。");
  const events = knownEvents ?? await getAdminNavigationEventsForPrincipal(principal);
  const safeEventId = requestedEventId && events.some((event) => event.id === requestedEventId) ? requestedEventId : events[0]?.id ?? null;
  if (principal.role !== "system_admin" && !safeEventId) return null;
  const sql = getSqlClient();
  const rows = await sql<DetailRow[]>`
    select p.id,p.player_code as "playerCode",p.full_name as "fullName",p.nickname,p.gender,p.birth_date as "birthDate",
      p.nationality_code as "nationalityCode",p.province,p.city,p.current_group_name as "currentGroupName",
      p.identity_type as "identityType",p.identity_no_masked as "identityNumber",p.identity_no_last4 as "identityLast4",
      p.identity_review_status as "identityReviewStatus",p.phone,p.email,p.wechat_id as "wechatId",
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
    gender: normalizeGender(player.gender),
    birthDate: player.birthDate,
    nationalityCode: player.nationalityCode || "CN",
    province: player.province,
    city: player.city,
    currentGroupName: normalizeProfileGroup(player.currentGroupName || undefined),
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
    profileStatus: normalizeProfileStatus(player.profileStatus),
    events: player.events ?? [],
  };
}

async function assertIdentityAvailable(identityType: string, identityNo: string, excludePlayerId?: string) {
  const sql = getSqlClient();
  const identity = normalizedIdentity(identityType, identityNo);
  const rows = await sql<Array<{ id: string }>>`
    select id from public.players where merged_into_player_id is null
      and (${excludePlayerId || ""}='' or id<>${excludePlayerId || ""})
      and (identity_unique_key=${identity.key} or upper(btrim(coalesce(identity_no_masked,'')))=${identity.number})
    limit 1
  `;
  if (rows[0]) throw new Error("该身份证/护照号码已经关联其他球员，请先核对或使用球员合并功能处理。");
  return identity;
}

async function generatePlayerCode(seed: string) {
  const sql = getSqlClient();
  for (let attempt=0; attempt<20; attempt+=1) {
    const hex = createHash("sha256").update(`${seed}:${attempt}`).digest("hex").slice(0,12);
    const code = BigInt(`0x${hex}`).toString(36).toUpperCase().padStart(6,"0").slice(-6);
    const rows = await sql<Array<{ id: string }>>`select id from public.players where player_code=${code} limit 1`;
    if (!rows[0]) return code;
  }
  throw new Error("暂时无法生成唯一球员编号，请重试。");
}

function normalizeGuardian(input: PlayerMutationInput) {
  const name = input.guardianName?.trim() || "";
  const relationship = input.guardianRelationship?.trim() || "";
  const phone = input.guardianPhone?.trim() || "";
  if (!name && !relationship && !phone) return null;
  if (!name || !relationship || !phone) throw new Error("家长信息填写后，家长姓名、关系和联系方式都需要填写。");
  return { name, relationship, phone };
}

async function savePrimaryGuardian(playerId: string, guardian: { name: string; relationship: string; phone: string } | null, timestamp: string) {
  const sql = getSqlClient();
  if (!guardian) {
    await sql`delete from public.guardians where player_id=${playerId}`;
    return;
  }
  const existing = await sql<Array<{ id: string }>>`select id from public.guardians where player_id=${playerId} order by is_primary desc,created_at asc limit 1`;
  if (existing[0]) {
    await sql`update public.guardians set full_name=${guardian.name},relationship=${guardian.relationship},phone=${guardian.phone},is_primary=true,updated_at=${timestamp} where id=${existing[0].id}`;
  } else {
    await sql`insert into public.guardians (id,player_id,full_name,relationship,phone,is_primary,created_at,updated_at) values (${newId("gua")},${playerId},${guardian.name},${guardian.relationship},${guardian.phone},true,${timestamp},${timestamp})`;
  }
}

async function updateRegistrationGroup(playerId: string, eventId: string, groupName: PlayerProfileGroup) {
  const sql = getSqlClient();
  const rows = await sql<Array<{ registration_id: string; current_group_id: string; current_group_name: string; current_roster_status: string | null; target_group_id: string | null; target_roster_status: string | null }>>`
    select r.id as registration_id,r.group_id as current_group_id,cg.name as current_group_name,cg.participant_roster_status as current_roster_status,
      tg.id as target_group_id,tg.participant_roster_status as target_roster_status
    from public.registrations r
    join public.event_groups cg on cg.id=r.group_id
    left join public.event_groups tg on tg.event_id=r.event_id and tg.name=${groupName}
    where r.player_id=${playerId} and r.event_id=${eventId} and r.status<>'withdrawn'
    order by r.created_at desc limit 1
  `;
  const row = rows[0];
  if (!row || row.current_group_name === groupName) return;
  if (!row.target_group_id) throw new Error("当前赛事没有找到对应组别配置。");
  if (row.current_roster_status === "locked" || row.target_roster_status === "locked") {
    throw new Error("当前赛事参赛人员已经锁定，不能在球员档案里修改本站组别。请先到参赛人员页面处理锁定状态。");
  }
  await sql`update public.registrations set group_id=${row.target_group_id},updated_at=${now()} where id=${row.registration_id}`;
}

export async function createPlayerArchive(inputPrincipal: AdminPrincipalInput, input: PlayerMutationInput & { identityType: string; identityNo: string; groupName: string }) {
  const principal = await resolveAdminPrincipal(inputPrincipal);
  assertAdminRole(principal, ["system_admin"], "只有系统管理员可以新增球员档案。");
  const fullName = input.fullName.trim();
  if (!fullName) throw new Error("请填写球员姓名。");
  const groupName = normalizeProfileGroup(input.groupName);
  if (!groupName) throw new Error("请选择球员当前组别。");
  const guardian = normalizeGuardian(input);
  const identity = await assertIdentityAvailable(input.identityType, input.identityNo);
  const sql = getSqlClient();
  const createdAt = now();
  const playerId = newId("ply");
  const playerCode = await generatePlayerCode(playerId);
  const gender = normalizeGender(input.gender);
  const profileStatus = normalizeProfileStatus(input.profileStatus);
  await sql`
    insert into public.players (
      id,player_code,full_name,nickname,gender,birth_date,nationality_code,province,city,current_group_name,
      identity_no_masked,identity_type,identity_no_last4,identity_unique_key,identity_review_status,
      phone,email,wechat_id,club_name,school_name,mentor_name,profile_status,created_at,updated_at
    ) values (
      ${playerId},${playerCode},${fullName},${input.nickname?.trim() || null},${gender},${input.birthDate?.trim() || null},
      ${(input.nationalityCode || "CN").trim().toUpperCase()},${input.province?.trim() || null},${input.city?.trim() || null},${groupName},
      ${identity.number},${identity.identityType},${identity.last4},${identity.key},'verified',
      ${input.phone?.trim() || null},${input.email?.trim() || null},${input.wechatId?.trim() || null},
      ${input.clubName?.trim() || null},${input.schoolName?.trim() || null},${input.mentorName?.trim() || null},${profileStatus},${createdAt},${createdAt}
    )
  `;
  await savePrimaryGuardian(playerId, guardian, createdAt);
  await sql`insert into public.audit_logs (id,actor_user_id,event_id,module_type,target_type,target_id,action,after_json,created_at) values (${newId("log")},${principal.id},null,'players','player',${playerId},'create_player',${JSON.stringify({ playerCode, fullName, groupName })},${createdAt})`;
  return playerId;
}

export async function updatePlayerArchive(inputPrincipal: AdminPrincipalInput, playerId: string, input: PlayerMutationInput & { eventId?: string | null; groupName: string }) {
  const principal = await resolveAdminPrincipal(inputPrincipal);
  assertAdminRole(principal, ["system_admin", "committee"], "当前账号没有球员档案编辑权限。");
  const events = await getAdminNavigationEventsForPrincipal(principal);
  const eventId = input.eventId && events.some((event) => event.id === input.eventId) ? input.eventId : null;
  const sql = getSqlClient();
  if (principal.role !== "system_admin") {
    if (!eventId) throw new Error("请先选择赛事。");
    const permitted = await sql<Array<{ ok: number }>>`select 1 as ok from public.registrations where player_id=${playerId} and event_id=${eventId} and status<>'withdrawn' limit 1`;
    if (!permitted[0]) throw new Error("当前账号只能修改所分配赛事中的球员资料。");
  }
  const fullName = input.fullName.trim();
  if (!fullName) throw new Error("请填写球员姓名。");
  const groupName = normalizeProfileGroup(input.groupName);
  if (!groupName) throw new Error("请选择球员当前组别。");
  const guardian = normalizeGuardian(input);
  const identity = input.identityNo?.trim() ? await assertIdentityAvailable(input.identityType || "id_card", input.identityNo, playerId) : null;
  const updatedAt = now();
  const gender = normalizeGender(input.gender);
  const profileStatus = normalizeProfileStatus(input.profileStatus);

  if (eventId) await updateRegistrationGroup(playerId, eventId, groupName);

  if (identity) {
    await sql`update public.players set full_name=${fullName},nickname=${input.nickname?.trim() || null},gender=${gender},birth_date=${input.birthDate?.trim() || null},
      nationality_code=${(input.nationalityCode || "CN").trim().toUpperCase()},province=${input.province?.trim() || null},city=${input.city?.trim() || null},current_group_name=${groupName},
      identity_no_masked=${identity.number},identity_type=${identity.identityType},identity_no_last4=${identity.last4},identity_unique_key=${identity.key},identity_review_status='verified',
      phone=${input.phone?.trim() || null},email=${input.email?.trim() || null},wechat_id=${input.wechatId?.trim() || null},club_name=${input.clubName?.trim() || null},
      school_name=${input.schoolName?.trim() || null},mentor_name=${input.mentorName?.trim() || null},profile_status=${profileStatus},updated_at=${updatedAt}
      where id=${playerId} and merged_into_player_id is null`;
  } else {
    await sql`update public.players set full_name=${fullName},nickname=${input.nickname?.trim() || null},gender=${gender},birth_date=${input.birthDate?.trim() || null},
      nationality_code=${(input.nationalityCode || "CN").trim().toUpperCase()},province=${input.province?.trim() || null},city=${input.city?.trim() || null},current_group_name=${groupName},
      phone=${input.phone?.trim() || null},email=${input.email?.trim() || null},wechat_id=${input.wechatId?.trim() || null},club_name=${input.clubName?.trim() || null},
      school_name=${input.schoolName?.trim() || null},mentor_name=${input.mentorName?.trim() || null},profile_status=${profileStatus},updated_at=${updatedAt}
      where id=${playerId} and merged_into_player_id is null`;
  }
  await savePrimaryGuardian(playerId, guardian, updatedAt);
  await sql`insert into public.audit_logs (id,actor_user_id,event_id,module_type,target_type,target_id,action,after_json,created_at) values (${newId("log")},${principal.id},${eventId},'players','player',${playerId},'update_player',${JSON.stringify({ fullName, groupName, identityChanged: Boolean(identity) })},${updatedAt})`;
  return { ok: true };
}
