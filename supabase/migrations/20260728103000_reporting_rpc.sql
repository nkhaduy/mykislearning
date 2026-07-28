begin;

create index if not exists enrollments_report_account_updated_idx
  on public.enrollments(account_id, updated_at, id) include (course_id, status);
create index if not exists enrollments_report_course_updated_idx
  on public.enrollments(course_id, updated_at, id) include (account_id, status);
create index if not exists attendance_report_account_updated_idx
  on public.attendance(account_id, updated_at, id) include (slot_id, status, check_in_at, check_out_at);
create index if not exists quiz_attempts_report_submitted_idx
  on public.quiz_attempts(submitted_at, id) include (account_id, quiz_id, course_id, score_percent, passed);
create index if not exists learning_records_report_created_idx
  on public.learning_records(created_at, id) include (account_id, status, record_type, completion_date, duration_hours);
create index if not exists employee_certifications_report_expiry_idx
  on public.employee_certifications(expiry_date, id) include (account_id, status, verification_status, certificate_type_id);
create index if not exists compliance_assignments_report_due_idx
  on public.compliance_assignments(due_at, id) include (employee_id, cycle_id, status, progress_percent, completed_at);
create index if not exists training_sessions_report_start_idx
  on public.training_sessions(start_at, id) include (course_id, status, end_at);

create or replace function public.service_report_pre_request()
returns void language plpgsql security definer set search_path = '' as $$
declare v_path text := coalesce(pg_catalog.current_setting('request.path', true), '');
begin
  if v_path like '%/rpc/service_report_timeout_probe' then
    perform pg_catalog.set_config('statement_timeout', '100ms', true);
  elsif v_path like '%/rpc/service_report_detail_export' then
    perform pg_catalog.set_config('statement_timeout', '15000ms', true);
  elsif v_path like '%/rpc/service_report_detail' then
    perform pg_catalog.set_config('statement_timeout', '5000ms', true);
  elsif v_path like '%/rpc/service_report_overview' then
    perform pg_catalog.set_config('statement_timeout', '8000ms', true);
  end if;
end;
$$;

do $$
begin
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'authenticator') then
    execute 'alter role authenticator set pgrst.db_pre_request = ''public.service_report_pre_request''';
  end if;
end;
$$;

create or replace function public.service_report_overview(
  p_from timestamptz,
  p_to timestamptz,
  p_department text default '',
  p_job_title text default '',
  p_course_id text default '',
  p_status text default '',
  p_search text default '',
  p_group_limit integer default 100,
  p_timeout_ms integer default 8000
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if p_from is null or p_to is null or p_from >= p_to or p_to - p_from > interval '366 days' then
    raise exception 'REPORT_RANGE_INVALID' using errcode = '22023';
  end if;

  with employee_scope as materialized (
    select p.id, p.department, p.position, p.account_status
    from public.profiles p
    where p.role = 'employee'
      and p.account_status <> 'disabled'
      and (p.notes is null or p.notes not ilike '%"soft_deleted":true%')
      and (coalesce(p_department, '') = '' or p.department = p_department)
      and (coalesce(p_job_title, '') = '' or p.position = p_job_title)
      and (
        coalesce(p_search, '') = ''
        or coalesce(p.employee_search_document, public.kis_profile_search_document(p.employee_code,p.full_name,p.email,p.department,p.position,p.location,p.manager_name)) like '%' || public.kis_search_normalize(p_search) || '%'
      )
  ), assignment_scope as materialized (
    select e.id, e.account_id, e.course_id, e.status, e.created_at, e.updated_at,
      case when (e.data->>'deadline') ~ '^\d{4}-\d{2}-\d{2}$' then (e.data->>'deadline')::date else null end as due_date,
      coalesce(nullif(e.data->>'completedAt', '')::timestamptz, case when e.status = 'completed' then e.updated_at end) as completed_at
    from public.enrollments e
    join employee_scope p on p.id::text = e.account_id::text
    where (coalesce(p_course_id, '') = '' or e.course_id::text = p_course_id)
      and (coalesce(p_status, '') = '' or e.status = p_status)
      and e.updated_at >= p_from and e.updated_at < p_to
  ), metrics as (
    select
      (select count(*) from employee_scope) as total_employees,
      count(*) as total_assignments,
      count(*) filter (where status = 'completed') as total_completions,
      count(distinct account_id) filter (where updated_at >= p_from and updated_at < p_to) as active_learners,
      count(distinct account_id) filter (where due_date < (current_timestamp at time zone 'Asia/Ho_Chi_Minh')::date and status not in ('completed','cancelled','exempted')) as overdue_learners,
      count(*) filter (where due_date < (current_timestamp at time zone 'Asia/Ho_Chi_Minh')::date and status not in ('completed','cancelled','exempted')) as overdue_assignments,
      count(*) filter (where completed_at is not null and due_date is not null and completed_at <= (due_date + 1)::timestamptz) as on_time_completions,
      count(*) filter (where due_date is not null) as deadline_assignments
    from assignment_scope
  ), department_rows as (
    select coalesce(p.department, 'Chưa cập nhật') as department,
      count(distinct p.id) as total_employees,
      count(a.id) as assigned,
      count(a.id) filter (where a.status = 'completed') as completed,
      count(a.id) filter (where a.due_date < (current_timestamp at time zone 'Asia/Ho_Chi_Minh')::date and a.status not in ('completed','cancelled','exempted')) as overdue,
      case when count(a.id) = 0 then null else round(count(a.id) filter (where a.status = 'completed')::numeric * 100 / count(a.id), 1) end as completion_rate
    from employee_scope p
    left join assignment_scope a on a.account_id::text = p.id::text
    group by coalesce(p.department, 'Chưa cập nhật')
    order by count(a.id) desc, department
    limit least(500, greatest(1, p_group_limit))
  ), trend_rows as (
    select (completed_at at time zone 'Asia/Ho_Chi_Minh')::date as date, count(*) as completions
    from assignment_scope
    where status = 'completed' and completed_at is not null
    group by 1 order by 1
  )
  select jsonb_build_object(
    'metrics', jsonb_build_object(
      'totalEmployees', m.total_employees,
      'activeEmployees', (select count(*) from employee_scope where account_status = 'active'),
      'inactiveEmployees', (select count(*) from employee_scope where account_status <> 'active'),
      'activeLearners', m.active_learners,
      'openCourses', (select count(*) from public.courses where status = 'published'),
      'completionRate', case when m.total_assignments = 0 then null else round(m.total_completions::numeric * 100 / m.total_assignments, 1) end,
      'onTimeCompletionRate', case when m.deadline_assignments = 0 then null else round(m.on_time_completions::numeric * 100 / m.deadline_assignments, 1) end,
      'totalCompletions', m.total_completions,
      'overdueLearners', m.overdue_learners,
      'overdueAssignments', m.overdue_assignments,
      'totalAssignments', m.total_assignments,
      'averageQuizScore', (select round(avg(qa.score_percent), 1) from public.quiz_attempts qa join employee_scope p on p.id::text = qa.account_id::text where coalesce(qa.submitted_at, qa.created_at) >= p_from and coalesce(qa.submitted_at, qa.created_at) < p_to),
      'trainingAttendance', (select count(*) filter (where a.status in ('present','attended','late')) from public.attendance a join employee_scope p on p.id::text = a.account_id::text where coalesce(a.check_in_at, a.updated_at) >= p_from and coalesce(a.check_in_at, a.updated_at) < p_to),
      'learningHours', (select coalesce(round(sum(lr.duration_hours), 2), 0) from public.learning_records lr join employee_scope p on p.id::text = lr.account_id::text where lr.created_at >= p_from and lr.created_at < p_to),
      'complianceCompleted', (select count(*) filter (where ca.status = 'completed') from public.compliance_assignments ca join employee_scope p on p.id::text = ca.employee_id::text where ca.updated_at >= p_from and ca.updated_at < p_to),
      'complianceOverdue', (select count(*) filter (where ca.due_at < current_timestamp and ca.status not in ('completed','cancelled','exempted')) from public.compliance_assignments ca join employee_scope p on p.id::text = ca.employee_id::text where ca.updated_at >= p_from and ca.updated_at < p_to),
      'certificatesValid', (select count(*) filter (where ec.status not in ('revoked','expired') and ec.verification_status in ('verified','approved') and (ec.expiry_date is null or ec.expiry_date >= current_date)) from public.employee_certifications ec join employee_scope p on p.id::text = ec.account_id::text),
      'certificatesExpired', (select count(*) filter (where ec.status = 'expired' or ec.expiry_date < current_date) from public.employee_certifications ec join employee_scope p on p.id::text = ec.account_id::text)
    ),
    'departmentComparison', coalesce((select jsonb_agg(to_jsonb(d) order by d.department) from department_rows d), '[]'::jsonb),
    'trend', coalesce((select jsonb_agg(to_jsonb(t) order by t.date) from trend_rows t), '[]'::jsonb)
  ) into v_result
  from metrics m;
  return coalesce(v_result, '{}'::jsonb);
end;
$$;

create or replace function public.service_report_detail(
  p_report_type text,
  p_from timestamptz,
  p_to timestamptz,
  p_department text default '',
  p_job_title text default '',
  p_employee_id text default '',
  p_course_id text default '',
  p_status text default '',
  p_search text default '',
  p_cursor_sort text default null,
  p_cursor_id text default null,
  p_sort_dir text default 'asc',
  p_limit integer default 51,
  p_timeout_ms integer default 5000
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(101, greatest(2, p_limit));
  v_rows jsonb := '[]'::jsonb;
  v_has_more boolean := false;
  v_next_sort text;
  v_next_id text;
begin
  if p_from is null or p_to is null or p_from >= p_to or p_to - p_from > interval '366 days' then
    raise exception 'REPORT_RANGE_INVALID' using errcode = '22023';
  end if;
  if p_sort_dir not in ('asc', 'desc') then raise exception 'INVALID_SORT_DIRECTION' using errcode = '22023'; end if;

  if p_report_type = 'employees' then
    with page as (
      select coalesce(p.employee_sort_name, public.kis_search_normalize(p.full_name)) as sort_key, p.id::text as row_id,
        jsonb_build_object(
          '_cursor_sort', coalesce(p.employee_sort_name, public.kis_search_normalize(p.full_name)), '_cursor_id', p.id::text,
          'employee', p.full_name, 'employeeId', p.id::text, 'employeeCode', p.employee_code,
          'department', p.department, 'jobTitle', p.position,
          'assigned', count(e.id), 'completed', count(e.id) filter (where e.status = 'completed'),
          'inProgress', count(e.id) filter (where e.status = 'inProgress'),
          'notStarted', count(e.id) filter (where e.status = 'notStarted'),
          'overdue', count(e.id) filter (where (e.data->>'deadline') ~ '^\d{4}-\d{2}-\d{2}$' and (e.data->>'deadline')::date < current_date and e.status not in ('completed','cancelled','exempted')),
          'completionRate', case when count(e.id) = 0 then null else round(count(e.id) filter (where e.status = 'completed')::numeric * 100 / count(e.id), 1) end,
          'lastActivityAt', max(e.updated_at)
        ) as row_json
      from public.profiles p
      left join public.enrollments e on e.account_id::text = p.id::text
        and e.updated_at >= p_from and e.updated_at < p_to
        and (coalesce(p_course_id, '') = '' or e.course_id::text = p_course_id)
        and (coalesce(p_status, '') = '' or e.status = p_status)
      where p.role = 'employee' and p.account_status <> 'disabled'
        and (p.notes is null or p.notes not ilike '%"soft_deleted":true%')
        and (coalesce(p_department, '') = '' or p.department = p_department)
        and (coalesce(p_job_title, '') = '' or p.position = p_job_title)
        and (coalesce(p_employee_id, '') = '' or p.id::text = p_employee_id)
        and (coalesce(p_search, '') = '' or coalesce(p.employee_search_document, public.kis_profile_search_document(p.employee_code,p.full_name,p.email,p.department,p.position,p.location,p.manager_name)) like '%' || public.kis_search_normalize(p_search) || '%')
        and (p_cursor_sort is null or (p_sort_dir = 'asc' and (coalesce(p.employee_sort_name, public.kis_search_normalize(p.full_name)), p.id::text) > (p_cursor_sort, p_cursor_id)) or (p_sort_dir = 'desc' and (coalesce(p.employee_sort_name, public.kis_search_normalize(p.full_name)), p.id::text) < (p_cursor_sort, p_cursor_id)))
      group by p.id, p.employee_sort_name, p.full_name, p.employee_code, p.department, p.position, p.email, p.location, p.manager_name
      order by case when p_sort_dir = 'asc' then coalesce(p.employee_sort_name, public.kis_search_normalize(p.full_name)) end asc, case when p_sort_dir = 'desc' then coalesce(p.employee_sort_name, public.kis_search_normalize(p.full_name)) end desc,
        case when p_sort_dir = 'asc' then p.id::text end asc, case when p_sort_dir = 'desc' then p.id::text end desc
      limit v_limit + 1
    ) select coalesce(jsonb_agg(row_json), '[]'::jsonb) into v_rows from page;
  elsif p_report_type in ('enrollments', 'completion', 'course-completion') then
    with page as (
      select coalesce(e.updated_at::text, e.id::text) as sort_key, e.id::text as row_id,
        jsonb_build_object('_cursor_sort', coalesce(e.updated_at::text, e.id::text), '_cursor_id', e.id::text,
          'id', e.id::text, 'employeeId', e.account_id::text, 'employee', p.full_name, 'employeeCode', p.employee_code,
          'department', p.department, 'courseId', e.course_id::text, 'course', coalesce(c.data->>'title', c.id::text),
          'status', e.status, 'progress', coalesce((e.data->>'progressPercent')::numeric, 0),
          'dueAt', e.data->>'deadline', 'updatedAt', e.updated_at) as row_json
      from public.enrollments e
      join public.profiles p on p.id::text = e.account_id::text
      join public.courses c on c.id::text = e.course_id::text
      where e.updated_at >= p_from and e.updated_at < p_to
        and (coalesce(p_department, '') = '' or p.department = p_department)
        and (coalesce(p_job_title, '') = '' or p.position = p_job_title)
        and (coalesce(p_employee_id, '') = '' or e.account_id::text = p_employee_id)
        and (coalesce(p_course_id, '') = '' or e.course_id::text = p_course_id)
        and (coalesce(p_status, '') = '' or e.status = p_status)
        and (coalesce(p_search, '') = '' or public.kis_search_normalize(p.full_name || ' ' || coalesce(c.data->>'title','')) like '%' || public.kis_search_normalize(p_search) || '%')
        and (p_cursor_sort is null or (p_sort_dir = 'asc' and (e.updated_at::text, e.id::text) > (p_cursor_sort, p_cursor_id)) or (p_sort_dir = 'desc' and (e.updated_at::text, e.id::text) < (p_cursor_sort, p_cursor_id)))
      order by case when p_sort_dir = 'asc' then e.updated_at end asc, case when p_sort_dir = 'desc' then e.updated_at end desc,
        case when p_sort_dir = 'asc' then e.id::text end asc, case when p_sort_dir = 'desc' then e.id::text end desc
      limit v_limit + 1
    ) select coalesce(jsonb_agg(row_json), '[]'::jsonb) into v_rows from page;
  elsif p_report_type in ('departments', 'courses') then
    with base as (
      select case when p_report_type = 'departments' then coalesce(p.department, 'Chưa cập nhật') else e.course_id::text end as group_id,
        case when p_report_type = 'departments' then coalesce(p.department, 'Chưa cập nhật') else coalesce(c.data->>'title', c.id::text) end as title,
        e.id, e.status, e.account_id, e.data
      from public.enrollments e join public.profiles p on p.id::text = e.account_id::text join public.courses c on c.id::text = e.course_id::text
      where e.updated_at >= p_from and e.updated_at < p_to
        and (coalesce(p_department, '') = '' or p.department = p_department)
        and (coalesce(p_course_id, '') = '' or e.course_id::text = p_course_id)
    ), page as (
      select public.kis_search_normalize(title) as sort_key, group_id as row_id,
        jsonb_build_object('_cursor_sort', public.kis_search_normalize(title), '_cursor_id', group_id,
          'id', group_id, 'title', title, 'assigned', count(*), 'employees', count(distinct account_id),
          'completed', count(*) filter (where status = 'completed'),
          'overdue', count(*) filter (where (data->>'deadline') ~ '^\d{4}-\d{2}-\d{2}$' and (data->>'deadline')::date < current_date and status not in ('completed','cancelled','exempted')),
          'completionRate', round(count(*) filter (where status = 'completed')::numeric * 100 / nullif(count(*),0), 1)) as row_json
      from base group by group_id, title
      having p_cursor_sort is null or (p_sort_dir = 'asc' and (public.kis_search_normalize(title), group_id) > (p_cursor_sort, p_cursor_id)) or (p_sort_dir = 'desc' and (public.kis_search_normalize(title), group_id) < (p_cursor_sort, p_cursor_id))
      order by case when p_sort_dir = 'asc' then public.kis_search_normalize(title) end asc, case when p_sort_dir = 'desc' then public.kis_search_normalize(title) end desc,
        case when p_sort_dir = 'asc' then group_id end asc, case when p_sort_dir = 'desc' then group_id end desc limit v_limit + 1
    ) select coalesce(jsonb_agg(row_json), '[]'::jsonb) into v_rows from page;
  elsif p_report_type in ('attendance', 'training-sessions') then
    with page as (
      select coalesce(s.start_at::text, a.updated_at::text) as sort_key, a.id::text as row_id,
        jsonb_build_object('_cursor_sort', coalesce(s.start_at::text, a.updated_at::text), '_cursor_id', a.id::text,
          'id', a.id::text, 'employeeId', a.account_id::text, 'employee', p.full_name, 'department', p.department,
          'sessionId', s.id::text, 'session', coalesce(s.data->>'title', s.id::text), 'status', a.status,
          'checkInAt', a.check_in_at, 'checkOutAt', a.check_out_at, 'startAt', s.start_at) as row_json
      from public.attendance a join public.session_slots sl on sl.id::text = a.slot_id::text
      join public.training_sessions s on s.id::text = sl.session_id::text
      join public.profiles p on p.id::text = a.account_id::text
      where coalesce(a.check_in_at, a.updated_at) >= p_from and coalesce(a.check_in_at, a.updated_at) < p_to
        and (coalesce(p_department, '') = '' or p.department = p_department)
        and (coalesce(p_employee_id, '') = '' or a.account_id::text = p_employee_id)
        and (coalesce(p_status, '') = '' or a.status = p_status)
        and (p_cursor_sort is null or (p_sort_dir = 'asc' and (coalesce(s.start_at::text,a.updated_at::text), a.id::text) > (p_cursor_sort,p_cursor_id)) or (p_sort_dir = 'desc' and (coalesce(s.start_at::text,a.updated_at::text), a.id::text) < (p_cursor_sort,p_cursor_id)))
      order by case when p_sort_dir='asc' then coalesce(s.start_at,a.updated_at) end asc, case when p_sort_dir='desc' then coalesce(s.start_at,a.updated_at) end desc,
        case when p_sort_dir='asc' then a.id::text end asc, case when p_sort_dir='desc' then a.id::text end desc limit v_limit + 1
    ) select coalesce(jsonb_agg(row_json), '[]'::jsonb) into v_rows from page;
  elsif p_report_type in ('quizzes', 'quiz-results') then
    with page as (
      select coalesce(qa.submitted_at, qa.created_at)::text as sort_key, qa.id::text as row_id,
        jsonb_build_object('_cursor_sort', coalesce(qa.submitted_at,qa.created_at)::text, '_cursor_id', qa.id::text,
          'id', qa.id::text, 'quizId', qa.quiz_id::text, 'quiz', coalesce(q.data->>'title', q.id::text),
          'employeeId', qa.account_id::text, 'employee', p.full_name, 'department', p.department,
          'score', qa.score_percent, 'passed', qa.passed, 'submittedAt', qa.submitted_at) as row_json
      from public.quiz_attempts qa join public.quizzes q on q.id::text = qa.quiz_id::text join public.profiles p on p.id::text = qa.account_id::text
      where coalesce(qa.submitted_at,qa.created_at) >= p_from and coalesce(qa.submitted_at,qa.created_at) < p_to
        and (coalesce(p_department,'')='' or p.department=p_department) and (coalesce(p_employee_id,'')='' or qa.account_id::text=p_employee_id)
        and (coalesce(p_course_id,'')='' or qa.course_id::text=p_course_id)
        and (p_cursor_sort is null or (p_sort_dir='asc' and (coalesce(qa.submitted_at,qa.created_at)::text,qa.id::text)>(p_cursor_sort,p_cursor_id)) or (p_sort_dir='desc' and (coalesce(qa.submitted_at,qa.created_at)::text,qa.id::text)<(p_cursor_sort,p_cursor_id)))
      order by case when p_sort_dir='asc' then coalesce(qa.submitted_at,qa.created_at) end asc, case when p_sort_dir='desc' then coalesce(qa.submitted_at,qa.created_at) end desc,
        case when p_sort_dir='asc' then qa.id::text end asc, case when p_sort_dir='desc' then qa.id::text end desc limit v_limit + 1
    ) select coalesce(jsonb_agg(row_json), '[]'::jsonb) into v_rows from page;
  elsif p_report_type = 'learning-records' then
    with page as (
      select lr.created_at::text as sort_key, lr.id::text as row_id,
        jsonb_build_object('_cursor_sort',lr.created_at::text,'_cursor_id',lr.id::text,'id',lr.id::text,'employeeId',lr.account_id::text,
          'employee',p.full_name,'department',p.department,'title',lr.title,'recordType',lr.record_type,'status',lr.status,
          'completionDate',lr.completion_date,'durationHours',lr.duration_hours,'createdAt',lr.created_at) as row_json
      from public.learning_records lr join public.profiles p on p.id::text=lr.account_id::text
      where lr.created_at>=p_from and lr.created_at<p_to and (coalesce(p_department,'')='' or p.department=p_department)
        and (coalesce(p_employee_id,'')='' or lr.account_id::text=p_employee_id) and (coalesce(p_status,'')='' or lr.status=p_status)
        and (p_cursor_sort is null or (p_sort_dir='asc' and (lr.created_at::text,lr.id::text)>(p_cursor_sort,p_cursor_id)) or (p_sort_dir='desc' and (lr.created_at::text,lr.id::text)<(p_cursor_sort,p_cursor_id)))
      order by case when p_sort_dir='asc' then lr.created_at end asc, case when p_sort_dir='desc' then lr.created_at end desc,
        case when p_sort_dir='asc' then lr.id::text end asc, case when p_sort_dir='desc' then lr.id::text end desc limit v_limit+1
    ) select coalesce(jsonb_agg(row_json),'[]'::jsonb) into v_rows from page;
  elsif p_report_type = 'certificates' then
    with page as (
      select coalesce(ec.expiry_date::text,ec.created_at::text) as sort_key, ec.id::text as row_id,
        jsonb_build_object('_cursor_sort',coalesce(ec.expiry_date::text,ec.created_at::text),'_cursor_id',ec.id::text,'id',ec.id::text,
          'employeeId',ec.account_id::text,'employee',p.full_name,'department',p.department,'certificateType',coalesce(ct.name,ec.certificate_type,ec.name),
          'status',ec.status,'verificationStatus',ec.verification_status,'issueDate',ec.issue_date,'expiresAt',ec.expiry_date) as row_json
      from public.employee_certifications ec join public.profiles p on p.id::text=ec.account_id::text
      left join public.certificate_types ct on ct.id::text=ec.certificate_type_id::text
      where ec.created_at>=p_from and ec.created_at<p_to and (coalesce(p_department,'')='' or p.department=p_department)
        and (coalesce(p_employee_id,'')='' or ec.account_id::text=p_employee_id) and (coalesce(p_status,'')='' or ec.status=p_status or ec.verification_status=p_status)
        and (p_cursor_sort is null or (p_sort_dir='asc' and (coalesce(ec.expiry_date::text,ec.created_at::text),ec.id::text)>(p_cursor_sort,p_cursor_id)) or (p_sort_dir='desc' and (coalesce(ec.expiry_date::text,ec.created_at::text),ec.id::text)<(p_cursor_sort,p_cursor_id)))
      order by case when p_sort_dir='asc' then coalesce(ec.expiry_date::timestamptz,ec.created_at) end asc, case when p_sort_dir='desc' then coalesce(ec.expiry_date::timestamptz,ec.created_at) end desc,
        case when p_sort_dir='asc' then ec.id::text end asc, case when p_sort_dir='desc' then ec.id::text end desc limit v_limit+1
    ) select coalesce(jsonb_agg(row_json),'[]'::jsonb) into v_rows from page;
  elsif p_report_type = 'compliance' then
    with page as (
      select ca.due_at::text as sort_key,ca.id::text as row_id,
        jsonb_build_object('_cursor_sort',ca.due_at::text,'_cursor_id',ca.id::text,'id',ca.id::text,'employeeId',ca.employee_id::text,
          'employee',p.full_name,'department',p.department,'cycleId',cc.id::text,'cycle',cc.title,'program',cp.title,
          'status',ca.status,'progress',ca.progress_percent,'dueAt',ca.due_at,'completedAt',ca.completed_at) as row_json
      from public.compliance_assignments ca join public.compliance_cycles cc on cc.id::text=ca.cycle_id::text
      join public.compliance_programs cp on cp.id::text=cc.program_id::text join public.profiles p on p.id::text=ca.employee_id::text
      where ca.updated_at>=p_from and ca.updated_at<p_to and (coalesce(p_department,'')='' or p.department=p_department)
        and (coalesce(p_employee_id,'')='' or ca.employee_id::text=p_employee_id) and (coalesce(p_status,'')='' or ca.status=p_status)
        and (p_cursor_sort is null or (p_sort_dir='asc' and (ca.due_at::text,ca.id::text)>(p_cursor_sort,p_cursor_id)) or (p_sort_dir='desc' and (ca.due_at::text,ca.id::text)<(p_cursor_sort,p_cursor_id)))
      order by case when p_sort_dir='asc' then ca.due_at end asc,case when p_sort_dir='desc' then ca.due_at end desc,
        case when p_sort_dir='asc' then ca.id::text end asc,case when p_sort_dir='desc' then ca.id::text end desc limit v_limit+1
    ) select coalesce(jsonb_agg(row_json),'[]'::jsonb) into v_rows from page;
  elsif p_report_type = 'learning-paths' then
    with page as (
      select lpa.updated_at::text as sort_key,lpa.id::text as row_id,
        jsonb_build_object('_cursor_sort',lpa.updated_at::text,'_cursor_id',lpa.id::text,'id',lpa.id::text,
          'learningPathId',lp.id::text,'learningPath',lp.title,'employeeId',lpa.employee_id::text,'employee',p.full_name,
          'department',p.department,'status',lpa.status,'progress',lpa.progress_percent,'dueAt',lpa.due_at,'completedAt',lpa.completed_at) as row_json
      from public.learning_path_assignments lpa join public.learning_paths lp on lp.id::text=lpa.learning_path_id::text
      join public.profiles p on p.id::text=lpa.employee_id::text
      where lpa.updated_at>=p_from and lpa.updated_at<p_to and (coalesce(p_department,'')='' or p.department=p_department)
        and (coalesce(p_employee_id,'')='' or lpa.employee_id::text=p_employee_id) and (coalesce(p_status,'')='' or lpa.status=p_status)
        and (p_cursor_sort is null or (p_sort_dir='asc' and (lpa.updated_at::text,lpa.id::text)>(p_cursor_sort,p_cursor_id)) or (p_sort_dir='desc' and (lpa.updated_at::text,lpa.id::text)<(p_cursor_sort,p_cursor_id)))
      order by case when p_sort_dir='asc' then lpa.updated_at end asc,case when p_sort_dir='desc' then lpa.updated_at end desc,
        case when p_sort_dir='asc' then lpa.id::text end asc,case when p_sort_dir='desc' then lpa.id::text end desc limit v_limit+1
    ) select coalesce(jsonb_agg(row_json),'[]'::jsonb) into v_rows from page;
  elsif p_report_type = 'competencies' then
    with page as (
      select eca.updated_at::text as sort_key,eca.id::text as row_id,
        jsonb_build_object('_cursor_sort',eca.updated_at::text,'_cursor_id',eca.id::text,'id',eca.id::text,
          'competencyId',c.id::text,'competency',c.name,'employeeId',eca.employee_id::text,'employee',p.full_name,
          'department',p.department,'assessmentType',eca.assessment_type,'status',eca.status,'assessmentDate',eca.assessment_date) as row_json
      from public.employee_competency_assessments eca join public.competencies c on c.id::text=eca.competency_id::text
      join public.profiles p on p.id::text=eca.employee_id::text
      where eca.updated_at>=p_from and eca.updated_at<p_to and (coalesce(p_department,'')='' or p.department=p_department)
        and (coalesce(p_employee_id,'')='' or eca.employee_id::text=p_employee_id) and (coalesce(p_status,'')='' or eca.status=p_status)
        and (p_cursor_sort is null or (p_sort_dir='asc' and (eca.updated_at::text,eca.id::text)>(p_cursor_sort,p_cursor_id)) or (p_sort_dir='desc' and (eca.updated_at::text,eca.id::text)<(p_cursor_sort,p_cursor_id)))
      order by case when p_sort_dir='asc' then eca.updated_at end asc,case when p_sort_dir='desc' then eca.updated_at end desc,
        case when p_sort_dir='asc' then eca.id::text end asc,case when p_sort_dir='desc' then eca.id::text end desc limit v_limit+1
    ) select coalesce(jsonb_agg(row_json),'[]'::jsonb) into v_rows from page;
  elsif p_report_type = 'development-plans' then
    with page as (
      select dp.updated_at::text as sort_key,dp.id::text as row_id,
        jsonb_build_object('_cursor_sort',dp.updated_at::text,'_cursor_id',dp.id::text,'id',dp.id::text,
          'employeeId',dp.employee_id::text,'employee',p.full_name,'department',p.department,'title',dp.title,
          'status',dp.status,'startAt',dp.start_at,'dueAt',dp.target_end_at,'completedAt',dp.completed_at) as row_json
      from public.development_plans dp join public.profiles p on p.id::text=dp.employee_id::text
      where dp.updated_at>=p_from and dp.updated_at<p_to and (coalesce(p_department,'')='' or p.department=p_department)
        and (coalesce(p_employee_id,'')='' or dp.employee_id::text=p_employee_id) and (coalesce(p_status,'')='' or dp.status=p_status)
        and (p_cursor_sort is null or (p_sort_dir='asc' and (dp.updated_at::text,dp.id::text)>(p_cursor_sort,p_cursor_id)) or (p_sort_dir='desc' and (dp.updated_at::text,dp.id::text)<(p_cursor_sort,p_cursor_id)))
      order by case when p_sort_dir='asc' then dp.updated_at end asc,case when p_sort_dir='desc' then dp.updated_at end desc,
        case when p_sort_dir='asc' then dp.id::text end asc,case when p_sort_dir='desc' then dp.id::text end desc limit v_limit+1
    ) select coalesce(jsonb_agg(row_json),'[]'::jsonb) into v_rows from page;
  else
    raise exception 'INVALID_REPORT_TYPE' using errcode = '22023';
  end if;

  v_has_more := jsonb_array_length(v_rows) > v_limit - 1;
  if v_has_more then
    v_next_sort := v_rows->(v_limit - 2)->>'_cursor_sort';
    v_next_id := v_rows->(v_limit - 2)->>'_cursor_id';
  end if;
  select coalesce(jsonb_agg(value - '_cursor_sort' - '_cursor_id' order by ordinal), '[]'::jsonb)
  into v_rows from jsonb_array_elements(v_rows) with ordinality as rows(value, ordinal)
  where ordinal <= v_limit - 1;
  return jsonb_build_object('rows',v_rows,'hasMore',v_has_more,'nextPosition',case when v_has_more then jsonb_build_object('sort',v_next_sort,'id',v_next_id) else null end);
end;
$$;

create or replace function public.service_report_detail_export(
  p_report_type text, p_from timestamptz, p_to timestamptz,
  p_department text default '', p_job_title text default '', p_employee_id text default '',
  p_course_id text default '', p_status text default '', p_search text default '',
  p_cursor_sort text default null, p_cursor_id text default null, p_sort_dir text default 'asc',
  p_limit integer default 501, p_timeout_ms integer default 15000
)
returns jsonb language sql stable security definer set search_path = '' as $$
  select public.service_report_detail(
    p_report_type,p_from,p_to,p_department,p_job_title,p_employee_id,p_course_id,p_status,p_search,
    p_cursor_sort,p_cursor_id,p_sort_dir,p_limit,p_timeout_ms
  );
$$;

create or replace function public.service_report_timeout_probe(p_sleep_seconds numeric default 1, p_timeout_ms integer default 100)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform pg_catalog.pg_sleep(least(5,greatest(0,p_sleep_seconds)));
  return true;
end;
$$;

revoke all on function public.service_report_pre_request() from public,anon,authenticated;
revoke all on function public.service_report_overview(timestamptz,timestamptz,text,text,text,text,text,integer,integer) from public,anon,authenticated;
revoke all on function public.service_report_detail(text,timestamptz,timestamptz,text,text,text,text,text,text,text,text,text,integer,integer) from public,anon,authenticated;
revoke all on function public.service_report_detail_export(text,timestamptz,timestamptz,text,text,text,text,text,text,text,text,text,integer,integer) from public,anon,authenticated;
revoke all on function public.service_report_timeout_probe(numeric,integer) from public,anon,authenticated;
grant execute on function public.service_report_pre_request() to anon,authenticated,service_role;
grant execute on function public.service_report_overview(timestamptz,timestamptz,text,text,text,text,text,integer,integer) to service_role;
grant execute on function public.service_report_detail(text,timestamptz,timestamptz,text,text,text,text,text,text,text,text,text,integer,integer) to service_role;
grant execute on function public.service_report_detail_export(text,timestamptz,timestamptz,text,text,text,text,text,text,text,text,text,integer,integer) to service_role;
grant execute on function public.service_report_timeout_probe(numeric,integer) to service_role;

notify pgrst, 'reload config';

commit;
