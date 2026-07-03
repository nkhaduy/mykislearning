# Learning Status Determination

## Online Courses (Enrollments)

Status auto-computed via `calculateCourseProgress()` (`lib/mockDatabase.js:1346`):

| Status | Condition |
|---|---|
| `not_started` | `progressPercent === 0` |
| `in_progress` | `progressPercent > 0` but not 100%, or `pendingGrading === true` |
| `completed` | All required content done AND no quizzes in `pendingManual` grading |

**Content type completion rules:**

| Type | Completion trigger |
|---|---|
| `slide` | `contentProgress.completed === true` (set when user views all slides) |
| `video` | `contentProgress.completed === true` (when watched >= requiredPercent) |
| `quiz` | Attempt `submittedAt` set AND (`requirePass` ? `passed === true` : `gradingStatus !== "pendingManual"`) |

**Flow:** `saveContentProgress()` → `syncEnrollmentProgress()` → `calculateCourseProgress()`

## Offline / Hybrid Training

`evaluateCourseCompletion()` (`lib/services/trainingAnalyticsService.js:75`):

| `deliveryMode` | Required for completion |
|---|---|
| `online` | Online progress only |
| `offline` | All required sessions attended |
| `hybrid` | Both online + all required sessions |

**Attendance:** HR marks via `markAttendance()` or QR check-in/check-out (`/api/attendance/check-in`, `/api/attendance/scan`).

## Quiz Passing

`submitQuizAttempt()` (`lib/mockDatabase.js:1284`):
- MCQs: compares selected vs correct options
- Essay: sets `pendingManual = true`; HR grades via `gradeQuizEssay()`
- `passed = scorePercent >= quiz.passingScore`
- If any essay, `passed = null` until graded

## Training Tracking (`study_format`)

**Completely independent** from course system. HR manually enters free-text `study_format` (Online/Offline/Full-time) on `training_tracking_records`. Status set manually: `not_updated` → `planned` → `in_progress` → `completed` → `cancelled`.

## Learning Paths

`recalcAssignmentProgress()` (`worker/routes/learning-paths.js:39`):
- Completion = all required steps completed
- Step status: `locked` / `available` / `in_progress` / `completed` / `skipped`
- Sequential: steps unlock in order; Flexible: prerequisite gates only
- Anti-cheat: verifies underlying resource (course enrollment, quiz pass, session attendance) before marking

## Compliance Training

`syncAssignment()` (`worker/routes/compliance.js:167`):
- Course-based: checks enrollment `status === "completed"` + optional `pass_score`
- Learning-path-based: checks `learning_path_assignments.status === "completed"`
- Status: `not_started` → `in_progress` → `completed` / `overdue` / `failed`
- Auto-synced on every compliance list view

## Learning History Aggregation

`employeeHistory()` (`worker/routes/learning-records.js:237`):
Combines: completed enrollments (online), attended sessions (offline), approved learning records, verified certificates.
