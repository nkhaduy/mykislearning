# KIS LMS Production Deployment Report

Date: 2026-07-28
Scope: production bootstrap and release preparation only; final cutover was not run.

## 1. Approval and No-MFA acceptance

- No-MFA status: **Accepted** by Nguyễn Khả Duy, Chủ dự án KIS LMS.
- Approval date: 2026-07-28; review date: 2027-01-28.
- Incident response, change, and rollback owner: Nguyễn Khả Duy.
- The guarded sign-off command was rerun after Git identity configuration; the exact residual-risk confirmation remains recorded.

## 2. Git and release checksums

- Release branch: `release/kis-lms-production-20260728`.
- Remediation baseline commit: `2b9c633fc607fe6ac232c2e152dfdda68396aedc`.
- Baseline tree: `15e9f495d9c1f0f91cccbb18cf6b2fd575041482`.
- The final bootstrap commit/tree, package lock, migrations, Wrangler config, staging evidence, build, and gate checksums are written to `/tmp/kisvn-production-release-manifest.json` after the tracked release source is clean.
- Protection snapshots: `/tmp/kisvn-production-predeploy-h2lG3S` and `/tmp/kisvn-production-bootstrap-Vq3YlD`, both checksum-verified.

## 3. Production target

- Cloudflare account: `b9ae...3f33`; Worker: `mykis-learning`; hostname: `kislms.site` (`www.kislms.site` redirects).
- Supabase project: `mooq...tqtq`, `ACTIVE_HEALTHY`, region `ap-northeast-2`.
- Production identity has multiple independent signals and is distinct from staging Worker/project/resources.
- Read-only discovery is recorded in `evidence/PRODUCTION_TARGET_DISCOVERY.json`.

## 4. Backup and restore evidence

- Backup: `LOGICAL-20260728T141815476Z-2b3e68deb481` using a secure linked Supabase logical dump.
- Disposable restore passed row counts, catalog comparison, integrity, RLS/grants, functions/views/triggers, and application contract smoke.
- One existing unvalidated foreign key is covered by the reviewed reconciliation migration, which validates unvalidated foreign keys before later migrations.
- Dump files were deleted in `finally`; no database password was written to the repository or command line.

## 5. Resource provisioning

- Production Queue `mykis-report-exports`, DLQ `mykis-report-exports-dlq`, and private R2 bucket `mykis-report-exports` are provisioned and distinct from staging.
- Queue batch size and maximum concurrency are both `3`; DLQ and application retry/replay controls remain fail-closed.
- Durable Object SQLite binding/migration and hourly cleanup cron are present in the verified Wrangler configuration.
- Queue consumer attachment and binding activation are intentionally deferred to the final approved Worker deployment.

## 6. Secret inventory

- Required production Worker secret names are verified without reading values.
- Independent replacement signing/hashing secrets and Supabase production credentials are held only in `/tmp/kisvn-production-runtime.json`, mode `0600`.
- Existing live signing secrets are not rotated during bootstrap; the approved deploy script uploads the replacement secret set atomically with the release version.
- Fingerprints and names only are recorded in `evidence/PRODUCTION_SECRET_INVENTORY.json`.

## 7. Migration preparation

- Production migrations were not applied.
- Restore evidence and the release manifest bind the migration list to the canonical staging rehearsal checksum.
- `production:deploy-approved` reruns a linked Supabase migration dry-run inside the active maintenance window before consuming the approval token.

## 8. RLS, grants, and catalog

- Restore comparison reports zero invalid indexes, zero public tables without RLS, and no browser-role table grants in the audited schemas.
- The existing unvalidated course-version foreign key is a named preflight finding covered by the reconciliation migration.
- No production schema or grant mutation occurred during bootstrap.

## 9. Search rollout

- Production search and export feature flags remain disabled.
- No live index, backfill, cutover, legacy-path removal, or feature-flag mutation occurred.

## 10. Deployment IDs

- Current rollback checkpoint after read-only refresh/secret-name preparation: deployment `c81496f8-dbb4-462c-bb75-28e5f7baae30`, version `49c5cb16-2ca1-49ac-9b8c-ecaf117e59ca`.
- Previous application deployment version: `47ec00e8-561e-444e-aa29-0e1596aa8420`.
- No release Worker/frontend/Queue/cron deployment was run.

## 11. Authentication and session smoke tests

- No-MFA removal contract passed; sign-off validation remains explicit-owner-only.
- Production authentication/session mutation smoke tests are deferred until an approved cutover.

## 12. Route smoke tests

- Canonical staging smoke passed 22 checks on the active stable staging version.
- Production route smoke was not run because cutover did not occur.

## 13. Reports and search results

- Staging reporting timeout/concurrency, search rollout/rollback, and export format coverage passed as recorded in the staging readiness report.
- Production data-path mutation tests remain deferred to the approved maintenance window.

## 14. Queue, DLQ, R2, and Durable Object integration

- Production resources and bindings are provisioned/configured; no user-affecting synthetic message or object was created.
- Final integration smoke remains a post-deploy checkpoint.

## 15. Alert validation

- Cloudflare account email `nkhaduy@gmail.com` is verified as an account destination.
- The current Wrangler OAuth surface does not expose Alerting scopes, and Alerting API discovery returns HTTP 403.
- Critical policies and delivery testing are therefore not complete. This is a hard `NO-GO` blocker.

## 16. Monitoring evidence

- Staging thresholds and runbooks cover Worker errors, login failures, refresh reuse, Queue/DLQ, exports, R2/DO, database health, and search/report latency.
- The production monitoring window has not started because no cutover occurred.

## 17. Rollback readiness

- Previous production deployment/version and restore-tested backup are recorded.
- Search/export flags remain off and no destructive down migration is planned.

## 18. Synthetic cleanup

- No production synthetic user data, export jobs, Queue messages, or R2 objects were created during bootstrap.
- Logical dump files and disposable restore database were removed after validation.

## 19. Remaining follow-ups

- Obtain Cloudflare Alerting permission, configure all critical policies, and pass a real delivery test.
- Record a real Asia/Ho_Chi_Minh maintenance window approved for the existing production user population.
- Run the final release gates/manifest and require `npm run production:plan` to print the literal success line before invoking the final command.

## 20. Final decision

**PRODUCTION NO-GO**

Bootstrap preparation is complete up to the human-controlled alerting and maintenance-window gates. No production migration, application deploy, traffic cutover, DNS change, or feature-flag change was performed.
