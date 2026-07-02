# Notification and Reminder Architecture

## Current Architecture

MyKIS already had a simple `public.notifications` inbox with `account_id`, `type`, `title`, `body`, `link`, `is_read`, `expires_at`, `data`, and `/api/notifications`. The employee dashboard and notification center read this table through `notificationService`; HR had `/admin/notifications`, but campaign history was mostly local/mock data. Learning Path assignment and certificate workflows inserted inbox rows directly. There was no template model, delivery history, preferences, scheduler, retry model, or email provider.

Phase 6 extends the existing inbox instead of creating a duplicate notification table. New canonical fields are added to `notifications`: `recipient_id`, `event_id`, `event_type`, `action_label`, `action_url`, `priority`, `read_at`, `archived_at`, and `metadata`. Legacy fields remain for compatibility.

## Tables and Hooks

New tables:

- `notification_templates`: versioned, locale-aware templates for `in_app` and future `email`.
- `notification_events`: business events with a unique `idempotency_key`.
- `notification_deliveries`: per-channel delivery status and retry metadata.
- `notification_preferences`: per-employee event preferences.
- `reminder_rules`: active reminder definitions.
- `reminder_runs`: scheduler execution audit.

Existing hooks now route through `worker/services/notificationEngine.js`:

- Course assignment: `course_assigned`.
- Learning Path assignment: `learning_path_assigned`.
- Certificate submit/verify/reject/revoke.
- Learning record approval/revision legacy events.
- Report export success/failure.

`certificate_alert_events` remains the certificate-specific audit/dedupe ledger from Phase 4. Phase 6 uses `notification_events` for delivery-facing alerts and can map certificate alert rows into notification events during future backfills.

## Event Catalog

The canonical catalog is:

`course_assigned`, `course_due_soon`, `course_overdue`, `course_completed`

`learning_path_assigned`, `learning_path_due_soon`, `learning_path_overdue`, `learning_path_completed`

`compliance_assigned`, `compliance_due_soon`, `compliance_overdue`, `compliance_completed`, `compliance_failed`, `compliance_exempted`

`certificate_submitted`, `certificate_verified`, `certificate_rejected`, `certificate_revoked`, `certificate_expiring_60`, `certificate_expiring_30`, `certificate_expiring_15`, `certificate_expiring_7`, `certificate_expired`, `certificate_requirement_missing`

`training_session_registered`, `training_session_reminder_24h`, `training_session_reminder_1h`, `training_session_rescheduled`, `training_session_cancelled`

`quiz_assigned`, `quiz_due_soon`, `quiz_passed`, `quiz_failed`, `quiz_attempts_exhausted`

`report_export_completed`, `report_export_failed`

Legacy learning-history event names such as `certificate_approved` are still accepted for compatibility, but new certificate management code should use `certificate_verified`.

## Template Model

Templates are plain strings with allowlisted placeholders only. The Worker renderer accepts placeholders such as `{{course_title}}`, `{{learning_path_title}}`, `{{program_title}}`, `{{certificate_name}}`, `{{due_date}}`, `{{days_remaining}}`, and `{{error_message}}`. It does not execute user code.

Payload sanitization strips password/token/secret/signed URL fields and removes angle brackets from rendered values.

## Delivery Model

Every processed event creates:

- one `notifications` row for in-app delivery;
- one `notification_deliveries` row with `channel = in_app`, `status = delivered`;
- one email delivery row with `status = not_configured` unless an email provider is later configured.

There is no fake email success. Phase 6 has an adapter boundary and records the blocker as `EMAIL_PROVIDER_NOT_CONFIGURED`.

## Reminder Rules and Scheduler

Cloudflare Cron is configured hourly in `wrangler.jsonc`. `worker/index.js` implements `scheduled(event, env, ctx)` and calls `runReminderScheduler`.

The scheduler:

1. Loads active reminder rules.
2. Resolves bounded candidate batches.
3. Creates idempotent notification events.
4. Renders templates.
5. Writes in-app notifications.
6. Writes delivery records.
7. Records `reminder_runs`.
8. Continues when one candidate fails.

Default rules cover course/learning path deadlines, compliance deadlines, certificate expiry, and training session 24h/1h reminders.

## Idempotency Strategy

`notification_events.idempotency_key` is unique in the database. Reminder keys are stable:

`event_type:entity_id:recipient_id:threshold:vn_date`

Business action keys use the entity id, for example:

`learning_path_assigned:assignment_id:employee_id`

`course_assigned:course_id:employee_id`

Retrying delivery never creates a new event. Parallel cron runs race on database uniqueness and duplicate inserts are skipped safely.

## Retry Strategy

Phase 6 records retry metadata in `notification_deliveries`: `attempt_count`, `next_retry_at`, `failed_at`, `error_code`, and `error_message_safe`. In-app delivery is local and marked `delivered` when the inbox row is created. Email is `not_configured` until a real provider is configured; future retry workers should only operate on delivery rows, not create new notification events.

## Timezone Rules

Timestamps are stored as UTC `timestamptz`. Day threshold calculations use `Asia/Ho_Chi_Minh`. Date-only fields such as certificate expiry are compared by Vietnam calendar date to avoid UTC boundary double-sends.

Quiet hours are stored in `notification_preferences` with an employee timezone. Phase 6 persists the fields; future channel senders should enforce quiet hours before non-mandatory channels.

## Security Model

Employees can list and update their own inbox only. HR can monitor deliveries/runs and send manual notifications. Employee-created arbitrary notifications are no longer accepted by the Worker API.

The Worker never accepts frontend-supplied `recipient_id` from non-HR callers for creation. Payload sanitization avoids secrets, tokens, signed URLs, and passwords. RLS is enabled on new public tables. Service-role Worker writes remain the trusted path for system events.

## Channel Boundaries

Required in Phase 6: in-app notifications.

Email is prepared but not enabled. There is no SendGrid, Resend, Postmark, SMTP, or other provider configured in the repo. Email delivery rows are therefore explicitly `not_configured`.

Teams/Slack are out of scope.

## Integration Points

Phase 1 auth/session: notification APIs use existing `requireAuth()` and `requireHr()`.

Phase 2 Learning Path: assignment hook creates `learning_path_assigned`; scheduler handles due/overdue.

Phase 3 Compliance: scheduler handles due/overdue from `compliance_assignments`.

Phase 4 Certificates: certificate workflows create submit/verify/reject/revoke events; scheduler handles expiry thresholds.

Phase 5 Reports: export route emits completed/failed events for HR.

## Audit Hooks Phase 7

`notification_events`, `notification_deliveries`, and `reminder_runs` are audit-ready. Phase 7 can mirror selected event creation, delivery failure, preference change, and manual HR sends into the general audit log.

## Versioning Hooks Phase 8

Templates include `version` and `status`. Future migrations can add template approval workflow, template previews, and historical render snapshots without changing the inbox contract.

## Migration and Rollback Plan

Migration file: `supabase/migrations/20260701085524_notification_reminder_engine.sql`.

Forward:

1. Extend `notifications`.
2. Backfill `recipient_id`, `event_type`, `action_url`, `read_at`, and `metadata`.
3. Create event/template/delivery/preference/rule/run tables.
4. Seed controlled default templates and rules.

Rollback:

1. Disable Worker cron.
2. Stop calling `notificationEngine`.
3. Drop new tables if no Phase 6 data must be retained.
4. Keep legacy columns in `notifications`; old UI can continue using `account_id/type/is_read/link`.

## Acceptance Criteria

- In-app notifications continue to list, deep-link, and mark read.
- HR can send manual notifications through Worker API.
- Notification events are deduped by database uniqueness.
- Reminder cron is private through Cloudflare `scheduled`.
- HR can inspect rules, delivery rows, and reminder runs.
- Email is not falsely marked sent when no provider exists.
- Phase 1-5 regression remains green.
