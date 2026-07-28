-- Reconcile the normalized UUID department model from migrations 001-004 with
-- the Worker-facing profiles.department text field introduced in migration 005.
-- This migration is safe for both histories: 001-first and 005-first.

begin;

select pg_advisory_xact_lock(hashtext('kis_lms_department_schema_reconciliation'));

do $$
declare
  profile_id_type text;
begin
  if to_regclass('public.profiles') is null then
    raise exception 'Department reconciliation requires public.profiles';
  end if;

  select data_type into profile_id_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'profiles' and column_name = 'id';

  if profile_id_type <> 'text' then
    raise exception 'Department reconciliation requires profiles.id TEXT after migration 006, found %', profile_id_type;
  end if;
end $$;

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.departments enable row level security;
revoke all on public.departments from anon, authenticated;
grant select, insert, update, delete on public.departments to service_role;

alter table public.profiles
  add column if not exists auth_user_id uuid,
  add column if not exists department_id uuid,
  add column if not exists department text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_auth_user_id_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_auth_user_id_fkey
      foreign key (auth_user_id) references auth.users(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_department_id_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_department_id_fkey
      foreign key (department_id) references public.departments(id) on delete set null;
  end if;
end $$;

create unique index if not exists profiles_auth_user_id_idx on public.profiles(auth_user_id);

-- UUID-linked rows are authoritative when the text value has not been filled.
update public.profiles profile
set department = department.name
from public.departments department
where profile.department_id = department.id
  and nullif(btrim(profile.department), '') is null;

do $$
declare
  conflict_count bigint;
begin
  select count(*) into conflict_count
  from public.profiles profile
  join public.departments department on department.id = profile.department_id
  where nullif(btrim(profile.department), '') is not null
    and btrim(profile.department) <> department.name;

  if conflict_count > 0 then
    raise exception 'Department reconciliation found % conflicting profile mappings', conflict_count;
  end if;
end $$;

-- Text-only Worker databases receive a normalized department row and FK without
-- changing the application-visible department value.
insert into public.departments(name)
select distinct btrim(profile.department)
from public.profiles profile
where nullif(btrim(profile.department), '') is not null
on conflict (name) do nothing;

update public.profiles profile
set department_id = department.id
from public.departments department
where profile.department_id is null
  and btrim(profile.department) = department.name;

do $$
begin
  if exists (
    select 1
    from pg_class index_class
    join pg_index index_metadata on index_metadata.indexrelid = index_class.oid
    join pg_class table_class on table_class.oid = index_metadata.indrelid
    join pg_attribute attribute
      on attribute.attrelid = table_class.oid and attribute.attnum = any(index_metadata.indkey)
    where index_class.relnamespace = 'public'::regnamespace
      and index_class.relname = 'profiles_department_idx'
      and table_class.relname = 'profiles'
      and attribute.attname = 'department_id'
  ) then
    if to_regclass('public.profiles_department_id_idx') is null then
      alter index public.profiles_department_idx rename to profiles_department_id_idx;
    elsif to_regclass('public.profiles_department_id_legacy_idx') is null then
      alter index public.profiles_department_idx rename to profiles_department_id_legacy_idx;
    else
      raise exception 'Cannot preserve legacy profiles department index: target names already exist';
    end if;
  end if;
end $$;

create index if not exists profiles_department_id_idx on public.profiles(department_id);
create index if not exists profiles_department_idx on public.profiles(department);

alter table public.profiles drop constraint if exists profiles_account_status_check;
alter table public.profiles add constraint profiles_account_status_check check (account_status in (
  'active', 'pending', 'pendingActivation', 'disabled', 'locked', 'inactive', 'temporarilyLocked'
));

-- Preserve learning history from the UUID-era tables. Deterministic prefixed IDs
-- make the backfill idempotent and avoid collisions with Worker-created records.
do $$
begin
  if to_regclass('public.learning_history') is not null
    and to_regclass('public.learning_records') is not null
  then
    insert into public.learning_records(
      id, account_id, record_type, source_type, source_id, title, provider,
      completion_date, duration_hours, status, submitted_by, reviewed_by,
      submitted_at, reviewed_at, approved_at, data, created_at, updated_at
    )
    select
      'legacy-history-' || history.id::text,
      history.account_id::text,
      case history.source_type
        when 'course' then 'internal_online_course'
        when 'training_session' then 'internal_offline_training'
        else 'external_course'
      end,
      'system',
      history.id::text,
      history.title,
      history.provider,
      history.completed_at::date,
      history.learning_hours,
      'approved',
      history.account_id::text,
      null,
      history.created_at,
      history.created_at,
      history.created_at,
      coalesce(history.metadata, '{}'::jsonb) || jsonb_build_object(
        'legacyTable', 'learning_history',
        'legacySourceId', history.source_id::text
      ),
      history.created_at,
      history.created_at
    from public.learning_history history
    on conflict (id) do nothing;
  end if;

  if to_regclass('public.external_course_submissions') is not null
    and to_regclass('public.learning_records') is not null
  then
    insert into public.learning_records(
      id, account_id, record_type, source_type, source_id, title, provider,
      start_date, completion_date, duration_hours, description, status,
      submitted_by, reviewed_by, submitted_at, reviewed_at, approved_at,
      rejected_at, revision_note, rejection_reason, data, created_at, updated_at
    )
    select
      'legacy-submission-' || submission.id::text,
      submission.account_id::text,
      'external_course',
      'employee_submission',
      submission.id::text,
      submission.course_name,
      submission.provider,
      submission.start_date,
      submission.end_date,
      submission.learning_hours,
      submission.learning_content,
      case submission.status
        when 'approved' then 'approved'
        when 'needs_more_information' then 'needs_revision'
        when 'rejected' then 'rejected'
        else 'submitted'
      end,
      submission.account_id::text,
      submission.reviewed_by::text,
      submission.created_at,
      submission.reviewed_at,
      case when submission.status = 'approved' then submission.reviewed_at end,
      case when submission.status = 'rejected' then submission.reviewed_at end,
      case when submission.status = 'needs_more_information' then submission.hr_feedback end,
      case when submission.status = 'rejected' then submission.hr_feedback end,
      jsonb_build_object(
        'legacyTable', 'external_course_submissions',
        'subject', submission.subject,
        'paymentSupport', submission.payment_support,
        'certificateName', submission.certificate_name,
        'evidencePath', submission.evidence_path,
        'employeeNote', submission.employee_note,
        'cost', submission.cost
      ),
      submission.created_at,
      submission.updated_at
    from public.external_course_submissions submission
    on conflict (id) do nothing;
  end if;
end $$;

-- Validate every declared FK and fail clearly on logical orphans in the Worker
-- tables that intentionally pre-date explicit account/course constraints.
do $$
declare
  constraint_record record;
  relationship_record record;
  orphan_count bigint;
begin
  for constraint_record in
    select constraint_row.conrelid::regclass as table_name, constraint_row.conname
    from pg_constraint constraint_row
    where constraint_row.contype = 'f'
      and constraint_row.connamespace = 'public'::regnamespace
      and not constraint_row.convalidated
  loop
    execute format(
      'alter table %s validate constraint %I',
      constraint_record.table_name,
      constraint_record.conname
    );
  end loop;

  for relationship_record in
    select * from (values
      ('enrollments', 'account_id', 'profiles', 'id'),
      ('enrollments', 'course_id', 'courses', 'id'),
      ('content_progress', 'account_id', 'profiles', 'id'),
      ('content_progress', 'course_id', 'courses', 'id'),
      ('training_participants', 'account_id', 'profiles', 'id'),
      ('training_participants', 'session_id', 'training_sessions', 'id'),
      ('training_registrations', 'account_id', 'profiles', 'id'),
      ('training_registrations', 'session_id', 'training_sessions', 'id'),
      ('attendance', 'account_id', 'profiles', 'id'),
      ('notifications', 'account_id', 'profiles', 'id'),
      ('quiz_attempts', 'account_id', 'profiles', 'id'),
      ('quiz_attempts', 'quiz_id', 'quizzes', 'id'),
      ('external_training_requests', 'account_id', 'profiles', 'id'),
      ('employee_certifications', 'account_id', 'profiles', 'id'),
      ('learning_records', 'account_id', 'profiles', 'id')
    ) as relationship(child_table, child_column, parent_table, parent_column)
  loop
    if to_regclass(format('public.%I', relationship_record.child_table)) is not null
      and to_regclass(format('public.%I', relationship_record.parent_table)) is not null
    then
      execute format(
        'select count(*) from public.%I child left join public.%I parent on parent.%I::text = child.%I::text where child.%I is not null and parent.%I is null',
        relationship_record.child_table,
        relationship_record.parent_table,
        relationship_record.parent_column,
        relationship_record.child_column,
        relationship_record.child_column,
        relationship_record.parent_column
      ) into orphan_count;

      if orphan_count > 0 then
        raise exception 'Reconciliation found % orphan rows in %.%',
          orphan_count, relationship_record.child_table, relationship_record.child_column;
      end if;
    end if;
  end loop;
end $$;

do $$
declare
  unprotected_tables text;
begin
  select string_agg(table_name, ', ' order by table_name) into unprotected_tables
  from (
    select table_class.relname as table_name
    from pg_class table_class
    where table_class.relnamespace = 'public'::regnamespace
      and table_class.relkind in ('r', 'p')
      and not table_class.relrowsecurity
  ) missing_rls;

  if unprotected_tables is not null then
    raise exception 'Public tables without RLS after reconciliation: %', unprotected_tables;
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee in ('anon', 'authenticated')
  ) then
    raise exception 'anon/authenticated table privileges detected after reconciliation';
  end if;
end $$;

commit;
