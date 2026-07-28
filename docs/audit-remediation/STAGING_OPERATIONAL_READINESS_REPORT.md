# KIS LMS Staging Operational Readiness Report

Date: 2026-07-28

Staging execution ID: `00332c83-e0b1-4286-ae7a-7b7941ac120b`

Technical staging conclusion: **STAGING READY WITH OPERATIONAL FOLLOW-UP**

Production conclusion: **PRODUCTION BLOCKED**

No production deployment, production database access/mutation, production secret change, DNS/route change, or production feature-flag change was performed.

## 1. Baseline and snapshots

- Branch `main`; baseline HEAD `e0ff4f9b3d2b46e34e0669ef8f86c4d1be37c765`.
- The pre-existing dirty worktree was preserved; no reset, clean, rebase, or bulk restore was used.
- Previous snapshot `/tmp/kisvn-staging-execution-20260728-MPe9Wa` and bootstrap snapshot `/tmp/kisvn-staging-bootstrap-20260728-4DU0WB` were verified.
- Final execution snapshots `/tmp/kisvn-staging-final-20260728-vHgM08` and `/tmp/kisvn-staging-final-report-20260728-rq8RXo` were created after cleanup; all entries in each `SHA256SUMS` verify.
- The bootstrap snapshot contains tracked/staged patches, untracked inventory, status, package-lock checksum, migration checksums, Wrangler checksum, commit SHA, and `SHA256SUMS`; it contains no staging secret values.
- `git diff --check` passes. The private runtime remains outside the repository at `/tmp/kisvn-staging-runtime.json`, mode `0600`.

## 2. Approval and owners

- Approval ID: `OWNER-STAGING-20260728T074103Z-e0ff4f9b`.
- Approved by/change owner/rollback owner: local technical owner `khaduy`, source `local-system-owner` because Git identity was unavailable.
- Scope: staging-only technical execution. This is not production approval and not No-MFA risk acceptance.
- Fresh disposable staging identity: `SUPABASE-FRESH-vwawtqbkchmdnqetkewm`.

## 3. Canonical environment contract

- The previous mismatch between `KIS_STAGING_PROJECT_REF`/`KIS_PRODUCTION_PROJECT_REFS` and the documented canonical names was removed.
- `scripts/staging/staging-contract.mjs` is the shared contract for guard, bootstrap, preflight, provision, deploy, smoke, rollback, and readiness commands.
- Transitional aliases normalize to canonical fields; conflicting canonical/alias values fail closed.
- The repository denylist is immutable and environment additions can only extend it.
- Tests cover case changes, trailing dots, Unicode/punycode normalization, percent-encoding, hostname boundaries, exact resource matching, project matching, and transaction-pooler identity.
- `npm run staging:bootstrap -- --plan`, `--apply`, and `npm run staging:verify-target` pass idempotently.

## 4. Production denylist

`config/production-denylist.json` records evidence for `kislms.site`, `www.kislms.site`, the production Workers hostname, Worker `mykis-learning`, production Queue/DLQ/R2 names, and both previously visible unknown Supabase refs. Unknown/linked projects are deny-by-default and were not queried or mutated.

## 5. Staging target identity

| Field | Verified value |
| --- | --- |
| Environment | `staging` |
| Cloudflare account | `b9ae...3f33` |
| Worker | `mykis-learning-staging` |
| Hostname | `mykis-learning-staging.nkhaduy.workers.dev` |
| Queue | `kis-lms-export-staging` |
| DLQ | `kis-lms-export-dlq-staging` |
| R2 | `kis-lms-exports-staging` |
| Supabase project | `vwaw...kewm` / `kis-lms-staging` |
| Region | `ap-northeast-2` |
| Database endpoint | transaction pooler `aws-1-ap-northeast-2.pooler.supabase.com` |

The direct Supabase database hostname was IPv6-only from this machine. The guard accepted the transaction pooler only because its username binds the exact staging project ref. No production/custom domain or production route is attached.

## 6. Resource provisioning

| Resource | Expected | Existing/result | Action |
| --- | --- | --- | --- |
| Worker/assets | `mykis-learning-staging` | deployed | created and reused idempotently |
| Queue | `kis-lms-export-staging` | active | created, producer/consumer bound |
| DLQ | `kis-lms-export-dlq-staging` | active | created and configured as dead letter |
| R2 | `kis-lms-exports-staging` | private | created, dev URL disabled |
| Durable Object | `RATE_LIMITER_DO` | SQLite class migration | deployed and bound |
| Cron | hourly | active | deployed with scheduled cleanup |
| Supabase | fresh project | healthy | created and migrated |

Cloudflare rejected retention above 86,400 seconds for this account; Queue and DLQ therefore use the provider maximum of 86,400 seconds. Database expiry, R2 retention, DLQ audit, and hourly cleanup remain the durable retention controls. Staging uses batch size 3 and maximum concurrency 3.

## 7. Secrets and feature flags

Independent CSPRNG values were generated and installed without printing values. Configured names are `JWT_SECRET`, `REFRESH_TOKEN_HASH_SECRET`, `CURSOR_SIGNING_SECRET`, `RATE_LIMIT_KEY_SECRET`, `AUDIT_IP_HASH_SALT`, `SUPABASE_SERVICE_ROLE_KEY`, and synthetic `DEPLOYMENT_TEST_ACCOUNTS`. Governance is recorded in `STAGING_SECRET_INVENTORY.md`.

`SEARCH_ROLLOUT_ENABLED` and `EXPORT_FEATURE_ENABLED` are staging-scoped. Both default off in static staging config, are explicitly enabled in the stable deployment, and were disabled/re-enabled during rollback without production impact.

## 8. Backup and restore evidence

- The source is a newly created disposable staging project, not production data.
- A staging logical data dump was restored into a temporary local Supabase-compatible database after applying the exact migration set.
- Critical row counts matched for profiles, departments, courses, enrollments, sessions, refresh tokens, and export jobs.
- Invalid indexes, unvalidated foreign keys, public tables without RLS, and profile/auth orphans were all zero.
- The temporary database and dump file were removed in `finally`.
- Evidence: `docs/audit-remediation/evidence/staging-rehearsal/00332c83-e0b1-4286-ae7a-7b7941ac120b/database-restore-drill.json`.

This validates the technical logical-restore path. A restore-tested production backup ID remains mandatory in the separate production window.

## 9. Database preflight and migrations

- Fresh hosted migration rehearsal passed through the staging transaction pooler.
- Local fresh, legacy-upgrade, recoverable-partial, and conflict-rollback scenarios all pass on PostgreSQL 17.6.
- Captures include migration history, catalog snapshot, database/table/index/role statistics, locks, long-running queries, advisors, versions, sizes, RLS, grants, functions, views, triggers, extensions, and invalid indexes.
- Evidence directory: `docs/audit-remediation/evidence/staging-rehearsal/00332c83-e0b1-4286-ae7a-7b7941ac120b`.

Hosted CLI output did not expose reliable per-migration lock duration/table-rewrite timing. The fresh project had no production-scale contention, so those measurements remain a production change-window checkpoint rather than a staging code blocker.

## 10. Catalog, RLS, and grants

Migration tests and hosted catalog evidence pass the expected containment: public tables use RLS, browser table grants are absent, private auth/export tables remain private, foreign keys are validated, no invalid index remains, and security-definer RPC execution is restricted to service roles.

## 11. Search rollout

- Additive schema/RPC migration and rollout helpers are present and validated.
- Keyset backfill, pause/resume, restart, concurrent-index, invalid-index cleanup, verify, cutover, and rollback packages pass local dry-run checks.
- Staging feature-flag cutover to the new search path passed, rollback to legacy passed, and the stable version was restored with the new path enabled.
- Search performance evidence passes: substring p95 19.629 ms, prefix p95 1.488 ms, cursor p95 0.092 ms in the local benchmark.

The fresh staging dataset cannot reproduce production-scale concurrent-index lock/I/O impact; production must retain the documented online-index checkpoint and must not drop the legacy path during first rollout.

## 12. Reporting and PostgREST

- Hosted timeout probe returned 500 after PostgreSQL cancellation in 994 ms; the next overview request returned 200, proving connection reuse.
- No global database timeout was changed.
- The local 100,000-row benchmark returned exact aggregates, bounded 100-row pages, stable next cursor, real statement cancellation, and a reusable connection.
- Latest timings: overview p95 1,187.26 ms; detail first-page p95 283.99 ms; concurrency 8 at 2,299.51 ms and concurrency 20 at 8,116.03 ms.
- Outer `EXPLAIN (ANALYZE, BUFFERS)` evidence is captured. Hosted inner-node `auto_explain` and production-like I/O remain operational follow-up because provider-level logging was not enabled.

## 13. Staging deployment

- Canonical release evidence: `docs/audit-remediation/evidence/CANONICAL_STAGING_RELEASE.json`, verified read-only against the active Cloudflare deployment on 2026-07-28.
- Stable Worker version after rollback: `1c8d06e9-393e-4eff-917c-5761a23ddc89`.
- Stable deployment ID after rollback: `35c719ee-8592-4ae9-9cfb-5aa36e474022`.
- Candidate used for final rollback drill: `629ff5d6-f10b-41ae-9437-b56c1af80740`.
- Wrangler `4.114.0`; compatibility date `2026-07-28`; assets, Queue consumer, scheduled handler, R2, and Durable Object bindings are present.
- Production config was dry-run only; production was never deployed.

## 14. Authentication and authorization smoke

Staging passes public routes, Employee/HR/Admin login, session validation, refresh rotation, logout, employee denial from HR scope, HR/Admin employee access, MFA endpoint absence, and local `1 / 1` rejection. Local suites additionally pass concurrent refresh/reuse detection, logout-all/revoke contracts, disabled-account behavior, forged identity/header rejection, role spoofing, cursor scope, and export ownership reauthorization.

## 15. Route smoke

All split-route registry tests, direct navigation, reload, dynamic IDs, role denial, empty/error states, unknown-route 404 semantics, back/forward behavior in Playwright, and no-monolith checks pass. Public and authenticated E2E suites each pass 8/8.

## 16. Export, Queue, DLQ, and R2

- Real staging integration passes 30/30 checks.
- All eight report types complete in CSV, XLSX, and compact PDF; authorized downloads return 200 and non-empty private objects.
- Cancellation, rate-limit threshold, private R2 round trip, and disabled R2 development URL pass.
- A real batch failure exposed 10 jobs stranded in `running`. Root cause was unbounded per-batch `waitUntil` concurrency. The consumer now awaits each message, uses staging batch size 3/concurrency 3, and the full 24-format rerun passes.
- Final staging cleanup conditionally cancelled 22 stale synthetic `running` jobs from interrupted probes; the closing aggregate has no queued/running jobs.
- Multipart creation is awaited; unsupported runtime `abort()` is guarded and the lifecycle abort rule remains the orphan backstop.
- Local gates pass duplicate delivery, retry classification, max-three replay, DLQ envelope redaction, idempotency, expiry, oversize limits, role-change reauthorization, checksum/size metadata, and no credential fields in messages.

A forced real failure-to-DLQ/replay was not injected into the shared staging queue after the stable pass; the plan-only replay tool and local DLQ contract are ready. This is an operational drill follow-up, not a code-path failure.

## 17. Durable Object rate limiting

The deployed staging threshold returns 429 with `Retry-After` after five failed logins. Local tests pass shared Durable Object state, cleanup alarms, trusted `CF-Connecting-IP`, spoofed forwarding-header resistance, multiple Worker contexts, and fail-closed behavior when the binding is absent. A controlled multi-colo load probe remains operational follow-up.

## 18. Observability and alerts

Redaction rules and exact thresholds/runbooks exist for Queue backlog, DLQ count, export failures/duration, R2/DO errors, login failures, refresh reuse, DB timeout/connections, search/report p95, and migration/backfill failure. Provider-native/third-party alert destinations were not available through the authenticated CLI surface, so no real paging integration was created.

Critical alert provisioning must be completed before production approval. No access token, refresh token, password, secret, raw export data, or raw sensitive PII was written to evidence.

## 19. Rollback drill

- Application/frontend: deployed a candidate with search/export disabled, then rolled back to the stable version.
- Search: feature flag rollback to legacy and restoration to the new staging path passed.
- Export: Queue pause/resume passed; idempotent replay semantics pass local gates; the stable 24-format integration passed before rollback.
- Database: logical dump/restore into a temporary disposable database passed row-count and integrity comparison.
- Post-rollback smoke passed and the runtime manifest now records the actual stable version.

## 20. Full gate result

All requested gates pass: lint (136 warnings under ceiling 139), typecheck, migrations, unit, security, auth rotation, MFA removal, rate limit, session security, reports, export jobs, public/authenticated E2E, all routes, 100k reports, concurrency, timeout, all export types, Queue/DLQ, R2 authorization, employee search, rollout checks, build, artifact scan, bundle budget, route bundles, legacy-monolith check, base/staging Wrangler dry-runs, `npm audit` with zero vulnerabilities, and `git diff --check`.

## 21. No-MFA acceptance

`NO_MFA_SECURITY_ACCEPTANCE.md` remains **Pending**. It now contains the exact guarded owner-signoff command. The implementation agent did not execute it or self-approve the risk. Technical staging readiness is independent; production approval is not.

## 22. Production deployment package

The repository contains guarded plan-only production verification/deployment scripts plus `PRODUCTION_REQUIRED_INPUTS.md` and `PRODUCTION_GO_LIVE_RUNBOOK.md`. The verifier requires staging readiness, Accepted No-MFA status, backup ID, exact account/Worker/hostname/project allowlists, database/project identity, a one-time approval token, and two explicit confirmations. The deployer passes only a password-free DB URL to the CLI and uses a temporary `pgpass` file removed in `finally`.

No production command was executed.

## 23. Remaining risks and exact prerequisites

1. An authorized owner must record No-MFA `Accepted` or reject production go-live.
2. Configure and test critical production alert destinations using `STAGING_OBSERVABILITY_RUNBOOK.md` thresholds.
3. Identify a restore-tested production backup ID and retain restore evidence for the approved window.
4. Install production-only secrets through secure provider mechanisms and run `npm run production:plan` with the exact target allowlist.
5. During production, retain the online-index lock/I/O checkpoint and legacy-search rollback path.

## 24. Decision

Technical staging: **STAGING READY WITH OPERATIONAL FOLLOW-UP**.

Production: **PRODUCTION BLOCKED** because No-MFA acceptance is Pending, critical paging is not provisioned, and the production backup/secrets/one-time approval are intentionally reserved for a separate owner-approved session.

Stop here. Do not deploy production from this execution.
