-- Applied to dedicated snooker-data-center Supabase project.
-- Realtime data is state-aware rather than globally polled at one frequency.

alter table public.snooker_matches
  add column if not exists realtime_finalized_at timestamptz,
  add column if not exists frames_complete boolean not null default false;

create index if not exists snooker_matches_realtime_queue_idx
  on public.snooker_matches(status, scheduled_at)
  where realtime_finalized_at is null;

create table if not exists public.snooker_sync_policies (
  job_key text primary key,
  enabled boolean not null default true,
  interval_seconds integer not null check (interval_seconds >= 30),
  prestart_interval_seconds integer,
  prestart_window_minutes integer,
  write_only_on_change boolean not null default true,
  skip_finalized_matches boolean not null default true,
  notes text,
  updated_at timestamptz not null default now()
);

insert into public.snooker_sync_policies
(job_key,enabled,interval_seconds,prestart_interval_seconds,prestart_window_minutes,write_only_on_change,skip_finalized_matches,notes)
values
('live_match_status',true,30,null,null,true,true,'Live WST to database: about 30 seconds. Freeze after final confirmation.'),
('upcoming_schedule',true,1800,300,120,true,true,'Upcoming matches: 30 minutes normally; 5 minutes inside the two-hour pre-start window.'),
('rankings',true,86400,null,null,true,true,'Check daily; write only when ranking data changes.'),
('calendar',true,21600,null,null,true,true,'Check every 6 hours; write only on change.'),
('player_profiles',true,604800,null,null,true,true,'Check weekly; curated Chinese names are not overwritten.'),
('site_monitor',true,120,null,null,true,true,'Only while monitor page is open/visible; manual refresh remains available.')
on conflict (job_key) do update set
  enabled=excluded.enabled,
  interval_seconds=excluded.interval_seconds,
  prestart_interval_seconds=excluded.prestart_interval_seconds,
  prestart_window_minutes=excluded.prestart_window_minutes,
  write_only_on_change=excluded.write_only_on_change,
  skip_finalized_matches=excluded.skip_finalized_matches,
  notes=excluded.notes,
  updated_at=now();

alter table public.snooker_sync_policies enable row level security;
drop policy if exists deny_client_access_sync_policies on public.snooker_sync_policies;
create policy deny_client_access_sync_policies on public.snooker_sync_policies
  for all to anon, authenticated using (false) with check (false);

-- Runtime sync functions in Supabase additionally enforce:
-- 1. realtime_finalized_at != null => skip WST Match Centre request;
-- 2. first terminal GraphQL response stores final frames and sets frames_complete=true;
-- 3. completed historical matches are excluded from the automatic realtime queue;
-- 4. service_role only execution for WST sync functions.
