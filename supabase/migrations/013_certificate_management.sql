-- ============================================================
-- Migration 013: Certificate Management (Phase 4)
-- Extends the existing employee_certifications records instead
-- of creating a duplicate certificate ledger.
-- Safe to re-run: uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
-- ============================================================

create table if not exists public.certificate_types (
  id text primary key default gen_random_uuid()::text,
  code text not null,
  name text not null,
  description text,
  issuer_name text,
  category text,
  has_expiration boolean not null default true,
  default_validity_months int check (default_validity_months is null or default_validity_months > 0),
  default_warning_days int not null default 60 check (default_warning_days >= 0),
  requires_verification boolean not null default true,
  status text not null default 'active'
    check (status in ('active', 'inactive', 'archived')),
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (code)
);

create index if not exists certificate_types_status_idx on public.certificate_types(status);
create index if not exists certificate_types_category_idx on public.certificate_types(category);

create table if not exists public.certificate_requirements (
  id text primary key default gen_random_uuid()::text,
  certificate_type_id text not null references public.certificate_types(id) on delete restrict,
  target_type text not null
    check (target_type in ('all_employees', 'department', 'job_title', 'individual')),
  target_value text,
  is_required boolean not null default true,
  effective_from date not null default current_date,
  effective_until date,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (target_type = 'all_employees' and target_value is null)
    or (target_type <> 'all_employees' and target_value is not null and length(trim(target_value)) > 0)
  ),
  check (effective_until is null or effective_until >= effective_from)
);

create unique index if not exists certificate_requirements_uniq
  on public.certificate_requirements(certificate_type_id, target_type, coalesce(target_value, ''), effective_from)
  where is_required = true;
create index if not exists certificate_requirements_type_idx on public.certificate_requirements(certificate_type_id);
create index if not exists certificate_requirements_target_idx on public.certificate_requirements(target_type, target_value);

create table if not exists public.certificate_alert_events (
  id text primary key default gen_random_uuid()::text,
  certificate_id text not null,
  employee_id text not null,
  event_type text not null
    check (event_type in (
      'certificate_submitted',
      'certificate_verified',
      'certificate_rejected',
      'certificate_expiring_60',
      'certificate_expiring_30',
      'certificate_expiring_15',
      'certificate_expiring_7',
      'certificate_expired',
      'certificate_requirement_missing'
    )),
  threshold_days int,
  created_at timestamptz not null default now(),
  data jsonb not null default '{}'
);

create unique index if not exists certificate_alert_events_uniq
  on public.certificate_alert_events(certificate_id, event_type, coalesce(threshold_days, -1));
create index if not exists certificate_alert_events_employee_idx on public.certificate_alert_events(employee_id, created_at desc);

alter table public.employee_certifications add column if not exists certificate_type_id text references public.certificate_types(id) on delete set null;
alter table public.employee_certifications add column if not exists storage_bucket text;
alter table public.employee_certifications add column if not exists storage_path text;
alter table public.employee_certifications add column if not exists original_file_name text;
alter table public.employee_certifications add column if not exists mime_type text;
alter table public.employee_certifications add column if not exists file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0);
alter table public.employee_certifications add column if not exists verified_by text;
alter table public.employee_certifications add column if not exists verified_at timestamptz;
alter table public.employee_certifications add column if not exists supersedes_certificate_id text;
alter table public.employee_certifications add column if not exists renewal_group_id text;

do $$ begin
  alter table public.employee_certifications drop constraint if exists employee_certifications_status_check;
  alter table public.employee_certifications add constraint employee_certifications_status_check
    check (status in ('valid', 'expired', 'pending', 'revoked', 'superseded'));
exception when duplicate_object then
  null;
end $$;

create index if not exists emp_cert_type_id_idx on public.employee_certifications(certificate_type_id);
create index if not exists emp_cert_expiry_date_idx on public.employee_certifications(expiry_date);
create index if not exists emp_cert_renewal_group_idx on public.employee_certifications(renewal_group_id);
create index if not exists emp_cert_verification_status_idx on public.employee_certifications(verification_status);
create index if not exists emp_cert_status_idx on public.employee_certifications(status);

insert into storage.buckets(id, name, public)
values ('employee-certificates', 'employee-certificates', false)
on conflict (id) do update set public = false;

do $$ begin
  if not exists (select 1 from information_schema.triggers where trigger_name = 'certificate_types_updated_at') then
    create trigger certificate_types_updated_at
      before update on public.certificate_types
      for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from information_schema.triggers where trigger_name = 'certificate_requirements_updated_at') then
    create trigger certificate_requirements_updated_at
      before update on public.certificate_requirements
      for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.certificate_types enable row level security;
alter table public.certificate_requirements enable row level security;
alter table public.certificate_alert_events enable row level security;

-- Worker-only model: no anon/authenticated direct policies are created.
-- The Cloudflare Worker uses the service-role key and enforces HR/ownership.

-- Rollback note:
-- drop table public.certificate_alert_events;
-- drop table public.certificate_requirements;
-- drop table public.certificate_types;
-- Keep added employee_certifications columns unless all certificate data is retired.
