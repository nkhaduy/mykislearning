\set ON_ERROR_STOP on

begin;
select pg_advisory_xact_lock(hashtextextended('kisvn-clean-reset-business-data-v1', 0));

do $$
declare
  target text := current_setting('kis.clean_reset.target', true);
  target_ref text := current_setting('kis.clean_reset.target_project_ref', true);
  production_ref text := current_setting('kis.clean_reset.production_project_ref', true);
  bootstrap_id text := current_setting('kis.clean_reset.bootstrap_hr_id', true);
  expected_checksum text := current_setting('kis.clean_reset.expected_schema_checksum', true);
  actual_checksum text;
begin
  if target <> 'disposable' then
    raise exception 'clean-reset purge requires target=disposable';
  end if;
  if target_ref is null or production_ref is null or target_ref = production_ref then
    raise exception 'clean-reset purge refuses the production project ref';
  end if;
  if bootstrap_id is null or bootstrap_id = '' then
    raise exception 'bootstrap HR id is required';
  end if;
  if not exists (select 1 from public.profiles where id = bootstrap_id and role in ('hr', 'admin')) then
    raise exception 'bootstrap HR identity is missing or has an unsupported role';
  end if;

  select encode(digest(coalesce(string_agg(item, E'\n' order by item), ''), 'sha256'), 'hex')
  into actual_checksum
  from (
    select format('table|%s|%s|%s', n.nspname, c.relname, c.relrowsecurity) item
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public','private') and c.relkind in ('r','p','v','m')
    union all
    select format('column|%s|%s|%s|%s|%s|%s', table_schema, table_name, ordinal_position, column_name, data_type, is_nullable)
    from information_schema.columns where table_schema in ('public','private')
    union all
    select format('constraint|%s|%s|%s', connamespace::regnamespace::text, conname, pg_get_constraintdef(oid, true))
    from pg_constraint where connamespace in ('public'::regnamespace, 'private'::regnamespace)
    union all
    select format('index|%s|%s|%s', schemaname, indexname, indexdef)
    from pg_indexes where schemaname in ('public','private')
    union all
    select format('policy|%s|%s|%s|%s|%s|%s', schemaname, tablename, policyname, cmd, coalesce(qual,''), coalesce(with_check,''))
    from pg_policies where schemaname in ('public','private')
    union all
    select format('function|%s|%s|%s', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid))
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public','private')
    union all
    select format('trigger|%s|%s|%s', n.nspname, c.relname, pg_get_triggerdef(t.oid, true))
    from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
    where not t.tgisinternal and n.nspname in ('public','private')
  ) catalog;

  if expected_checksum is null or expected_checksum !~ '^[a-f0-9]{64}$' then
    raise exception 'expected schema checksum is missing or invalid';
  end if;
  if actual_checksum <> expected_checksum then
    raise exception 'schema checksum mismatch: expected %, received %', expected_checksum, actual_checksum;
  end if;
end $$;

-- Preserve the owner-approved bootstrap identity while canonicalizing a
-- legacy Admin profile before the final two-role migration is replayed.
update public.profiles set role = 'hr', updated_at = now()
where id = current_setting('kis.clean_reset.bootstrap_hr_id') and role = 'admin';
do $$
begin
  if to_regclass('public.user_roles') is not null then
    delete from public.user_roles legacy
    where legacy.account_id = current_setting('kis.clean_reset.bootstrap_hr_id')
      and legacy.role = 'admin'
      and exists (
        select 1 from public.user_roles canonical
        where canonical.account_id = legacy.account_id and canonical.role = 'hr'
      );
    update public.user_roles set role = 'hr'
    where account_id = current_setting('kis.clean_reset.bootstrap_hr_id') and role = 'admin';
  end if;
end $$;

-- Counts are emitted before and after the allowlisted deletes; values are aggregate-only.
select 'before_purge' as phase, 'profiles' as table_name, count(*)::bigint as row_count from public.profiles
union all select 'before_purge', 'course_versions', count(*) from public.course_versions
union all select 'before_purge', 'courses', count(*) from public.courses
union all select 'before_purge', 'enrollments', count(*) from public.enrollments
union all select 'before_purge', 'quiz_attempts', count(*) from public.quiz_attempts
union all select 'before_purge', 'notifications', count(*) from public.notifications
union all select 'before_purge', 'export_jobs', case when to_regclass('private.export_jobs') is null then 0 else (xpath('/row/c/text()', query_to_xml('select count(*) c from private.export_jobs', false, true, '')))[1]::text::bigint end;

-- Explicit dependency-ordered allowlist. No dynamic truncate or system-schema mutation.
do $$ begin
  if to_regclass('private.refresh_tokens') is not null then delete from private.refresh_tokens; end if;
  if to_regclass('private.auth_sessions') is not null then delete from private.auth_sessions; end if;
  if to_regclass('private.export_jobs') is not null then delete from private.export_jobs; end if;
end $$;
delete from private.revoked_sessions;

delete from public.approval_events;
delete from public.certificate_alert_events;
delete from public.cchn_registration_items;
delete from public.cchn_registrations;
delete from public.training_tracking_records;
delete from public.employee_profile_audit_logs;
delete from public.audit_logs;
delete from public.notification_deliveries;
delete from public.notifications;
delete from public.notification_events;
delete from public.notification_preferences;
delete from public.reminder_runs;
delete from public.quiz_answers;
delete from public.quiz_attempts;
delete from public.quiz_question_versions;
delete from public.quiz_versions;
delete from public.quiz_questions;
delete from public.question_options;
delete from public.questions;
delete from public.quizzes;
delete from public.content_progress;
delete from public.lesson_progress;
delete from public.course_assignments;
delete from public.enrollments;
delete from public.course_content;
delete from public.course_contents;
delete from public.course_versions;
delete from public.learning_path_step_progress;
delete from public.learning_path_assignments;
delete from public.learning_path_version_steps;
delete from public.learning_path_versions;
delete from public.learning_path_steps;
delete from public.learning_paths;
delete from public.learning_record_attachments;
delete from public.learning_records;
delete from public.learning_history;
delete from public.external_course_submissions;
delete from public.external_training_requests;
delete from public.compliance_completion_records;
delete from public.compliance_assignments;
delete from public.compliance_cycles;
delete from public.compliance_target_rules;
delete from public.compliance_programs;
delete from public.retraining_assignments;
delete from public.retraining_reviews;
delete from public.development_plan_items;
delete from public.development_plans;
delete from public.employee_competency_evidence;
delete from public.employee_competency_assessments;
delete from public.attendance;
delete from public.qr_tokens;
delete from public.session_participants;
delete from public.training_registrations;
delete from public.training_participants;
delete from public.session_slots;
delete from public.public_training_roster;
delete from public.public_training_participants;
delete from public.public_training_active_flow;
delete from public.public_training_flows;
delete from public.training_sessions;
delete from public.professional_certificates;
delete from public.employee_certifications;
delete from public.hr_tasks;
delete from public.user_activity;
delete from public.file_uploads;
delete from public.gallery_albums;
delete from public.courses;
delete from public.user_roles where account_id <> current_setting('kis.clean_reset.bootstrap_hr_id');
delete from private.account_credentials where profile_id <> current_setting('kis.clean_reset.bootstrap_hr_id');
delete from public.profiles where id <> current_setting('kis.clean_reset.bootstrap_hr_id');

select 'after_purge' as phase, 'profiles' as table_name, count(*)::bigint as row_count from public.profiles
union all select 'after_purge', 'course_versions', count(*) from public.course_versions
union all select 'after_purge', 'courses', count(*) from public.courses
union all select 'after_purge', 'enrollments', count(*) from public.enrollments
union all select 'after_purge', 'quiz_attempts', count(*) from public.quiz_attempts
union all select 'after_purge', 'notifications', count(*) from public.notifications
union all select 'after_purge', 'export_jobs', case when to_regclass('private.export_jobs') is null then 0 else (xpath('/row/c/text()', query_to_xml('select count(*) c from private.export_jobs', false, true, '')))[1]::text::bigint end;

commit;
