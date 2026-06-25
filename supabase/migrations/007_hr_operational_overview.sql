-- HR operational overview: activity heartbeat and task queue.

create table if not exists public.user_activity (
  id            text primary key default gen_random_uuid()::text,
  account_id    text not null,
  activity_type text not null check (activity_type in (
    'login', 'dashboard', 'course_view', 'content_view', 'quiz_attempt', 'training_view', 'logout'
  )),
  page_path     text,
  course_id     text,
  session_id    text not null,
  started_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  ended_at      timestamptz,
  metadata      jsonb not null default '{}',
  created_at    timestamptz not null default now(),
  unique (session_id, account_id)
);

create index if not exists user_activity_account_seen_idx
  on public.user_activity(account_id, last_seen_at desc);
create index if not exists user_activity_seen_type_idx
  on public.user_activity(last_seen_at desc, activity_type);
create index if not exists user_activity_course_idx
  on public.user_activity(course_id) where course_id is not null;

create table if not exists public.hr_tasks (
  id                    text primary key default gen_random_uuid()::text,
  task_type             text not null check (task_type in (
    'password_reset', 'account_unlock', 'external_training', 'certification',
    'course_approval', 'assignment', 'data_issue'
  )),
  requester_account_id  text references public.profiles(id) on delete set null,
  assignee_account_id   text references public.profiles(id) on delete set null,
  reference_type        text,
  reference_id          text,
  title                 text not null,
  description           text,
  priority              text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status                text not null default 'new' check (status in ('new', 'in_progress', 'done', 'rejected')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  resolved_at           timestamptz,
  resolved_by           text references public.profiles(id) on delete set null
);

create index if not exists hr_tasks_status_created_idx
  on public.hr_tasks(status, created_at desc);
create index if not exists hr_tasks_reference_idx
  on public.hr_tasks(reference_type, reference_id);
create unique index if not exists hr_tasks_open_reference_unique_idx
  on public.hr_tasks(task_type, reference_type, reference_id)
  where status in ('new', 'in_progress') and reference_type is not null and reference_id is not null;

do $$ begin
  if not exists (select 1 from information_schema.triggers where trigger_name = 'hr_tasks_updated_at') then
    create trigger hr_tasks_updated_at
      before update on public.hr_tasks
      for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.user_activity enable row level security;
alter table public.hr_tasks enable row level security;

grant select, insert, update on public.user_activity to authenticated, service_role;
grant select, insert, update, delete on public.hr_tasks to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

drop policy if exists "user_activity_own_insert" on public.user_activity;
create policy "user_activity_own_insert"
  on public.user_activity for insert
  to authenticated
  with check (account_id = (select auth.uid())::text);

drop policy if exists "user_activity_own_update" on public.user_activity;
create policy "user_activity_own_update"
  on public.user_activity for update
  to authenticated
  using (account_id = (select auth.uid())::text)
  with check (account_id = (select auth.uid())::text);

drop policy if exists "user_activity_hr_select" on public.user_activity;
create policy "user_activity_hr_select"
  on public.user_activity for select
  to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())::text
      and p.role in ('hr', 'admin')
  ) or account_id = (select auth.uid())::text);

drop policy if exists "hr_tasks_requester_select" on public.hr_tasks;
create policy "hr_tasks_requester_select"
  on public.hr_tasks for select
  to authenticated
  using (
    requester_account_id = (select auth.uid())::text
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())::text
        and p.role in ('hr', 'admin')
    )
  );

drop policy if exists "hr_tasks_requester_insert" on public.hr_tasks;
create policy "hr_tasks_requester_insert"
  on public.hr_tasks for insert
  to authenticated
  with check (requester_account_id = (select auth.uid())::text);

drop policy if exists "hr_tasks_manage_hr" on public.hr_tasks;
create policy "hr_tasks_manage_hr"
  on public.hr_tasks for update
  to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())::text
      and p.role in ('hr', 'admin')
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())::text
      and p.role in ('hr', 'admin')
  ));
