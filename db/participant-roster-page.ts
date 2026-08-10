import { getSqlClient } from "./index";
import { requireEventAccess, resolveAdminPrincipal, type AdminPrincipalInput } from "./permissions";
import type {
  ParticipantFeeFilter,
  ParticipantGroupSummary,
  ParticipantReviewFilter,
  ParticipantRosterItem,
  ParticipantRosterPageData,
} from "./participant-roster";

type RawRosterItem = Omit<ParticipantRosterItem, "age">;
type BundleRow = {
  eventTitle: string;
  selectedGroupId: string | null;
  groups: ParticipantGroupSummary[] | null;
  items: RawRosterItem[] | null;
  filteredTotal: number | string;
};

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
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id',gs.id,'name',gs.name,'code',gs.code,'rosterStatus',gs.roster_status,'rosterCount',gs.roster_count,
            'confirmedAt',gs.confirmed_at,'lockedAt',gs.locked_at,'totalCount',gs.total_count,'approvedCount',gs.approved_count,
            'pendingCount',gs.pending_count,'rejectedCount',gs.rejected_count,'withdrawnCount',gs.withdrawn_count,
            'paidCount',gs.paid_count,'unpaidCount',gs.unpaid_count,'waivedCount',gs.waived_count,'unknownFeeCount',gs.unknown_fee_count
          ) order by case when gs.name='少年组' then 1 when gs.name='青年组' then 2 else 3 end,gs.name
        )
        from group_stats gs
      ), '[]'::jsonb) as groups,
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'registrationId',pr.registration_id,'playerId',pr.player_id,'fullName',pr.full_name,'gender',pr.gender,
            'groupName',pr.group_name,'birthDate',pr.birth_date,'phone',pr.phone,'identityType',pr.identity_type,
            'identityDisplay',pr.identity_no_masked,'guardianName',pr.guardian_name,'guardianPhone',pr.guardian_phone,
            'feeStatus',pr.fee_status,'reviewStatus',pr.review_status,'reviewNote',pr.review_note,'submittedAt',pr.submitted_at
          ) order by pr.full_name,pr.registration_id
        )
        from page_rows pr
      ), '[]'::jsonb) as items,
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
