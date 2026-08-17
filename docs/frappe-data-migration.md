# Frappe Data Migration

## Safety and source disposition

The legacy Supabase database remains read-only during the first Frappe cutover. The verified logical backup recorded in `docs/audit-remediation/evidence/PRODUCTION_BACKUP_RESTORE.json` contains 351 profiles and all 73 application tables. A fresh physical dump was attempted on 2026-08-17, but the stored database password no longer authenticates; the current production database is therefore retained unchanged and the earlier verified restore remains the rollback data baseline.

Migration is repeatable. Every imported record receives a stable legacy identifier in Frappe custom fields or migration state, and reruns update the same document instead of creating duplicates. Unmapped records are emitted to a JSON report and are never silently discarded.

## Phase-one importer status

The repeatable importer currently implements users, HR/Employee role mapping, courses, generated chapters, and text/video lessons. It resolves Frappe document names before creating chapter and lesson links, and the site bootstrap creates the required unique legacy-ID custom fields idempotently. Enrollments, historical progress, quizzes/results, certificates, and media remain mapped below but are intentionally not imported until a fresh production export can be authenticated. The last verified backup contains no content, enrollment, progress, or quiz rows, so this does not discard known backed-up records.

| Legacy source | Frappe target | Mapping |
| --- | --- | --- |
| `profiles` | `User` | email -> name/email; full_name -> first/last name; employee_code -> custom legacy field; active state preserved |
| `profiles.role=employee` | User roles | `LMS Student` |
| `profiles.role in (hr,admin)` | User roles | `LMS Student`, `Course Creator`, `Moderator`, `System Manager` |
| `courses` | `LMS Course` | title, description, image, published/draft status, category |
| `course_content` | `Course Chapter` + `Course Lesson` | group by course; create a default chapter when the source has no chapter; map text/video/quiz payloads |
| `course_assignments` and `enrollments` | `LMS Enrollment` | account -> member; course -> course; status/progress mapped when available |
| `content_progress` | `LMS Course Progress` | account/course/content -> member/course/lesson; completion -> status |
| `quizzes` | `LMS Quiz` | title, passing score, attempt limit, duration, shuffle flag |
| `quiz_questions`, `questions`, `question_options` | `LMS Question` and quiz child rows | prompt, type, options, correctness and marks |
| `quiz_attempts`, `quiz_answers` | `LMS Quiz Submission` and result rows | score, pass state, timestamps and answers |
| `employee_certifications`, `learning_records` | archive/report; selective `LMS Certificate` import | only course-linked certificates map automatically |
| `file_uploads` and media URLs | Frappe `File` or retained external URL | download/copy when reachable; report missing or unsupported media |
| all KIS-only tables | retained Supabase archive | no phase-one import; table counts and disposition stay documented |

## Passwords and authentication

Legacy passwords are PBKDF2 hashes embedded in profile fields and cannot be safely transplanted into Frappe's authentication format. Users are created disabled from password login until a reset/invite is issued. No password hash, session token, MFA secret, or refresh token is exported into migration reports.

## Validation

The importer must compare source and destination counts for users, courses, lessons, enrollments, progress rows, quizzes and media, then fail non-zero when required records are missing. Optional/unmappable rows are listed with source table, source ID and reason.

Local unit validation on 2026-08-17 imported a sanitized in-memory fixture twice: the second run updated the same four documents rather than duplicating them. Unit tests cover dependency ordering, idempotency, dry-run behavior, role normalization, and unmapped-record reporting. A live production-data reconciliation remains blocked on the unavailable Supabase database password and production Frappe host.

## Evidence

- `docs/audit-remediation/evidence/PRODUCTION_BACKUP_RESTORE.json`
- `docs/audit-remediation/evidence/db-before/catalog.json`
- `supabase/migrations/001_schema.sql`
- `supabase/migrations/006_worker_compatible_schema.sql`
- Upstream DocType JSON at Frappe Learning `v2.61.0`
