# Queue, DLQ, and R2 Export Runbook

This is a provisioning/rehearsal package only. Do not deploy or insert real production identifiers while following it.

## Supported jobs

The version-2 queue envelope is `{version: 2, kind: "report_export", jobId}`. The allowlisted registry supports employee list, course completion, enrollment detail, training attendance, quiz results, learning records, certificate status, and compliance. Queue payloads contain no credentials, filters, or report rows.

CSV supports up to 1,000,000 rows and uses keyset chunks plus multipart R2 upload. XLSX supports up to 10,000 rows and is buffered because the current Worker SheetJS runtime is not a streaming writer. PDF is limited to 120 compact rows. Limits fail with an explicit error; output is never truncated. CSV/XLSX retention is 24 hours and PDF retention is 12 hours.

## Processing and idempotency

The consumer atomically claims a lease, re-checks requester/account state and role, reads report rows through `service_report_detail`, persists progress, honors cancellation, and completes only with the current lease token. Redelivery of a completed or already-claimed job is acknowledged without a second object. Multipart uploads are aborted on failure; a completed object is deleted if database completion fails. The database stores checksum and byte size.

Download is proxied through the Worker. It re-checks session, current role, ownership/admin scope, account state, report permission, and expiry. Responses use private/no-store cache headers and a sanitized filename. R2 object keys are never returned to the browser.

## DLQ and replay

Wrangler sends exhausted messages to `mykis-report-exports-dlq` (local: `mykis-report-exports-local-dlq`). The DLQ envelope contains only schema version, job ID, source message version, normalized error code, attempt count, and failure time. Never place tokens, passwords, filters, report rows, or personal data in DLQ metadata.

Replay is manual, audited, idempotent through `service_requeue_export_job`, and capped at three replay attempts. Operators must first confirm the failure is resolved and the requester remains authorized. Never replay an unbounded queue or edit the original payload. Alert on any DLQ depth greater than zero for 5 minutes, repeated database timeouts, multipart abort failures, and export failure rate above the agreed SLO.
The local plan-only validator is `node scripts/replay-export-dlq.mjs`; it never contacts a queue or remote database.

## Cleanup and retention

The scheduled handler expires completed objects and cleans metadata through private RPCs. Failed/DLQ metadata is retained for operational investigation according to the approved database retention policy; audit retention is governed separately. R2 lifecycle must abort incomplete multipart uploads and keep the bucket private. No public bucket access or public object URL is permitted.

## Provisioning checklist

| Environment | Queue | DLQ | R2 bucket | Bindings |
|---|---|---|---|---|
| local | `mykis-report-exports-local` | `mykis-report-exports-local-dlq` | `mykis-report-exports-local` | `REPORT_EXPORT_QUEUE`, `REPORT_EXPORT_BUCKET` |
| staging | `kis-lms-export-staging` | `kis-lms-export-dlq-staging` | `kis-lms-exports-staging` | same binding names |
| production | `mykis-report-exports` | `mykis-report-exports-dlq` | `mykis-report-exports` | same binding names |

Provision the private bucket, queue, DLQ, Durable Object rate limiter binding `RATE_LIMITER_DO`, database/JWT/cursor secrets, and export feature flag. Configure bucket lifecycle, multipart cleanup, DLQ alerting, queue retry limits, and cron cleanup. Smoke-test enqueue, duplicate delivery, cancellation, failure-to-DLQ, authorized download, expired download, and rollback with the export feature flag disabled. Missing bindings must fail the export feature clearly; no memory fallback is allowed. Other LMS features must remain available while export is disabled.

Cloudflare platform encryption defaults are used for R2; transport remains TLS. Object names are UUID-derived private keys and custom metadata is limited to job ID, report type, and policy version.
