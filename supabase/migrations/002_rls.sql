-- ============================================================
-- MyKIS Learning — Row Level Security (RLS)
-- Migration: 002_rls.sql
-- ============================================================

-- Helper function: get current user's role from profiles
create or replace function get_my_role()
returns text language sql stable security definer as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Helper function: check if current user is HR or Admin
create or replace function is_hr_or_admin()
returns boolean language sql stable security definer as $$
  select get_my_role() in ('hr', 'admin');
$$;

-- ============================================================
-- Enable RLS on all tables
-- ============================================================
alter table public.profiles enable row level security;
alter table public.departments enable row level security;
alter table public.course_categories enable row level security;
alter table public.courses enable row level security;
alter table public.course_contents enable row level security;
alter table public.course_assignments enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.quizzes enable row level security;
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.quiz_answers enable row level security;
alter table public.professional_certificates enable row level security;
alter table public.training_sessions enable row level security;
alter table public.session_slots enable row level security;
alter table public.qr_tokens enable row level security;
alter table public.attendance enable row level security;
alter table public.session_participants enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.file_uploads enable row level security;
alter table public.system_settings enable row level security;

-- ============================================================
-- PROFILES
-- ============================================================
-- Employees can see their own profile
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());

-- HR/Admin can see all profiles
create policy "profiles_select_hr" on public.profiles
  for select using (is_hr_or_admin());

-- HR/Admin can insert (create accounts via API)
create policy "profiles_insert_hr" on public.profiles
  for insert with check (is_hr_or_admin());

-- HR/Admin can update any profile; employees can update their own non-sensitive fields
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles_update_hr" on public.profiles
  for update using (is_hr_or_admin());

-- Only admin can delete
create policy "profiles_delete_admin" on public.profiles
  for delete using (get_my_role() = 'admin');

-- ============================================================
-- DEPARTMENTS — all authenticated can read; HR/Admin manage
-- ============================================================
create policy "departments_select_all" on public.departments
  for select using (auth.uid() is not null);

create policy "departments_manage_hr" on public.departments
  for all using (is_hr_or_admin());

-- ============================================================
-- COURSE CATEGORIES — all authenticated can read; HR/Admin manage
-- ============================================================
create policy "course_categories_select_all" on public.course_categories
  for select using (auth.uid() is not null);

create policy "course_categories_manage_hr" on public.course_categories
  for all using (is_hr_or_admin());

-- ============================================================
-- COURSES
-- Employee: can only see courses assigned to them (via course_assignments)
-- HR/Admin: can see all
-- ============================================================
create policy "courses_select_assigned" on public.courses
  for select using (
    is_hr_or_admin()
    or exists (
      select 1 from public.course_assignments ca
      where ca.course_id = id and ca.account_id = auth.uid()
    )
    or status = 'published'  -- published courses visible to all employees
  );

create policy "courses_manage_hr" on public.courses
  for all using (is_hr_or_admin());

-- ============================================================
-- COURSE CONTENTS
-- ============================================================
create policy "course_contents_select" on public.course_contents
  for select using (
    is_hr_or_admin()
    or exists (
      select 1 from public.course_assignments ca
      where ca.course_id = course_id and ca.account_id = auth.uid()
    )
  );

create policy "course_contents_manage_hr" on public.course_contents
  for all using (is_hr_or_admin());

-- ============================================================
-- COURSE ASSIGNMENTS
-- ============================================================
create policy "course_assignments_select_own" on public.course_assignments
  for select using (account_id = auth.uid() or is_hr_or_admin());

create policy "course_assignments_manage_hr" on public.course_assignments
  for all using (is_hr_or_admin());

-- ============================================================
-- LESSON PROGRESS
-- ============================================================
create policy "lesson_progress_own" on public.lesson_progress
  for select using (account_id = auth.uid() or is_hr_or_admin());

-- Employees can upsert their own progress; HR can update any
create policy "lesson_progress_insert_own" on public.lesson_progress
  for insert with check (account_id = auth.uid());

create policy "lesson_progress_update_own" on public.lesson_progress
  for update using (account_id = auth.uid() or is_hr_or_admin());

-- ============================================================
-- QUIZZES
-- ============================================================
create policy "quizzes_select" on public.quizzes
  for select using (
    is_hr_or_admin()
    or status = 'published'
  );

create policy "quizzes_manage_hr" on public.quizzes
  for all using (is_hr_or_admin());

-- ============================================================
-- QUESTIONS & OPTIONS — same as quizzes
-- ============================================================
create policy "questions_select" on public.questions
  for select using (
    is_hr_or_admin()
    or exists (
      select 1 from public.quizzes q
      where q.id = quiz_id and q.status = 'published'
    )
  );
create policy "questions_manage_hr" on public.questions
  for all using (is_hr_or_admin());

create policy "question_options_select" on public.question_options
  for select using (
    is_hr_or_admin()
    or exists (
      select 1 from public.questions q
      join public.quizzes qz on qz.id = q.quiz_id
      where q.id = question_id and qz.status = 'published'
    )
  );
create policy "question_options_manage_hr" on public.question_options
  for all using (is_hr_or_admin());

-- ============================================================
-- QUIZ ATTEMPTS
-- ============================================================
create policy "quiz_attempts_own" on public.quiz_attempts
  for select using (account_id = auth.uid() or is_hr_or_admin());

create policy "quiz_attempts_insert_own" on public.quiz_attempts
  for insert with check (account_id = auth.uid());

create policy "quiz_attempts_update_own" on public.quiz_attempts
  for update using (account_id = auth.uid() or is_hr_or_admin());

-- ============================================================
-- QUIZ ANSWERS
-- ============================================================
create policy "quiz_answers_own" on public.quiz_answers
  for select using (
    is_hr_or_admin()
    or exists (
      select 1 from public.quiz_attempts a
      where a.id = attempt_id and a.account_id = auth.uid()
    )
  );

create policy "quiz_answers_insert_own" on public.quiz_answers
  for insert with check (
    exists (
      select 1 from public.quiz_attempts a
      where a.id = attempt_id and a.account_id = auth.uid()
    )
  );

create policy "quiz_answers_update_hr" on public.quiz_answers
  for update using (is_hr_or_admin());

-- ============================================================
-- PROFESSIONAL CERTIFICATES
-- ============================================================
create policy "certificates_own" on public.professional_certificates
  for select using (account_id = auth.uid() or is_hr_or_admin());

create policy "certificates_manage_hr" on public.professional_certificates
  for all using (is_hr_or_admin());

-- ============================================================
-- TRAINING SESSIONS
-- ============================================================
create policy "sessions_select_participant" on public.training_sessions
  for select using (
    is_hr_or_admin()
    or exists (
      select 1 from public.session_participants sp
      where sp.session_id = id and sp.account_id = auth.uid()
    )
  );

create policy "sessions_manage_hr" on public.training_sessions
  for all using (is_hr_or_admin());

-- ============================================================
-- SESSION SLOTS
-- ============================================================
create policy "session_slots_select" on public.session_slots
  for select using (
    is_hr_or_admin()
    or exists (
      select 1 from public.session_participants sp
      where sp.session_id = session_id and sp.account_id = auth.uid()
    )
  );

create policy "session_slots_manage_hr" on public.session_slots
  for all using (is_hr_or_admin());

-- ============================================================
-- QR TOKENS — HR creates; employees can read to validate
-- ============================================================
create policy "qr_tokens_select" on public.qr_tokens
  for select using (auth.uid() is not null);

create policy "qr_tokens_manage_hr" on public.qr_tokens
  for all using (is_hr_or_admin());

-- ============================================================
-- ATTENDANCE
-- ============================================================
create policy "attendance_own" on public.attendance
  for select using (account_id = auth.uid() or is_hr_or_admin());

-- Employees can create their own attendance (via valid QR scan)
-- Actual validation happens in API function
create policy "attendance_insert_own" on public.attendance
  for insert with check (account_id = auth.uid());

create policy "attendance_update_hr" on public.attendance
  for update using (is_hr_or_admin());

-- ============================================================
-- SESSION PARTICIPANTS
-- ============================================================
create policy "participants_own" on public.session_participants
  for select using (account_id = auth.uid() or is_hr_or_admin());

create policy "participants_manage_hr" on public.session_participants
  for all using (is_hr_or_admin());

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
create policy "notifications_own" on public.notifications
  for select using (account_id = auth.uid());

create policy "notifications_update_own" on public.notifications
  for update using (account_id = auth.uid());

create policy "notifications_insert_hr" on public.notifications
  for insert with check (is_hr_or_admin());

-- ============================================================
-- AUDIT LOGS — HR/Admin read; system inserts via API only
-- ============================================================
create policy "audit_logs_select_hr" on public.audit_logs
  for select using (is_hr_or_admin());

-- ============================================================
-- FILE UPLOADS
-- ============================================================
create policy "file_uploads_select" on public.file_uploads
  for select using (
    uploaded_by = auth.uid()
    or is_hr_or_admin()
  );

create policy "file_uploads_insert" on public.file_uploads
  for insert with check (uploaded_by = auth.uid());

-- ============================================================
-- SYSTEM SETTINGS — Admin only
-- ============================================================
create policy "system_settings_select_hr" on public.system_settings
  for select using (is_hr_or_admin());

create policy "system_settings_manage_admin" on public.system_settings
  for all using (get_my_role() = 'admin');
