-- 005_cloudflare_missing_tables_patch.sql
-- Safe patch: chỉ bổ sung bảng còn thiếu.
-- Không DROP, không TRUNCATE, không ảnh hưởng dữ liệu hiện có.
-- Dùng text primary key để khớp với app (acc-001, acc-hr-demo, v.v.)

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
