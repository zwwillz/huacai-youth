import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { getSqlClient } from "./index";
import { assertAdminRole, requireEventAccess, resolveAdminPrincipal, type AdminPrincipalInput } from "./permissions";

export type ParticipantRosterStatus = "draft" | "confirmed" | "locked";
export type ParticipantReviewFilter = "all" | "pending" | "approved" | "rejected" | "withdrawn";
export type ParticipantFeeFilter = "all" | "paid" | "unpaid" | "waived" | "unknown";

export type ParticipantGroupSummary = {
  id: string;
  name: string;
  code: string;
  rosterStatus: ParticipantRosterStatus;
  rosterCount: number;
  confirmedAt: string | null;
  lockedAt: string | null;
  totalCount: number;
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
  withdrawnCount: number;
  paidCount: number;
  unpaidCount: number;
  waivedCount: number;
  unknownFeeCount: number;
};

export type ParticipantRosterItem = {
  registrationId: string;
  playerId: string;
  fullName: string;
  gender: string | null;
  groupName: string;
  birthDate: string | null;
  age: number | null;
  phone: string | null;
  identityType: string | null;
  identityDisplay: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  feeStatus: string;
  reviewStatus: string;
  reviewNote: string | null;
  submittedAt: string;
};

export type ParticipantRosterPageData = {
  eventId: string;
  eventTitle: string;
  groups: ParticipantGroupSummary[];
  selectedGroupId: string;
  items: ParticipantRosterItem[];
  filteredTotal: number;
  page: number;
  pageSize: number;
  query: string;
  reviewFilter: ParticipantReviewFilter;
  feeFilter: ParticipantFeeFilter;
};

type RawRosterItem = Omit<ParticipantRosterItem, "age">;
type BundleRow = {
  eventTitle: string;
  selectedGroupId: string | null;
  groups: ParticipantGroupSummary[] | null;
  items: RawRosterItem[] | null;
  filteredTotal: number | string;
};
type RegistrationLockRow = {
  registrationId: string;
  playerId: string;
  groupId: string;
  status: string;
  feeStatus: string;
  reviewNote: string | null;
  rosterStatus: ParticipantRosterStatus;
};
type GroupLockRow = {
  id: string;
  name: string;
  rosterStatus: ParticipantRosterStatus;
  rosterCount: number;
};
type RosterStatsRow = {
  approvedCount: number | string;
  pendingCount: number | string;
  unresolvedCount: number | string;
  invalidProfileCount: number | string;
};

function newId(prefix: string) {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}
function now() {
  return new Date().toISOString();
}
function normalizeReviewFilter(value?: string | null): ParticipantReviewFilter {
  return value === "pending" || value === "approved" || value === "rejected" || value === "withdrawn" ? value : "all";
}
function normalizeFeeFilter(value?: string | null): ParticipantFeeFilter {
  return value === "paid" || value === "unpaid" || value === "waived" || value === "unknown" ? value : "all";
}
function normalizePage(value?: number) {
  return Number.isFinite(value) ? Math.max(1, Math.floor(value || 1)) : 1;
}
function ageFromBirthDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const current = new Date();
  if (!year || !month || !day) return null;
  let age = current.getUTCFullYear() - year;
  const currentMonth = current.getUTCMonth() + 1;
  const currentDay = current.getUTCDate();
  if (currentMonth < month || (currentMonth === month && currentDay < day)) age -= 1;
  return age >= 0 && age <= 100 ? age : null;
}

export async function getParticipantRosterPage(inputPrincipal: AdminPrincipalInput, input: {
  eventId: string;
  groupId?: string | null;
  query?: string | null;
  review?: string | null;
  fee?: string | null;
  page?: number;
  pageSize?: number;
}): Promise<ParticipantRosterPageData> {
  const principal = await resolveAdminPrincipal(inputPrincipal);
  await requireEventAccess(principal, input.eventId, {
    allowedRoles: ["system_admin", "committee"],
    deniedMessage: "当前账号没有参赛人员管理权限。",
  });
  const query = (input.query || "").trim().slice(0, 80);
  const search = `%${query}%`;
  const reviewFilter = normalizeReviewFilter(input.review);
  const feeFilter = normalizeFeeFilter(input.fee);
  const pageSize = Math.min(80, Math.max(20, input.pageSize || 40));
  const page = normalizePage(input.page);
  const offset = (page - 1) * pageSize;
  const requestedGroupId = input.groupId || "";
  const sql = getSqlClient();

  const rows = await sql<BundleRow[]>`
    with selected_group as (
      select eg.id
      from public.event_groups eg
      where eg.event_id=${input.eventId} and eg.status='active'
      order by case
        when eg.id=${requestedGroupId} then 0
        when eg.name='少年组' then 1
        when eg.name='青年组' then 2
        else 3 end,
        eg.name,eg.id
      limit 1
    ), group_stats as (
      select eg.id,eg.name,eg.code,
        eg.participant_roster_status as roster_status,
        eg.participant_roster_count as roster_count,
        eg.participant_roster_confirmed_at as confirmed_at,
        eg.participant_roster_locked_at as locked_at,
        count(r.id) filter (where p.id is not null and p.merged_into_player_id is null)::int as total_count,
        count(r.id) filter (where r.status='approved' and p.merged_into_player_id is null)::int as approved_count,
        count(r.id) filter (where r.status='pending' and p.merged_into_player_id is null)::int as pending_count,
        count(r.id) filter (where r.status='rejected' and p.merged_into_player_id is null)::int as rejected_count,
        count(r.id) filter (where r.status in ('withdrawn','cancelled','canceled') and p.merged_into_player_id is null)::int as withdrawn_count,
        count(r.id) filter (where r.fee_status='paid' and p.merged_into_player_id is null)::int as paid_count,
        count(r.id) filter (where r.fee_status='unpaid' and p.merged_into_player_id is null)::int as unpaid_count,
        count(r.id) filter (where r.fee_status in ('waived','exempt') and p.merged_into_player_id is null)::int as waived_count,
        count(r.id) filter (where r.fee_status not in ('paid','unpaid','waived','exempt') and p.merged_into_player_id is null)::int as unknown_fee_count
      from public.event_groups eg
      left join public.registrations r on r.event_id=eg.event_id and r.group_id=eg.id
      left join public.players p on p.id=r.player_id
      where eg.event_id=${input.eventId} and eg.status='active'
      group by eg.id,eg.name,eg.code,eg.participant_roster_status,eg.participant_roster_count,
        eg.participant_roster_confirmed_at,eg.participant_roster_locked_at
    ), filtered as (
      select r.id as registration_id,r.player_id,p.full_name,p.gender,p.birth_date,p.phone,p.identity_type,
        case
          when nullif(p.identity_no_masked,'') is null then null
          when position('*' in p.identity_no_masked)>0 or length(p.identity_no_masked)<=8 then p.identity_no_masked
          else left(p.identity_no_masked,4) || repeat('*',greatest(length(p.identity_no_masked)-8,3)) || right(p.identity_no_masked,4)
        end as identity_no_masked,
        eg.name as group_name,r.fee_status,r.status as review_status,r.review_note,r.submitted_at,
        g.full_name as guardian_name,g.phone as guardian_phone
      from public.registrations r
      join selected_group sg on sg.id=r.group_id
      join public.players p on p.id=r.player_id and p.merged_into_player_id is null
      join public.event_groups eg on eg.id=r.group_id
      left join lateral (
        select full_name,phone from public.guardians
        where player_id=p.id
        order by is_primary desc,created_at asc
        limit 1
      ) g on true
      where r.event_id=${input.eventId}
        and (
          ${reviewFilter}='all'
          or (${reviewFilter}='withdrawn' and r.status in ('withdrawn','cancelled','canceled'))
          or (${reviewFilter}<>'withdrawn' and r.status=${reviewFilter})
        )
        and (
          ${feeFilter}='all'
          or (${feeFilter}='waived' and r.fee_status in ('waived','exempt'))
          or (${feeFilter}='unknown' and r.fee_status not in ('paid','unpaid','waived','exempt'))
          or (${feeFilter} not in ('waived','unknown') and r.fee_status=${feeFilter})
        )
        and (
          ${query}='' or p.full_name ilike ${search} or coalesce(p.phone,'') ilike ${search}
          or coalesce(p.player_code,'') ilike ${search} or coalesce(p.identity_no_masked,'') ilike ${search}
          or coalesce(p.identity_no_last4,'') ilike ${search}
          or coalesce(g.full_name,'') ilike ${search} or coalesce(g.phone,'') ilike ${search}
        )
    ), page_rows as (
      select * from filtered
      order by full_name,registration_id
      limit ${pageSize} offset ${offset}
    )
    select e.short_title as "eventTitle",sg.id as "selectedGroupId",
      coalesce((select jsonb_agg(jsonb_build_object(
        'id',gs.id,'name',gs.name,'code',gs.code,'rosterStatus',gs.roster_status,'rosterCount',gs.roster_count,
        'confirmedAt',gs.confirmed_at,'lockedAt',gs.locked_at,'totalCount',gs.total_count,'approvedCount',gs.approved_count,
        'pendingCount',gs.pending_count,'rejectedCount',gs.rejected_count,'withdrawnCount',gs.withdrawn_count,
        'paidCount',gs.paid_count,'unpaidCount',gs.unpaid_count,'waivedCount',gs.waived_count,'unknownFeeCount',gs.unknown_fee_count
      ) order by case when gs.name='少年组' then 1 when gs.name='青年组' then 2 else 3 end,gs.name), '[]'::jsonb) as groups,
      coalesce((select jsonb_agg(jsonb_build_object(
        'registrationId',pr.registration_id,'playerId',pr.player_id,'fullName',pr.full_name,'gender',pr.gender,
        'groupName',pr.group_name,'birthDate',pr.birth_date,'phone',pr.phone,'identityType',pr.identity_type,
        'identityDisplay',pr.identity_no_masked,'guardianName',pr.guardian_name,'guardianPhone',pr.guardian_phone,
        'feeStatus',pr.fee_status,'reviewStatus',pr.review_status,'reviewNote',pr.review_note,'submittedAt',pr.submitted_at
      ) order by pr.full_name,pr.registration_id), '[]'::jsonb) as items,
      (select count(*)::int from filtered) as "filteredTotal"
    from public.events e
    left join selected_group sg on true
    where e.id=${input.eventId}
    limit 1
  `;
  const row = rows[0];
  if (!row) throw new Error("当前赛事不存在或已经不可用。");
  const groups = row.groups ?? [];
  const selectedGroupId = row.selectedGroupId || groups[0]?.id || "";
  return {
    eventId: input.eventId,
    eventTitle: row.eventTitle,
    groups,
    selectedGroupId,
    items: (row.items ?? []).map((item) => ({ ...item, age: ageFromBirthDate(item.birthDate) })),
    filteredTotal: Number(row.filteredTotal || 0),
    page,
    pageSize,
    query,
    reviewFilter,
    feeFilter,
  };
}

async function rosterStats(tx: postgres.TransactionSql, eventId: string, groupId: string) {
  const rows = await tx<RosterStatsRow[]>`
    select
      count(*) filter (where r.status='approved' and p.merged_into_player_id is null)::int as "approvedCount",
      count(*) filter (where r.status='pending' and p.merged_into_player_id is null)::int as "pendingCount",
      count(*) filter (where r.status not in ('approved','pending','rejected','withdrawn','cancelled','canceled') and p.merged_into_player_id is null)::int as "unresolvedCount",
      count(*) filter (where r.status='approved' and (p.id is null or p.merged_into_player_id is not null))::int as "invalidProfileCount"
    from public.registrations r
    left join public.players p on p.id=r.player_id
    where r.event_id=${eventId} and r.group_id=${groupId}
  `;
  return {
    approvedCount: Number(rows[0]?.approvedCount || 0),
    pendingCount: Number(rows[0]?.pendingCount || 0),
    unresolvedCount: Number(rows[0]?.unresolvedCount || 0),
    invalidProfileCount: Number(rows[0]?.invalidProfileCount || 0),
  };
}

export async function updateParticipantRegistration(inputPrincipal: AdminPrincipalInput, input: {
  eventId: string;
  groupId: string;
  registrationId: string;
  reviewStatus: string;
  feeStatus: string;
  reviewNote?: string | null;
}) {
  const principal = await resolveAdminPrincipal(inputPrincipal);
  await requireEventAccess(principal, input.eventId, { write: true, allowedRoles: ["system_admin", "committee"] });
  const reviewStatus = ["pending","approved","rejected","withdrawn"].includes(input.reviewStatus) ? input.reviewStatus : "";
  const feeStatus = ["unknown","unpaid","paid","waived"].includes(input.feeStatus) ? input.feeStatus : "";
  if (!reviewStatus || !feeStatus) throw new Error("审核或报名费状态无效。");
  const sql = getSqlClient();
  const changedAt = now();

  await sql.begin(async (tx) => {
    const rows = await tx<RegistrationLockRow[]>`
      select r.id as "registrationId",r.player_id as "playerId",r.group_id as "groupId",r.status,r.fee_status as "feeStatus",
        r.review_note as "reviewNote",eg.participant_roster_status as "rosterStatus"
      from public.registrations r
      join public.event_groups eg on eg.id=r.group_id and eg.event_id=r.event_id
      where r.id=${input.registrationId} and r.event_id=${input.eventId} and r.group_id=${input.groupId}
      for update of r,eg
    `;
    const before = rows[0];
    if (!before) throw new Error("报名记录不存在或已被调整。");
    if (before.rosterStatus === "locked") throw new Error("当前组别参赛名单已经锁定，不能再修改报名状态。");
    const reviewChanged = before.status !== reviewStatus;
    const nextReviewer = reviewStatus !== "pending" ? principal.id : null;
    const nextReviewedAt = reviewStatus !== "pending" ? changedAt : null;
    await tx`
      update public.registrations
      set status=${reviewStatus},fee_status=${feeStatus},review_note=${(input.reviewNote || "").trim() || null},
        reviewed_by=case when ${reviewChanged} then ${nextReviewer} else reviewed_by end,
        reviewed_at=case when ${reviewChanged} then ${nextReviewedAt} else reviewed_at end,
        updated_at=${changedAt}
      where id=${input.registrationId}
    `;
    if (before.rosterStatus === "confirmed") {
      await tx`
        update public.event_groups
        set participant_roster_status='draft',participant_roster_count=0,
          participant_roster_confirmed_by=null,participant_roster_confirmed_at=null,updated_at=${changedAt}
        where id=${input.groupId} and event_id=${input.eventId}
      `;
    }
    await tx`
      insert into public.audit_logs (id,actor_user_id,event_id,module_type,target_type,target_id,action,before_json,after_json,created_at)
      values (${newId("log")},${principal.id},${input.eventId},'participants','registration',${input.registrationId},'update_registration',
        ${JSON.stringify({ status: before.status, feeStatus: before.feeStatus, reviewNote: before.reviewNote })},
        ${JSON.stringify({ status: reviewStatus, feeStatus, reviewNote: (input.reviewNote || "").trim() || null })},${changedAt})
    `;
  });
}

export async function confirmParticipantRoster(inputPrincipal: AdminPrincipalInput, eventId: string, groupId: string) {
  const principal = await resolveAdminPrincipal(inputPrincipal);
  await requireEventAccess(principal, eventId, { write: true, allowedRoles: ["system_admin", "committee"] });
  const sql = getSqlClient();
  const confirmedAt = now();
  return sql.begin(async (tx) => {
    const rows = await tx<GroupLockRow[]>`
      select id,name,participant_roster_status as "rosterStatus",participant_roster_count as "rosterCount"
      from public.event_groups where id=${groupId} and event_id=${eventId} for update
    `;
    const group = rows[0];
    if (!group) throw new Error("当前参赛组别不存在。");
    if (group.rosterStatus === "locked") throw new Error("当前组别名单已经锁定，无需重复确认。");
    const stats = await rosterStats(tx, eventId, groupId);
    if (stats.pendingCount > 0) throw new Error(`还有 ${stats.pendingCount} 人待审核，请处理完成后再确认名单。`);
    if (stats.unresolvedCount > 0) throw new Error(`还有 ${stats.unresolvedCount} 条异常审核状态，请先处理。`);
    if (stats.invalidProfileCount > 0) throw new Error(`有 ${stats.invalidProfileCount} 条报名指向已合并或无效球员档案，请先处理。`);
    if (stats.approvedCount < 2) throw new Error("审核通过的参赛人员不足2人，暂不能确认正式名单。");
    await tx`
      update public.event_groups
      set participant_roster_status='confirmed',participant_roster_count=${stats.approvedCount},
        participant_roster_confirmed_by=${principal.id},participant_roster_confirmed_at=${confirmedAt},
        participant_roster_locked_by=null,participant_roster_locked_at=null,updated_at=${confirmedAt}
      where id=${groupId} and event_id=${eventId}
    `;
    await tx`
      insert into public.audit_logs (id,actor_user_id,event_id,module_type,target_type,target_id,action,after_json,created_at)
      values (${newId("log")},${principal.id},${eventId},'participants','event_group',${groupId},'confirm_participant_roster',
        ${JSON.stringify({ groupName: group.name, rosterCount: stats.approvedCount })},${confirmedAt})
    `;
    return stats.approvedCount;
  });
}

export async function lockParticipantRoster(inputPrincipal: AdminPrincipalInput, eventId: string, groupId: string) {
  const principal = await resolveAdminPrincipal(inputPrincipal);
  await requireEventAccess(principal, eventId, { write: true, allowedRoles: ["system_admin", "committee"] });
  const sql = getSqlClient();
  const lockedAt = now();
  return sql.begin(async (tx) => {
    const rows = await tx<GroupLockRow[]>`
      select id,name,participant_roster_status as "rosterStatus",participant_roster_count as "rosterCount"
      from public.event_groups where id=${groupId} and event_id=${eventId} for update
    `;
    const group = rows[0];
    if (!group) throw new Error("当前参赛组别不存在。");
    if (group.rosterStatus === "locked") return group.rosterCount;
    if (group.rosterStatus !== "confirmed") throw new Error("请先确认当前组别的正式参赛名单，再进行锁定。");
    const stats = await rosterStats(tx, eventId, groupId);
    if (stats.pendingCount > 0 || stats.unresolvedCount > 0 || stats.invalidProfileCount > 0) throw new Error("名单确认后出现了新的异常状态，请重新检查并确认名单。");
    if (stats.approvedCount !== group.rosterCount) throw new Error("当前审核通过人数与已确认名单人数不一致，请重新确认名单。");
    await tx`
      update public.event_groups
      set participant_roster_status='locked',participant_roster_count=${stats.approvedCount},
        participant_roster_locked_by=${principal.id},participant_roster_locked_at=${lockedAt},updated_at=${lockedAt}
      where id=${groupId} and event_id=${eventId}
    `;
    await tx`
      insert into public.audit_logs (id,actor_user_id,event_id,module_type,target_type,target_id,action,after_json,created_at)
      values (${newId("log")},${principal.id},${eventId},'participants','event_group',${groupId},'lock_participant_roster',
        ${JSON.stringify({ groupName: group.name, rosterCount: stats.approvedCount })},${lockedAt})
    `;
    return stats.approvedCount;
  });
}

export async function unlockParticipantRoster(inputPrincipal: AdminPrincipalInput, eventId: string, groupId: string, reason: string) {
  const principal = await resolveAdminPrincipal(inputPrincipal);
  assertAdminRole(principal, ["system_admin"], "只有系统管理员可以解锁参赛名单。");
  await requireEventAccess(principal, eventId, { write: true, allowedRoles: ["system_admin"] });
  const trimmedReason = reason.trim();
  if (trimmedReason.length < 2) throw new Error("请填写解锁原因。");
  const sql = getSqlClient();
  const unlockedAt = now();
  await sql.begin(async (tx) => {
    const rows = await tx<GroupLockRow[]>`
      select id,name,participant_roster_status as "rosterStatus",participant_roster_count as "rosterCount"
      from public.event_groups where id=${groupId} and event_id=${eventId} for update
    `;
    const group = rows[0];
    if (!group) throw new Error("当前参赛组别不存在。");
    if (group.rosterStatus !== "locked") throw new Error("当前名单尚未锁定，不需要解锁。");
    const used = await tx<Array<{ drawCount: number | string; matchCount: number | string; phaseEntryCount: number | string }>>`
      select
        (select count(*) from public.draw_sessions where event_id=${eventId} and group_id=${groupId})::int as "drawCount",
        (select count(*) from public.matches where event_id=${eventId} and group_id=${groupId})::int as "matchCount",
        (select count(*) from public.competition_phase_entries where event_id=${eventId} and group_id=${groupId})::int as "phaseEntryCount"
    `;
    const usage = used[0];
    if (Number(usage?.drawCount || 0) > 0 || Number(usage?.matchCount || 0) > 0 || Number(usage?.phaseEntryCount || 0) > 0) {
      throw new Error("该组别已经产生抽签、比赛或晋级数据，为保证竞赛数据一致性不能解锁名单。");
    }
    await tx`
      update public.event_groups
      set participant_roster_status='draft',participant_roster_count=0,
        participant_roster_confirmed_by=null,participant_roster_confirmed_at=null,
        participant_roster_locked_by=null,participant_roster_locked_at=null,updated_at=${unlockedAt}
      where id=${groupId} and event_id=${eventId}
    `;
    await tx`
      insert into public.audit_logs (id,actor_user_id,event_id,module_type,target_type,target_id,action,reason,before_json,after_json,created_at)
      values (${newId("log")},${principal.id},${eventId},'participants','event_group',${groupId},'unlock_participant_roster',${trimmedReason},
        ${JSON.stringify({ status: group.rosterStatus, rosterCount: group.rosterCount })},${JSON.stringify({ status: "draft", rosterCount: 0 })},${unlockedAt})
    `;
  });
}

export async function getParticipantRosterGate(eventId: string, groupId: string) {
  const sql = getSqlClient();
  const rows = await sql<Array<{ name: string; rosterStatus: ParticipantRosterStatus; rosterCount: number | string; approvedCount: number | string }>>`
    select eg.name,eg.participant_roster_status as "rosterStatus",eg.participant_roster_count as "rosterCount",
      count(r.id) filter (where r.status='approved' and p.merged_into_player_id is null)::int as "approvedCount"
    from public.event_groups eg
    left join public.registrations r on r.event_id=eg.event_id and r.group_id=eg.id
    left join public.players p on p.id=r.player_id
    where eg.event_id=${eventId} and eg.id=${groupId}
    group by eg.id,eg.name,eg.participant_roster_status,eg.participant_roster_count
    limit 1
  `;
  const row = rows[0];
  if (!row) throw new Error("当前参赛组别不存在。");
  const rosterCount = Number(row.rosterCount || 0);
  const approvedCount = Number(row.approvedCount || 0);
  return { name: row.name, status: row.rosterStatus, rosterCount, approvedCount, locked: row.rosterStatus === "locked" && rosterCount === approvedCount && rosterCount >= 2 };
}

export async function assertParticipantRosterLocked(eventId: string, groupId: string) {
  const gate = await getParticipantRosterGate(eventId, groupId);
  if (gate.status !== "locked") throw new Error(`${gate.name}参赛名单尚未锁定，请先在“参赛人员”中确认并锁定名单。`);
  if (!gate.locked) throw new Error(`${gate.name}锁定名单与当前审核通过人数不一致，请先在“参赛人员”中处理数据异常。`);
  return gate;
}
