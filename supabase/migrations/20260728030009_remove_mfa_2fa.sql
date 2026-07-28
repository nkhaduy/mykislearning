-- Intentional security-surface reduction: remove TOTP MFA, recovery codes,
-- step-up assurance and their private storage while preserving password auth,
-- rotating refresh tokens, session revocation and role checks.

begin;

-- Remove RPCs before dropping the columns/tables they referenced. The drops
-- are idempotent so fresh, legacy and partial migration replays converge.
drop function if exists public.service_read_mfa_factor(text);
drop function if exists public.service_begin_mfa_enrollment(text, text, text, smallint);
drop function if exists public.service_activate_mfa(text, bigint, uuid[], text[]);
drop function if exists public.service_record_mfa_timestep(text, bigint);
drop function if exists public.service_consume_mfa_recovery_code(text, text);
drop function if exists public.service_set_session_assurance(uuid, text, boolean);
drop function if exists public.service_reset_mfa(text, text);

drop function if exists public.service_create_auth_session(
  uuid, uuid, uuid, text, text, timestamptz, timestamptz, text, text,
  smallint, timestamptz, timestamptz, integer
);

create or replace function public.service_create_auth_session(
  p_session_id uuid,
  p_family_id uuid,
  p_refresh_token_id uuid,
  p_refresh_token_hash text,
  p_profile_id text,
  p_session_expires_at timestamptz,
  p_refresh_expires_at timestamptz,
  p_ip_hash text,
  p_user_agent text,
  p_max_sessions integer default 10
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_credential_version bigint;
begin
  select * into v_profile from public.profiles where id = p_profile_id for update;
  if not found or coalesce(v_profile.account_status, 'active') <> 'active' then
    return jsonb_build_object('status', 'account_unavailable');
  end if;

  select credential_version into v_credential_version
  from private.account_credentials where profile_id = p_profile_id;
  if v_credential_version is null then
    return jsonb_build_object('status', 'credential_unavailable');
  end if;

  insert into private.auth_sessions(
    id, token_family_id, profile_id, credential_version, expires_at,
    created_ip_hash, last_ip_hash, user_agent
  ) values (
    p_session_id, p_family_id, p_profile_id, v_credential_version,
    p_session_expires_at, p_ip_hash, p_ip_hash, left(p_user_agent, 256)
  );

  insert into private.refresh_tokens(
    id, session_id, token_family_id, profile_id, token_hash, expires_at,
    ip_hash, user_agent
  ) values (
    p_refresh_token_id, p_session_id, p_family_id, p_profile_id,
    p_refresh_token_hash, p_refresh_expires_at, p_ip_hash, left(p_user_agent, 256)
  );

  with excess as (
    select id from private.auth_sessions
    where profile_id = p_profile_id and revoked_at is null and expires_at > now()
    order by created_at desc
    offset greatest(coalesce(p_max_sessions, 10), 1)
  )
  update private.auth_sessions s
  set revoked_at = now(), revocation_reason = 'session_limit'
  from excess where s.id = excess.id;

  update private.refresh_tokens r
  set revoked_at = now(), revocation_reason = 'session_limit'
  where r.session_id in (
    select id from private.auth_sessions
    where profile_id = p_profile_id and revocation_reason = 'session_limit'
  ) and r.revoked_at is null;

  return jsonb_build_object(
    'status', 'created', 'session_id', p_session_id, 'family_id', p_family_id,
    'profile_id', p_profile_id, 'role', coalesce(v_profile.role, 'employee'),
    'credential_version', v_credential_version
  );
end;
$$;

create or replace function public.service_get_auth_session(
  p_session_id uuid,
  p_profile_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session private.auth_sessions%rowtype;
  v_role text;
  v_status text;
  v_credential_version bigint;
begin
  select * into v_session from private.auth_sessions
  where id = p_session_id and profile_id = p_profile_id;
  if not found then return jsonb_build_object('valid', false, 'reason', 'not_found'); end if;
  select p.role, p.account_status, c.credential_version
  into v_role, v_status, v_credential_version
  from public.profiles p
  join private.account_credentials c on c.profile_id = p.id
  where p.id = v_session.profile_id;

  if not found then return jsonb_build_object('valid', false, 'reason', 'account_unavailable'); end if;
  if v_session.revoked_at is not null then
    return jsonb_build_object('valid', false, 'reason', coalesce(v_session.revocation_reason, 'revoked'));
  end if;
  if v_session.expires_at <= now() then
    return jsonb_build_object('valid', false, 'reason', 'expired');
  end if;
  if coalesce(v_status, 'active') <> 'active' then
    update private.auth_sessions set revoked_at = now(), revocation_reason = 'account_disabled'
    where id = p_session_id and revoked_at is null;
    update private.refresh_tokens set revoked_at = now(), revocation_reason = 'account_disabled'
    where session_id = p_session_id and revoked_at is null;
    return jsonb_build_object('valid', false, 'reason', 'account_disabled');
  end if;
  if v_session.credential_version <> v_credential_version then
    update private.auth_sessions set revoked_at = now(), revocation_reason = 'credential_changed'
    where id = p_session_id and revoked_at is null;
    update private.refresh_tokens set revoked_at = now(), revocation_reason = 'credential_changed'
    where session_id = p_session_id and revoked_at is null;
    return jsonb_build_object('valid', false, 'reason', 'credential_changed');
  end if;

  update private.auth_sessions set last_seen_at = now() where id = p_session_id;
  return jsonb_build_object(
    'valid', true,
    'session_id', v_session.id,
    'family_id', v_session.token_family_id,
    'profile_id', v_session.profile_id,
    'role', coalesce(v_role, 'employee'),
    'expires_at', v_session.expires_at
  );
end;
$$;

create or replace function public.service_rotate_refresh_token(
  p_token_hash text,
  p_new_token_id uuid,
  p_new_token_hash text,
  p_new_expires_at timestamptz,
  p_ip_hash text,
  p_user_agent text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token private.refresh_tokens%rowtype;
  v_session private.auth_sessions%rowtype;
  v_role text;
  v_status text;
  v_credential_version bigint;
begin
  select * into v_token from private.refresh_tokens
  where token_hash = p_token_hash for update;
  if not found then return jsonb_build_object('status', 'invalid'); end if;

  select * into v_session from private.auth_sessions
  where id = v_token.session_id for update;
  if not found then return jsonb_build_object('status', 'revoked'); end if;
  select p.role, p.account_status, c.credential_version
  into v_role, v_status, v_credential_version
  from public.profiles p
  join private.account_credentials c on c.profile_id = p.id
  where p.id = v_session.profile_id;
  if not found then return jsonb_build_object('status', 'account_unavailable'); end if;

  if v_token.rotated_at is not null or v_token.replaced_by_token_id is not null then
    update private.auth_sessions set revoked_at = coalesce(revoked_at, now()),
      revocation_reason = coalesce(revocation_reason, 'refresh_reuse')
    where token_family_id = v_token.token_family_id;
    update private.refresh_tokens set revoked_at = coalesce(revoked_at, now()),
      revocation_reason = coalesce(revocation_reason, 'refresh_reuse')
    where token_family_id = v_token.token_family_id;
    return jsonb_build_object(
      'status', 'reuse_detected', 'profile_id', v_token.profile_id,
      'session_id', v_token.session_id, 'family_id', v_token.token_family_id
    );
  end if;
  if v_token.revoked_at is not null or v_session.revoked_at is not null then
    return jsonb_build_object('status', 'revoked');
  end if;
  if v_token.expires_at <= now() or v_session.expires_at <= now() then
    return jsonb_build_object('status', 'expired');
  end if;
  if coalesce(v_status, 'active') <> 'active' then
    update private.auth_sessions set revoked_at = now(), revocation_reason = 'account_disabled'
      where id = v_session.id and revoked_at is null;
    update private.refresh_tokens set revoked_at = now(), revocation_reason = 'account_disabled'
      where token_family_id = v_token.token_family_id and revoked_at is null;
    return jsonb_build_object('status', 'account_disabled');
  end if;
  if v_session.credential_version <> v_credential_version then
    update private.auth_sessions set revoked_at = now(), revocation_reason = 'credential_changed'
      where id = v_session.id and revoked_at is null;
    update private.refresh_tokens set revoked_at = now(), revocation_reason = 'credential_changed'
      where token_family_id = v_token.token_family_id and revoked_at is null;
    return jsonb_build_object('status', 'credential_changed');
  end if;

  insert into private.refresh_tokens(
    id, session_id, token_family_id, profile_id, token_hash, parent_token_id,
    expires_at, ip_hash, user_agent
  ) values (
    p_new_token_id, v_token.session_id, v_token.token_family_id, v_token.profile_id,
    p_new_token_hash, v_token.id, least(p_new_expires_at, v_session.expires_at), p_ip_hash, left(p_user_agent, 256)
  );

  update private.refresh_tokens set
    last_used_at = now(), rotated_at = now(), replaced_by_token_id = p_new_token_id
  where id = v_token.id;

  update private.auth_sessions set last_seen_at = now(), last_ip_hash = p_ip_hash,
    user_agent = left(p_user_agent, 256)
  where id = v_session.id;

  return jsonb_build_object(
    'status', 'rotated', 'profile_id', v_token.profile_id,
    'session_id', v_token.session_id, 'family_id', v_token.token_family_id,
    'role', coalesce(v_role, 'employee'), 'session_expires_at', v_session.expires_at
  );
exception
  when unique_violation then
    update private.auth_sessions set revoked_at = coalesce(revoked_at, now()),
      revocation_reason = coalesce(revocation_reason, 'refresh_race')
    where token_family_id = v_token.token_family_id;
    update private.refresh_tokens set revoked_at = coalesce(revoked_at, now()),
      revocation_reason = coalesce(revocation_reason, 'refresh_race')
    where token_family_id = v_token.token_family_id;
    return jsonb_build_object('status', 'reuse_detected');
end;
$$;

create or replace function public.service_list_auth_sessions(
  p_profile_id text,
  p_current_session_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id, 'current', s.id = p_current_session_id,
    'created_at', s.created_at, 'last_seen_at', s.last_seen_at,
    'expires_at', s.expires_at, 'user_agent', s.user_agent
  ) order by s.last_seen_at desc), '[]'::jsonb)
  from private.auth_sessions s
  where s.profile_id = p_profile_id and s.revoked_at is null and s.expires_at > now();
$$;

create or replace function public.service_cleanup_auth_security()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_tokens integer; v_sessions integer;
begin
  delete from private.refresh_tokens
  where expires_at < now() - interval '7 days'
     or (revoked_at is not null and revoked_at < now() - interval '30 days');
  get diagnostics v_tokens = row_count;
  delete from private.auth_sessions
  where expires_at < now() - interval '7 days'
     or (revoked_at is not null and revoked_at < now() - interval '30 days');
  get diagnostics v_sessions = row_count;
  return jsonb_build_object('refresh_tokens', v_tokens, 'sessions', v_sessions);
end;
$$;

alter table if exists private.auth_sessions
  drop column if exists assurance_level,
  drop column if exists mfa_verified_at,
  drop column if exists step_up_at;

drop table if exists private.mfa_recovery_codes;
drop table if exists private.mfa_factors;

revoke all on function public.service_create_auth_session(uuid, uuid, uuid, text, text, timestamptz, timestamptz, text, text, integer) from public, anon, authenticated;
revoke all on function public.service_get_auth_session(uuid, text) from public, anon, authenticated;
revoke all on function public.service_rotate_refresh_token(text, uuid, text, timestamptz, text, text) from public, anon, authenticated;
revoke all on function public.service_list_auth_sessions(text, uuid) from public, anon, authenticated;
revoke all on function public.service_cleanup_auth_security() from public, anon, authenticated;

grant execute on function public.service_create_auth_session(uuid, uuid, uuid, text, text, timestamptz, timestamptz, text, text, integer) to service_role;
grant execute on function public.service_get_auth_session(uuid, text) to service_role;
grant execute on function public.service_rotate_refresh_token(text, uuid, text, timestamptz, text, text) to service_role;
grant execute on function public.service_list_auth_sessions(text, uuid) to service_role;
grant execute on function public.service_cleanup_auth_security() to service_role;

commit;
