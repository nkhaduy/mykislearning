# KIS LMS Final Code Remediation Report

Date: 2026-07-28. No deployment, remote Supabase access, staging access, or remote data mutation was performed.

## Baseline and scope

- Branch `main`, HEAD `e0ff4f9b3d2b46e34e0669ef8f86c4d1be37c765`.
- Worktree was dirty before this phase and was preserved; no reset/clean/rebase/checkout sweep was used.
- Final snapshot: `/tmp/kisvn-final-remediation-20260728-VdKMVV` (22 MB, checksum verified). Previous snapshot `/tmp/kisvn-performance-20260728-095727` remained readable.
- Initial legacy performance snapshot: approximately 1.17 MB `app.js` and 379 KB legacy CSS on secondary routes.

## Routes and monolith result

Initial 28 exact secondary routes: `/training`, `/change-password`, `/dashboard/learning-paths`, `/dashboard/gallery`, `/dashboard/resources`, `/dashboard/calendar`, `/dashboard/learning-history`, `/dashboard/history`, `/dashboard/compliance`, `/dashboard/skills`, `/dashboard/development-plan`, `/dashboard/notifications`, `/admin/assign`, `/admin/learning-paths`, `/admin/sessions`, `/admin/training-tracking`, `/admin/cchn-registrations`, `/admin/accounts`, `/admin/competencies`, `/admin/skills-matrix`, `/admin/development-plans`, `/admin/retraining`, `/admin/compliance`, `/admin/certificates`, `/admin/certifications`, `/admin/gallery`, `/admin/notifications`, `/admin/audit-log`.

Dynamic patterns are `/join/:token`, `/dashboard/courses/:id`, `/dashboard/learning-paths/:id`, `/dashboard/gallery/:id`, `/dashboard/compliance/:id`, `/dashboard/development-plan/:id`, `/admin/courses/:id`, `/admin/learning-paths/:id`, and `/admin/compliance/cycles/:id`. The old legacy subset was seven; the current registry has nine after including already-split course patterns.

The old path was `bootstrap -> requirePrivateSession -> hydrateLegacySession -> import("../../app.js")`, with public unknown routes also falling back to the monolith. It is gone. `src/app/bootstrap.js` now has 17 explicit dynamic entries, route matching is exact-before-dynamic with safe decoded parameters, and unknown paths render a real 404. `npm run check:legacy-monolith` passes for 51 runtime routes. No runtime source, HTML, service-worker/build artifact, or `dist` file references `app.js` or `styles.css`; `dist/app.js` and `dist/styles.css` are absent.

Every secondary route has loading, empty, error, forbidden, refresh, cleanup, and direct-reload coverage. Data-driven E2E parity covers direct navigation, reload, empty state, no monolith, role-forbidden state, and admin authorization across the route matrix. Business state is no longer published on `window`; route entry metadata stays on `body.dataset` for measurement.

Measured post-remediation route bundles are approximately 144 KB JS/13 KB CSS for learner secondary, 147 KB JS/13 KB CSS for admin secondary, 44 KB JS/3 KB CSS for public training, and no monolith. Full 50-route local evidence is in `docs/audit-remediation/evidence/route-bundles.json`. Legacy source remains only as a non-runtime historical artifact; legacy CSS is no longer copied into `dist`.

## Reporting result

The former capped hydration paths (5,000 profiles/courses and 20,000-30,000 detail rows) were removed from aggregate calculations. `service_report_overview` computes employee, active learner, assignment/completion, completion/on-time rate, overdue, department, and trend aggregates in PostgreSQL. `service_report_detail` provides report-specific keyset pages for employees, enrollments/completion, departments/courses, attendance, quizzes, learning records, certificates, compliance, learning paths, competencies, and development plans.

Detail cursors are HMAC-signed, opaque, requester/report/filter/sort/page-size bound, expiry-limited, and stable-ID tied. Exact count is not returned by default. Maximum date range is 366 days, page size 100, group cardinality 100, synchronous rows 2,000. Private data RPCs have empty `search_path`, no dynamic SQL, service-role-only grants, and no browser-role direct grants. The separate `service_report_pre_request()` hook is intentionally executable by PostgREST's impersonated `anon`/`authenticated` roles so it can apply the transaction-local timeout before dispatch; it returns no data and is not a report access grant.

Database cancellation uses a Supabase/PostgREST `db-pre-request` hook to set transaction-local `statement_timeout` before the report statement starts: overview 8s, detail 5s, export chunk 15s. `service_report_timeout_probe` is the deliberate slow-query contract and Worker errors normalize to `REPORT_DB_TIMEOUT`; no worker-only `Promise.race` remains. Local migration fresh/upgrade/partial replay passes.

`npm run test:reports:100k` uses an ephemeral local PostgreSQL container with 100,000 profiles and 100,000 assignments. Latest evidence: overview p50 626.518 ms / p95 824.15 ms / p99 824.15 ms; employee first page p50 227.163 ms / p95 249.931 ms / p99 249.931 ms; 8 concurrent overview calls 2.778 s total and 20 calls 7.221 s total. Metrics are exact (100,000 employees/assignments, 25,000 completions), first/next pages are stable at 100 rows, aggregate hydration is zero, the 100 ms timeout probe cancels at about 199.35 ms end-to-end, and the same connection succeeds after rollback. Outer RPC plans and buffer totals are captured in `report-100k-performance.json`; inner SQL node plans, CPU/memory, and production-like I/O still require approved staging `auto_explain`/catalog rehearsal.

## Export, Queue, DLQ, and R2

The controlled export registry supports employees, course completion, enrollments, attendance, quiz results, learning records, certificates, and compliance. CSV is capped at 1,000,000 rows (24h retention), XLSX at 10,000 rows (24h), and PDF at 120 compact rows (12h). Oversize output fails explicitly and never truncates. CSV uses keyset chunks and multipart upload; XLSX/PDF are bounded buffered consumers.

Jobs use queue message v2, atomic claim/lease, requester and role re-check, persisted progress, cancellation, redelivery idempotency, checksum/size metadata, multipart abort, and deterministic private R2 keys. Downloads re-authorize current session, account state, ownership/admin scope, role, permission, and expiry; object keys are not exposed. DLQ schema, manual replay cap of three, audit, cleanup, retention, lifecycle, private bucket, and provisioning checklist are in `BACKGROUND_EXPORT_RUNBOOK.md`. Local gates cover all registry types, format limits, duplicate delivery, DLQ envelope, and R2 authorization.

## Search online rollout

Employee search now has additive nullable helper fields and a write trigger. The operational package separates expand, resumable keyset backfill, concurrent indexes outside a transaction, catalog/lock verification, shadow comparison, feature-flag cutover, and rollback. Invalid concurrent index handling and `pg_stat_progress_create_index` checks are documented in `EMPLOYEE_SEARCH_ONLINE_ROLLOUT.md` and `scripts/search-rollout/`. No live table index build was executed.

The latest deterministic 100,000-row local search benchmark records substring p50/p95/p99 of 13.552/17.503/17.693 ms, prefix p50/p95/p99 of 1.253/1.661/3.121 ms, cursor p50/p95/p99 of 0.076/0.108/0.110 ms, and eight-request optimized concurrency of 143.466 ms versus 279.434 ms for the baseline. Evidence is stored in `employee-search-performance.json`.

## CI and files

CI now requires route-all, 100k aggregate, concurrency, timeout, all-export, queue/DLQ, R2, search-rollout, monolith, migration, security, build, artifact, bundle, Wrangler, and audit gates. Main changed areas are `src/app/*`, `src/features/secondary/*`, `worker/services/reporting.js`, `worker/routes/reports.js`, `worker/services/export-jobs.js`, `worker/routes/report-exports.js`, reporting/export/search migrations, route/search/benchmark scripts, E2E parity, CI, and the remediation docs listed above.

## Validation

Passing in this session: lint (0 errors, 136 warnings under ceiling 139), typecheck, fresh/upgrade/partial migrations, unit 74/74, security 35/35, auth rotation 5/5, MFA removal 2/2, rate limit 6/6, session security 27/27, public E2E 8/8, authenticated E2E 8/8 (including secondary parity), PostgreSQL report/search 100k benchmarks, build, privacy scan, bundle budgets, 50-route bundle measurement/budget, monolith detector, Wrangler dry-run, npm audit (0 vulnerabilities), all new export/queue/R2/search local gates, and `git diff --check`.

## Remaining risks and conclusion

Code-level blockers addressed: monolith runtime references, capped aggregate hydration, missing database cancellation, narrow export registry, weak route coverage, and missing online search/Queue/DLQ/R2 packages.

Infrastructure blockers remaining: provision and smoke-test real Queue/DLQ/R2/Durable Object bindings, run PostgreSQL 100k/concurrency/timeout benchmarks and online index rehearsal, validate lock/latency budgets, configure alerts/lifecycle/retention, and execute rollback drills. Operational blocker: approved staging rehearsal and production runbook sign-off. Organizational/security acceptance blocker: explicit acceptance of the intentional no-MFA posture.

Conclusion: **Production-ready có điều kiện**. Code-level remediation is complete for local validation; production requires the infrastructure, operational rehearsal, and organizational security acceptance above. MFA must not be reintroduced as part of those steps.
