begin;

-- Legacy production enrollments may not have created_at. The overview only
-- needs updated_at for its bounded reporting window, so keep the RPC additive
-- and compatible instead of mutating production data to add a synthetic value.
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
    select e.id, e.account_id, e.course_id, e.status, e.updated_at,
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

notify pgrst, 'reload config';

commit;
