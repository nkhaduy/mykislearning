-- ============================================================
-- MyKIS Learning — Courses, Enrollments, Content, Progress
-- Giai đoạn 1+2: Chuyển learning data từ localStorage → Supabase
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. courses ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS courses (
  id            TEXT PRIMARY KEY,
  status        TEXT NOT NULL DEFAULT 'draft',
  delivery_mode TEXT NOT NULL DEFAULT 'online',
  created_by    TEXT NOT NULL,
  data          JSONB NOT NULL DEFAULT '{}',
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. enrollments ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS enrollments (
  id          TEXT PRIMARY KEY,
  course_id   TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  account_id  TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'notStarted',
  data        JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(course_id, account_id)
);

-- ── 3. course_content ──────────────────────────────────────────
-- Stores lessons, slides, videos (YouTube & uploaded), PDFs, quizzes.
-- For uploaded files: data->>storageBucket, data->>storagePath, data->>mimeType, data->>fileName
-- sourceUrl must never be empty for uploaded files — use storagePath + signed URL instead.
CREATE TABLE IF NOT EXISTS course_content (
  id          TEXT PRIMARY KEY,
  course_id   TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  type        TEXT NOT NULL DEFAULT 'slide',  -- slide | video | quiz | pdf
  sort_order  INTEGER DEFAULT 0,
  data        JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. content_progress ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_progress (
  id          TEXT PRIMARY KEY,
  content_id  TEXT NOT NULL REFERENCES course_content(id) ON DELETE CASCADE,
  account_id  TEXT NOT NULL,
  course_id   TEXT NOT NULL,
  data        JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(content_id, account_id)
);

-- ── Indexes ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_courses_status        ON courses(status);
CREATE INDEX IF NOT EXISTS idx_enrollments_account   ON enrollments(account_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course    ON enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status    ON enrollments(status);
CREATE INDEX IF NOT EXISTS idx_course_content_course ON course_content(course_id);
CREATE INDEX IF NOT EXISTS idx_course_content_order  ON course_content(course_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_content_progress_acct ON content_progress(account_id);
CREATE INDEX IF NOT EXISTS idx_content_progress_cont ON content_progress(content_id);
CREATE INDEX IF NOT EXISTS idx_content_progress_crs  ON content_progress(course_id);

-- ── Disable RLS (service_role key via Vercel API only) ─────────
ALTER TABLE courses         DISABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments     DISABLE ROW LEVEL SECURITY;
ALTER TABLE course_content  DISABLE ROW LEVEL SECURITY;
ALTER TABLE content_progress DISABLE ROW LEVEL SECURITY;

-- ── Supabase Storage bucket for uploaded course files ──────────
-- Run this separately if bucket doesn't exist:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('course-content', 'course-content', false)
-- ON CONFLICT (id) DO NOTHING;
