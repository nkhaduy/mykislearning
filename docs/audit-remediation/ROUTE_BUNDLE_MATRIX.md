# Route Bundle Matrix

Date: 2026-07-27
Finding: `PERF-005`
Environment: local SPA, Chrome 390x844, synthetic intercepted sessions/data. Evidence: `docs/audit-remediation/evidence/route-bundles.json`.

| Route | Initial JS | Initial CSS | Lazy/entry boundary | XLSX loaded? | QR loaded? | Admin code loaded? | Monolith? |
| --- | ---: | ---: | --- | --- | --- | --- | --- |
| `/` | 18,948 B | 15,394 B | `public/home.js` | No | No | No | No |
| `/login` | 24,680 B | 6,889 B | `auth/login.js` | No | No | No | No |
| `/about-kis` | 39,199 B | 33,785 B | `public/about.js` | No | No | No | No |
| `/dashboard` | 133,063 B | 16,234 B | `learner/dashboard.js` | No | No | No | No |
| `/dashboard/courses` | 129,592 B | 16,234 B | `learner/courses.js` | No | No | No | No |
| `/dashboard/courses/course-a` | 1,170,156 B | 378,685 B | Legacy player | No | No | Yes through `app.js` | Yes |
| `/admin` | 133,717 B | 13,356 B | `admin/dashboard.js` | No | No | Yes, route-specific | No |
| `/admin/employees` | 1,170,156 B | 378,685 B | Legacy employee management | No | No | Yes | Yes |
| `/admin/courses` | 1,170,156 B | 378,685 B | Legacy authoring | No | No | Yes | Yes |
| `/admin/reports` | 143,130 B | 13,665 B | `reporting/reports.js` | No; export is server-side | No | Reporting only | No |
| `/admin/live-training` | 1,170,156 B | 378,685 B | Legacy live-training flow | No | No | Yes | Yes |
| `/attendance/scan` | 1,170,156 B | 378,685 B | Legacy scanner shell; QR interaction remains lazy | No | No on initial load | Yes through `app.js` | Yes |

## Acceptance Result

- Public home/login performance boundaries remain intact; About no longer imports `app.js` or global CSS.
- Learner dashboard and course catalog stay below the 350 KB initial-JS target.
- Admin dashboard/reporting stay below the 500 KB initial-JS target.
- XLSX and QR libraries are absent from every measured initial route.
- `PERF-005` remains `IN_PROGRESS`: course player, employee management, course authoring, live training, quizzes, scanner and other legacy routes still cross the monolith boundary.

No preload rule pulls lazy feature chunks into public or unrelated routes.
