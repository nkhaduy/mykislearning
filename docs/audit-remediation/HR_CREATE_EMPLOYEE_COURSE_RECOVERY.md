# HR Create Employee and Course Recovery

Date: 2026-07-29

Hotfix branch: `hotfix/hr-create-employee-course-20260729`

Hotfix commit: `185f6ddc6df5a86551fa2013a58e632bf9e0e54b`

Overall status: **LOCAL RECOVERY PASS / PRODUCTION DEPLOYMENT BLOCKED**

## Production baseline

- Domain: `https://kislms.site` returned HTTP 200.
- Worker: `mykis-learning`.
- Active Worker version: `24431b46-51b4-4784-9e83-348e7fe9bf0d`.
- Active deployment: `e3c7084a-62f6-4871-856d-6a722820d845`.
- Expected release commit: `ddd9b6141eba573ff675441744a67957bfd31a9c`.
- Rollback Worker version remains available: `49c5cb16-2ca1-49ac-9b8c-ecaf117e59ca`.
- Bootstrap profile `acc-hr-001` exists with canonical role `hr`.
- Canonical application roles are `hr` and `employee`; the current disposable schema rejects `admin`, `trainer`, and unknown roles.
- The pre-hotfix production bundle did not expose either the employee-create or course-create control.

The original worktree was recorded and snapshotted at `/tmp/kisvn-hr-recovery-20260729-a4Wx0v/worktree` before mutation.

## Root cause

The production split-route UI omitted both creation flows. The backend creation routes also lacked the complete production contract required by the UI:

- Employee creation did not create or link a Supabase Auth user.
- Employee input and duplicate handling were inconsistent.
- Cleanup did not cover every partial employee-creation failure.
- Course creation did not reliably require and link exactly one initial course version.
- Internal Worker errors could expose server messages.
- Changed split-route assets needed explicit cache invalidation.

## Remediation

- Added a visible, accessible `Thêm nhân viên` dialog with required fields, native validation, submit locking, duplicate feedback, success announcement, and immediate list refresh.
- Added a visible `Tạo khóa học` draft dialog with submit locking, canonical defaults, success feedback, and navigation to the new course route.
- Restricted employee creation to HR and forced the created application role to `employee`.
- Added `422` validation, `409` duplicate responses, `429` rate limiting, canonical success records, and redacted internal errors with correlation IDs.
- Added server-side Supabase Auth Admin user creation without exposing the service-role key to the browser.
- Linked Auth user, profile, private Worker credential, and audit event; compensating cleanup removes Auth/profile state after downstream failure.
- Added course validation, stable caller-supplied retry IDs, initial version creation, version linking, partial-write compensation, and creation audit events.
- Added regression coverage for HR success, employee isolation, legacy-role rejection, duplicates, cleanup, double submission, initial version count, refresh, and navigation.
- Added explicit cache versions for the changed employee/course split entries and styles.

No new database migration is introduced by this hotfix.

## Authorization audit

Verified chain:

`session token -> private session role -> application profile role -> Worker middleware -> service operation -> Supabase service/RLS boundary -> database constraints`

- Worker and route metadata grant administrative access only to `hr`.
- Employee sessions receive `403` from both creation APIs.
- Session restore accepts only `hr` and `employee`; role mismatch revokes the session.
- Current role checks constrain both `profiles` and `user_roles` to `hr`/`employee`.
- Current RLS policy expressions containing the historical function name `is_hr_or_admin()` call a function whose implementation now returns true only for `hr`.
- `/api/admin/*` and Supabase `auth.admin.*` names remain technical API namespaces and are not application roles.
- Legacy migration text and negative tests intentionally retain `admin`/`trainer` strings for migration and fail-closed coverage.

## Local API evidence

The isolated Worker ran on `127.0.0.1:61429` against the disposable Supabase runtime in `/private/tmp/kis-lms-worker-supabase.tzteKG`.

| Check | Result |
| --- | --- |
| HR login/session role | `200`, role `hr` |
| Invalid employee input | `422 INVALID_EMAIL` |
| Employee create | `201`, canonical role `employee` |
| Auth/profile linkage | PASS |
| Private credential and forced password change | PASS |
| Duplicate email | `409 DUPLICATE_EMAIL` |
| Duplicate employee code | `409 DUPLICATE_EMPLOYEE_CODE` |
| Employee create-employee isolation | `403` |
| Employee create-course isolation | `403` |
| Failed Auth creation leaves no profile | PASS |
| Concurrent profile conflict cleanup | one profile and one Auth user |
| Concurrent course submit | one course and one version |
| Initial version number/link/owner | PASS |
| Employee and course refresh visibility | PASS |
| Local test-data cleanup | zero remaining records |

## Browser evidence

- HR employee page exposes and mounts the create dialog.
- UI creation added the employee to the table immediately.
- Course page exposes and mounts the draft dialog.
- UI creation returned `201`, navigated to the new course URL, and rendered the new draft.
- Browser network showed the expected `POST /api/auth` and `POST /api/courses` requests followed by refresh requests.
- Browser console contained zero warnings and zero errors after the completed flows.
- Responsive checks at 1440x900, 1024x768, 768x1024, 390x844, and 360x800 found no horizontal overflow.
- Screenshots, snapshots, redacted trace, and network evidence are under `output/playwright/hr-recovery-local/.playwright-cli/`.
- Credential-bearing pre-login trace resources were deleted and are not retained.
- All UI-created Auth, profile, course, and version records were removed after validation.

## Validation

Passing checks:

- `npm run lint` (135 existing warnings, below the configured ceiling)
- `npm run typecheck`
- `npm run test:migrations`
- `npm run test:unit` (103/103)
- `npm run test:security`
- `npm run test:session-security`
- `npm run test:e2e:public` (9/9)
- `npm run test:e2e:authenticated` (8/8)
- `npm run test:routes:all`
- `npm run test:reports`
- `npm run test:export-jobs`
- `npm run build`
- `npm run scan:artifact`
- `npm run check:bundle-budget`
- `npm run check:wrangler`
- `npm audit --audit-level=high`
- `git diff --check`

## Production deployment status

The protected deployment plan correctly refused deployment. The secure runtime is bound to an older release SHA, its maintenance window has expired, its one-time approval has already been consumed, and its release manifest/gate evidence do not match commit `185f6ddc6df5a86551fa2013a58e632bf9e0e54b`.

Authenticated production reproduction and mandatory production smoke also remain blocked because the current bootstrap HR credential is not available in the secure runtime or an authenticated in-app browser session.

Required external action before production mutation:

1. Provide a fresh protected release approval/runtime bound to commit `185f6ddc6df5a86551fa2013a58e632bf9e0e54b` and an active maintenance window.
2. Complete HR login/2FA in the in-app browser, or provide the current bootstrap HR credential through the approved secure credential channel.

Until both controls are satisfied, the production Worker remains unchanged on version `24431b46-51b4-4784-9e83-348e7fe9bf0d` and production smoke is **NOT RUN**.

## UX phase gate

Frappe Learning research and the KIS UX rebuild were not started. The task explicitly requires Part B to begin only after the production employee/course smoke passes; that gate is still blocked.
