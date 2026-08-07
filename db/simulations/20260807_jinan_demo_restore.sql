-- DO NOT RUN against an active event.
-- Restores the complete Jinan regression fixture captured in private.test_dataset_snapshots.
-- The operation is atomic and first removes any prior copy of the fixture.

begin;

delete from public.audit_logs where event_id='event_391ce7a20bd7420fba77caeea42c0885';
delete from public.competition_qualification_entries where batch_id in (select id from public.competition_qualification_batches where event_id='event_391ce7a20bd7420fba77caeea42c0885');
delete from public.competition_qualification_batches where event_id='event_391ce7a20bd7420fba77caeea42c0885';
delete from public.competition_match_schedules where schedule_id in (select id from public.competition_schedules where event_id='event_391ce7a20bd7420fba77caeea42c0885');
delete from public.competition_schedules where event_id='event_391ce7a20bd7420fba77caeea42c0885';
delete from public.competition_match_links where bracket_id in (select id from public.competition_brackets where event_id='event_391ce7a20bd7420fba77caeea42c0885');
delete from public.competition_bracket_matches where event_id='event_391ce7a20bd7420fba77caeea42c0885';
delete from public.competition_brackets where event_id='event_391ce7a20bd7420fba77caeea42c0885';
delete from public.draw_slots where session_id in (select id from public.draw_sessions where event_id='event_391ce7a20bd7420fba77caeea42c0885');
delete from public.draw_prelim_matches where session_id in (select id from public.draw_sessions where event_id='event_391ce7a20bd7420fba77caeea42c0885');
delete from public.draw_participants where session_id in (select id from public.draw_sessions where event_id='event_391ce7a20bd7420fba77caeea42c0885');
delete from public.draw_sessions where event_id='event_391ce7a20bd7420fba77caeea42c0885';
delete from public.competition_phase_settings where event_id='event_391ce7a20bd7420fba77caeea42c0885';
delete from public.competition_event_tables where event_id='event_391ce7a20bd7420fba77caeea42c0885';
delete from public.competition_time_slots where event_id='event_391ce7a20bd7420fba77caeea42c0885';
delete from public.competition_phase_entries where event_id='event_391ce7a20bd7420fba77caeea42c0885';
delete from public.competition_seed_entries where event_id='event_391ce7a20bd7420fba77caeea42c0885';
delete from public.competition_main_roster_locks where event_id='event_391ce7a20bd7420fba77caeea42c0885';
delete from public.competition_main_advancement_batches where event_id='event_391ce7a20bd7420fba77caeea42c0885';
delete from public.competition_final_ranking_batches where event_id='event_391ce7a20bd7420fba77caeea42c0885';
delete from public.matches where event_id='event_391ce7a20bd7420fba77caeea42c0885';
delete from public.event_rankings where event_id='event_391ce7a20bd7420fba77caeea42c0885';
delete from public.registrations where event_id='event_391ce7a20bd7420fba77caeea42c0885';
delete from public.publications where event_id='event_391ce7a20bd7420fba77caeea42c0885';
delete from public.event_members where event_id='event_391ce7a20bd7420fba77caeea42c0885';
delete from public.event_guides where event_id='event_391ce7a20bd7420fba77caeea42c0885';
delete from public.event_documents where event_id='event_391ce7a20bd7420fba77caeea42c0885';
delete from public.event_assets where event_id='event_391ce7a20bd7420fba77caeea42c0885';
delete from public.event_phases where event_id='event_391ce7a20bd7420fba77caeea42c0885';
delete from public.event_sponsors where event_id='event_391ce7a20bd7420fba77caeea42c0885';
delete from public.event_organizations where event_id='event_391ce7a20bd7420fba77caeea42c0885';
delete from public.event_details where event_id='event_391ce7a20bd7420fba77caeea42c0885';
delete from public.event_groups where event_id='event_391ce7a20bd7420fba77caeea42c0885';
delete from public.guardians where player_id like 'sim_jinan_%';
delete from public.events where id='event_391ce7a20bd7420fba77caeea42c0885';
delete from public.players where id like 'sim_jinan_%';

insert into public.events
select * from jsonb_populate_recordset(
  null::public.events,
  coalesce((select payload from private.test_dataset_snapshots where dataset_id='jinan_full_flow_20260807' and table_name='events'), '[]'::jsonb)
);

insert into public.players
select * from jsonb_populate_recordset(
  null::public.players,
  coalesce((select payload from private.test_dataset_snapshots where dataset_id='jinan_full_flow_20260807' and table_name='players'), '[]'::jsonb)
);

insert into public.guardians
select * from jsonb_populate_recordset(
  null::public.guardians,
  coalesce((select payload from private.test_dataset_snapshots where dataset_id='jinan_full_flow_20260807' and table_name='guardians'), '[]'::jsonb)
);

insert into public.event_details
select * from jsonb_populate_recordset(
  null::public.event_details,
  coalesce((select payload from private.test_dataset_snapshots where dataset_id='jinan_full_flow_20260807' and table_name='event_details'), '[]'::jsonb)
);

insert into public.event_groups
select * from jsonb_populate_recordset(
  null::public.event_groups,
  coalesce((select payload from private.test_dataset_snapshots where dataset_id='jinan_full_flow_20260807' and table_name='event_groups'), '[]'::jsonb)
);

insert into public.event_organizations
select * from jsonb_populate_recordset(
  null::public.event_organizations,
  coalesce((select payload from private.test_dataset_snapshots where dataset_id='jinan_full_flow_20260807' and table_name='event_organizations'), '[]'::jsonb)
);

insert into public.event_sponsors
select * from jsonb_populate_recordset(
  null::public.event_sponsors,
  coalesce((select payload from private.test_dataset_snapshots where dataset_id='jinan_full_flow_20260807' and table_name='event_sponsors'), '[]'::jsonb)
);

insert into public.event_phases
select * from jsonb_populate_recordset(
  null::public.event_phases,
  coalesce((select payload from private.test_dataset_snapshots where dataset_id='jinan_full_flow_20260807' and table_name='event_phases'), '[]'::jsonb)
);

insert into public.event_assets
select * from jsonb_populate_recordset(
  null::public.event_assets,
  coalesce((select payload from private.test_dataset_snapshots where dataset_id='jinan_full_flow_20260807' and table_name='event_assets'), '[]'::jsonb)
);

insert into public.event_documents
select * from jsonb_populate_recordset(
  null::public.event_documents,
  coalesce((select payload from private.test_dataset_snapshots where dataset_id='jinan_full_flow_20260807' and table_name='event_documents'), '[]'::jsonb)
);

insert into public.event_guides
select * from jsonb_populate_recordset(
  null::public.event_guides,
  coalesce((select payload from private.test_dataset_snapshots where dataset_id='jinan_full_flow_20260807' and table_name='event_guides'), '[]'::jsonb)
);

insert into public.event_members
select * from jsonb_populate_recordset(
  null::public.event_members,
  coalesce((select payload from private.test_dataset_snapshots where dataset_id='jinan_full_flow_20260807' and table_name='event_members'), '[]'::jsonb)
);

insert into public.event_rankings
select * from jsonb_populate_recordset(
  null::public.event_rankings,
  coalesce((select payload from private.test_dataset_snapshots where dataset_id='jinan_full_flow_20260807' and table_name='event_rankings'), '[]'::jsonb)
);

insert into public.publications
select * from jsonb_populate_recordset(
  null::public.publications,
  coalesce((select payload from private.test_dataset_snapshots where dataset_id='jinan_full_flow_20260807' and table_name='publications'), '[]'::jsonb)
);

insert into public.registrations
select * from jsonb_populate_recordset(
  null::public.registrations,
  coalesce((select payload from private.test_dataset_snapshots where dataset_id='jinan_full_flow_20260807' and table_name='registrations'), '[]'::jsonb)
);

insert into public.matches
select * from jsonb_populate_recordset(
  null::public.matches,
  coalesce((select payload from private.test_dataset_snapshots where dataset_id='jinan_full_flow_20260807' and table_name='matches'), '[]'::jsonb)
);

insert into public.competition_phase_settings
select * from jsonb_populate_recordset(
  null::public.competition_phase_settings,
  coalesce((select payload from private.test_dataset_snapshots where dataset_id='jinan_full_flow_20260807' and table_name='competition_phase_settings'), '[]'::jsonb)
);

insert into public.draw_sessions
select * from jsonb_populate_recordset(
  null::public.draw_sessions,
  coalesce((select payload from private.test_dataset_snapshots where dataset_id='jinan_full_flow_20260807' and table_name='draw_sessions'), '[]'::jsonb)
);

insert into public.draw_participants
select * from jsonb_populate_recordset(
  null::public.draw_participants,
  coalesce((select payload from private.test_dataset_snapshots where dataset_id='jinan_full_flow_20260807' and table_name='draw_participants'), '[]'::jsonb)
);

insert into public.draw_prelim_matches
select * from jsonb_populate_recordset(
  null::public.draw_prelim_matches,
  coalesce((select payload from private.test_dataset_snapshots where dataset_id='jinan_full_flow_20260807' and table_name='draw_prelim_matches'), '[]'::jsonb)
);

insert into public.draw_slots
select * from jsonb_populate_recordset(
  null::public.draw_slots,
  coalesce((select payload from private.test_dataset_snapshots where dataset_id='jinan_full_flow_20260807' and table_name='draw_slots'), '[]'::jsonb)
);

insert into public.competition_brackets
select * from jsonb_populate_recordset(
  null::public.competition_brackets,
  coalesce((select payload from private.test_dataset_snapshots where dataset_id='jinan_full_flow_20260807' and table_name='competition_brackets'), '[]'::jsonb)
);

insert into public.competition_bracket_matches
select * from jsonb_populate_recordset(
  null::public.competition_bracket_matches,
  coalesce((select payload from private.test_dataset_snapshots where dataset_id='jinan_full_flow_20260807' and table_name='competition_bracket_matches'), '[]'::jsonb)
);

insert into public.competition_match_links
select * from jsonb_populate_recordset(
  null::public.competition_match_links,
  coalesce((select payload from private.test_dataset_snapshots where dataset_id='jinan_full_flow_20260807' and table_name='competition_match_links'), '[]'::jsonb)
);

insert into public.competition_event_tables
select * from jsonb_populate_recordset(
  null::public.competition_event_tables,
  coalesce((select payload from private.test_dataset_snapshots where dataset_id='jinan_full_flow_20260807' and table_name='competition_event_tables'), '[]'::jsonb)
);

insert into public.competition_time_slots
select * from jsonb_populate_recordset(
  null::public.competition_time_slots,
  coalesce((select payload from private.test_dataset_snapshots where dataset_id='jinan_full_flow_20260807' and table_name='competition_time_slots'), '[]'::jsonb)
);

insert into public.competition_schedules
select * from jsonb_populate_recordset(
  null::public.competition_schedules,
  coalesce((select payload from private.test_dataset_snapshots where dataset_id='jinan_full_flow_20260807' and table_name='competition_schedules'), '[]'::jsonb)
);

insert into public.competition_match_schedules
select * from jsonb_populate_recordset(
  null::public.competition_match_schedules,
  coalesce((select payload from private.test_dataset_snapshots where dataset_id='jinan_full_flow_20260807' and table_name='competition_match_schedules'), '[]'::jsonb)
);

insert into public.competition_qualification_batches
select * from jsonb_populate_recordset(
  null::public.competition_qualification_batches,
  coalesce((select payload from private.test_dataset_snapshots where dataset_id='jinan_full_flow_20260807' and table_name='competition_qualification_batches'), '[]'::jsonb)
);

insert into public.competition_qualification_entries
select * from jsonb_populate_recordset(
  null::public.competition_qualification_entries,
  coalesce((select payload from private.test_dataset_snapshots where dataset_id='jinan_full_flow_20260807' and table_name='competition_qualification_entries'), '[]'::jsonb)
);

insert into public.competition_phase_entries
select * from jsonb_populate_recordset(
  null::public.competition_phase_entries,
  coalesce((select payload from private.test_dataset_snapshots where dataset_id='jinan_full_flow_20260807' and table_name='competition_phase_entries'), '[]'::jsonb)
);

insert into public.competition_seed_entries
select * from jsonb_populate_recordset(
  null::public.competition_seed_entries,
  coalesce((select payload from private.test_dataset_snapshots where dataset_id='jinan_full_flow_20260807' and table_name='competition_seed_entries'), '[]'::jsonb)
);

insert into public.competition_main_roster_locks
select * from jsonb_populate_recordset(
  null::public.competition_main_roster_locks,
  coalesce((select payload from private.test_dataset_snapshots where dataset_id='jinan_full_flow_20260807' and table_name='competition_main_roster_locks'), '[]'::jsonb)
);

insert into public.competition_main_advancement_batches
select * from jsonb_populate_recordset(
  null::public.competition_main_advancement_batches,
  coalesce((select payload from private.test_dataset_snapshots where dataset_id='jinan_full_flow_20260807' and table_name='competition_main_advancement_batches'), '[]'::jsonb)
);

insert into public.competition_final_ranking_batches
select * from jsonb_populate_recordset(
  null::public.competition_final_ranking_batches,
  coalesce((select payload from private.test_dataset_snapshots where dataset_id='jinan_full_flow_20260807' and table_name='competition_final_ranking_batches'), '[]'::jsonb)
);

insert into public.audit_logs
select * from jsonb_populate_recordset(
  null::public.audit_logs,
  coalesce((select payload from private.test_dataset_snapshots where dataset_id='jinan_full_flow_20260807' and table_name='audit_logs'), '[]'::jsonb)
);

commit;

