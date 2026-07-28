-- SEC-002, SEC-004, SEC-011: canonical private-data containment.
-- Apply only after a verified backup and catalog snapshot. This migration is
-- intentionally fail-closed for direct Supabase REST access; the Worker uses
-- service_role and enforces application authorization.

begin;

do $$
begin
  if to_regclass('public.profiles') is null then
    raise exception 'security containment requires public.profiles';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'id'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'avatar_url'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'password_status'
  ) then
    raise exception 'security containment requires profiles.id, profiles.avatar_url, and profiles.password_status';
  end if;

  if exists (
    select 1
    from unnest(array['anon', 'authenticated', 'service_role']) required_role
    where not exists (select 1 from pg_roles where rolname = required_role)
  ) then
    raise exception 'security containment requires anon, authenticated, and service_role roles';
  end if;
end $$;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create table if not exists private.account_credentials (
  profile_id text primary key,
  password_hash text not null check (
    password_hash like 'pbkdf2$%'
    or password_hash like 'pbkdf2-sha256$%'
    or password_hash like 'reset:pbkdf2$%'
    or password_hash like 'reset:pbkdf2-sha256$%'
  ),
  must_change boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table private.account_credentials enable row level security;
revoke all on private.account_credentials from public, anon, authenticated;
grant select, insert, update, delete on private.account_credentials to service_role;

create table if not exists private.revoked_sessions (
  session_id text primary key,
  profile_id text not null,
  revoked_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists revoked_sessions_expires_idx on private.revoked_sessions(expires_at);
alter table private.revoked_sessions enable row level security;
revoke all on private.revoked_sessions from public, anon, authenticated;
grant select, insert, update, delete on private.revoked_sessions to service_role;

create table if not exists private.bootstrap_state (
  id boolean primary key default true check (id),
  consumed_at timestamptz,
  consumed_by text
);
alter table private.bootstrap_state enable row level security;
revoke all on private.bootstrap_state from public, anon, authenticated;
grant select, insert, update on private.bootstrap_state to service_role;

-- The private schema is intentionally not exposed through PostgREST. The
-- Worker reaches these stores through service-role-only RPC functions.
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
    'must_change', c.must_change
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
  insert into private.account_credentials(profile_id, password_hash, must_change, updated_at)
  values (p_profile_id, p_password_hash, coalesce(p_must_change, false), now())
  on conflict (profile_id) do update set
    password_hash = excluded.password_hash,
    must_change = excluded.must_change,
    updated_at = now();
  return true;
end;
$$;

create or replace function public.service_is_session_revoked(p_session_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1 from private.revoked_sessions r where r.session_id = p_session_id
  );
$$;

create or replace function public.service_revoke_session(
  p_session_id text,
  p_profile_id text,
  p_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.revoked_sessions(session_id, profile_id, expires_at)
  values (p_session_id, p_profile_id, p_expires_at)
  on conflict (session_id) do update set
    profile_id = excluded.profile_id,
    revoked_at = now(),
    expires_at = excluded.expires_at;
  return true;
end;
$$;

create or replace function public.service_bootstrap_status()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'consumed_at', b.consumed_at,
    'consumed_by', b.consumed_by
  )
  from private.bootstrap_state b
  where b.id = true;
$$;

create or replace function public.service_claim_bootstrap(p_profile_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed boolean;
begin
  insert into private.bootstrap_state(id, consumed_at, consumed_by)
  values (true, now(), p_profile_id)
  on conflict (id) do update set
    consumed_at = excluded.consumed_at,
    consumed_by = excluded.consumed_by
  where private.bootstrap_state.consumed_at is null
  returning true into claimed;
  return coalesce(claimed, false);
end;
$$;

revoke all on function public.service_read_account_credential(text) from public, anon, authenticated;
revoke all on function public.service_write_account_credential(text, text, boolean) from public, anon, authenticated;
revoke all on function public.service_is_session_revoked(text) from public, anon, authenticated;
revoke all on function public.service_revoke_session(text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.service_bootstrap_status() from public, anon, authenticated;
revoke all on function public.service_claim_bootstrap(text) from public, anon, authenticated;
grant execute on function public.service_read_account_credential(text) to service_role;
grant execute on function public.service_write_account_credential(text, text, boolean) to service_role;
grant execute on function public.service_is_session_revoked(text) to service_role;
grant execute on function public.service_revoke_session(text, text, timestamptz) to service_role;
grant execute on function public.service_bootstrap_status() to service_role;
grant execute on function public.service_claim_bootstrap(text) to service_role;

-- Migrate both legacy profile-field formats without reproducing hashes in logs.
insert into private.account_credentials(profile_id, password_hash, must_change)
select
  id::text,
  case
    when left(avatar_url, length('__pwd__:')) = '__pwd__:' then substring(avatar_url from length('__pwd__:') + 1)
    else password_status
  end,
  case
    when left(avatar_url, length('__pwd__:reset:')) = '__pwd__:reset:' then true
    when password_status like 'reset:%' then true
    else false
  end
from public.profiles
where left(avatar_url, length('__pwd__:')) = '__pwd__:'
   or password_status like 'pbkdf2$%'
   or password_status like 'pbkdf2-sha256$%'
   or password_status like 'reset:pbkdf2$%'
   or password_status like 'reset:pbkdf2-sha256$%'
on conflict (profile_id) do nothing;

-- Remove credential material from fields returned by profile APIs.
update public.profiles
set avatar_url = null
where left(avatar_url, length('__pwd__:')) = '__pwd__:';

update public.profiles
set password_status = case
  when password_status like 'reset:%' then 'resetRequired'
  else 'normal'
end
where password_status like 'pbkdf2$%'
   or password_status like 'pbkdf2-sha256$%'
   or password_status like 'reset:pbkdf2$%'
   or password_status like 'reset:pbkdf2-sha256$%';

-- The custom Worker JWT is not a Supabase Auth JWT, so auth.uid()-based direct
-- REST policies cannot safely represent the application identity. Revoke all
-- browser roles and require access through the Worker/service layer.
do $$
declare
  table_record record;
begin
  for table_record in
    select schemaname, tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('alter table %I.%I enable row level security', table_record.schemaname, table_record.tablename);
    execute format('revoke all privileges on table %I.%I from anon, authenticated', table_record.schemaname, table_record.tablename);
  end loop;
end $$;

revoke all privileges on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema private revoke all on tables from public, anon, authenticated;

-- Rollback/recovery: restore the pre-migration backup only if Worker access is
-- broken. Never restore profile/avatar hash storage or anonymous table grants.
-- If credential rows cannot be recovered, use a password-reset campaign.

commit;
