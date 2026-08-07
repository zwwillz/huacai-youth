create index if not exists competition_bracket_matches_workbench_idx
  on public.competition_bracket_matches(event_id, group_id, phase_code, result_status, sort_order);

create index if not exists competition_bracket_matches_draw_result_idx
  on public.competition_bracket_matches(draw_session_id, result_status, sort_order);

create index if not exists draw_sessions_active_phase_idx
  on public.draw_sessions(event_id, group_id, phase_code, status, version_no desc);

create index if not exists competition_time_slots_active_scope_idx
  on public.competition_time_slots(event_id, group_id, phase_code, is_active, sort_order);

create index if not exists event_members_user_status_idx
  on public.event_members(user_id, status, event_id);

create index if not exists users_status_created_idx
  on public.users(status, created_at desc);

create index if not exists competition_seed_entries_scope_status_idx
  on public.competition_seed_entries(event_id, group_id, status, seed_no);

create index if not exists competition_main_roster_locks_scope_version_idx
  on public.competition_main_roster_locks(event_id, group_id, version_no desc);

create index if not exists competition_main_advancement_scope_idx
  on public.competition_main_advancement_batches(event_id, group_id, created_at desc);

create index if not exists competition_final_ranking_scope_idx
  on public.competition_final_ranking_batches(event_id, group_id, created_at desc);
