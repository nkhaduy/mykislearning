-- ============================================================
-- Migration 012: Compliance Training RLS hardening
-- Enables RLS on Phase 3 Compliance tables after production
-- validation showed anon REST can reach empty tables when RLS is
-- disabled. The Cloudflare Worker uses the Supabase service-role
-- key, which bypasses RLS; browser clients must use Worker APIs.
-- ============================================================

alter table public.compliance_programs enable row level security;
alter table public.compliance_target_rules enable row level security;
alter table public.compliance_cycles enable row level security;
alter table public.compliance_assignments enable row level security;
alter table public.compliance_completion_records enable row level security;

-- No anon/authenticated direct policies are created in Phase 3.
-- This intentionally denies browser Supabase REST access while
-- keeping service-role Worker access available.

-- Rollback note:
-- alter table public.compliance_programs disable row level security;
-- alter table public.compliance_target_rules disable row level security;
-- alter table public.compliance_cycles disable row level security;
-- alter table public.compliance_assignments disable row level security;
-- alter table public.compliance_completion_records disable row level security;
