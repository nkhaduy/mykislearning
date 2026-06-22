-- Core learning workflows. Additive only: no truncate/drop and safe to re-run.
create table if not exists public.user_roles (
  account_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('employee','hr','admin','trainer')),
  created_at timestamptz not null default now(),
  primary key (account_id, role)
);
create index if not exists user_roles_role_account_idx on public.user_roles(role, account_id);

insert into public.user_roles(account_id, role)
select id, role from public.profiles
where role in ('employee','hr','admin','trainer')
on conflict do nothing;

alter table public.profiles add column if not exists notes text;
alter table public.profiles add column if not exists must_change_password boolean not null default false;

create table if not exists public.external_course_submissions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.profiles(id) on delete restrict,
  course_name text not null,
  provider text not null,
  learning_content text not null,
  subject text not null,
  start_date date not null,
  end_date date not null,
  learning_hours numeric(8,2) not null check (learning_hours > 0),
  cost numeric(14,2) not null default 0 check (cost >= 0),
  payment_support text,
  certificate_name text,
  evidence_path text,
  employee_note text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','needs_more_information')),
  hr_feedback text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  approved_learning_history_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index if not exists external_course_account_created_idx on public.external_course_submissions(account_id, created_at desc);
create index if not exists external_course_review_queue_idx on public.external_course_submissions(status, created_at desc);
create trigger external_course_submissions_updated_at before update on public.external_course_submissions
  for each row execute function set_updated_at();

create table if not exists public.learning_history (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.profiles(id) on delete restrict,
  source_type text not null check (source_type in ('course','training_session','external_course')),
  source_id uuid,
  title text not null,
  provider text,
  completed_at timestamptz not null,
  learning_hours numeric(8,2) not null check (learning_hours >= 0),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (source_type, source_id, account_id)
);
create index if not exists learning_history_account_completed_idx on public.learning_history(account_id, completed_at desc);

create table if not exists public.employee_certifications (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.profiles(id) on delete restrict,
  name text not null,
  certificate_type text not null,
  certificate_number text,
  issuer text not null,
  issue_date date not null,
  expiry_date date,
  evidence_path text,
  status text not null default 'valid' check (status in ('valid','expired','pending','revoked')),
  notes text,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expiry_date is null or expiry_date >= issue_date)
);
create index if not exists employee_cert_account_status_idx on public.employee_certifications(account_id, status);
create index if not exists employee_cert_expiry_idx on public.employee_certifications(expiry_date) where status = 'valid';
create trigger employee_certifications_updated_at before update on public.employee_certifications
  for each row execute function set_updated_at();

-- Multi-role helpers replace the single profiles.role check for new policies.
create or replace function public.has_role(required_role text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where account_id = auth.uid() and role = required_role);
$$;
create or replace function public.is_hr_or_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role('hr') or public.has_role('admin');
$$;

alter table public.user_roles enable row level security;
alter table public.external_course_submissions enable row level security;
alter table public.learning_history enable row level security;
alter table public.employee_certifications enable row level security;

create policy "user_roles_read_own_or_hr" on public.user_roles for select
  using (account_id = auth.uid() or public.is_hr_or_admin());
create policy "user_roles_manage_hr" on public.user_roles for all
  using (public.is_hr_or_admin()) with check (public.is_hr_or_admin());
create policy "external_course_read" on public.external_course_submissions for select
  using (account_id = auth.uid() or public.is_hr_or_admin());
create policy "external_course_create" on public.external_course_submissions for insert
  with check (account_id = auth.uid() and status = 'pending');
create policy "external_course_employee_update" on public.external_course_submissions for update
  using (account_id = auth.uid() and status = 'needs_more_information')
  with check (account_id = auth.uid() and status = 'pending');
create policy "external_course_hr_review" on public.external_course_submissions for update
  using (public.is_hr_or_admin()) with check (public.is_hr_or_admin());
create policy "learning_history_read" on public.learning_history for select
  using (account_id = auth.uid() or public.is_hr_or_admin());
create policy "certifications_read" on public.employee_certifications for select
  using (account_id = auth.uid() or public.is_hr_or_admin());
create policy "certifications_manage_hr" on public.employee_certifications for all
  using (public.is_hr_or_admin()) with check (public.is_hr_or_admin());

-- Storage buckets are private; clients obtain signed URLs through an authorized API.
insert into storage.buckets(id, name, public) values ('external-course-evidence','external-course-evidence',false)
on conflict (id) do nothing;
insert into storage.buckets(id, name, public) values ('employee-certifications','employee-certifications',false)
on conflict (id) do nothing;
