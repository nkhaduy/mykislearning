# Frappe Frontend to Supabase API Map

## Phase-one implementation

Login/logout/session/profile, catalogue, course detail, ordered chapters/lessons, self-enrollment, lesson completion, and HR course/chapter/lesson authoring are implemented in `frontend/src/data/supabase/`. The browser uses only the public Supabase key; RLS is the authority for every operation.

Baseline: Frappe Learning `v2.61.0` at `d3bfe97d178eb076310dffd7407106bcdec15d67`. Audit scope: 403 Vue/TypeScript/JavaScript files under `frontend/src`.

| Frappe frontend call | Purpose | Supabase replacement | Status |
| --- | --- | --- | --- |
| `setConfig('resourceFetcher', frappeRequest)` | Global resource transport | KIS `resourceFetcher` dispatcher backed by Supabase JS/RPC | Planned |
| `lms.lms.api.get_user_info` | Current user, roles, permissions | `auth.getSession()` + `profiles` query | Planned |
| `logout` | End session | `supabase.auth.signOut()` | Planned |
| Frappe `/login` redirect | Password login page | Supabase password sign-in route | Planned |
| `lms.lms.api.get_lms_settings` | UI feature settings | Static phase-one settings + optional `lms_settings` row | Planned |
| `lms.lms.api.get_sidebar_settings` | Navigation configuration | Role-aware local upstream-compatible sidebar config | Planned |
| `createListResource({ doctype: 'LMS Course' })` | Catalogue/admin course lists | `courses` query with published/HR RLS | Planned |
| `frappe.client.get` / `get_value` for `LMS Course` | Course detail | Course detail query/view with instructors and outline | Planned |
| `frappe.client.insert/set_value` for `LMS Course` | Create/edit/publish course | `courses` insert/update under HR RLS | Planned |
| `Course Chapter`, `Lesson Reference` resources | Ordered outline | `chapters` and `lessons` ordered by `idx` | Planned |
| `get_lesson_creation_details` | Lesson editor data | Lesson adapter returning Frappe-compatible editor fields | Planned |
| `frappe.client.insert/set_value` for `Course Lesson` | Lesson CRUD | `lessons` insert/update/delete under HR RLS | Planned |
| `LMS Enrollment` list/insert | Enrollment state | `enrollments` select/upsert | Planned |
| `lms.lms.api.mark_lesson_progress` | Complete lesson | Atomic `complete_lesson` RPC/upsert | Planned |
| `LMS Course Progress` | Lesson completion rows | `lesson_progress` ownership query | Planned |
| Course progress distribution/statistics methods | HR reporting | Aggregate SQL/RPC over enrollments/progress | Deferred |
| `LMS Quiz*` resources and submission APIs | Quiz authoring/taking/results | Quiz tables/RPC | Deferred |
| `FileUploader`, `upload_file`, `File` | Course images, lesson files, avatars | Supabase Storage adapter and bucket policies | Planned |
| `socket.io-client` / LMS notification events | Realtime notifications | No-op phase-one socket facade; optional Supabase Realtime later | Deferred |
| `LMS Batch*`, live class APIs | Cohorts and scheduled learning | Supabase batch model | Deferred |
| `LMS Program*` | Learning programs | Supabase program model | Deferred |
| `LMS Certificate*` and PDF endpoint | Certification | Supabase certificate model/Edge Function PDF | Deferred |
| Assignment, job, payment, coupon, email, Raven APIs | Advanced upstream modules | Feature-specific Supabase models/functions | Deferred |
| `frappe.client.get_count/get_list/search_link` | Generic DocType access | Allowlisted compatibility dispatcher only | Planned |
| `frappe.client.insert/set_value/delete` | Generic writes | Allowlisted entity methods with RLS; never generic unrestricted CRUD | Planned |

## Entry and dependency inventory

- Entry: `frontend/src/main.js`; installs Frappe UI, Pinia, router, translation, page metadata, telemetry, and socket.
- Router: `frontend/src/router.js`; course, lesson, profile, authoring, quiz, batch, program, and settings routes plus Frappe session/persona checks.
- Layouts: `components/Layouts/*`, `components/Sidebar/*`, `App.vue`.
- Core learner pages: `pages/Home/*`, `pages/Courses/*`, `pages/Lesson.vue`, `components/StudentLessonSidebar.vue`, `components/LessonContent.vue`.
- Core authoring pages: `pages/Courses/CourseForm.vue`, `CourseEditor.vue`, `LessonForm.vue`, chapter/lesson modals.
- Stores: `stores/user.js`, `session.js`, `settings.js`, `notifications.js`, `sidebar.js`.
- Backend coupling: `createResource`, `createListResource`, `call`, generic DocType operations, file upload endpoints, Jinja boot data, and socket.io.
