select jsonb_pretty(jsonb_build_object(
  'captured_at', now(),
  'synthetic_counts', jsonb_build_object(
    'profiles', (select count(*) from public.profiles where id like 'synthetic-%'),
    'courses', (select count(*) from public.courses where id like 'synthetic-%'),
    'course_content', (select count(*) from public.course_content where id like 'synthetic-%'),
    'enrollments', (select count(*) from public.enrollments where id like 'synthetic-%'),
    'content_progress', (select count(*) from public.content_progress where id like 'synthetic-%'),
    'learning_records', (select count(*) from public.learning_records where id like 'synthetic-%'),
    'learning_record_attachments', (select count(*) from public.learning_record_attachments where id like 'synthetic-%'),
    'external_training_requests', (select count(*) from public.external_training_requests where id::text in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1')),
    'notifications', (select count(*) from public.notifications where id like 'synthetic-%'),
    'training_sessions', (select count(*) from public.training_sessions where id like 'synthetic-%'),
    'attendance', (select count(*) from public.attendance where id like 'synthetic-%'),
    'employee_certifications', (select count(*) from public.employee_certifications where id::text in ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b2')),
    'compliance_assignments', (select count(*) from public.compliance_assignments where id like 'synthetic-%'),
    'development_plans', (select count(*) from public.development_plans where id like 'synthetic-%'),
    'audit_logs', (select count(*) from public.audit_logs where id like 'synthetic-%')
  ),
  'required_models', jsonb_build_object(
    'user_roles', to_regclass('public.user_roles') is not null,
    'course_assignments', to_regclass('public.course_assignments') is not null,
    'lesson_progress', to_regclass('public.lesson_progress') is not null,
    'content_versions', to_regclass('public.content_versions') is not null,
    'file_uploads', to_regclass('public.file_uploads') is not null
  ),
  'legacy_marker_rows', (select count(*) from public.profiles where left(avatar_url, length('__pwd__:')) = '__pwd__:'),
  'legacy_status_hash_rows', (select count(*) from public.profiles where password_status like 'pbkdf2$%' or password_status like 'pbkdf2-sha256$%' or password_status like 'reset:pbkdf2$%' or password_status like 'reset:pbkdf2-sha256$%')
));
