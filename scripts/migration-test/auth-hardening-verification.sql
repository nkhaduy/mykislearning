do $$
declare
  v_result jsonb;
begin
  select public.service_create_auth_session(
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    repeat('a', 43),
    'local-development-admin',
    now() + interval '8 hours',
    now() + interval '8 hours',
    repeat('i', 43),
    'migration-rehearsal-agent',
    10
  ) into v_result;
  if v_result->>'status' <> 'created' then raise exception 'session creation failed: %', v_result; end if;

  select public.service_rotate_refresh_token(
    repeat('a', 43),
    '30000000-0000-4000-8000-000000000002',
    repeat('b', 43),
    now() + interval '8 hours',
    repeat('j', 43),
    'migration-rehearsal-agent'
  ) into v_result;
  if v_result->>'status' <> 'rotated' then raise exception 'refresh rotation failed: %', v_result; end if;

  select public.service_rotate_refresh_token(
    repeat('a', 43),
    '30000000-0000-4000-8000-000000000003',
    repeat('c', 43),
    now() + interval '8 hours',
    repeat('k', 43),
    'replay-agent'
  ) into v_result;
  if v_result->>'status' <> 'reuse_detected' then raise exception 'refresh reuse was not detected: %', v_result; end if;
  if not exists (
    select 1 from private.auth_sessions
    where token_family_id = '20000000-0000-4000-8000-000000000001'
      and revocation_reason = 'refresh_reuse'
  ) then raise exception 'refresh reuse did not revoke the session family'; end if;
  if exists (
    select 1 from private.refresh_tokens
    where token_family_id = '20000000-0000-4000-8000-000000000001'
      and revoked_at is null
  ) then raise exception 'refresh reuse left an active token in the family'; end if;
end $$;

do $$
begin
  if to_regclass('private.mfa_factors') is not null
     or to_regclass('private.mfa_recovery_codes') is not null then
    raise exception 'MFA storage still exists after decommission migration';
  end if;
  if to_regprocedure('public.service_read_mfa_factor(text)') is not null
     or to_regprocedure('public.service_set_session_assurance(uuid,text,boolean)') is not null then
    raise exception 'MFA RPC still exists after decommission migration';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'private' and table_name = 'auth_sessions'
      and column_name in ('assurance_level', 'mfa_verified_at', 'step_up_at')
  ) then
    raise exception 'MFA assurance columns still exist after decommission migration';
  end if;
end $$;

select case when count(*) = 0 then true else false end
from information_schema.role_table_grants
where table_schema = 'private' and table_name in (
  'auth_sessions', 'refresh_tokens'
) and grantee in ('anon', 'authenticated');
