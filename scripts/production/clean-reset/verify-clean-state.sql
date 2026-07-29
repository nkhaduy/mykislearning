\set ON_ERROR_STOP on

do $$
declare
  bootstrap_id text := current_setting('kis.clean_reset.bootstrap_hr_id', true);
  nonempty text[];
begin
  if current_setting('kis.clean_reset.target', true) <> 'disposable' then
    raise exception 'clean-state verification requires target=disposable';
  end if;
  if bootstrap_id is null or bootstrap_id = '' then raise exception 'bootstrap HR id is required'; end if;
  if (select count(*) from public.profiles) <> 1
     or not exists (select 1 from public.profiles where id = bootstrap_id and role = 'hr') then
    raise exception 'clean state must retain exactly one bootstrap HR';
  end if;

  select array_agg(name order by name) into nonempty from (values
    ('course_versions', (select count(*) from public.course_versions)),
    ('courses', (select count(*) from public.courses)),
    ('enrollments', (select count(*) from public.enrollments)),
    ('content_progress', (select count(*) from public.content_progress)),
    ('quiz_attempts', (select count(*) from public.quiz_attempts)),
    ('notifications', (select count(*) from public.notifications)),
    ('training_registrations', (select count(*) from public.training_registrations)),
    ('employee_certifications', (select count(*) from public.employee_certifications)),
    ('export_jobs', case when to_regclass('private.export_jobs') is null then 0 else (xpath('/row/c/text()', query_to_xml('select count(*) c from private.export_jobs', false, true, '')))[1]::text::bigint end),
    ('auth_sessions', case when to_regclass('private.auth_sessions') is null then 0 else (xpath('/row/c/text()', query_to_xml('select count(*) c from private.auth_sessions', false, true, '')))[1]::text::bigint end)
  ) counts(name, row_count) where row_count <> 0;
  if nonempty is not null then raise exception 'purge tables are not empty: %', nonempty; end if;
end $$;

select jsonb_build_object(
  'orphan_course_versions', (select count(*) from public.course_versions cv left join public.courses c on c.id=cv.course_id where c.id is null),
  'duplicate_normalized_emails', (select count(*) from (select lower(btrim(email)) from public.profiles group by 1 having count(*) > 1) duplicate_groups),
  'duplicate_normalized_employee_codes', (select count(*) from (select lower(btrim(employee_code)) from public.profiles where nullif(btrim(employee_code),'') is not null group by 1 having count(*) > 1) duplicate_groups),
  'invalid_foreign_key_rows', (select count(*) from pg_constraint where contype='f' and connamespace='public'::regnamespace and not convalidated),
  'bootstrap_hrs', (select count(*) from public.profiles where id=current_setting('kis.clean_reset.bootstrap_hr_id') and role='hr')
) as clean_state;
