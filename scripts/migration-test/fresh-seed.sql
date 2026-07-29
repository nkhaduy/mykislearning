insert into public.departments(name, code)
values ('Synthetic Engineering', 'SYN-ENG'), ('Synthetic HR', 'SYN-HR')
on conflict (name) do nothing;

insert into public.profiles(
  id, employee_code, full_name, email, role, department, department_id,
  position, account_status, password_status
)
select
  source.id,
  source.employee_code,
  source.full_name,
  source.email,
  source.role,
  department.name,
  department.id,
  source.position,
  'active',
  'normal'
from (values
  ('synthetic-employee', 'SYN-E-001', 'Synthetic Employee', 'employee@example.test', 'employee', 'Synthetic Engineering', 'Analyst'),
  ('synthetic-hr-a', 'SYN-H-001', 'Synthetic HR A', 'hr-a@example.test', 'hr', 'Synthetic HR', 'HR'),
  ('synthetic-hr-b', 'SYN-H-002', 'Synthetic HR B', 'hr-b@example.test', 'hr', 'Synthetic HR', 'HR'),
  ('local-development-hr', 'LOCAL-HR', 'Local Development HR', 'local-hr@example.test', 'hr', 'Synthetic HR', 'HR')
) source(id, employee_code, full_name, email, role, department_name, position)
join public.departments department on department.name = source.department_name
on conflict (id) do nothing;

insert into public.courses(id, status, delivery_mode, created_by, data)
values ('synthetic-course', 'published', 'online', 'synthetic-hr-a', '{"title":"Synthetic Course"}')
on conflict (id) do nothing;

insert into public.enrollments(id, course_id, account_id, status, data)
values ('synthetic-enrollment', 'synthetic-course', 'synthetic-employee', 'inProgress', '{}')
on conflict (id) do nothing;

insert into public.learning_records(
  id, account_id, record_type, source_type, source_id, title, duration_hours, status
)
values (
  'synthetic-learning-record', 'synthetic-employee', 'internal_online_course',
  'system', 'synthetic-course', 'Synthetic Course', 1, 'approved'
)
on conflict (id) do nothing;

insert into private.account_credentials(profile_id, password_hash, must_change)
values ('local-development-hr', 'pbkdf2$synthetic-test-only', false)
on conflict (profile_id) do update set password_hash = excluded.password_hash;
