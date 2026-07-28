# KIS LMS Production Deployment Report

Date: 2026-07-28
Decision timestamp: 2026-07-28T16:51:50+07:00

## 1. Approval and No-MFA acceptance

- No-MFA status: **Accepted** by Nguyễn Khả Duy, Chủ dự án KIS LMS.
- Approval date: 2026-07-28 (Asia/Ho_Chi_Minh).
- Review date: 2027-01-28.
- Incident response owner: Nguyễn Khả Duy.
- Required Vietnamese residual-risk confirmation is recorded in `NO_MFA_SECURITY_ACCEPTANCE.md`.

## 2. Git and release evidence

- Branch: `main`.
- HEAD: `e0ff4f9b3d2b46e34e0669ef8f86c4d1be37c765`.
- Production-predeploy snapshot: `/tmp/kisvn-production-predeploy-h2lG3S` (manifest verified).
- `git diff --check`: passed at snapshot time.
- Worktree was already dirty with extensive tracked and untracked changes; production guard therefore remains `NO-GO`.
- Build/deployment checksums were not finalized for production.

## 3. Production approval plan

- Command: `npm run production:plan`.
- Result: `PRODUCTION_APPROVAL_REFUSED`.
- The plan did not return `GO FOR PRODUCTION DEPLOYMENT`.
- No production mutation command was run.

## 4. Production target and secure inputs

The following required inputs were missing from the current secure environment; values were not read or printed:

`KIS_ALLOW_PRODUCTION_MUTATION`, `APP_ENV`, `KIS_ALLOW_PRODUCTION_DEPLOYMENT`, `KIS_PRODUCTION_EXECUTION_CONFIRM`, `KIS_PRODUCTION_CLOUDFLARE_ACCOUNT_ID`, `KIS_PRODUCTION_WORKER_NAME`, `KIS_PRODUCTION_HOSTNAME`, `KIS_PRODUCTION_QUEUE_NAME`, `KIS_PRODUCTION_DLQ_NAME`, `KIS_PRODUCTION_R2_BUCKET_NAME`, `KIS_PRODUCTION_SUPABASE_PROJECT_REF`, `KIS_PRODUCTION_SUPABASE_URL`, `KIS_PRODUCTION_DATABASE_URL`, `KIS_PRODUCTION_DATABASE_PASSWORD_FILE`, `KIS_PRODUCTION_BACKUP_ID`, `KIS_PRODUCTION_APPROVAL_ID`, `KIS_PRODUCTION_APPROVED_BY`, `KIS_PRODUCTION_CHANGE_OWNER`, `KIS_PRODUCTION_ROLLBACK_OWNER`, `KIS_PRODUCTION_MAINTENANCE_WINDOW`, `KIS_PRODUCTION_ONE_TIME_APPROVAL_TOKEN`, `KIS_PRODUCTION_TARGET_ALLOWLIST`.

Production runtime secret names and application configuration were also absent from the current environment: `JWT_SECRET`, `REFRESH_TOKEN_HASH_SECRET`, `CURSOR_SIGNING_SECRET`, `RATE_LIMIT_KEY_SECRET`, `AUDIT_IP_HASH_SALT`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `PUBLIC_APP_ORIGIN`, and `CORS_ALLOWED_ORIGINS`. Provider-side secret inventory was not queried because the production target approval was incomplete.

## 5. Backup and restore

- Production backup ID was not supplied.
- Restore validation was not attempted.
- Production database mutation was not attempted.

## 6. Resource provisioning

- Production Queue, DLQ, R2, Durable Object migration/binding, cron, and alert destinations were not provisioned.
- No staging resource was reused or changed.

## 7. Migration, search, and application deployment

- Production migration preflight/apply: not run.
- Search expand/backfill/index/cutover: not run.
- Worker/frontend/Queue consumer/cron deployment: not run.
- Deployment IDs and previous production versions: unavailable because no deployment occurred.

## 8. Tests and smoke checks

- MFA-removal contract: passed 2/2 via `npm run test:mfa`.
- Production smoke tests, backup restore checks, alert validation, and monitoring window: not run.

## 9. Blocking discrepancies

- User-provided stable staging version `1c8d06e9-393e-476d-a81b-a357735ebb02` does not match the repository staging report's stable version `1c8d06e9-393e-4eff-917c-5761a23ddc89`; release identity must be reconciled before approval.
- The staging report states that provider-native/third-party critical paging destinations were not available/provisioned.
- The production verifier does not currently validate every required queue/R2/alert/secret/maintenance-window input listed by the runbook, so a future plan must not be treated as complete until those controls are evidenced.

## 10. Rollback and cleanup

- Rollback was not required because no production change occurred.
- No synthetic production data, jobs, objects, or backups were created.

## Final decision

**PRODUCTION NO-GO**

Production go-live is stopped safely. Supply and independently verify the missing approval, target, backup/restore, secret, alert, maintenance-window, and release-identity evidence before rerunning the plan. Do not run `npm run production:deploy -- --apply` from this execution.
