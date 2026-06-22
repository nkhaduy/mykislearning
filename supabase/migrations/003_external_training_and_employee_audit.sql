create table if not exists public.external_training_requests (
  id uuid primary key default gen_random_uuid(),
  account_id text not null,
  course_name text not null,
  provider text not null,
  learning_content text not null,
  study_time text not null,
  cost numeric(14,2) not null default 0 check (cost >= 0),
  evidence_url text,
  note text,
  status text not null default 'pending' check (status in ('pending','accepted','rejected','needs_info')),
  hr_feedback text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists external_training_requests_account_idx on public.external_training_requests(account_id, created_at desc);
create index if not exists external_training_requests_status_idx on public.external_training_requests(status, created_at desc);

create table if not exists public.employee_profile_audit_logs (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null,
  actor_account_id text not null,
  changed_fields jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists employee_profile_audit_employee_idx on public.employee_profile_audit_logs(employee_id, created_at desc);
