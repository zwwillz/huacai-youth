import { getSqlClient } from "./index";
import { competitionPhaseLabel } from "./competition-labels";
import { assertAdminRole, resolveAdminPrincipal, type AdminPrincipalInput } from "./permissions";
import type { QualificationCandidate, QualificationDirect, QualificationStage, QualificationWorkspaceData } from "./qualification-engine";

type StageRow = {
  drawSessionId: string;
  bracketId: string;
  eventId: string;
  groupId: string;
  groupName: string;
  phaseCode: string;
  phaseTitle: string | null;
  drawVersion: number;
  divisionCount: number;
  divisionSize: number;
  rateQualifierCount: number;
};
type SupportMatch = {
  bracketId: string;
  id: string;
  roundNo: number;
  divisionNo: number;
  playerAId: string | null;
  playerAName: string | null;
  playerBId: string | null;
  playerBName: string | null;
  winnerPlayerId: string | null;
  winnerPlayerName: string | null;
  scoreA: number | null;
  scoreB: number | null;
  resultType: string | null;
  resultStatus: string;
  status: string;
};
type StoredEntry = {
  playerId: string;
  playerName: string;
  entryType: string;
  selected: boolean;
  rankNo: number | null;
  divisionNo: number | null;
  gamesWon: number;
  gamesLost: number;
  gameWinRateBp: number;
  netGames: number;
  finalMatchId: string | null;
  finalResultType: string | null;
  eligibilityStatus: string;
};
type BatchSupport = { id: string; drawSessionId: string; confirmedAt: string | null; entries: StoredEntry[] | null };
type NextCount = { groupId: string; phaseCode: string; count: number };
type SupportBundle = { matches: SupportMatch[] | null; batches: BatchSupport[] | null; nextCounts: NextCount[] | null };
type BaseRow = { id: string; shortTitle: string; stages: StageRow[] | null };

function loserOfFinal(row: SupportMatch) {
  if (!row.winnerPlayerId) return null;
  if (row.playerAId && row.playerAId !== row.winnerPlayerId && row.playerAName) return { id: row.playerAId, name: row.playerAName };
  if (row.playerBId && row.playerBId !== row.winnerPlayerId && row.playerBName) return { id: row.playerBId, name: row.playerBName };
  return null;
}
function rateBp(won: number, lost: number) {
  const total = won + lost;
  return total > 0 ? Math.round((won / total) * 10000) : 0;
}
function stageNextPhase(code: string) {
  if (code === "qualifier-one") return "qualifier-two";
  if (code === "qualifier-two") return "main-one";
  return null;
}

function buildStage(row: StageRow, support: SupportBundle): QualificationStage {
  const finalRoundNo = Math.log2(row.divisionSize);
  const stageMatches = (support.matches ?? []).filter((item) => item.bracketId === row.bracketId);
  const finals = stageMatches.filter((item) => item.roundNo === finalRoundNo).sort((a, b) => a.divisionNo - b.divisionNo);
  const scoreRows = stageMatches.filter((item) => item.resultStatus === "confirmed" && item.resultType === "normal" && item.scoreA !== null && item.scoreB !== null);
  const batch = (support.batches ?? []).find((item) => item.drawSessionId === row.drawSessionId) ?? null;
  const nextPhaseCode = stageNextPhase(row.phaseCode);
  const nextPhaseEntryCount = (support.nextCounts ?? []).find((item) => item.groupId === row.groupId && item.phaseCode === nextPhaseCode)?.count ?? 0;

  if (batch) {
    const stored = batch.entries ?? [];
    const direct: QualificationDirect[] = stored.filter((item) => item.entryType === "direct").map((item) => ({
      playerId: item.playerId,
      playerName: item.playerName,
      divisionNo: item.divisionNo || 0,
      finalMatchId: item.finalMatchId || "",
    }));
    const candidates: QualificationCandidate[] = stored.filter((item) => item.entryType === "rate_candidate").map((item) => ({
      playerId: item.playerId,
      playerName: item.playerName,
      divisionNo: item.divisionNo || 0,
      gamesWon: Number(item.gamesWon),
      gamesLost: Number(item.gamesLost),
      gameWinRateBp: Number(item.gameWinRateBp),
      netGames: Number(item.netGames),
      rankNo: item.rankNo || 0,
      eligible: item.eligibilityStatus === "eligible",
      eligibilityStatus: item.eligibilityStatus,
      finalMatchId: item.finalMatchId || "",
      finalResultType: item.finalResultType,
      selected: Boolean(item.selected),
    }));
    return {
      ...row,
      phaseTitle: competitionPhaseLabel(row.phaseCode, row.phaseTitle),
      finalRoundNo,
      finalCount: finals.length,
      completedFinalCount: finals.filter((item) => item.resultStatus === "confirmed" || item.status === "auto_advanced").length,
      readyToConfirm: false,
      direct,
      candidates,
      confirmed: true,
      batchId: batch.id,
      confirmedAt: batch.confirmedAt,
      nextPhaseCode,
      nextPhaseTitle: nextPhaseCode ? competitionPhaseLabel(nextPhaseCode) : null,
      nextPhaseEntryCount: Number(nextPhaseEntryCount),
    };
  }

  const completedFinals = finals.filter((item) => (item.resultStatus === "confirmed" || item.status === "auto_advanced") && item.winnerPlayerId && item.winnerPlayerName);
  const direct: QualificationDirect[] = completedFinals.map((item) => ({
    playerId: item.winnerPlayerId!,
    playerName: item.winnerPlayerName!,
    divisionNo: item.divisionNo,
    finalMatchId: item.id,
  }));
  const stats = new Map<string, { won: number; lost: number }>();
  for (const score of scoreRows) {
    if (score.playerAId && score.scoreA !== null && score.scoreB !== null) {
      const item = stats.get(score.playerAId) ?? { won: 0, lost: 0 };
      item.won += Number(score.scoreA); item.lost += Number(score.scoreB); stats.set(score.playerAId, item);
    }
    if (score.playerBId && score.scoreA !== null && score.scoreB !== null) {
      const item = stats.get(score.playerBId) ?? { won: 0, lost: 0 };
      item.won += Number(score.scoreB); item.lost += Number(score.scoreA); stats.set(score.playerBId, item);
    }
  }
  const candidatesRaw = completedFinals.map((final) => {
    const loser = loserOfFinal(final);
    if (!loser) return null;
    const playerStats = stats.get(loser.id) ?? { won: 0, lost: 0 };
    const eligible = final.resultType === "normal" || final.status === "auto_advanced";
    return {
      playerId: loser.id,
      playerName: loser.name,
      divisionNo: final.divisionNo,
      gamesWon: playerStats.won,
      gamesLost: playerStats.lost,
      gameWinRateBp: rateBp(playerStats.won, playerStats.lost),
      netGames: playerStats.won - playerStats.lost,
      eligible,
      eligibilityStatus: eligible ? "eligible" : "special_result",
      finalMatchId: final.id,
      finalResultType: final.resultType,
    };
  }).filter(Boolean) as Array<Omit<QualificationCandidate, "rankNo" | "selected">>;
  candidatesRaw.sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    if (b.gameWinRateBp !== a.gameWinRateBp) return b.gameWinRateBp - a.gameWinRateBp;
    if (b.netGames !== a.netGames) return b.netGames - a.netGames;
    if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
    return a.divisionNo - b.divisionNo;
  });
  let eligibleRank = 0;
  const candidates: QualificationCandidate[] = candidatesRaw.map((item) => {
    if (item.eligible) eligibleRank += 1;
    return { ...item, rankNo: item.eligible ? eligibleRank : 0, selected: item.eligible && eligibleRank <= row.rateQualifierCount };
  });
  const eligibleCount = candidates.filter((item) => item.eligible).length;
  return {
    ...row,
    phaseTitle: competitionPhaseLabel(row.phaseCode, row.phaseTitle),
    finalRoundNo,
    finalCount: finals.length,
    completedFinalCount: completedFinals.length,
    readyToConfirm: finals.length === row.divisionCount && completedFinals.length === row.divisionCount && direct.length === row.divisionCount && eligibleCount >= row.rateQualifierCount,
    direct,
    candidates,
    confirmed: false,
    batchId: null,
    confirmedAt: null,
    nextPhaseCode,
    nextPhaseTitle: nextPhaseCode ? competitionPhaseLabel(nextPhaseCode) : null,
    nextPhaseEntryCount: Number(nextPhaseEntryCount),
  };
}

/** Two bridge reads total instead of per-stage N+1 reads. */
export async function getQualificationWorkspaceDataFast(input: AdminPrincipalInput, eventId: string): Promise<QualificationWorkspaceData> {
  const principal = await resolveAdminPrincipal(input);
  assertAdminRole(principal, ["system_admin", "committee", "referee"], "当前账号没有晋级管理权限。");
  if (!eventId) throw new Error("缺少赛事ID。");
  const sql = getSqlClient();
  const baseRows = await sql<BaseRow[]>`
    with accessible_event as (
      select e.id,e.short_title
      from public.events e
      where e.id=${eventId}
        and (${principal.role}='system_admin' or exists (
          select 1 from public.event_members em where em.event_id=e.id and em.user_id=${principal.id} and em.status='active'
        ))
      limit 1
    ), latest_stages as (
      select distinct on (b.group_id,b.phase_code)
        ds.id as "drawSessionId",b.id as "bracketId",b.event_id as "eventId",b.group_id as "groupId",eg.name as "groupName",
        b.phase_code as "phaseCode",ep.title as "phaseTitle",ds.version_no as "drawVersion",
        b.division_count as "divisionCount",b.division_size as "divisionSize",ds.rate_qualifier_count as "rateQualifierCount"
      from public.competition_brackets b
      join public.draw_sessions ds on ds.id=b.draw_session_id
      join public.event_groups eg on eg.id=b.group_id
      left join public.event_phases ep on ep.event_id=b.event_id and ep.code=b.phase_code
      where b.event_id=(select id from accessible_event) and b.phase_code in ('qualifier-one','qualifier-two') and ds.status='confirmed'
      order by b.group_id,b.phase_code,ds.version_no desc
    )
    select e.id,e.short_title as "shortTitle",
      coalesce((select jsonb_agg(to_jsonb(s) order by s."groupName",s."phaseCode") from latest_stages s),'[]'::jsonb) as stages
    from accessible_event e
  `;
  const base = baseRows[0];
  if (!base) throw new Error("没有找到这场赛事，或当前账号未被分配到本站。");
  const stages = base.stages ?? [];
  if (!stages.length) return { viewerRole: principal.role, event: { id: base.id, shortTitle: base.shortTitle }, stages: [] };

  const stageFilter = stages.map((stage) => ({ bracket_id: stage.bracketId, final_round_no: Math.log2(stage.divisionSize) }));
  const drawSessionIds = stages.map((stage) => stage.drawSessionId);
  const supportRows = await sql<SupportBundle[]>`
    with stage_filter as (
      select *
      from jsonb_to_recordset(${JSON.stringify(stageFilter)}::jsonb) as x(bracket_id text,final_round_no int)
    ), relevant_matches as (
      select bm.bracket_id as "bracketId",bm.id,bm.round_no as "roundNo",bm.division_no as "divisionNo",
        bm.player_a_id as "playerAId",bm.player_a_name as "playerAName",bm.player_b_id as "playerBId",bm.player_b_name as "playerBName",
        bm.winner_player_id as "winnerPlayerId",bm.winner_player_name as "winnerPlayerName",bm.score_a as "scoreA",bm.score_b as "scoreB",
        bm.result_type as "resultType",bm.result_status as "resultStatus",bm.status
      from public.competition_bracket_matches bm
      join stage_filter sf on sf.bracket_id=bm.bracket_id
      where bm.round_no=sf.final_round_no
        or (bm.result_status='confirmed' and bm.result_type='normal' and bm.score_a is not null and bm.score_b is not null)
    ), relevant_batches as (
      select qb.id,qb.draw_session_id as "drawSessionId",qb.confirmed_at as "confirmedAt"
      from public.competition_qualification_batches qb
      where qb.draw_session_id=any(${drawSessionIds}::text[])
    )
    select
      coalesce((
        select jsonb_agg(to_jsonb(m))
        from relevant_matches m
      ),'[]'::jsonb) as matches,
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id',b.id,
            'drawSessionId',b."drawSessionId",
            'confirmedAt',b."confirmedAt",
            'entries',coalesce((
              select jsonb_agg(
                jsonb_build_object(
                  'playerId',qe.player_id,
                  'playerName',qe.player_name,
                  'entryType',qe.entry_type,
                  'selected',qe.selected,
                  'rankNo',qe.rank_no,
                  'divisionNo',qe.division_no,
                  'gamesWon',qe.games_won,
                  'gamesLost',qe.games_lost,
                  'gameWinRateBp',qe.game_win_rate_bp,
                  'netGames',qe.net_games,
                  'finalMatchId',qe.final_match_id,
                  'finalResultType',qe.final_result_type,
                  'eligibilityStatus',qe.eligibility_status
                )
                order by case when qe.entry_type='direct' then 0 else 1 end,
                  coalesce(qe.rank_no,999),qe.division_no
              )
              from public.competition_qualification_entries qe
              where qe.batch_id=b.id
            ),'[]'::jsonb)
          )
          order by b."drawSessionId"
        )
        from relevant_batches b
      ),'[]'::jsonb) as batches,
      coalesce((
        select jsonb_agg(jsonb_build_object('groupId',pe.group_id,'phaseCode',pe.phase_code,'count',pe.cnt))
        from (
          select group_id,phase_code,count(*)::int as cnt
          from public.competition_phase_entries
          where event_id=${eventId} and status='active' and phase_code in ('qualifier-two','main-one')
          group by group_id,phase_code
        ) pe
      ),'[]'::jsonb) as "nextCounts"
  `;
  const support = supportRows[0] ?? { matches: [], batches: [], nextCounts: [] };
  return {
    viewerRole: principal.role,
    event: { id: base.id, shortTitle: base.shortTitle },
    stages: stages.map((stage) => buildStage(stage, support)),
  };
}
