# Course Hard Delete Audit

Audit date: 2026-07-03  
HEAD at audit: 3fe7681

---

## Problem

Before this fix, the DELETE `/api/courses` endpoint had two paths:
1. **No related data** → hard delete (correct)
2. **Has enrollments or sessions** → soft archive (`status = "archived"`) — **incorrect per requirement**

The `force=true` path did hard delete but was presented as a secondary escalation in the UI.

---

## Fix

### Worker (`worker/routes/courses.js`)

All DELETE requests now always hard delete:

1. Count impact for audit log
2. Delete `course_content` rows (ON DELETE CASCADE also covers this)
3. Delete `enrollments` rows
4. Set `training_sessions.status = "cancelled"` (FK is `ON DELETE SET NULL` — nullifying course_id would lose session context, so we cancel instead)
5. Delete `course_versions` rows (FK was `ON DELETE RESTRICT` — must delete before course row)
6. Delete `courses` row
7. SELECT verify — if row still exists, return 500
8. Audit log written with impact counts

The `force=true` query param is no longer required by the UI (UI always sends `force=true`) but the endpoint still accepts it for backward compatibility.

### Frontend (`app.js`)

- `openCourseDeleteModal` no longer has a `forceMode` parameter — always opens in hard-delete mode
- Modal always shows "Xóa vĩnh viễn" heading and requires `XÓA` confirmation
- Delete button always sends `force=true`
- After server confirms delete, verifies via GET `/api/courses/impact` — if 404, confirms deletion
- Removes course from `_courses` local state immediately
- Invalidates `mykis.courses.v1` localStorage cache (removes the deleted ID)
- Then refetches in background WITHOUT setting `_courses = null` first

---

## Supabase dependency map

| Table | FK to courses | ON DELETE | Delete strategy |
|-------|--------------|-----------|-----------------|
| `course_content` | `course_id text NOT NULL REFERENCES courses(id)` | CASCADE | Auto-cascade or explicit DELETE |
| `enrollments` | `course_id text NOT NULL REFERENCES courses(id)` | CASCADE | Explicit DELETE (enrollments have sub-data) |
| `course_assignments` | `course_id uuid NOT NULL REFERENCES courses(id)` | CASCADE | Auto-cascade |
| `lesson_progress` | `course_id uuid NOT NULL REFERENCES courses(id)` | CASCADE | Auto-cascade |
| `content_progress` | `course_id text` (no FK) | N/A | Orphan-safe (no FK) |
| `training_sessions` | `course_id text REFERENCES courses(id)` | SET NULL | Set `status=cancelled` then course_id becomes NULL |
| `quizzes` | `course_id text REFERENCES courses(id)` | SET NULL | course_id becomes NULL — quiz data preserved |
| `quiz_attempts` | `course_id text` (no FK) | N/A | Orphan-safe |
| `course_versions` | `course_id text NOT NULL REFERENCES courses(id)` | **RESTRICT** | Explicit DELETE before course row |
| `learning_path_steps` | `resource_id` (no direct FK) | N/A | Orphan-safe (steps reference by ID without FK) |
| `compliance_requirements` | `resource_id` (no direct FK) | N/A | Orphan-safe |
| `user_activity` | `course_id text` (no FK) | N/A | Orphan-safe — historical activity log |
| `audit_events` | none | N/A | Immutable — title snapshot kept |

### Tables with no direct FK (safe to leave):
- `content_progress` — stores course_id as text without FK; orphan rows are harmless
- `user_activity` — analytics log; no FK; orphan rows harmless
- `quiz_attempts` — stores course_id as text; no FK; historical record preserved

### Historical data retained (per requirement):
- `audit_events` — immutable log; contains `title_snapshot` and `impact` in metadata; does NOT make course API return the deleted course
- `training_sessions` — cancelled (not deleted); session attendance records preserved for compliance purposes; `course_id` set to NULL by FK `ON DELETE SET NULL`
- `quizzes` — `course_id` set to NULL; quiz questions/answers preserved for existing attempts

---

## Operational records deleted

When a course is hard-deleted, these are removed:
- All `course_content` rows for the course
- All `enrollments` for the course (learning progress lost)
- All `course_versions` for the course

---

## Post-delete verification

After DELETE:
1. Worker: SELECT by ID — if row exists, returns 500 (not 200)
2. Worker: Audit event written with `action: "course.hard_deleted"` and impact counts
3. Frontend: GET `/api/courses/impact` — expects 404; if 200, throws error and keeps modal open
4. Frontend: `_courses` array filtered to remove deleted ID
5. Frontend: `mykis.courses.v1` localStorage filtered to remove deleted ID
6. Frontend: Background refetch syncs any remaining state

---

## localStorage cache invalidation

Before this fix, deleting a course from Supabase but not from localStorage meant the course could reappear on F5 if the API call failed — because `fetchCoursesFromApi` merged Supabase + local data and the local-only filter only excluded IDs that Supabase returned.

Fix: Immediately after confirmed delete, the localStorage cache is filtered to remove the deleted course ID. Subsequent refetch writes the clean list back.

---

## Migration

No new migration required. The existing FK constraints already support hard delete:
- `course_content` — CASCADE
- `enrollments` — CASCADE  
- `course_versions` — RESTRICT (handled by explicit delete order in worker)
- `training_sessions` — SET NULL (handled by cancellation update)

The worker deletes in the correct order:
1. `course_content` (CASCADE FK, explicit for clarity)
2. `enrollments` (CASCADE FK, explicit for clarity)
3. `training_sessions` update to cancelled (SET NULL FK, preserves session records)
4. `course_versions` (RESTRICT FK — must delete before courses row)
5. `courses` row (final)
6. SELECT verify

---

## Pending migrations after fix

0
