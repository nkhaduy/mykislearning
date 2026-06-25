-- ============================================================
-- Migration 011: Compliance Training (Phase 3)
-- Adds compliance programs, target rules, cycles, assignments,
-- and immutable completion records.
-- Safe to re-run: uses IF NOT EXISTS.
-- Rollback notes at end of file.
-- ============================================================

create table if not exists public.compliance_programs (
  id text primary key,
  code text not null,
  title text not null,
  description text,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  resource_type text not null
    check (resource_type in ('course', 'learning_path')),
  resource_id text not null,
  recurrence_type text not null default 'one_time'
    check (recurrence_type in ('one_time', 'annual', 'semiannual', 'custom_months')),
  recurrence_interval_months int,
  default_duration_days int not null default 30 check (default_duration_days > 0),
  default_pass_score int not null default 0 check (default_pass_score between 0 and 100),
  default_max_attempts int not null default 0 check (default_max_attempts >= 0),
  default_grace_period_days int not null default 0 check (default_grace_period_days >= 0),
  requires_retraining_on_resource_change boolean not null default false,
  created_by text,
  published_at timestamptz,
  archived_at timestamptz,
  data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (code),
  check (recurrence_type <> 'custom_months' or recurrence_interval_months is not null),
  check (recurrence_interval_months is null or recurrence_interval_months > 0)
);

create index if not exists compliance_programs_status_idx on public.compliance_programs(status);
create index if not exists compliance_programs_resource_idx on public.compliance_programs(resource_type, resource_id);
create index if not exists compliance_programs_updated_at_idx on public.compliance_programs(updated_at desc);

create table if not exists public.compliance_target_rules (
  id text primary key,
  program_id text not null references public.compliance_programs(id) on delete cascade,
  target_type text not null
    check (target_type in ('all_employees', 'department', 'job_title', 'individual')),
  target_value text,
  created_at timestamptz not null default now(),
  check (
    (target_type = 'all_employees' and target_value is null)
    or (target_type <> 'all_employees' and target_value is not null and length(trim(target_value)) > 0)
  )
);

create unique index if not exists compliance_target_rules_uniq
  on public.compliance_target_rules(program_id, target_type, coalesce(target_value, ''));
create index if not exists compliance_target_rules_program_idx on public.compliance_target_rules(program_id);

create table if not exists public.compliance_cycles (
  id text primary key,
  program_id text not null references public.compliance_programs(id) on delete restrict,
  cycle_code text not null,
  title text not null,
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'active', 'closed', 'cancelled')),
  start_at timestamptz not null,
  due_at timestamptz not null,
  grace_until timestamptz,
  resource_type text not null
    check (resource_type in ('course', 'learning_path')),
  resource_id text not null,
  resource_revision_reference text,
  pass_score int not null default 0 check (pass_score between 0 and 100),
  max_attempts int not null default 0 check (max_attempts >= 0),
  created_by text,
  activated_at timestamptz,
  closed_at timestamptz,
  data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, cycle_code),
  check (due_at >= start_at),
  check (grace_until is null or grace_until >= due_at)
);

create index if not exists compliance_cycles_program_idx on public.compliance_cycles(program_id);
create index if not exists compliance_cycles_status_idx on public.compliance_cycles(status);
create index if not exists compliance_cycles_due_at_idx on public.compliance_cycles(due_at);
create index if not exists compliance_cycles_resource_idx on public.compliance_cycles(resource_type, resource_id);

create table if not exists public.compliance_assignments (
  id text primary key,
  cycle_id text not null references public.compliance_cycles(id) on delete restrict,
  employee_id text not null,
  assignment_source text not null default 'target_rule'
    check (assignment_source in ('target_rule', 'manual', 'migration')),
  assigned_at timestamptz not null default now(),
  start_at timestamptz not null,
  due_at timestamptz not null,
  grace_until timestamptz,
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'completed', 'overdue', 'failed', 'exempted', 'cancelled')),
  progress_percent int not null default 0 check (progress_percent between 0 and 100),
  attempt_count int not null default 0 check (attempt_count >= 0),
  last_activity_at timestamptz,
  completed_at timestamptz,
  overdue_at timestamptz,
  exempted_at timestamptz,
  exemption_reason text,
  data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cycle_id, employee_id),
  check (due_at >= start_at),
  check (grace_until is null or grace_until >= due_at),
  check ((status <> 'exempted') or (exempted_at is not null and exemption_reason is not null))
);

create index if not exists compliance_assignments_cycle_idx on public.compliance_assignments(cycle_id);
create index if not exists compliance_assignments_employee_idx on public.compliance_assignments(employee_id);
create index if not exists compliance_assignments_status_idx on public.compliance_assignments(status);
create index if not exists compliance_assignments_due_at_idx on public.compliance_assignments(due_at);
create index if not exists compliance_assignments_employee_status_idx on public.compliance_assignments(employee_id, status);

create table if not exists public.compliance_completion_records (
  id text primary key,
  assignment_id text not null references public.compliance_assignments(id) on delete restrict,
  cycle_id text not null references public.compliance_cycles(id) on delete restrict,
  employee_id text not null,
  resource_type text not null
    check (resource_type in ('course', 'learning_path')),
  resource_id text not null,
  completion_source text not null
    check (completion_source in ('course_completion', 'learning_path_completion', 'quiz_pass', 'manual_verified', 'migration')),
  completed_at timestamptz not null,
  score int check (score is null or score between 0 and 100),
  attempt_number int check (attempt_number is null or attempt_number >= 0),
  was_completed_on_time boolean not null,
  evidence jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create unique index if not exists compliance_completion_assignment_source_uniq
  on public.compliance_completion_records(assignment_id, completion_source, completed_at);
create index if not exists compliance_completion_assignment_idx on public.compliance_completion_records(assignment_id);
create index if not exists compliance_completion_cycle_idx on public.compliance_completion_records(cycle_id);
create index if not exists compliance_completion_employee_idx on public.compliance_completion_records(employee_id);
create index if not exists compliance_completion_completed_at_idx on public.compliance_completion_records(completed_at desc);

do $$ begin
  if not exists (select 1 from information_schema.triggers where trigger_name = 'compliance_programs_updated_at') then
    create trigger compliance_programs_updated_at
      before update on public.compliance_programs
      for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from information_schema.triggers where trigger_name = 'compliance_cycles_updated_at') then
    create trigger compliance_cycles_updated_at
      before update on public.compliance_cycles
      for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from information_schema.triggers where trigger_name = 'compliance_assignments_updated_at') then
    create trigger compliance_assignments_updated_at
      before update on public.compliance_assignments
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- Worker-only model: requests go through Cloudflare Worker with service-role key.
-- Direct browser access to these tables is not used by the frontend bundle.
alter table public.compliance_programs disable row level security;
alter table public.compliance_target_rules disable row level security;
alter table public.compliance_cycles disable row level security;
alter table public.compliance_assignments disable row level security;
alter table public.compliance_completion_records disable row level security;

-- ============================================================
-- ROLLBACK NOTES (manual only; never run while production
-- compliance evidence exists):
--
-- drop table if exists public.compliance_completion_records;
-- drop table if exists public.compliance_assignments;
-- drop table if exists public.compliance_cycles;
-- drop table if exists public.compliance_target_rules;
-- drop table if exists public.compliance_programs;
-- ============================================================
