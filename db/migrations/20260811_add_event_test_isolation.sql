alter table public.events
  add column if not exists is_test boolean not null default false;

update public.events
set is_test = true
where id = 'event_luoyang_test_2026'
  and is_test is distinct from true;
