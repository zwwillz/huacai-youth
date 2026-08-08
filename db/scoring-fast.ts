import { getSqlClient } from "./index";
import { competitionPhaseLabel } from "./competition-labels";
import { assertAdminRole, resolveAdminPrincipal, type AdminPrincipalInput } from "./permissions";
import type { CompetitionContextData, CompetitionPublicationModule, CompetitionPublicationState } from "./competition-context";
import type { ScoringDateOption, ScoringMatch, ScoringPhaseOption, ScoringWorkspaceData } from "./scoring-engine";

type ScoringFilters = { groupId?: string; phaseCode?: string; date?: string; showConfirmed?: boolean };
type PhaseRow = { code: string; title: string; actionableCount: number; confirmedCount: number; totalCount: number };
type DateRow = { value: string; actionableCount: number; confirmedCount: number; totalCount: number };
type PublicationRow = {
  id: string;
  moduleType: CompetitionPublicationModule;
  status: string;
  versionNo: number;
  publishedAt: string | null;
  hasUnpublishedChanges: boolean;
  draftUpdatedAt: string | null;
  hasSnapshot: boolean;
};
type BundleRow = {
  id: string;
  shortTitle: string;
  startDate: string;
  endDate: string;
  groups: Array<{ id: string; name: string; code: string }> | null;
  selectedGroupId: string | null;
  selectedPhase: string | null;
  selectedDate: string | null;
  phases: PhaseRow[] | null;
  dates: DateRow[] | null;
  matches: ScoringMatch[] | null;
  publicationRows: PublicationRow[] | null;
};

function emptyPublication(): CompetitionPublicationState {
  return { id: null, status: "draft", versionNo: 0, publishedAt: null, hasUnpublishedChanges: false, draftUpdatedAt: null, hasSnapshot: false };
}

/**
 * One database bridge request for event access, groups, phase/date counters,
 * current scoring list and competition publication state.
 */
export async function getScoringWorkspaceBundleFast(
  input: AdminPrincipalInput,
  eventId: string,
  filters: ScoringFilters = {},
): Promise<{ data: ScoringWorkspaceData; context: CompetitionContextData }> {
  const principal = await resolveAdminPrincipal(input);
  assertAdminRole(principal, ["system_admin", "committee", "referee"], "当前账号没有比分录入权限。");
  if (!eventId) throw new Error("缺少赛事ID。");
  const requestedGroup = filters.groupId || "";
  const requestedPhase = filters.phaseCode || "";
  const requestedDate = filters.date || "";
  const showConfirmed = Boolean(filters.showConfirmed);
  const sql = getSqlClient();
  const rows = await sql<BundleRow[]>`
    with accessible_event as (
      select e.id,e.short_title,e.start_date,e.end_date
      from public.events e
      where e.id=${eventId}
        and (${principal.role}='system_admin' or exists (
          select 1 from public.event_members em
          where em.event_id=e.id and em.user_id=${principal.id} and em.status='active'
        ))
      limit 1
    ), groups as (
      select g.id,g.name,g.code
      from public.event_groups g
      where g.event_id=(select id from accessible_event) and g.status='active'
    ), selected_group as (
      select id from groups
      order by case when ${requestedGroup}<>'' and id=${requestedGroup} then 0 else 1 end,code
      limit 1
    ), phase_stats as (
      select bm.phase_code as code,coalesce(ep.title,bm.phase_code) as title,
        count(*) filter(where bm.result_status <> 'confirmed')::int as "actionableCount",
        count(*) filter(where bm.result_status = 'confirmed')::int as "confirmedCount",
        count(*)::int as "totalCount"
      from public.competition_match_schedules ms
      join public.competition_bracket_matches bm on bm.id=ms.bracket_match_id
      left join public.event_phases ep on ep.event_id=bm.event_id and ep.code=bm.phase_code
      where bm.event_id=(select id from accessible_event)
        and bm.group_id=(select id from selected_group)
        and bm.status <> 'void'
        and (${principal.role}<>'referee' or ms.referee_user_id=${principal.id})
      group by bm.phase_code,ep.title
    ), selected_phase as (
      select coalesce(
        (select code from phase_stats where code=${requestedPhase} limit 1),
        (select code from phase_stats
          order by case when "actionableCount">0 then 0 else 1 end,
            case code when 'qualifier-one' then 1 when 'qualifier-two' then 2 when 'main-one' then 3 when 'main-two' then 4 else 0 end desc
          limit 1),
        'qualifier-one'
      ) as code
    ), date_stats as (
      select coalesce(ts.match_date::text,'__unscheduled__') as value,ts.match_date,
        count(*) filter(where bm.result_status <> 'confirmed')::int as "actionableCount",
        count(*) filter(where bm.result_status = 'confirmed')::int as "confirmedCount",
        count(*)::int as "totalCount"
      from public.competition_match_schedules ms
      join public.competition_bracket_matches bm on bm.id=ms.bracket_match_id
      left join public.competition_time_slots ts on ts.id=ms.time_slot_id
      where bm.event_id=(select id from accessible_event)
        and bm.group_id=(select id from selected_group)
        and bm.phase_code=(select code from selected_phase)
        and bm.status <> 'void'
        and (${principal.role}<>'referee' or ms.referee_user_id=${principal.id})
      group by ts.match_date
    ), selected_date as (
      select coalesce(
        (select value from date_stats where value=${requestedDate} limit 1),
        (select value from date_stats where "actionableCount">0
          order by
            case
              when match_date::date=(now() at time zone 'Asia/Shanghai')::date then 0
              when match_date::date>(now() at time zone 'Asia/Shanghai')::date then 1
              when match_date::date<(now() at time zone 'Asia/Shanghai')::date then 2
              else 3
            end,
            case when match_date::date>(now() at time zone 'Asia/Shanghai')::date then match_date::date end asc nulls last,
            case when match_date::date<(now() at time zone 'Asia/Shanghai')::date then match_date::date end desc nulls last
          limit 1),
        (select value from date_stats order by match_date nulls last limit 1),
        ''
      ) as value
    ), match_rows as (
      select
        ms.id as "assignmentId",ms.schedule_id as "scheduleId",bm.id as "bracketMatchId",
        bm.event_id as "eventId",bm.group_id as "groupId",eg.name as "groupName",
        bm.phase_code as "phaseCode",coalesce(ep.title,bm.phase_code) as "phaseTitle",
        bm.match_code as "matchCode",bm.round_name as "roundName",bm.division_no as "divisionNo",
        bm.player_a_id as "playerAId",bm.player_a_name as "playerAName",bm.player_b_id as "playerBId",bm.player_b_name as "playerBName",
        ts.match_date::text as "matchDate",ts.start_time as "startTime",t.display_name as "tableName",
        ms.referee_user_id as "refereeUserId",ru.display_name as "refereeName",
        bm.score_a as "scoreA",bm.score_b as "scoreB",bm.result_type as "resultType",bm.result_status as "resultStatus",
        bm.winner_player_id as "winnerPlayerId",bm.winner_player_name as "winnerPlayerName",bm.submitted_at as "submittedAt",bm.confirmed_at as "confirmedAt",
        coalesce(ts.start_time,'99:99') as _time_order,coalesce(t.sort_order,9999) as _table_order,bm.sort_order as _match_order
      from public.competition_match_schedules ms
      join public.competition_bracket_matches bm on bm.id=ms.bracket_match_id
      join public.event_groups eg on eg.id=bm.group_id
      left join public.event_phases ep on ep.event_id=bm.event_id and ep.code=bm.phase_code
      left join public.competition_time_slots ts on ts.id=ms.time_slot_id
      left join public.competition_event_tables t on t.id=ms.table_id
      left join public.users ru on ru.id=ms.referee_user_id
      where bm.event_id=(select id from accessible_event)
        and bm.group_id=(select id from selected_group)
        and bm.phase_code=(select code from selected_phase)
        and bm.status <> 'void'
        and ((select value from selected_date)='' or ((select value from selected_date)='__unscheduled__' and ts.match_date is null) or ts.match_date::text=(select value from selected_date))
        and (${showConfirmed} or bm.result_status <> 'confirmed')
        and (${principal.role}<>'referee' or ms.referee_user_id=${principal.id})
    )
    select e.id,e.short_title as "shortTitle",e.start_date::text as "startDate",e.end_date::text as "endDate",
      coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'code',g.code) order by g.code) from groups g),'[]'::jsonb) as groups,
      (select id from selected_group) as "selectedGroupId",
      (select code from selected_phase) as "selectedPhase",
      (select value from selected_date) as "selectedDate",
      coalesce((select jsonb_agg(jsonb_build_object('code',p.code,'title',p.title,'actionableCount',p."actionableCount",'confirmedCount',p."confirmedCount",'totalCount',p."totalCount")
        order by case p.code when 'qualifier-one' then 1 when 'qualifier-two' then 2 when 'main-one' then 3 when 'main-two' then 4 else 99 end) from phase_stats p),'[]'::jsonb) as phases,
      coalesce((select jsonb_agg(jsonb_build_object('value',d.value,'actionableCount',d."actionableCount",'confirmedCount',d."confirmedCount",'totalCount',d."totalCount") order by d.match_date nulls last) from date_stats d),'[]'::jsonb) as dates,
      coalesce((select jsonb_agg(to_jsonb(m)-'_time_order'-'_table_order'-'_match_order'
        order by case when m."resultStatus"='submitted' then 0 else 1 end,m._time_order,m._table_order,m._match_order) from match_rows m),'[]'::jsonb) as matches,
      coalesce((select jsonb_agg(jsonb_build_object(
        'id',p.id,'moduleType',p.module_type,'status',p.status,'versionNo',p.version_no,'publishedAt',p.published_at,
        'hasUnpublishedChanges',p.has_unpublished_changes,'draftUpdatedAt',p.draft_updated_at,'hasSnapshot',(p.snapshot_json is not null)
      )) from public.publications p where p.event_id=e.id and p.module_type in ('schedule','matches','rankings')),'[]'::jsonb) as "publicationRows"
    from accessible_event e
  `;
  const row = rows[0];
  if (!row) throw new Error("没有找到这场赛事，或当前账号未被分配到本站。");

  const groups = row.groups ?? [];
  const phases: ScoringPhaseOption[] = (row.phases ?? []).map((phase) => ({
    ...phase,
    actionableCount: Number(phase.actionableCount),
    confirmedCount: Number(phase.confirmedCount),
    totalCount: Number(phase.totalCount),
    title: competitionPhaseLabel(phase.code, phase.title),
  }));
  const dates: ScoringDateOption[] = (row.dates ?? []).map((date) => ({
    ...date,
    actionableCount: Number(date.actionableCount),
    confirmedCount: Number(date.confirmedCount),
    totalCount: Number(date.totalCount),
  }));
  const matches = (row.matches ?? []).map((match) => ({ ...match, phaseTitle: competitionPhaseLabel(match.phaseCode, match.phaseTitle) }));
  const selectedDateStats = dates.find((item) => item.value === (row.selectedDate ?? ""));
  const data: ScoringWorkspaceData = {
    viewer: { id: principal.id, role: principal.role, displayName: principal.displayName },
    event: { id: row.id, shortTitle: row.shortTitle, startDate: row.startDate, endDate: row.endDate },
    groups,
    phases,
    dates,
    filters: {
      groupId: row.selectedGroupId ?? "",
      phaseCode: row.selectedPhase ?? "qualifier-one",
      date: row.selectedDate ?? "",
      showConfirmed,
    },
    matches,
    counts: {
      actionable: selectedDateStats?.actionableCount ?? 0,
      submitted: matches.filter((match) => match.resultStatus === "submitted").length,
      confirmed: selectedDateStats?.confirmedCount ?? 0,
      visible: matches.length,
    },
  };

  const publications: CompetitionContextData["publications"] = { schedule: emptyPublication(), matches: emptyPublication(), rankings: emptyPublication() };
  for (const publication of row.publicationRows ?? []) {
    publications[publication.moduleType] = {
      id: publication.id,
      status: publication.status,
      versionNo: Number(publication.versionNo),
      publishedAt: publication.publishedAt,
      hasUnpublishedChanges: Boolean(publication.hasUnpublishedChanges),
      draftUpdatedAt: publication.draftUpdatedAt,
      hasSnapshot: Boolean(publication.hasSnapshot),
    };
  }
  return {
    data,
    context: { event: { id: row.id, shortTitle: row.shortTitle }, groups, publications },
  };
}

export async function getScoringWorkspaceDataFast(input: AdminPrincipalInput, eventId: string, filters: ScoringFilters = {}) {
  return (await getScoringWorkspaceBundleFast(input, eventId, filters)).data;
}
