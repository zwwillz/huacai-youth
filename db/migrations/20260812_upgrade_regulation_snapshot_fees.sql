-- Extend existing published regulation snapshots with the fee fields that are
-- already maintained inside the regulation editor. Preserve every previously
-- snapshotted regulation field; only add the new v2 fields.
update public.publications p
set snapshot_json = (
  coalesce(nullif(p.snapshot_json, ''), '{}')::jsonb
  || jsonb_build_object(
    'version', 2,
    'signupNote', coalesce(d.signup_note, ''),
    'registrationFees', jsonb_build_object(
      '少年组', (
        select g.registration_fee_cents
        from public.event_groups g
        where g.event_id = p.event_id and g.name = '少年组' and g.status = 'active'
        order by g.created_at asc
        limit 1
      ),
      '青年组', (
        select g.registration_fee_cents
        from public.event_groups g
        where g.event_id = p.event_id and g.name = '青年组' and g.status = 'active'
        order by g.created_at asc
        limit 1
      )
    )
  )
)::text
from public.event_details d
where p.event_id = d.event_id
  and p.module_type = 'regulation'
  and p.status = 'published'
  and nullif(p.snapshot_json, '') is not null
  and coalesce((p.snapshot_json::jsonb ->> 'version')::int, 1) < 2;
