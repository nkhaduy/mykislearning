-- ============================================================
-- Migration 010: Learning Paths (Phase 2)
-- Adds learning_paths, learning_path_steps,
-- learning_path_assignments, learning_path_step_progress.
-- Safe to re-run: uses IF NOT EXISTS.
-- Rollback notes at end of file.
-- ============================================================

-- ── learning_paths ────────────────────────────────────────────
-- HR creates/edits/publishes paths. Employees see only published.
create table if not exists public.learning_paths (
  id                        text primary key,
  title                     text not null,
  description               text,
  status                    text not null default 'draft'
                              check (status in ('draft', 'published', 'archived')),
  completion_mode           text not null default 'sequential'
                              check (completion_mode in ('sequential', 'flexible')),
  thumbnail_url             text,
  estimated_duration_minutes int,
  created_by                text,   -- account_id of HR
  published_at              timestamptz,
  archived_at               timestamptz,
  data                      jsonb not null default '{}',
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists lp_status_idx     on public.learning_paths(status);
create index if not exists lp_created_by_idx on public.learning_paths(created_by);
create index if not exists lp_updated_at_idx on public.learning_paths(updated_at desc);

-- ── learning_path_steps ───────────────────────────────────────
-- Ordered steps inside a path. Each step references one resource.
create table if not exists public.learning_path_steps (
  id                     text primary key,
  learning_path_id       text not null references public.learning_paths(id) on delete cascade,
  step_type              text not null
                           check (step_type in ('course', 'quiz', 'training_session', 'document', 'external_link')),
  resource_id            text,        -- id in respective table (courses/quizzes/training_sessions)
  title_override         text,        -- shown instead of resource title if set
  description_override   text,
  position               int not null default 0,
  is_required            boolean not null default true,
  prerequisite_step_id   text references public.learning_path_steps(id) on delete set null,
  due_offset_days        int,         -- days after assignment start_at
  estimated_duration_minutes int,
  data                   jsonb not null default '{}',
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists lps_path_position_idx on public.learning_path_steps(learning_path_id, position);
create index if not exists lps_prereq_idx        on public.learning_path_steps(prerequisite_step_id);

-- Prevent two steps at same position in the same path
-- (advisory; enforced at app level too)
create unique index if not exists lps_path_position_uniq
  on public.learning_path_steps(learning_path_id, position);

-- ── learning_path_assignments ─────────────────────────────────
-- HR assigns a published path to individual employees.
-- One row per (path, employee). No duplicates.
create table if not exists public.learning_path_assignments (
  id                text primary key,
  learning_path_id  text not null references public.learning_paths(id) on delete restrict,
  employee_id       text not null,   -- profiles.id of the employee
  assigned_by       text,            -- profiles.id of HR
  assigned_at       timestamptz not null default now(),
  start_at          timestamptz,
  due_at            timestamptz,
  status            text not null default 'not_started'
                      check (status in (
                        'not_started', 'in_progress', 'completed', 'overdue', 'cancelled'
                      )),
  progress_percent  int not null default 0
                      check (progress_percent between 0 and 100),
  completed_at      timestamptz,
  cancelled_at      timestamptz,
  assignment_source text not null default 'individual'
                      check (assignment_source in (
                        'individual', 'department', 'job_title', 'manual_group'
                      )),
  data              jsonb not null default '{}',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (learning_path_id, employee_id)
);

create index if not exists lpa_employee_idx    on public.learning_path_assignments(employee_id);
create index if not exists lpa_path_idx        on public.learning_path_assignments(learning_path_id);
create index if not exists lpa_status_idx      on public.learning_path_assignments(status);
create index if not exists lpa_due_at_idx      on public.learning_path_assignments(due_at);
create index if not exists lpa_employee_status on public.learning_path_assignments(employee_id, status);

-- ── learning_path_step_progress ───────────────────────────────
-- One row per (assignment, step). Created lazily when employee first
-- interacts with a step. unique constraint prevents duplicates.
create table if not exists public.learning_path_step_progress (
  id               text primary key,
  assignment_id    text not null references public.learning_path_assignments(id) on delete cascade,
  step_id          text not null references public.learning_path_steps(id) on delete cascade,
  status           text not null default 'locked'
                     check (status in (
                       'locked', 'available', 'in_progress', 'completed', 'skipped'
                     )),
  started_at       timestamptz,
  completed_at     timestamptz,
  progress_percent int not null default 0
                     check (progress_percent between 0 and 100),
  attempt_reference text,  -- e.g. quiz_attempt.id or enrollment.id
  last_activity_at timestamptz,
  data             jsonb not null default '{}',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (assignment_id, step_id)
);

create index if not exists lpsp_assignment_idx on public.learning_path_step_progress(assignment_id);
create index if not exists lpsp_step_idx       on public.learning_path_step_progress(step_id);
create index if not exists lpsp_status_idx     on public.learning_path_step_progress(assignment_id, status);

-- ── updated_at triggers ───────────────────────────────────────
do $$ begin
  if not exists (
    select 1 from information_schema.triggers
    where trigger_name = 'learning_paths_updated_at'
  ) then
    create trigger learning_paths_updated_at
      before update on public.learning_paths
      for each row execute function public.set_updated_at();
  end if;

  if not exists (
    select 1 from information_schema.triggers
    where trigger_name = 'learning_path_steps_updated_at'
  ) then
    create trigger learning_path_steps_updated_at
      before update on public.learning_path_steps
      for each row execute function public.set_updated_at();
  end if;

  if not exists (
    select 1 from information_schema.triggers
    where trigger_name = 'learning_path_assignments_updated_at'
  ) then
    create trigger learning_path_assignments_updated_at
      before update on public.learning_path_assignments
      for each row execute function public.set_updated_at();
  end if;

  if not exists (
    select 1 from information_schema.triggers
    where trigger_name = 'learning_path_step_progress_updated_at'
  ) then
    create trigger learning_path_step_progress_updated_at
      before update on public.learning_path_step_progress
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- ── RLS (disabled, consistent with existing tables) ──────────
-- Auth is enforced at Worker level via requireAuth / requireHr.
alter table public.learning_paths            disable row level security;
alter table public.learning_path_steps       disable row level security;
alter table public.learning_path_assignments disable row level security;
alter table public.learning_path_step_progress disable row level security;

-- ============================================================
-- ROLLBACK NOTES (run manually if needed):
--
-- drop table if exists public.learning_path_step_progress;
-- drop table if exists public.learning_path_assignments;
-- drop table if exists public.learning_path_steps;
-- drop table if exists public.learning_paths;
--
-- ⚠ Only safe to drop if no assignment data exists.
--   Never drop while production assignments are present.
-- ============================================================
