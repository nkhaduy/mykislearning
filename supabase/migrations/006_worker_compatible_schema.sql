-- ============================================================
-- Migration 006: Worker-Compatible Schema
-- Adds tables that match the Worker API data shapes.
-- All IDs are TEXT (not UUID) to match existing app IDs.
-- All metadata goes in data JSONB column.
-- Safe to re-run: uses IF NOT EXISTS + ADD COLUMN IF NOT EXISTS.
-- ============================================================

-- ── courses ────────────────────────────────────────────────────────────────────
-- Stores course definitions. delivery_mode + status are indexed for fast queries.
create table if not exists public.courses (
  id            text primary key,
  status        text not null default 'draft'
                  check (status in ('published', 'draft', 'archived')),
  delivery_mode text not null default 'online',
  created_by    text,
  data          jsonb not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists courses_status_idx        on public.courses(status);
create index if not exists courses_updated_at_idx    on public.courses(updated_at desc);

-- ── course_content ─────────────────────────────────────────────────────────────
-- Content items (slides, videos, quizzes) within a course.
create table if not exists public.course_content (
  id          text primary key,
  course_id   text not null references public.courses(id) on delete cascade,
  type        text not null default 'slide'
                check (type in ('slide', 'video', 'quiz', 'text', 'other')),
  sort_order  int  not null default 0,
  data        jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists course_content_course_order_idx on public.course_content(course_id, sort_order);

-- ── enrollments ────────────────────────────────────────────────────────────────
-- HR assigns employees to courses. Unique per (course, employee).
create table if not exists public.enrollments (
  id          text primary key,
  course_id   text not null references public.courses(id) on delete cascade,
  account_id  text not null,
  status      text not null default 'notStarted'
                check (status in ('notStarted', 'inProgress', 'completed', 'overdue', 'follow')),
  data        jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (course_id, account_id)
);
create index if not exists enrollments_account_idx  on public.enrollments(account_id);
create index if not exists enrollments_course_idx   on public.enrollments(course_id);
create index if not exists enrollments_status_idx   on public.enrollments(status);

-- ── content_progress ───────────────────────────────────────────────────────────
-- Tracks each learner's progress per content item. Unique per (content, learner).
create table if not exists public.content_progress (
  id          text primary key,
  content_id  text not null,
  account_id  text not null,
  course_id   text,
  data        jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (content_id, account_id)
);
create index if not exists content_progress_account_course_idx on public.content_progress(account_id, course_id);

-- ── training_sessions ──────────────────────────────────────────────────────────
-- Offline/virtual classroom sessions.
create table if not exists public.training_sessions (
  id                  text primary key,
  course_id           text references public.courses(id) on delete set null,
  status              text not null default 'scheduled'
                        check (status in ('scheduled', 'ongoing', 'completed', 'cancelled', 'draft')),
  start_at            timestamptz not null,
  end_at              timestamptz,
  location_lat        numeric(10, 7),
  location_lng        numeric(10, 7),
  location_radius_m   int not null default 200,
  created_by          text,
  data                jsonb not null default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists training_sessions_course_idx    on public.training_sessions(course_id);
create index if not exists training_sessions_status_idx    on public.training_sessions(status);
create index if not exists training_sessions_start_at_idx  on public.training_sessions(start_at);

-- ── training_participants ──────────────────────────────────────────────────────
-- Employees invited to a training session.
create table if not exists public.training_participants (
  id          text primary key,
  session_id  text not null references public.training_sessions(id) on delete cascade,
  account_id  text not null,
  data        jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  unique (session_id, account_id)
);
create index if not exists training_participants_session_idx  on public.training_participants(session_id);
create index if not exists training_participants_account_idx  on public.training_participants(account_id);

-- ── training_registrations ─────────────────────────────────────────────────────
-- Each participant's response + attendance record.
create table if not exists public.training_registrations (
  id          text primary key,
  session_id  text not null references public.training_sessions(id) on delete cascade,
  account_id  text not null,
  data        jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (session_id, account_id)
);
create index if not exists training_registrations_session_idx on public.training_registrations(session_id);
create index if not exists training_registrations_account_idx on public.training_registrations(account_id);

-- ── session_slots ──────────────────────────────────────────────────────────────
-- QR check-in/out windows within a training session.
create table if not exists public.session_slots (
  id          text primary key,
  session_id  text not null references public.training_sessions(id) on delete cascade,
  data        jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists session_slots_session_idx on public.session_slots(session_id);

-- ── qr_tokens ─────────────────────────────────────────────────────────────────
-- QR code tokens for attendance scanning.
create table if not exists public.qr_tokens (
  id          text primary key,
  slot_id     text not null references public.session_slots(id) on delete cascade,
  action      text not null check (action in ('check_in', 'check_out')),
  token_hash  text not null unique,
  opens_at    timestamptz not null,
  closes_at   timestamptz not null,
  status      text not null default 'open' check (status in ('open', 'closed')),
  created_by  text,
  data        jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists qr_tokens_token_hash_idx on public.qr_tokens(token_hash);
create index if not exists qr_tokens_slot_idx       on public.qr_tokens(slot_id);

-- ── attendance ─────────────────────────────────────────────────────────────────
-- Individual check-in/out records per slot per employee.
create table if not exists public.attendance (
  id                  text primary key,
  slot_id             text not null references public.session_slots(id) on delete cascade,
  account_id          text not null,
  check_in_at         timestamptz,
  check_out_at        timestamptz,
  inside_geofence     boolean,
  distance_meters     int,
  status              text not null default 'present'
                        check (status in ('present', 'absent', 'late', 'excused')),
  data                jsonb not null default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (slot_id, account_id)
);
create index if not exists attendance_slot_idx    on public.attendance(slot_id);
create index if not exists attendance_account_idx on public.attendance(account_id);

-- ── notifications ──────────────────────────────────────────────────────────────
-- In-app notifications for employees and HR.
create table if not exists public.notifications (
  id          text primary key,
  account_id  text not null,
  type        text not null,
  title       text not null,
  body        text,
  link        text,
  is_read     boolean not null default false,
  created_by  text,
  expires_at  timestamptz,
  data        jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index if not exists notifications_account_unread_idx on public.notifications(account_id, is_read, created_at desc);
create index if not exists notifications_created_at_idx     on public.notifications(created_at desc);

-- ── quizzes ────────────────────────────────────────────────────────────────────
-- Quiz definitions attached to courses.
create table if not exists public.quizzes (
  id          text primary key,
  course_id   text references public.courses(id) on delete set null,
  status      text not null default 'draft'
                check (status in ('published', 'draft', 'archived')),
  data        jsonb not null default '{}',
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists quizzes_course_idx on public.quizzes(course_id);

-- ── quiz_questions ─────────────────────────────────────────────────────────────
create table if not exists public.quiz_questions (
  id          text primary key,
  quiz_id     text not null references public.quizzes(id) on delete cascade,
  sort_order  int  not null default 0,
  data        jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index if not exists quiz_questions_quiz_idx on public.quiz_questions(quiz_id, sort_order);

-- ── quiz_attempts ──────────────────────────────────────────────────────────────
-- Each learner's quiz submission.
create table if not exists public.quiz_attempts (
  id            text primary key,
  quiz_id       text not null references public.quizzes(id) on delete cascade,
  account_id    text not null,
  course_id     text,
  score_percent int,
  passed        boolean,
  submitted_at  timestamptz,
  data          jsonb not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists quiz_attempts_account_quiz_idx on public.quiz_attempts(account_id, quiz_id);

-- ── gallery_albums ─────────────────────────────────────────────────────────────
-- Photo/video albums visible to employees.
create table if not exists public.gallery_albums (
  id          text primary key,
  title       text not null,
  visibility  text not null default 'all'
                check (visibility in ('all', 'hr_only', 'specific')),
  data        jsonb not null default '{}',
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── external_training_requests ────────────────────────────────────────────────
-- (Already exists from migration 003/005, but safe to repeat with IF NOT EXISTS)
create table if not exists public.external_training_requests (
  id               text primary key default gen_random_uuid()::text,
  account_id       text not null,
  course_name      text not null,
  provider         text not null,
  learning_content text not null,
  study_time       text not null,
  cost             numeric(14, 2) not null default 0 check (cost >= 0),
  evidence_url     text,
  note             text,
  status           text not null default 'pending'
                     check (status in ('pending', 'accepted', 'rejected', 'needs_info')),
  hr_feedback      text,
  reviewed_by      text,
  reviewed_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists ext_training_account_idx on public.external_training_requests(account_id, created_at desc);
create index if not exists ext_training_status_idx  on public.external_training_requests(status);

-- ── employee_certifications ───────────────────────────────────────────────────
-- (Already exists from migration 003/005, but safe to repeat with IF NOT EXISTS)
create table if not exists public.employee_certifications (
  id                  text primary key default gen_random_uuid()::text,
  account_id          text not null,
  name                text not null,
  certificate_type    text not null,
  certificate_number  text,
  issuer              text not null,
  issue_date          date not null,
  expiry_date         date,
  evidence_path       text,
  status              text not null default 'valid'
                        check (status in ('valid', 'expired', 'pending', 'revoked')),
  notes               text,
  revoked_at          timestamptz,
  revoked_by          text,
  created_by          text,
  updated_by          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (expiry_date is null or expiry_date >= issue_date)
);
create index if not exists emp_cert_account_status_idx on public.employee_certifications(account_id, status);

-- ── audit_logs ────────────────────────────────────────────────────────────────
-- (May already exist, safe to repeat)
create table if not exists public.audit_logs (
  id          text primary key default gen_random_uuid()::text,
  actor_id    text,
  action      text not null,
  target_type text,
  target_id   text,
  result      text,
  details     jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists audit_logs_actor_idx      on public.audit_logs(actor_id, created_at desc);
create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at desc);

-- ── profiles (text PK, worker-compatible) ────────────────────────────────────
-- (Already exists from migration 005)
create table if not exists public.profiles (
  id                  text primary key,
  employee_code       text,
  full_name           text not null default '',
  email               text not null default '',
  role                text not null default 'employee'
                        check (role in ('admin', 'hr', 'trainer', 'employee')),
  department          text,
  position            text,
  account_status      text not null default 'active'
                        check (account_status in (
                          'active', 'pending', 'pendingActivation',
                          'disabled', 'locked', 'inactive', 'temporarilyLocked'
                        )),
  password_status     text not null default 'normal',
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
create index if not exists profiles_email_idx      on public.profiles(lower(email));
create index if not exists profiles_role_idx       on public.profiles(role);
create index if not exists profiles_department_idx on public.profiles(department);

-- ── updated_at trigger function (safe to recreate) ───────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Attach updated_at triggers to new tables
do $$ begin
  if not exists (select 1 from information_schema.triggers where trigger_name = 'courses_updated_at') then
    create trigger courses_updated_at before update on public.courses for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from information_schema.triggers where trigger_name = 'course_content_updated_at') then
    create trigger course_content_updated_at before update on public.course_content for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from information_schema.triggers where trigger_name = 'enrollments_updated_at') then
    create trigger enrollments_updated_at before update on public.enrollments for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from information_schema.triggers where trigger_name = 'content_progress_updated_at') then
    create trigger content_progress_updated_at before update on public.content_progress for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from information_schema.triggers where trigger_name = 'training_sessions_updated_at') then
    create trigger training_sessions_updated_at before update on public.training_sessions for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from information_schema.triggers where trigger_name = 'training_registrations_updated_at') then
    create trigger training_registrations_updated_at before update on public.training_registrations for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from information_schema.triggers where trigger_name = 'notifications_updated_at') then
    -- notifications uses created_at only (immutable once created, reads are tracked via is_read)
    null;
  end if;
  if not exists (select 1 from information_schema.triggers where trigger_name = 'quizzes_updated_at') then
    create trigger quizzes_updated_at before update on public.quizzes for each row execute function public.set_updated_at();
  end if;
end $$;
