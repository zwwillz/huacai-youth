update public.publications p
set status = e.publish_status,
    version_no = case
      when p.status is distinct from e.publish_status then p.version_no + 1
      else p.version_no
    end,
    published_by = case
      when e.publish_status = 'published' then coalesce(p.published_by, e.updated_by)
      else null
    end,
    published_at = case
      when e.publish_status = 'published' then coalesce(p.published_at, e.published_at, e.updated_at)
      else null
    end,
    updated_at = coalesce(e.updated_at, p.updated_at)
from public.events e
where p.event_id = e.id
  and p.module_type = 'overview'
  and p.status is distinct from e.publish_status;
