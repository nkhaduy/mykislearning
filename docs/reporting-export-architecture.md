# Reporting and Export Architecture

## Current Data Sources

- Employees, department, job title: `profiles.id`, `profiles.full_name`, `profiles.employee_code`, `profiles.department`, `profiles.position`.
- Course catalog: `courses.id`, `courses.status`, `courses.delivery_mode`, `courses.data`.
- Course assignments/progress: `enrollments.status`, `enrollments.data.deadline`, `enrollments.data.progressPercent`, `enrollments.created_at`, `enrollments.updated_at`.
- Learning Path: `learning_paths`, `learning_path_assignments`, and existing step progress tables for future drill-down.
- Compliance: `compliance_assignments` and `compliance_completion_records`; completion records are tied to the same `cycle_id` and never shared across cycles.
- Certificates: `certificate_types`, `certificate_requirements`, `employee_certifications`.
- Quiz: `quizzes`, `quiz_attempts`. Answer-level analytics are not reliable unless attempts include question response details.
- Live training: `training_sessions`, `training_participants`, `training_registrations`, `attendance`.
- Learning hours: no actual normalized learning-duration metric exists for every assignment. The report therefore does not call estimated course duration actual learning hours.
- Training cost and provider/trainer: no normalized production data source exists in Phase 5.

## Report Definitions

- Overview: employee count, active learners, open courses, assignment completion, on-time completion, total completions, overdue learners, department comparison, and priority exceptions.
- Employees: one row per employee after employee filters, with assignment counts and last learning activity derived from course assignments.
- Departments: one row per department. Employees with no assignment are included in total employees and participation denominator, but not counted as incomplete assignments.
- Courses: one row per course with assignment status counts and completion rate.
- Learning Paths: one row per path using `learning_path_assignments`. Bottleneck step is left null until step-level stalled-state evidence is normalized.
- Compliance: one row per cycle/program using `compliance_assignments` plus `compliance_completion_records`.
- Certificates: certificate status rows plus missing required certificates. Pending/rejected/revoked records do not satisfy requirements.
- Quizzes: attempts, participants, average score, pass rate, retakes. Hardest question is null without answer-level evidence.
- Training Sessions: registered/participant counts and attendance from attendance/check-in data.

## Metric Formulas

- Completion rate = completed assignments / eligible assignments x 100.
- Eligible assignments exclude cancelled/exempted only where the source schema supports those statuses.
- On-time completion rate = completed at or before due date / assignments with due date x 100.
- Overdue = current time > due date and status not in completed, cancelled, exempted.
- Active learner = employee with assignment activity inside the selected report date range.
- Department participation rate = employees with at least one assignment / total active employees in the department x 100.
- Compliance completion rate = completion records in the selected cycle / non-cancelled, non-exempted cycle assignments x 100.
- Certificate requirement satisfied = verified/approved certification whose status is not revoked, expired, or pending.
- Learning hours = null unless actual tracked duration or confirmed duration rules exist.

## Filter Model

- Common filters: `from_date`, `to_date`, `department`, `jobTitle`, `employeeId`, `courseId`, `status`, `page`, `pageSize`.
- Report-specific filters: `learningPathId`, `complianceProgramId`, `complianceCycleId`, `certificateTypeId`, `expiryWindowDays`, `trainingMode`.
- UI keeps important filter state in `/admin/reports` query parameters.
- Worker validates date range, report type, status, format, page size, and sort field allowlists.

## API Design

- `GET /api/admin/reports/overview`
- `GET /api/admin/reports/employees`
- `GET /api/admin/reports/departments`
- `GET /api/admin/reports/courses`
- `GET /api/admin/reports/learning-paths`
- `GET /api/admin/reports/compliance`
- `GET /api/admin/reports/certificates`
- `GET /api/admin/reports/quizzes`
- `GET /api/admin/reports/training-sessions`
- `GET /api/admin/reports/export?report_type=&format=`

The implementation is split between `worker/routes/reports.js` and `worker/services/reporting.js`.

## Export Design

- CSV: UTF-8 BOM, quoted cells, escaped quotes/newlines, Vietnamese headers, filtered data only.
- XLSX: generated workbook with `Summary` and `Detail` sheets, autofilter, frozen header metadata, and safe text cells.
- PDF: Phase 5 returns a printable report payload with PDF content type for summary/report validation. A heavier PDF renderer is deferred unless Cloudflare runtime budget is explicitly approved.
- Export row cap: 50,000 rows. Larger async export scheduling belongs to Phase 6.
- Formula injection protection: text cells starting with `=`, `+`, `-`, or `@` are prefixed with a single quote.

## Performance Strategy

- Worker aggregates server-side and returns paginated rows.
- Fetches are batched per report type and bounded with explicit limits.
- Sort field and report type use allowlists.
- Existing indexes cover primary Phase 5 access paths: enrollments by account/course/status, compliance by cycle/employee/status/due date, certificates by type/status/verification/expiry.
- No materialized views are introduced because there is no refresh strategy yet.

## Security Model

- All report and export endpoints call `requireHr()`.
- Employee sessions receive `403 HR_ONLY`.
- Service-role keys, certificate storage paths, signed URLs, password fields, tokens, and private notes are not exported.
- Sort, status, report type, and format are allowlisted.
- Frontend filter values are treated as untrusted and revalidated by the Worker.
- Phase 7 audit hooks should record `report_viewed` and `report_exported`.

## Timezone and Date Rules

- Display timezone: `Asia/Ho_Chi_Minh`.
- `from_date` is inclusive at `00:00:00+07:00`.
- `to_date` is inclusive for the user-selected date and converted to an exclusive UTC upper bound at the next Vietnam day.
- Presets are computed for Vietnam business dates, not server-local dates.

## Migration Needs

No Phase 5 migration is required. Existing Phase 1-4 tables and indexes support the current reports. Future migrations may add saved presets, export jobs, normalized learning-duration facts, and audit events.

## Phase 6 Scheduling Hooks

- Saved report presets can become the input for scheduled report requests.
- Async export jobs can store `report_type`, validated filters, columns, requested format, owner, status, and expiry.
- Email delivery and cron are intentionally out of scope for Phase 5.

## Phase 7 Audit Hooks

- `report_viewed`: report type, filters hash, actor account id, row count.
- `report_exported`: report type, format, filters hash, row count, result, duration.
- Do not store raw exported file content in audit logs.

## Acceptance Criteria

- HR can view overview and detail reports from `/admin/reports`.
- Employee cannot call HR report endpoints.
- Filters change API queries and persist in URL.
- CSV/XLSX/PDF export uses the current validated filter set.
- No fake metrics are shown for missing learning hours, costs, providers, or answer-level quiz analytics.
- Phase 1-4 regression remains green after Phase 5.
