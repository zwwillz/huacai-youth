ALTER TABLE public.event_groups
  ADD COLUMN IF NOT EXISTS participant_roster_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS participant_roster_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS participant_roster_confirmed_by text REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS participant_roster_confirmed_at text,
  ADD COLUMN IF NOT EXISTS participant_roster_locked_by text REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS participant_roster_locked_at text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'event_groups_participant_roster_status_check'
  ) THEN
    ALTER TABLE public.event_groups
      ADD CONSTRAINT event_groups_participant_roster_status_check
      CHECK (participant_roster_status IN ('draft', 'confirmed', 'locked'));
  END IF;
END $$;

-- Existing historical competitions have already entered draw/match execution.
-- Treat those group rosters as locked so the new prerequisite does not break
-- legitimate historical competition data.
WITH historical AS (
  SELECT eg.id,
    (
      SELECT count(*)::int
      FROM public.registrations r
      JOIN public.players p ON p.id = r.player_id
      WHERE r.event_id = eg.event_id
        AND r.group_id = eg.id
        AND r.status = 'approved'
        AND p.merged_into_player_id IS NULL
    ) AS roster_count,
    coalesce(
      (SELECT min(ds.created_at) FROM public.draw_sessions ds WHERE ds.event_id = eg.event_id AND ds.group_id = eg.id),
      (SELECT min(m.created_at) FROM public.matches m WHERE m.event_id = eg.event_id AND m.group_id = eg.id),
      now()::text
    ) AS locked_at
  FROM public.event_groups eg
  WHERE EXISTS (SELECT 1 FROM public.draw_sessions ds WHERE ds.event_id = eg.event_id AND ds.group_id = eg.id)
     OR EXISTS (SELECT 1 FROM public.matches m WHERE m.event_id = eg.event_id AND m.group_id = eg.id)
)
UPDATE public.event_groups eg
SET participant_roster_status = 'locked',
    participant_roster_count = historical.roster_count,
    participant_roster_confirmed_at = coalesce(eg.participant_roster_confirmed_at, historical.locked_at),
    participant_roster_locked_at = coalesce(eg.participant_roster_locked_at, historical.locked_at)
FROM historical
WHERE eg.id = historical.id
  AND eg.participant_roster_status <> 'locked';
