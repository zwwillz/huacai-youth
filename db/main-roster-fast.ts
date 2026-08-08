import { getSqlClient } from "./index";
import { assertAdminRole, resolveAdminPrincipal, type AdminPrincipalInput } from "./permissions";
import type { MainRosterControlData, MainRosterControlGroup, ReplacementCandidate, SeedSeat } from "./main-competition-flow";

type BaseGroup = { groupId: string; groupName: string; groupCode: string; birthDateFrom: string | null; birthDateTo: string | null };
type BaseRow = {
  id: string;
  shortTitle: string;
  year: number;
  stationNo: number;
  previousEvent: null | { id: string; shortTitle: string; stationNo: number };
  groups: BaseGroup[] | null;
};
type QualificationCount = { groupId: string; phaseCode: string; count: number };
type SeedSupport = Omit<SeedSeat, "effectivePlayerId" | "effectivePlayerName"> & { groupId: string };
type PoolSupport = ReplacementCandidate & { groupId: string };
type MainCount = { groupId: string; count: number };
type LockSupport = { groupId: string; id: string; versionNo: number; status: string; lockedAt: string; replacementCount: number };
type DrawSupport = { groupId: string; id: string; versionNo: number; status: string };
type AdvancementSupport = { groupId: string; id: string; status: string; winnerSideCount: number; loserSideCount: number; roster: unknown };
type SupportBundle = {
  qualificationCounts: QualificationCount[] | null;
  seedRows: SeedSupport[] | null;
  replacementPool: PoolSupport[] | null;
  mainCounts: MainCount[] | null;
  locks: LockSupport[] | null;
  draws: DrawSupport[] | null;
  advancements: AdvancementSupport[] | null;
};

function effectiveSeat(row: Omit<SeedSeat, "effectivePlayerId" | "effectivePlayerName">) {
  if (row.attendanceStatus === "confirmed" && row.eligibilityStatus !== "ineligible") return { id: row.playerId, name: row.playerName };
  if (row.replacementPlayerId && row.replacementPlayerName) return { id: row.replacementPlayerId, name: row.replacementPlayerName };
  return { id: null, name: null };
}

/** Two bridge reads for the whole two-group roster control workspace. */
export async function getMainRosterControlDataFast(input: AdminPrincipalInput, eventId: string): Promise<MainRosterControlData> {
  const principal = await resolveAdminPrincipal(input);
  assertAdminRole(principal, ["system_admin", "committee", "referee"], "当前账号没有竞赛执行权限。");
  if (!eventId) throw new Error("缺少赛事ID。");
  const sql = getSqlClient();
  const baseRows = await sql<BaseRow[]>`
    with accessible_event as (
      select e.id,e.short_title,e.year,e.station_no,e.series_id
      from public.events e
      where e.id=${eventId}
        and (${principal.role}='system_admin' or exists (
          select 1 from public.event_members em where em.event_id=e.id and em.user_id=${principal.id} and em.status='active'
        ))
      limit 1
    )
    select e.id,e.short_title as "shortTitle",e.year,e.station_no as "stationNo",
      (select jsonb_build_object('id',p.id,'shortTitle',p.short_title,'stationNo',p.station_no)
        from public.events p
        where p.series_id=e.series_id and p.year=e.year and p.station_no<e.station_no and p.publish_status='published'
        order by p.station_no desc limit 1) as "previousEvent",
      coalesce((select jsonb_agg(jsonb_build_object(
        'groupId',g.id,'groupName',g.name,'groupCode',g.code,'birthDateFrom',g.birth_date_from,'birthDateTo',g.birth_date_to
      ) order by g.code) from public.event_groups g where g.event_id=e.id and g.status='active'),'[]'::jsonb) as groups
    from accessible_event e
  `;
  const base = baseRows[0];
  if (!base) throw new Error("没有找到这场赛事，或当前账号未被分配到本站。");

  const supportRows = await sql<SupportBundle[]>`
    with qualification_counts as (
      select qb.group_id as "groupId",qb.phase_code as "phaseCode",count(*)::int as count
      from public.competition_qualification_entries qe
      join public.competition_qualification_batches qb on qb.id=qe.batch_id
      where qb.event_id=${eventId} and qb.status='confirmed' and (qe.entry_type='direct' or qe.selected=true)
      group by qb.group_id,qb.phase_code
    ), seed_rows as (
      select se.group_id as "groupId",se.id,se.seed_no as "seedNo",se.player_id as "playerId",se.player_name as "playerName",p.birth_date as "birthDate",
        se.source_type as "sourceType",se.source_event_id as "sourceEventId",src.short_title as "sourceEventTitle",
        se.source_display_order as "sourceDisplayOrder",se.source_placement_label as "sourcePlacementLabel",
        se.eligibility_status as "eligibilityStatus",se.eligibility_note as "eligibilityNote",se.attendance_status as "attendanceStatus",se.attendance_note as "attendanceNote",
        se.replacement_player_id as "replacementPlayerId",se.replacement_player_name as "replacementPlayerName",se.replacement_metric_value as "replacementMetricValue",
        se.replacement_inherits_seed as "replacementInheritsSeed"
      from public.competition_seed_entries se
      left join public.players p on p.id=se.player_id
      left join public.events src on src.id=se.source_event_id
      where se.event_id=${eventId} and se.status='active'
    ), pool_ranked as (
      select qb.group_id as "groupId",qe.player_id as "playerId",qe.player_name as "playerName",qb.phase_code as "phaseCode",
        qe.game_win_rate_bp as "gameWinRateBp",qe.net_games as "netGames",qe.games_won as "gamesWon",qe.games_lost as "gamesLost",qe.rank_no as "rankNo",
        row_number() over(partition by qb.group_id,qe.player_id order by qe.game_win_rate_bp desc,qe.net_games desc,qe.games_won desc,coalesce(qe.rank_no,999)) as rn
      from public.competition_qualification_entries qe
      join public.competition_qualification_batches qb on qb.id=qe.batch_id
      where qb.event_id=${eventId} and qb.status='confirmed'
        and qe.entry_type <> 'direct' and qe.selected=false and qe.eligibility_status='eligible'
        and not exists (
          select 1 from public.competition_qualification_entries qx
          join public.competition_qualification_batches bx on bx.id=qx.batch_id
          where bx.event_id=qb.event_id and bx.group_id=qb.group_id and bx.status='confirmed'
            and qx.player_id=qe.player_id and (qx.entry_type='direct' or qx.selected=true)
        )
        and not exists (
          select 1 from public.competition_seed_entries se
          where se.event_id=qb.event_id and se.group_id=qb.group_id and se.status='active'
            and (se.player_id=qe.player_id or se.replacement_player_id=qe.player_id)
        )
    ), main_counts as (
      select group_id as "groupId",count(*)::int as count
      from public.competition_phase_entries where event_id=${eventId} and phase_code='main-one' and status='active' group by group_id
    ), latest_locks as (
      select distinct on (group_id) group_id as "groupId",id,version_no as "versionNo",status,locked_at as "lockedAt",replacement_count as "replacementCount"
      from public.competition_main_roster_locks where event_id=${eventId} order by group_id,version_no desc
    ), latest_draws as (
      select distinct on (group_id) group_id as "groupId",id,version_no as "versionNo",status
      from public.draw_sessions where event_id=${eventId} and phase_code='main-one' and status in ('draft','confirmed') order by group_id,version_no desc
    ), latest_advancements as (
      select distinct on (group_id) group_id as "groupId",id,status,winner_side_count as "winnerSideCount",loser_side_count as "loserSideCount",roster_json as roster
      from public.competition_main_advancement_batches where event_id=${eventId} order by group_id,created_at desc
    )
    select
      coalesce((select jsonb_agg(to_jsonb(q)) from qualification_counts q),'[]'::jsonb) as "qualificationCounts",
      coalesce((select jsonb_agg(to_jsonb(s) order by s."groupId",s."seedNo") from seed_rows s),'[]'::jsonb) as "seedRows",
      coalesce((select jsonb_agg(jsonb_build_object(
        'groupId',p."groupId",'playerId',p."playerId",'playerName',p."playerName",'phaseCode',p."phaseCode",
        'phaseTitle',case when p."phaseCode"='qualifier-one' then '资格赛第一场' else '资格赛第二场' end,
        'gameWinRateBp',p."gameWinRateBp",'netGames',p."netGames",'gamesWon',p."gamesWon",'gamesLost',p."gamesLost",'rankNo',p."rankNo"
      ) order by p."groupId",p."gameWinRateBp" desc,p."netGames" desc,p."gamesWon" desc,coalesce(p."rankNo",999),p."playerName") from pool_ranked p where p.rn=1),'[]'::jsonb) as "replacementPool",
      coalesce((select jsonb_agg(to_jsonb(m)) from main_counts m),'[]'::jsonb) as "mainCounts",
      coalesce((select jsonb_agg(to_jsonb(l)) from latest_locks l),'[]'::jsonb) as locks,
      coalesce((select jsonb_agg(to_jsonb(d)) from latest_draws d),'[]'::jsonb) as draws,
      coalesce((select jsonb_agg(to_jsonb(a)) from latest_advancements a),'[]'::jsonb) as advancements
  `;
  const support = supportRows[0] ?? { qualificationCounts: [], seedRows: [], replacementPool: [], mainCounts: [], locks: [], draws: [], advancements: [] };
  const groups: MainRosterControlGroup[] = (base.groups ?? []).map((group) => {
    const q1 = (support.qualificationCounts ?? []).find((item) => item.groupId === group.groupId && item.phaseCode === "qualifier-one")?.count ?? 0;
    const q2 = (support.qualificationCounts ?? []).find((item) => item.groupId === group.groupId && item.phaseCode === "qualifier-two")?.count ?? 0;
    const seedRows = (support.seedRows ?? []).filter((item) => item.groupId === group.groupId);
    const seedSeats: SeedSeat[] = seedRows.map(({ groupId: _groupId, ...row }) => {
      const effective = effectiveSeat(row);
      return { ...row, effectivePlayerId: effective.id, effectivePlayerName: effective.name };
    });
    const effectiveIds = seedSeats.flatMap((seat) => seat.effectivePlayerId ? [seat.effectivePlayerId] : []);
    const duplicateCount = effectiveIds.length - new Set(effectiveIds).size;
    const resolvedSeedCount = effectiveIds.length;
    const replacementCount = seedSeats.filter((seat) => seat.replacementPlayerId).length;
    const currentLock = (support.locks ?? []).find((item) => item.groupId === group.groupId) ?? null;
    const activeMainOneDraw = (support.draws ?? []).find((item) => item.groupId === group.groupId) ?? null;
    const advancementRow = (support.advancements ?? []).find((item) => item.groupId === group.groupId);
    const advancement = advancementRow ? {
      id: advancementRow.id,
      status: advancementRow.status,
      winnerSideCount: Number(advancementRow.winnerSideCount),
      loserSideCount: Number(advancementRow.loserSideCount),
      roster: Array.isArray(advancementRow.roster) ? advancementRow.roster as Array<{ playerId: string; playerName: string; sourceType: string }> : [],
    } : null;
    const mainRosterCount = (support.mainCounts ?? []).find((item) => item.groupId === group.groupId)?.count ?? 0;
    return {
      ...group,
      qualifierOneCount: Number(q1),
      qualifierTwoCount: Number(q2),
      qualifierCount: Number(q1) + Number(q2),
      seedSeats,
      replacementPool: (support.replacementPool ?? []).filter((item) => item.groupId === group.groupId).map(({ groupId: _groupId, ...item }) => item),
      resolvedSeedCount,
      replacementCount,
      mainRosterCount: Number(mainRosterCount),
      duplicateCount,
      currentLock: currentLock ? { id: currentLock.id, versionNo: Number(currentLock.versionNo), status: currentLock.status, lockedAt: currentLock.lockedAt, replacementCount: Number(currentLock.replacementCount) } : null,
      activeMainOneDraw: activeMainOneDraw ? { id: activeMainOneDraw.id, versionNo: Number(activeMainOneDraw.versionNo), status: activeMainOneDraw.status } : null,
      advancement,
      canInitializeSeeds: Boolean(base.previousEvent) && seedSeats.length === 0 && !activeMainOneDraw,
      canLock: Number(q1) === 24 && Number(q2) === 24 && seedSeats.length === 16 && resolvedSeedCount === 16 && duplicateCount === 0 && !activeMainOneDraw && currentLock?.status !== "locked",
    };
  });
  return {
    viewerRole: principal.role,
    event: { id: base.id, shortTitle: base.shortTitle, year: Number(base.year), stationNo: Number(base.stationNo) },
    previousEvent: base.previousEvent,
    groups,
  };
}
