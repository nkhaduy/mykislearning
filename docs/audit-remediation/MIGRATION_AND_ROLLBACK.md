# Migration And Rollback

## Checkpoint 2026-07-27 — Phase 1 Start

- `20260726090000_security_containment.sql` remains unapplied to production, staging, and local runtime at checkpoint start.
- The repository is linked to Supabase metadata under `supabase/.temp`; connection values are treated as sensitive and will not be printed or used for this checkpoint.
- Only a newly provisioned local/ephemeral runtime with synthetic data may receive the migration. A pre-apply catalog snapshot is mandatory.
- Supabase CLI `2.107.0` is installed; Docker and native PostgreSQL clients are initially unavailable, so runtime provisioning must be completed before apply.

## Checkpoint 2026-07-27 — Ephemeral Replay Result

- A separate Colima/Docker runtime and `/tmp` Supabase project were provisioned; the linked project metadata was not used.
- Full pre-containment history replay failed at `005_cloudflare_missing_tables_patch.sql` because migrations `001` and `005` encode incompatible profile schemas (UUID/`department_id` versus text/`department`).
- The failure occurred before the pending containment migration was copied or applied. No production, staging, or remote database was contacted.
- Rollback was automatic because the local stack stopped. The failed runtime contains no synthetic account data and is not evidence for migration safety.
- Next apply path: establish a clearly documented Worker-compatible pre-containment baseline, snapshot it, seed only synthetic records, then apply the containment migration once and capture the post-state. The incompatible legacy chain remains a production-readiness blocker until reconciled against a real catalog snapshot.

## Pre-Apply Evidence

- Structured catalog: `docs/audit-remediation/evidence/db-before/catalog.json`.
- Synthetic dataset/model inventory: `docs/audit-remediation/evidence/db-before/seed-row-counts.json`.
- Safety/object/idempotency/lock review: `docs/audit-remediation/evidence/MIGRATION_PREFLIGHT.md`.
- Synthetic seed is applied only to the local Worker-compatible runtime. No production or linked project credentials were used.

No migration has been applied to production by this remediation task.

## Safety Rules

- Take a verified database backup before applying security or credential migrations.
- Apply migrations first to an ephemeral/local database, then staging.
- Capture pre/post catalog snapshots for grants, RLS flags, policies, exposed schemas, and security-definer functions.
- Prefer forward recovery. Rollback must not re-enable anonymous private-table access or restore profile-field credential hashes.

## Migration Added

`supabase/migrations/20260726090000_security_containment.sql`

The migration:

1. Creates the non-exposed `private` schema and service-role-only tables `private.account_credentials`, `private.revoked_sessions`, and `private.bootstrap_state`.
2. Backfills versioned PBKDF2 hashes from legacy profile fields without selecting or logging hash values.
3. Clears legacy `__pwd__:` avatar markers and replaces hash-like `password_status` values with non-secret status values.
4. Enables RLS on every table in `public` and revokes direct `anon`/`authenticated` table, sequence, and function privileges.
5. Grants only `service_role` access required by the canonical Worker service layer.

Legacy migration intent was also repaired in `supabase-courses-migration.sql`, `supabase-training-migration.sql`, `supabase/migrations/007_hr_operational_overview.sql`, `supabase/migrations/010_learning_paths.sql`, `supabase/migrations/011_compliance_training.sql`, and `supabase/migrations/20260701085524_notification_reminder_engine.sql` so a fresh database does not temporarily recreate RLS-disable/browser-grant drift.

## Apply Sequence

1. Take and verify a database backup; capture row counts for `profiles` and the private-data tables.
2. Capture the pre-migration catalog using `scripts/verify-supabase-security.sql` and store output in a restricted location.
3. Apply all migrations to an ephemeral/local Supabase stack. Do not apply directly to production.
4. Run catalog checks, Supabase advisors, auth login/reset/change-password tests, and anon/employee/HR/admin/service-role policy tests.
5. Apply to staging, rotate/revoke existing sessions, then run the same checks and selected mutation E2E against synthetic staging data.
6. Schedule production only after explicit approval, backup confirmation, CDN purge plan, and incident/privacy owner sign-off.

## Recovery Principle

If the new credential store fails after deployment, restore the database backup or repair the private credential rows. Do not re-enable the `avatar_url`/profile hash fallback. Use an account password reset campaign as the fail-closed recovery path.

If `private.bootstrap_state` is claimed but credential creation fails, keep setup disabled and recover the target admin through the normal password reset path. Do not delete the bootstrap claim merely to retry the public bootstrap endpoint.

If Worker service-role queries fail after RLS/grant hardening, prefer a forward fix to Worker/schema permissions. A full backup restore is the last recovery option; do not restore anonymous/authenticated private-table grants.

## Current Verification State

- The migration was applied only to `/tmp/kis-lms-worker-supabase.tzteKG`, an isolated Supabase/PostgreSQL 17.6 runtime backed by a dedicated Colima profile.
- Pre/post catalogs and structured diff are stored under `docs/audit-remediation/evidence/db-before/`, `docs/audit-remediation/evidence/db-after/`, and `docs/audit-remediation/evidence/db-diff.md`.
- Apply result: 66/66 public tables RLS-enabled, browser table/function privileges zero, three private stores created, legacy markers cleared, and service-role-only RPC access working while `private` remains unexposed.
- Supabase DB lint reports no schema errors. Advisors report warnings for pre-existing duplicate policies/indexes and mutable search paths on four legacy functions; the six new security-definer RPCs use `search_path=''`.
- Full repository history is not staging-ready because replaying `001` through `005` fails on incompatible profile schemas. A real staging/production catalog snapshot is still required before any apply.

## Checkpoint Close 2026-07-27

- The local runtime remains available for review at `/tmp/kis-lms-worker-supabase.tzteKG`; secrets and connection strings remain only in mode-restricted temporary files and are not committed.
- Final repository regression gates pass after the runtime changes: unit `30/30`, security `20/20`, public E2E `7/7`, build/privacy/budget, audit 0 vulnerabilities, and diff check.
- Staging readiness is blocked by the migration `001`/`005` schema conflict, missing approved staging catalog parity, refresh/MFA gaps, and distributed edge rate-limit verification.
- Production remains untouched. A production apply still requires a verified backup, pre/post catalog capture, staging rehearsal, session/revocation plan, and explicit approval.

## Frontend Delivery Checkpoint

The `PERF-001` through `PERF-006` and `UX-002/UX-005` changes add no database migration and preserve the existing Worker login contract. The auth slice can be rolled back independently by routing `/login` from `src/app/bootstrap.js` back to `app.js`, removing the auth-specific stylesheet branch, and removing `src/features/auth/*` from the build allowlist. Preserve the native form/non-JSON handling, artifact scanner, PII removals, HttpOnly-cookie contract and redirect allowlist during any rollback.

The `NEW-SEC-001` dependency update also has no database migration. If SheetJS `0.20.3` causes an export/import regression, do not restore vulnerable `0.18.5`; disable XLSX temporarily while keeping CSV available, then move forward to a supported release after round-trip and Worker dry-run verification.

## Load And Normalization Preparation Checkpoint

- `scripts/run-ephemeral-load-tests.mjs` inserted only `load-*` synthetic rows into `/tmp/kis-lms-worker-supabase.tzteKG`, measured query plans/latency, and deleted all seeded rows in `finally`; post-run counts are zero.
- No migration was created or applied for the observed performance bottlenecks. Index/keyset/export changes require separate review because they affect API contracts and write cost.
- `SCHEMA_NORMALIZATION_PLAN.md` and `schema-normalization-contract.json` are planning/contract artifacts only. They explicitly prohibit destructive changes in this checkpoint.
- A future normalization rollback must preserve both model eras until parity is proven. Never use rollback to restore browser grants, anonymous access, profile credential fields, or legacy auth fallback.
