import { randomUUID } from "node:crypto";
import { getSqlClient } from "./index";
import { prepareMain32Advancement } from "./main-competition-flow";
import { prepareFinalRankingDraft } from "./final-ranking-engine";

export type ScoringMatch = {
  assignmentId: string;
  scheduleId: string;
  bracketMatchId: string;
  eventId: string;
  groupId: string;
  groupName: string;
  phaseCode: string;
  phaseTitle: string;
  matchCode: string;
  roundName: string;
  divisionNo: number | null;
  playerAId: string | null;
  playerAName: string | null;
  playerBId: string | null;
  playerBName: string | null;
  matchDate: string | null;
  startTime: string | null;
  tableName: string | null;
  refereeUserId: string | null;
  refereeName: string | null;
  scoreA: number | null;
  scoreB: number | null;
  resultType: string | null;
  resultStatus: string;
  winnerPlayerId: string | null;
  winnerPlayerName: string | null;
  submittedAt: string | null;
  confirmedAt: string | null;
};

export type ScoringWorkspaceData = {
  viewer: { id: string; role: string; displayName: string };
  event: { id: string; shortTitle: string; startDate: string; endDate: string };
  matches: ScoringMatch[];
};

type Viewer = { id: string; role: string; displayName: string };

function now() { return new Date().toISOString(); }
function newId(prefix: string) { return `${prefix}_${randomUUID().replaceAll("-", "")}`; }

async function requireViewer(username: string): Promise<Viewer> {
  const sql = getSqlClient();
  const rows = await sql<Viewer[]>`
    select id,role,display_name as "displayName"
    from public.users
    where username=${username} and status='active'
    limit 1
  `;
  const viewer = rows[0];
  if (!viewer || !["system_admin", "committee", "referee"].includes(viewer.role)) throw new Error("当前账号没有比分录入权限。");
  return viewer;
}

export async function getScoringWorkspaceData(username: string, eventId: string): Promise<ScoringWorkspaceData> {
  const viewer = await requireViewer(username);
  const sql = getSqlClient();
  const eventRows = await sql<Array<{ id: string; shortTitle: string; startDate: string; endDate: string }>>`
    select id,short_title as "shortTitle",start_date as "startDate",end_date as "endDate"
    from public.events where id=${eventId} limit 1
  `;
  const event = eventRows[0];
  if (!event) throw new Error("没有找到这场赛事。");

  const matches = await sql<ScoringMatch[]>`
    select
      ms.id as "assignmentId", ms.schedule_id as "scheduleId", bm.id as "bracketMatchId",
      bm.event_id as "eventId", bm.group_id as "groupId", eg.name as "groupName",
      bm.phase_code as "phaseCode", coalesce(ep.title,bm.phase_code) as "phaseTitle",
      bm.match_code as "matchCode", bm.round_name as "roundName", bm.division_no as "divisionNo",
      bm.player_a_id as "playerAId", bm.player_a_name as "playerAName",
      bm.player_b_id as "playerBId", bm.player_b_name as "playerBName",
      ts.match_date as "matchDate", ts.start_time as "startTime", t.display_name as "tableName",
      ms.referee_user_id as "refereeUserId", ru.display_name as "refereeName",
      bm.score_a as "scoreA", bm.score_b as "scoreB", bm.result_type as "resultType",
      bm.result_status as "resultStatus", bm.winner_player_id as "winnerPlayerId", bm.winner_player_name as "winnerPlayerName",
      bm.submitted_at as "submittedAt", bm.confirmed_at as "confirmedAt"
    from public.competition_match_schedules ms
    join public.competition_schedules s on s.id=ms.schedule_id
    join public.competition_bracket_matches bm on bm.id=ms.bracket_match_id
    join public.event_groups eg on eg.id=bm.group_id
    left join public.event_phases ep on ep.event_id=bm.event_id and ep.code=bm.phase_code
    left join public.competition_time_slots ts on ts.id=ms.time_slot_id
    left join public.competition_event_tables t on t.id=ms.table_id
    left join public.users ru on ru.id=ms.referee_user_id
    where bm.event_id=${eventId}
      and bm.status <> 'void'
      and (${viewer.role} <> 'referee' or ms.referee_user_id=${viewer.id})
    order by coalesce(ts.match_date,'9999-12-31'),coalesce(ts.start_time,'99:99'),coalesce(t.sort_order,9999),bm.sort_order
  `;
  return { viewer, event, matches };
}

function winnerForResult(input: {
  resultType: string;
  scoreA: number | null;
  scoreB: number | null;
  playerAId: string | null;
  playerAName: string | null;
  playerBId: string | null;
  playerBName: string | null;
}) {
  if (!input.playerAId || !input.playerAName || !input.playerBId || !input.playerBName) throw new Error("双方球员尚未确定，不能提交赛果。");
  if (input.resultType === "normal") {
    if (input.scoreA === null || input.scoreB === null || input.scoreA < 0 || input.scoreB < 0 || !Number.isInteger(input.scoreA) || !Number.isInteger(input.scoreB)) throw new Error("正常完赛需要填写有效的整数比分。");
    if (input.scoreA === input.scoreB) throw new Error("淘汰赛比分不能相同。");
    return input.scoreA > input.scoreB
      ? { id: input.playerAId, name: input.playerAName }
      : { id: input.playerBId, name: input.playerBName };
  }
  const aLoses = ["a_forfeit", "a_no_show", "a_disqualified"].includes(input.resultType);
  const bLoses = ["b_forfeit", "b_no_show", "b_disqualified"].includes(input.resultType);
  if (!aLoses && !bLoses) throw new Error("不支持的特殊赛果类型。");
  return aLoses ? { id: input.playerBId, name: input.playerBName } : { id: input.playerAId, name: input.playerAName };
}

export async function submitMatchResult(username: string, input: {
  assignmentId: string;
  resultType: string;
  scoreA?: number | null;
  scoreB?: number | null;
  note?: string;
}) {
  const viewer = await requireViewer(username);
  const sql = getSqlClient();
  const rows = await sql<Array<{
    bracketMatchId: string; eventId: string; playerAId: string | null; playerAName: string | null; playerBId: string | null; playerBName: string | null;
    refereeUserId: string | null; resultStatus: string;
  }>>`
    select bm.id as "bracketMatchId",bm.event_id as "eventId",bm.player_a_id as "playerAId",bm.player_a_name as "playerAName",
      bm.player_b_id as "playerBId",bm.player_b_name as "playerBName",ms.referee_user_id as "refereeUserId",bm.result_status as "resultStatus"
    from public.competition_match_schedules ms
    join public.competition_bracket_matches bm on bm.id=ms.bracket_match_id
    where ms.id=${input.assignmentId}
    limit 1
  `;
  const match = rows[0];
  if (!match) throw new Error("没有找到这场比赛。");
  if (viewer.role === "referee" && match.refereeUserId !== viewer.id) throw new Error("这场比赛没有分配给当前裁判账号。");
  if (match.resultStatus === "confirmed") throw new Error("赛果已经确认。如需更正，请由组委会在后续更正流程中处理。");

  const resultType = String(input.resultType || "normal");
  const scoreA = input.scoreA === null || input.scoreA === undefined || input.scoreA === ("" as unknown as number) ? null : Number(input.scoreA);
  const scoreB = input.scoreB === null || input.scoreB === undefined || input.scoreB === ("" as unknown as number) ? null : Number(input.scoreB);
  const winner = winnerForResult({ resultType, scoreA, scoreB, ...match });
  const changedAt = now();
  await sql.begin(async (tx) => {
    await tx`
      update public.competition_bracket_matches
      set score_a=${resultType === "normal" ? scoreA : null},score_b=${resultType === "normal" ? scoreB : null},result_type=${resultType},result_status='submitted',
          winner_player_id=${winner.id},winner_player_name=${winner.name},submitted_by=${viewer.id},submitted_at=${changedAt},result_note=${String(input.note || "").trim() || null},updated_at=${changedAt}
      where id=${match.bracketMatchId}
    `;
    await tx`insert into public.audit_logs (id,actor_user_id,event_id,module_type,target_type,target_id,action,after_json,created_at)
      values (${newId("log")},${viewer.id},${match.eventId},'competition','match_result',${match.bracketMatchId},'submit_match_result',${JSON.stringify({ resultType, scoreA, scoreB, winner: winner.name, note: input.note || null })},${changedAt})`;
  });
  return { ok: true, eventId: match.eventId };
}

export async function confirmMatchResult(username: string, assignmentId: string) {
  const viewer = await requireViewer(username);
  if (!["system_admin", "committee"].includes(viewer.role)) throw new Error("赛果确认需要系统管理员或组委会权限。");
  const sql = getSqlClient();
  const rows = await sql<Array<{
    bracketMatchId: string; eventId: string; groupId: string; phaseCode: string; resultStatus: string;
    winnerPlayerId: string | null; winnerPlayerName: string | null;
    playerAId: string | null; playerAName: string | null; playerBId: string | null; playerBName: string | null;
  }>>`
    select bm.id as "bracketMatchId",bm.event_id as "eventId",bm.group_id as "groupId",bm.phase_code as "phaseCode",bm.result_status as "resultStatus",
      bm.winner_player_id as "winnerPlayerId",bm.winner_player_name as "winnerPlayerName",
      bm.player_a_id as "playerAId",bm.player_a_name as "playerAName",bm.player_b_id as "playerBId",bm.player_b_name as "playerBName"
    from public.competition_match_schedules ms
    join public.competition_bracket_matches bm on bm.id=ms.bracket_match_id
    where ms.id=${assignmentId}
    limit 1
  `;
  const match = rows[0];
  if (!match) throw new Error("没有找到这场比赛。");
  if (match.resultStatus !== "submitted" || !match.winnerPlayerId || !match.winnerPlayerName) throw new Error("请先提交赛果，再进行确认。");
  const loser = match.playerAId === match.winnerPlayerId
    ? { id: match.playerBId, name: match.playerBName }
    : { id: match.playerAId, name: match.playerAName };
  const changedAt = now();

  await sql.begin(async (tx) => {
    await tx`
      update public.competition_bracket_matches
      set result_status='confirmed',status='completed',confirmed_by=${viewer.id},confirmed_at=${changedAt},updated_at=${changedAt}
      where id=${match.bracketMatchId}
    `;
    const links = await tx<Array<{ targetMatchId: string; targetSide: string; sourceResult: string }>>`
      select target_match_id as "targetMatchId",target_side as "targetSide",source_result as "sourceResult"
      from public.competition_match_links
      where source_match_id=${match.bracketMatchId} and source_result in ('winner','loser')
    `;
    for (const link of links) {
      const player = link.sourceResult === "loser" ? loser : { id: match.winnerPlayerId, name: match.winnerPlayerName };
      if (!player.id || !player.name) continue;
      if (link.targetSide === "A") {
        await tx`update public.competition_bracket_matches set player_a_id=${player.id},player_a_name=${player.name},updated_at=${changedAt} where id=${link.targetMatchId}`;
      } else {
        await tx`update public.competition_bracket_matches set player_b_id=${player.id},player_b_name=${player.name},updated_at=${changedAt} where id=${link.targetMatchId}`;
      }
    }
    await tx`insert into public.audit_logs (id,actor_user_id,event_id,module_type,target_type,target_id,action,after_json,created_at)
      values (${newId("log")},${viewer.id},${match.eventId},'competition','match_result',${match.bracketMatchId},'confirm_match_result',${JSON.stringify({ winner: match.winnerPlayerName, loser: loser.name, propagatedTo: links.length })},${changedAt})`;
  });
  if (match.phaseCode === "main-one") await prepareMain32Advancement(match.eventId, match.groupId);
  if (match.phaseCode === "main-two") await prepareFinalRankingDraft(match.eventId, match.groupId);
  return { ok: true, eventId: match.eventId };
}
