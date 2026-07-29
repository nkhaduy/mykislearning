# KIS LMS Production Deployment Report

Date: 2026-07-29
Scope: production release attempt, automatic rollback, and recovery evidence.

## 0. Release attempt outcome

- Release commit: `7c50027d67690ba18bb9ac306a87dd42453d970b`.
- New Worker deployment: `be4cb405-9dc6-41f9-8045-1c1cce7d343e` (`eefcc2f7-f45d-4694-8c5d-bb17ed78dc3f`).
- Automatic rollback: **PASS** to Worker `49c5cb16-2ca1-49ac-9b8c-ecaf117e59ca` (`a55e8c5d-15b4-4034-a8a5-3ae44cbb0b5c`).
- Critical failure: `service_report_overview` returned `503`; direct RPC evidence identified SQLSTATE `42703` (`column e.created_at does not exist`).
- Production remains **BLOCKED**. No second deploy was attempted after rollback.

The approved maintenance window was `2026-07-29T10:15:00+07:00/2026-07-29T13:15:00+07:00`. Change owner and rollback owner: Nguyễn Khả Duy.

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

- Live production Worker `mykis-learning` secret names are verified without reading values: `AUDIT_IP_HASH_SALT`, `CURSOR_SIGNING_SECRET`, `DEPLOYMENT_TEST_ACCOUNT_ENABLED`, `DEPLOYMENT_TEST_ACCOUNTS`, `JWT_SECRET`, `MFA_ENCRYPTION_KEY`, `MFA_RECOVERY_HASH_SECRET`, `RATE_LIMIT_KEY_SECRET`, `REFRESH_TOKEN_HASH_SECRET`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_URL`.
- All eight verifier-required names are present; no secret value was requested or written to evidence.
- Independent replacement signing/hashing secrets and Supabase production credentials are held only in `/tmp/kisvn-production-runtime.json`, mode `0600`.
- Existing live signing secrets are not rotated during bootstrap; the approved deploy script uploads the replacement secret set atomically with the release version.
- Live names and required-name coverage only are recorded in `evidence/PRODUCTION_SECRET_INVENTORY.json`.

## 7. Migration preparation

- Production migrations were applied and the linked migration history is canonical/current; the final dry-run reports `Remote database is up to date.`
- Disposable replay passes the 7 existing pending migrations plus `20260729022415_consolidate_roles_to_hr_and_employee.sql` (`8/8`).
- The new migration maps legacy Admin profiles to HR, removes Trainer application data after reference/session safeguards, and enforces exactly `hr`/`employee`.
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

- Current rollback deployment: `a55e8c5d-15b4-4034-a8a5-3ae44cbb0b5c`, version `49c5cb16-2ca1-49ac-9b8c-ecaf117e59ca`.
- Failed release deployment: `eefcc2f7-f45d-4694-8c5d-bb17ed78dc3f`, version `be4cb405-9dc6-41f9-8045-1c1cce7d343e`.
- The approved release Worker/frontend deployment ran, then was automatically rolled back after the critical report failure.

## 11. Authentication and session smoke tests

- No-MFA removal contract passed; sign-off validation remains explicit-owner-only.
- Synthetic HR provisioning, HR session restore, Employee provisioning, disable/re-enable, and invalid-role fail-closed checks passed before the report blocker.
- After rollback, the previous Worker returned `MFA_STORE_UNAVAILABLE` during login because its code expects MFA state removed by the new schema; this proves the old Worker/schema pair is incompatible.

## 12. Route smoke tests

- Canonical staging smoke passed 22 checks on the active stable staging version.
- API smoke stopped at the first critical `503`; browser visual/network smoke was not run after the automatic rollback.

## 13. Reports and search results

- Staging reporting timeout/concurrency, search rollout/rollback, and export format coverage passed as recorded in the staging readiness report.
- Production data-path mutation tests remain deferred to the approved maintenance window.

## 14. Queue, DLQ, R2, and Durable Object integration

- Production resources and bindings are provisioned/configured; no user-affecting synthetic message or object was created.
- Final integration smoke remains a post-deploy checkpoint.

## 15. Alert validation

- Cloudflare account member email `nkhaduy@gmail.com` is accepted, eligible, and ready as the verified email destination.
- API token permissions were verified for Notifications Edit, Workers Scripts Edit, Queues Edit, Workers R2 Storage Edit, Workers Routes Edit, and the reads used by production discovery. Non-alert edit permissions were checked with invalid requests that reached provider validation and could not mutate resources.
- Enabled critical policy IDs: Cloudflare incidents `e7b5c5d718364bd498c78d45f2580a25`, HTTP DDoS `4e1174a3722c46af8c22cbfdfc766cbf`, Universal SSL `62b89e0961184c51ba9f04cef1b5f60e`, and Worker observability failures `ca4e194f7173454886d695a006b28f8b`.
- The Cloudflare synthetic test for policy `ca4e194f7173454886d695a006b28f8b` returned `success=true` and `result=true`; the test contained no production payload or sensitive data.

## 16. Monitoring evidence

- Staging thresholds and runbooks cover Worker errors, login failures, refresh reuse, Queue/DLQ, exports, R2/DO, database health, and search/report latency.
- The production monitoring window has not started because no cutover occurred.

## 17. Rollback readiness

- Previous production deployment/version and restore-tested backup are recorded.
- Search/export flags remain off and no destructive down migration is planned.

## 18. Synthetic cleanup

- Temporary HR/Employee profiles, course, content, enrollment, quiz, quiz question/attempt, notification, and audit rows were removed by exact-ID service-role cleanup.
- Bootstrap HR was preserved; final role counts are `hr=1`, `admin=0`, `trainer=0`.
- Cleanup evidence: `/tmp/kisvn-production-smoke-cleanup.json` (mode `0600`).
- Logical dump files and disposable restore database were removed after validation.

## 19. Remaining follow-ups

- Add a reviewed migration that removes the invalid `enrollments.created_at` dependency from `service_report_overview` or adds/backfills the expected column with an explicit compatibility contract.
- Rehearse the new migration against a restored production-shaped database and exercise report overview/detail/export before another production plan.
- Establish a real production recovery mechanism (PITR or retained encrypted logical dumps) and prove Worker/schema rollback compatibility.
- Create a new maintenance window and new release manifest only after the fix and recovery rehearsal pass.

## 20. Final decision

**PRODUCTION DEPLOYMENT ROLLED BACK**

The release reached production, but the post-deploy report smoke found a schema/function mismatch. Worker rollback passed. A live database restore was not available (`pitr_enabled=false`); no untested in-place reconstruction was attempted. Further deployment is blocked until the reporting RPC is corrected by an approved migration and a compatible Worker/database recovery path is rehearsed.

The rollback report is `docs/audit-remediation/PRODUCTION_TWO_ROLE_GO_LIVE_REPORT.md`; structured evidence is `docs/audit-remediation/evidence/PRODUCTION_TWO_ROLE_GO_LIVE.json`.
