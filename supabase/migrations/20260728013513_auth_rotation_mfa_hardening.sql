-- Authentication hardening: server-side sessions, rotating refresh-token
-- families, TOTP MFA state, recovery-code hashes, and assurance timestamps.
-- All sensitive tables remain outside the exposed Data API schemas.

begin;

do $$
begin
  if to_regclass('public.profiles') is null
     or to_regclass('private.account_credentials') is null then
    raise exception 'auth hardening requires public.profiles and private.account_credentials';
  end if;
end $$;

alter table private.account_credentials
  add column if not exists credential_version bigint not null default 1;

create table if not exists private.auth_sessions (
  id uuid primary key,
  token_family_id uuid not null unique,
  profile_id text not null references public.profiles(id) on delete cascade,
  credential_version bigint not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  revocation_reason text,
  created_ip_hash text,
  last_ip_hash text,
  user_agent varchar(256),
  assurance_level smallint not null default 1 check (assurance_level between 1 and 2),
  mfa_verified_at timestamptz,
  step_up_at timestamptz,
  check (expires_at > created_at),
  check ((revoked_at is null) = (revocation_reason is null))
);

create index if not exists auth_sessions_profile_active_idx
  on private.auth_sessions(profile_id, expires_at desc)
  where revoked_at is null;
create index if not exists auth_sessions_expiry_idx
  on private.auth_sessions(expires_at);

create table if not exists private.refresh_tokens (
  id uuid primary key,
  session_id uuid not null references private.auth_sessions(id) on delete cascade,
  token_family_id uuid not null,
  profile_id text not null references public.profiles(id) on delete cascade,
  token_hash text not null unique check (length(token_hash) between 43 and 128),
  parent_token_id uuid unique references private.refresh_tokens(id),
  replaced_by_token_id uuid unique references private.refresh_tokens(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_used_at timestamptz,
  rotated_at timestamptz,
  revoked_at timestamptz,
  revocation_reason text,
  ip_hash text,
  user_agent varchar(256),
  check (expires_at > created_at),
  check (replaced_by_token_id is null or rotated_at is not null),
  check ((revoked_at is null) = (revocation_reason is null))
);

create index if not exists refresh_tokens_session_idx
  on private.refresh_tokens(session_id, created_at desc);
create index if not exists refresh_tokens_family_active_idx
  on private.refresh_tokens(token_family_id, expires_at)
  where revoked_at is null;
create index if not exists refresh_tokens_expiry_idx
  on private.refresh_tokens(expires_at);

create table if not exists private.mfa_factors (
  profile_id text primary key references public.profiles(id) on delete cascade,
  state text not null default 'not_enrolled' check (state in (
    'not_enrolled', 'pending_enrollment', 'active', 'recovery_required', 'disabled_by_admin'
  )),
  secret_ciphertext text,
  secret_iv text,
  secret_key_version smallint,
  last_used_timestep bigint,
  enrollment_started_at timestamptz,
  enrolled_at timestamptz,
  reset_at timestamptz,
  updated_at timestamptz not null default now(),
  check (
    state in ('not_enrolled', 'recovery_required', 'disabled_by_admin')
    or (secret_ciphertext is not null and secret_iv is not null and secret_key_version is not null)
  )
);

create index if not exists mfa_factors_state_idx on private.mfa_factors(state);

create table if not exists private.mfa_recovery_codes (
  id uuid primary key,
  profile_id text not null references public.profiles(id) on delete cascade,
  code_hash text not null unique check (length(code_hash) between 43 and 128),
  created_at timestamptz not null default now(),
  used_at timestamptz
);

create index if not exists mfa_recovery_codes_profile_unused_idx
  on private.mfa_recovery_codes(profile_id)
  where used_at is null;

alter table private.auth_sessions enable row level security;
alter table private.refresh_tokens enable row level security;
alter table private.mfa_factors enable row level security;
alter table private.mfa_recovery_codes enable row level security;

revoke all on private.auth_sessions from public, anon, authenticated;
revoke all on private.refresh_tokens from public, anon, authenticated;
revoke all on private.mfa_factors from public, anon, authenticated;
revoke all on private.mfa_recovery_codes from public, anon, authenticated;
grant select, insert, update, delete on private.auth_sessions to service_role;
grant select, insert, update, delete on private.refresh_tokens to service_role;
grant select, insert, update, delete on private.mfa_factors to service_role;
grant select, insert, update, delete on private.mfa_recovery_codes to service_role;

create or replace function public.service_read_account_credential(p_profile_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'profile_id', c.profile_id,
    'password_hash', c.password_hash,
    'must_change', c.must_change,
    'credential_version', c.credential_version
  )
  from private.account_credentials c
  where c.profile_id = p_profile_id;
$$;

create or replace function public.service_write_account_credential(
  p_profile_id text,
  p_password_hash text,
  p_must_change boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.account_credentials(
    profile_id, password_hash, must_change, credential_version, updated_at
  ) values (
    p_profile_id, p_password_hash, coalesce(p_must_change, false), 1, now()
  )
  on conflict (profile_id) do update set
    password_hash = excluded.password_hash,
    must_change = excluded.must_change,
    credential_version = private.account_credentials.credential_version + 1,
    updated_at = now();
  return true;
end;
$$;

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
  p_assurance_level smallint,
  p_mfa_verified_at timestamptz,
  p_step_up_at timestamptz,
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
    created_ip_hash, last_ip_hash, user_agent, assurance_level,
    mfa_verified_at, step_up_at
  ) values (
    p_session_id, p_family_id, p_profile_id, v_credential_version,
    p_session_expires_at, p_ip_hash, p_ip_hash, left(p_user_agent, 256),
    p_assurance_level, p_mfa_verified_at, p_step_up_at
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
  if v_role in ('hr', 'admin') and v_session.assurance_level < 2 then
    update private.auth_sessions set revoked_at = now(), revocation_reason = 'mfa_required'
    where id = p_session_id and revoked_at is null;
    update private.refresh_tokens set revoked_at = now(), revocation_reason = 'mfa_required'
    where session_id = p_session_id and revoked_at is null;
    return jsonb_build_object('valid', false, 'reason', 'mfa_required');
  end if;

  update private.auth_sessions set last_seen_at = now() where id = p_session_id;
  return jsonb_build_object(
    'valid', true,
    'session_id', v_session.id,
    'family_id', v_session.token_family_id,
    'profile_id', v_session.profile_id,
    'role', coalesce(v_role, 'employee'),
    'expires_at', v_session.expires_at,
    'assurance_level', v_session.assurance_level,
    'mfa_verified_at', v_session.mfa_verified_at,
    'step_up_at', v_session.step_up_at
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
  if v_role in ('hr', 'admin') and v_session.assurance_level < 2 then
    update private.auth_sessions set revoked_at = now(), revocation_reason = 'mfa_required'
      where id = v_session.id and revoked_at is null;
    update private.refresh_tokens set revoked_at = now(), revocation_reason = 'mfa_required'
      where token_family_id = v_token.token_family_id and revoked_at is null;
    return jsonb_build_object('status', 'mfa_required');
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
    'role', coalesce(v_role, 'employee'), 'session_expires_at', v_session.expires_at,
    'assurance_level', v_session.assurance_level,
    'mfa_verified_at', v_session.mfa_verified_at, 'step_up_at', v_session.step_up_at
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

create or replace function public.service_revoke_auth_session(
  p_session_id uuid,
  p_profile_id text,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.auth_sessions set revoked_at = coalesce(revoked_at, now()),
    revocation_reason = coalesce(revocation_reason, left(coalesce(p_reason, 'logout'), 80))
  where id = p_session_id and profile_id = p_profile_id;
  update private.refresh_tokens set revoked_at = coalesce(revoked_at, now()),
    revocation_reason = coalesce(revocation_reason, left(coalesce(p_reason, 'logout'), 80))
  where session_id = p_session_id and profile_id = p_profile_id;
  return found;
end;
$$;

create or replace function public.service_revoke_all_auth_sessions(
  p_profile_id text,
  p_reason text,
  p_except_session_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_count integer;
begin
  update private.auth_sessions set revoked_at = coalesce(revoked_at, now()),
    revocation_reason = coalesce(revocation_reason, left(coalesce(p_reason, 'logout_all'), 80))
  where profile_id = p_profile_id and revoked_at is null
    and (p_except_session_id is null or id <> p_except_session_id);
  get diagnostics v_count = row_count;
  update private.refresh_tokens set revoked_at = coalesce(revoked_at, now()),
    revocation_reason = coalesce(revocation_reason, left(coalesce(p_reason, 'logout_all'), 80))
  where profile_id = p_profile_id and revoked_at is null
    and (p_except_session_id is null or session_id <> p_except_session_id);
  return v_count;
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
    'expires_at', s.expires_at, 'user_agent', s.user_agent,
    'assurance_level', s.assurance_level, 'mfa_verified_at', s.mfa_verified_at
  ) order by s.last_seen_at desc), '[]'::jsonb)
  from private.auth_sessions s
  where s.profile_id = p_profile_id and s.revoked_at is null and s.expires_at > now();
$$;

create or replace function public.service_read_mfa_factor(p_profile_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'profile_id', m.profile_id, 'state', m.state,
    'secret_ciphertext', m.secret_ciphertext, 'secret_iv', m.secret_iv,
    'secret_key_version', m.secret_key_version,
    'last_used_timestep', m.last_used_timestep, 'enrolled_at', m.enrolled_at
  ) from private.mfa_factors m where m.profile_id = p_profile_id;
$$;

create or replace function public.service_begin_mfa_enrollment(
  p_profile_id text,
  p_secret_ciphertext text,
  p_secret_iv text,
  p_secret_key_version smallint
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_updated integer;
begin
  insert into private.mfa_factors as existing(
    profile_id, state, secret_ciphertext, secret_iv, secret_key_version,
    enrollment_started_at, enrolled_at, last_used_timestep, updated_at
  ) values (
    p_profile_id, 'pending_enrollment', p_secret_ciphertext, p_secret_iv,
    p_secret_key_version, now(), null, null, now()
  ) on conflict (profile_id) do update set
    state = 'pending_enrollment', secret_ciphertext = excluded.secret_ciphertext,
    secret_iv = excluded.secret_iv, secret_key_version = excluded.secret_key_version,
    enrollment_started_at = now(), enrolled_at = null, last_used_timestep = null,
    updated_at = now()
  where existing.state in ('not_enrolled', 'pending_enrollment', 'recovery_required');
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then return false; end if;
  delete from private.mfa_recovery_codes where profile_id = p_profile_id;
  return true;
end;
$$;

create or replace function public.service_activate_mfa(
  p_profile_id text,
  p_timestep bigint,
  p_recovery_code_ids uuid[],
  p_recovery_code_hashes text[]
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(array_length(p_recovery_code_ids, 1), 0) = 0
     or array_length(p_recovery_code_ids, 1) <> array_length(p_recovery_code_hashes, 1) then
    return false;
  end if;
  update private.mfa_factors set state = 'active', enrolled_at = now(),
    last_used_timestep = p_timestep, updated_at = now()
  where profile_id = p_profile_id and state = 'pending_enrollment';
  if not found then return false; end if;
  delete from private.mfa_recovery_codes where profile_id = p_profile_id;
  insert into private.mfa_recovery_codes(id, profile_id, code_hash)
  select ids.id, p_profile_id, hashes.code_hash
  from unnest(p_recovery_code_ids) with ordinality ids(id, ord)
  join unnest(p_recovery_code_hashes) with ordinality hashes(code_hash, ord) using (ord);
  return true;
end;
$$;

create or replace function public.service_record_mfa_timestep(
  p_profile_id text,
  p_timestep bigint
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_updated integer;
begin
  update private.mfa_factors set last_used_timestep = p_timestep, updated_at = now()
  where profile_id = p_profile_id and state = 'active'
    and (last_used_timestep is null or last_used_timestep < p_timestep);
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.service_consume_mfa_recovery_code(
  p_profile_id text,
  p_code_hash text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_updated integer;
begin
  update private.mfa_recovery_codes set used_at = now()
  where profile_id = p_profile_id and code_hash = p_code_hash and used_at is null;
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.service_set_session_assurance(
  p_session_id uuid,
  p_profile_id text,
  p_step_up boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_updated integer;
begin
  update private.auth_sessions set assurance_level = 2, mfa_verified_at = now(),
    step_up_at = case when p_step_up then now() else step_up_at end,
    last_seen_at = now()
  where id = p_session_id and profile_id = p_profile_id
    and revoked_at is null and expires_at > now();
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.service_reset_mfa(
  p_profile_id text,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.mfa_factors(profile_id, state, reset_at, updated_at)
  values (p_profile_id, 'recovery_required', now(), now())
  on conflict (profile_id) do update set
    state = 'recovery_required', secret_ciphertext = null, secret_iv = null,
    secret_key_version = null, last_used_timestep = null, reset_at = now(), updated_at = now();
  delete from private.mfa_recovery_codes where profile_id = p_profile_id;
  perform public.service_revoke_all_auth_sessions(p_profile_id, coalesce(p_reason, 'mfa_reset'), null);
  return true;
end;
$$;

create or replace function public.service_cleanup_auth_security()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_tokens integer; v_sessions integer; v_codes integer;
begin
  delete from private.refresh_tokens
  where expires_at < now() - interval '7 days'
     or (revoked_at is not null and revoked_at < now() - interval '30 days');
  get diagnostics v_tokens = row_count;
  delete from private.auth_sessions
  where expires_at < now() - interval '7 days'
     or (revoked_at is not null and revoked_at < now() - interval '30 days');
  get diagnostics v_sessions = row_count;
  delete from private.mfa_recovery_codes
  where used_at is not null and used_at < now() - interval '30 days';
  get diagnostics v_codes = row_count;
  return jsonb_build_object('refresh_tokens', v_tokens, 'sessions', v_sessions, 'recovery_codes', v_codes);
end;
$$;

revoke all on function public.service_read_account_credential(text) from public, anon, authenticated;
revoke all on function public.service_write_account_credential(text, text, boolean) from public, anon, authenticated;
revoke all on function public.service_create_auth_session(uuid, uuid, uuid, text, text, timestamptz, timestamptz, text, text, smallint, timestamptz, timestamptz, integer) from public, anon, authenticated;
revoke all on function public.service_get_auth_session(uuid, text) from public, anon, authenticated;
revoke all on function public.service_rotate_refresh_token(text, uuid, text, timestamptz, text, text) from public, anon, authenticated;
revoke all on function public.service_revoke_auth_session(uuid, text, text) from public, anon, authenticated;
revoke all on function public.service_revoke_all_auth_sessions(text, text, uuid) from public, anon, authenticated;
revoke all on function public.service_list_auth_sessions(text, uuid) from public, anon, authenticated;
revoke all on function public.service_read_mfa_factor(text) from public, anon, authenticated;
revoke all on function public.service_begin_mfa_enrollment(text, text, text, smallint) from public, anon, authenticated;
revoke all on function public.service_activate_mfa(text, bigint, uuid[], text[]) from public, anon, authenticated;
revoke all on function public.service_record_mfa_timestep(text, bigint) from public, anon, authenticated;
revoke all on function public.service_consume_mfa_recovery_code(text, text) from public, anon, authenticated;
revoke all on function public.service_set_session_assurance(uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.service_reset_mfa(text, text) from public, anon, authenticated;
revoke all on function public.service_cleanup_auth_security() from public, anon, authenticated;

grant execute on function public.service_read_account_credential(text) to service_role;
grant execute on function public.service_write_account_credential(text, text, boolean) to service_role;
grant execute on function public.service_create_auth_session(uuid, uuid, uuid, text, text, timestamptz, timestamptz, text, text, smallint, timestamptz, timestamptz, integer) to service_role;
grant execute on function public.service_get_auth_session(uuid, text) to service_role;
grant execute on function public.service_rotate_refresh_token(text, uuid, text, timestamptz, text, text) to service_role;
grant execute on function public.service_revoke_auth_session(uuid, text, text) to service_role;
grant execute on function public.service_revoke_all_auth_sessions(text, text, uuid) to service_role;
grant execute on function public.service_list_auth_sessions(text, uuid) to service_role;
grant execute on function public.service_read_mfa_factor(text) to service_role;
grant execute on function public.service_begin_mfa_enrollment(text, text, text, smallint) to service_role;
grant execute on function public.service_activate_mfa(text, bigint, uuid[], text[]) to service_role;
grant execute on function public.service_record_mfa_timestep(text, bigint) to service_role;
grant execute on function public.service_consume_mfa_recovery_code(text, text) to service_role;
grant execute on function public.service_set_session_assurance(uuid, text, boolean) to service_role;
grant execute on function public.service_reset_mfa(text, text) to service_role;
grant execute on function public.service_cleanup_auth_security() to service_role;

commit;
