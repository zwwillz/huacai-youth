alter table public.event_guides
  add column if not exists sort_order integer not null default 0,
  add column if not exists content_json jsonb not null default '[]'::jsonb;

create index if not exists event_guides_event_sort_idx
  on public.event_guides(event_id, sort_order);
