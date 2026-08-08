import { randomUUID } from "node:crypto";
import { getSqlClient } from "./index";

type AdvancementRow = {
  id: string;
  roundName: string;
  winnerPlayerId: string | null;
  winnerPlayerName: string | null;
  resultStatus: string;
  divisionNo: number | null;
  matchCode: string;
};
type Bundle = {
  sessionId: string | null;
  rows: AdvancementRow[] | null;
  existing: { id: string; status: string } | null;
};

function newId(prefix: string) { return `${prefix}_${randomUUID().replaceAll("-", "")}`; }

/** One readiness query on every main-one confirmation; inserts only after all 32 qualifiers exist. */
export async function prepareMain32AdvancementFast(eventId: string, groupId: string) {
  const sql = getSqlClient();
  const bundles = await sql<Bundle[]>`
    with latest_session as (
      select id from public.draw_sessions
      where event_id=${eventId} and group_id=${groupId} and phase_code='main-one' and status='confirmed'
      order by version_no desc limit 1
    )
    select
      (select id from latest_session) as "sessionId",
      coalesce((select jsonb_agg(jsonb_build_object(
        'id',bm.id,'roundName',bm.round_name,'winnerPlayerId',bm.winner_player_id,'winnerPlayerName',bm.winner_player_name,
        'resultStatus',bm.result_status,'divisionNo',bm.division_no,'matchCode',bm.match_code
      ) order by bm.division_no,bm.match_code)
        from public.competition_bracket_matches bm
        where bm.draw_session_id=(select id from latest_session) and bm.round_name in ('胜部晋级轮','败部晋级轮')),'[]'::jsonb) as rows,
      (select jsonb_build_object('id',b.id,'status',b.status)
        from public.competition_main_advancement_batches b
        where b.source_draw_session_id=(select id from latest_session) limit 1) as existing
  `;
  const bundle = bundles[0];
  const sessionId = bundle?.sessionId;
  if (!sessionId) return { ready: false, count: 0 };
  const rows = bundle.rows ?? [];
  const completed = rows.filter((row) => row.resultStatus === "confirmed" && row.winnerPlayerId && row.winnerPlayerName);
  if (rows.length !== 32 || completed.length !== 32) return { ready: false, count: completed.length };
  if (bundle.existing) return { ready: true, count: 32, batchId: bundle.existing.id, status: bundle.existing.status };

  const roster = rows.map((row) => ({
    playerId: row.winnerPlayerId!,
    playerName: row.winnerPlayerName!,
    sourceType: row.roundName === "胜部晋级轮" ? "winner_side_qualified" : "loser_side_qualified",
    sourceRef: row.id,
    divisionNo: row.divisionNo,
    matchCode: row.matchCode,
  }));
  const timestamp = new Date().toISOString();
  const id = newId("adv");
  await sql`
    insert into public.competition_main_advancement_batches
      (id,event_id,group_id,source_draw_session_id,status,winner_side_count,loser_side_count,roster_json,created_at,updated_at)
    values (${id},${eventId},${groupId},${sessionId},'draft',16,16,${JSON.stringify(roster)}::jsonb,${timestamp},${timestamp})
    on conflict (source_draw_session_id) do nothing
  `;
  const existing = await sql<Array<{ id: string; status: string }>>`
    select id,status from public.competition_main_advancement_batches where source_draw_session_id=${sessionId} limit 1
  `;
  return { ready: true, count: 32, batchId: existing[0]?.id ?? id, status: existing[0]?.status ?? "draft" };
}
