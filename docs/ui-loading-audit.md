# UI Loading Audit

Audit date: 2026-07-03  
HEAD at audit: 3fe7681

---

## Root causes of flicker identified

1. **`_certList = []` reset before fetch** — `loadCertsForEmployee` set the list to `[]` and called `render()` immediately, causing a blank flash before data returned.
2. **`fetchCoursesFromApi` called `render()` at loading start regardless of existing data** — every refetch triggered a loading state render even when `_courses` was already populated.
3. **`openCourseDeleteModal(id, true)` secondary path** — clicking "Xóa vĩnh viễn" reopened the modal via `openCourseDeleteModal` which called `render()` again unnecessarily.
4. **`render()` called inside `fetchCalendarEvents` at both start and end** — `render()` at start shows spinner unconditionally.
5. **Many async loaders call `render()` at loading start**: `loadAuditLogs`, `loadRetrainingReviews`, `loadLearningHistory`, `loadAdminLearning`, `loadCertificateAdmin`, `loadMyCertificates`, `loadCompetencyCatalog` — all call `render()` when setting `loading=true`. These show skeletons/spinners on every refetch.

---

## Fixes applied

| File | Line area | Issue | Fix |
|------|-----------|-------|-----|
| `app.js` | `loadCertsForEmployee` | `_certList = []` before fetch causes empty flash | Only reset on initial load; keep existing data during refetch |
| `app.js` | `fetchCoursesFromApi` | `render()` called immediately causing loading flicker on refetch | Only render on initial load (`_courses === null`); render after fetch completes |
| `app.js` | Delete confirm handler | After delete, called `fetchCoursesFromApi` without removing item first — brief empty state | Remove item from local state immediately after server confirms, then refetch in background |
| `app.js` | `courseDeleteModal()` | "Lưu trữ" button label and soft-delete path confused users | Always shows "Xóa vĩnh viễn" — hard delete only |

---

## Routes audited

### Status: Fixed
- `/admin/courses` — refetch no longer causes list to blank out
- `/admin/courses/:id` — skeleton shown only on initial load when course not yet in cache
- `/admin/employees` — cert modal no longer flashes empty list

### Status: No change needed (architecture correct)
- `/admin` — HR overview uses `hr-overview-skeleton` only on initial load; updates via `render()` after fetch
- `/admin/learning-paths` — `_lpList` guarded by `if (!force)` early return
- `/admin/compliance` — `_compliancePrograms` guarded by length check
- `/admin/audit-log` — shows skeleton row during loading, keeps rows visible
- `/admin/retraining` — same pattern
- `/dashboard/courses` — skeleton only on first load
- `/dashboard/learning-paths` — same
- `/dashboard/compliance` — same

### Status: Acceptable / low impact
- `/admin/notifications` — triggers `render()` at monitor start; not disruptive since page renders shell first
- `/admin/reports` — `reportLoading = true; render()` replaces table with loading; acceptable for export flow
- Calendar fetch calls `render()` at start — acceptable since calendar is a secondary panel

---

## Skeleton system

Existing shared skeleton classes (no new ones added — existing system was already correct):

| Class | Use |
|-------|-----|
| `.ui-skeleton` | Base: background shimmer, border-radius 4px |
| `.ui-skeleton--line` | Text line skeleton (14px height) |
| `.ui-skeleton--title` | Title skeleton (22px, 60% width) |
| `.ui-skeleton--block` | Generic block (80px) |
| `.adm-skeleton-block` | Admin section blocks |
| `.adm-kpi-skeleton` | KPI number placeholder |
| `.hr-overview-skeleton` | 4-column KPI grid skeleton |
| `.kpi-loading` | Inline KPI loading state |

Animation: `skeleton-pulse` / `hrSkeleton` — both respect `prefers-reduced-motion: reduce`.

---

## Layout stability

- Skeleton heights match content heights in course list and HR overview
- No `scrollbar-gutter` changes needed — no horizontal shift observed
- `aria-busy` added to delete modal during loading
- `aria-hidden="true"` on decorative skeleton blocks in delete modal
