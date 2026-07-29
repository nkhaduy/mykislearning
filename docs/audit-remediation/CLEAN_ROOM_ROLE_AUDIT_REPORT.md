# Clean-Room Two-Role Audit Report

Captured: 2026-07-29 (Asia/Ho_Chi_Minh)
Owner: Nguyễn Khả Duy

## Contract result

- Canonical application roles are exactly `hr` and `employee`.
- HR is the highest role and owns the former HR/Admin workspace and administrative capabilities.
- Legacy `admin` maps to `hr` with identity/history preserved.
- `trainer` is removed from application profiles, routes, navigation, policies and runtime authorization; it is never mapped to another role.
- Invalid `admin`, `trainer`, `unknown` and `null` session roles fail closed without a workspace.
- Production mutation and deployment: `NONE`.

## Rehearsal result

- Fresh migration replay: `PASS`.
- Legacy clean-reset rehearsal: `PASS`.
- Alias canonicalization: `PASS` for 13 historical aliases.
- Pending migrations: `PASS` (`8/8`, including the two-role migration).
- Second migration pass: `PASS` (`0` applied; all 8 skipped).
- Schema equivalence: `PASS`.
- Rollback restore: `PASS`.
- Final role counts: HR present, Admin `0`, Trainer `0`, unknown `0`.
- Bootstrap HR recovery: `PASS`.

## Role audits

### HR

Employee/account/department/course/content/enrollment/progress/report/export/audit capabilities are covered by HR route, API and security suites. HR-only routes are under `/hr`; legacy `/admin...` browser paths redirect to the equivalent `/hr...` path. No Admin role selector or Trainer navigation is shipped.

### Employee

Employee routes remain limited to assigned learning, quizzes, progress, notifications and personal profile/security. Cross-user records and HR endpoints remain denied by server authorization and RLS tests.

### Invalid legacy roles

JWT/profile mismatches and profiles carrying `admin`, `trainer`, `unknown` or `null` are rejected with fail-closed `401`/`403` behavior. A migrated legacy Admin profile is accepted only after its stored role is `hr`.

## Evidence

- `evidence/CLEAN_ROOM_ROLE_AUDIT.json`
- `evidence/PRODUCTION_CLEAN_RESET_REHEARSAL.json`
- `evidence/TWO_ROLE_AUTHORIZATION_CONTRACT.json`
- `evidence/route-bundles.json`

## Remaining blockers

No two-role authorization blocker remains. This report does not imply production deployment; production approval still depends on the protected release manifest, owner-approved maintenance window and other production gates.
