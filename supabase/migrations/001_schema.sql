-- ============================================================
-- MyKIS Learning — Database Schema v1
-- Migration: 001_schema.sql
-- Run in Supabase SQL Editor
-- ============================================================

-- Enable pgcrypto for UUID generation
create extension if not exists "pgcrypto";

-- ============================================================
-- HELPER: updated_at trigger function
-- ============================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- DEPARTMENTS
-- ============================================================
create table if not exists public.departments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  code        text unique,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger departments_updated_at before update on public.departments
  for each row execute function set_updated_at();

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
create table if not exists public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  employee_code       text unique,
  full_name           text not null,
  email               text not null unique,
  role                text not null default 'employee'
                      check (role in ('admin','hr','trainer','employee')),
  department_id       uuid references public.departments(id) on delete set null,
  position            text,
  account_status      text not null default 'active'
                      check (account_status in ('active','pending','disabled','locked','inactive')),
  password_status     text not null default 'normal'
                      check (password_status in ('normal','resetRequired')),
  avatar_url          text,
  phone               text,
  joined_date         date,
  last_login_at       timestamptz,
  failed_login_count  int not null default 0,
  locked_until        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function set_updated_at();

create index if not exists profiles_email_idx on public.profiles(lower(email));
create index if not exists profiles_department_idx on public.profiles(department_id);
create index if not exists profiles_role_idx on public.profiles(role);

-- ============================================================
-- COURSE CATEGORIES
-- ============================================================
create table if not exists public.course_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  icon        text,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- COURSES
-- ============================================================
create table if not exists public.courses (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text,
  category_id     uuid references public.course_categories(id) on delete set null,
  thumbnail_url   text,
  status          text not null default 'draft'
                  check (status in ('published','draft','archived')),
  duration_hours  numeric(6,2),
  format          text check (format in ('online','offline','blended')),
  created_by      uuid references public.profiles(id) on delete set null,
  updated_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger courses_updated_at before update on public.courses
  for each row execute function set_updated_at();
create index if not exists courses_status_idx on public.courses(status);
create index if not exists courses_category_idx on public.courses(category_id);

-- ============================================================
-- COURSE CONTENT (lessons)
-- ============================================================
create table if not exists public.course_contents (
  id                      uuid primary key default gen_random_uuid(),
  course_id               uuid not null references public.courses(id) on delete cascade,
  title                   text not null,
  type                    text not null check (type in ('slide','video','quiz','text')),
  sort_order              int not null default 0,
  is_required             boolean not null default true,
  weight                  numeric(5,2) not null default 1,
  source_type             text check (source_type in ('youtube','upload','external')),
  source_url              text,
  youtube_video_id        text,
  transcript              text,
  transcript_allowed      boolean not null default false,
  minimum_duration_secs   int not null default 0,
  required_percent        int not null default 80
                          check (required_percent between 0 and 100),
  quiz_id                 uuid,  -- FK added after quizzes table
  require_pass            boolean not null default false,
  slides                  jsonb,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create trigger course_contents_updated_at before update on public.course_contents
  for each row execute function set_updated_at();
create index if not exists course_contents_course_idx on public.course_contents(course_id, sort_order);

-- ============================================================
-- COURSE ASSIGNMENTS (HR assigns to employees)
-- ============================================================
create table if not exists public.course_assignments (
  id              uuid primary key default gen_random_uuid(),
  course_id       uuid not null references public.courses(id) on delete cascade,
  account_id      uuid not null references public.profiles(id) on delete cascade,
  assigned_by     uuid references public.profiles(id) on delete set null,
  deadline        date,
  status          text not null default 'notStarted'
                  check (status in ('notStarted','inProgress','completed','overdue','follow')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (course_id, account_id)
);
create trigger course_assignments_updated_at before update on public.course_assignments
  for each row execute function set_updated_at();
create index if not exists course_assignments_account_idx on public.course_assignments(account_id);
create index if not exists course_assignments_course_idx on public.course_assignments(course_id);

-- ============================================================
-- LESSON PROGRESS
-- ============================================================
create table if not exists public.lesson_progress (
  id                  uuid primary key default gen_random_uuid(),
  account_id          uuid not null references public.profiles(id) on delete cascade,
  course_id           uuid not null references public.courses(id) on delete cascade,
  content_id          uuid not null references public.course_contents(id) on delete cascade,
  completed           boolean not null default false,
  completion_percent  int not null default 0,
  viewed_seconds      int not null default 0,
  metadata            jsonb,
  updated_at          timestamptz not null default now(),
  unique (account_id, course_id, content_id)
);
create trigger lesson_progress_updated_at before update on public.lesson_progress
  for each row execute function set_updated_at();
create index if not exists lesson_progress_account_course_idx on public.lesson_progress(account_id, course_id);

-- ============================================================
-- QUIZZES
-- ============================================================
create table if not exists public.quizzes (
  id                          uuid primary key default gen_random_uuid(),
  course_id                   uuid references public.courses(id) on delete cascade,
  title                       text not null,
  description                 text,
  status                      text not null default 'draft'
                              check (status in ('published','draft','archived')),
  passing_score               int not null default 70
                              check (passing_score between 0 and 100),
  time_limit_minutes          int not null default 0,
  attempts_allowed            int not null default 0,
  shuffle_questions           boolean not null default false,
  require_course_completion   boolean not null default false,
  prerequisite_quiz_id        uuid references public.quizzes(id) on delete set null,
  created_by                  uuid references public.profiles(id) on delete set null,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);
create trigger quizzes_updated_at before update on public.quizzes
  for each row execute function set_updated_at();

-- Add quiz_id FK to course_contents
alter table public.course_contents
  add constraint course_contents_quiz_id_fk
  foreign key (quiz_id) references public.quizzes(id) on delete set null;

-- ============================================================
-- QUESTIONS
-- ============================================================
create table if not exists public.questions (
  id           uuid primary key default gen_random_uuid(),
  quiz_id      uuid not null references public.quizzes(id) on delete cascade,
  text         text not null,
  type         text not null check (type in ('singleChoice','multipleChoice','trueFalse','text')),
  points       numeric(6,2) not null default 1,
  explanation  text,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists questions_quiz_idx on public.questions(quiz_id, sort_order);

-- ============================================================
-- QUESTION OPTIONS
-- ============================================================
create table if not exists public.question_options (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  text        text not null,
  is_correct  boolean not null default false,
  sort_order  int not null default 0
);
create index if not exists question_options_question_idx on public.question_options(question_id);

-- ============================================================
-- QUIZ ATTEMPTS
-- ============================================================
create table if not exists public.quiz_attempts (
  id               uuid primary key default gen_random_uuid(),
  quiz_id          uuid not null references public.quizzes(id) on delete cascade,
  course_id        uuid references public.courses(id) on delete set null,
  account_id       uuid not null references public.profiles(id) on delete cascade,
  started_at       timestamptz not null default now(),
  submitted_at     timestamptz,
  score_percent    int,
  passed           boolean,
  grading_status   text not null default 'auto'
                   check (grading_status in ('auto','pendingManual','graded')),
  bookmarks        uuid[],
  created_at       timestamptz not null default now()
);
create index if not exists quiz_attempts_account_idx on public.quiz_attempts(account_id);
create index if not exists quiz_attempts_quiz_idx on public.quiz_attempts(quiz_id);

-- ============================================================
-- QUIZ ANSWERS
-- ============================================================
create table if not exists public.quiz_answers (
  id                  uuid primary key default gen_random_uuid(),
  attempt_id          uuid not null references public.quiz_attempts(id) on delete cascade,
  question_id         uuid not null references public.questions(id) on delete cascade,
  selected_option_id  uuid references public.question_options(id) on delete set null,
  selected_option_ids uuid[],
  text_answer         text,
  is_correct          boolean,
  awarded_points      numeric(6,2),
  graded_by           uuid references public.profiles(id) on delete set null,
  graded_at           timestamptz,
  unique (attempt_id, question_id)
);

-- ============================================================
-- PROFESSIONAL CERTIFICATES (CCHN)
-- ============================================================
create table if not exists public.professional_certificates (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null references public.profiles(id) on delete cascade,
  full_name       text not null,
  department      text,
  certificate_type text not null,
  cert_no         text,
  issue_date      date,
  expiry_date     date,
  status          text not null default 'valid'
                  check (status in ('valid','expired','pending','revoked')),
  note            text,
  uploaded_by     uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger professional_certificates_updated_at before update on public.professional_certificates
  for each row execute function set_updated_at();
create index if not exists professional_certificates_account_idx on public.professional_certificates(account_id);

-- ============================================================
-- TRAINING SESSIONS (offline/classroom)
-- ============================================================
create table if not exists public.training_sessions (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  course_id       uuid references public.courses(id) on delete set null,
  trainer_id      uuid references public.profiles(id) on delete set null,
  start_at        timestamptz not null,
  end_at          timestamptz,
  location_name   text,
  location_lat    numeric(10,7),
  location_lng    numeric(10,7),
  location_radius_m int not null default 200,
  meeting_url     text,
  status          text not null default 'scheduled'
                  check (status in ('scheduled','ongoing','completed','cancelled')),
  max_participants int,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger training_sessions_updated_at before update on public.training_sessions
  for each row execute function set_updated_at();

-- ============================================================
-- SESSION SLOTS (check-in / check-out windows)
-- ============================================================
create table if not exists public.session_slots (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.training_sessions(id) on delete cascade,
  label       text not null,
  slot_date   date not null,
  opens_at    timestamptz not null,
  closes_at   timestamptz not null,
  created_at  timestamptz not null default now()
);
create index if not exists session_slots_session_idx on public.session_slots(session_id);

-- ============================================================
-- QR TOKENS
-- ============================================================
create table if not exists public.qr_tokens (
  id          uuid primary key default gen_random_uuid(),
  slot_id     uuid not null references public.session_slots(id) on delete cascade,
  action      text not null check (action in ('check_in','check_out')),
  token_hash  text not null unique,
  opens_at    timestamptz not null,
  closes_at   timestamptz not null,
  status      text not null default 'open' check (status in ('open','closed')),
  created_by  uuid references public.profiles(id) on delete set null,
  closed_by   uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger qr_tokens_updated_at before update on public.qr_tokens
  for each row execute function set_updated_at();
create index if not exists qr_tokens_token_hash_idx on public.qr_tokens(token_hash);

-- ============================================================
-- ATTENDANCE
-- ============================================================
create table if not exists public.attendance (
  id                      uuid primary key default gen_random_uuid(),
  slot_id                 uuid not null references public.session_slots(id) on delete cascade,
  account_id              uuid not null references public.profiles(id) on delete cascade,
  check_in_at             timestamptz,
  check_out_at            timestamptz,
  check_in_location       point,
  check_out_location      point,
  check_in_accuracy_m     int,
  check_out_accuracy_m    int,
  inside_geofence         boolean,
  distance_meters         int,
  status                  text not null default 'present'
                          check (status in ('present','absent','late','excused')),
  note                    text,
  verified_by             uuid references public.profiles(id) on delete set null,
  verified_at             timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (slot_id, account_id)
);
create trigger attendance_updated_at before update on public.attendance
  for each row execute function set_updated_at();
create index if not exists attendance_slot_idx on public.attendance(slot_id);
create index if not exists attendance_account_idx on public.attendance(account_id);

-- ============================================================
-- SESSION PARTICIPANTS (invited employees)
-- ============================================================
create table if not exists public.session_participants (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.training_sessions(id) on delete cascade,
  account_id  uuid not null references public.profiles(id) on delete cascade,
  invited_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (session_id, account_id)
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references public.profiles(id) on delete cascade,
  type        text not null,
  title       text not null,
  body        text,
  link        text,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_account_idx on public.notifications(account_id, is_read, created_at desc);

-- ============================================================
-- AUDIT LOGS
-- ============================================================
create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles(id) on delete set null,
  action      text not null,
  target_type text,
  target_id   uuid,
  result      text,
  details     jsonb,
  ip          inet,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index if not exists audit_logs_actor_idx on public.audit_logs(actor_id, created_at desc);
create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at desc);

-- ============================================================
-- FILE UPLOADS (Supabase Storage metadata)
-- ============================================================
create table if not exists public.file_uploads (
  id          uuid primary key default gen_random_uuid(),
  bucket      text not null,
  path        text not null,
  file_name   text not null,
  mime_type   text,
  size_bytes  bigint,
  uploaded_by uuid references public.profiles(id) on delete set null,
  entity_type text,
  entity_id   uuid,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- SYSTEM SETTINGS
-- ============================================================
create table if not exists public.system_settings (
  key         text primary key,
  value       jsonb not null,
  updated_by  uuid references public.profiles(id) on delete set null,
  updated_at  timestamptz not null default now()
);
