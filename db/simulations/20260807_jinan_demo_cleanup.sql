-- DO NOT RUN automatically. This script only removes the temporary Jinan simulation dataset created on 2026-08-07.
-- Event: event_391ce7a20bd7420fba77caeea42c0885

begin;

delete from public.audit_logs
where event_id='event_391ce7a20bd7420fba77caeea42c0885'
  and (id like 'sim_jinan_%' or target_type like 'simulation%');

delete from public.competition_phase_entries
where event_id='event_391ce7a20bd7420fba77caeea42c0885'
  and (id like 'sim_%' or player_id like 'sim_jinan_%');

delete from public.competition_seed_entries
where event_id='event_391ce7a20bd7420fba77caeea42c0885'
  and player_id like 'sim_jinan_seed_%';

-- Cascades to brackets, bracket matches, match links, schedules and qualification batches/entries.
delete from public.draw_sessions
where event_id='event_391ce7a20bd7420fba77caeea42c0885'
  and id like 'sim_jinan_%';

delete from public.competition_time_slots
where event_id='event_391ce7a20bd7420fba77caeea42c0885'
  and id like 'sim_jinan_%';

delete from public.competition_event_tables
where event_id='event_391ce7a20bd7420fba77caeea42c0885'
  and id like 'sim_jinan_table_%';

delete from public.competition_phase_settings
where event_id='event_391ce7a20bd7420fba77caeea42c0885'
  and id like 'sim_jinan_%';

delete from public.registrations
where event_id='event_391ce7a20bd7420fba77caeea42c0885'
  and source='simulation';

delete from public.players where id like 'sim_jinan_%';

commit;
