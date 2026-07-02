alter table public.audit_logs
  add column if not exists user_agent text;
