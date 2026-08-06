import { getSqlClient } from "./index";
import { getScheduleWorkspaceData, updateScheduleAssignment } from "./schedule-engine";

export async function updateScheduleAssignmentWithConflictCheck(username: string, sessionId: string, input: {
  assignmentId: string;
  timeSlotId: string | null;
  tableId: string | null;
  refereeUserId: string | null;
}) {
  const data = await getScheduleWorkspaceData(username, sessionId);
  if (!data.schedule) throw new Error("请先生成自动赛程。");
  const sql = getSqlClient();
  const currentRows = await sql<Array<{ playerAId: string | null; playerBId: string | null; matchCode: string }>>`
    select bm.player_a_id as "playerAId",bm.player_b_id as "playerBId",bm.match_code as "matchCode"
    from public.competition_match_schedules ms
    join public.competition_bracket_matches bm on bm.id=ms.bracket_match_id
    where ms.id=${input.assignmentId} and ms.schedule_id=${data.schedule.id}
    limit 1
  `;
  const current = currentRows[0];
  if (!current) throw new Error("没有找到需要调整的比赛。");

  if (input.timeSlotId) {
    const conflicts = await sql<Array<{ matchCode: string; tableConflict: boolean; refereeConflict: boolean; playerConflict: boolean }>>`
      select bm.match_code as "matchCode",
        (${input.tableId} is not null and ms.table_id=${input.tableId}) as "tableConflict",
        (${input.refereeUserId} is not null and ms.referee_user_id=${input.refereeUserId}) as "refereeConflict",
        (
          (${current.playerAId} is not null and (${current.playerAId}=bm.player_a_id or ${current.playerAId}=bm.player_b_id)) or
          (${current.playerBId} is not null and (${current.playerBId}=bm.player_a_id or ${current.playerBId}=bm.player_b_id))
        ) as "playerConflict"
      from public.competition_match_schedules ms
      join public.competition_bracket_matches bm on bm.id=ms.bracket_match_id
      where ms.schedule_id=${data.schedule.id}
        and ms.id<>${input.assignmentId}
        and ms.time_slot_id=${input.timeSlotId}
        and (
          (${input.tableId} is not null and ms.table_id=${input.tableId}) or
          (${input.refereeUserId} is not null and ms.referee_user_id=${input.refereeUserId}) or
          (${current.playerAId} is not null and (${current.playerAId}=bm.player_a_id or ${current.playerAId}=bm.player_b_id)) or
          (${current.playerBId} is not null and (${current.playerBId}=bm.player_a_id or ${current.playerBId}=bm.player_b_id))
        )
      limit 5
    `;
    if (conflicts.length) {
      const parts: string[] = [];
      if (conflicts.some((item) => item.tableConflict)) parts.push("该球台已安排其它比赛");
      if (conflicts.some((item) => item.refereeConflict)) parts.push("该裁判同一时间已有任务");
      if (conflicts.some((item) => item.playerConflict)) parts.push("球员同一时间存在比赛冲突");
      throw new Error(`${parts.join("；")}。冲突比赛：${conflicts.map((item) => item.matchCode).join("、")}`);
    }
  }

  return updateScheduleAssignment(username, sessionId, input);
}
