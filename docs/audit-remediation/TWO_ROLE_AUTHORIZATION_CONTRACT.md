# Two-Role Authorization Contract

Owner decision: Nguyễn Khả Duy

Owner decision:
- HR is the highest application role.
- Employee is the standard learner role.
- Admin application role is removed and migrated to HR.
- Trainer application role is removed.
- Canonical roles are exactly HR and Employee.

## Canonical application roles

- `hr` is the highest application role and owns the existing HR/Admin workspace and administration capabilities.
- `employee` is the standard learner role and can access only personal learning, progress, quiz, notification and profile data.
- The application role `admin` is removed; legacy Admin profiles migrate to `hr` without changing identity IDs, Auth users, audit history or session-revocation semantics.
- The application role `trainer` is removed. Trainer profiles are purged/disabled during disposable rehearsal and clean reset; Trainer Auth users are never deleted without an explicit owner allowlist.
- Unknown, null, legacy or mismatched roles fail closed with `401`/`403`; they never fall back to Employee.

## Authorization rules

- Worker/API authorization derives from the verified server session and profile role, never request-body or editable user metadata.
- A JWT role must be canonical and equal to the current profile role. A mismatch revokes the session and requires reauthentication.
- HR may manage employees, accounts, departments, courses/content, assignments, quizzes, progress, reports, exports, audit logs and approved business configuration.
- Employee access is scoped to the authenticated account; cross-user reads and writes remain denied by server authorization and RLS.
- RLS helper `is_hr_or_admin()` is retained only as a migration-compatible function name and returns true only for `hr`.
- `/hr` is the canonical workspace route. Legacy `/admin...` browser links redirect to the equivalent `/hr...` route; `/api/admin/...` remains a technical endpoint namespace and is HR-authorized.

## Evidence boundary

This contract describes code, migration and disposable-rehearsal preparation only. It does not claim production deployment or production mutation.
