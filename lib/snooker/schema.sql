-- World Snooker Data Center - independent Supabase foundation schema
-- POC note: this file is NOT applied to the Huacai database.

create extension if not exists pgcrypto;

create table if not exists snooker_players (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_en text not null,
  name_zh text not null,
  short_name_zh text,
  nationality_zh text,
  country_code text,
  date_of_birth date,
  turned_pro smallint,
  current_rank integer,
  ranking_points bigint,
  avatar_url text,
  avatar_source text,
  avatar_credit text,
  avatar_license text,
  profile_source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists snooker_players_rank_idx on snooker_players(current_rank);
create index if not exists snooker_players_country_idx on snooker_players(country_code);

create table if not exists snooker_events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  season text not null,
  name_en text not null,
  name_zh text not null,
  sponsor_name text,
  type_zh text,
  status text not null check (status in ('upcoming','live','completed')),
  start_date date,
  end_date date,
  country_zh text,
  city_zh text,
  venue_zh text,
  venue_en text,
  winner_prize integer,
  runner_up_prize integer,
  currency text default 'GBP',
  source_name text,
  source_event_id text,
  source_url text,
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists snooker_events_season_idx on snooker_events(season, start_date desc);
create index if not exists snooker_events_status_idx on snooker_events(status, start_date);

create table if not exists snooker_rounds (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references snooker_events(id) on delete cascade,
  round_key text not null,
  label_en text,
  label_zh text not null,
  sort_order integer not null,
  best_of integer,
  loser_prize integer,
  unique(event_id, round_key)
);

create index if not exists snooker_rounds_event_idx on snooker_rounds(event_id, sort_order);

create table if not exists snooker_matches (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references snooker_events(id) on delete cascade,
  round_id uuid references snooker_rounds(id) on delete set null,
  source_match_id text,
  match_no integer,
  player1_id uuid references snooker_players(id),
  player2_id uuid references snooker_players(id),
  score1 integer,
  score2 integer,
  best_of integer,
  status text not null check (status in ('upcoming','live','session-break','completed','walkover')),
  scheduled_at timestamptz,
  session_label_zh text,
  winner_id uuid references snooker_players(id),
  note text,
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id, source_match_id)
);

create index if not exists snooker_matches_event_round_idx on snooker_matches(event_id, round_id, match_no);
create index if not exists snooker_matches_status_idx on snooker_matches(status, scheduled_at);
create index if not exists snooker_matches_player1_idx on snooker_matches(player1_id);
create index if not exists snooker_matches_player2_idx on snooker_matches(player2_id);

create table if not exists snooker_frames (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references snooker_matches(id) on delete cascade,
  frame_no integer not null,
  score1 integer not null default 0,
  score2 integer not null default 0,
  note text,
  unique(match_id, frame_no)
);

create index if not exists snooker_frames_match_idx on snooker_frames(match_id, frame_no);

create table if not exists snooker_ranking_snapshots (
  id uuid primary key default gen_random_uuid(),
  season text not null,
  captured_at timestamptz not null,
  player_id uuid not null references snooker_players(id) on delete cascade,
  rank integer not null,
  points bigint not null,
  source_name text,
  unique(captured_at, player_id)
);

create index if not exists snooker_rankings_latest_idx on snooker_ranking_snapshots(captured_at desc, rank);

create table if not exists snooker_source_entity_map (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('player','event','match')),
  entity_id uuid not null,
  source_name text not null,
  source_id text not null,
  source_url text,
  created_at timestamptz not null default now(),
  unique(entity_type, source_name, source_id)
);

create index if not exists snooker_source_entity_map_entity_idx on snooker_source_entity_map(entity_type, entity_id);

create table if not exists snooker_sync_runs (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  job_type text not null,
  status text not null check (status in ('running','success','partial','failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  event_id uuid references snooker_events(id) on delete set null,
  fetched_count integer default 0,
  changed_count integer default 0,
  error_message text,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists snooker_sync_runs_started_idx on snooker_sync_runs(started_at desc);

-- Public data is read-only in the final product. RLS policies will be added when
-- the dedicated Supabase project is created; service-role sync writes stay server-side.
