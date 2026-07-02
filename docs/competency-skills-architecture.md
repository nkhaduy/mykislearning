# Phase 9 — Competency Framework, Skills Matrix & Individual Development Plans

## Current Data Sources

- Employee profile: `profiles.id`, `profiles.department`, `profiles.position` as job title, `profiles.account_status`.
- Course completion: `enrollments.status = completed`, pinned by `enrollments.course_version_id`.
- Learning Path completion: `learning_path_assignments.status = completed`, pinned by `learning_path_assignments.learning_path_version_id`.
- Quiz pass: `quiz_attempts.passed = true`, score in `score_percent`, pinned by `quiz_attempts.quiz_version_id`.
- Certificate verification: `employee_certifications.verification_status in (approved, verified)`, with expiry/revocation checked before active evidence is counted.
- Compliance completion: `compliance_completion_records`, pinned by `resource_version_id`; exemptions do not create evidence by default.

## Domain Model

The Phase 9 flow is:

`Competency catalog -> Proficiency levels -> Role requirements -> Resource mappings -> Employee evidence -> Verified proficiency -> Gap calculation -> Development plan -> Progress synchronization`

New tables are:

- `competency_categories`
- `competencies`
- `competency_levels`
- `competency_requirements`
- `competency_resource_mappings`
- `employee_competency_assessments`
- `employee_competency_evidence`
- `development_plans`
- `development_plan_items`

## Proficiency Scale

Levels are stored per competency using `code`, `name`, `rank`, `description`, and JSON behavioral indicators. The engine uses numeric `rank`, so it is not hard-coded to exactly five levels.

## Requirement Resolution

Requirements are resolved server-side with this precedence:

1. `individual`
2. `job_title`
3. `department`
4. `all_employees`

When multiple rules at the same precedence match, higher `priority` wins, then the highest required level rank wins. Duplicate rules are blocked by `(competency_id, target_type, target_value, effective_from)`.

## Effective Proficiency

Effective level is calculated server-side:

1. Verified HR/system assessment
2. Active system-derived evidence
3. Pending self-assessment is shown, but does not count as official proficiency

Employees cannot verify themselves. HR verification and manual overrides require an auditable actor and reason.

## Gap Formula

`gap = max(required_level_rank - effective_level_rank, 0)`

Statuses:

- `met`
- `minor_gap`
- `significant_gap`
- `not_assessed`

## Evidence Rules

Evidence supports `course_completion`, `learning_path_completion`, `quiz_pass`, `certificate_verified`, `compliance_completion`, and `manual`. Evidence rows are idempotent by employee, competency, source type, source id, and source version id.

Certificates that expire or are revoked are no longer counted as active evidence. Historical evidence rows are not mutated when a new course/path/quiz version is published.

## Resource and Version Pinning

`competency_resource_mappings.resource_version_id` and `development_plan_items.resource_version_id` pin Phase 8 versions. Existing mappings and plan items do not auto-move when new content is published. New plan items may use the latest published version or a version selected by HR.

## Development Plan Workflow

HR creates a draft plan, adds competency gap items, assigns resource/version, sets due dates, then activates. Employees may start and sync items. Completion is checked server-side against real course, path, quiz, certificate, or compliance completion. Employees cannot change target levels or mark items complete without the underlying resource evidence.

Plans complete when all items are completed. Items become overdue server-side when current time passes `due_at` and status is not completed/cancelled.

## Security

All Phase 9 tables have RLS enabled with deny policies for `anon` and `authenticated`. The Worker uses service role and enforces:

- HR endpoints with `requireHr()`
- Employee endpoints from session/JWT identity
- No employee-supplied arbitrary `employee_id` on employee APIs
- Allowlisted target/status/resource types
- Sanitized metadata
- No service-role key in frontend bundle

## Reporting and Export

Reports add:

- `competencies`
- `development-plans`
- skills matrix export from `/api/admin/skills-matrix/export`

CSV/XLSX export uses formula-injection protection and excludes private assessment notes.

## Notifications

Business events create notifications only on state changes:

- `self_assessment_submitted`
- `self_assessment_verified`
- `self_assessment_rejected`
- `development_plan_assigned`
- `development_plan_item_due_soon`
- `development_plan_item_overdue`
- `development_plan_completed`

Email delivery remains `not_configured` until an email provider is configured.

## Audit

Audit actions cover competency create/update/activate/archive, requirement and mapping changes, assessment verification/rejection/manual overrides, and development plan lifecycle and item changes. Metadata is limited to IDs, level changes, plan/item IDs, and resource version references.

## Migration Strategy

Phase 9 uses one timestamped migration and does not seed production fixtures. Test fixtures must use `[TEST]` names. The migration does not drop or rewrite Phase 1-8 data.

## Deployment Guard

Do not deploy Phase 9 from the Phase 8 baseline while concurrent Landing/About KIS work is dirty in the main repository. Local implementation can be committed in `phase9-competency`; production migration/deploy waits until the UI work is committed and merged safely.
