with published_schedule as (
  select p.id,p.event_id
  from public.publications p
  where p.module_type='schedule' and p.status='published' and p.snapshot_json is null
), latest_sessions as (
  select distinct on (ds.event_id,ds.group_id,ds.phase_code)
    ds.event_id,ds.id as draw_session_id,ds.group_id,eg.name as group_name,ds.phase_code,ds.version_no,ds.entrant_count,
    ds.bracket_size,ds.division_size,ds.division_count,ds.direct_qualifier_count,ds.rate_qualifier_count,
    ds.total_qualifier_count,ds.playoff_match_count,ds.bye_count
  from public.draw_sessions ds
  join public.event_groups eg on eg.id=ds.group_id
  join published_schedule ps on ps.event_id=ds.event_id
  where ds.status='confirmed'
  order by ds.event_id,ds.group_id,ds.phase_code,ds.version_no desc
), schedule_payload as (
  select ps.id,
    jsonb_build_object(
      'eventId',ps.event_id,
      'phaseSummaries',coalesce((
        select jsonb_agg(jsonb_build_object(
          'eventId',ls.event_id,'drawSessionId',ls.draw_session_id,'groupId',ls.group_id,'group',ls.group_name,'phaseId',ls.phase_code,
          'versionNo',ls.version_no,'entrantCount',ls.entrant_count,'bracketSize',ls.bracket_size,'divisionSize',ls.division_size,
          'divisionCount',ls.division_count,'directQualifierCount',ls.direct_qualifier_count,'rateQualifierCount',ls.rate_qualifier_count,
          'totalQualifierCount',ls.total_qualifier_count,'playoffMatchCount',ls.playoff_match_count,'byeCount',ls.bye_count
        ) order by ls.group_id,ls.phase_code) from latest_sessions ls where ls.event_id=ps.event_id
      ),'[]'::jsonb),
      'matches',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',bm.id,'eventId',bm.event_id,'drawSessionId',bm.draw_session_id,'groupId',bm.group_id,'group',ls.group_name,'phaseId',bm.phase_code,
          'divisionNo',bm.division_no,'roundNo',bm.round_no,'roundName',bm.round_name,'matchCode',bm.match_code,
          'sourceAType',bm.source_a_type,'sourceARef',bm.source_a_ref,'sourceBType',bm.source_b_type,'sourceBRef',bm.source_b_ref,
          'playerAId',bm.player_a_id,'playerA',bm.player_a_name,'playerBId',bm.player_b_id,'playerB',bm.player_b_name,
          'scoreA',case when bm.status='auto_advanced' then bm.score_a else null end,
          'scoreB',case when bm.status='auto_advanced' then bm.score_b else null end,
          'resultType',case when bm.status='auto_advanced' then bm.result_type else null end,
          'resultStatus','pending',
          'status',case when bm.status='auto_advanced' then 'auto_advanced' when bm.status='void' then 'void' else 'pending' end,
          'winnerPlayerId',case when bm.status='auto_advanced' then bm.winner_player_id else null end,
          'winnerPlayerName',case when bm.status='auto_advanced' then bm.winner_player_name else null end,
          'date',ts.match_date,'time',ts.start_time,'table',cet.display_name,'isTv',coalesce(cet.is_tv,false),'sortOrder',bm.sort_order
        ) order by bm.group_id,bm.phase_code,bm.sort_order,bm.id)
        from public.competition_bracket_matches bm
        join latest_sessions ls on ls.draw_session_id=bm.draw_session_id
        left join public.competition_match_schedules cms on cms.bracket_match_id=bm.id
        left join public.competition_time_slots ts on ts.id=cms.time_slot_id
        left join public.competition_event_tables cet on cet.id=cms.table_id
        where bm.event_id=ps.event_id
      ),'[]'::jsonb),
      'qualificationEntries',coalesce((
        select jsonb_agg(jsonb_build_object(
          'eventId',qb.event_id,'drawSessionId',qb.draw_session_id,'groupId',qb.group_id,'group',ls.group_name,'phaseId',qb.phase_code,
          'playerId',qe.player_id,'playerName',qe.player_name,'entryType',qe.entry_type,'selected',qe.selected,'rankNo',qe.rank_no,
          'divisionNo',qe.division_no,'gamesWon',qe.games_won,'gamesLost',qe.games_lost,'gameWinRateBp',qe.game_win_rate_bp,'netGames',qe.net_games
        ) order by qb.group_id,qb.phase_code,case when qe.entry_type='direct' then 0 else 1 end,coalesce(qe.rank_no,999),qe.division_no)
        from public.competition_qualification_batches qb
        join public.competition_qualification_entries qe on qe.batch_id=qb.id
        join latest_sessions ls on ls.draw_session_id=qb.draw_session_id
        where qb.event_id=ps.event_id and qb.status='confirmed'
      ),'[]'::jsonb),
      'mainRoster',coalesce((
        select jsonb_agg(jsonb_build_object(
          'eventId',pe.event_id,'groupId',pe.group_id,'group',eg.name,'playerId',pe.player_id,'playerName',pe.player_name,
          'sourceType',pe.source_type,'sortOrder',pe.sort_order
        ) order by pe.group_id,pe.sort_order,pe.player_name)
        from public.competition_phase_entries pe
        join public.event_groups eg on eg.id=pe.group_id
        where pe.event_id=ps.event_id and pe.phase_code='main-one' and pe.status='active'
          and exists(select 1 from public.competition_main_roster_locks ml where ml.event_id=pe.event_id and ml.group_id=pe.group_id and ml.status='locked')
      ),'[]'::jsonb)
    ) as payload
  from published_schedule ps
)
update public.publications p
set snapshot_json=sp.payload::text,has_unpublished_changes=false,draft_updated_at=null
from schedule_payload sp
where p.id=sp.id;

with published_matches as (
  select p.id,p.event_id
  from public.publications p
  where p.module_type='matches' and p.status='published' and p.snapshot_json is null
), latest_sessions as (
  select distinct on (ds.event_id,ds.group_id,ds.phase_code) ds.event_id,ds.id as draw_session_id,ds.group_id,ds.phase_code
  from public.draw_sessions ds
  join published_matches pm on pm.event_id=ds.event_id
  where ds.status='confirmed'
  order by ds.event_id,ds.group_id,ds.phase_code,ds.version_no desc
), result_payload as (
  select pm.id,
    jsonb_build_object(
      'eventId',pm.event_id,
      'matches',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',bm.id,'playerAId',bm.player_a_id,'playerA',bm.player_a_name,'playerBId',bm.player_b_id,'playerB',bm.player_b_name,
          'scoreA',case when bm.result_status='confirmed' or bm.status='auto_advanced' then bm.score_a else null end,
          'scoreB',case when bm.result_status='confirmed' or bm.status='auto_advanced' then bm.score_b else null end,
          'resultType',case when bm.result_status='confirmed' or bm.status='auto_advanced' then bm.result_type else null end,
          'resultStatus',case when bm.result_status='confirmed' then 'confirmed' else 'pending' end,
          'status',case when bm.result_status='confirmed' then 'completed' else bm.status end,
          'winnerPlayerId',case when bm.result_status='confirmed' or bm.status='auto_advanced' then bm.winner_player_id else null end,
          'winnerPlayerName',case when bm.result_status='confirmed' or bm.status='auto_advanced' then bm.winner_player_name else null end
        ) order by bm.group_id,bm.phase_code,bm.sort_order,bm.id)
        from public.competition_bracket_matches bm
        join latest_sessions ls on ls.draw_session_id=bm.draw_session_id
        where bm.event_id=pm.event_id
      ),'[]'::jsonb)
    ) as payload
  from published_matches pm
)
update public.publications p
set snapshot_json=rp.payload::text,has_unpublished_changes=false,draft_updated_at=null
from result_payload rp
where p.id=rp.id;
