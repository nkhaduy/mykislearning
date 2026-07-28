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
  ('bbbbbbbb-0000-0000-0000-000000000001', 'UUID Department', 'UUID-DEPT');

insert into public.profiles(
  id, employee_code, full_name, email, role, department, department_id,
  position, account_status, password_status
)
values (
  'conflict-employee', 'CON-E-001', 'Conflict Employee',
  'conflict.employee@example.test', 'employee', 'Different Text Department',
  'bbbbbbbb-0000-0000-0000-000000000001', 'Analyst', 'active', 'normal'
);
