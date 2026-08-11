export const QUALIFICATION_SUPPORT_SQL = `
  with latest_stages as (
    select distinct on (b.group_id,b.phase_code)
      ds.id as "drawSessionId",
      b.id as "bracketId",
      b.group_id as "groupId",
      b.phase_code as "phaseCode",
      b.division_size as "divisionSize"
    from public.competition_brackets b
    join public.draw_sessions ds on ds.id=b.draw_session_id
    where b.event_id=$1
      and b.phase_code in ('qualifier-one','qualifier-two')
      and ds.status='confirmed'
    order by b.group_id,b.phase_code,ds.version_no desc
  ), relevant_matches as (
    select bm.bracket_id as "bracketId",bm.id,bm.round_no as "roundNo",bm.division_no as "divisionNo",
      bm.player_a_id as "playerAId",bm.player_a_name as "playerAName",bm.player_b_id as "playerBId",bm.player_b_name as "playerBName",
      bm.winner_player_id as "winnerPlayerId",bm.winner_player_name as "winnerPlayerName",bm.score_a as "scoreA",bm.score_b as "scoreB",
      bm.result_type as "resultType",bm.result_status as "resultStatus",bm.status
    from latest_stages ls
    join public.competition_bracket_matches bm on bm.bracket_id=ls."bracketId"
    where bm.round_no=(ln(ls."divisionSize"::numeric)/ln(2))::int
      or (bm.result_status='confirmed' and bm.result_type='normal' and bm.score_a is not null and bm.score_b is not null)
  ), relevant_batches as (
    select qb.id,qb.draw_session_id as "drawSessionId",qb.confirmed_at as "confirmedAt"
    from latest_stages ls
    join public.competition_qualification_batches qb on qb.draw_session_id=ls."drawSessionId"
  ), next_counts as (
    select pe.group_id as "groupId",pe.phase_code as "phaseCode",count(*)::int as count
    from public.competition_phase_entries pe
    where pe.event_id=$1 and pe.status='active' and pe.phase_code in ('qualifier-two','main-one')
    group by pe.group_id,pe.phase_code
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
      select jsonb_agg(jsonb_build_object('groupId',n."groupId",'phaseCode',n."phaseCode",'count',n.count))
      from next_counts n
    ),'[]'::jsonb) as "nextCounts"
`;

export function loadQualificationSupportRows(sql, eventId) {
  return sql.unsafe(QUALIFICATION_SUPPORT_SQL, [eventId]);
}
