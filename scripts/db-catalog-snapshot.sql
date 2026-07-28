-- SEC-002/SEC-011: structured, data-free catalog snapshot for ephemeral verification.
with
application_schemas as (
  select n.oid, n.nspname, pg_get_userbyid(n.nspowner) as owner
  from pg_namespace n
  where n.nspname not in ('pg_catalog', 'information_schema')
    and n.nspname not like 'pg_toast%'
    and n.nspname not like 'pg_temp%'
),
application_tables as (
  select c.oid, n.nspname as schema_name, c.relname as table_name,
         pg_get_userbyid(c.relowner) as owner, c.relrowsecurity as rls_enabled,
         c.relforcerowsecurity as force_rls, c.reltuples::bigint as estimated_rows
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where c.relkind in ('r', 'p')
    and n.nspname in (select nspname from application_schemas)
),
snapshot as (
  select jsonb_build_object(
    'metadata', jsonb_build_object(
      'database', current_database(),
      'postgres_version', current_setting('server_version'),
      'captured_at', now(),
      'current_user', current_user,
      'exposed_schemas', jsonb_build_array('public', 'graphql_public')
    ),
    'schemas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'schema', s.nspname,
        'owner', s.owner,
        'acl', coalesce(s_acl.acl, '[]'::jsonb)
      ) order by s.nspname)
      from application_schemas s
      left join lateral (
        select jsonb_agg(jsonb_build_object(
          'grantee', case when x.grantee = 0 then 'PUBLIC' else pg_get_userbyid(x.grantee) end,
          'grantor', pg_get_userbyid(x.grantor),
          'privilege', x.privilege_type,
          'grantable', x.is_grantable
        ) order by case when x.grantee = 0 then 'PUBLIC' else pg_get_userbyid(x.grantee) end, x.privilege_type) as acl
        from aclexplode(coalesce((select nspacl from pg_namespace where oid = s.oid), acldefault('n', (select nspowner from pg_namespace where oid = s.oid)))) x
      ) s_acl on true
    ), '[]'::jsonb),
    'tables', coalesce((
      select jsonb_agg(jsonb_build_object(
        'schema', t.schema_name,
        'table', t.table_name,
        'owner', t.owner,
        'rls_enabled', t.rls_enabled,
        'force_rls', t.force_rls,
        'estimated_rows', t.estimated_rows
      ) order by t.schema_name, t.table_name)
      from application_tables t
    ), '[]'::jsonb),
    'views', coalesce((
      select jsonb_agg(jsonb_build_object(
        'schema', n.nspname,
        'view', c.relname,
        'owner', pg_get_userbyid(c.relowner),
        'reloptions', coalesce(to_jsonb(c.reloptions), '[]'::jsonb),
        'definition', pg_get_viewdef(c.oid, true)
      ) order by n.nspname, c.relname)
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where c.relkind in ('v', 'm')
        and n.nspname in (select nspname from application_schemas)
    ), '[]'::jsonb),
    'functions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'schema', n.nspname,
        'function', p.proname,
        'identity_arguments', pg_get_function_identity_arguments(p.oid),
        'owner', pg_get_userbyid(p.proowner),
        'language', l.lanname,
        'security_definer', p.prosecdef,
        'volatility', p.provolatile,
        'parallel', p.proparallel,
        'acl', coalesce(fn_acl.acl, '[]'::jsonb)
      ) order by n.nspname, p.proname, pg_get_function_identity_arguments(p.oid))
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      join pg_language l on l.oid = p.prolang
      left join lateral (
        select jsonb_agg(jsonb_build_object(
          'grantee', case when x.grantee = 0 then 'PUBLIC' else pg_get_userbyid(x.grantee) end,
          'grantor', pg_get_userbyid(x.grantor),
          'privilege', x.privilege_type,
          'grantable', x.is_grantable
        ) order by case when x.grantee = 0 then 'PUBLIC' else pg_get_userbyid(x.grantee) end, x.privilege_type) as acl
        from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x
      ) fn_acl on true
      where n.nspname in (select nspname from application_schemas)
    ), '[]'::jsonb),
    'security_definer_functions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'schema', n.nspname,
        'function', p.proname,
        'identity_arguments', pg_get_function_identity_arguments(p.oid),
        'owner', pg_get_userbyid(p.proowner)
      ) order by n.nspname, p.proname)
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where p.prosecdef
        and n.nspname in (select nspname from application_schemas)
    ), '[]'::jsonb),
    'triggers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'schema', n.nspname,
        'table', c.relname,
        'trigger', tg.tgname,
        'enabled', tg.tgenabled,
        'definition', pg_get_triggerdef(tg.oid, true)
      ) order by n.nspname, c.relname, tg.tgname)
      from pg_trigger tg
      join pg_class c on c.oid = tg.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      where not tg.tgisinternal
        and n.nspname in (select nspname from application_schemas)
    ), '[]'::jsonb),
    'policies', coalesce((
      select jsonb_agg(jsonb_build_object(
        'schema', schemaname,
        'table', tablename,
        'policy', policyname,
        'permissive', permissive,
        'roles', roles,
        'command', cmd,
        'using', qual,
        'with_check', with_check
      ) order by schemaname, tablename, policyname)
      from pg_policies
      where schemaname in (select nspname from application_schemas)
    ), '[]'::jsonb),
    'indexes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'schema', schemaname,
        'table', tablename,
        'index', indexname,
        'definition', indexdef
      ) order by schemaname, tablename, indexname)
      from pg_indexes
      where schemaname in (select nspname from application_schemas)
    ), '[]'::jsonb),
    'foreign_keys', coalesce((
      select jsonb_agg(jsonb_build_object(
        'schema', n.nspname,
        'table', c.relname,
        'constraint', con.conname,
        'definition', pg_get_constraintdef(con.oid, true)
      ) order by n.nspname, c.relname, con.conname)
      from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace
      where con.contype = 'f'
        and n.nspname in (select nspname from application_schemas)
    ), '[]'::jsonb),
    'table_grants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'schema', grant_source.table_schema,
        'table', grant_source.table_name,
        'grantee', grant_source.grantee,
        'privilege', grant_source.privilege_type,
        'grantable', grant_source.is_grantable
      ) order by grant_source.table_schema, grant_source.table_name, grant_source.grantee, grant_source.privilege_type)
      from information_schema.role_table_grants grant_source
      where grant_source.table_schema in (select nspname from application_schemas)
    ), '[]'::jsonb),
    'sequence_grants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'schema', object_schema,
        'sequence', object_name,
        'grantee', grantee,
        'privilege', privilege_type,
        'grantable', is_grantable
      ) order by object_schema, object_name, grantee, privilege_type)
      from information_schema.usage_privileges
      where object_type = 'SEQUENCE'
        and object_schema in (select nspname from application_schemas)
    ), '[]'::jsonb),
    'default_privileges', coalesce((
      select jsonb_agg(jsonb_build_object(
        'owner', pg_get_userbyid(d.defaclrole),
        'schema', coalesce(n.nspname, ''),
        'object_type', d.defaclobjtype,
        'acl', d.defaclacl
      ) order by pg_get_userbyid(d.defaclrole), coalesce(n.nspname, ''), d.defaclobjtype)
      from pg_default_acl d
      left join pg_namespace n on n.oid = d.defaclnamespace
      where n.nspname is null or n.nspname in (select nspname from application_schemas)
    ), '[]'::jsonb),
    'role_attributes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'role', rolname,
        'superuser', rolsuper,
        'inherit', rolinherit,
        'create_role', rolcreaterole,
        'create_db', rolcreatedb,
        'can_login', rolcanlogin,
        'replication', rolreplication,
        'bypass_rls', rolbypassrls
      ) order by rolname)
      from pg_roles
      where rolname in ('anon', 'authenticated', 'service_role', 'postgres')
    ), '[]'::jsonb),
    'role_table_capabilities', coalesce((
      select jsonb_agg(jsonb_build_object(
        'role', role_name,
        'schema', t.schema_name,
        'table', t.table_name,
        'select', has_table_privilege(role_name, format('%I.%I', t.schema_name, t.table_name), 'SELECT'),
        'insert', has_table_privilege(role_name, format('%I.%I', t.schema_name, t.table_name), 'INSERT'),
        'update', has_table_privilege(role_name, format('%I.%I', t.schema_name, t.table_name), 'UPDATE'),
        'delete', has_table_privilege(role_name, format('%I.%I', t.schema_name, t.table_name), 'DELETE'),
        'truncate', has_table_privilege(role_name, format('%I.%I', t.schema_name, t.table_name), 'TRUNCATE'),
        'references', has_table_privilege(role_name, format('%I.%I', t.schema_name, t.table_name), 'REFERENCES'),
        'trigger', has_table_privilege(role_name, format('%I.%I', t.schema_name, t.table_name), 'TRIGGER')
      ) order by role_name, t.schema_name, t.table_name)
      from unnest(array['anon', 'authenticated', 'service_role']) role_name
      cross join application_tables t
    ), '[]'::jsonb),
    'extensions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'extension', e.extname,
        'version', e.extversion,
        'schema', n.nspname,
        'owner', pg_get_userbyid(e.extowner)
      ) order by e.extname)
      from pg_extension e
      join pg_namespace n on n.oid = e.extnamespace
    ), '[]'::jsonb)
  ) as document
)
select jsonb_pretty(document) from snapshot;
