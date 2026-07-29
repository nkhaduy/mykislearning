# Production Migration History Reconciliation

Date: 2026-07-29
Target: production Supabase project `mooq...tqtq`
Decision: **DISPOSABLE REHEARSAL PASS; PRODUCTION UNCHANGED**

No production migration, migration-history repair, clean reset, Worker/frontend deployment, secret change, DNS change or feature-flag change was run.

## Reconciliation result

- The 13 remote-only versions are exact byte-for-byte aliases of 13 local migration files. The mapping checksum is `00b04bfa78e27329449dcf3b6ce8d3c945b128c3f42f9d4d1d5110319e00d915`.
- The alias mapping is approved for the guarded production workflow. Canonicalization changes migration history only and preserved the disposable application schema checksum.
- After the allowlisted clean reset removed the legacy business-data blockers, the disposable migration dry-run listed exactly 8 pending migrations (7 existing plus the two-role migration).
- All 8 pending migrations applied successfully. A second migration pass applied 0 and skipped all 8 already-recorded versions.
- Clean replay and restored-production upgrade produced equivalent `public`/`private` schemas, including constraints, indexes, functions, triggers, RLS policies and grants.

## Exact pending allowlist

1. `20260727172321_reconcile_legacy_department_schema.sql`
2. `20260728013513_auth_rotation_mfa_hardening.sql`
3. `20260728030009_remove_mfa_2fa.sql`
4. `20260728031000_employee_search_cursor.sql`
5. `20260728032000_background_export_jobs.sql`
6. `20260728103000_reporting_rpc.sql`
7. `20260728104000_export_operations.sql`
8. `20260729022415_consolidate_roles_to_hr_and_employee.sql`

## Integrity after rehearsal

- Orphan course versions: `0`.
- Duplicate normalized email groups: `0`.
- Duplicate normalized employee-code groups: `0`.
- Unvalidated foreign keys: `0`.
- Public tables without RLS: `0`.
- Browser-role table grants: `0`.
- Schema equivalence: `PASS`.
- Rollback restore rehearsal: `PASS`.
- Clean-reset and migration idempotency: `PASS`.

## Production condition

Production still has the original 13 alias rows because production history was not mutated. The production gate must verify, inside a new active maintenance window of at least 90 minutes, that guarded alias canonicalization has completed, the linked dry-run reports exactly the approved 8 files, and every clean-reset readiness condition passes before it can print `GO FOR PRODUCTION DEPLOYMENT`.

Structured evidence:

- `docs/audit-remediation/evidence/PRODUCTION_MIGRATION_HISTORY_RECONCILIATION.json`
- `docs/audit-remediation/evidence/PRODUCTION_CLEAN_RESET_REHEARSAL.json`
