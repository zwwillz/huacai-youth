-- Unified match fields shared by every station/event.
-- Applied to the Supabase public.matches table on 2026-08-06.

alter table public.matches add column if not exists match_code text;
alter table public.matches add column if not exists result_type text;

create index if not exists matches_event_phase_code_idx
  on public.matches(event_id, phase_id, match_code);

-- score_a / score_b and phase_id already exist from earlier migrations.
-- Display values such as X are preserved in score_a / score_b. Statistical
-- calculations should normalize X to 0; result_type distinguishes non-normal
-- outcomes such as forfeit/bye when the official result is known.
