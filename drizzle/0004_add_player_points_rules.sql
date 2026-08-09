CREATE TABLE IF NOT EXISTS public.player_points_rules (
  year integer PRIMARY KEY,
  participation_points integer NOT NULL DEFAULT 10,
  prize_unit_yuan integer NOT NULL DEFAULT 100,
  prize_points_per_unit integer NOT NULL DEFAULT 1,
  updated_by text REFERENCES public.users(id),
  created_at text NOT NULL,
  updated_at text NOT NULL,
  CONSTRAINT player_points_rules_participation_nonnegative CHECK (participation_points >= 0),
  CONSTRAINT player_points_rules_prize_unit_positive CHECK (prize_unit_yuan > 0),
  CONSTRAINT player_points_rules_prize_points_nonnegative CHECK (prize_points_per_unit >= 0)
);

ALTER TABLE public.player_points_rules ENABLE ROW LEVEL SECURITY;

INSERT INTO public.player_points_rules (
  year, participation_points, prize_unit_yuan, prize_points_per_unit, created_at, updated_at
)
SELECT
  COALESCE(MAX(year), EXTRACT(YEAR FROM CURRENT_DATE)::int),
  10,
  100,
  1,
  NOW()::text,
  NOW()::text
FROM public.events
ON CONFLICT (year) DO NOTHING;
