import { randomUUID } from "node:crypto";
import { getSqlClient } from "./index";
import { assertAdminRole, resolveAdminPrincipal, type AdminPrincipalInput } from "./permissions";
import { prepareMain32Advancement } from "./main-competition-flow";
import { prepareFinalRankingDraft } from "./final-ranking-engine";
import { markCompetitionModuleDirty } from "./competition-context";

function now() { return new Date().toISOString(); }
function newId(prefix: string) { return `${prefix}_${randomUUID().replaceAll("-", "")}`; }

function winnerForResult(input: { resultType: string; scoreA: number | null; scoreB: number | null; playerAId: string | null; playerAName: string | null; playerBId: string | null; playerBName: string | null }) {
  if (!input.playerAId || !input.playerAName || !input.playerBId || !input.playerBName) throw new Error("双方球员尚未确定，不能提交赛果。");
  if (input.resultType === "normal") {
    if (input.scoreA === null || input.scoreB === null || input.scoreA < 0 || input.scoreB < 0 || !Number.isInteger(input.scoreA) || !Number.isInteger(input.scoreB)) throw new Error("正常完赛需要填写有效的整数比分。");
    if (input.scoreA === input.scoreB) throw new Error("淘汰赛比分不能相同。");
    return input.scoreA > input.scoreB ? { id: input.playerAId, name: input.playerAName } : { id: input.playerBId, name: input.playerBName };
  }
  const aLoses = ["a_forfeit", "a_no_show", "a_disqualified"].includes(input.resultType);
  const bLoses = ["b_forfeit", "b_no_show", "b_disqualified"].includes(input.resultType);
  if (!aLoses && !bLoses) throw new Error("不支持的特殊赛果类型。");
  return aLoses ? { id: input.playerBId, name: input.playerBName } : { id: input.playerAId, name: input.playerAName };
}

type SubmitMatchRow = {
  bracketMatchId: string;
  eventId: string;
  playerAId: string | null;
  playerAName: string | null;
  playerBId: string | null;
  playerBName: string | null;
  refereeUserId: string | null;
  resultStatus: string;
};

type ConfirmMatchRow = SubmitMatchRow & {
  groupId: string;
  phaseCode: string;
  winnerPlayerId: string | null;
  winnerPlayerName: string | null;
};

/** Session identity + event membership + assignment are checked in the same match lookup. */
export async function submitMatchResultFast(inputPrincipal: AdminPrincipalInput, input: { assignmentId: string; resultType: string; scoreA?: number | null; scoreB?: number | null; note?: string }) {
  const viewer = await resolveAdminPrincipal(inputPrincipal);
  assertAdminRole(viewer, ["system_admin", "committee", "referee"], "当前账号没有比分录入权限。");
  const sql = getSqlClient();
  const rows = await sql<SubmitMatchRow[]>`
    select bm.id as "bracketMatchId",bm.event_id as "eventId",bm.player_a_id as "playerAId",bm.player_a_name as "playerAName",
      bm.player_b_id as "playerBId",bm.player_b_name as "playerBName",ms.referee_user_id as "refereeUserId",bm.result_status as "resultStatus"
    from public.competition_match_schedules ms
    join public.competition_bracket_matches bm on bm.id=ms.bracket_match_id
    where ms.id=${input.assignmentId}
      and (${viewer.role}='system_admin' or exists (
        select 1 from public.event_members em where em.event_id=bm.event_id and em.user_id=${viewer.id} and em.status='active'
      ))
    limit 1
  `;
  const match = rows[0];
  if (!match) throw new Error("没有找到这场比赛，或当前账号未被分配到本站。");
  if (viewer.role === "referee" && match.refereeUserId !== viewer.id) throw new Error("这场比赛没有分配给当前裁判账号。");
  if (match.resultStatus === "confirmed") throw new Error("赛果已经确认。如需更正，请由组委会在后续更正流程中处理。");
  const resultType = String(input.resultType || "normal");
  const scoreA = input.scoreA === null || input.scoreA === undefined ? null : Number(input.scoreA);
  const scoreB = input.scoreB === null || input.scoreB === undefined ? null : Number(input.scoreB);
  const winner = winnerForResult({ resultType, scoreA, scoreB, ...match });
  const changedAt = now();
  await sql.begin(async (tx) => {
    const updated = await tx<Array<{ id: string }>>`
      update public.competition_bracket_matches
      set score_a=${resultType === "normal" ? scoreA : null},score_b=${resultType === "normal" ? scoreB : null},result_type=${resultType},result_status='submitted',
        winner_player_id=${winner.id},winner_player_name=${winner.name},submitted_by=${viewer.id},submitted_at=${changedAt},
        result_note=${String(input.note || "").trim() || null},updated_at=${changedAt}
      where id=${match.bracketMatchId} and result_status <> 'confirmed'
      returning id
    `;
    if (!updated.length) throw new Error("赛果已被其他人确认，请刷新后查看最新状态。");
    await tx`insert into public.audit_logs (id,actor_user_id,event_id,module_type,target_type,target_id,action,after_json,created_at)
      values (${newId("log")},${viewer.id},${match.eventId},'competition','match_result',${match.bracketMatchId},'submit_match_result',${JSON.stringify({ resultType, scoreA, scoreB, winner: winner.name, note: input.note || null })},${changedAt})`;
  });
  return { ok: true, eventId: match.eventId };
}

export async function confirmMatchResultFast(inputPrincipal: AdminPrincipalInput, assignmentId: string) {
  const viewer = await resolveAdminPrincipal(inputPrincipal);
  assertAdminRole(viewer, ["system_admin", "committee"], "赛果确认需要系统管理员或组委会权限。");
  const sql = getSqlClient();
  const rows = await sql<ConfirmMatchRow[]>`
    select bm.id as "bracketMatchId",bm.event_id as "eventId",bm.group_id as "groupId",bm.phase_code as "phaseCode",
      bm.result_status as "resultStatus",bm.winner_player_id as "winnerPlayerId",bm.winner_player_name as "winnerPlayerName",
      bm.player_a_id as "playerAId",bm.player_a_name as "playerAName",bm.player_b_id as "playerBId",bm.player_b_name as "playerBName",
      ms.referee_user_id as "refereeUserId"
    from public.competition_match_schedules ms
    join public.competition_bracket_matches bm on bm.id=ms.bracket_match_id
    where ms.id=${assignmentId}
      and (${viewer.role}='system_admin' or exists (
        select 1 from public.event_members em where em.event_id=bm.event_id and em.user_id=${viewer.id} and em.status='active'
      ))
    limit 1
  `;
  const match = rows[0];
  if (!match) throw new Error("没有找到这场比赛，或当前账号未被分配到本站。");
  if (match.resultStatus !== "submitted" || !match.winnerPlayerId || !match.winnerPlayerName) throw new Error("请先提交赛果，再进行确认。");
  const loser = match.playerAId === match.winnerPlayerId ? { id: match.playerBId, name: match.playerBName } : { id: match.playerAId, name: match.playerAName };
  if (!loser.id || !loser.name) throw new Error("无法识别负方球员，请检查本场对阵。");
  const changedAt = now();
  let propagatedCount = 0;
  await sql.begin(async (tx) => {
    const confirmed = await tx<Array<{ id: string }>>`
      update public.competition_bracket_matches
      set result_status='confirmed',status='completed',confirmed_by=${viewer.id},confirmed_at=${changedAt},updated_at=${changedAt}
      where id=${match.bracketMatchId} and result_status='submitted'
      returning id
    `;
    if (!confirmed.length) throw new Error("赛果状态已被其他人修改，请刷新后再操作。");

    const propagated = await tx<Array<{ id: string }>>`
      update public.competition_bracket_matches target
      set
        player_a_id=case when link.target_side='A' then case when link.source_result='winner' then ${match.winnerPlayerId} else ${loser.id} end else target.player_a_id end,
        player_a_name=case when link.target_side='A' then case when link.source_result='winner' then ${match.winnerPlayerName} else ${loser.name} end else target.player_a_name end,
        player_b_id=case when link.target_side='B' then case when link.source_result='winner' then ${match.winnerPlayerId} else ${loser.id} end else target.player_b_id end,
        player_b_name=case when link.target_side='B' then case when link.source_result='winner' then ${match.winnerPlayerName} else ${loser.name} end else target.player_b_name end,
        updated_at=${changedAt}
      from public.competition_match_links link
      where link.source_match_id=${match.bracketMatchId}
        and link.source_result in ('winner','loser')
        and link.target_match_id=target.id
      returning target.id
    `;
    propagatedCount = propagated.length;
    await tx`insert into public.audit_logs (id,actor_user_id,event_id,module_type,target_type,target_id,action,after_json,created_at)
      values (${newId("log")},${viewer.id},${match.eventId},'competition','match_result',${match.bracketMatchId},'confirm_match_result',${JSON.stringify({ winner: match.winnerPlayerName, loser: loser.name, propagatedTo: propagatedCount })},${changedAt})`;
  });
  if (match.phaseCode === "main-one") await prepareMain32Advancement(match.eventId, match.groupId);
  if (match.phaseCode === "main-two") await prepareFinalRankingDraft(match.eventId, match.groupId);
  await markCompetitionModuleDirty(match.eventId, "matches");
  return { ok: true, eventId: match.eventId };
}
