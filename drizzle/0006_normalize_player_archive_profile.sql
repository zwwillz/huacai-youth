ALTER TABLE public.players ADD COLUMN IF NOT EXISTS current_group_name text;

WITH latest_reg AS (
  SELECT DISTINCT ON (r.player_id) r.player_id, eg.name AS group_name
  FROM public.registrations r
  JOIN public.events e ON e.id = r.event_id
  JOIN public.event_groups eg ON eg.id = r.group_id
  WHERE r.status <> 'withdrawn'
  ORDER BY r.player_id, e.start_date DESC, r.event_id DESC
)
UPDATE public.players p
SET current_group_name = lr.group_name
FROM latest_reg lr
WHERE lr.player_id = p.id
  AND p.current_group_name IS NULL;

UPDATE public.players SET gender = '男' WHERE lower(btrim(coalesce(gender, ''))) = 'male';
UPDATE public.players SET gender = '女' WHERE lower(btrim(coalesce(gender, ''))) = 'female';

-- 球员档案不再使用独立审核流程。历史 pending 为早期导入遗留状态，统一归一为正常。
UPDATE public.players SET profile_status = 'approved' WHERE profile_status = 'pending';
