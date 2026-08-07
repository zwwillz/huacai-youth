-- Public player profile field shared by all events/stations.
alter table public.players
  add column if not exists nationality_code text not null default 'CN';

create index if not exists players_nationality_idx
  on public.players(nationality_code);
