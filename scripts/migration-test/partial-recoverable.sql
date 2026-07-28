create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column department_id uuid;

insert into public.departments(id, name, code) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Partial Engineering', 'PART-ENG');

insert into public.profiles(
  id, employee_code, full_name, email, role, department, department_id,
  position, account_status, password_status
)
values
  ('partial-employee', 'PART-E-001', 'Partial Employee', 'partial.employee@example.test', 'employee', null, 'aaaaaaaa-0000-0000-0000-000000000001', 'Analyst', 'active', 'normal'),
  ('partial-hr', 'PART-H-001', 'Partial HR', 'partial.hr@example.test', 'hr', 'Partial HR', null, 'HR', 'active', 'normal'),
  ('partial-admin', 'PART-A-001', 'Partial Admin', 'partial.admin@example.test', 'admin', 'Partial Engineering', null, 'Admin', 'active', 'normal');

drop index if exists public.profiles_department_idx;
create index profiles_department_idx on public.profiles(department_id);

insert into public.courses(id, status, delivery_mode, created_by, data)
values ('partial-course', 'published', 'online', 'partial-hr', '{"title":"Partial Course"}');

insert into public.enrollments(id, course_id, account_id, status, data)
values ('partial-enrollment', 'partial-course', 'partial-employee', 'inProgress', '{}');
