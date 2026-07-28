# KIS LMS staging auth-hardening rehearsal

This package is planning-only in the current remediation session. Do not run it against staging or production until the maintenance owner, database owner, and security owner approve the exact commit and window.

## Hard safety gates

- Never use a production project reference, hostname, backup, or credential.
- Do not set a default remote URL in shell profiles, CI, repository files, or scripts.
- Run `node scripts/staging-rehearsal-preflight.mjs` first. Its default mode computes only local commit/lock/migration checksums and makes no network request.
- Read-only capture mode additionally requires `KIS_STAGING_REHEARSAL_CONFIRM=I_UNDERSTAND_STAGING_ONLY`, `KIS_STAGING_CAPTURE_CONFIRM=CAPTURE_READ_ONLY_SNAPSHOTS`, and the private runtime created by `npm run staging:bootstrap -- --apply`. The preflight imports the canonical contract and immutable repository denylist rather than maintaining legacy variable names.
- The preflight never applies migrations, restores backups, deploys Workers, or mutates a database.

## Before maintenance

1. Record the exact commit SHA and require a clean reviewed release artifact.
2. Verify `package-lock.json` is the reviewed lockfile; record its SHA-256 checksum.
3. Record a deterministic SHA-256 checksum over every ordered file in `supabase/migrations`.
4. Record Supabase CLI, PostgreSQL server, extension, and Wrangler versions.
5. Take a provider-supported database backup and validate that the backup can be listed and downloaded by the database owner.
6. Capture catalog, schema, row-count, RLS/policy, grants/default privileges, constraints, indexes, triggers, functions, table sizes, database size, free disk/headroom, active connections, and long-running transactions.
7. Estimate locks and rewrites for `private.account_credentials`, `public.profiles`, and the new private auth tables. The migration adds a defaulted bigint column and creates new tables/functions; confirm the target PostgreSQL version avoids an unexpected table rewrite.
8. Announce the maintenance window, API write freeze, expected login interruption, owners, communications channel, abort authority, and recovery time objective.

Suggested read-only captures are the existing `scripts/db-catalog-snapshot.sql` plus dedicated queries for `pg_policy`, `information_schema.role_table_grants`, `pg_default_acl`, `pg_constraint`, `pg_indexes`, `pg_stat_user_tables`, `pg_database_size`, and active locks. Store evidence outside the repository when it contains identifiers or operational metadata.

## Disposable restore rehearsal

1. Restore the approved staging backup into a disposable, isolated PostgreSQL/Supabase environment with no production integrations, webhooks, email, queues, or Worker routes.
2. Verify restore integrity before migration: database version, schema checksum, row counts, orphan checks, duplicate checks, department foreign-key assumptions, RLS/grants, and representative auth credentials.
3. Record start/end time and sample `pg_stat_activity`/`pg_locks` throughout the migration.
4. Apply the reviewed migration set using the exact locked CLI version. Do not deploy the Worker.
5. Run fresh/legacy/partial migration checks locally, then run disposable-environment compatibility checks for:
   - account credential versions;
   - session creation and atomic refresh rotation;
   - refresh reuse family revocation;
   - concurrent refresh (one success maximum);
   - password reset, password change, account disable, and logout-all revocation;
   - intentional MFA/2FA removal, including absence of enrollment, challenge, recovery-code, and step-up endpoints;
   - private-schema grants and direct `anon`/`authenticated` denial.
6. Run API smoke tests against a synthetic local/disposable Worker runtime only: employee/HR/Admin password login, refresh, logout, logout-all, session list/revoke, privileged export authorization, explicit MFA endpoint absence, and rate-limit binding validation.
7. Re-run orphan, duplicate, department, row-count, constraint/index, RLS/grant, and catalog snapshots and diff them against the pre-migration captures.
8. Measure total migration duration, longest lock wait/hold, API unavailability, restore duration, and cleanup duration.

## Go/no-go criteria

Go only if all are true:

- Migration completes within the approved window and the measured lock hold is below the agreed threshold (initial target: 30 seconds for any user-facing table; tighten after rehearsal evidence).
- Restored and post-migration row counts reconcile with zero unexplained loss.
- Orphan and duplicate checks return zero new findings.
- RLS, policies, grants, default privileges, SECURITY DEFINER ownership, and function EXECUTE privileges match the reviewed fail-closed matrix.
- Employee/HR/Admin password login, refresh rotation, replay family revocation, concurrent refresh, logout, password-change revocation, session revoke, and explicit MFA endpoint absence pass.
- Critical APIs pass and error rate remains within the agreed baseline (initial target: no new 5xx in smoke tests).
- Backup restore is independently validated and timed within the recovery objective.
- No access token, refresh token, TOTP secret, recovery code, service key, or production identifier appears in logs or artifacts.

No-go if any criterion is unknown, if lock duration threatens the window, if auth cannot fail closed, or if rollback evidence is incomplete.

## Rollback versus roll-forward

- Roll back by restoring the validated backup when there is data loss/corruption, broken credential compatibility, incorrect private-table ownership/grants, or a partially applied transaction whose correctness cannot be proven.
- Prefer roll-forward only for a small, reviewed, reversible defect when data is intact, the database is consistent, the fix is rehearsed, and the maintenance owner approves the extension.
- The migration is transaction-wrapped. If PostgreSQL reports failure before commit, verify migration history and catalog state rather than assuming rollback.
- If the migration committed but Worker compatibility is broken, keep the Worker undeployed, restore the previous application release, and decide between a reviewed forward compatibility patch and backup restore.
- If auth schema behavior is suspect, revoke all new auth sessions/token families using the service-role-only revocation function before reopening access. Do not log raw tokens.
- After backup restore, rotate staging-only service credentials used during rehearsal and invalidate all rehearsal sessions.

## Production change package after a successful rehearsal

Attach commit/lock/migration checksums, backup ID and restore evidence, before/after catalog diffs, row-count reconciliation, lock timeline, auth/session and MFA-removal smoke evidence, RLS/grant evidence, rollback decision tree, named owners, and the final go/no-go record. Production remains blocked until this evidence is reviewed.
