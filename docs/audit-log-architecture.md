# MyKIS Learning Audit Log Architecture

## Current Logging

Before Phase 7, MyKIS had a legacy `audit_logs` table with `actor_id`, `action`, `target_type`, `target_id`, `result`, `details`, and `created_at`. It was used by auth, account support, certificates, learning records, and employee profile flows. It was not a complete immutable audit system because it lacked request IDs, actor snapshots, before/after data, category/severity, export controls, and a dedicated HR query UI.

The app also has separate business logs:

- `user_activity` for activity/heartbeat and learning activity.
- `approval_events` for certificate and learning-record review history.
- `certificate_alert_events` for certificate alert dedupe/history.
- `notification_events`, `notification_deliveries`, and `reminder_runs` for notification delivery and scheduler history.
- Cloudflare Worker `console.error` for unexpected runtime errors.

These tables remain business or operational logs. Phase 7 does not duplicate all rows into audit logs.

## Audit Scope

Audit logs record administrative, security, and sensitive business actions:

- Authentication success/failure and account locks.
- Employee profile, role, department, job title, and archive changes.
- Course create/update/publish/archive.
- Report export success/failure.
- Audit log export.
- Notification manual sends and manual reminder runs.
- Scheduler failures.
- Existing Phase 1-6 certificate, learning record, account support, and compliance hooks continue writing to the upgraded table.

Routine reads, dashboard refreshes, unread-count polling, and notification list refreshes are not audited.

## Event Catalog

Canonical action names use dotted namespaces:

- `auth.login_succeeded`, `auth.login_failed`, `auth.logout`.
- `account.password_reset_completed`, `account.locked`, `account.unlocked`, `account.role_changed`.
- `employee.created`, `employee.updated`, `employee.department_changed`, `employee.job_title_changed`, `employee.archived`.
- `course.created`, `course.updated`, `course.published`, `course.archived`.
- `report.exported`, `report.export_failed`.
- `audit.exported`.
- `notification.manual_run`.
- `system.scheduler_run_failed`.

Legacy action names remain readable for old rows and old Phase 1-6 hooks.

## Actor Resolution

The Worker resolves actor identity from the verified bearer session where available, with legacy `X-Account-Id`/`X-Account-Role` fallback for existing tests and flows. The frontend cannot set `actor_user_id`, `actor_role`, request ID, IP hash, or source for audit rows.

Each row stores actor snapshots (`actor_role`, `actor_display_name_snapshot`) so history remains meaningful if a profile changes later.

## Entity Model

Audit rows store `entity_type`, `entity_id`, and `entity_display_name_snapshot` without foreign-key cascade. Entity deletion or archive must not delete audit history.

Legacy `target_type` and `target_id` are kept for compatibility and populated alongside the new entity columns.

## Before/After Strategy

Before/after payloads are field-level summaries, not blind full-object dumps. Examples:

- Role change stores `role`.
- Employee department/title changes store department and position.
- Report export stores filter summary and row count in metadata, not report content.

The list API excludes `before_data`, `after_data`, and heavy metadata. The detail API returns the full sanitized row.

## Redaction Strategy

`worker/services/audit-redaction.js` recursively redacts case-insensitive sensitive keys:

- password and password hash fields.
- access/refresh tokens.
- authorization and cookie headers.
- secrets, API keys, service role keys.
- signed/private URLs.

Large strings and JSON payloads are truncated with `payload_truncated=true`. Audit logging should not store raw request bodies before redaction.

## Request And Correlation IDs

`worker/middleware/request-context.js` creates or validates `X-Request-ID` and `X-Correlation-ID`. IDs are length/format checked. Every API response includes both headers, and error responses include `requestId`.

Invalid client IDs are replaced server-side. Authorization headers are never logged.

## Retention Policy

Phase 7 does not purge production logs automatically.

Recommended policy:

- Critical/security audit: 2-5 years.
- Administrative audit: 1-2 years.
- Low-value operational audit: 90-180 days.

Future retention purge must be a governed administrative process, not a normal user delete.

## Security Model

Audit logs are Worker/service-role write only. HR/admin can read/export through Worker APIs. Employees receive `403 HR_ONLY`. There are no update/delete endpoints, and the migration drops HR write/manage policies if they exist.

Direct frontend insert/update/delete policies are not added. RLS stays enabled.

## Query And Index Strategy

The migration adds indexes for:

- `occurred_at`.
- `actor_user_id`.
- `action`, `category`, `severity`.
- `entity_type + entity_id`.
- `request_id`, `correlation_id`.
- `source`, `status`.
- Partial indexes for critical severity and failed status.

The API uses server-side pagination, row caps, sort allowlists, search length limits, and a default recent range.

## Export Policy

Audit export supports CSV and XLSX only. Exports are HR-only, filter-scoped, capped, formula-injection protected, and logged as `audit.exported`. The export audit row is written once after file generation to avoid recursion.

## Integration Map Phase 1-6

- Phase 1 auth/session: login success/failure and password reset audit.
- Phase 2 learning path: legacy hooks remain compatible; assignment notifications continue.
- Phase 3 compliance: existing manual/exemption workflows can write to upgraded table.
- Phase 4 certificates: existing certificate audit hooks continue writing to upgraded table.
- Phase 5 reports/export: `report.exported` and `report.export_failed`.
- Phase 6 notifications/reminders: manual notification sends and manual reminder runs are audited; notification read events are not.

## Migration Plan

Migration file: `supabase/migrations/20260701093147_audit_log_system.sql`.

It upgrades `public.audit_logs` in place, adds constraints/indexes/RLS, keeps legacy columns, and does not seed production data.

Rollback note: do not drop audit history. If application rollback is required, legacy columns remain available to old code. New columns can remain in place safely.

## Acceptance Criteria

- Migration applies without editing older migrations.
- RLS enabled; employees cannot read audit logs.
- No update/delete endpoint.
- Request and correlation IDs returned by API and stored in audit rows.
- Redaction covers nested sensitive keys.
- Report and audit exports are logged without file contents.
- HR UI lists, filters, views detail/diff, copies request ID, and exports CSV/XLSX.
- Phase 1-6 regressions remain green.
