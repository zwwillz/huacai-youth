-- Backfill the last formally published regulation content into the existing
-- publications.snapshot_json boundary. This is intentionally DML-only:
-- no lifecycle, event visibility, document, registration, or competition rows change.
update public.publications p
set snapshot_json = jsonb_build_object(
  'version', 1,
  'ruleStandard', coalesce(d.rule_standard, ''),
  'competitionFormat', coalesce(d.competition_format, '[]'::jsonb),
  'drawRules', coalesce(d.draw_rules, '[]'::jsonb),
  'prizeNote', coalesce(d.prize_note, ''),
  'prizes', coalesce(d.prizes, '{"少年组":[],"青年组":[]}'::jsonb)
)::text
from public.events e
left join public.event_details d on d.event_id = e.id
where p.event_id = e.id
  and p.module_type = 'regulation'
  and p.status = 'published'
  and (p.snapshot_json is null or btrim(p.snapshot_json) = '');
