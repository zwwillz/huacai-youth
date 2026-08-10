alter table public.events
  add column if not exists registration_state text not null default 'not_open';

alter table public.events
  add column if not exists registration_url text;

comment on column public.events.registration_state is 'Registration business state: not_open, open, closed';
comment on column public.events.registration_url is 'External registration entry URL for the current draft';
