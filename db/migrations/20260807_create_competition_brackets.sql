create table if not exists public.competition_brackets (
  id text primary key,
  draw_session_id text not null unique references public.draw_sessions(id) on delete cascade,
  event_id text not null references public.events(id) on delete cascade,
  group_id text not null references public.event_groups(id) on delete cascade,
  phase_code text not null,
  status text not null default 'draft',
  division_count integer not null,
  division_size integer not null,
  playoff_match_count integer not null default 0,
  playable_match_count integer not null default 0,
  total_node_count integer not null default 0,
  generated_by text references public.users(id),
  generated_at text not null,
  updated_at text not null
);

create index if not exists competition_brackets_event_group_phase_idx
  on public.competition_brackets(event_id, group_id, phase_code);

create table if not exists public.competition_bracket_matches (
  id text primary key,
  bracket_id text not null references public.competition_brackets(id) on delete cascade,
  draw_session_id text not null references public.draw_sessions(id) on delete cascade,
  event_id text not null references public.events(id) on delete cascade,
  group_id text not null references public.event_groups(id) on delete cascade,
  phase_code text not null,
  match_type text not null,
  division_no integer,
  round_no integer not null,
  round_name text not null,
  match_no integer not null,
  match_code text not null,
  player_a_id text references public.players(id),
  player_a_name text,
  player_b_id text references public.players(id),
  player_b_name text,
  source_a_type text not null,
  source_a_ref text,
  source_b_type text not null,
  source_b_ref text,
  status text not null default 'pending',
  winner_player_id text references public.players(id),
  winner_player_name text,
  result_type text,
  sort_order integer not null default 0,
  created_at text not null,
  updated_at text not null,
  unique(bracket_id, match_code)
);

create index if not exists competition_bracket_matches_division_idx
  on public.competition_bracket_matches(bracket_id, division_no, round_no, match_no);
create index if not exists competition_bracket_matches_session_idx
  on public.competition_bracket_matches(draw_session_id, sort_order);

create table if not exists public.competition_match_links (
  id text primary key,
  bracket_id text not null references public.competition_brackets(id) on delete cascade,
  source_match_id text not null references public.competition_bracket_matches(id) on delete cascade,
  source_result text not null default 'winner',
  target_match_id text not null references public.competition_bracket_matches(id) on delete cascade,
  target_side text not null,
  created_at text not null,
  unique(bracket_id, source_match_id, source_result)
);

create index if not exists competition_match_links_target_idx
  on public.competition_match_links(bracket_id, target_match_id, target_side);

alter table public.competition_brackets enable row level security;
alter table public.competition_bracket_matches enable row level security;
alter table public.competition_match_links enable row level security;