create table if not exists public.competition_seed_entries (
  id text primary key,
  event_id text not null references public.events(id) on delete cascade,
  group_id text not null references public.event_groups(id) on delete cascade,
  player_id text not null references public.players(id) on delete cascade,
  player_name text not null,
  seed_no integer not null,
  attendance_status text not null default 'confirmed',
  status text not null default 'active',
  created_at text not null,
  updated_at text not null,
  unique(event_id,group_id,seed_no),
  unique(event_id,group_id,player_id)
);
create index if not exists competition_seed_entries_event_group_idx on public.competition_seed_entries(event_id,group_id,status,seed_no);
alter table public.competition_seed_entries enable row level security;
