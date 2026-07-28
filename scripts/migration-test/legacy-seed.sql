insert into auth.users(id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222'),
  ('33333333-3333-3333-3333-333333333333');

insert into public.departments(id, name, code)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Legacy Department', 'LEG');

insert into public.profiles(id, employee_code, full_name, email, role, department_id, position)
values
  ('11111111-1111-1111-1111-111111111111', 'LEG-E-001', 'Legacy Employee', 'legacy.employee@example.test', 'employee', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Analyst'),
  ('22222222-2222-2222-2222-222222222222', 'LEG-H-001', 'Legacy HR', 'legacy.hr@example.test', 'hr', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'HR'),
  ('33333333-3333-3333-3333-333333333333', 'LEG-A-001', 'Legacy Admin', 'legacy.admin@example.test', 'admin', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Admin');

insert into public.courses(id, title, description, status, format, created_by)
values (
  '44444444-4444-4444-4444-444444444444', 'Legacy Course',
  'Legacy description', 'published', 'online', '22222222-2222-2222-2222-222222222222'
);

insert into public.course_contents(id, course_id, title, type, sort_order)
values (
  '55555555-5555-5555-5555-555555555555',
  '44444444-4444-4444-4444-444444444444', 'Legacy Lesson', 'text', 1
);

insert into public.course_assignments(id, course_id, account_id, assigned_by, status, deadline)
values (
  '66666666-6666-6666-6666-666666666666',
  '44444444-4444-4444-4444-444444444444',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222', 'inProgress', '2026-08-15'
);

insert into public.lesson_progress(
  id, account_id, course_id, content_id, completed, completion_percent, viewed_seconds, metadata
)
values (
  '67676767-6767-6767-6767-676767676767',
  '11111111-1111-1111-1111-111111111111',
  '44444444-4444-4444-4444-444444444444',
  '55555555-5555-5555-5555-555555555555', true, 100, 900, '{"legacy":true}'
);

insert into public.training_sessions(
  id, title, course_id, trainer_id, start_at, end_at, status, created_by
)
values (
  '88888888-8888-8888-8888-888888888888', 'Legacy Training',
  '44444444-4444-4444-4444-444444444444',
  '22222222-2222-2222-2222-222222222222',
  '2026-07-20T09:00:00Z', '2026-07-20T11:00:00Z', 'completed',
  '22222222-2222-2222-2222-222222222222'
);

insert into public.session_participants(id, session_id, account_id, invited_by)
values (
  '89898989-8989-8989-8989-898989898989',
  '88888888-8888-8888-8888-888888888888',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222'
);

insert into public.quizzes(id, course_id, title, status, created_by)
values (
  '99999999-9999-9999-9999-999999999999',
  '44444444-4444-4444-4444-444444444444', 'Legacy Quiz', 'published',
  '22222222-2222-2222-2222-222222222222'
);

insert into public.questions(id, quiz_id, text, type, points, sort_order)
values (
  '91919191-9191-9191-9191-919191919191',
  '99999999-9999-9999-9999-999999999999', 'Legacy question?', 'trueFalse', 1, 1
);

insert into public.question_options(id, question_id, text, is_correct, sort_order)
values
  ('92929292-9292-9292-9292-929292929292', '91919191-9191-9191-9191-919191919191', 'True', true, 1),
  ('93939393-9393-9393-9393-939393939393', '91919191-9191-9191-9191-919191919191', 'False', false, 2);

insert into public.quiz_attempts(
  id, quiz_id, course_id, account_id, submitted_at, score_percent, passed
)
values (
  '94949494-9494-9494-9494-949494949494',
  '99999999-9999-9999-9999-999999999999',
  '44444444-4444-4444-4444-444444444444',
  '11111111-1111-1111-1111-111111111111', '2026-07-20T10:30:00Z', 100, true
);

insert into public.learning_history(
  id, account_id, source_type, source_id, title, provider, completed_at, learning_hours, metadata
)
values (
  '77777777-7777-7777-7777-777777777777',
  '11111111-1111-1111-1111-111111111111', 'course',
  '44444444-4444-4444-4444-444444444444', 'Legacy Completion',
  'KIS', '2026-07-20T11:00:00Z', 4.5, '{"legacy":true}'
);

insert into public.external_course_submissions(
  id, account_id, course_name, provider, learning_content, subject,
  start_date, end_date, learning_hours, cost, status, reviewed_by, reviewed_at
)
values (
  '96969696-9696-9696-9696-969696969696',
  '11111111-1111-1111-1111-111111111111', 'Legacy External Course',
  'Synthetic Provider', 'External learning content', 'Operations',
  '2026-07-01', '2026-07-02', 8, 1000000, 'approved',
  '22222222-2222-2222-2222-222222222222', '2026-07-03T09:00:00Z'
);
