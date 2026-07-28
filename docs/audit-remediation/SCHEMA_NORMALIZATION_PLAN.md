# Schema Normalization Preparation

Date: 2026-07-27
Finding: `ARCH-007`
Status: `IN_PROGRESS`
Scope: inventory, contract tests, reconciliation queries, migration and rollback planning only. No table is dropped, renamed, merged, or rewritten in this checkpoint.

## Ownership Inventory

| Model/Table | Current writer | Current reader | Production usage evidence | Canonical target | Migration risk |
| --- | --- | --- | --- | --- | --- |
| `course_content` | Worker course content route; legacy serverless course content API | Worker course/player route; content-version backfill | Active `.from("course_content")` calls in `worker/routes/courses.js` and `api/courses/content.js` | `course_content` | High: text IDs and JSON payloads differ from the UUID legacy model |
| `course_contents` | No current Worker writer found | Legacy migrations and legacy RLS only | Defined by `001_schema.sql`; no current Worker/API table call | Migrate into `course_content`, then deprecate after parity | High: UUID FK graph includes `lesson_progress` and quiz links |
| `questions` | No current Worker writer found | Legacy migrations/RLS only | Defined by `001_schema.sql`; no current Worker/API table call | Migrate into `quiz_questions` | High: attempts and answers may retain UUID references |
| `quiz_questions` | `worker/routes/quizzes.js` | `worker/routes/quizzes.js`; versioning backfill | Active runtime read/upsert calls | `quiz_questions` | High: reconcile legacy `questions` before enforcing uniqueness |
| `quiz_question_versions` | Versioning workflow/migration | Versioned quiz publication | Active versioning schema; intentionally immutable snapshots | `quiz_question_versions` | High: retain as versioned child, not a duplicate to collapse |
| `enrollments` | Worker enrollment, backfill, compliance and versioning routes | Courses, reports, development, competencies and notifications | Broad active Worker usage | `enrollments` | Critical: assignment/progress/reporting dependency hub |
| `course_assignments` | No current Worker writer found | Legacy migrations/RLS only | Defined by `001_schema.sql`; no current Worker/API table call | Migrate into `enrollments` | Critical: semantic differences in status, deadlines and version pinning |
| `lesson_progress` | No current Worker writer found | Legacy migrations/RLS only | Defined by `001_schema.sql`; no current Worker/API table call | Migrate into `content_progress` | Critical: UUID content IDs versus current text IDs |
| `content_progress` | Worker and legacy serverless content-progress routes | Course progress and public stats | Active Worker/API usage | `content_progress` | Critical: drives enrollment completion and learning history |
| `learning_history` | No current Worker writer found | Legacy migration/RLS only | Defined by `004_core_learning_workflows.sql`; no current runtime table call | Reconcile into `learning_records` | High: completion facts must not be duplicated or lost |
| `learning_records` | `worker/routes/learning-records.js` | Learner and HR review workflows | Active runtime endpoint and attachment FK | `learning_records` | High: approval lifecycle and source uniqueness must be preserved |

The machine-readable ownership contract is `docs/audit-remediation/schema-normalization-contract.json`; `tests/unit/schema-normalization-contract.test.mjs` fails if required duplicate models lose ownership classification or a Worker starts writing a legacy table.

## Role Values

- Runtime browser/session roles are `employee`, `hr`, and `admin`.
- Database check constraints still admit `trainer`; this checkpoint does not invent instructor policies because the product role is not implemented end to end.
- `manager` and `superAdmin` remain legacy client/type values only. They must not be accepted by the signed-session bootstrap or receive new RLS policies without an ownership decision.

## Reconciliation Queries Required Before Migration

1. Count rows and distinct business keys in both members of every duplicate group.
2. Produce left/right anti-joins using explicit key mappings; never compare only row counts.
3. Compare payload hashes after canonical field mapping, excluding audit timestamps.
4. Detect conflicting writers by `updated_at`, audit log, and version history.
5. Verify orphan FKs and ID-type conversion feasibility before copying any row.
6. Re-run report, course-player, quiz-attempt, completion, certificate, and audit contracts against a dual-read preview.

## Migration Sequence

1. Freeze new writes to the legacy member through code review and a database audit trigger in staging.
2. Add canonical compatibility columns/indexes without dropping legacy objects.
3. Backfill in bounded batches with per-batch counts and checksums.
4. Dual-read and compare; keep one canonical writer.
5. Switch readers only after parity and performance gates pass.
6. Retain legacy tables read-only for an agreed observation window.
7. Drop only in a later approved migration with backup, catalog snapshot, and signed reconciliation evidence.

## Rollback

- Before reader cutover: stop the backfill and remove only newly added compatibility objects.
- After reader cutover: point readers back to the still-preserved legacy table; do not reverse-copy potentially newer canonical rows blindly.
- After any future drop: restore into a quarantine schema from the pre-drop backup, reconcile deltas, then decide a forward fix. Do not restore browser grants, anonymous access, or credential fallback.

## Current Blockers

- Full migration history does not replay cleanly because migration `005` conflicts with the UUID/department model from `001`.
- No staging catalog/data parity snapshot exists.
- Instructor/manager ownership is unresolved.
- Dynamic REST table names outside the Worker graph need one final staging traffic/log review before cutover.
