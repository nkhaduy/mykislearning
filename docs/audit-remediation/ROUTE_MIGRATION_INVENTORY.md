# Route Migration Inventory

Generated from `src/app/route-registry.js` on 2026-07-28. Every runtime route now selects a dedicated entry (or an explicit safe redirect); no route falls through to `app.js`.

| Route group | Routes | Role | Entry | Initial evidence | Priority |
|---|---|---|---|---|---|
| Public/auth | `/`, `/about-kis`, `/login`, `/account/security` | public/private | dedicated | 20–42 KB JS | completed |
| Learner overview | `/dashboard`, `/dashboard/courses` | employee | dedicated | 134–138 KB JS | completed |
| Course player | `/dashboard/courses/:id` | employee | `coursePlayer` | 131 KB JS / 13 KB CSS | completed |
| Employee management | `/admin/employees` | HR/Admin | `employees` | 144 KB JS / 16 KB CSS | completed |
| Course management | `/admin/courses`, detail | HR/Admin | `courseManagement` | 132 KB JS / 13 KB CSS | completed |
| Live training | `/admin/live-training`, detail | HR/Admin | `liveTraining` | 132 KB JS / 12 KB CSS | completed |
| Quiz | `/admin/quizzes`, `/dashboard/quizzes` | HR/Admin/employee | `quizzes` | 132 KB JS / 12 KB CSS | completed |
| Records/certificates | `/admin/learning-records`, `/dashboard/certificates` | HR/Admin/employee | `learningRecords` | 132 KB JS / 12 KB CSS | completed |
| Attendance | `/attendance/scan` | private | `attendance` | 133 KB JS / 12 KB CSS; QR deferred | completed |
| Reports | `/admin/reports` | HR/Admin | `reporting` | 151 KB JS / 17 KB CSS | completed |
| Secondary learner | learning paths, gallery, resources, calendar, history, compliance, skills, development, notifications | employee | `learnerSecondary` | route-shell + secondary CSS | completed |
| Secondary admin | assign, sessions, tracking, CCHN, accounts, competencies, development, retraining, compliance, gallery, notifications, audit | HR/Admin | `adminSecondary` | route-shell + secondary CSS | completed |

Route request dependencies are measured from browser network events; runtime features do not publish business or diagnostic state on `window`.

## Per-route migration result

The API column identifies the primary server contract or compatibility dependency. Each route below is rendered by `learnerSecondary`, `adminSecondary`, or `publicTraining`; it has loading/empty/error/forbidden states and does not import the monolith. Gallery/resource routes use a bounded route-shell fallback until a dedicated Worker collection endpoint is provisioned.

| URL | Roles | Primary API/service | Initial reason it loaded `app.js` | Existing direct evidence | Initial priority |
|---|---|---|---|---|---|
| `/training` | public | `/api/public/live-training/*` | `publicTraining` entry | `e2e/public-training-ui-hydration.spec.js` | completed |
| `/join/:token` | public | `/api/public/live-training/*` | token join flow, timers and DOM handlers | `e2e/public-training-external-links.spec.js` | medium |
| `/change-password` | private | `/api/auth` | legacy form/session handler | auth/security suites | high |
| `/dashboard/learning-paths` | employee | `/api/learning-paths/my` | learning-path state and render branches | `e2e/phase2-learning-path.spec.js` | high |
| `/dashboard/learning-paths/:id` | employee | `/api/learning-paths/*` | step/progress globals and detail handlers | `e2e/phase2-learning-path.spec.js` | high |
| `/dashboard/gallery` | employee | `galleryService` | local service wrapper and gallery globals | gallery coverage only through legacy suites | low |
| `/dashboard/gallery/:id` | employee | `galleryService` | album state and modal handlers | gallery coverage only through legacy suites | low |
| `/dashboard/resources` | employee | legacy resource state | local wrapper and broad CSS | route registry contract | medium |
| `/dashboard/calendar` | employee | calendar/training services | calendar state and DOM handlers | calendar legacy suites | medium |
| `/dashboard/learning-history` | employee | `/api/learning-history` | history aggregation/render state | learning-record suites | medium |
| `/dashboard/history` | employee | redirect to learning history | redirect branch in monolith | route registry contract | low |
| `/dashboard/compliance` | employee | `/api/compliance/my` | compliance state and detail modal | `e2e/phase3-compliance.spec.js` | high |
| `/dashboard/compliance/:id` | employee | `/api/compliance/*` | cycle/detail globals | `e2e/phase3-compliance.spec.js` | high |
| `/dashboard/skills` | employee | `/api/competencies/my` | skills matrix aggregation in UI | `e2e/phase9-competency-skills.spec.js` | medium |
| `/dashboard/development-plan` | employee | `/api/development-plans/my` | plan/item mutable state | competency/development suites | medium |
| `/dashboard/development-plan/:id` | employee | `/api/development-plans/*` | item editor/detail handlers | competency/development suites | medium |
| `/dashboard/notifications` | employee | `/api/notifications` | notification state and actions | `e2e/phase6-notifications.spec.js` | medium |
| `/admin/assign` | HR/Admin | `/api/enrollments`, employees/courses | assignment wizard and selection globals | assignment legacy suites | high |
| `/admin/learning-paths` | HR/Admin | `/api/admin/learning-paths` | builder state and reorder handlers | `e2e/phase2-learning-path.spec.js` | high |
| `/admin/learning-paths/:id` | HR/Admin | `/api/admin/learning-paths/*` | builder/detail global state | `e2e/phase2-learning-path.spec.js` | high |
| `/admin/sessions` | HR/Admin | `/api/training/*` | offline-class state, QR and import helpers | `e2e/verify-offline-class-production.spec.js` | high |
| `/admin/training-tracking` | HR/Admin | `/api/admin/training-tracking` | tracking tables and global filters | `e2e/training-tracking-cchn.spec.js` | medium |
| `/admin/cchn-registrations` | HR/Admin | `/api/admin/cchn/*` | catalog/registration shared state | `e2e/training-tracking-cchn.spec.js` | medium |
| `/admin/accounts` | HR/Admin | account-support/auth APIs | account action modals and session handlers | auth/session suites | high |
| `/admin/competencies` | HR/Admin | `/api/admin/competencies` | competency editor state | `e2e/phase9-competency-skills.spec.js` | medium |
| `/admin/skills-matrix` | HR/Admin | `/api/admin/competencies` | matrix aggregation and filters | `e2e/phase9-competency-skills.spec.js` | medium |
| `/admin/development-plans` | HR/Admin | `/api/admin/development-plans` | plan builder state | competency/development suites | medium |
| `/admin/retraining` | HR/Admin | competencies/development APIs | derived retraining workflow globals | competency/development suites | medium |
| `/admin/compliance` | HR/Admin | `/api/admin/compliance/*` | program/cycle state and editors | `e2e/phase3-compliance.spec.js` | high |
| `/admin/compliance/cycles/:id` | HR/Admin | `/api/admin/compliance/*` | cycle-detail globals | `e2e/phase3-compliance.spec.js` | high |
| `/admin/certificates` | HR/Admin | `/api/admin/certificates` | certificate workflow and modal state | `e2e/phase4-certificates.spec.js` | medium |
| `/admin/certifications` | HR/Admin | redirect to certificates | redirect branch in monolith | route registry contract | low |
| `/admin/gallery` | HR/Admin | `galleryService` | gallery editor globals | gallery coverage only through legacy suites | low |
| `/admin/notifications` | HR/Admin | `/api/admin/notifications/*` | monitor/reminder action state | `e2e/phase6-notifications.spec.js` | medium |
| `/admin/audit-log` | HR/Admin | `/api/admin/audit-logs` | audit filters and table state | `e2e/phase7-audit-log.spec.js` | medium |

Dedicated route source modules, dynamic imports, API calls and initial assets are recorded in `docs/audit-remediation/evidence/route-bundles.json`, `src/app/bootstrap.js` and the matching `src/features/*` entry. Scanner QR decoding is the only priority heavy dependency and is loaded after camera start; report overview does not eagerly load XLSX.
