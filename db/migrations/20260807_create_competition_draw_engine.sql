create table if not exists public.competition_phase_settings (
  id text primary key,
  event_id text not null references public.events(id) on delete cascade,
  group_id text not null references public.event_groups(id) on delete cascade,
  phase_code text not null,
  bracket_size integer not null default 512 check (bracket_size > 1),
  division_size integer not null default 32 check (division_size > 1),
  rate_qualifier_count integer not null default 8 check (rate_qualifier_count >= 0),
  seeds_enabled boolean not null default false,
  seed_target_count integer not null default 0 check (seed_target_count >= 0),
  seed_fill_rule text not null default 'game_win_rate',
  allow_playoff boolean not null default true,
  allow_bye boolean not null default true,
  created_at text not null,
  updated_at text not null,
  unique(event_id, group_id, phase_code)
);

create index if not exists competition_phase_settings_event_group_idx
  on public.competition_phase_settings(event_id, group_id, phase_code);

create table if not exists public.draw_sessions (
  id text primary key,
  event_id text not null references public.events(id) on delete cascade,
  group_id text not null references public.event_groups(id) on delete cascade,
  phase_code text not null,
  version_no integer not null,
  status text not null default 'draft',
  entrant_count integer not null,
  bracket_size integer not null,
  division_size integer not null,
  division_count integer not null,
  direct_qualifier_count integer not null,
  rate_qualifier_count integer not null default 0,
  total_qualifier_count integer not null,
  playoff_match_count integer not null default 0,
  playoff_player_count integer not null default 0,
  bye_count integer not null default 0,
  seeds_enabled boolean not null default false,
  seed_target_count integer not null default 0,
  seed_fill_rule text not null default 'game_win_rate',
  random_seed text not null,
  random_commitment text not null,
  rules_json jsonb not null default '{}'::jsonb,
  created_by text references public.users(id),
  confirmed_by text references public.users(id),
  created_at text not null,
  confirmed_at text,
  voided_at text,
  void_reason text,
  unique(event_id, group_id, phase_code, version_no)
);

create index if not exists draw_sessions_event_group_phase_idx
  on public.draw_sessions(event_id, group_id, phase_code, version_no desc);
create index if not exists draw_sessions_status_idx
  on public.draw_sessions(event_id, status);

create table if not exists public.draw_participants (
  id text primary key,
  session_id text not null references public.draw_sessions(id) on delete cascade,
  player_id text references public.players(id),
  player_name text not null,
  source_type text not null default 'registration',
  seed_no integer,
  random_order integer not null,
  assignment_type text not null,
  display_draw_no text not null,
  created_at text not null,
  unique(session_id, player_id)
);

create index if not exists draw_participants_session_order_idx
  on public.draw_participants(session_id, random_order);

create table if not exists public.draw_prelim_matches (
  id text primary key,
  session_id text not null references public.draw_sessions(id) on delete cascade,
  match_no integer not null,
  player_a_id text references public.players(id),
  player_a_name text not null,
  player_b_id text references public.players(id),
  player_b_name text not null,
  target_slot_no integer not null,
  status text not null default 'pending',
  winner_player_id text references public.players(id),
  winner_player_name text,
  created_at text not null,
  updated_at text not null,
  unique(session_id, match_no),
  unique(session_id, target_slot_no)
);

create index if not exists draw_prelim_matches_session_idx
  on public.draw_prelim_matches(session_id, match_no);

create table if not exists public.draw_slots (
  id text primary key,
  session_id text not null references public.draw_sessions(id) on delete cascade,
  slot_no integer not null,
  division_no integer not null,
  division_slot_no integer not null,
  slot_type text not null,
  player_id text references public.players(id),
  player_name text,
  prelim_match_id text references public.draw_prelim_matches(id),
  created_at text not null,
  unique(session_id, slot_no)
);

create index if not exists draw_slots_session_division_idx
  on public.draw_slots(session_id, division_no, division_slot_no);

alter table public.competition_phase_settings enable row level security;
alter table public.draw_sessions enable row level security;
alter table public.draw_participants enable row level security;
alter table public.draw_prelim_matches enable row level security;
alter table public.draw_slots enable row level security;