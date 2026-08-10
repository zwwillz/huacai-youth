-- Validation branch marker; production indexes are unchanged.
create index if not exists audit_logs_created_at_idx
  on public.audit_logs (created_at);

create index if not exists audit_logs_module_created_idx
  on public.audit_logs (module_type, created_at);
