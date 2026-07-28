# Reporting and Export Architecture

## Report inventory

| Report | Endpoint/type | Source | Execution | Pagination/export |
|---|---|---|---|---|
| Overview | `overview` | profiles, courses, enrollments | private aggregate RPC | aggregate only |
| Employee | `employees` | profiles + enrollments | detail RPC | signed keyset / async |
| Department | `departments` | profiles + enrollments | SQL grouping | signed keyset / sync-small |
| Course completion | `courses`, `course-completion` | courses + enrollments | detail RPC | signed keyset / async |
| Enrollment | `enrollments`, `completion` | enrollments + profiles + courses | detail RPC | signed keyset / async |
| Training attendance | `training-sessions`, `attendance` | sessions, slots, attendance | detail RPC | signed keyset / async |
| Quiz | `quizzes`, `quiz-results` | attempts, quizzes, profiles | detail RPC | signed keyset / async |
| Learning record | `learning-records` | learning_records + profiles | detail RPC | signed keyset / async |
| Certificate | `certificates` | certifications, types, profiles | detail RPC | signed keyset / async |
| Compliance | `compliance` | assignments, cycles, programs | detail RPC | signed keyset / async |
| Learning path | `learning-paths` | path assignments + profiles | detail RPC | signed keyset / sync-small |
| Competency | `competencies` | assessments + profiles | detail RPC | signed keyset / sync-small |
| Development plan | `development-plans` | plans + profiles | detail RPC | signed keyset / sync-small |

The former Worker hydration limits of 5,000 profiles/courses and 20,000-30,000 detail rows are removed from aggregate calculation. Overview metrics are computed by `service_report_overview`; detail rows are returned by `service_report_detail`. Neither aggregate correctness nor completion rate depends on a capped client/Worker dataset.

## Query contract

The Worker validates a maximum 366-day date range, 100-row page size, 100 aggregate groups, report/status allowlists, and bounded search/filter text. Overview uses an 8-second PostgreSQL `statement_timeout`, detail uses 5 seconds, and export chunks use 15 seconds. The Supabase/PostgREST `db-pre-request` hook sets the timeout transaction-locally before the report statement starts; errors normalize to `REPORT_DB_TIMEOUT`. The Worker does not use `Promise.race` as database cancellation.

Detail cursors are opaque HMAC-signed tokens bound to requester ID, report type/scope, normalized filters, sort direction, page size, position, version/expiry, and stable ID tie-breaker. A cursor cannot be reused for another requester or filter. Responses return `hasMore`/`nextCursor`; exact count is not requested by default.

All reporting functions use `SECURITY DEFINER`, an empty `search_path`, allowlisted branches rather than dynamic SQL, and execute privileges only for `service_role`. `anon` and `authenticated` have no direct grants. HR/Admin authorization and report-specific rate limits remain in the Worker.

## Metrics

Completion rate is completed assignments divided by eligible assignments. On-time completion uses completed-at no later than due date. Overdue excludes completed/cancelled/exempted. Department breakdown and time trends are deterministic SQL aggregates. Learning hours, cost, provider quality, or question-level difficulty are returned only when normalized source data exists; no fabricated approximation is presented as exact.

## Export limits

Large employee, course completion, enrollment, attendance, quiz, learning record, certificate, and compliance exports use Queue/R2 background jobs. CSV supports 1,000,000 rows, XLSX 10,000 rows, and PDF 120 compact rows. Synchronous export is capped at 2,000 rows. Unsupported size/format returns an explicit error and never truncates. XLSX is dynamically imported only in the export consumer; PDF remains a compact summary formatter.

Queue/DLQ/R2 operations, retention, download re-authorization, idempotency, and provisioning are documented in `docs/audit-remediation/BACKGROUND_EXPORT_RUNBOOK.md`.

## Benchmark gates

`npm run test:reports:100k` creates 100,000 profiles and 100,000 assignments in an ephemeral local PostgreSQL container. It verifies exact overview metrics, first/next keyset pages, p50/p95/p99, buffer totals, 8/20 concurrency, real statement cancellation, and connection reuse after rollback. Because `EXPLAIN` around a PL/pgSQL RPC exposes only the outer `Result` node, staging rehearsal must capture inner plans with approved `auto_explain`/catalog tooling plus CPU/memory and production-like I/O. That remaining evidence is an infrastructure rehearsal blocker, not a capped-hydration code blocker.
