create schema if not exists private;

create or replace function private.lms_current_profile_id()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.profiles p
  where p.auth_user_id = (select auth.uid())
     or p.id = (select auth.uid())::text
  limit 1;
$$;

create or replace function private.lms_is_hr()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where (p.auth_user_id = (select auth.uid()) or p.id = (select auth.uid())::text)
      and lower(p.role) = 'hr'
      and p.account_status = 'active'
  );
$$;

revoke all on function private.lms_current_profile_id() from public;
revoke all on function private.lms_is_hr() from public;
grant usage on schema private to authenticated;
grant execute on function private.lms_current_profile_id() to authenticated;
grant execute on function private.lms_is_hr() to authenticated;

alter table public.courses add column if not exists title text;
alter table public.courses add column if not exists short_description text;
alter table public.courses add column if not exists description text;
alter table public.courses add column if not exists image_url text;
alter table public.courses add column if not exists published boolean not null default false;
alter table public.courses add column if not exists self_enroll_enabled boolean not null default false;
alter table public.courses add column if not exists category text;
alter table public.courses add column if not exists created_at timestamptz not null default now();

update public.courses
set title = coalesce(title, nullif(data->>'title', ''), id),
    short_description = coalesce(short_description, data->>'short_description'),
    description = coalesce(description, data->>'description'),
    image_url = coalesce(image_url, data->>'image_url'),
    published = published or status = 'published';

create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references public.courses(id) on delete cascade,
  title text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  course_id text not null references public.courses(id) on delete cascade,
  title text not null,
  content jsonb not null default '{}'::jsonb,
  content_type text not null default 'rich_text',
  sort_order integer not null default 0,
  is_preview boolean not null default false,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (chapter_id, sort_order)
);

create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  course_id text not null references public.courses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (lesson_id, user_id)
);

create unique index if not exists enrollments_course_account_uidx
  on public.enrollments(course_id, account_id);
create index if not exists chapters_course_order_idx on public.chapters(course_id, sort_order);
create index if not exists lessons_course_chapter_order_idx on public.lessons(course_id, chapter_id, sort_order);
create index if not exists lesson_progress_user_course_idx on public.lesson_progress(user_id, course_id);

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.enrollments enable row level security;
alter table public.chapters enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_progress enable row level security;

grant select on public.profiles, public.courses, public.enrollments, public.chapters, public.lessons, public.lesson_progress to authenticated;
grant insert, update on public.enrollments, public.lesson_progress to authenticated;
grant insert, update, delete on public.courses, public.chapters, public.lessons to authenticated;
grant usage, select on all sequences in schema public to authenticated;

drop policy if exists lms_profiles_read_self_or_hr on public.profiles;
create policy lms_profiles_read_self_or_hr on public.profiles
for select to authenticated
using (
  auth_user_id = (select auth.uid())
  or id = (select auth.uid())::text
  or (select private.lms_is_hr())
);

drop policy if exists lms_courses_read_published_or_hr on public.courses;
create policy lms_courses_read_published_or_hr on public.courses
for select to authenticated
using (published or status = 'published' or (select private.lms_is_hr()));

drop policy if exists lms_courses_hr_insert on public.courses;
create policy lms_courses_hr_insert on public.courses
for insert to authenticated
with check ((select private.lms_is_hr()));

drop policy if exists lms_courses_hr_update on public.courses;
create policy lms_courses_hr_update on public.courses
for update to authenticated
using ((select private.lms_is_hr()))
with check ((select private.lms_is_hr()));

drop policy if exists lms_courses_hr_delete on public.courses;
create policy lms_courses_hr_delete on public.courses
for delete to authenticated
using ((select private.lms_is_hr()));

drop policy if exists lms_chapters_read_permitted on public.chapters;
create policy lms_chapters_read_permitted on public.chapters
for select to authenticated
using (
  (select private.lms_is_hr())
  or exists (select 1 from public.courses c where c.id = course_id and (c.published or c.status = 'published'))
);

drop policy if exists lms_chapters_hr_all on public.chapters;
create policy lms_chapters_hr_all on public.chapters
for all to authenticated
using ((select private.lms_is_hr()))
with check ((select private.lms_is_hr()));

drop policy if exists lms_lessons_read_permitted on public.lessons;
create policy lms_lessons_read_permitted on public.lessons
for select to authenticated
using (
  (select private.lms_is_hr())
  or is_preview
  or (
    published
    and exists (
      select 1 from public.enrollments e
      where e.course_id = lessons.course_id
        and e.account_id = (select private.lms_current_profile_id())
    )
  )
);

drop policy if exists lms_lessons_hr_all on public.lessons;
create policy lms_lessons_hr_all on public.lessons
for all to authenticated
using ((select private.lms_is_hr()))
with check ((select private.lms_is_hr()));

drop policy if exists lms_enrollments_read_self_or_hr on public.enrollments;
create policy lms_enrollments_read_self_or_hr on public.enrollments
for select to authenticated
using (account_id = (select private.lms_current_profile_id()) or (select private.lms_is_hr()));

drop policy if exists lms_enrollments_self_insert on public.enrollments;
create policy lms_enrollments_self_insert on public.enrollments
for insert to authenticated
with check (
  account_id = (select private.lms_current_profile_id())
  and exists (
    select 1 from public.courses c
    where c.id = course_id
      and c.self_enroll_enabled
      and (c.published or c.status = 'published')
  )
);

drop policy if exists lms_enrollments_hr_all on public.enrollments;
create policy lms_enrollments_hr_all on public.enrollments
for all to authenticated
using ((select private.lms_is_hr()))
with check ((select private.lms_is_hr()));

drop policy if exists lms_progress_read_own_or_hr on public.lesson_progress;
create policy lms_progress_read_own_or_hr on public.lesson_progress
for select to authenticated
using (user_id = (select auth.uid()) or (select private.lms_is_hr()));

drop policy if exists lms_progress_insert_own on public.lesson_progress;
create policy lms_progress_insert_own on public.lesson_progress
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.enrollments e
    where e.course_id = lesson_progress.course_id
      and e.account_id = (select private.lms_current_profile_id())
  )
);

drop policy if exists lms_progress_update_own on public.lesson_progress;
create policy lms_progress_update_own on public.lesson_progress
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public)
values
  ('course-images', 'course-images', false),
  ('lesson-files', 'lesson-files', false),
  ('avatars', 'avatars', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists lms_course_images_read on storage.objects;
create policy lms_course_images_read on storage.objects
for select to authenticated
using (
  bucket_id = 'course-images'
  and (
    (select private.lms_is_hr())
    or exists (
      select 1 from public.courses c
      where c.id = (storage.foldername(name))[1]
        and (c.published or c.status = 'published')
    )
  )
);

drop policy if exists lms_lesson_files_read on storage.objects;
create policy lms_lesson_files_read on storage.objects
for select to authenticated
using (
  bucket_id = 'lesson-files'
  and (
    (select private.lms_is_hr())
    or exists (
      select 1 from public.enrollments e
      where e.course_id = (storage.foldername(name))[1]
        and e.account_id = (select private.lms_current_profile_id())
    )
  )
);

drop policy if exists lms_hr_manage_course_storage on storage.objects;
create policy lms_hr_manage_course_storage on storage.objects
for all to authenticated
using (bucket_id in ('course-images', 'lesson-files') and (select private.lms_is_hr()))
with check (bucket_id in ('course-images', 'lesson-files') and (select private.lms_is_hr()));

drop policy if exists lms_avatar_read on storage.objects;
create policy lms_avatar_read on storage.objects
for select to authenticated
using (bucket_id = 'avatars');

drop policy if exists lms_avatar_manage_own on storage.objects;
create policy lms_avatar_manage_own on storage.objects
for all to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
