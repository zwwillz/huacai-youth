ALTER TABLE public.player_points_rules
  ALTER COLUMN participation_points SET DEFAULT 1;

UPDATE public.player_points_rules
SET participation_points = 1,
    prize_unit_yuan = 100,
    prize_points_per_unit = 1,
    updated_at = NOW()::text
WHERE year = 2026;
