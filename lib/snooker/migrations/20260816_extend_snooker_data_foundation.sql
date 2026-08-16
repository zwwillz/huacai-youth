-- Applied to Supabase project: snooker-data-center
-- Project ref: rtlvncsmbueatdzqvhbn

create table if not exists public.snooker_player_names (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.snooker_players(id) on delete cascade,
  locale text not null,
  display_name text not null,
  short_name text,
  aliases text[] not null default '{}',
  source_name text,
  status text not null default 'verified' check (status in ('verified','source_mapped','auto_transliterated','pending_review')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(player_id, locale)
);

create index if not exists snooker_player_names_locale_idx on public.snooker_player_names(locale, display_name);
create index if not exists snooker_player_names_aliases_idx on public.snooker_player_names using gin(aliases);

alter table public.snooker_frames
  add column if not exists break1 integer,
  add column if not exists break2 integer,
  add column if not exists status text not null default 'completed' check (status in ('upcoming','live','completed')),
  add column if not exists source_updated_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.snooker_matches
  add column if not exists source_status text,
  add column if not exists source_status_meta text,
  add column if not exists current_break integer,
  add column if not exists live_frame_no integer;

alter table public.snooker_events
  add column if not exists referee_zh text,
  add column if not exists ranking_event boolean,
  add column if not exists data_ready boolean not null default false;

create table if not exists public.snooker_breaks (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.snooker_matches(id) on delete cascade,
  frame_id uuid references public.snooker_frames(id) on delete cascade,
  player_id uuid not null references public.snooker_players(id) on delete cascade,
  frame_no integer not null,
  break_value integer not null check (break_value > 0 and break_value <= 155),
  is_century boolean generated always as (break_value >= 100) stored,
  is_maximum boolean generated always as (break_value = 147) stored,
  source_name text,
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(match_id, frame_no, player_id, break_value)
);

create index if not exists snooker_breaks_match_frame_idx on public.snooker_breaks(match_id, frame_no);
create index if not exists snooker_breaks_frame_id_idx on public.snooker_breaks(frame_id) where frame_id is not null;
create index if not exists snooker_breaks_player_value_idx on public.snooker_breaks(player_id, break_value desc);
create index if not exists snooker_breaks_century_idx on public.snooker_breaks(player_id, created_at desc) where break_value >= 100;

create table if not exists public.snooker_manual_overrides (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('player','event','match','frame','ranking')),
  entity_id uuid not null,
  field_name text not null,
  override_value jsonb not null,
  reason text,
  is_active boolean not null default true,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(entity_type, entity_id, field_name)
);

create index if not exists snooker_manual_overrides_entity_idx on public.snooker_manual_overrides(entity_type, entity_id) where is_active;

alter table public.snooker_source_entity_map
  add column if not exists confidence numeric(5,4),
  add column if not exists mapping_status text not null default 'verified' check (mapping_status in ('verified','probable','pending_review','rejected')),
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.snooker_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table public.snooker_player_names enable row level security;
alter table public.snooker_breaks enable row level security;
alter table public.snooker_manual_overrides enable row level security;

drop policy if exists public_read_snooker_player_names on public.snooker_player_names;
create policy public_read_snooker_player_names on public.snooker_player_names for select to anon, authenticated using (true);

drop policy if exists public_read_snooker_breaks on public.snooker_breaks;
create policy public_read_snooker_breaks on public.snooker_breaks for select to anon, authenticated using (true);

drop policy if exists deny_client_access_manual_overrides on public.snooker_manual_overrides;
create policy deny_client_access_manual_overrides on public.snooker_manual_overrides for all to anon, authenticated using (false) with check (false);
