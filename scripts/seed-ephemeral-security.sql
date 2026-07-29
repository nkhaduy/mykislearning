-- SEC-002/SEC-004/SEC-011: synthetic-only seed for isolated runtime verification.
begin;

insert into public.profiles (
  id, employee_code, full_name, email, role, department, position,
  account_status, password_status, avatar_url, manager_name, location
) values
  ('synthetic-employee-a', 'SYN-EA', 'Synthetic Employee A', 'employee-a@example.invalid', 'employee', 'Engineering', 'Analyst', 'active', 'normal', '__pwd__:reset:pbkdf2-sha256$100000$c3ludGhldGljLXNhbHQ=$c3ludGhldGljLWhhc2g=', 'Synthetic Manager', 'Local'),
  ('synthetic-employee-b', 'SYN-EB', 'Synthetic Employee B', 'employee-b@example.invalid', 'employee', 'Operations', 'Analyst', 'active', 'normal', null, 'Synthetic Manager', 'Local'),
  ('synthetic-hr-a', 'SYN-HRA', 'Synthetic HR A', 'hr-a@example.invalid', 'hr', 'Human Resources', 'HR Specialist', 'active', 'normal', '__pwd__:pbkdf2-sha256$100000$c3ludGhldGljLXNhbHQ=$c3ludGhldGljLWhhc2g=', null, 'Local'),
  ('synthetic-hr-b', 'SYN-HRB', 'Synthetic HR B', 'hr-b@example.invalid', 'hr', 'Human Resources', 'HR Specialist', 'active', 'normal', '__pwd__:pbkdf2-sha256$100000$c3ludGhldGljLXNhbHQ=$c3ludGhldGljLWhhc2g=', null, 'Local')
on conflict (id) do update set
  employee_code = excluded.employee_code,
  full_name = excluded.full_name,
  email = excluded.email,
  role = excluded.role,
  department = excluded.department,
  position = excluded.position,
  account_status = excluded.account_status,
  password_status = excluded.password_status,
  avatar_url = excluded.avatar_url,
  manager_name = excluded.manager_name,
  location = excluded.location;

insert into public.courses (id, status, delivery_mode, created_by, data)
values (
  'synthetic-course-security', 'published', 'online', 'synthetic-hr-a',
  '{"title":"Synthetic Security Course","visibility":"private","owner":"synthetic-hr-a"}'::jsonb
)
on conflict (id) do update set data = excluded.data, updated_at = now();

insert into public.course_versions (
  id, course_id, version_number, status, title, description, content_snapshot,
  duration_minutes, delivery_mode, change_type, change_summary, created_by, published_by, published_at
) values (
  'synthetic-course-version-1', 'synthetic-course-security', 1, 'published',
  'Synthetic Security Course', 'Synthetic content only',
  '[{"id":"synthetic-content-1","type":"text"}]'::jsonb,
  30, 'online', 'major', 'Synthetic baseline version',
  'synthetic-hr-a', 'synthetic-hr-a', now()
)
on conflict (id) do update set title = excluded.title, updated_at = now();

update public.courses
set current_version_id = 'synthetic-course-version-1'
where id = 'synthetic-course-security';

insert into public.course_content (id, course_id, type, sort_order, data)
values (
  'synthetic-content-1', 'synthetic-course-security', 'text', 1,
  '{"title":"Synthetic private lesson","body":"No production content"}'::jsonb
)
on conflict (id) do update set data = excluded.data, updated_at = now();

insert into public.enrollments (id, course_id, account_id, status, data, course_version_id)
values
  ('synthetic-enrollment-a', 'synthetic-course-security', 'synthetic-employee-a', 'inProgress', '{"assignedBy":"synthetic-hr-a"}'::jsonb, 'synthetic-course-version-1'),
  ('synthetic-enrollment-b', 'synthetic-course-security', 'synthetic-employee-b', 'notStarted', '{"assignedBy":"synthetic-hr-a"}'::jsonb, 'synthetic-course-version-1')
on conflict (id) do update set status = excluded.status, data = excluded.data, updated_at = now();

insert into public.content_progress (id, content_id, account_id, course_id, data)
values
  ('synthetic-progress-a', 'synthetic-content-1', 'synthetic-employee-a', 'synthetic-course-security', '{"completionPercent":50}'::jsonb),
  ('synthetic-progress-b', 'synthetic-content-1', 'synthetic-employee-b', 'synthetic-course-security', '{"completionPercent":10}'::jsonb)
on conflict (id) do update set data = excluded.data, updated_at = now();

insert into public.learning_records (
  id, account_id, record_type, source_type, source_id, title, provider,
  duration_hours, status, submitted_by, created_by_role, data
) values
  ('synthetic-learning-record-a', 'synthetic-employee-a', 'internal_online_course', 'system', 'synthetic-enrollment-a', 'Synthetic record A', 'Local', 0.5, 'approved', 'synthetic-employee-a', 'employee', '{"scope":"employee-a"}'::jsonb),
  ('synthetic-learning-record-b', 'synthetic-employee-b', 'internal_online_course', 'system', 'synthetic-enrollment-b', 'Synthetic record B', 'Local', 0.1, 'submitted', 'synthetic-employee-b', 'employee', '{"scope":"employee-b"}'::jsonb)
on conflict (id) do update set status = excluded.status, data = excluded.data, updated_at = now();

insert into public.learning_record_attachments (
  id, learning_record_id, file_name, storage_path, mime_type, file_size, uploaded_by
) values
  ('synthetic-attachment-a', 'synthetic-learning-record-a', 'synthetic-a.txt', 'synthetic/employee-a/record.txt', 'text/plain', 24, 'synthetic-employee-a'),
  ('synthetic-attachment-b', 'synthetic-learning-record-b', 'synthetic-b.txt', 'synthetic/employee-b/record.txt', 'text/plain', 24, 'synthetic-employee-b')
on conflict (id) do update set storage_path = excluded.storage_path;

insert into public.external_training_requests (
  id, account_id, course_name, provider, learning_content, study_time, cost, status
) values
  ('00000000-0000-0000-0000-0000000000a1', 'synthetic-employee-a', 'Synthetic External A', 'Local Provider', 'Synthetic content', '1 hour', 0, 'pending'),
  ('00000000-0000-0000-0000-0000000000b1', 'synthetic-employee-b', 'Synthetic External B', 'Local Provider', 'Synthetic content', '1 hour', 0, 'pending')
on conflict (id) do update set status = excluded.status, updated_at = now();

insert into public.notifications (id, account_id, type, title, body, link, created_by, data)
values
  ('synthetic-notification-a', 'synthetic-employee-a', 'assignment', 'Synthetic notification A', 'Private A', '/dashboard/courses/synthetic-course-security', 'synthetic-hr-a', '{"scope":"employee-a"}'::jsonb),
  ('synthetic-notification-b', 'synthetic-employee-b', 'assignment', 'Synthetic notification B', 'Private B', '/dashboard/courses/synthetic-course-security', 'synthetic-hr-a', '{"scope":"employee-b"}'::jsonb)
on conflict (id) do update set body = excluded.body, data = excluded.data, updated_at = now();

insert into public.training_sessions (
  id, course_id, status, start_at, end_at, location_lat, location_lng,
  location_radius_m, created_by, data
) values (
  'synthetic-session-1', 'synthetic-course-security', 'scheduled',
  now() + interval '1 day', now() + interval '1 day 1 hour',
  10.7769, 106.7009, 100, 'synthetic-hr-a',
  '{"title":"Synthetic private training","visibility":"private"}'::jsonb
)
on conflict (id) do update set data = excluded.data, updated_at = now();

insert into public.session_slots (id, session_id, data)
values ('synthetic-slot-1', 'synthetic-session-1', '{"label":"Synthetic slot"}'::jsonb)
on conflict (id) do update set data = excluded.data, updated_at = now();

insert into public.attendance (
  id, slot_id, account_id, check_in_at, inside_geofence, distance_meters, status, data
) values
  ('synthetic-attendance-a', 'synthetic-slot-1', 'synthetic-employee-a', now(), true, 10, 'present', '{"scope":"employee-a"}'::jsonb),
  ('synthetic-attendance-b', 'synthetic-slot-1', 'synthetic-employee-b', now(), true, 12, 'present', '{"scope":"employee-b"}'::jsonb)
on conflict (id) do update set data = excluded.data, updated_at = now();

insert into public.employee_certifications (
  id, account_id, name, certificate_type, certificate_number, issuer,
  issue_date, expiry_date, status, verification_status, source_type, data
) values
  ('00000000-0000-0000-0000-0000000000a2', 'synthetic-employee-a', 'Synthetic Certificate A', 'internal', 'SYN-A', 'Local', current_date, current_date + 365, 'valid', 'approved', 'hr_entry', '{"scope":"employee-a"}'::jsonb),
  ('00000000-0000-0000-0000-0000000000b2', 'synthetic-employee-b', 'Synthetic Certificate B', 'internal', 'SYN-B', 'Local', current_date, current_date + 365, 'valid', 'approved', 'hr_entry', '{"scope":"employee-b"}'::jsonb)
on conflict (id) do update set data = excluded.data, updated_at = now();

insert into public.compliance_programs (
  id, code, title, status, resource_type, resource_id, recurrence_type,
  default_duration_days, default_pass_score, default_max_attempts, created_by, data
) values (
  'synthetic-compliance-program', 'SYN-COMP', 'Synthetic Compliance Program',
  'published', 'course', 'synthetic-course-security', 'annual', 30, 80, 3,
  'synthetic-hr-a', '{"synthetic":true}'::jsonb
)
on conflict (id) do update set data = excluded.data, updated_at = now();

insert into public.compliance_cycles (
  id, program_id, cycle_code, title, status, start_at, due_at,
  resource_type, resource_id, pass_score, max_attempts, created_by, data
) values (
  'synthetic-compliance-cycle', 'synthetic-compliance-program', 'SYN-2026',
  'Synthetic Compliance Cycle', 'active', now(), now() + interval '30 days',
  'course', 'synthetic-course-security', 80, 3, 'synthetic-hr-a', '{"synthetic":true}'::jsonb
)
on conflict (id) do update set data = excluded.data, updated_at = now();

insert into public.compliance_assignments (
  id, cycle_id, employee_id, assignment_source, start_at, due_at, status, data
) values
  ('synthetic-compliance-a', 'synthetic-compliance-cycle', 'synthetic-employee-a', 'manual', now(), now() + interval '30 days', 'in_progress', '{"scope":"employee-a"}'::jsonb),
  ('synthetic-compliance-b', 'synthetic-compliance-cycle', 'synthetic-employee-b', 'manual', now(), now() + interval '30 days', 'not_started', '{"scope":"employee-b"}'::jsonb)
on conflict (id) do update set status = excluded.status, data = excluded.data, updated_at = now();

insert into public.development_plans (
  id, employee_id, title, description, status, start_at, target_end_at, created_by
) values
  ('synthetic-plan-a', 'synthetic-employee-a', 'Synthetic Plan A', 'Private A', 'active', now(), now() + interval '90 days', 'synthetic-hr-a'),
  ('synthetic-plan-b', 'synthetic-employee-b', 'Synthetic Plan B', 'Private B', 'active', now(), now() + interval '90 days', 'synthetic-hr-a')
on conflict (id) do update set description = excluded.description, updated_at = now();

insert into public.audit_logs (
  id, actor_id, action, target_type, target_id, result, details,
  actor_type, actor_user_id, actor_role, category, severity, source, status, metadata
) values (
  'synthetic-audit-1', 'synthetic-hr-b', 'synthetic.seed', 'database', 'ephemeral',
  'success', '{"synthetic":true}'::jsonb, 'user', 'synthetic-hr-b', 'hr',
  'security', 'info', 'migration', 'success', '{"containsProductionData":false}'::jsonb
)
on conflict (id) do update set occurred_at = now(), metadata = excluded.metadata;

commit;
