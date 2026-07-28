select jsonb_pretty(jsonb_build_object(
  'public_table_count', (select count(*) from pg_tables where schemaname = 'public'),
  'public_rls_enabled_count', (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r','p') and c.relrowsecurity),
  'public_tables_without_rls', coalesce((select jsonb_agg(format('%I.%I', n.nspname, c.relname) order by c.relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r','p') and not c.relrowsecurity), '[]'::jsonb),
  'anon_public_table_privilege_rows', (select count(*) from information_schema.role_table_grants where table_schema = 'public' and grantee = 'anon'),
  'authenticated_public_table_privilege_rows', (select count(*) from information_schema.role_table_grants where table_schema = 'public' and grantee = 'authenticated'),
  'anon_public_table_dml_count', (select count(*) from information_schema.role_table_grants where table_schema = 'public' and grantee = 'anon' and privilege_type in ('SELECT','INSERT','UPDATE','DELETE')),
  'authenticated_public_table_dml_count', (select count(*) from information_schema.role_table_grants where table_schema = 'public' and grantee = 'authenticated' and privilege_type in ('SELECT','INSERT','UPDATE','DELETE')),
  'anon_public_function_execute_count', (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE')),
  'authenticated_public_function_execute_count', (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'EXECUTE')),
  'service_role_public_table_select_count', (select count(*) from pg_tables where schemaname = 'public' and has_table_privilege('service_role', format('%I.%I', schemaname, tablename), 'SELECT')),
  'service_role_public_function_execute_count', (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and has_function_privilege('service_role', p.oid, 'EXECUTE')),
  'private_schema_browser_usage', jsonb_build_object(
    'anon', has_schema_privilege('anon', 'private', 'USAGE'),
    'authenticated', has_schema_privilege('authenticated', 'private', 'USAGE'),
    'service_role', has_schema_privilege('service_role', 'private', 'USAGE')
  ),
  'role_attributes', (select jsonb_object_agg(rolname, jsonb_build_object('can_login', rolcanlogin, 'bypass_rls', rolbypassrls)) from pg_roles where rolname in ('anon','authenticated','service_role')),
  'credential_state', jsonb_build_object(
    'private_rows', (select count(*) from private.account_credentials),
    'must_change_rows', (select count(*) from private.account_credentials where must_change),
    'legacy_avatar_markers', (select count(*) from public.profiles where left(avatar_url, length('__pwd__:')) = '__pwd__:'),
    'legacy_password_status_markers', (select count(*) from public.profiles where password_status like 'pbkdf2$%' or password_status like 'pbkdf2-sha256$%' or password_status like 'reset:pbkdf2$%' or password_status like 'reset:pbkdf2-sha256$%')
  ),
  'bootstrap_state_rows', (select count(*) from private.bootstrap_state),
  'revoked_session_rows', (select count(*) from private.revoked_sessions)
));
