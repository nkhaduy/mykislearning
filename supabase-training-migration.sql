-- ============================================================
-- MyKIS Learning — Training Sessions Migration
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- Sessions: HR creates, everyone can read (filtered by participant)
CREATE TABLE IF NOT EXISTS training_sessions (
  id          TEXT PRIMARY KEY,          -- crypto.randomUUID() from client
  course_id   TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'scheduled',
  start_at    TIMESTAMPTZ NOT NULL,
  end_at      TIMESTAMPTZ NOT NULL,
  created_by  TEXT NOT NULL,             -- accountId of HR who created
  data        JSONB NOT NULL,            -- full session object (camelCase preserved)
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Participants: which accounts are assigned to each session
CREATE TABLE IF NOT EXISTS training_participants (
  id         TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,
  data       JSONB NOT NULL DEFAULT '{}',
  UNIQUE (session_id, account_id)
);

-- Registrations: per-participant response + attendance status
CREATE TABLE IF NOT EXISTS training_registrations (
  id         TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,
  data       JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (session_id, account_id)
);

-- Indexes for fast calendar queries
CREATE INDEX IF NOT EXISTS idx_training_sessions_start ON training_sessions (start_at);
CREATE INDEX IF NOT EXISTS idx_training_sessions_status ON training_sessions (status);
CREATE INDEX IF NOT EXISTS idx_training_participants_account ON training_participants (account_id);
CREATE INDEX IF NOT EXISTS idx_training_registrations_account ON training_registrations (account_id);

-- Disable RLS so service_role key can read/write freely.
-- These tables are accessed only through our Vercel API endpoints
-- which enforce their own accountId-based authorization.
ALTER TABLE training_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE training_participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE training_registrations DISABLE ROW LEVEL SECURITY;
