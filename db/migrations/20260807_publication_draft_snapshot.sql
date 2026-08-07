alter table public.publications
  add column if not exists has_unpublished_changes boolean not null default false,
  add column if not exists draft_updated_at text;

update public.publications
set has_unpublished_changes = false
where has_unpublished_changes is distinct from false;

create index if not exists publications_dirty_idx
  on public.publications(event_id, module_type, status, has_unpublished_changes);
