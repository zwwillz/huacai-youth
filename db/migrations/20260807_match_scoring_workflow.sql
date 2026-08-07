alter table public.competition_bracket_matches
  add column if not exists score_a integer,
  add column if not exists score_b integer,
  add column if not exists result_status text not null default 'pending',
  add column if not exists submitted_by text references public.users(id),
  add column if not exists submitted_at text,
  add column if not exists confirmed_by text references public.users(id),
  add column if not exists confirmed_at text,
  add column if not exists result_note text;

create index if not exists competition_bracket_matches_result_status_idx
  on public.competition_bracket_matches(event_id, group_id, phase_code, result_status);
