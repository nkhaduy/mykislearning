-- Read-only catalog verification for SEC-002/SEC-011.
-- Run with a database role that can inspect pg_catalog. Do not paste row data.

select
  n.nspname as schema_name,
  c.relname as relation_name,
  case c.relkind when 'r' then 'table' when 'v' then 'view' when 'm' then 'materialized_view' else c.relkind::text end as relation_type,
  c.relrowsecurity as rls_enabled,
  has_table_privilege('anon', c.oid, 'SELECT') as anon_select,
  has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_select,
  case
    when n.nspname = 'private' then 'service-role-only'
    when c.relname in ('public_training_flows', 'public_training_active_flow') then 'public-readable-via-worker'
    when c.relname in ('profiles', 'learning_records', 'notifications', 'employee_certifications', 'development_plans') then 'employee-own-data-via-worker'
    when c.relname in ('courses', 'course_contents', 'course_content', 'quizzes', 'quiz_questions') then 'authenticated-course-data-via-worker'
    when c.relname in ('audit_logs', 'content_versions', 'system_settings') then 'admin-or-service-role-only'
    else 'worker-route-policy-required'
  end as intended_access
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'private')
  and c.relkind in ('r', 'v', 'm')
order by n.nspname, c.relname;

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname in ('public', 'private')
order by schemaname, tablename, policyname;

select
  n.nspname as schema_name,
  p.proname as function_name,
  p.prosecdef as security_definer,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'private')
order by n.nspname, p.proname;

select rolname, nspname as schema_name, has_schema_privilege(rolname, n.oid, 'USAGE') as has_usage
from pg_roles cross join pg_namespace n
where rolname in ('anon', 'authenticated', 'service_role')
  and nspname in ('public', 'private')
order by rolname, nspname;
