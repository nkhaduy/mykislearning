-- Employee login identities, selectable role grants, and encrypted password
-- escrow. Password hashes remain the only authentication verifier.

begin;

do $$
begin
  if to_regclass('public.profiles') is null
     or to_regclass('private.account_credentials') is null
     or to_regclass('private.auth_sessions') is null
     or to_regclass('private.refresh_tokens') is null then
    raise exception 'employee account auth requires profiles and auth security tables';
  end if;
end $$;

create table if not exists private.account_login_identities (
  profile_id text primary key references public.profiles(id) on delete cascade,
  username text not null unique,
  updated_at timestamptz not null default now(),
  check (username = lower(username)),
  check (username ~ '^[a-z0-9._-]{1,80}$')
);

create table if not exists private.account_role_grants (
  profile_id text not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('employee', 'hr')),
  granted_at timestamptz not null default now(),
  primary key (profile_id, role)
);

create table if not exists private.password_escrow (
  profile_id text primary key references public.profiles(id) on delete cascade,
  ciphertext text not null,
  iv text not null,
  key_version text not null,
  updated_at timestamptz not null default now()
);

alter table private.auth_sessions
  add column if not exists effective_role text;

alter table private.auth_sessions
  drop constraint if exists auth_sessions_effective_role_check;
alter table private.auth_sessions
  add constraint auth_sessions_effective_role_check
  check (effective_role in ('employee', 'hr'));

alter table private.account_login_identities enable row level security;
alter table private.account_role_grants enable row level security;
alter table private.password_escrow enable row level security;
revoke all on private.account_login_identities from public, anon, authenticated;
revoke all on private.account_role_grants from public, anon, authenticated;
revoke all on private.password_escrow from public, anon, authenticated;
grant select, insert, update, delete on private.account_login_identities to service_role;
grant select, insert, update, delete on private.account_role_grants to service_role;
grant select, insert, update, delete on private.password_escrow to service_role;

-- Email local-parts make predictable usernames while duplicate values receive
-- a stable profile-id suffix.
with normalized as (
  select
    p.id::text as profile_id,
    left(
      trim(both '-' from regexp_replace(
        lower(coalesce(nullif(split_part(p.email, '@', 1), ''), nullif(p.employee_code, ''), 'user')),
        '[^a-z0-9._-]+', '-', 'g'
      )),
      70
    ) as raw_username
  from public.profiles p
), based as (
  select profile_id, coalesce(nullif(raw_username, ''), 'user') as base_username
  from normalized
), ranked as (
  select
    profile_id,
    base_username,
    row_number() over (partition by base_username order by profile_id) as duplicate_rank
  from based
)
insert into private.account_login_identities(profile_id, username)
select
  profile_id,
  case
    when duplicate_rank = 1 then base_username
    else left(base_username, 70) || '-' || left(md5(profile_id), 8)
  end
from ranked
on conflict (profile_id) do nothing;

insert into private.account_role_grants(profile_id, role)
select p.id::text, p.role
from public.profiles p
where p.role in ('employee', 'hr')
on conflict do nothing;

-- The requested operational account can enter either application surface.
insert into private.account_role_grants(profile_id, role)
select i.profile_id, granted.role
from private.account_login_identities i
cross join (values ('employee'), ('hr')) as granted(role)
where i.username = 'nkhaduy'
on conflict do nothing;

update private.auth_sessions s
set effective_role = p.role
from public.profiles p
where p.id = s.profile_id
  and s.effective_role is null
  and p.role in ('employee', 'hr');

update private.auth_sessions s
set effective_role = g.role
from lateral (
  select role
  from private.account_role_grants candidate
  where candidate.profile_id = s.profile_id
  order by case candidate.role when 'employee' then 1 else 2 end
  limit 1
) g
where s.effective_role is null;

alter table private.auth_sessions
  alter column effective_role set not null;

create index if not exists account_role_grants_role_profile_idx
  on private.account_role_grants(role, profile_id);
create index if not exists account_login_identities_username_idx
  on private.account_login_identities(username);

create or replace function private.sync_profile_login_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base text;
  v_username text;
begin
  v_base := left(trim(both '-' from regexp_replace(
    lower(coalesce(nullif(split_part(new.email, '@', 1), ''), nullif(new.employee_code, ''), 'user')),
    '[^a-z0-9._-]+', '-', 'g'
  )), 70);
  v_base := coalesce(nullif(v_base, ''), 'user');
  v_username := v_base;

  if exists (
    select 1 from private.account_login_identities i
    where i.username = v_username and i.profile_id <> new.id::text
  ) then
    v_username := left(v_base, 70) || '-' || left(md5(new.id::text), 8);
  end if;

  insert into private.account_login_identities(profile_id, username, updated_at)
  values (new.id::text, v_username, now())
  on conflict (profile_id) do update set
    username = excluded.username,
    updated_at = now();

  delete from private.account_role_grants where profile_id = new.id::text;
  if v_username = 'nkhaduy' then
    insert into private.account_role_grants(profile_id, role)
    values (new.id::text, 'employee'), (new.id::text, 'hr');
  elsif new.role in ('employee', 'hr') then
    insert into private.account_role_grants(profile_id, role)
    values (new.id::text, new.role);
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_sync_login_access on public.profiles;
create trigger profiles_sync_login_access
after insert or update of email, employee_code, role on public.profiles
for each row execute function private.sync_profile_login_access();

create or replace function public.service_resolve_login_identity(p_identifier text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_count integer;
begin
  with candidates as (
    select p.id::text as profile_id, 1 as match_rank
    from public.profiles p
    where lower(p.email) = lower(btrim(p_identifier))
    union all
    select i.profile_id, 2 as match_rank
    from private.account_login_identities i
    where lower(i.username) = lower(btrim(p_identifier))
    union all
    select p.id::text as profile_id, 3 as match_rank
    from public.profiles p
    where lower(coalesce(p.employee_code, '')) = lower(btrim(p_identifier))
  ), best_rank as (
    select min(match_rank) as match_rank from candidates
  ), matches as (
    select distinct c.profile_id
    from candidates c
    join best_rank b on b.match_rank = c.match_rank
  )
  select count(*) into v_count from matches;

  if v_count = 0 then
    return jsonb_build_object('status', 'not_found');
  end if;
  if v_count > 1 then
    return jsonb_build_object('status', 'ambiguous');
  end if;

  with candidates as (
    select p.id::text as profile_id, 1 as match_rank
    from public.profiles p
    where lower(p.email) = lower(btrim(p_identifier))
    union all
    select i.profile_id, 2 as match_rank
    from private.account_login_identities i
    where lower(i.username) = lower(btrim(p_identifier))
    union all
    select p.id::text as profile_id, 3 as match_rank
    from public.profiles p
    where lower(coalesce(p.employee_code, '')) = lower(btrim(p_identifier))
  ), selected as (
    select profile_id
    from candidates
    order by match_rank
    limit 1
  )
  select jsonb_build_object(
    'status', 'found',
    'id', p.id::text,
    'employee_code', p.employee_code,
    'full_name', p.full_name,
    'email', p.email,
    'account_status', p.account_status,
    'password_status', p.password_status,
    'failed_login_count', p.failed_login_count,
    'locked_until', p.locked_until,
    'username', i.username,
    'allowed_roles', coalesce((
      select jsonb_agg(g.role order by case g.role when 'employee' then 1 else 2 end)
      from private.account_role_grants g
      where g.profile_id = p.id
    ), '[]'::jsonb)
  ) into v_result
  from selected s
  join public.profiles p on p.id = s.profile_id
  left join private.account_login_identities i on i.profile_id = p.id;

  return v_result;
end;
$$;

create or replace function public.service_list_employee_accounts(
  p_search text default '',
  p_status text default '',
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id text,
  employee_code text,
  full_name text,
  email text,
  username text,
  department text,
  position text,
  account_status text,
  password_status text,
  must_change boolean,
  password_reveal_status text,
  total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id::text,
    p.employee_code,
    p.full_name,
    p.email,
    i.username,
    p.department,
    p.position,
    p.account_status,
    p.password_status,
    coalesce(c.must_change, false),
    case when e.profile_id is null then 'unavailable_until_reset' else 'available' end,
    count(*) over()
  from public.profiles p
  join private.account_role_grants g
    on g.profile_id = p.id and g.role = 'employee'
  left join private.account_login_identities i on i.profile_id = p.id
  left join private.account_credentials c on c.profile_id = p.id
  left join private.password_escrow e on e.profile_id = p.id
  where (coalesce(p_status, '') = '' or p.account_status = p_status)
    and (
      coalesce(p_search, '') = ''
      or lower(coalesce(p.full_name, '')) like '%' || lower(btrim(p_search)) || '%'
      or lower(coalesce(p.employee_code, '')) like '%' || lower(btrim(p_search)) || '%'
      or lower(coalesce(p.email, '')) like '%' || lower(btrim(p_search)) || '%'
      or lower(coalesce(i.username, '')) like '%' || lower(btrim(p_search)) || '%'
    )
  order by lower(p.full_name), p.id::text
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.service_read_password_escrow(p_profile_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'profile_id', e.profile_id,
    'ciphertext', e.ciphertext,
    'iv', e.iv,
    'key_version', e.key_version,
    'updated_at', e.updated_at
  )
  from private.password_escrow e
  join private.account_role_grants g
    on g.profile_id = e.profile_id and g.role = 'employee'
  where e.profile_id = p_profile_id;
$$;

create or replace function public.service_write_credential_bundle(
  p_profile_id text,
  p_password_hash text,
  p_must_change boolean,
  p_ciphertext text,
  p_iv text,
  p_key_version text
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

  insert into private.password_escrow(profile_id, ciphertext, iv, key_version, updated_at)
  values (p_profile_id, p_ciphertext, p_iv, p_key_version, now())
  on conflict (profile_id) do update set
    ciphertext = excluded.ciphertext,
    iv = excluded.iv,
    key_version = excluded.key_version,
    updated_at = now();

  return true;
end;
$$;

create or replace function public.service_write_login_username(
  p_profile_id text,
  p_username text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text := lower(btrim(p_username));
begin
  if v_username !~ '^[a-z0-9._-]{1,80}$' then
    raise exception 'INVALID_USERNAME';
  end if;
  insert into private.account_login_identities(profile_id, username, updated_at)
  values (p_profile_id, v_username, now())
  on conflict (profile_id) do update set username = excluded.username, updated_at = now();
  return true;
end;
$$;

drop function if exists public.service_create_auth_session(
  uuid, uuid, uuid, text, text, timestamptz, timestamptz, text, text, integer
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
  p_effective_role text,
  p_max_sessions integer default 10
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_credential_version bigint;
begin
  select p.account_status, c.credential_version
  into v_status, v_credential_version
  from public.profiles p
  join private.account_credentials c on c.profile_id = p.id
  where p.id = p_profile_id
  for update of p;

  if not found or coalesce(v_status, 'active') <> 'active' then
    return jsonb_build_object('status', 'account_unavailable');
  end if;
  if p_effective_role not in ('employee', 'hr') or not exists (
    select 1 from private.account_role_grants g
    where g.profile_id = p_profile_id and g.role = p_effective_role
  ) then
    return jsonb_build_object('status', 'role_not_granted');
  end if;

  insert into private.auth_sessions(
    id, token_family_id, profile_id, credential_version, effective_role,
    expires_at, created_ip_hash, last_ip_hash, user_agent
  ) values (
    p_session_id, p_family_id, p_profile_id, v_credential_version, p_effective_role,
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
    'profile_id', p_profile_id, 'role', p_effective_role,
    'credential_version', v_credential_version
  );
end;
$$;

create or replace function public.service_get_auth_session(p_session_id uuid, p_profile_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session private.auth_sessions%rowtype;
  v_status text;
  v_credential_version bigint;
begin
  select * into v_session from private.auth_sessions
  where id = p_session_id and profile_id = p_profile_id;
  if not found then return jsonb_build_object('valid', false, 'reason', 'not_found'); end if;

  select p.account_status, c.credential_version
  into v_status, v_credential_version
  from public.profiles p
  join private.account_credentials c on c.profile_id = p.id
  where p.id = v_session.profile_id;

  if not found or not exists (
    select 1 from private.account_role_grants g
    where g.profile_id = v_session.profile_id and g.role = v_session.effective_role
  ) then
    update private.auth_sessions set revoked_at = coalesce(revoked_at, now()),
      revocation_reason = coalesce(revocation_reason, 'invalid_role')
    where id = p_session_id and revoked_at is null;
    update private.refresh_tokens set revoked_at = coalesce(revoked_at, now()),
      revocation_reason = coalesce(revocation_reason, 'invalid_role')
    where session_id = p_session_id and revoked_at is null;
    return jsonb_build_object('valid', false, 'reason', 'invalid_role');
  end if;
  if v_session.revoked_at is not null then
    return jsonb_build_object('valid', false, 'reason', coalesce(v_session.revocation_reason, 'revoked'));
  end if;
  if v_session.expires_at <= now() then return jsonb_build_object('valid', false, 'reason', 'expired'); end if;
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
    'valid', true, 'session_id', v_session.id,
    'family_id', v_session.token_family_id, 'profile_id', v_session.profile_id,
    'role', v_session.effective_role, 'expires_at', v_session.expires_at
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
  v_status text;
  v_credential_version bigint;
begin
  select * into v_token from private.refresh_tokens where token_hash = p_token_hash for update;
  if not found then return jsonb_build_object('status', 'invalid'); end if;
  select * into v_session from private.auth_sessions where id = v_token.session_id for update;
  if not found then return jsonb_build_object('status', 'revoked'); end if;
  select p.account_status, c.credential_version into v_status, v_credential_version
  from public.profiles p join private.account_credentials c on c.profile_id = p.id
  where p.id = v_session.profile_id;
  if not found then return jsonb_build_object('status', 'account_unavailable'); end if;

  if v_token.rotated_at is not null or v_token.replaced_by_token_id is not null then
    update private.auth_sessions set revoked_at = coalesce(revoked_at, now()),
      revocation_reason = coalesce(revocation_reason, 'refresh_reuse')
    where token_family_id = v_token.token_family_id;
    update private.refresh_tokens set revoked_at = coalesce(revoked_at, now()),
      revocation_reason = coalesce(revocation_reason, 'refresh_reuse')
    where token_family_id = v_token.token_family_id;
    return jsonb_build_object('status', 'reuse_detected', 'profile_id', v_token.profile_id,
      'session_id', v_token.session_id, 'family_id', v_token.token_family_id);
  end if;
  if v_token.revoked_at is not null or v_session.revoked_at is not null then return jsonb_build_object('status', 'revoked'); end if;
  if v_token.expires_at <= now() or v_session.expires_at <= now() then return jsonb_build_object('status', 'expired'); end if;
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
  if not exists (
    select 1 from private.account_role_grants g
    where g.profile_id = v_session.profile_id and g.role = v_session.effective_role
  ) then
    update private.auth_sessions set revoked_at = now(), revocation_reason = 'invalid_role'
    where id = v_session.id and revoked_at is null;
    update private.refresh_tokens set revoked_at = now(), revocation_reason = 'invalid_role'
    where token_family_id = v_token.token_family_id and revoked_at is null;
    return jsonb_build_object('status', 'invalid_role');
  end if;

  insert into private.refresh_tokens(
    id, session_id, token_family_id, profile_id, token_hash, parent_token_id,
    expires_at, ip_hash, user_agent
  ) values (
    p_new_token_id, v_token.session_id, v_token.token_family_id, v_token.profile_id,
    p_new_token_hash, v_token.id, least(p_new_expires_at, v_session.expires_at),
    p_ip_hash, left(p_user_agent, 256)
  );
  update private.refresh_tokens set last_used_at = now(), rotated_at = now(),
    replaced_by_token_id = p_new_token_id where id = v_token.id;
  update private.auth_sessions set last_seen_at = now(), last_ip_hash = p_ip_hash,
    user_agent = left(p_user_agent, 256) where id = v_session.id;

  return jsonb_build_object(
    'status', 'rotated', 'profile_id', v_token.profile_id,
    'session_id', v_token.session_id, 'family_id', v_token.token_family_id,
    'role', v_session.effective_role, 'session_expires_at', v_session.expires_at
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

revoke all on function public.service_resolve_login_identity(text) from public, anon, authenticated;
revoke all on function public.service_list_employee_accounts(text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.service_read_password_escrow(text) from public, anon, authenticated;
revoke all on function public.service_write_credential_bundle(text, text, boolean, text, text, text) from public, anon, authenticated;
revoke all on function public.service_write_login_username(text, text) from public, anon, authenticated;
revoke all on function public.service_create_auth_session(uuid, uuid, uuid, text, text, timestamptz, timestamptz, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.service_get_auth_session(uuid, text) from public, anon, authenticated;
revoke all on function public.service_rotate_refresh_token(text, uuid, text, timestamptz, text, text) from public, anon, authenticated;

grant execute on function public.service_resolve_login_identity(text) to service_role;
grant execute on function public.service_list_employee_accounts(text, text, integer, integer) to service_role;
grant execute on function public.service_read_password_escrow(text) to service_role;
grant execute on function public.service_write_credential_bundle(text, text, boolean, text, text, text) to service_role;
grant execute on function public.service_write_login_username(text, text) to service_role;
grant execute on function public.service_create_auth_session(uuid, uuid, uuid, text, text, timestamptz, timestamptz, text, text, text, integer) to service_role;
grant execute on function public.service_get_auth_session(uuid, text) to service_role;
grant execute on function public.service_rotate_refresh_token(text, uuid, text, timestamptz, text, text) to service_role;

commit;
