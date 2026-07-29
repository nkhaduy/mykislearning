-- Canonical application role contract (2026-07-29).
-- This migration is additive/idempotent and intentionally does not rewrite
-- previously released migration files.
begin;

-- Legacy Admin is the same identity as HR; preserve all IDs and history.
update public.profiles set role = 'hr', updated_at = now() where role = 'admin';

-- Trainer must be removed from application data before the role constraint is
-- tightened. References indicate incomplete clean-reset/rehearsal input.
do $$
declare
  trainer_count bigint := 0;
  ref_count bigint := 0;
  item record;
begin
  if to_regclass('public.profiles') is null then return; end if;
  select count(*) into trainer_count from public.profiles where role = 'trainer';
  if trainer_count = 0 then return; end if;

  -- Session revocation preserves the existing session semantics when the
  -- private session store is present.
  if to_regclass('private.auth_sessions') is not null then
    execute $sql$update private.auth_sessions set revoked_at = coalesce(revoked_at, now()), revocation_reason = coalesce(revocation_reason, 'legacy_trainer_removed') where profile_id in (select id from public.profiles where role = 'trainer')$sql$;
    if to_regclass('private.refresh_tokens') is not null then
      execute $sql$update private.refresh_tokens set revoked_at = coalesce(revoked_at, now()), revocation_reason = coalesce(revocation_reason, 'legacy_trainer_removed') where profile_id in (select id from public.profiles where role = 'trainer')$sql$;
    end if;
  end if;

  -- Let clean-reset own business-data removal. Refuse to guess at restrictive
  -- foreign keys so Trainer is never silently reassigned to Employee/HR.
  for item in
    select distinct tc.table_schema, tc.table_name, kcu.column_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
    join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
    where tc.constraint_type = 'FOREIGN KEY'
      and ccu.table_schema = 'public' and ccu.table_name = 'profiles' and ccu.column_name = 'id'
      and tc.table_schema = 'public' and tc.table_name <> 'profiles'
  loop
    execute format('select count(*) from %I.%I child join public.profiles parent on parent.id = child.%I where parent.role = ''trainer''', item.table_schema, item.table_name, item.column_name) into ref_count;
    if ref_count > 0 then
      raise exception 'legacy trainer references remain in %.% column % (% rows); run clean reset before role consolidation', item.table_schema, item.table_name, item.column_name, ref_count;
    end if;
  end loop;

  if to_regclass('public.user_roles') is not null then
    delete from public.user_roles where role = 'trainer' or account_id in (select id from public.profiles where role = 'trainer');
  end if;
  delete from public.profiles where role = 'trainer';
end $$;

-- Canonicalize role lookup rows and enforce exactly two values.
do $$
begin
  if to_regclass('public.user_roles') is not null then
    delete from public.user_roles legacy
    where legacy.role = 'admin'
      and exists (select 1 from public.user_roles canonical where canonical.account_id = legacy.account_id and canonical.role = 'hr');
    update public.user_roles set role = 'hr' where role = 'admin';
    delete from public.user_roles where role not in ('hr', 'employee');
    alter table public.user_roles drop constraint if exists user_roles_role_check;
    alter table public.user_roles add constraint user_roles_role_check check (role in ('hr', 'employee'));
  end if;
end $$;

-- Replace every released profiles role check without changing the column type.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.profiles'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format('alter table public.profiles drop constraint if exists %I', c.conname);
  end loop;
end $$;
alter table public.profiles add constraint profiles_role_canonical_check check (role in ('hr', 'employee'));

create or replace function public.get_my_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = (select auth.uid())::text;
$$;

do $$
begin
  if to_regclass('public.user_roles') is not null then
    execute $fn$
      create or replace function public.has_role(required_role text)
      returns boolean language sql stable security definer set search_path = public as $body$
        select required_role in ('hr', 'employee')
          and exists (select 1 from public.user_roles where account_id = (select auth.uid())::text and role = required_role);
      $body$;
    $fn$;
  else
    execute $fn$
      create or replace function public.has_role(required_role text)
      returns boolean language sql stable security definer set search_path = public as $body$
        select false;
      $body$;
    $fn$;
  end if;
end $$;

create or replace function public.is_hr_or_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.get_my_role() = 'hr', false);
$$;

-- Policies that previously granted Admin-only privileges now grant the same
-- highest-level capability to HR.
drop policy if exists "profiles_delete_admin" on public.profiles;
create policy "profiles_delete_hr" on public.profiles for delete to authenticated
  using (public.get_my_role() = 'hr');

do $$
begin
  if to_regclass('public.system_settings') is not null then
    drop policy if exists "system_settings_manage_admin" on public.system_settings;
    drop policy if exists "system_settings_manage_hr" on public.system_settings;
    create policy "system_settings_manage_hr" on public.system_settings for all to authenticated
      using (public.get_my_role() = 'hr') with check (public.get_my_role() = 'hr');
  end if;
  if to_regclass('public.user_activity') is not null then
    drop policy if exists "user_activity_hr_select" on public.user_activity;
    create policy "user_activity_hr_select" on public.user_activity for select to authenticated
      using (public.get_my_role() = 'hr' or account_id = (select auth.uid())::text);
  end if;
  if to_regclass('public.hr_tasks') is not null then
    drop policy if exists "hr_tasks_requester_select" on public.hr_tasks;
    create policy "hr_tasks_requester_select" on public.hr_tasks for select to authenticated
      using (requester_account_id = (select auth.uid())::text or public.get_my_role() = 'hr');
    drop policy if exists "hr_tasks_manage_hr" on public.hr_tasks;
    create policy "hr_tasks_manage_hr" on public.hr_tasks for update to authenticated
      using (public.get_my_role() = 'hr') with check (public.get_my_role() = 'hr');
  end if;
end $$;

do $$
begin
  if to_regprocedure('public.service_authorize_export_requester(text)') is not null then
    execute $fn$
      create or replace function public.service_authorize_export_requester(p_requester_id text)
      returns jsonb language sql stable security definer set search_path = '' as $body$
        select jsonb_build_object(
          'active', p.account_status = 'active' and p.role = 'hr' and c.profile_id is not null,
          'role', p.role,
          'account_status', p.account_status,
          'credential_version', c.credential_version
        )
        from public.profiles p
        left join private.account_credentials c on c.profile_id = p.id
        where p.id::text = p_requester_id;
      $body$;
    $fn$;
  end if;
end $$;

-- Keep JWT/session role data fail-closed if a malformed legacy row is ever
-- introduced outside this migration.
do $$
begin
  if to_regprocedure('public.service_get_auth_session(uuid,text)') is not null then
    execute $fn$
      create or replace function public.service_get_auth_session(p_session_id uuid, p_profile_id text)
      returns jsonb language plpgsql security definer set search_path = '' as $body$
      declare v_session private.auth_sessions%rowtype; v_role text; v_status text; v_credential_version bigint;
      begin
        select * into v_session from private.auth_sessions where id = p_session_id and profile_id = p_profile_id;
        if not found then return jsonb_build_object('valid', false, 'reason', 'not_found'); end if;
        select p.role, p.account_status, c.credential_version into v_role, v_status, v_credential_version
        from public.profiles p join private.account_credentials c on c.profile_id = p.id where p.id = v_session.profile_id;
        if not found or v_role not in ('hr','employee') then
          update private.auth_sessions set revoked_at = coalesce(revoked_at, now()), revocation_reason = coalesce(revocation_reason, 'invalid_role') where id = p_session_id and revoked_at is null;
          update private.refresh_tokens set revoked_at = coalesce(revoked_at, now()), revocation_reason = coalesce(revocation_reason, 'invalid_role') where session_id = p_session_id and revoked_at is null;
          return jsonb_build_object('valid', false, 'reason', 'invalid_role');
        end if;
        if v_session.revoked_at is not null then return jsonb_build_object('valid', false, 'reason', coalesce(v_session.revocation_reason, 'revoked')); end if;
        if v_session.expires_at <= now() then return jsonb_build_object('valid', false, 'reason', 'expired'); end if;
        if coalesce(v_status, 'active') <> 'active' then
          update private.auth_sessions set revoked_at = now(), revocation_reason = 'account_disabled' where id = p_session_id and revoked_at is null;
          update private.refresh_tokens set revoked_at = now(), revocation_reason = 'account_disabled' where session_id = p_session_id and revoked_at is null;
          return jsonb_build_object('valid', false, 'reason', 'account_disabled');
        end if;
        if v_session.credential_version <> v_credential_version then
          update private.auth_sessions set revoked_at = now(), revocation_reason = 'credential_changed' where id = p_session_id and revoked_at is null;
          update private.refresh_tokens set revoked_at = now(), revocation_reason = 'credential_changed' where session_id = p_session_id and revoked_at is null;
          return jsonb_build_object('valid', false, 'reason', 'credential_changed');
        end if;
        update private.auth_sessions set last_seen_at = now() where id = p_session_id;
        return jsonb_build_object('valid', true, 'session_id', v_session.id, 'family_id', v_session.token_family_id, 'profile_id', v_session.profile_id, 'role', v_role, 'expires_at', v_session.expires_at);
      end;
      $body$;
    $fn$;
  end if;
end $$;

commit;
