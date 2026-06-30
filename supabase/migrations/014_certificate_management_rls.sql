-- ============================================================
-- Migration 014: Certificate Management RLS hardening
-- Existing employee_certifications had legacy direct policies.
-- Phase 4 uses Worker-only APIs, so direct browser REST access is
-- denied while service-role Worker access remains available.
-- ============================================================

alter table public.employee_certifications enable row level security;

drop policy if exists "certifications_read" on public.employee_certifications;
drop policy if exists "certifications_manage_hr" on public.employee_certifications;

-- No anon/authenticated direct policies are created in Phase 4.

-- Rollback note:
-- Recreate the legacy policies from migration 004 only if direct
-- Supabase browser access is intentionally restored.
