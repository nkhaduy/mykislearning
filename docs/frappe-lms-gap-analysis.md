# Frappe LMS Gap Analysis

Baseline: Frappe Learning `v2.61.0` (`d3bfe97d178eb076310dffd7407106bcdec15d67`). The KIS interface is not a compatibility requirement; only data and business capabilities are compared.

| Existing KIS feature | Frappe equivalent | Status | Decision |
| --- | --- | --- | --- |
| Employee login and 24-hour app session | Native Frappe session authentication | Partial | Use Frappe; force password reset for imported accounts |
| HR and Employee roles | System Manager, Course Creator, Moderator, LMS Student | Native | Use Frappe |
| Learner dashboard and course discovery | Frappe Learning home and course catalogue | Native | Use Frappe |
| Courses and published/draft state | LMS Course | Native | Use Frappe |
| Flat course content | Course Chapter and Course Lesson | Partial | Adapt during migration with one generated chapter when needed |
| Video, text, slide and quiz lessons | Course Lesson markdown/media and LMS Quiz | Partial | Adapt supported content; report unsupported payloads |
| Course assignments/enrollments | LMS Enrollment and LMS Batch Enrollment | Native | Use Frappe |
| Lesson progress and completion | LMS Course Progress and LMS Enrollment progress | Native | Use Frappe |
| Quiz questions, attempts and answers | LMS Quiz, LMS Question and LMS Quiz Submission | Native | Use Frappe |
| Course/content versioning and approval log | Frappe document versions/workflow primitives | Partial | Adapt later |
| Certificates | LMS Certificate and certification workflow | Native | Use Frappe |
| Live/offline training sessions | LMS Batch, timetable and live classes | Partial | Adapt later |
| QR/geolocation attendance | No direct upstream equivalent | Missing | Build later |
| Public training registration microsite | No direct upstream equivalent | Missing | Build later |
| Compliance programs and retraining cycles | Courses/batches cover delivery, not KIS compliance policy | Partial | Build later |
| Learning paths | LMS Program and course relationships | Partial | Adapt later |
| Competency and skills matrix | User skills are narrower than KIS competency model | Partial | Build later |
| Development plans | No direct upstream equivalent | Missing | Build later |
| CCHN/professional certificate tracking | LMS certificates do not model regulatory license lifecycle | Partial | Build later |
| Notifications and reminders | Frappe notifications and LMS scheduled reminders | Native | Use Frappe |
| Audit log and export reports | Frappe Version/Activity Log and reports | Partial | Adapt later |
| Gallery/About KIS/public corporate pages | Outside LMS product scope | Obsolete | Drop from LMS production path |
| Legacy KIS dashboard/sidebar/player/admin UI | Upstream Frappe Learning UI | Obsolete | Drop |

## Phase-one backlog

QR attendance, public training registration, compliance policy automation, KIS learning paths, competency matrices, development plans, regulatory certificate tracking, legacy report parity, and historical audit presentation remain archived in Supabase and are not rebuilt during the upstream-baseline cutover.

## Evidence

- `supabase/migrations/001_schema.sql`
- `worker/router.js`
- `docs/audit-remediation/MIGRATION_INVENTORY.md`
- Upstream `README.md`, `frontend/src/routes.js`, and `lms/lms/doctype/*` at the pinned commit
