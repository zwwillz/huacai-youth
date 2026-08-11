import { getSqlClient } from "./index";
import { parseRegistrationTime, registrationTimeState } from "./registration-time-policy.mjs";
import { buildGroupWorkflow, chooseEventNextAction, LIFECYCLE_LABELS, LIFECYCLE_PROGRESS, workflowUrgencyScore } from "./event-workflow-policy.mjs";
import { FORMAL_COMPETITION_CONFIRMED_STATUS, groupReadyToStartCompetition } from "./formal-competition-policy.mjs";
import { resolveAdminPrincipal, type AdminPrincipalInput, type BackendRole } from "./permissions";

export type WorkflowNextAction = {
  code: string;
  title: string;
  description: string;
  href: string;
  priority: number;
  kind: "link" | "lifecycle" | "wait";
  lifecycleAction: string | null;
};

export type WorkflowGroupSummary = {
  groupId: string;
  groupName: string;
  groupCode: string;
  roster: { status: string; count: number; pendingCount: number; approvedCount: number };
  competition: { phase: string; step: string; label: string; completedSteps: string[]; blocker: string | null };
  rankingStatus: string;
  nextAction: WorkflowNextAction | null;
};

export type EventWorkflowSummary = {
  event: {
    id: string;
    title: string;
    status: string;
    lifecycleLabel: string;
    progressStep: number;
    publishStatus: string;
    isHidden: boolean;
    isTest: boolean;
    startDate: string;
    endDate: string;
    basicReady: boolean;
    legacyHistorical: boolean;
  };
  lifecycle: { code: string; label: string; progressStep: number };
  publications: {
    overview: string;
    regulation: string;
    registration: string;
    masterSchedule: string;
    schedule: string;
    matches: string;
    rankings: string;
  };
  registration: {
    state: string;
    timeState: "not_set" | "not_started" | "open" | "closed";
    startAt: string;
    endAt: string;
    configReady: boolean;
    totalCount: number;
    pendingCount: number;
    approvedCount: number;
  };
  groups: WorkflowGroupSummary[];
  blockers: string[];
  competitionReadyToStart: boolean;
  allRankingsConfirmed: boolean;
  allRankingsPublished: boolean;
  nextAction: WorkflowNextAction;
  urgencyScore: number;
  viewerRole: BackendRole;
};

type WorkflowRow = {
  eventId: string;
  eventTitle: string;
  eventStatus: string;
  publishStatus: string;
  isHidden: boolean;
  isTest: boolean;
  startDate: string;
  endDate: string;
  fullTitle: string;
  city: string;
  venueId: string | null;
  registrationStartAt: string | null;
  registrationEndAt: string | null;
  registrationUrl: string | null;
  overviewStatus: string | null;
  regulationStatus: string | null;
  registrationPublicationStatus: string | null;
  masterScheduleStatus: string | null;
  schedulePublicationStatus: string | null;
  matchesPublicationStatus: string | null;
  rankingsPublicationStatus: string | null;
  legacyImportedMatchCount: number | string;
  groupId: string | null;
  groupName: string | null;
  groupCode: string | null;
  rosterStatus: string | null;
  rosterCount: number | string | null;
  groupRegistrationTotal: number | string | null;
  groupPendingCount: number | string | null;
  groupApprovedCount: number | string | null;
  groupUnresolvedCount: number | string | null;
  groupInvalidProfileCount: number | string | null;
  qualifierOneDrawStatus: string | null;
  qualifierTwoDrawStatus: string | null;
  mainOneDrawStatus: string | null;
  mainTwoDrawStatus: string | null;
  qualifierOneScheduleStatus: string | null;
  qualifierTwoScheduleStatus: string | null;
  mainOneScheduleStatus: string | null;
  mainTwoScheduleStatus: string | null;
  qualifierOnePlayableCount: number | string | null;
  qualifierTwoPlayableCount: number | string | null;
  mainOnePlayableCount: number | string | null;
  mainTwoPlayableCount: number | string | null;
  qualifierOnePendingCount: number | string | null;
  qualifierTwoPendingCount: number | string | null;
  mainOnePendingCount: number | string | null;
  mainTwoPendingCount: number | string | null;
  qualifierOneConfirmedCount: number | string | null;
  qualifierTwoConfirmedCount: number | string | null;
  mainOneConfirmedCount: number | string | null;
  mainTwoConfirmedCount: number | string | null;
  qualifierOneQualificationStatus: string | null;
  qualifierTwoQualificationStatus: string | null;
  mainRosterStatus: string | null;
  mainRosterCount: number | string | null;
  mainRosterIssueCount: number | string | null;
  mainAdvancementStatus: string | null;
  rankingBatchStatus: string | null;
  rankingTotalCount: number | string | null;
  rankingConfirmedCount: number | string | null;
  rankingPublishedCount: number | string | null;
  formalCompetitionCount: number | string | null;
};

function n(value: number | string | null | undefined) { return Number(value || 0); }
function publication(value: string | null | undefined) { return value === "published" ? "published" : "draft"; }
function validHttpUrl(value: string | null | undefined) {
  if (!value) return false;
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
}
function phase(status: string | null, scheduleStatus: string | null, playable: number | string | null, pending: number | string | null, confirmed: number | string | null, extra: Record<string, unknown> = {}) {
  return { drawStatus: status, scheduleStatus, playableMatchCount: n(playable), pendingResultCount: n(pending), confirmedResultCount: n(confirmed), ...extra };
}
function rankingStatus(row: WorkflowRow) {
  if (row.rankingBatchStatus === "published" || n(row.rankingPublishedCount) >= 64) return "published";
  if (row.rankingBatchStatus === "confirmed" || n(row.rankingConfirmedCount) + n(row.rankingPublishedCount) >= 64) return "confirmed";
  if (row.rankingBatchStatus === "draft" || n(row.rankingTotalCount) > 0) return "draft";
  return "none";
}

async function loadWorkflowRows(input: AdminPrincipalInput, eventId = "") {
  const principal = await resolveAdminPrincipal(input);
  const sql = getSqlClient();
  const rows = await sql<WorkflowRow[]>`
    with allowed_events as (
      select e.*
      from public.events e
      where (${eventId}='' or e.id=${eventId})
        and (${principal.role}='system_admin' or exists (
          select 1 from public.event_members em
          where em.event_id=e.id and em.user_id=${principal.id} and em.status='active'
        ))
    ), publication_pivot as (
      select p.event_id,
        max(p.status) filter (where p.module_type='overview') as overview_status,
        max(p.status) filter (where p.module_type='regulation') as regulation_status,
        max(p.status) filter (where p.module_type='registration') as registration_status,
        max(p.status) filter (where p.module_type='master_schedule') as master_schedule_status,
        max(p.status) filter (where p.module_type='schedule') as schedule_status,
        max(p.status) filter (where p.module_type='matches') as matches_status,
        max(p.status) filter (where p.module_type='rankings') as rankings_status
      from public.publications p join allowed_events ae on ae.id=p.event_id
      group by p.event_id
    ), registration_stats as (
      select eg.event_id,eg.id as group_id,
        count(r.id)::int as total_count,
        count(r.id) filter (where r.status='pending')::int as pending_count,
        count(r.id) filter (where r.status='approved' and p.merged_into_player_id is null)::int as approved_count,
        count(r.id) filter (where r.status not in ('approved','pending','rejected','withdrawn','cancelled','canceled') and p.merged_into_player_id is null)::int as unresolved_count,
        count(r.id) filter (where r.status='approved' and (p.id is null or p.merged_into_player_id is not null))::int as invalid_profile_count
      from public.event_groups eg
      join allowed_events ae on ae.id=eg.event_id
      left join public.registrations r on r.event_id=eg.event_id and r.group_id=eg.id
      left join public.players p on p.id=r.player_id
      where eg.status='active'
      group by eg.event_id,eg.id
    ), latest_draw as (
      select distinct on (ds.event_id,ds.group_id,ds.phase_code) ds.event_id,ds.group_id,ds.phase_code,ds.status
      from public.draw_sessions ds join allowed_events ae on ae.id=ds.event_id
      where ds.status<>'void'
      order by ds.event_id,ds.group_id,ds.phase_code,ds.version_no desc,ds.created_at desc
    ), latest_schedule as (
      select distinct on (s.event_id,s.group_id,s.phase_code) s.event_id,s.group_id,s.phase_code,s.status
      from public.competition_schedules s join allowed_events ae on ae.id=s.event_id
      order by s.event_id,s.group_id,s.phase_code,s.updated_at desc,s.generated_at desc
    ), match_stats as (
      select bm.event_id,bm.group_id,bm.phase_code,
        count(*) filter (where bm.status<>'void')::int as playable_count,
        count(*) filter (where bm.status not in ('void','auto_advanced') and coalesce(bm.result_status,'pending')<>'confirmed')::int as pending_count,
        count(*) filter (where bm.status='auto_advanced' or bm.result_status='confirmed')::int as confirmed_count
      from public.competition_bracket_matches bm join allowed_events ae on ae.id=bm.event_id
      group by bm.event_id,bm.group_id,bm.phase_code
    ), latest_qualification as (
      select distinct on (qb.event_id,qb.group_id,qb.phase_code) qb.event_id,qb.group_id,qb.phase_code,qb.status
      from public.competition_qualification_batches qb join allowed_events ae on ae.id=qb.event_id
      order by qb.event_id,qb.group_id,qb.phase_code,qb.updated_at desc,qb.created_at desc
    ), latest_main_roster as (
      select distinct on (mr.event_id,mr.group_id) mr.event_id,mr.group_id,mr.status,
        coalesce(jsonb_array_length(mr.roster_json),0)::int as roster_count,
        (coalesce(mr.duplicate_count,0)+coalesce(mr.eligibility_issue_count,0))::int as issue_count
      from public.competition_main_roster_locks mr join allowed_events ae on ae.id=mr.event_id
      where mr.status<>'void'
      order by mr.event_id,mr.group_id,mr.version_no desc,mr.updated_at desc
    ), latest_advancement as (
      select distinct on (ma.event_id,ma.group_id) ma.event_id,ma.group_id,ma.status
      from public.competition_main_advancement_batches ma join allowed_events ae on ae.id=ma.event_id
      order by ma.event_id,ma.group_id,ma.updated_at desc,ma.created_at desc
    ), latest_ranking_batch as (
      select distinct on (fr.event_id,fr.group_id) fr.event_id,fr.group_id,fr.status
      from public.competition_final_ranking_batches fr join allowed_events ae on ae.id=fr.event_id
      order by fr.event_id,fr.group_id,fr.updated_at desc,fr.created_at desc
    ), ranking_stats as (
      select er.event_id,er.group_id,count(*)::int as total_count,
        count(*) filter (where er.status='confirmed')::int as confirmed_count,
        count(*) filter (where er.status='published')::int as published_count
      from public.event_rankings er join allowed_events ae on ae.id=er.event_id
      group by er.event_id,er.group_id
    ), formal_competition as (
      select x.event_id,x.group_id,count(*)::int as data_count
      from (
        select ds.event_id,ds.group_id from public.draw_sessions ds join allowed_events ae on ae.id=ds.event_id where ds.status=${FORMAL_COMPETITION_CONFIRMED_STATUS}
        union all
        select b.event_id,b.group_id from public.competition_brackets b join allowed_events ae on ae.id=b.event_id where b.status=${FORMAL_COMPETITION_CONFIRMED_STATUS}
      ) x group by x.event_id,x.group_id
    ), legacy_counts as (
      select m.event_id,count(*)::int as legacy_count
      from public.matches m join allowed_events ae on ae.id=m.event_id
      where m.source like 'static_%' or m.source like 'pdf_static_%'
      group by m.event_id
    )
    select
      e.id as "eventId",e.short_title as "eventTitle",e.full_title as "fullTitle",e.status as "eventStatus",e.publish_status as "publishStatus",
      coalesce(e.is_hidden,false) as "isHidden",coalesce(e.is_test,false) as "isTest",e.start_date as "startDate",e.end_date as "endDate",
      e.city,e.venue_id as "venueId",e.registration_start_at as "registrationStartAt",e.registration_end_at as "registrationEndAt",e.registration_url as "registrationUrl",
      pp.overview_status as "overviewStatus",pp.regulation_status as "regulationStatus",pp.registration_status as "registrationPublicationStatus",
      pp.master_schedule_status as "masterScheduleStatus",pp.schedule_status as "schedulePublicationStatus",pp.matches_status as "matchesPublicationStatus",pp.rankings_status as "rankingsPublicationStatus",
      coalesce(lc.legacy_count,0)::int as "legacyImportedMatchCount",
      eg.id as "groupId",eg.name as "groupName",eg.code as "groupCode",eg.participant_roster_status as "rosterStatus",eg.participant_roster_count as "rosterCount",
      coalesce(rs.total_count,0)::int as "groupRegistrationTotal",coalesce(rs.pending_count,0)::int as "groupPendingCount",coalesce(rs.approved_count,0)::int as "groupApprovedCount",
      coalesce(rs.unresolved_count,0)::int as "groupUnresolvedCount",coalesce(rs.invalid_profile_count,0)::int as "groupInvalidProfileCount",
      d1.status as "qualifierOneDrawStatus",d2.status as "qualifierTwoDrawStatus",d3.status as "mainOneDrawStatus",d4.status as "mainTwoDrawStatus",
      s1.status as "qualifierOneScheduleStatus",s2.status as "qualifierTwoScheduleStatus",s3.status as "mainOneScheduleStatus",s4.status as "mainTwoScheduleStatus",
      coalesce(m1.playable_count,0)::int as "qualifierOnePlayableCount",coalesce(m2.playable_count,0)::int as "qualifierTwoPlayableCount",coalesce(m3.playable_count,0)::int as "mainOnePlayableCount",coalesce(m4.playable_count,0)::int as "mainTwoPlayableCount",
      coalesce(m1.pending_count,0)::int as "qualifierOnePendingCount",coalesce(m2.pending_count,0)::int as "qualifierTwoPendingCount",coalesce(m3.pending_count,0)::int as "mainOnePendingCount",coalesce(m4.pending_count,0)::int as "mainTwoPendingCount",
      coalesce(m1.confirmed_count,0)::int as "qualifierOneConfirmedCount",coalesce(m2.confirmed_count,0)::int as "qualifierTwoConfirmedCount",coalesce(m3.confirmed_count,0)::int as "mainOneConfirmedCount",coalesce(m4.confirmed_count,0)::int as "mainTwoConfirmedCount",
      q1.status as "qualifierOneQualificationStatus",q2.status as "qualifierTwoQualificationStatus",
      mr.status as "mainRosterStatus",coalesce(mr.roster_count,0)::int as "mainRosterCount",coalesce(mr.issue_count,0)::int as "mainRosterIssueCount",
      ma.status as "mainAdvancementStatus",fr.status as "rankingBatchStatus",coalesce(rr.total_count,0)::int as "rankingTotalCount",
      coalesce(rr.confirmed_count,0)::int as "rankingConfirmedCount",coalesce(rr.published_count,0)::int as "rankingPublishedCount",coalesce(fc.data_count,0)::int as "formalCompetitionCount"
    from allowed_events e
    left join publication_pivot pp on pp.event_id=e.id
    left join legacy_counts lc on lc.event_id=e.id
    left join public.event_groups eg on eg.event_id=e.id and eg.status='active'
    left join registration_stats rs on rs.event_id=e.id and rs.group_id=eg.id
    left join latest_draw d1 on d1.event_id=e.id and d1.group_id=eg.id and d1.phase_code='qualifier-one'
    left join latest_draw d2 on d2.event_id=e.id and d2.group_id=eg.id and d2.phase_code='qualifier-two'
    left join latest_draw d3 on d3.event_id=e.id and d3.group_id=eg.id and d3.phase_code='main-one'
    left join latest_draw d4 on d4.event_id=e.id and d4.group_id=eg.id and d4.phase_code='main-two'
    left join latest_schedule s1 on s1.event_id=e.id and s1.group_id=eg.id and s1.phase_code='qualifier-one'
    left join latest_schedule s2 on s2.event_id=e.id and s2.group_id=eg.id and s2.phase_code='qualifier-two'
    left join latest_schedule s3 on s3.event_id=e.id and s3.group_id=eg.id and s3.phase_code='main-one'
    left join latest_schedule s4 on s4.event_id=e.id and s4.group_id=eg.id and s4.phase_code='main-two'
    left join match_stats m1 on m1.event_id=e.id and m1.group_id=eg.id and m1.phase_code='qualifier-one'
    left join match_stats m2 on m2.event_id=e.id and m2.group_id=eg.id and m2.phase_code='qualifier-two'
    left join match_stats m3 on m3.event_id=e.id and m3.group_id=eg.id and m3.phase_code='main-one'
    left join match_stats m4 on m4.event_id=e.id and m4.group_id=eg.id and m4.phase_code='main-two'
    left join latest_qualification q1 on q1.event_id=e.id and q1.group_id=eg.id and q1.phase_code='qualifier-one'
    left join latest_qualification q2 on q2.event_id=e.id and q2.group_id=eg.id and q2.phase_code='qualifier-two'
    left join latest_main_roster mr on mr.event_id=e.id and mr.group_id=eg.id
    left join latest_advancement ma on ma.event_id=e.id and ma.group_id=eg.id
    left join latest_ranking_batch fr on fr.event_id=e.id and fr.group_id=eg.id
    left join ranking_stats rr on rr.event_id=e.id and rr.group_id=eg.id
    left join formal_competition fc on fc.event_id=e.id and fc.group_id=eg.id
    order by e.year desc,e.station_no desc,case when eg.name='少年组' then 1 when eg.name='青年组' then 2 else 3 end,eg.name
  `;
  return { principal, rows };
}

function buildSummaries(rows: WorkflowRow[], viewerRole: BackendRole): EventWorkflowSummary[] {
  const byEvent = new Map<string, WorkflowRow[]>();
  for (const row of rows) {
    const list = byEvent.get(row.eventId) ?? [];
    list.push(row);
    byEvent.set(row.eventId, list);
  }
  return [...byEvent.values()].map((eventRows) => {
    const first = eventRows[0];
    const activeGroupCount = eventRows.filter((row) => Boolean(row.groupId)).length;
    const basicReady = Boolean(first.fullTitle?.trim() && first.city?.trim() && first.startDate && first.endDate && first.startDate <= first.endDate && first.venueId && activeGroupCount > 0);
    const startAt = first.registrationStartAt || "";
    const endAt = first.registrationEndAt || "";
    const timesValid = Boolean(startAt && endAt && Number.isFinite(parseRegistrationTime(startAt)) && Number.isFinite(parseRegistrationTime(endAt)) && parseRegistrationTime(startAt) < parseRegistrationTime(endAt));
    const timeState = registrationTimeState(startAt, endAt) as "not_set" | "not_started" | "open" | "closed";
    const configReady = timesValid && validHttpUrl(first.registrationUrl);
    const publications = {
      overview: publication(first.overviewStatus), regulation: publication(first.regulationStatus), registration: publication(first.registrationPublicationStatus),
      masterSchedule: publication(first.masterScheduleStatus), schedule: publication(first.schedulePublicationStatus), matches: publication(first.matchesPublicationStatus), rankings: publication(first.rankingsPublicationStatus),
    };
    const groups = eventRows.filter((row) => row.groupId).map((row) => {
      const rankStatus = rankingStatus(row);
      return buildGroupWorkflow({
        eventId: row.eventId, lifecycle: row.eventStatus, groupId: row.groupId!, groupName: row.groupName!, groupCode: row.groupCode!,
        rosterStatus: row.rosterStatus || "draft", rosterCount: n(row.rosterCount), pendingCount: n(row.groupPendingCount), approvedCount: n(row.groupApprovedCount),
        unresolvedCount: n(row.groupUnresolvedCount), invalidProfileCount: n(row.groupInvalidProfileCount),
        phases: {
          "qualifier-one": phase(row.qualifierOneDrawStatus,row.qualifierOneScheduleStatus,row.qualifierOnePlayableCount,row.qualifierOnePendingCount,row.qualifierOneConfirmedCount,{ qualificationStatus: row.qualifierOneQualificationStatus }),
          "qualifier-two": phase(row.qualifierTwoDrawStatus,row.qualifierTwoScheduleStatus,row.qualifierTwoPlayableCount,row.qualifierTwoPendingCount,row.qualifierTwoConfirmedCount,{ qualificationStatus: row.qualifierTwoQualificationStatus }),
          "main-one": phase(row.mainOneDrawStatus,row.mainOneScheduleStatus,row.mainOnePlayableCount,row.mainOnePendingCount,row.mainOneConfirmedCount,{ advancementStatus: row.mainAdvancementStatus }),
          "main-two": phase(row.mainTwoDrawStatus,row.mainTwoScheduleStatus,row.mainTwoPlayableCount,row.mainTwoPendingCount,row.mainTwoConfirmedCount),
        },
        mainRosterStatus: row.mainRosterStatus, mainRosterCount: n(row.mainRosterCount), mainRosterIssueCount: n(row.mainRosterIssueCount), rankingStatus: rankStatus,
      }) as WorkflowGroupSummary;
    });
    const registrationTotal = eventRows.reduce((sum, row) => sum + (row.groupId ? n(row.groupRegistrationTotal) : 0), 0);
    const pendingTotal = eventRows.reduce((sum, row) => sum + (row.groupId ? n(row.groupPendingCount) : 0), 0);
    const approvedTotal = eventRows.reduce((sum, row) => sum + (row.groupId ? n(row.groupApprovedCount) : 0), 0);
    const lifecycleLabel = String(LIFECYCLE_LABELS[first.eventStatus] || first.eventStatus);
    const legacyHistorical = (first.eventStatus === "finished" || first.eventStatus === "archived") && n(first.legacyImportedMatchCount) > 0;
    const event = {
      id: first.eventId, title: first.eventTitle, status: first.eventStatus, lifecycleLabel, progressStep: Number(LIFECYCLE_PROGRESS[first.eventStatus] ?? 0),
      publishStatus: first.publishStatus, isHidden: Boolean(first.isHidden), isTest: Boolean(first.isTest), startDate: first.startDate, endDate: first.endDate, basicReady, legacyHistorical,
    };
    const registration = { state: first.eventStatus === "registration_open" ? "open" : first.eventStatus === "registration_closed" ? "closed" : "inactive", timeState, startAt, endAt, configReady, totalCount: registrationTotal, pendingCount: pendingTotal, approvedCount: approvedTotal };
    const competitionReadyToStart = eventRows.some((row) => row.groupId && groupReadyToStartCompetition({ rosterLocked: row.rosterStatus === "locked", confirmedEntryCount: n(row.formalCompetitionCount) }));
    const allRankingsConfirmed = groups.length > 0 && groups.every((group) => group.rankingStatus === "confirmed" || group.rankingStatus === "published");
    const allRankingsPublished = groups.length > 0 && groups.every((group) => group.rankingStatus === "published");
    const blockers = groups.map((group) => group.competition.blocker).filter((value): value is string => Boolean(value));
    if (first.eventStatus === "registration_open" && timeState === "closed") blockers.unshift("报名时间已经结束，但赛事生命周期仍为“报名中”。");
    const partial = { event, lifecycle: { code: first.eventStatus, label: lifecycleLabel, progressStep: event.progressStep }, publications, registration, groups, blockers, competitionReadyToStart, allRankingsConfirmed, allRankingsPublished };
    const nextAction = chooseEventNextAction(partial, viewerRole) as WorkflowNextAction;
    const summary = { ...partial, nextAction, urgencyScore: 0, viewerRole } as EventWorkflowSummary;
    summary.urgencyScore = workflowUrgencyScore(summary);
    return summary;
  }).sort((a, b) => b.urgencyScore - a.urgencyScore || b.event.startDate.localeCompare(a.event.startDate));
}

export async function getEventWorkflowSummaries(input: AdminPrincipalInput, eventId = ""): Promise<EventWorkflowSummary[]> {
  const { principal, rows } = await loadWorkflowRows(input, eventId);
  return buildSummaries(rows, principal.role);
}

export async function getEventWorkflowSummary(input: AdminPrincipalInput, eventId: string): Promise<EventWorkflowSummary> {
  if (!eventId) throw new Error("缺少赛事ID。");
  const rows = await getEventWorkflowSummaries(input, eventId);
  const summary = rows.find((item) => item.event.id === eventId);
  if (!summary) throw new Error("没有找到这场赛事，或当前账号未被分配到本站。");
  return summary;
}
