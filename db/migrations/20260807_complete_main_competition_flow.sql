alter table public.competition_seed_entries
  add column if not exists source_event_id text,
  add column if not exists source_display_order integer,
  add column if not exists source_placement_label text,
  add column if not exists source_type text not null default 'manual',
  add column if not exists eligibility_status text not null default 'unchecked',
  add column if not exists eligibility_note text,
  add column if not exists attendance_note text,
  add column if not exists replacement_player_id text,
  add column if not exists replacement_player_name text,
  add column if not exists replacement_source_type text,
  add column if not exists replacement_source_ref text,
  add column if not exists replacement_metric_value integer,
  add column if not exists replacement_inherits_seed boolean not null default true,
  add column if not exists confirmed_by text,
  add column if not exists confirmed_at text;

create index if not exists competition_seed_entries_event_group_seed_idx
  on public.competition_seed_entries(event_id, group_id, seed_no);

create table if not exists public.competition_main_roster_locks (
  id text primary key,
  event_id text not null,
  group_id text not null,
  version_no integer not null,
  status text not null default 'locked',
  qualifier_count integer not null default 0,
  seed_slot_count integer not null default 0,
  replacement_count integer not null default 0,
  duplicate_count integer not null default 0,
  eligibility_issue_count integer not null default 0,
  roster_json jsonb not null default '[]'::jsonb,
  locked_by text,
  locked_at text not null,
  voided_by text,
  voided_at text,
  void_reason text,
  created_at text not null,
  updated_at text not null,
  unique(event_id, group_id, version_no)
);
create index if not exists competition_main_roster_locks_event_group_idx
  on public.competition_main_roster_locks(event_id, group_id, status, version_no desc);

create table if not exists public.competition_main_advancement_batches (
  id text primary key,
  event_id text not null,
  group_id text not null,
  source_draw_session_id text not null,
  status text not null default 'draft',
  winner_side_count integer not null default 0,
  loser_side_count integer not null default 0,
  roster_json jsonb not null default '[]'::jsonb,
  confirmed_by text,
  confirmed_at text,
  created_at text not null,
  updated_at text not null,
  unique(source_draw_session_id)
);
create index if not exists competition_main_advancement_event_group_idx
  on public.competition_main_advancement_batches(event_id, group_id, status);

create table if not exists public.competition_final_ranking_batches (
  id text primary key,
  event_id text not null,
  group_id text not null,
  source_draw_session_id text not null,
  status text not null default 'draft',
  ranking_json jsonb not null default '[]'::jsonb,
  confirmed_by text,
  confirmed_at text,
  published_by text,
  published_at text,
  created_at text not null,
  updated_at text not null,
  unique(source_draw_session_id)
);
create index if not exists competition_final_ranking_event_group_idx
  on public.competition_final_ranking_batches(event_id, group_id, status);

update public.competition_seed_entries
set eligibility_status='eligible'
where eligibility_status='unchecked' and attendance_status='confirmed';

insert into public.competition_main_roster_locks
  (id,event_id,group_id,version_no,status,qualifier_count,seed_slot_count,replacement_count,duplicate_count,eligibility_issue_count,roster_json,locked_by,locked_at,created_at,updated_at)
select
  'mlock_' || substr(md5(pe.event_id || '|' || pe.group_id || '|backfill'),1,24),
  pe.event_id,
  pe.group_id,
  1,
  'locked',
  count(*) filter (where pe.source_type like 'qualifier_%')::int,
  count(*) filter (where pe.source_type='seed')::int,
  0,
  0,
  0,
  jsonb_agg(jsonb_build_object(
    'playerId',pe.player_id,
    'playerName',pe.player_name,
    'sourceType',pe.source_type,
    'sourceRef',pe.source_ref,
    'sortOrder',pe.sort_order
  ) order by pe.sort_order),
  max(ds.confirmed_by),
  coalesce(max(ds.confirmed_at),now()::text),
  now()::text,
  now()::text
from public.competition_phase_entries pe
join public.draw_sessions ds
  on ds.event_id=pe.event_id and ds.group_id=pe.group_id and ds.phase_code='main-one' and ds.status='confirmed'
where pe.phase_code='main-one' and pe.status='active'
group by pe.event_id,pe.group_id
having count(*)=64
on conflict (id) do nothing;
