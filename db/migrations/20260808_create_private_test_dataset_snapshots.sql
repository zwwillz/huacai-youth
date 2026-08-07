create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;

create table if not exists private.test_dataset_snapshots (
  dataset_id text not null,
  table_name text not null,
  row_count integer not null default 0,
  payload jsonb not null default '[]'::jsonb,
  checksum text not null,
  captured_at timestamptz not null default now(),
  note text,
  primary key (dataset_id, table_name),
  check (jsonb_typeof(payload) = 'array'),
  check (row_count = jsonb_array_length(payload))
);

alter table private.test_dataset_snapshots enable row level security;

comment on table private.test_dataset_snapshots is
  'Private, non-Data-API fixtures for reproducible competition regression tests.';
