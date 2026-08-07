-- Captures the complete Jinan competition simulation as a private regression fixture.
-- Safe to rerun: each table snapshot is replaced atomically.

begin;

with captured as (
  select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) as payload
  from public.events t
  where id='event_391ce7a20bd7420fba77caeea42c0885'
)
insert into private.test_dataset_snapshots
  (dataset_id, table_name, row_count, payload, checksum, captured_at, note)
select 'jinan_full_flow_20260807', 'events', jsonb_array_length(payload), payload,
       md5(payload::text), now(), 'Jinan full competition regression fixture captured before production cleanup'
from captured
on conflict (dataset_id, table_name) do update set
  row_count=excluded.row_count,
  payload=excluded.payload,
  checksum=excluded.checksum,
  captured_at=excluded.captured_at,
  note=excluded.note;

with captured as (
  select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) as payload
  from public.players t
  where id like 'sim_jinan_%'
)
insert into private.test_dataset_snapshots
  (dataset_id, table_name, row_count, payload, checksum, captured_at, note)
select 'jinan_full_flow_20260807', 'players', jsonb_array_length(payload), payload,
       md5(payload::text), now(), 'Jinan full competition regression fixture captured before production cleanup'
from captured
on conflict (dataset_id, table_name) do update set
  row_count=excluded.row_count,
  payload=excluded.payload,
  checksum=excluded.checksum,
  captured_at=excluded.captured_at,
  note=excluded.note;

with captured as (
  select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) as payload
  from public.guardians t
  where player_id like 'sim_jinan_%'
)
insert into private.test_dataset_snapshots
  (dataset_id, table_name, row_count, payload, checksum, captured_at, note)
select 'jinan_full_flow_20260807', 'guardians', jsonb_array_length(payload), payload,
       md5(payload::text), now(), 'Jinan full competition regression fixture captured before production cleanup'
from captured
on conflict (dataset_id, table_name) do update set
  row_count=excluded.row_count,
  payload=excluded.payload,
  checksum=excluded.checksum,
  captured_at=excluded.captured_at,
  note=excluded.note;

with captured as (
  select coalesce(jsonb_agg(to_jsonb(t) order by t.event_id), '[]'::jsonb) as payload
  from public.event_details t
  where event_id='event_391ce7a20bd7420fba77caeea42c0885'
)
insert into private.test_dataset_snapshots
  (dataset_id, table_name, row_count, payload, checksum, captured_at, note)
select 'jinan_full_flow_20260807', 'event_details', jsonb_array_length(payload), payload,
       md5(payload::text), now(), 'Jinan full competition regression fixture captured before production cleanup'
from captured
on conflict (dataset_id, table_name) do update set
  row_count=excluded.row_count,
  payload=excluded.payload,
  checksum=excluded.checksum,
  captured_at=excluded.captured_at,
  note=excluded.note;

with captured as (
  select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) as payload
  from public.event_groups t
  where event_id='event_391ce7a20bd7420fba77caeea42c0885'
)
insert into private.test_dataset_snapshots
  (dataset_id, table_name, row_count, payload, checksum, captured_at, note)
select 'jinan_full_flow_20260807', 'event_groups', jsonb_array_length(payload), payload,
       md5(payload::text), now(), 'Jinan full competition regression fixture captured before production cleanup'
from captured
on conflict (dataset_id, table_name) do update set
  row_count=excluded.row_count,
  payload=excluded.payload,
  checksum=excluded.checksum,
  captured_at=excluded.captured_at,
  note=excluded.note;

with captured as (
  select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) as payload
  from public.event_organizations t
  where event_id='event_391ce7a20bd7420fba77caeea42c0885'
)
insert into private.test_dataset_snapshots
  (dataset_id, table_name, row_count, payload, checksum, captured_at, note)
select 'jinan_full_flow_20260807', 'event_organizations', jsonb_array_length(payload), payload,
       md5(payload::text), now(), 'Jinan full competition regression fixture captured before production cleanup'
from captured
on conflict (dataset_id, table_name) do update set
  row_count=excluded.row_count,
  payload=excluded.payload,
  checksum=excluded.checksum,
  captured_at=excluded.captured_at,
  note=excluded.note;

with captured as (
  select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) as payload
  from public.event_sponsors t
  where event_id='event_391ce7a20bd7420fba77caeea42c0885'
)
insert into private.test_dataset_snapshots
  (dataset_id, table_name, row_count, payload, checksum, captured_at, note)
select 'jinan_full_flow_20260807', 'event_sponsors', jsonb_array_length(payload), payload,
       md5(payload::text), now(), 'Jinan full competition regression fixture captured before production cleanup'
from captured
on conflict (dataset_id, table_name) do update set
  row_count=excluded.row_count,
  payload=excluded.payload,
  checksum=excluded.checksum,
  captured_at=excluded.captured_at,
  note=excluded.note;

with captured as (
  select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) as payload
  from public.event_phases t
  where event_id='event_391ce7a20bd7420fba77caeea42c0885'
)
insert into private.test_dataset_snapshots
  (dataset_id, table_name, row_count, payload, checksum, captured_at, note)
select 'jinan_full_flow_20260807', 'event_phases', jsonb_array_length(payload), payload,
       md5(payload::text), now(), 'Jinan full competition regression fixture captured before production cleanup'
from captured
on conflict (dataset_id, table_name) do update set
  row_count=excluded.row_count,
  payload=excluded.payload,
  checksum=excluded.checksum,
  captured_at=excluded.captured_at,
  note=excluded.note;

with captured as (
  select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) as payload
  from public.event_assets t
  where event_id='event_391ce7a20bd7420fba77caeea42c0885'
)
insert into private.test_dataset_snapshots
  (dataset_id, table_name, row_count, payload, checksum, captured_at, note)
select 'jinan_full_flow_20260807', 'event_assets', jsonb_array_length(payload), payload,
       md5(payload::text), now(), 'Jinan full competition regression fixture captured before production cleanup'
from captured
on conflict (dataset_id, table_name) do update set
  row_count=excluded.row_count,
  payload=excluded.payload,
  checksum=excluded.checksum,
  captured_at=excluded.captured_at,
  note=excluded.note;

with captured as (
  select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) as payload
  from public.event_documents t
  where event_id='event_391ce7a20bd7420fba77caeea42c0885'
)
insert into private.test_dataset_snapshots
  (dataset_id, table_name, row_count, payload, checksum, captured_at, note)
select 'jinan_full_flow_20260807', 'event_documents', jsonb_array_length(payload), payload,
       md5(payload::text), now(), 'Jinan full competition regression fixture captured before production cleanup'
from captured
on conflict (dataset_id, table_name) do update set
  row_count=excluded.row_count,
  payload=excluded.payload,
  checksum=excluded.checksum,
  captured_at=excluded.captured_at,
  note=excluded.note;

with captured as (
  select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) as payload
  from public.event_guides t
  where event_id='event_391ce7a20bd7420fba77caeea42c0885'
)
insert into private.test_dataset_snapshots
  (dataset_id, table_name, row_count, payload, checksum, captured_at, note)
select 'jinan_full_flow_20260807', 'event_guides', jsonb_array_length(payload), payload,
       md5(payload::text), now(), 'Jinan full competition regression fixture captured before production cleanup'
from captured
on conflict (dataset_id, table_name) do update set
  row_count=excluded.row_count,
  payload=excluded.payload,
  checksum=excluded.checksum,
  captured_at=excluded.captured_at,
  note=excluded.note;

with captured as (
  select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) as payload
  from public.event_members t
  where event_id='event_391ce7a20bd7420fba77caeea42c0885'
)
insert into private.test_dataset_snapshots
  (dataset_id, table_name, row_count, payload, checksum, captured_at, note)
select 'jinan_full_flow_20260807', 'event_members', jsonb_array_length(payload), payload,
       md5(payload::text), now(), 'Jinan full competition regression fixture captured before production cleanup'
from captured
on conflict (dataset_id, table_name) do update set
  row_count=excluded.row_count,
  payload=excluded.payload,
  checksum=excluded.checksum,
  captured_at=excluded.captured_at,
  note=excluded.note;

with captured as (
  select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) as payload
  from public.event_rankings t
  where event_id='event_391ce7a20bd7420fba77caeea42c0885'
)
insert into private.test_dataset_snapshots
  (dataset_id, table_name, row_count, payload, checksum, captured_at, note)
select 'jinan_full_flow_20260807', 'event_rankings', jsonb_array_length(payload), payload,
       md5(payload::text), now(), 'Jinan full competition regression fixture captured before production cleanup'
from captured
on conflict (dataset_id, table_name) do update set
  row_count=excluded.row_count,
  payload=excluded.payload,
  checksum=excluded.checksum,
  captured_at=excluded.captured_at,
  note=excluded.note;

with captured as (
  select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) as payload
  from public.publications t
  where event_id='event_391ce7a20bd7420fba77caeea42c0885'
)
insert into private.test_dataset_snapshots
  (dataset_id, table_name, row_count, payload, checksum, captured_at, note)
select 'jinan_full_flow_20260807', 'publications', jsonb_array_length(payload), payload,
       md5(payload::text), now(), 'Jinan full competition regression fixture captured before production cleanup'
from captured
on conflict (dataset_id, table_name) do update set
  row_count=excluded.row_count,
  payload=excluded.payload,
  checksum=excluded.checksum,
  captured_at=excluded.captured_at,
  note=excluded.note;

with captured as (
  select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) as payload
  from public.registrations t
  where event_id='event_391ce7a20bd7420fba77caeea42c0885'
)
insert into private.test_dataset_snapshots
  (dataset_id, table_name, row_count, payload, checksum, captured_at, note)
select 'jinan_full_flow_20260807', 'registrations', jsonb_array_length(payload), payload,
       md5(payload::text), now(), 'Jinan full competition regression fixture captured before production cleanup'
from captured
on conflict (dataset_id, table_name) do update set
  row_count=excluded.row_count,
  payload=excluded.payload,
  checksum=excluded.checksum,
  captured_at=excluded.captured_at,
  note=excluded.note;

with captured as (
  select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) as payload
  from public.matches t
  where event_id='event_391ce7a20bd7420fba77caeea42c0885'
)
insert into private.test_dataset_snapshots
  (dataset_id, table_name, row_count, payload, checksum, captured_at, note)
select 'jinan_full_flow_20260807', 'matches', jsonb_array_length(payload), payload,
       md5(payload::text), now(), 'Jinan full competition regression fixture captured before production cleanup'
from captured
on conflict (dataset_id, table_name) do update set
  row_count=excluded.row_count,
  payload=excluded.payload,
  checksum=excluded.checksum,
  captured_at=excluded.captured_at,
  note=excluded.note;

with captured as (
  select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) as payload
  from public.competition_phase_settings t
  where event_id='event_391ce7a20bd7420fba77caeea42c0885'
)
insert into private.test_dataset_snapshots
  (dataset_id, table_name, row_count, payload, checksum, captured_at, note)
select 'jinan_full_flow_20260807', 'competition_phase_settings', jsonb_array_length(payload), payload,
       md5(payload::text), now(), 'Jinan full competition regression fixture captured before production cleanup'
from captured
on conflict (dataset_id, table_name) do update set
  row_count=excluded.row_count,
  payload=excluded.payload,
  checksum=excluded.checksum,
  captured_at=excluded.captured_at,
  note=excluded.note;

with captured as (
  select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) as payload
  from public.draw_sessions t
  where event_id='event_391ce7a20bd7420fba77caeea42c0885'
)
insert into private.test_dataset_snapshots
  (dataset_id, table_name, row_count, payload, checksum, captured_at, note)
select 'jinan_full_flow_20260807', 'draw_sessions', jsonb_array_length(payload), payload,
       md5(payload::text), now(), 'Jinan full competition regression fixture captured before production cleanup'
from captured
on conflict (dataset_id, table_name) do update set
  row_count=excluded.row_count,
  payload=excluded.payload,
  checksum=excluded.checksum,
  captured_at=excluded.captured_at,
  note=excluded.note;

with captured as (
  select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) as payload
  from public.draw_participants t
  where session_id in (select id from public.draw_sessions where event_id='event_391ce7a20bd7420fba77caeea42c0885')
)
insert into private.test_dataset_snapshots
  (dataset_id, table_name, row_count, payload, checksum, captured_at, note)
select 'jinan_full_flow_20260807', 'draw_participants', jsonb_array_length(payload), payload,
       md5(payload::text), now(), 'Jinan full competition regression fixture captured before production cleanup'
from captured
on conflict (dataset_id, table_name) do update set
  row_count=excluded.row_count,
  payload=excluded.payload,
  checksum=excluded.checksum,
  captured_at=excluded.captured_at,
  note=excluded.note;

with captured as (
  select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) as payload
  from public.draw_prelim_matches t
  where session_id in (select id from public.draw_sessions where event_id='event_391ce7a20bd7420fba77caeea42c0885')
)
insert into private.test_dataset_snapshots
  (dataset_id, table_name, row_count, payload, checksum, captured_at, note)
select 'jinan_full_flow_20260807', 'draw_prelim_matches', jsonb_array_length(payload), payload,
       md5(payload::text), now(), 'Jinan full competition regression fixture captured before production cleanup'
from captured
on conflict (dataset_id, table_name) do update set
  row_count=excluded.row_count,
  payload=excluded.payload,
  checksum=excluded.checksum,
  captured_at=excluded.captured_at,
  note=excluded.note;

with captured as (
  select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) as payload
  from public.draw_slots t
  where session_id in (select id from public.draw_sessions where event_id='event_391ce7a20bd7420fba77caeea42c0885')
)
insert into private.test_dataset_snapshots
  (dataset_id, table_name, row_count, payload, checksum, captured_at, note)
select 'jinan_full_flow_20260807', 'draw_slots', jsonb_array_length(payload), payload,
       md5(payload::text), now(), 'Jinan full competition regression fixture captured before production cleanup'
from captured
on conflict (dataset_id, table_name) do update set
  row_count=excluded.row_count,
  payload=excluded.payload,
  checksum=excluded.checksum,
  captured_at=excluded.captured_at,
  note=excluded.note;

with captured as (
  select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) as payload
  from public.competition_brackets t
  where event_id='event_391ce7a20bd7420fba77caeea42c0885'
)
insert into private.test_dataset_snapshots
  (dataset_id, table_name, row_count, payload, checksum, captured_at, note)
select 'jinan_full_flow_20260807', 'competition_brackets', jsonb_array_length(payload), payload,
       md5(payload::text), now(), 'Jinan full competition regression fixture captured before production cleanup'
from captured
on conflict (dataset_id, table_name) do update set
  row_count=excluded.row_count,
  payload=excluded.payload,
  checksum=excluded.checksum,
  captured_at=excluded.captured_at,
  note=excluded.note;

with captured as (
  select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) as payload
  from public.competition_bracket_matches t
  where event_id='event_391ce7a20bd7420fba77caeea42c0885'
)
insert into private.test_dataset_snapshots
  (dataset_id, table_name, row_count, payload, checksum, captured_at, note)
select 'jinan_full_flow_20260807', 'competition_bracket_matches', jsonb_array_length(payload), payload,
       md5(payload::text), now(), 'Jinan full competition regression fixture captured before production cleanup'
from captured
on conflict (dataset_id, table_name) do update set
  row_count=excluded.row_count,
  payload=excluded.payload,
  checksum=excluded.checksum,
  captured_at=excluded.captured_at,
  note=excluded.note;

with captured as (
  select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) as payload
  from public.competition_match_links t
  where bracket_id in (select id from public.competition_brackets where event_id='event_391ce7a20bd7420fba77caeea42c0885')
)
insert into private.test_dataset_snapshots
  (dataset_id, table_name, row_count, payload, checksum, captured_at, note)
select 'jinan_full_flow_20260807', 'competition_match_links', jsonb_array_length(payload), payload,
       md5(payload::text), now(), 'Jinan full competition regression fixture captured before production cleanup'
from captured
on conflict (dataset_id, table_name) do update set
  row_count=excluded.row_count,
  payload=excluded.payload,
  checksum=excluded.checksum,
  captured_at=excluded.captured_at,
  note=excluded.note;

with captured as (
  select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) as payload
  from public.competition_event_tables t
  where event_id='event_391ce7a20bd7420fba77caeea42c0885'
)
insert into private.test_dataset_snapshots
  (dataset_id, table_name, row_count, payload, checksum, captured_at, note)
select 'jinan_full_flow_20260807', 'competition_event_tables', jsonb_array_length(payload), payload,
       md5(payload::text), now(), 'Jinan full competition regression fixture captured before production cleanup'
from captured
on conflict (dataset_id, table_name) do update set
  row_count=excluded.row_count,
  payload=excluded.payload,
  checksum=excluded.checksum,
  captured_at=excluded.captured_at,
  note=excluded.note;

with captured as (
  select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) as payload
  from public.competition_time_slots t
  where event_id='event_391ce7a20bd7420fba77caeea42c0885'
)
insert into private.test_dataset_snapshots
  (dataset_id, table_name, row_count, payload, checksum, captured_at, note)
select 'jinan_full_flow_20260807', 'competition_time_slots', jsonb_array_length(payload), payload,
       md5(payload::text), now(), 'Jinan full competition regression fixture captured before production cleanup'
from captured
on conflict (dataset_id, table_name) do update set
  row_count=excluded.row_count,
  payload=excluded.payload,
  checksum=excluded.checksum,
  captured_at=excluded.captured_at,
  note=excluded.note;

with captured as (
  select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) as payload
  from public.competition_schedules t
  where event_id='event_391ce7a20bd7420fba77caeea42c0885'
)
insert into private.test_dataset_snapshots
  (dataset_id, table_name, row_count, payload, checksum, captured_at, note)
select 'jinan_full_flow_20260807', 'competition_schedules', jsonb_array_length(payload), payload,
       md5(payload::text), now(), 'Jinan full competition regression fixture captured before production cleanup'
from captured
on conflict (dataset_id, table_name) do update set
  row_count=excluded.row_count,
  payload=excluded.payload,
  checksum=excluded.checksum,
  captured_at=excluded.captured_at,
  note=excluded.note;

with captured as (
  select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) as payload
  from public.competition_match_schedules t
  where schedule_id in (select id from public.competition_schedules where event_id='event_391ce7a20bd7420fba77caeea42c0885')
)
insert into private.test_dataset_snapshots
  (dataset_id, table_name, row_count, payload, checksum, captured_at, note)
select 'jinan_full_flow_20260807', 'competition_match_schedules', jsonb_array_length(payload), payload,
       md5(payload::text), now(), 'Jinan full competition regression fixture captured before production cleanup'
from captured
on conflict (dataset_id, table_name) do update set
  row_count=excluded.row_count,
  payload=excluded.payload,
  checksum=excluded.checksum,
  captured_at=excluded.captured_at,
  note=excluded.note;

with captured as (
  select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) as payload
  from public.competition_qualification_batches t
  where event_id='event_391ce7a20bd7420fba77caeea42c0885'
)
insert into private.test_dataset_snapshots
  (dataset_id, table_name, row_count, payload, checksum, captured_at, note)
select 'jinan_full_flow_20260807', 'competition_qualification_batches', jsonb_array_length(payload), payload,
       md5(payload::text), now(), 'Jinan full competition regression fixture captured before production cleanup'
from captured
on conflict (dataset_id, table_name) do update set
  row_count=excluded.row_count,
  payload=excluded.payload,
  checksum=excluded.checksum,
  captured_at=excluded.captured_at,
  note=excluded.note;

with captured as (
  select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) as payload
  from public.competition_qualification_entries t
  where batch_id in (select id from public.competition_qualification_batches where event_id='event_391ce7a20bd7420fba77caeea42c0885')
)
insert into private.test_dataset_snapshots
  (dataset_id, table_name, row_count, payload, checksum, captured_at, note)
select 'jinan_full_flow_20260807', 'competition_qualification_entries', jsonb_array_length(payload), payload,
       md5(payload::text), now(), 'Jinan full competition regression fixture captured before production cleanup'
from captured
on conflict (dataset_id, table_name) do update set
  row_count=excluded.row_count,
  payload=excluded.payload,
  checksum=excluded.checksum,
  captured_at=excluded.captured_at,
  note=excluded.note;

with captured as (
  select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) as payload
  from public.competition_phase_entries t
  where event_id='event_391ce7a20bd7420fba77caeea42c0885'
)
insert into private.test_dataset_snapshots
  (dataset_id, table_name, row_count, payload, checksum, captured_at, note)
select 'jinan_full_flow_20260807', 'competition_phase_entries', jsonb_array_length(payload), payload,
       md5(payload::text), now(), 'Jinan full competition regression fixture captured before production cleanup'
from captured
on conflict (dataset_id, table_name) do update set
  row_count=excluded.row_count,
  payload=excluded.payload,
  checksum=excluded.checksum,
  captured_at=excluded.captured_at,
  note=excluded.note;

with captured as (
  select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) as payload
  from public.competition_seed_entries t
  where event_id='event_391ce7a20bd7420fba77caeea42c0885'
)
insert into private.test_dataset_snapshots
  (dataset_id, table_name, row_count, payload, checksum, captured_at, note)
select 'jinan_full_flow_20260807', 'competition_seed_entries', jsonb_array_length(payload), payload,
       md5(payload::text), now(), 'Jinan full competition regression fixture captured before production cleanup'
from captured
on conflict (dataset_id, table_name) do update set
  row_count=excluded.row_count,
  payload=excluded.payload,
  checksum=excluded.checksum,
  captured_at=excluded.captured_at,
  note=excluded.note;

with captured as (
  select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) as payload
  from public.competition_main_roster_locks t
  where event_id='event_391ce7a20bd7420fba77caeea42c0885'
)
insert into private.test_dataset_snapshots
  (dataset_id, table_name, row_count, payload, checksum, captured_at, note)
select 'jinan_full_flow_20260807', 'competition_main_roster_locks', jsonb_array_length(payload), payload,
       md5(payload::text), now(), 'Jinan full competition regression fixture captured before production cleanup'
from captured
on conflict (dataset_id, table_name) do update set
  row_count=excluded.row_count,
  payload=excluded.payload,
  checksum=excluded.checksum,
  captured_at=excluded.captured_at,
  note=excluded.note;

with captured as (
  select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) as payload
  from public.competition_main_advancement_batches t
  where event_id='event_391ce7a20bd7420fba77caeea42c0885'
)
insert into private.test_dataset_snapshots
  (dataset_id, table_name, row_count, payload, checksum, captured_at, note)
select 'jinan_full_flow_20260807', 'competition_main_advancement_batches', jsonb_array_length(payload), payload,
       md5(payload::text), now(), 'Jinan full competition regression fixture captured before production cleanup'
from captured
on conflict (dataset_id, table_name) do update set
  row_count=excluded.row_count,
  payload=excluded.payload,
  checksum=excluded.checksum,
  captured_at=excluded.captured_at,
  note=excluded.note;

with captured as (
  select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) as payload
  from public.competition_final_ranking_batches t
  where event_id='event_391ce7a20bd7420fba77caeea42c0885'
)
insert into private.test_dataset_snapshots
  (dataset_id, table_name, row_count, payload, checksum, captured_at, note)
select 'jinan_full_flow_20260807', 'competition_final_ranking_batches', jsonb_array_length(payload), payload,
       md5(payload::text), now(), 'Jinan full competition regression fixture captured before production cleanup'
from captured
on conflict (dataset_id, table_name) do update set
  row_count=excluded.row_count,
  payload=excluded.payload,
  checksum=excluded.checksum,
  captured_at=excluded.captured_at,
  note=excluded.note;

with captured as (
  select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) as payload
  from public.audit_logs t
  where event_id='event_391ce7a20bd7420fba77caeea42c0885'
)
insert into private.test_dataset_snapshots
  (dataset_id, table_name, row_count, payload, checksum, captured_at, note)
select 'jinan_full_flow_20260807', 'audit_logs', jsonb_array_length(payload), payload,
       md5(payload::text), now(), 'Jinan full competition regression fixture captured before production cleanup'
from captured
on conflict (dataset_id, table_name) do update set
  row_count=excluded.row_count,
  payload=excluded.payload,
  checksum=excluded.checksum,
  captured_at=excluded.captured_at,
  note=excluded.note;

commit;

select table_name, row_count, checksum
from private.test_dataset_snapshots
where dataset_id='jinan_full_flow_20260807'
order by table_name;

