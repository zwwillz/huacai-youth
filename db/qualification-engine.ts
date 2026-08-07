import { randomUUID } from "node:crypto";
import { getSqlClient } from "./index";
import { competitionPhaseLabel } from "./competition-labels";

export type QualificationCandidate = {
  playerId: string;
  playerName: string;
  divisionNo: number;
  gamesWon: number;
  gamesLost: number;
  gameWinRateBp: number;
  netGames: number;
  rankNo: number;
  eligible: boolean;
  eligibilityStatus: string;
  finalMatchId: string;
  finalResultType: string | null;
  selected: boolean;
};

export type QualificationDirect = {
  playerId: string;
  playerName: string;
  divisionNo: number;
  finalMatchId: string;
};

export type QualificationStage = {
  drawSessionId: string;
  bracketId: string;
  eventId: string;
  groupId: string;
  groupName: string;
  phaseCode: string;
  phaseTitle: string;
  drawVersion: number;
  divisionCount: number;
  divisionSize: number;
  rateQualifierCount: number;
  finalRoundNo: number;
  finalCount: number;
  completedFinalCount: number;
  readyToConfirm: boolean;
  direct: QualificationDirect[];
  candidates: QualificationCandidate[];
  confirmed: boolean;
  batchId: string | null;
  confirmedAt: string | null;
  nextPhaseCode: string | null;
  nextPhaseTitle: string | null;
  nextPhaseEntryCount: number;
};

export type QualificationWorkspaceData = {
  viewerRole: string;
  event: { id: string; shortTitle: string };
  stages: QualificationStage[];
};

type Viewer = { id: string; role: string };
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
type FinalRow = {
  id: string;
  divisionNo: number;
  playerAId: string | null;
  playerAName: string | null;
  playerBId: string | null;
  playerBName: string | null;
  winnerPlayerId: string | null;
  winnerPlayerName: string | null;
  resultType: string | null;
  resultStatus: string;
  status: string;
};
type ScoreRow = {
  playerAId: string | null;
  playerBId: string | null;
  scoreA: number | null;
  scoreB: number | null;
  resultType: string | null;
  resultStatus: string;
};

function now() { return new Date().toISOString(); }
function newId(prefix: string) { return `${prefix}_${randomUUID().replaceAll("-", "")}`; }

async function requireViewer(username: string, confirm = false): Promise<Viewer> {
  const sql = getSqlClient();
  const rows = await sql<Viewer[]>`select id,role from public.users where username=${username} and status='active' limit 1`;
  const viewer = rows[0];
  if (!viewer || !["system_admin","committee","referee"].includes(viewer.role)) throw new Error("当前账号没有晋级管理权限。");
  if (confirm && !["system_admin","committee"].includes(viewer.role)) throw new Error("晋级名单确认需要系统管理员或组委会权限。");
  return viewer;
}

function loserOfFinal(row: FinalRow) {
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

async function loadLatestStageRows(eventId: string): Promise<StageRow[]> {
  const sql = getSqlClient();
  return sql<StageRow[]>`
    select distinct on (b.group_id,b.phase_code)
      ds.id as "drawSessionId",b.id as "bracketId",b.event_id as "eventId",b.group_id as "groupId",eg.name as "groupName",
      b.phase_code as "phaseCode",ep.title as "phaseTitle",ds.version_no as "drawVersion",
      b.division_count as "divisionCount",b.division_size as "divisionSize",ds.rate_qualifier_count as "rateQualifierCount"
    from public.competition_brackets b
    join public.draw_sessions ds on ds.id=b.draw_session_id
    join public.event_groups eg on eg.id=b.group_id
    left join public.event_phases ep on ep.event_id=b.event_id and ep.code=b.phase_code
    where b.event_id=${eventId} and b.phase_code in ('qualifier-one','qualifier-two') and ds.status='confirmed'
    order by b.group_id,b.phase_code,ds.version_no desc
  `;
}

async function buildStage(row: StageRow): Promise<QualificationStage> {
  const sql = getSqlClient();
  const finalRoundNo = Math.log2(row.divisionSize);
  const [finals, scoreRows, batchRows, nextCountRows] = await Promise.all([
    sql<FinalRow[]>`
      select id,division_no as "divisionNo",player_a_id as "playerAId",player_a_name as "playerAName",
        player_b_id as "playerBId",player_b_name as "playerBName",winner_player_id as "winnerPlayerId",winner_player_name as "winnerPlayerName",
        result_type as "resultType",result_status as "resultStatus",status
      from public.competition_bracket_matches
      where bracket_id=${row.bracketId} and match_type='division' and round_no=${finalRoundNo}
      order by division_no
    `,
    sql<ScoreRow[]>`
      select player_a_id as "playerAId",player_b_id as "playerBId",score_a as "scoreA",score_b as "scoreB",result_type as "resultType",result_status as "resultStatus"
      from public.competition_bracket_matches
      where bracket_id=${row.bracketId} and result_status='confirmed' and result_type='normal' and score_a is not null and score_b is not null
    `,
    sql<Array<{ id: string; confirmedAt: string | null }>>`
      select id,confirmed_at as "confirmedAt" from public.competition_qualification_batches where draw_session_id=${row.drawSessionId} limit 1
    `,
    sql<Array<{ count: number }>>`
      select count(*)::int as count from public.competition_phase_entries
      where event_id=${row.eventId} and group_id=${row.groupId} and phase_code=${stageNextPhase(row.phaseCode) || ''} and status='active'
    `,
  ]);

  const batch = batchRows[0] ?? null;
  if (batch) {
    const stored = await sql<Array<{
      playerId: string; playerName: string; entryType: string; selected: boolean; rankNo: number | null; divisionNo: number | null;
      gamesWon: number; gamesLost: number; gameWinRateBp: number; netGames: number; finalMatchId: string | null; finalResultType: string | null; eligibilityStatus: string;
    }>>`
      select player_id as "playerId",player_name as "playerName",entry_type as "entryType",selected,rank_no as "rankNo",division_no as "divisionNo",
        games_won as "gamesWon",games_lost as "gamesLost",game_win_rate_bp as "gameWinRateBp",net_games as "netGames",
        final_match_id as "finalMatchId",final_result_type as "finalResultType",eligibility_status as "eligibilityStatus"
      from public.competition_qualification_entries where batch_id=${batch.id}
      order by case when entry_type='direct' then 0 else 1 end,coalesce(rank_no,999),division_no
    `;
    const direct = stored.filter((item) => item.entryType === "direct").map((item) => ({ playerId: item.playerId, playerName: item.playerName, divisionNo: item.divisionNo || 0, finalMatchId: item.finalMatchId || "" }));
    const candidates = stored.filter((item) => item.entryType === "rate_candidate").map((item) => ({
      playerId: item.playerId, playerName: item.playerName, divisionNo: item.divisionNo || 0, gamesWon: item.gamesWon, gamesLost: item.gamesLost,
      gameWinRateBp: item.gameWinRateBp, netGames: item.netGames, rankNo: item.rankNo || 0, eligible: item.eligibilityStatus === "eligible",
      eligibilityStatus: item.eligibilityStatus, finalMatchId: item.finalMatchId || "", finalResultType: item.finalResultType, selected: item.selected,
    }));
    const nextPhaseCode = stageNextPhase(row.phaseCode);
    return {
      ...row, phaseTitle: competitionPhaseLabel(row.phaseCode, row.phaseTitle), finalRoundNo, finalCount: finals.length,
      completedFinalCount: finals.filter((item) => item.resultStatus === "confirmed" || item.status === "auto_advanced").length,
      readyToConfirm: false, direct, candidates, confirmed: true, batchId: batch.id, confirmedAt: batch.confirmedAt,
      nextPhaseCode, nextPhaseTitle: nextPhaseCode ? competitionPhaseLabel(nextPhaseCode) : null, nextPhaseEntryCount: nextCountRows[0]?.count ?? 0,
    };
  }

  const completedFinals = finals.filter((item) => (item.resultStatus === "confirmed" || item.status === "auto_advanced") && item.winnerPlayerId && item.winnerPlayerName);
  const direct: QualificationDirect[] = completedFinals.map((item) => ({ playerId: item.winnerPlayerId!, playerName: item.winnerPlayerName!, divisionNo: item.divisionNo, finalMatchId: item.id }));
  const stats = new Map<string, { won: number; lost: number }>();
  for (const score of scoreRows) {
    if (score.playerAId && score.scoreA !== null && score.scoreB !== null) {
      const item = stats.get(score.playerAId) ?? { won: 0, lost: 0 };
      item.won += score.scoreA; item.lost += score.scoreB; stats.set(score.playerAId, item);
    }
    if (score.playerBId && score.scoreA !== null && score.scoreB !== null) {
      const item = stats.get(score.playerBId) ?? { won: 0, lost: 0 };
      item.won += score.scoreB; item.lost += score.scoreA; stats.set(score.playerBId, item);
    }
  }

  const candidatesRaw = completedFinals.map((final) => {
    const loser = loserOfFinal(final);
    if (!loser) return null;
    const playerStats = stats.get(loser.id) ?? { won: 0, lost: 0 };
    const eligible = final.resultType === "normal" || final.status === "auto_advanced";
    return {
      playerId: loser.id, playerName: loser.name, divisionNo: final.divisionNo,
      gamesWon: playerStats.won, gamesLost: playerStats.lost, gameWinRateBp: rateBp(playerStats.won, playerStats.lost), netGames: playerStats.won - playerStats.lost,
      eligible, eligibilityStatus: eligible ? "eligible" : "special_result", finalMatchId: final.id, finalResultType: final.resultType,
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
  const nextPhaseCode = stageNextPhase(row.phaseCode);
  return {
    ...row, phaseTitle: competitionPhaseLabel(row.phaseCode, row.phaseTitle), finalRoundNo, finalCount: finals.length,
    completedFinalCount: completedFinals.length,
    readyToConfirm: finals.length === row.divisionCount && completedFinals.length === row.divisionCount && direct.length === row.divisionCount && eligibleCount >= row.rateQualifierCount,
    direct, candidates, confirmed: false, batchId: null, confirmedAt: null,
    nextPhaseCode, nextPhaseTitle: nextPhaseCode ? competitionPhaseLabel(nextPhaseCode) : null, nextPhaseEntryCount: nextCountRows[0]?.count ?? 0,
  };
}

export async function getQualificationWorkspaceData(username: string, eventId: string): Promise<QualificationWorkspaceData> {
  const viewer = await requireViewer(username);
  const sql = getSqlClient();
  const eventRows = await sql<Array<{ id: string; shortTitle: string }>>`select id,short_title as "shortTitle" from public.events where id=${eventId} limit 1`;
  if (!eventRows[0]) throw new Error("没有找到这场赛事。");
  const rows = await loadLatestStageRows(eventId);
  const stages = await Promise.all(rows.map(buildStage));
  return { viewerRole: viewer.role, event: eventRows[0], stages };
}

export async function confirmQualificationStage(username: string, drawSessionId: string, selectedRatePlayerIds: string[]) {
  const viewer = await requireViewer(username, true);
  const sql = getSqlClient();
  const stageRows = await sql<StageRow[]>`
    select ds.id as "drawSessionId",b.id as "bracketId",b.event_id as "eventId",b.group_id as "groupId",eg.name as "groupName",
      b.phase_code as "phaseCode",ep.title as "phaseTitle",ds.version_no as "drawVersion",b.division_count as "divisionCount",b.division_size as "divisionSize",
      ds.rate_qualifier_count as "rateQualifierCount"
    from public.competition_brackets b
    join public.draw_sessions ds on ds.id=b.draw_session_id
    join public.event_groups eg on eg.id=b.group_id
    left join public.event_phases ep on ep.event_id=b.event_id and ep.code=b.phase_code
    where ds.id=${drawSessionId} and ds.status='confirmed' limit 1
  `;
  const row = stageRows[0];
  if (!row || !["qualifier-one","qualifier-two"].includes(row.phaseCode)) throw new Error("没有找到可确认的资格赛签表。");
  const existing = await sql<Array<{ id: string }>>`select id from public.competition_qualification_batches where draw_session_id=${drawSessionId} limit 1`;
  if (existing[0]) throw new Error("本阶段晋级名单已经确认，不能重复确认。");
  const stage = await buildStage(row);
  if (!stage.readyToConfirm) throw new Error(`还不能确认晋级：分区决胜已完成 ${stage.completedFinalCount}/${stage.divisionCount}。请先确认所有分区决胜赛果。`);

  const selectedIds = [...new Set(selectedRatePlayerIds.map(String))];
  if (selectedIds.length !== row.rateQualifierCount) throw new Error(`必须确认 ${row.rateQualifierCount} 名局胜率增补球员。`);
  const eligibleIds = new Set(stage.candidates.filter((item) => item.eligible).map((item) => item.playerId));
  if (selectedIds.some((id) => !eligibleIds.has(id))) throw new Error("所选增补球员不在当前有效候补池中。");

  const batchId = newId("qual");
  const changedAt = now();
  const qualifiedIds = new Set([...stage.direct.map((item) => item.playerId), ...selectedIds]);
  const directRows = stage.direct.map((item) => ({
    id: newId("qe"), batch_id: batchId, player_id: item.playerId, player_name: item.playerName, entry_type: "direct", selected: true,
    rank_no: null, division_no: item.divisionNo, games_won: 0, games_lost: 0, game_win_rate_bp: 0, net_games: 0,
    final_match_id: item.finalMatchId, final_result_type: "winner", eligibility_status: "eligible", created_at: changedAt,
  }));
  const candidateRows = stage.candidates.map((item) => ({
    id: newId("qe"), batch_id: batchId, player_id: item.playerId, player_name: item.playerName, entry_type: "rate_candidate", selected: selectedIds.includes(item.playerId),
    rank_no: item.rankNo || null, division_no: item.divisionNo, games_won: item.gamesWon, games_lost: item.gamesLost, game_win_rate_bp: item.gameWinRateBp, net_games: item.netGames,
    final_match_id: item.finalMatchId, final_result_type: item.finalResultType, eligibility_status: item.eligibilityStatus, created_at: changedAt,
  }));

  await sql.begin(async (tx) => {
    await tx`insert into public.competition_qualification_batches
      (id,draw_session_id,event_id,group_id,phase_code,status,direct_count,rate_candidate_count,rate_selected_count,metric_rule,tiebreak_rule,confirmed_by,confirmed_at,created_at,updated_at)
      values (${batchId},${drawSessionId},${row.eventId},${row.groupId},${row.phaseCode},'confirmed',${stage.direct.length},${stage.candidates.length},${selectedIds.length},'game_win_rate','net_games_then_games_won_then_division',${viewer.id},${changedAt},${changedAt},${changedAt})`;
    const allRows = [...directRows, ...candidateRows];
    if (allRows.length) await tx`insert into public.competition_qualification_entries
      (id,batch_id,player_id,player_name,entry_type,selected,rank_no,division_no,games_won,games_lost,game_win_rate_bp,net_games,final_match_id,final_result_type,eligibility_status,created_at)
      select x.id,x.batch_id,x.player_id,x.player_name,x.entry_type,x.selected,x.rank_no,x.division_no,x.games_won,x.games_lost,x.game_win_rate_bp,x.net_games,x.final_match_id,x.final_result_type,x.eligibility_status,x.created_at
      from jsonb_to_recordset(${JSON.stringify(allRows)}::jsonb) as x(id text,batch_id text,player_id text,player_name text,entry_type text,selected boolean,rank_no int,division_no int,games_won int,games_lost int,game_win_rate_bp int,net_games int,final_match_id text,final_result_type text,eligibility_status text,created_at text)`;

    if (row.phaseCode === "qualifier-one") {
      const activeSecondDraw = await tx<Array<{ count: number }>>`select count(*)::int as count from public.draw_sessions where event_id=${row.eventId} and group_id=${row.groupId} and phase_code='qualifier-two' and status in ('draft','confirmed')`;
      if ((activeSecondDraw[0]?.count ?? 0) > 0) throw new Error("资格赛第二场已经存在抽签，不能重新生成第二场参赛名单。");
      const participants = await tx<Array<{ playerId: string; playerName: string; randomOrder: number }>>`
        select player_id as "playerId",player_name as "playerName",random_order as "randomOrder"
        from public.draw_participants where session_id=${drawSessionId} order by random_order
      `;
      const remaining = participants.filter((item) => item.playerId && !qualifiedIds.has(item.playerId));
      await tx`delete from public.competition_phase_entries where event_id=${row.eventId} and group_id=${row.groupId} and phase_code='qualifier-two'`;
      const phaseRows = remaining.map((item, index) => ({ id: newId("pe"), event_id: row.eventId, group_id: row.groupId, phase_code: "qualifier-two", player_id: item.playerId, player_name: item.playerName, source_type: "qualifier_one_non_qualified", source_ref: batchId, status: "active", sort_order: index + 1, created_at: changedAt, updated_at: changedAt }));
      if (phaseRows.length) await tx`insert into public.competition_phase_entries
        (id,event_id,group_id,phase_code,player_id,player_name,source_type,source_ref,status,sort_order,created_at,updated_at)
        select x.id,x.event_id,x.group_id,x.phase_code,x.player_id,x.player_name,x.source_type,x.source_ref,x.status,x.sort_order,x.created_at,x.updated_at
        from jsonb_to_recordset(${JSON.stringify(phaseRows)}::jsonb) as x(id text,event_id text,group_id text,phase_code text,player_id text,player_name text,source_type text,source_ref text,status text,sort_order int,created_at text,updated_at text)`;
    }

    await tx`insert into public.audit_logs (id,actor_user_id,event_id,module_type,target_type,target_id,action,after_json,created_at)
      values (${newId("log")},${viewer.id},${row.eventId},'competition','qualification_batch',${batchId},'confirm_qualification',${JSON.stringify({ phaseCode: row.phaseCode, directCount: stage.direct.length, rateSelectedCount: selectedIds.length, selectedRatePlayerIds: selectedIds, nextPhase: row.phaseCode === "qualifier-one" ? "qualifier-two" : null })},${changedAt})`;
  });
  return { ok: true, eventId: row.eventId, groupId: row.groupId, phaseCode: row.phaseCode, batchId };
}
