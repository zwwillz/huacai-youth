create table if not exists public.competition_event_tables (
  id text primary key,
  event_id text not null references public.events(id) on delete cascade,
  position_no integer not null,
  display_name text not null,
  is_tv boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at text not null,
  updated_at text not null,
  unique(event_id, position_no)
);

create index if not exists competition_event_tables_event_idx
  on public.competition_event_tables(event_id, sort_order, position_no);

create table if not exists public.competition_time_slots (
  id text primary key,
  event_id text not null references public.events(id) on delete cascade,
  group_id text not null references public.event_groups(id) on delete cascade,
  phase_code text not null,
  match_date text not null,
  start_time text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at text not null,
  updated_at text not null,
  unique(event_id, group_id, phase_code, match_date, start_time)
);

create index if not exists competition_time_slots_scope_idx
  on public.competition_time_slots(event_id, group_id, phase_code, sort_order, match_date, start_time);

create table if not exists public.competition_schedules (
  id text primary key,
  bracket_id text not null unique references public.competition_brackets(id) on delete cascade,
  event_id text not null references public.events(id) on delete cascade,
  group_id text not null references public.event_groups(id) on delete cascade,
  phase_code text not null,
  status text not null default 'draft',
  min_rest_slots integer not null default 0,
  referee_mode text not null default 'manual',
  generated_by text references public.users(id),
  generated_at text not null,
  updated_at text not null
);

create index if not exists competition_schedules_scope_idx
  on public.competition_schedules(event_id, group_id, phase_code, status);

create table if not exists public.competition_match_schedules (
  id text primary key,
  schedule_id text not null references public.competition_schedules(id) on delete cascade,
  bracket_match_id text not null unique references public.competition_bracket_matches(id) on delete cascade,
  time_slot_id text references public.competition_time_slots(id) on delete set null,
  table_id text references public.competition_event_tables(id) on delete set null,
  referee_user_id text references public.users(id) on delete set null,
  assignment_status text not null default 'draft',
  is_manual boolean not null default false,
  note text,
  created_at text not null,
  updated_at text not null
);

create index if not exists competition_match_schedules_schedule_idx
  on public.competition_match_schedules(schedule_id, time_slot_id, table_id);
create index if not exists competition_match_schedules_referee_idx
  on public.competition_match_schedules(schedule_id, referee_user_id, time_slot_id);

alter table public.competition_event_tables enable row level security;
alter table public.competition_time_slots enable row level security;
alter table public.competition_schedules enable row level security;
alter table public.competition_match_schedules enable row level security;
