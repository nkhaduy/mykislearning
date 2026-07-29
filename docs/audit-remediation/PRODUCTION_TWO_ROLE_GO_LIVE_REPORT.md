# KIS LMS Two-Role Production Go-Live Report

Date: 2026-07-29 (Asia/Ho_Chi_Minh)
Owner: Nguyễn Khả Duy
Status: **ROLLED BACK / FURTHER DEPLOYMENT BLOCKED**

## Release

- Target: `mykis-learning` / `https://kislms.site` / Supabase project `mooqdtiedfamnlpitqtq`.
- Release commit: `7c50027d67690ba18bb9ac306a87dd42453d970b`.
- Release Worker: `be4cb405-9dc6-41f9-8045-1c1cce7d343e`.
- Rollback Worker: `49c5cb16-2ca1-49ac-9b8c-ecaf117e59ca`.
- Rollback deployment: `a55e8c5d-15b4-4034-a8a5-3ae44cbb0b5c`.

## Database and reset

- Migration alias reconciliation: PASS; unexplained remote aliases: `0`.
- Eight approved migrations applied; final linked dry-run: `Remote database is up to date.`
- Clean reset: PASS; bootstrap HR preserved; final role counts `hr=1`, `admin=0`, `trainer=0`.
- Temporary smoke data cleanup: PASS; no smoke profiles, courses, or quizzes remain.
- Backup restore availability during rollback: **NOT AVAILABLE**; Supabase physical backup listing reported `pitr_enabled=false`, and the verified logical dump was a disposable restore rehearsal whose dump files had already been removed.

## Smoke and failure

- Passed before stop: domain health, Worker API health, HR login/session, HR employee list/create/update/disable/re-enable, invalid Trainer rejection, course/content/enrollment, and quiz/question provisioning (`18` checks).
- Critical failure: `/api/admin/reports/overview` returned `503`.
- Direct service-role RPC diagnosis: SQLSTATE `42703`, `column e.created_at does not exist` in `service_report_overview`.
- Compatibility check after Worker rollback: previous Worker login returned `MFA_STORE_UNAVAILABLE` because it requires MFA state removed by the applied migration.
- Browser visual/network smoke at `1440x900` and `390x844` was not run after the critical failure; no visual pass is claimed.

## Final state

- Worker rollback: PASS.
- Domain HTTP health: PASS (`200`).
- Bootstrap HR preserved: PASS.
- Production application health: **FAIL** for authenticated login/report paths under the rolled-back Worker/schema pair.
- Database recovery: **FAIL / NOT_AVAILABLE**.
- Further deployment: **BLOCKED** until an approved reporting-RPC/schema fix and compatible rollback/recovery rehearsal are available.

Evidence: `docs/audit-remediation/evidence/PRODUCTION_TWO_ROLE_GO_LIVE.json`.
