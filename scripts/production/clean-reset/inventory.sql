\set ON_ERROR_STOP on

-- Required session settings are supplied by the guarded clean-room runner.
do $$
declare
  target text := current_setting('kis.clean_reset.target', true);
  target_ref text := current_setting('kis.clean_reset.target_project_ref', true);
  production_ref text := current_setting('kis.clean_reset.production_project_ref', true);
  unknown_tables text[];
begin
  if target <> 'disposable' then
    raise exception 'clean-reset inventory requires target=disposable';
  end if;
  if target_ref is null or production_ref is null or target_ref = production_ref then
    raise exception 'clean-reset inventory refuses the production project ref';
  end if;

  select array_agg(format('%I.%I', schemaname, tablename) order by schemaname, tablename)
  into unknown_tables
  from pg_tables
  where schemaname in ('public', 'private')
    and format('%I.%I', schemaname, tablename) <> all (array[
      'private.account_credentials','private.auth_sessions','private.bootstrap_state',
      'private.export_jobs','private.refresh_tokens','private.revoked_sessions',
      'public.approval_events','public.attendance','public.audit_logs','public.cchn_catalog_items',
      'public.cchn_registration_items','public.cchn_registrations','public.certificate_alert_events',
      'public.certificate_requirements','public.certificate_types','public.competencies',
      'public.competency_categories','public.competency_levels','public.competency_requirements',
      'public.competency_resource_mappings','public.compliance_assignments',
      'public.compliance_completion_records','public.compliance_cycles','public.compliance_programs',
      'public.compliance_target_rules','public.content_progress','public.course_assignments',
      'public.course_categories','public.course_content','public.course_contents','public.course_versions',
      'public.courses','public.departments','public.development_plan_items','public.development_plans',
      'public.employee_certifications','public.employee_competency_assessments',
      'public.employee_competency_evidence','public.employee_profile_audit_logs','public.enrollments',
      'public.external_course_submissions','public.external_training_requests','public.file_uploads',
      'public.gallery_albums','public.hr_tasks','public.learning_history','public.learning_path_assignments',
      'public.learning_path_step_progress','public.learning_path_steps','public.learning_path_version_steps',
      'public.learning_path_versions','public.learning_paths','public.learning_record_attachments',
      'public.learning_records','public.lesson_progress','public.notification_deliveries',
      'public.notification_events','public.notification_preferences','public.notification_templates',
      'public.notifications','public.professional_certificates','public.profiles',
      'public.public_training_active_flow','public.public_training_flows',
      'public.public_training_participants','public.public_training_roster','public.qr_tokens',
      'public.question_options','public.questions','public.quiz_answers','public.quiz_attempts',
      'public.quiz_question_versions','public.quiz_questions','public.quiz_versions','public.quizzes',
      'public.reminder_rules','public.reminder_runs','public.retraining_assignments',
      'public.retraining_reviews','public.session_participants','public.session_slots',
      'public.system_settings','public.training_participants','public.training_registrations',
      'public.training_sessions','public.training_tracking_records','public.user_activity','public.user_roles'
    ]::text[]);

  if unknown_tables is not null then
    raise exception 'OWNER DECISION REQUIRED: unclassified application tables: %', unknown_tables;
  end if;
end $$;

select classification, count(*) as table_count
from (values
  ('preserve'), ('purge'), ('review-required')
) expected(classification)
left join (values
  ('preserve', 14),
  ('purge', 74),
  ('review-required', 0)
) classified(classification, table_count) using (classification)
group by classification, classified.table_count
order by classification;

-- Counts only; no row values or PII are emitted.
select format(
  'select %L as table_name, count(*)::bigint as row_count from %I.%I;',
  schemaname || '.' || tablename, schemaname, tablename
)
from pg_tables
where schemaname in ('public', 'private')
order by schemaname, tablename
\gexec
