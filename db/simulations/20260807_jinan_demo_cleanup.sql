-- DO NOT RUN automatically. This script only removes the temporary Jinan simulation dataset created on 2026-08-07.
-- Event: event_391ce7a20bd7420fba77caeea42c0885
-- It also restores the Jinan event metadata that existed before the public competition simulation timeline was applied.

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
delete from public.event_organizations where event_id='event_391ce7a20bd7420fba77caeea42c0885' and id like 'sim_jinan_org_%';
delete from public.event_sponsors where event_id='event_391ce7a20bd7420fba77caeea42c0885' and id like 'sim_jinan_sponsor_%';

update public.events
set start_date='2026-09-01', end_date='2026-09-10', status='registration_open',
    summary='2026中国华彩十六球青少年系列赛山东济南站'
where id='event_391ce7a20bd7420fba77caeea42c0885';

update public.event_details
set sponsor_label=null,duration_label=null,qualifier_date_label=null,main_date_label=null,total_prize_label=null,main_size_label=null,
    minimum_age_note=null,signup_note=null,age_rules='{}'::jsonb,competition_format='[]'::jsonb,draw_rules='[]'::jsonb,
    prizes='{"少年组":[],"青年组":[]}'::jsonb
where event_id='event_391ce7a20bd7420fba77caeea42c0885';

update public.event_phases
set date_label=null,status='pending'
where event_id='event_391ce7a20bd7420fba77caeea42c0885';

update public.publications
set status=case when module_type='regulation' then 'published' else 'draft' end,
    published_at=case when module_type='regulation' then '2026-08-06T16:36:17.637Z' else null end
where event_id='event_391ce7a20bd7420fba77caeea42c0885';

commit;
