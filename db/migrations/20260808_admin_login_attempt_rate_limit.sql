create table if not exists public.admin_login_attempts (
  id text primary key,
  username_key text not null,
  ip_address text,
  user_agent text,
  success boolean not null default false,
  attempted_at text not null
);
create index if not exists admin_login_attempts_username_time_idx
  on public.admin_login_attempts(username_key, attempted_at desc);
create index if not exists admin_login_attempts_ip_time_idx
  on public.admin_login_attempts(ip_address, attempted_at desc)
  where ip_address is not null;
alter table public.admin_login_attempts enable row level security;
