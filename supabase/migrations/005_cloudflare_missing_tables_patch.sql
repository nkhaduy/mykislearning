-- 005_cloudflare_missing_tables_patch.sql
-- Compatibility patch: bổ sung bảng còn thiếu và bridge identifier types.
-- Không DROP/TRUNCATE table hoặc xóa row; các FK/policy bị ảnh hưởng được
-- drop/recreate có mục tiêu trong cùng transaction để giữ nguyên semantics.
-- Dùng text primary key để khớp với app (acc-001, acc-hr-demo, v.v.)

-- Migrations 001-004 describe the original Supabase Auth/UUID schema, while
-- this migration introduced the Worker schema with application-owned TEXT IDs.
-- Bridge that legacy shape before the CREATE TABLE IF NOT EXISTS statements
-- below. UUID values are converted to their canonical text representation; no
-- rows are deleted and public foreign keys are rebuilt with the same actions.
do $$
declare
  profile_id_type text;
  row_record record;
  changed_rows integer;
begin
  select data_type into profile_id_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'profiles' and column_name = 'id';

  if profile_id_type = 'uuid' then
    alter table public.profiles add column if not exists auth_user_id uuid;
    update public.profiles set auth_user_id = id where auth_user_id is null;

    if not exists (
      select 1 from pg_constraint
      where conrelid = 'public.profiles'::regclass
        and conname = 'profiles_auth_user_id_fkey'
    ) then
      alter table public.profiles
        add constraint profiles_auth_user_id_fkey
        foreign key (auth_user_id) references auth.users(id) on delete set null;
    end if;
    create unique index if not exists profiles_auth_user_id_idx on public.profiles(auth_user_id);

    create temporary table kis_text_id_columns (
      table_oid oid not null,
      attnum smallint not null,
      default_expression text,
      primary key (table_oid, attnum)
    ) on commit drop;

    insert into kis_text_id_columns(table_oid, attnum)
    select c.oid, a.attnum
    from (values
      ('profiles', 'id'),
      ('courses', 'id'),
      ('training_sessions', 'id'),
      ('session_slots', 'id'),
      ('qr_tokens', 'id'),
      ('attendance', 'id'),
      ('notifications', 'id'),
      ('quizzes', 'id'),
      ('quiz_attempts', 'id'),
      ('audit_logs', 'id')
    ) as target(table_name, column_name)
    join pg_class c on c.relname = target.table_name and c.relnamespace = 'public'::regnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attname = target.column_name and not a.attisdropped;

    -- Follow the FK graph so every reference to a converted identifier changes
    -- in the same transaction. This intentionally excludes profiles.department_id.
    loop
      insert into kis_text_id_columns(table_oid, attnum)
      select constraint_row.conrelid, source_key.attnum
      from pg_constraint constraint_row
      join lateral unnest(constraint_row.conkey) with ordinality source_key(attnum, position) on true
      join lateral unnest(constraint_row.confkey) with ordinality target_key(attnum, position)
        on target_key.position = source_key.position
      join kis_text_id_columns converted
        on converted.table_oid = constraint_row.confrelid and converted.attnum = target_key.attnum
      where constraint_row.contype = 'f'
      on conflict do nothing;

      get diagnostics changed_rows = row_count;
      exit when changed_rows = 0;
    end loop;

    -- These polymorphic identifiers are not protected by FKs but must accept
    -- Worker IDs such as "course-..." and "audit-...".
    insert into kis_text_id_columns(table_oid, attnum)
    select c.oid, a.attnum
    from (values
      ('audit_logs', 'target_id'),
      ('file_uploads', 'entity_id'),
      ('learning_history', 'source_id')
    ) as target(table_name, column_name)
    join pg_class c on c.relname = target.table_name and c.relnamespace = 'public'::regnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attname = target.column_name
      and a.atttypid = 'uuid'::regtype and not a.attisdropped
    on conflict do nothing;

    update kis_text_id_columns converted
    set default_expression = pg_get_expr(default_value.adbin, default_value.adrelid)
    from pg_attrdef default_value
    where default_value.adrelid = converted.table_oid and default_value.adnum = converted.attnum;

    create temporary table kis_affected_foreign_keys (
      constraint_oid oid primary key,
      source_table regclass not null,
      constraint_name text not null,
      definition text not null,
      referenced_schema text not null
    ) on commit drop;

    insert into kis_affected_foreign_keys
    select distinct
      constraint_row.oid,
      constraint_row.conrelid::regclass,
      constraint_row.conname,
      pg_get_constraintdef(constraint_row.oid),
      referenced_namespace.nspname
    from pg_constraint constraint_row
    join pg_class referenced_table on referenced_table.oid = constraint_row.confrelid
    join pg_namespace referenced_namespace on referenced_namespace.oid = referenced_table.relnamespace
    where constraint_row.contype = 'f'
      and (
        exists (
          select 1 from unnest(constraint_row.conkey) source_key
          join kis_text_id_columns converted
            on converted.table_oid = constraint_row.conrelid and converted.attnum = source_key
        )
        or exists (
          select 1 from unnest(constraint_row.confkey) target_key
          join kis_text_id_columns converted
            on converted.table_oid = constraint_row.confrelid and converted.attnum = target_key
        )
      );

    -- Only policies whose expressions depend on converted identifiers are
    -- removed. Unaffected department/category policies remain intact. These
    -- tables stay RLS-enabled with no permissive policy until the later Worker
    -- containment migration revokes direct Data API access globally.
    for row_record in
      select schemaname, tablename, policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = any(array[
          'profiles',
          'courses',
          'course_contents',
          'course_assignments',
          'lesson_progress',
          'quizzes',
          'questions',
          'question_options',
          'quiz_attempts',
          'quiz_answers',
          'professional_certificates',
          'training_sessions',
          'session_slots',
          'qr_tokens',
          'attendance',
          'session_participants',
          'notifications',
          'file_uploads',
          'user_roles',
          'external_course_submissions',
          'learning_history',
          'employee_certifications'
        ])
    loop
      execute format('drop policy %I on %I.%I', row_record.policyname, row_record.schemaname, row_record.tablename);
    end loop;

    for row_record in select * from kis_affected_foreign_keys order by source_table::text, constraint_name
    loop
      execute format('alter table %s drop constraint %I', row_record.source_table, row_record.constraint_name);
    end loop;

    for row_record in
      select
        converted.table_oid::regclass as table_name,
        attribute.attname as column_name,
        converted.default_expression
      from kis_text_id_columns converted
      join pg_attribute attribute
        on attribute.attrelid = converted.table_oid and attribute.attnum = converted.attnum
      where attribute.atttypid = 'uuid'::regtype
      order by converted.table_oid::regclass::text, attribute.attnum
    loop
      execute format('alter table %s alter column %I drop default', row_record.table_name, row_record.column_name);
      execute format(
        'alter table %s alter column %I type text using %I::text',
        row_record.table_name,
        row_record.column_name,
        row_record.column_name
      );

      if row_record.default_expression is not null then
        if row_record.default_expression like '%gen_random_uuid()%'
          or row_record.default_expression like '%uuid_generate_v4()%'
        then
          execute format(
            'alter table %s alter column %I set default gen_random_uuid()::text',
            row_record.table_name,
            row_record.column_name
          );
        else
          raise exception 'Unsupported UUID default on %.%: %',
            row_record.table_name, row_record.column_name, row_record.default_expression;
        end if;
      end if;
    end loop;

    -- profiles.auth_user_id retains the old Supabase Auth linkage while the
    -- application primary key becomes TEXT. Public-to-public foreign keys keep
    -- their original ON DELETE behavior.
    for row_record in
      select * from kis_affected_foreign_keys
      where referenced_schema = 'public'
      order by source_table::text, constraint_name
    loop
      execute format(
        'alter table %s add constraint %I %s',
        row_record.source_table,
        row_record.constraint_name,
        row_record.definition
      );
    end loop;

    alter table public.profiles
      add column if not exists department text,
      add column if not exists manager_name text,
      add column if not exists location text,
      add column if not exists notes text;

    update public.profiles profile
    set department = department.name
    from public.departments department
    where profile.department_id = department.id
      and nullif(btrim(profile.department), '') is null;

    alter table public.courses
      add column if not exists delivery_mode text not null default 'online',
      add column if not exists data jsonb not null default '{}';
    update public.courses
    set delivery_mode = coalesce(nullif(format, ''), delivery_mode, 'online'),
        data = jsonb_strip_nulls(jsonb_build_object(
          'title', title,
          'description', description,
          'categoryId', category_id,
          'thumbnailUrl', thumbnail_url,
          'durationHours', duration_hours,
          'format', format,
          'updatedBy', updated_by
        )) || coalesce(data, '{}'::jsonb);
    alter table public.courses alter column title drop not null;

    alter table public.training_sessions
      add column if not exists data jsonb not null default '{}';
    update public.training_sessions
    set data = jsonb_strip_nulls(jsonb_build_object(
      'title', title,
      'trainerId', trainer_id,
      'locationName', location_name,
      'meetingUrl', meeting_url,
      'maxParticipants', max_participants
    )) || coalesce(data, '{}'::jsonb);
    alter table public.training_sessions alter column title drop not null;
    alter table public.training_sessions drop constraint if exists training_sessions_status_check;
    alter table public.training_sessions add constraint training_sessions_status_check
      check (status in ('scheduled', 'ongoing', 'completed', 'cancelled', 'draft'));

    alter table public.session_slots
      add column if not exists data jsonb not null default '{}',
      add column if not exists updated_at timestamptz not null default now();
    update public.session_slots
    set data = jsonb_strip_nulls(jsonb_build_object(
      'label', label,
      'slotDate', slot_date,
      'opensAt', opens_at,
      'closesAt', closes_at
    )) || coalesce(data, '{}'::jsonb);
    alter table public.session_slots alter column label drop not null;
    alter table public.session_slots alter column slot_date drop not null;
    alter table public.session_slots alter column opens_at drop not null;
    alter table public.session_slots alter column closes_at drop not null;

    alter table public.qr_tokens add column if not exists data jsonb not null default '{}';
    update public.qr_tokens
    set data = jsonb_strip_nulls(jsonb_build_object('closedBy', closed_by)) || coalesce(data, '{}'::jsonb);

    alter table public.attendance add column if not exists data jsonb not null default '{}';
    update public.attendance
    set data = jsonb_strip_nulls(jsonb_build_object(
      'note', note,
      'verifiedBy', verified_by,
      'verifiedAt', verified_at
    )) || coalesce(data, '{}'::jsonb);

    alter table public.notifications
      add column if not exists created_by text,
      add column if not exists expires_at timestamptz,
      add column if not exists data jsonb not null default '{}';

    alter table public.quizzes add column if not exists data jsonb not null default '{}';
    update public.quizzes
    set data = jsonb_strip_nulls(jsonb_build_object(
      'title', title,
      'description', description,
      'passingScore', passing_score,
      'timeLimitMinutes', time_limit_minutes,
      'attemptsAllowed', attempts_allowed,
      'shuffleQuestions', shuffle_questions,
      'requireCourseCompletion', require_course_completion,
      'prerequisiteQuizId', prerequisite_quiz_id
    )) || coalesce(data, '{}'::jsonb);
    alter table public.quizzes alter column title drop not null;

    alter table public.quiz_attempts
      add column if not exists data jsonb not null default '{}',
      add column if not exists updated_at timestamptz not null default now();
    update public.quiz_attempts
    set data = jsonb_strip_nulls(jsonb_build_object(
      'startedAt', started_at,
      'gradingStatus', grading_status,
      'bookmarks', bookmarks
    )) || coalesce(data, '{}'::jsonb);
  elsif profile_id_type is not null and profile_id_type <> 'text' then
    raise exception 'Unsupported public.profiles.id type: %', profile_id_type;
  end if;
end $$;

-- ── profiles ───────────────────────────────────────────────────────────────────
-- id là text (không phải uuid) vì app dùng account_id dạng text
create table if not exists public.profiles (
  id                  text primary key,
  employee_code       text,
  full_name           text not null default '',
  email               text not null default '',
  role                text not null default 'employee'
                        check (role in ('admin','hr','trainer','employee')),
  department          text,
  position            text,
  account_status      text not null default 'active'
                        check (account_status in (
                          'active','pending','pendingActivation',
                          'disabled','locked','inactive'
                        )),
  password_status     text not null default 'normal'
                        check (password_status in ('normal','resetRequired')),
  avatar_url          text,
  phone               text,
  joined_date         date,
  manager_name        text,
  location            text,
  notes               text,
  last_login_at       timestamptz,
  failed_login_count  int not null default 0,
  locked_until        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.profiles add column if not exists department text;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'department_id'
  ) and to_regclass('public.departments') is not null then
    update public.profiles profile
    set department = department.name
    from public.departments department
    where profile.department_id = department.id
      and nullif(btrim(profile.department), '') is null;
  end if;

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

alter table public.profiles drop constraint if exists profiles_account_status_check;
alter table public.profiles add constraint profiles_account_status_check check (account_status in (
  'active', 'pending', 'pendingActivation', 'disabled', 'locked', 'inactive', 'temporarilyLocked'
));

create or replace function public.get_my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = (select auth.uid())::text;
$$;

create or replace function public.is_hr_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.get_my_role() in ('hr', 'admin');
$$;

do $$
begin
  if to_regclass('public.user_roles') is not null then
    execute $function$
      create or replace function public.has_role(required_role text)
      returns boolean
      language sql
      stable
      security definer
      set search_path = public
      as $body$
        select exists (
          select 1 from public.user_roles
          where account_id = (select auth.uid())::text and role = required_role
        );
      $body$
    $function$;
  end if;
end $$;

create index if not exists profiles_email_idx      on public.profiles(lower(email));
create index if not exists profiles_role_idx       on public.profiles(role);
create index if not exists profiles_department_idx on public.profiles(department);

-- ── employee_certifications ────────────────────────────────────────────────────
-- account_id là text để khớp với profiles.id (text)
-- Không có FK constraint để tránh conflict với dữ liệu hiện có
create table if not exists public.employee_certifications (
  id                  uuid primary key default gen_random_uuid(),
  account_id          text not null,
  name                text not null,
  certificate_type    text not null,
  certificate_number  text,
  issuer              text not null,
  issue_date          date not null,
  expiry_date         date,
  evidence_path       text,
  status              text not null default 'valid'
                        check (status in ('valid','expired','pending','revoked')),
  notes               text,
  revoked_at          timestamptz,
  revoked_by          text,
  created_by          text,
  updated_by          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (expiry_date is null or expiry_date >= issue_date)
);

create index if not exists employee_cert_account_status_idx
  on public.employee_certifications(account_id, status);

-- ── external_training_requests ─────────────────────────────────────────────────
create table if not exists public.external_training_requests (
  id               uuid primary key default gen_random_uuid(),
  account_id       text not null,
  course_name      text not null,
  provider         text not null,
  learning_content text not null,
  study_time       text not null,
  cost             numeric(14,2) not null default 0 check (cost >= 0),
  evidence_url     text,
  note             text,
  status           text not null default 'pending'
                     check (status in ('pending','accepted','rejected','needs_info')),
  hr_feedback      text,
  reviewed_by      text,
  reviewed_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists external_training_requests_account_idx
  on public.external_training_requests(account_id, created_at desc);
create index if not exists external_training_requests_status_idx
  on public.external_training_requests(status, created_at desc);
