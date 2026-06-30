# Certificate Management Architecture

## Current State

The repository already had certificate data before Phase 4:

- Table: `employee_certifications`, created by earlier learning workflow migrations and extended by `008_learning_history_certificates.sql`.
- Existing Worker routes: `/api/certifications`, `/api/certifications/me`, `/api/admin/certifications`, and employee-specific HR routes under `/api/employees/:id/certifications`.
- Existing UI: employee certificate submission lived inside `/dashboard/learning-history`; HR review lived inside `/admin/learning-records`.
- Existing storage: `learning-evidence` and `employee-certifications` private buckets existed; file access used short-lived signed URLs through Worker routes.
- Existing attachment metadata: `learning_record_attachments` can reference `certificate_id`.
- Department and job title: current Worker-compatible employee records use `profiles.department` and `profiles.position`.
- Active employee convention: Compliance uses `profiles.role = 'employee'` and active-like `account_status` values.
- Existing audit hooks: `audit_logs`, `approval_events`, `hr_tasks`, and `notifications`.

Phase 4 does not delete or duplicate the existing certificate ledger. It extends `employee_certifications` and keeps old endpoints available for backward compatibility.

## Reusable Schema

Reused tables:

- `employee_certifications`
- `profiles`
- `learning_record_attachments`
- `notifications`
- `audit_logs`
- `approval_events`
- `hr_tasks`
- `storage.buckets`

## New Schema

Migration `013_certificate_management.sql` adds:

- `certificate_types`: controlled catalog for certificate definitions.
- `certificate_requirements`: required certificate rules by all employees, department, job title, or individual.
- `certificate_alert_events`: lightweight duplicate guard/hook table for future notification scheduling.

It also extends `employee_certifications` with:

- `certificate_type_id`
- storage metadata fields
- `verified_by`, `verified_at`
- `supersedes_certificate_id`
- `renewal_group_id`

Migration `014_certificate_management_rls.sql` hardens direct table access by removing legacy direct policies from `employee_certifications`.

## Migration Strategy

The migration is additive:

- No `DROP TABLE`.
- No production seed data.
- No deletion of existing certificate rows.
- Existing text-based certificate type names remain usable while HR gradually links records to `certificate_types`.
- Existing `/api/certifications*` endpoints continue to serve older UI flows.

## Storage Strategy

Certificate files are private.

- New bucket: `employee-certificates`, private.
- Path convention: `{employee_id}/pending/{timestamp}-{uuid}-{safe_filename}`.
- Allowed MIME types: PDF, JPEG, PNG, WebP.
- Max file size: 10 MB.
- Filename is sanitized.
- File download uses Worker-generated signed URLs with a 300-second lifetime.
- Employee signed URLs are ownership-checked.
- HR signed URLs require HR role.

## Verification Workflow

Employee upload:

1. Employee requests signed upload URL.
2. Employee uploads file to private Storage.
3. Employee submits metadata.
4. Worker creates `employee_certifications` row with `verification_status = submitted`.
5. HR verifies, rejects, or revokes through `/api/admin/certificates/:id/*`.

HR verification writes `verified_by`, `verified_at`, `reviewed_by`, `reviewed_at`, and audit/notification hooks.

## Renewal And Version History

Renewal does not overwrite the old row.

- New row is inserted with `supersedes_certificate_id`.
- `renewal_group_id` ties versions together.
- New version starts as pending/submitted.
- When HR verifies the new row, the replaced row is marked `superseded`.
- Rejected renewals do not invalidate the old row.

## Required Certificate Rules

Rules support:

- `all_employees`
- `department`
- `job_title`
- `individual`

The Worker resolves rules against active employee profiles, de-duplicates logically in reporting, and reports `missing`, `pending_verification`, `expired`, `expiring_soon`, or `satisfied`.

## Expiration Calculation

The Worker calculates validity status server-side:

- no expiry: `valid`
- unverified: `pending_verification`
- rejected: `rejected`
- revoked: `revoked`
- superseded: `superseded`
- expired date before current date: `expired`
- verified and within warning window: `expiring_soon`
- verified outside warning window: `valid`

Default warning window is 60 days unless a certificate type overrides it.

## Security Model

Phase 4 follows the Compliance Worker-only model:

- Frontend calls Worker APIs only.
- Worker uses Supabase service-role key.
- HR endpoints call `requireHr()`.
- Employee endpoints call `requireAuth()` and filter by `account_id`.
- Employee cannot set verified fields, employee ownership, or HR status transitions.
- Direct RLS policies are not created for new certificate tables.
- Legacy direct policies on `employee_certifications` are removed by migration `014`.

Existing caveat: middleware still supports legacy `X-Account-Id`/`X-Account-Role` fallback for backward compatibility. Removing that is an auth-hardening task outside Phase 4.

## Notification Hooks

Phase 4 records or prepares these event names:

- `certificate_submitted`
- `certificate_verified`
- `certificate_rejected`
- `certificate_expiring_60`
- `certificate_expiring_30`
- `certificate_expiring_15`
- `certificate_expiring_7`
- `certificate_expired`
- `certificate_requirement_missing`

No bulk scheduler or email retry engine is implemented in Phase 4.

## Audit Hooks

Worker actions write to existing `audit_logs` and `approval_events` when available. No separate audit-log system is introduced.

## Rollback Notes

Rollback is manual:

1. Stop using `/api/admin/certificates*` and `/api/certificates/my*`.
2. Recreate legacy `employee_certifications` policies only if direct browser Supabase access is intentionally restored.
3. Drop `certificate_alert_events`, `certificate_requirements`, and `certificate_types` only after confirming no Phase 4 data must be retained.
4. Keep added `employee_certifications` columns if production certificates have used renewal/storage metadata.

## Acceptance Criteria

- Existing certificate records remain visible.
- HR can manage certificate types and review employee certificates.
- Employee can upload and renew certificates without overwriting old versions.
- Missing required certificates are computed from rules and active employees.
- Expiring/expired status is calculated on the Worker.
- File access uses private Storage and short-lived signed URLs.
- Direct browser access to Phase 4 tables is denied by RLS; Worker service-role access remains available.
