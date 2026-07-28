# Next Session Handoff

## Safety And Repository State

- Repository: `/Users/khaduy/Documents/KISVN`, branch `main`, Node `v26.4.0`, npm `11.17.0`.
- Worktree remains intentionally dirty with user changes and remediation artifacts. Do not reset, clean, force checkout, rewrite history, or overwrite unrelated files.
- No production/staging deploy, migration apply, CDN purge, credential rotation or production mutation occurred.
- Isolated Supabase runtime remains at `/tmp/kis-lms-worker-supabase.tzteKG`; do not commit its mode-restricted status/credential files.

## Public Presentation Restore

- `NEW-UX-RESTORE-001`: `/` now matches the pre-remediation header, sharp original-dimension hero, centered stats, About banner, final login CTA and patterned footer sourced from commits `e0ff4f9` and `efd6355`; hero/copy reveals, animated counters, gradient metrics and CTA sweep are retained with reduced-motion fallback.
- `NEW-UX-RESTORE-002`: `/about-kis` restores the old hero, overview, desktop/mobile timeline, leadership, values, philosophy, global network, CEO message and footer presentation sourced from `009f4cdc` and the local reference runtime at `/Users/khaduy/Documents/KISVN-about-ui-current`. Timeline photography uses a larger balanced left column and no longer overlaps its year/event copy.
- `NEW-UX-RESTORE-003`: Landing course discovery is absent from split and legacy markup, navigation, CTA text, public styling and runtime data reads. Learner/authenticated course catalog functionality remains unchanged.
- Landing is the typography reference for the whole application. Shared self-hosted Be Vietnam Pro is globally available and applied to public/auth/split/legacy routes and form controls; the legacy admin Manrope token now resolves to the same family. Decorative quote serif and technical monospace remain intentional exceptions.
- `/login` now mirrors the supplied live Worker screenshot: full-bleed office image on desktop, continuous navy overlay, translucent right rail, left MyKIS headline, back-home button and floating white form card. Height-aware compact modes keep the card fully visible and vertically centered in short/display-scaled desktop windows. Mobile does not request the desktop office image, and the localized support label deliberately replaces the screenshot's raw `cannotLogin` text.
- Hero assets retain original dimensions (`941×1672` mobile, `1672×941` desktop) in quality-97 WebP with PNG fallback. About assets retain `3840×2463`/`3840×2160`; the `2560×1642` About-banner image is intersection-loaded below the fold.
- Public footer contact is `Nguyễn Thị Cẩm Thanh`, `thanh.ntc@kisvn.vn`, `Phòng Nhân sự`; the artifact scanner permits only this exact public HR address.
- Visual evidence is stored under `docs/audit-remediation/evidence/restore-public-pages/` at 390, 1024 and 1440 px, with final Lighthouse JSON under `lighthouse-final/`.

## Database And Security State

- Local Supabase CLI `2.107.0`, PostgreSQL `17.6.1.136`; containment migration applied only to the isolated Worker-compatible runtime.
- `SEC-002`, `SEC-004`, `SEC-008`: `VERIFIED` in isolated runtime.
- `SEC-005`: `IMPLEMENTED_NOT_VERIFIED`; cookie/session/revoke/logout pass, but refresh rotation/reuse and privileged MFA remain absent.
- `SEC-007`: `IMPLEMENTED_NOT_VERIFIED`; thresholds/429/Retry-After pass locally, but distributed Cloudflare binding behavior is unverified.
- `SEC-011`: `IMPLEMENTED_NOT_VERIFIED`; full history still fails at migration `005` because UUID/`department_id` from `001` conflicts with text/`department` assumptions.
- Evidence entry points: `DATABASE_POLICY_MATRIX.md`, `evidence/db-before/`, `evidence/db-after/`, `evidence/db-diff.md`.

## Route And Navigation State

- True split entries: `/`, `/login`, `/about-kis`, `/dashboard`, `/dashboard/courses`, `/admin`, `/admin/reports`.
- Current route bundle evidence after the public restore:
  - `/`: 19,004 B JS / 15,501 B CSS.
  - `/login`: 25,078 B JS / 16,410 B CSS.
  - `/about-kis`: 39,255 B JS / 34,703 B CSS.
  - `/dashboard`: 133,119 B / 16,425 B.
  - `/dashboard/courses`: 129,648 B / 16,425 B.
  - `/admin`: 133,773 B / 13,547 B.
  - `/admin/reports`: 143,186 B / 13,856 B.
- Remaining monolith routes: course player/detail, learner quizzes and most learner tools, admin employees, admin course authoring/detail, live training, scanner and other legacy routes.
- `PERF-005` remains `IN_PROGRESS`; do not mark verified until learner/admin/authoring/scanner boundaries are materially complete.
- `UX-001` is `VERIFIED`: route registry classification, role visibility, intentional detail/hidden/redirect lists, Worker policy parity, active navigation, mobile drawer/Escape/focus tests all pass.
- About route is standalone and preserves timeline ARIA/keyboard, VI/EN/KR footer and viewport contracts; its refreshed screenshots at 390/1024/1440 include the enlarged non-overlapping timeline.

## Load And Schema State

- `npm run test:load:ephemeral` seeded and cleaned 100k profiles plus related synthetic data in the isolated database.
- Key results: first-page p95 20.94 ms; deep offset p95 70.89 ms; search p95 298.83 ms; large report p95 512.72 ms; 8 concurrent reports p95 1.99 s, 0% error; 100k export estimate 21.17 MB.
- `PERF-007` and `OPS-004` remain `IN_PROGRESS`: add keyset pagination, search/order indexes, bounded or asynchronous export/report jobs, then benchmark the Worker HTTP layer.
- `ARCH-007` has a machine-readable ownership contract and `SCHEMA_NORMALIZATION_PLAN.md`; no destructive normalization occurred. Current canonical targets are `course_content`, `quiz_questions` plus `quiz_question_versions`, `enrollments`, `content_progress`, and `learning_records`.

## Current Automated Evidence

- Unit: `39/39` pass.
- Security: `20/20` pass.
- Public E2E: `8/8` pass.
- Authenticated split E2E: `4/4` pass.
- Expanded authenticated suite repeat: `20/20` pass with `--repeat-each=5`.
- Targeted About UI/timeline/i18n: `1/1` pass.
- Build: 96 allowlisted files, privacy scanner and bundle budgets pass; mobile LCP image is 93,710 B at the original 941×1672 dimensions.
- Route bundle and load JSON evidence are reproducible with `npm run measure:route-bundles` and `npm run test:load:ephemeral`.
- npm audit: 0 vulnerabilities at the last gate.
- Three-run Lighthouse medians after the sharp-asset restore: Home score 98/LCP 2.410 s/CLS 0/TBT 0/221,649 B; Login score 99/LCP 1.955 s/CLS 0/TBT 0/125,204 B. Raw JSON is under `docs/audit-remediation/evidence/restore-public-pages/lighthouse-final/`.

## Files Added In The Latest Slice

- Public restore: `src/features/public/home.js`, `src/features/public/home.css`, `src/features/public/about.js`, `src/features/public/about.css`, route-specific Be Vietnam Pro subsets under `assets/fonts/`, font preload routing in `src/app/style-loader.js`, and public restore E2E assertions in `e2e/public-readonly.spec.js`.
- Login visual restore: `src/features/auth/login.js`, `src/features/auth/auth-visual.css`, loader/build allowlist updates, and `login-390/1024/1440.png` visual evidence.
- Public About: `src/features/public/about.js`, `src/features/public/about.css`.
- Learner course list: `src/features/learner/courses.js`; status localization fixes in learner dashboard.
- Route/navigation: `src/app/route-registry.js`, shared shell integration, unit/E2E coverage.
- Evidence/scripts: `scripts/measure-route-bundles.mjs`, `scripts/run-ephemeral-load-tests.mjs`, route/load JSON.
- Documentation: `ROUTE_BUNDLE_MATRIX.md`, `NAVIGATION_COVERAGE.md`, `LOAD_TEST_RESULTS.md`, `SCHEMA_NORMALIZATION_PLAN.md`, `schema-normalization-contract.json`.

## Exact Next Steps

1. Preserve the restored public presentation and route-specific Be Vietnam Pro subsets when continuing route extraction work.
2. Split the course player without breaking progress, quizzes, back/forward navigation or session guards.
3. Extract admin employee directory with server pagination/search while preserving create/edit/certification flows as interaction-lazy boundaries.
4. Extract admin course list/authoring, live training and scanner; keep XLSX/QR interaction-only.
5. Add broader authenticated VI/EN/KR and axe/manual keyboard coverage for player, admin employees/editor, live training and scanner.
6. Implement keyset pagination and reviewed search/order indexes; cap or queue large exports/reports, then run Worker HTTP load tests.
7. Reconcile migration history/model pairs in ephemeral/staging only; do not begin destructive normalization before catalog/data parity and rollback evidence.

## Final Gate Commands

```bash
npm run test:unit
npm run test:security
npm run test:e2e:public
npm run test:e2e:authenticated
PLAYWRIGHT_SUITE=authenticated-readonly npx playwright test --repeat-each=5
npm run build
npm audit --audit-level=high
git diff --check
```
