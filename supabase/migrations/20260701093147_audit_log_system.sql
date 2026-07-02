-- Phase 7: immutable audit logging.
-- This migration upgrades the legacy audit_logs table in-place so existing
-- Phase 1-6 hooks that insert actor_id/action/target_type/details keep working.

alter table public.audit_logs
  add column if not exists occurred_at timestamptz not null default now(),
  add column if not exists actor_type text not null default 'user',
  add column if not exists actor_user_id text,
  add column if not exists actor_role text,
  add column if not exists actor_display_name_snapshot text,
  add column if not exists category text not null default 'administrative',
  add column if not exists severity text not null default 'info',
  add column if not exists entity_type text,
  add column if not exists entity_id text,
  add column if not exists entity_display_name_snapshot text,
  add column if not exists request_id text,
  add column if not exists correlation_id text,
  add column if not exists session_reference_hash text,
  add column if not exists source text not null default 'api',
  add column if not exists ip_address_hash text,
  add column if not exists country_code text,
  add column if not exists before_data jsonb,
  add column if not exists after_data jsonb,
  add column if not exists changed_fields text[] not null default '{}',
  add column if not exists metadata jsonb not null default '{}',
  add column if not exists status text not null default 'success',
  add column if not exists error_code text;

update public.audit_logs
set
  occurred_at = coalesce(occurred_at, created_at, now()),
  actor_user_id = coalesce(actor_user_id, actor_id::text),
  entity_type = coalesce(entity_type, target_type),
  entity_id = coalesce(entity_id, target_id::text),
  metadata = case
    when metadata is null or metadata = '{}'::jsonb then coalesce(details, '{}'::jsonb)
    else metadata
  end,
  status = coalesce(status, nullif(result, ''), 'success')
where actor_user_id is null
   or entity_type is null
   or entity_id is null
   or metadata is null
   or occurred_at is null;

alter table public.audit_logs
  drop constraint if exists audit_logs_actor_type_check,
  add constraint audit_logs_actor_type_check
    check (actor_type in ('user', 'system', 'scheduler', 'service', 'anonymous'));

alter table public.audit_logs
  drop constraint if exists audit_logs_category_check,
  add constraint audit_logs_category_check
    check (category in ('authentication', 'account', 'employee', 'course', 'quiz', 'learning_path', 'compliance', 'certificate', 'report', 'notification', 'training_session', 'system', 'administrative', 'security'));

alter table public.audit_logs
  drop constraint if exists audit_logs_severity_check,
  add constraint audit_logs_severity_check
    check (severity in ('info', 'warning', 'critical'));

alter table public.audit_logs
  drop constraint if exists audit_logs_source_check,
  add constraint audit_logs_source_check
    check (source in ('web', 'api', 'cron', 'system', 'migration'));

alter table public.audit_logs
  drop constraint if exists audit_logs_status_check,
  add constraint audit_logs_status_check
    check (status in ('success', 'failed', 'partial', 'skipped'));

alter table public.audit_logs enable row level security;

drop policy if exists "audit_logs_insert_hr" on public.audit_logs;
drop policy if exists "audit_logs_select_hr" on public.audit_logs;
drop policy if exists "audit_logs_update_hr" on public.audit_logs;
drop policy if exists "audit_logs_delete_hr" on public.audit_logs;
drop policy if exists "audit_logs_manage_hr" on public.audit_logs;

create policy "audit_logs_select_hr" on public.audit_logs
  for select
  using (is_hr_or_admin());

create index if not exists audit_logs_occurred_at_idx on public.audit_logs(occurred_at desc);
create index if not exists audit_logs_actor_user_idx on public.audit_logs(actor_user_id, occurred_at desc);
create index if not exists audit_logs_action_idx on public.audit_logs(action, occurred_at desc);
create index if not exists audit_logs_category_idx on public.audit_logs(category, occurred_at desc);
create index if not exists audit_logs_severity_idx on public.audit_logs(severity, occurred_at desc);
create index if not exists audit_logs_entity_idx on public.audit_logs(entity_type, entity_id, occurred_at desc);
create index if not exists audit_logs_request_id_idx on public.audit_logs(request_id);
create index if not exists audit_logs_correlation_id_idx on public.audit_logs(correlation_id);
create index if not exists audit_logs_source_idx on public.audit_logs(source, occurred_at desc);
create index if not exists audit_logs_status_idx on public.audit_logs(status, occurred_at desc);
create index if not exists audit_logs_critical_idx on public.audit_logs(occurred_at desc) where severity = 'critical';
create index if not exists audit_logs_failed_idx on public.audit_logs(occurred_at desc) where status = 'failed';

comment on table public.audit_logs is
  'Immutable administrative/security audit trail. Worker/service role inserts only; HR/admin read via API. Do not update/delete except future governed retention process.';
