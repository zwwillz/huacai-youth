import { getSqlClient } from "./index";
import { prepareFinalRankingDraft } from "./final-ranking-engine";

type Readiness = {
  mainOneSessionId: string | null;
  mainTwoSessionId: string | null;
  mainOneTotal: number;
  mainOneCompleted: number;
  mainTwoTotal: number;
  mainTwoCompleted: number;
  existingBatchId: string | null;
  existingStatus: string | null;
};

/**
 * Called after each main-two confirmation. The common case is one lightweight
 * aggregate query; the heavy ranking generator only runs once all 64 source
 * elimination results are actually complete.
 */
export async function prepareFinalRankingDraftIfReadyFast(eventId: string, groupId: string) {
  const sql = getSqlClient();
  const rows = await sql<Readiness[]>`
    with sessions as (
      select distinct on (phase_code) phase_code,id
      from public.draw_sessions
      where event_id=${eventId} and group_id=${groupId} and phase_code in ('main-one','main-two') and status='confirmed'
      order by phase_code,version_no desc
    ), counts as (
      select s.phase_code,
        count(bm.id)::int as total,
        count(bm.id) filter(where bm.result_status='confirmed')::int as completed
      from sessions s
      left join public.competition_bracket_matches bm on bm.draw_session_id=s.id
        and ((s.phase_code='main-two' and bm.match_type in ('main_single','third_place'))
          or (s.phase_code='main-one' and bm.round_name in ('败部第一轮','败部晋级轮')))
      group by s.phase_code
    )
    select
      (select id from sessions where phase_code='main-one') as "mainOneSessionId",
      (select id from sessions where phase_code='main-two') as "mainTwoSessionId",
      coalesce((select total from counts where phase_code='main-one'),0)::int as "mainOneTotal",
      coalesce((select completed from counts where phase_code='main-one'),0)::int as "mainOneCompleted",
      coalesce((select total from counts where phase_code='main-two'),0)::int as "mainTwoTotal",
      coalesce((select completed from counts where phase_code='main-two'),0)::int as "mainTwoCompleted",
      (select b.id from public.competition_final_ranking_batches b
        where b.source_draw_session_id=(select id from sessions where phase_code='main-two') limit 1) as "existingBatchId",
      (select b.status from public.competition_final_ranking_batches b
        where b.source_draw_session_id=(select id from sessions where phase_code='main-two') limit 1) as "existingStatus"
  `;
  const state = rows[0];
  if (!state?.mainOneSessionId || !state.mainTwoSessionId) return { ready: false, count: Number(state?.mainTwoCompleted ?? 0) };
  if (state.existingBatchId) return { ready: true, count: 64, batchId: state.existingBatchId, status: state.existingStatus ?? "draft" };
  if (Number(state.mainOneTotal) !== 32 || Number(state.mainOneCompleted) !== 32 || Number(state.mainTwoTotal) !== 32 || Number(state.mainTwoCompleted) !== 32) {
    return { ready: false, count: Number(state.mainTwoCompleted), mainOneEliminationCount: Number(state.mainOneCompleted) };
  }
  return prepareFinalRankingDraft(eventId, groupId);
}
