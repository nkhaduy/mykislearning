# MyKIS Learning Content Versioning Architecture

## Current Content Model

Courses are mutable rows in `courses` with learner-facing metadata in `data` and ordered content in `course_content`. Enrollments reference `course_id` only, so before Phase 8 an assigned learner always resolved the current course row/content.

Quizzes are mutable rows in `quizzes` with settings in `data`; questions are mutable `quiz_questions` rows. Attempts reference `quiz_id` only and store submitted result data, but not an immutable quiz/question definition.

Learning Paths are mutable rows in `learning_paths`; ordered resource steps live in `learning_path_steps`. Assignments and step progress reference the mutable path/step ids.

Compliance Programs and Cycles already snapshot some operational rules on the cycle (`resource_type`, `resource_id`, pass score, max attempts, deadline dates, `resource_revision_reference`). Phase 8 replaces the free-form revision reference with first-class `resource_version_id` while preserving the existing field for compatibility.

Reports currently query current content tables and aggregate by course/path/quiz ids. Notifications deep link to assignments/resources and do not store content snapshots. Audit logging is immutable and supports course, quiz, learning path, compliance and notification categories.

## Versioned Entities

Versioned:

- Course title/name, description, objectives, duration, delivery mode, content item snapshot, completion rules, quiz association, pass requirements and published learner content.
- Quiz title, instructions, passing score, time limit, attempt rules, questions, options, correct answers, explanations, order and points.
- Learning Path title, description, completion mode/rules, step order, step resource type, step `resource_id`, pinned `resource_version_id`, prerequisite, required state and step configuration.
- Compliance cycle resource version, pass score, attempt rules and deadline rules.

Not versioned:

- Internal admin tags, display-only colors, transient UI state, created/updated timestamps, signed URLs, storage signed URL values, report filters and notification delivery state.
- Certificate records, because certificates already maintain renewal/supersession history.
- Notification templates, because Phase 6 already gave them independent version fields.

## Version Schema

Phase 8 adds immutable version tables:

- `course_versions`
- `quiz_versions`
- `quiz_question_versions`
- `learning_path_versions`
- `learning_path_version_steps`

Each version has integer `version_number`, `status`, `change_type`, `change_summary`, `created_from_version_id`, creator/publisher timestamps and immutable snapshots. Published versions are protected by database triggers and Worker validation.

The canonical current pointers are:

- `courses.current_version_id`
- `quizzes.current_version_id`
- `learning_paths.current_version_id`

Version numbers are generated server-side from the current maximum version for the entity. Frontend-supplied version numbers are ignored.

## Assignment Pinning

Assignments pin versions at creation:

- `enrollments.course_version_id`
- `quiz_attempts.quiz_version_id`
- `learning_path_assignments.learning_path_version_id`
- `learning_path_step_progress.version_step_id`
- `compliance_cycles.resource_version_id`
- `compliance_assignments.resource_version_id`
- `compliance_completion_records.resource_version_id`

Existing assignments are backfilled to v1 and are not mutated when HR publishes a later version. New assignments resolve the entity `current_version_id`.

## Publication Workflow

HR creates a draft from a published version, edits only the draft, reviews a diff, and publishes the draft. Publishing sets the new version as current and keeps older versions as history. Published content cannot be edited; rollback means creating a new draft from an older version and publishing it as a new version.

Allowed transitions are `draft -> in_review -> published -> retired`, `draft -> archived`, and `in_review -> draft`.

## Change Classification

HR must select `patch`, `minor`, or `major` and provide `change_summary`. Major publishes create a pending retraining review. Patch and minor publishes do not mass assign learners by default.

## Retraining Workflow

`retraining_reviews` records from/to versions, affected counts, HR decision and status. `retraining_assignments` makes apply idempotent. Publishing a major version creates a pending review; HR can preview, approve, dismiss and apply. Apply creates new assignments pinned to the new version without resetting historical completions.

## Migration And Backfill

The migration creates v1 for existing courses, quizzes and learning paths, snapshots current content/questions/steps, sets current pointers, pins existing assignments/attempts/progress/compliance records and enables RLS. It is idempotent and does not delete content, reset progress, reset attempts or alter historical scores.

## Audit, Notifications And Reports

Worker actions log `course.version_*`, `quiz.version_*`, `learning_path.version_*` and `retraining.*` events with metadata only: entity id, version id, version number, change type, summary and affected counts. Full content snapshots are not written to audit metadata.

Notification events added by Phase 8 are `content_version_published`, `retraining_review_required` and `retraining_assigned`. Employees are notified only when retraining is assigned to them.

Reports include version labels/ids in course, quiz, learning path and compliance exports while preserving historical metrics.

## Security Model

Version tables use RLS with no anon/authenticated read policies. The Worker uses service-role access and every HR endpoint calls `requireHr()`. Employee routes only resolve assigned published versions. Drafts are never returned to employees. Diff output is structured JSON/text and escaped by UI rendering.

## Rollback Strategy

No destructive rollback is used. To restore old content, HR creates a new draft from an older version and publishes it as a newer version. Migration rollback, if needed before production use, is additive-column/table removal only after confirming no production assignment depends on Phase 8 data.

## Acceptance Criteria

- Existing content has v1.
- Published versions are immutable.
- Existing assignments keep old versions after publish.
- New assignments use the latest published version.
- Quiz attempts keep the quiz version used at submission.
- Learning Path progress is not reset by new path versions.
- Compliance cycles keep pinned resource versions.
- Major publishes create retraining reviews without automatic mass assignment.
- Audit, notifications and reports include version context.
- Direct REST cannot read version snapshots.
