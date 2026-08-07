create table if not exists public.competition_qualification_batches (
  id text primary key,
  draw_session_id text not null references public.draw_sessions(id) on delete cascade,
  event_id text not null references public.events(id) on delete cascade,
  group_id text not null references public.event_groups(id) on delete cascade,
  phase_code text not null,
  status text not null default 'confirmed',
  direct_count integer not null default 0,
  rate_candidate_count integer not null default 0,
  rate_selected_count integer not null default 0,
  metric_rule text not null default 'game_win_rate',
  tiebreak_rule text not null default 'net_games_then_games_won_then_division',
  confirmed_by text references public.users(id),
  confirmed_at text,
  created_at text not null,
  updated_at text not null
);
create unique index if not exists competition_qualification_batches_draw_unique
  on public.competition_qualification_batches(draw_session_id);
create index if not exists competition_qualification_batches_event_group_idx
  on public.competition_qualification_batches(event_id, group_id, phase_code, status);

create table if not exists public.competition_qualification_entries (
  id text primary key,
  batch_id text not null references public.competition_qualification_batches(id) on delete cascade,
  player_id text not null references public.players(id),
  player_name text not null,
  entry_type text not null,
  selected boolean not null default false,
  rank_no integer,
  division_no integer,
  games_won integer not null default 0,
  games_lost integer not null default 0,
  game_win_rate_bp integer not null default 0,
  net_games integer not null default 0,
  final_match_id text references public.competition_bracket_matches(id),
  final_result_type text,
  eligibility_status text not null default 'eligible',
  created_at text not null
);
create unique index if not exists competition_qualification_entries_batch_player_unique
  on public.competition_qualification_entries(batch_id, player_id);
create index if not exists competition_qualification_entries_batch_type_idx
  on public.competition_qualification_entries(batch_id, entry_type, selected, rank_no);

create table if not exists public.competition_phase_entries (
  id text primary key,
  event_id text not null references public.events(id) on delete cascade,
  group_id text not null references public.event_groups(id) on delete cascade,
  phase_code text not null,
  player_id text not null references public.players(id),
  player_name text not null,
  source_type text not null,
  source_ref text,
  status text not null default 'active',
  sort_order integer not null default 0,
  created_at text not null,
  updated_at text not null
);
create unique index if not exists competition_phase_entries_unique
  on public.competition_phase_entries(event_id, group_id, phase_code, player_id);
create index if not exists competition_phase_entries_phase_idx
  on public.competition_phase_entries(event_id, group_id, phase_code, status, sort_order);

alter table public.competition_qualification_batches enable row level security;
alter table public.competition_qualification_entries enable row level security;
alter table public.competition_phase_entries enable row level security;
