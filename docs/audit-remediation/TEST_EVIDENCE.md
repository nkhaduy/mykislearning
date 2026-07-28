# Test Evidence

## Checkpoint 2026-07-28 — Migration Replay, Lint, Typecheck, And CI Gates

Environment: branch `main`; protected dirty worktree; recovery snapshot
`/tmp/kisvn-preready-20260728-001143`; Node `v26.4.0`, npm `11.17.0`,
Wrangler `4.114.0`, and ephemeral Supabase PostgreSQL image
`17.6.1.136`. All database data was synthetic and local. No remote Supabase
project, production/staging data, Cloudflare deployment, or production request
was used.

Migration evidence:

- Fresh replay from `001` through the reconciliation migration passed.
- Legacy upgrade from `001-004` with UUID profiles/departments and representative
  course, enrollment, progress, training, quiz and learning-history rows passed.
- Recoverable partial state passed; conflicting UUID/text department state failed
  clearly and rolled back transaction changes.
- All public tables had RLS, direct `anon`/`authenticated` public table grants were
  zero, invalid public foreign keys were zero, logical orphan checks were zero,
  and department mismatches were zero.
- Reconciliation replay created no duplicate legacy learning records.

Quality pipeline evidence:

- ESLint flat config distinguishes browser, Worker, Node scripts, unit/security
  tests and Playwright. `npm run lint` passed with 0 errors and 139 visible legacy
  warnings; no source/runtime directory is broadly ignored.
- `npm run typecheck` passed for archived TypeScript facades, active Worker
  auth/security JavaScript with `checkJs`, and active CI scripts with `checkJs`.
- The eight unused TypeScript siblings were moved intact to
  `legacy/typescript/`; runtime JavaScript remains authoritative and their
  classification is recorded in `TYPESCRIPT_INVENTORY.md`.
- `.github/workflows/quality-gates.yml` installs from the lockfile and fails on
  lint, typecheck, unit/security tests, build/privacy/budget, all migration
  scenarios, high-severity dependency audit, or Wrangler dry-run.
- Wrangler dry-run now writes to a unique temporary directory and cleans it in
  `finally`, so it does not modify tracked `.wrangler-dry` output.

Regression results:

- Unit `42/42`, security `20/20`, public E2E `8/8`, authenticated E2E `4/4`.
- Build, 96-file artifact privacy scan, bundle budget, route bundle measurement,
  JavaScript syntax validation, TypeScript checks, `npm audit --audit-level=high`,
  Wrangler deploy dry-run, and `git diff --check` passed.
- Two local `1 / 1` logins retained exactly one reserved profile and one private
  credential row; admin overview, employees and courses returned HTTP 200.
- Production-mode runtime simulation rejected the reserved username on both a
  remote application host and localhost with HTTP 401.

Remaining production limitations are operational rather than repository gate
failures: a real environment still needs backup/catalog preflight and a staged
maintenance-window migration rehearsal; privileged MFA/step-up, refresh-token
rotation/reuse detection, and distributed edge rate-limit verification remain
unimplemented or unverified.

## Checkpoint 2026-07-27 — Local Super Admin And Final Accessibility Gate

Environment: isolated local Supabase/PostgreSQL and Wrangler at `127.0.0.1`; synthetic-only data; no production request, deployment, migration apply, or credential use.

Local admin runtime proof:

- Two consecutive `1 / 1` logins returned the same reserved profile ID with role `admin` and password status `normal`.
- The local database retained exactly one reserved profile and one private credential row after both logins.
- The authenticated session reached `/admin`, `/api/admin/overview`, `/api/employees`, and `/api/courses` successfully.
- A production-mode simulation against the same isolated database returned HTTP 401 for both username `1` and the reserved local email.
- Unit contracts require an explicit development runtime flag, a localhost application host, and a localhost Supabase URL; production/staging, remote host/database, or a disabled flag fail closed.

Final browser and performance evidence:

- Chrome trace, no throttling: `/login` LCP `145 ms`, CLS `0`; `/admin` LCP `581 ms`, CLS `0`.
- Lighthouse desktop/mobile: Login accessibility `100/100`, best practices `100/100`; Admin accessibility `100/100`, best practices `100/100`.
- The final mobile admin runtime has no horizontal overflow or console warnings/errors, keeps the closed navigation drawer `inert`, exposes a named language selector, and includes a reduced-motion rule.
- Current route bundle evidence is refreshed in `evidence/route-bundles.json`. Split routes stay monolith-free; the remaining legacy detail/admin/scanner routes are explicitly recorded there.

Final validation:

- Unit `42/42`, security `20/20`, public E2E `8/8`, authenticated E2E `4/4`.
- Static build, 96-file privacy scan, public bundle budget, JavaScript syntax checks, Worker dry-run, `npm audit --audit-level=high`, and `git diff --check` all pass.
- There is still no configured TypeScript compiler or lint pipeline; this remains a repository limitation rather than a passing gate.

Remaining limitations: full migration history still fails at migration `005`; refresh-token rotation/reuse and privileged MFA are absent; distributed edge rate limiting is not runtime-verified; several high-cost routes still load the legacy monolith.

## Checkpoint 2026-07-27 — Public Presentation Restore And Font Regression Gate

Command:
`npm run test:unit`; `npm run test:security`; `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4174 npm run test:e2e:public`; `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4174 npm run test:e2e:authenticated`; targeted `e2e/about-kis-ui-polish.spec.js`; `npm run build`; `npm run measure:route-bundles`; `npm audit --audit-level=high`; `git diff --check`; three mobile Lighthouse runs for Home and Login.

Environment:
Local SPA at `http://127.0.0.1:4174`; Chrome/Playwright and Lighthouse mobile emulation; no production request, deploy, database connection, or mutation.

Dataset:
Public pages plus synthetic intercepted authenticated session/API responses. No production identity or course data.

Finding IDs:
`NEW-UX-RESTORE-001`, `NEW-UX-RESTORE-002`, `NEW-UX-RESTORE-003`; public presentation regression gate for `PERF-001` through `PERF-005`, `UX-001`, `UX-002`, `UX-003`, `UX-004`, `UX-005`, and `UX-006`.

Expected:
Restore the pre-remediation Landing and About presentation with sharp original-dimension assets, Landing motion/count-up/gradient effects, Landing-reference Be Vietnam Pro typography across all route families, larger balanced timeline photography and the approved HR contact, without reintroducing course discovery, the public monolith, private dependencies, raw translation keys or accessibility regressions.

Actual:
Landing restores the old header, full-resolution hero composition, centered metrics, About banner, final login CTA and patterned footer. Count-up state, gradient text/CTA, reveal choreography and reduced-motion fallback are runtime-tested. About restores the old hero/overview/timeline/leadership/values/philosophy/network/CEO/footer composition while preserving tab/tabpanel semantics and keyboard behavior. The timeline image is full-width within a `1.2fr/.8fr` desktop composition, exceeds 420×320 px at 1440, and no longer collides with the year/events; mobile remains full-width. Login now follows the supplied live Worker screenshot with a full-bleed office background, blended navy rails, left contextual heading, back-home control, floating white card, compact `Đăng nhập` form heading and proper eye icon. The route is locked to `100dvh`; height-specific compact modes keep the whole form visible without page scrolling and center the card with equal top/bottom spacing at standard and short desktop viewports, including `998×463`. Mobile intentionally keeps the office image unloaded. Shared self-hosted Be Vietnam Pro covers public, auth, split learner/admin/reporting, 404 and legacy monolith routes; the old admin Manrope token is removed. The screenshot's raw `cannotLogin` defect is not restored: VI/EN/KR support labels remain localized. Unit `39/39`, security `20/20`, public E2E `8/8`, authenticated E2E `4/4`, and targeted About E2E `1/1` pass. Build produces 96 allowlisted files; privacy scan and budgets pass with Home `19,004 B JS / 15,501 B CSS`, Login `25,078 B / 16,410 B CSS`, About `39,255 B / 34,703 B`, and mobile LCP image `93,710 B`. `npm audit` reports 0 vulnerabilities and `git diff --check` passes. The prior sharp-asset Lighthouse medians remain Home score `98`, LCP `2.410 s`, CLS `0`, TBT `0`, transfer `221,649 B`; Login score `99`, LCP `1.955 s`, CLS/TBT `0`, transfer `125,204 B`.

Pass/Fail:
PASS. Public presentation, dependency, accessibility, font, build, security and performance gates meet the requested thresholds.

Artifacts:
`docs/audit-remediation/evidence/restore-public-pages/home-390.png`, `home-1024.png`, `home-1440.png`, `about-390.png`, `about-1024.png`, `about-1440.png`, `login-390.png`, `login-1024.png`, `login-1440.png`; final raw Lighthouse JSON under `docs/audit-remediation/evidence/restore-public-pages/lighthouse-final/`; route requests/bundles in `docs/audit-remediation/evidence/route-bundles.json`.

Remaining limitation:
Lighthouse evidence is local lab data, not production field/CDN data. The approved personal HR address is intentionally public and is the only personal `@kisvn.vn` exception accepted by the artifact scanner.

## Checkpoint 2026-07-27 — Phase 1 Start

Command:
`git status --short`; `git branch --show-current`; `node --version`; `npm --version`; remediation document review; local tool discovery.

Environment:
Repository `/Users/khaduy/Documents/KISVN`, branch `main`; no production request, deploy, database connection, or mutation.

Dataset:
None.

Finding IDs:
Checkpoint baseline for all in-scope findings.

Expected:
Preserve the dirty worktree, confirm the documented runtime/tooling baseline, and read the complete prior evidence before changes.

Actual:
Branch `main`, Node `v26.4.0`, npm `11.17.0`; 97 tracked changes and 38 untracked path groups remain protected. Supabase CLI `2.107.0` exists; Docker and `psql` are absent. The 660-line audit was read from the evidence path recorded in `NEXT_SESSION_HANDOFF.md`; all remediation ledgers and the pending migration were read completely.

Pass/Fail:
PASS for baseline capture and documentation review. Ephemeral database provisioning remains pending.

Artifacts:
This section and the existing handoff/progress ledgers.

Remaining limitation:
Regression commands and database runtime provisioning have not yet completed.

## Checkpoint 2026-07-27 — Baseline Regression Gate

Command:
`npm run test:unit && npm run test:security && npm run test:e2e:public && npm run build && npm audit --audit-level=high && git diff --check`

Environment:
Local repository and local SPA only; Node `v26.4.0`, npm `11.17.0`; no production request, deploy, database connection, or mutation.

Dataset:
Existing synthetic/unit fixtures only.

Finding IDs:
All previously verified findings plus the checkpoint regression gate.

Expected:
No regression from the prior checkpoint.

Actual:
Unit `30/30`, security `19/19`, public E2E `7/7`; build produced 68 allowlisted files with public JS `13,886 B`, public CSS `10,574 B`, mobile LCP image `14,234 B`; artifact privacy scan and bundle budget passed; `npm audit` reported 0 vulnerabilities; `git diff --check` passed.

Pass/Fail:
PASS.

Artifacts:
Local terminal evidence summarized here; build output remains under `dist/`.

Remaining limitation:
Authenticated and database-runtime tests were not part of this baseline command.

## Checkpoint 2026-07-27 — Ephemeral Full-History Replay Attempt

Command:
Supabase CLI `2.107.0` `start` against a new `/tmp/kis-lms-supabase.*` workdir containing repository migrations except `20260726090000_security_containment.sql`.

Environment:
Colima `0.10.3`, Docker engine `29.5.2`, PostgreSQL/Supabase containers local only; no linked/remote project use.

Dataset:
No seed was applied before failure.

Finding IDs:
`SEC-011`, `ARCH-007`.

Expected:
Replay the pre-containment migration history and keep a local database running for catalog capture.

Actual:
Migrations `001` through `004` applied, then `005_cloudflare_missing_tables_patch.sql` failed with `column \"department\" does not exist`. Migration `001` defines UUID `profiles.id` and `department_id`; migration `005` assumes text IDs and a `department` column. The stack stopped and the containment migration was never present or applied.

Pass/Fail:
FAIL for full-history replay; PASS for fail-closed isolation and drift detection.

Artifacts:
Sanitized local log `/tmp/kis-lms-supabase.mmC05L/start.log` (not committed because it may contain local-only keys).

Remaining limitation:
A representative Worker-compatible baseline must be created explicitly; this attempt cannot be used as security verification evidence.

## Checkpoint 2026-07-27 — Containment Migration And Catalog Diff

Command:
Local Supabase start/reset; `supabase migration up --local`; `scripts/db-catalog-snapshot.sql`; `scripts/verify-ephemeral-security.sql`; Supabase DB lint/advisors.

Environment:
Colima `0.10.3`, Docker engine `29.5.2`, Supabase CLI `2.107.0`, PostgreSQL `17.6.1.136`; Worker-compatible migrations `005` onward; synthetic-only data; no remote project.

Dataset:
5 seeded profiles plus paired Employee A/B course, progress, learning record, attachment, notification, attendance, certificate, compliance and development-plan records; three legacy credential markers.

Finding IDs:
`SEC-002`, `SEC-004`, `SEC-005`, `SEC-008`, `SEC-011`, `ARCH-007`.

Expected:
Atomic apply; all public tables protected; browser grants removed; credentials moved out of profiles; private schema not publicly exposed.

Actual:
PASS. RLS increased from 45/66 to 66/66 public tables. `anon`/`authenticated` public table and function privilege counts are zero. Three private tables and six service-role-only `search_path=''` RPCs were created. Three legacy markers migrated to private credentials and were cleared. DB lint found no schema errors; advisors returned warnings only.

Pass/Fail:
PASS for Worker-compatible ephemeral apply. Full-history replay remains FAIL at migration `005` and prevents `SEC-011` verification.

Artifacts:
`evidence/db-before/catalog.json`, `evidence/db-after/catalog.json`, `evidence/db-diff.md`, `evidence/db-after/security-verification.json`, `evidence/db-after/db-lint.txt`, `evidence/db-after/advisors.txt`.

Remaining limitation:
No staging/production catalog parity or apply evidence exists.

## Checkpoint 2026-07-27 — Auth And Bootstrap Runtime

Command:
Local Wrangler Worker connected to the ephemeral Supabase stack; `scripts/prepare-ephemeral-auth-runtime.mjs`; `scripts/test-ephemeral-auth-runtime.mjs`.

Environment:
Wrangler local-only at `127.0.0.1:8787`; generated synthetic credentials stored only in mode-600 `/tmp` files; no production account/data.

Dataset:
Employee A/B, trainer, HR, admin and one bootstrap admin; paired own/cross-user rows.

Finding IDs:
`SEC-002`, `SEC-004`, `SEC-005`, `SEC-008`.

Expected:
Own-data isolation, no credential exposure, correct cookie/session lifecycle, atomic one-time bootstrap.

Actual:
PASS for login, HttpOnly/SameSite/Path, Secure on HTTPS, 8h/7d durations, minimal probe, invalid/expired/tampered rejection, fixation defense, password change, HR reset, no legacy fallback, persistent logout revoke, and Employee A/B symmetric scope. Bootstrap concurrency: 8 requests, exactly 1 success and 7 HTTP 410, later request 410, one profile/credential/audit record.

Pass/Fail:
PASS with limitation.

Artifacts:
`evidence/db-after/auth-runtime.json`, `DATABASE_POLICY_MATRIX.md`, `evidence/db-after/runtime-final-security.json`.

Remaining limitation:
Refresh token rotation/reuse is not implemented; `SEC-005` remains IMPLEMENTED_NOT_VERIFIED.

## Checkpoint 2026-07-27 — Rate Limit Runtime

Command:
`scripts/test-ephemeral-rate-limit-runtime.mjs` against local Wrangler.

Environment:
Local in-memory fallback buckets; synthetic-only Worker/DB.

Dataset:
Synthetic HR/admin sessions and non-existent synthetic login/reset identities.

Finding IDs:
`SEC-007`, `SEC-008`.

Expected:
Configured threshold followed by HTTP 429 and positive `Retry-After`.

Actual:
PASS locally: login 5, reset 3, setup 3, employee search 120, reports 20, upload 10, attendance/public join 60. The next request returned 429 with `Retry-After` for every scope.

Pass/Fail:
PASS for local contract; NOT VERIFIED for distributed edge behavior.

Artifacts:
`evidence/db-after/rate-limit-runtime.json`.

Remaining limitation:
No durable Cloudflare rate-limit binding/staging load evidence; client address trust depends on the Cloudflare edge setting `CF-Connecting-IP`.

## Checkpoint 2026-07-27 — Final Regression Gate

Command:
`npm run test:unit`; `npm run test:security`; `npm run test:e2e:public`; `npm run build`; `npm audit --audit-level=high`; `git diff --check`.

Environment:
Repository-local Node `v26.4.0`/npm `11.17.0`; Playwright Chrome against an automatically managed local SPA server; no production request, deploy, database apply, or mutation.

Dataset:
Unit/security synthetic fixtures and intercepted public-browser auth responses only. Database runtime evidence remains in the separate synthetic Supabase artifacts above.

Finding IDs:
Regression gate for all verified and in-progress findings; E2E harness change is associated with `ARCH-005`.

Expected:
Preserve the prior public performance/security baseline after the migration/auth patches, and make the documented `npm run test:e2e:public` command self-contained for local execution.

Actual:
Unit `30/30`, security `20/20`, public E2E `7/7`. Build produced 68 allowlisted files; privacy scan passed; public JS `13,886 B`, public CSS `10,574 B`, mobile LCP image `14,234 B`; bundle budget passed. `npm audit` reported 0 vulnerabilities and `git diff --check` passed. The first E2E invocation exposed a harness-only `ERR_CONNECTION_REFUSED` because no server lifecycle was configured; `playwright.config.js` now starts `npm run start:spa` only for localhost targets, and the full command passes.

Pass/Fail:
PASS after the local harness correction; no application assertion was weakened or skipped.

Artifacts:
`playwright.config.js`, `dist/`, and this evidence entry.

Remaining limitation:
Authenticated route performance/accessibility and mutation E2E are not part of the public read-only suite.

## Baseline Syntax

Command:
`rg --files -g '*.js' -g '*.mjs' -g '!node_modules' -g '!dist' -g '!test-results' | xargs -n1 node --check`

Environment:
Local repository, Node `v26.4.0`, no production API calls.

Result:
PASS.

Relevant Finding IDs:
All findings (baseline only).

Before:
No repository unit/type/lint script exists.

After:
No code changes at this checkpoint.

Remaining limitation:
TypeScript files are not compiled by the current build and no type-check configuration exists.

## Baseline Static Build

Command:
Temporary repository copy followed by `node scripts/build-static.mjs`.

Environment:
`/tmp/kis-lms-baseline.hjkrPn`; repository `dist/` was not overwritten.

Result:
PASS; artifact size 20 MB.

Relevant Finding IDs:
SEC-003, PERF-003, PERF-004, ARCH-004, OPS-003.

Before:
Build copies `images/`, `data/`, and the complete `lib/` tree.

After:
No code changes at this checkpoint.

Remaining limitation:
Baseline artifact contains data-like files identified by the audit and is not safe to deploy.

## Baseline Dependency Audit

Command:
`npm audit --json`

Environment:
Local dependency lockfile, read-only registry audit.

Result:
FAIL security gate: 4 high, 0 critical vulnerabilities.

Relevant Finding IDs:
SEC-003, PERF-004.

Before:
Known vulnerable dependency tree includes four high findings.

After:
No dependency change at this checkpoint.

Remaining limitation:
The audit reports no automatic fix for the current XLSX package path; remediation must avoid loading/shipping it on public routes and evaluate replacement.

## Baseline E2E Safety

Command:
Configuration inspection only; full Playwright suite intentionally not executed.

Environment:
`playwright.config.js` points to the production Worker URL.

Result:
BLOCKED by safety guard absence.

Relevant Finding IDs:
ARCH-005.

Before:
Mutation-capable specs can target production.

After:
No code changes at this checkpoint.

Remaining limitation:
Playwright mutation tests must be guarded and moved to local/staging before execution.

## Phase 0 Authorization Matrix

Command:
`npm run test:security`

Environment:
Local Node `v26.4.0`, Worker handlers invoked in-process with synthetic signed tokens and no production network mutation.

Result:
PASS; 19 security tests. Anonymous private endpoint matrix returned `401` across employee, course, training, attendance, records, notification, reporting, compliance, audit, learning-path, competency, development-plan and CCHN routes. Employee bearer claims returned `403` for HR-only routes. Forged headers, invalid bearer, expired bearer and conflicting signed/forged headers were rejected or ignored. The read-only session probe returns `401` anonymously and only signed account ID/role/expiry metadata for a valid cookie.

Relevant Finding IDs:
`SEC-001`, `SEC-005`, `SEC-006`, `SEC-007`, `SEC-008`, `SEC-010`, `UX-003`, `SEO-001`, `SEO-003`.

Before:
Audit observed forged HR headers returning `200` from `/api/employees`, wildcard CORS, missing security headers and soft-404 behavior.

After:
Bearer/cookie verification is fail-closed; legacy headers are local-only; CORS rejects untrusted origins; API/header contracts and route 404 tests pass.

Remaining limitation:
These are repository/runtime-handler tests, not a deployed Worker or authenticated Supabase staging run. Rotate/revoke existing sessions after deployment.

## RLS/Grant Source Verification

Command:
`npm run test:unit` (including `tests/unit/rls-migration.test.mjs`)

Environment:
Local filesystem only; SQL is not applied.

Result:
PASS; 15 unit tests. Active SQL scan found no RLS-disable statements or direct grants to `anon`/`authenticated` in the canonical/legacy migration set. Containment migration includes private credential, revoked-session and bootstrap stores plus legacy marker cleanup.

Relevant Finding IDs:
`SEC-002`, `SEC-004`, `SEC-011`.

Before:
Audit identified migration drift: old migrations disabled RLS or granted browser roles while later migrations enabled RLS.

After:
Legacy migration intent and canonical containment migration now consistently preserve Worker-only private access.

Remaining limitation:
No local database is available (`supabase db lint --local` cannot connect to `127.0.0.1:54322`). Run `scripts/verify-supabase-security.sql`, advisors and role-policy tests on ephemeral/staging before marking these findings verified.

## Static Artifact Privacy Verification

Command:
`node scripts/build-static.mjs` in a temporary repository copy; `node scripts/scan-static-artifact.mjs dist`

Environment:
Temporary build directory; repository `dist/` was not overwritten for the build measurement.

Result:
PASS; current build contains 68 allowlisted files (approximately 5.8 MB including authenticated/admin assets). Scanner rejects private-data paths, office data extensions, credential markers, private keys, personal company email patterns and selected high-confidence secrets without printing file contents. Public delivery budgets also pass.

Relevant Finding IDs:
`SEC-003`, `PERF-003`, `PERF-004`, `ARCH-004`, `OPS-003`.

Before:
Tracked `data/employees.*`, `dist/data/employees.*`, `images/goc.xls`, `dist/images/goc.xls` and broad build directory copies could enter static output.

After:
Build uses file-level asset/module allowlists; real root/dist employee/XLS artifacts are removed; test-only mock auth modules are excluded; runtime fixtures are empty and synthetic fixtures are under `tests/fixtures` outside build paths.

Remaining limitation:
CDN purge and Git-history review are operational actions. A protected nested `.claude` worktree still has old copies and must be handled separately.

## Playwright Read-Only and Mutation Safety

Command:
`npm run test:e2e:public`

Environment:
Local static server at `http://127.0.0.1:4173`; public read-only suite only.

Result:
PASS; 7 tests. Home renders; login exposes native semantics; mobile login excludes the monolith, desktop background and global CSS; support modal keyboard behavior passes; intercepted HTML/non-JSON login responses produce a safe alert; protected deep links preserve only allowlisted destinations; a synthetic successful login returns to the allowed route; unknown route returns HTTP 404 with recovery UI and `noindex` metadata. No real backend mutation request is made.

Relevant Finding IDs:
`ARCH-005`, `UX-003`, `SEO-003`, `SEO-004`.

Before:
Playwright config defaulted to a production Worker URL and full suite included mutating specs.

After:
Default target is local; `e2e/global-setup.mjs` and `scripts/assert-safe-e2e-target.mjs` refuse mutation against known production hosts, even when mutation is explicitly enabled.

Remaining limitation:
Running the mutation suite requires an ephemeral/staging Worker and synthetic database; it remains intentionally unexecuted.

## Worker Bundle and Dependency Verification

Command:
`npx wrangler deploy --dry-run --outdir <temporary-directory>`; `npm audit --json`

Environment:
Local Wrangler `4.114.0`, dry-run only; no deploy.

Result:
PASS dry-run bundle after the final dependency update: total Worker upload `1,906.42 KiB`, gzip report `382.24 KiB`. Dependency audit improved from the baseline 4 High to 0 vulnerabilities after updating Wrangler and replacing SheetJS `0.18.5` with the official pinned `0.20.3` tarball.

Relevant Finding IDs:
`SEC-003`, `PERF-004`, `ARCH-003`, `ARCH-005`.

Before:
Wrangler/miniflare/sharp chain and `xlsx` produced four High findings.

After:
Wrangler is `^4.114.0`; SheetJS resolves to `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` with lockfile integrity `sha512-oLDq...3AJA==`; the browser vendor runtime has SHA-256 `cc015130...a6f41`; public XLSX loading remains lazy and absent from home/login initial routes.

Remaining limitation:
No known npm advisory remains. XLSX route behavior is verified by local round-trip tests and Worker bundling, but authenticated report/import E2E still requires the ephemeral Worker/database environment.

## SheetJS Dependency Remediation

Command:
`npm install --save-exact https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`; copy `node_modules/xlsx/dist/xlsx.full.min.js` to the allowlisted browser vendor path; `npm run test:unit`; `npm audit --audit-level=high`; `npm run build`; `npx wrangler deploy --dry-run --outdir <temporary-directory>`.

Environment:
Local package lock/build only; official SheetJS CDN tarball; no production deploy, report export or employee import mutation.

Result:
PASS. `npm audit` reports `0 vulnerabilities`. Unit suite has 30 passing tests, including version assertions and an XLSX write/read round-trip that preserves formula-protected text. The browser vendor file matches the installed runtime SHA-256 exactly. Static build/privacy/bundle gates and Wrangler dry-run pass.

Relevant Finding IDs:
`NEW-SEC-001`, `PERF-004`, `PERF-005`, `OPS-003`.

Before:
Both Worker imports and `vendor/xlsx.full.min.js` used SheetJS `0.18.5`, which npm reported as High severity for prototype pollution and ReDoS with no npm-registry fix.

After:
Worker/script imports keep the compatible `xlsx` API but resolve to official SheetJS `0.20.3`; the lazy browser runtime is the matching `0.20.3` distribution; package-lock pins the URL and integrity.

Remaining limitation:
Authenticated XLSX report/skills-matrix/import flows are not executed against a real ephemeral database in this checkpoint. CSV remains the safe operational fallback if staging uncovers a compatibility regression; vulnerable `0.18.5` must not be restored.

## About Timeline Accessibility

Command:
`node --check app.js`; `PLAYWRIGHT_SUITE=about-readonly PLAYWRIGHT_ALLOW_MUTATION=true npx playwright test e2e/about-kis-ui-polish.spec.js --grep 'hero metrics' --workers=1`.

Environment:
Local SPA at `http://127.0.0.1:4173`; public `/about-kis` route only; desktop/tablet/mobile viewport sweep; no backend mutation.

Result:
PASS; 1 targeted Playwright test. Seven year tabs have `aria-controls="timeline-panel"`; the visible `role=tabpanel` has a stable ID and updates `aria-labelledby` to the selected year. Mouse, Enter and Space activation, reduced-motion behavior, VI/EN/KR footer sweep, console cleanliness and 390 px overflow checks pass.

Relevant Finding IDs:
`UX-006`, `PERF-006`.

Before:
Timeline tabs exposed `aria-selected` and roving tabindex, but no `aria-controls` relationship pointed to the visible panel; the role was attached to an inner element recreated on each update.

After:
The stable timeline content container owns the tabpanel role/ID/focus target, every tab references it, and the panel label follows the active year during in-place updates.

Remaining limitation:
This verifies the public About timeline only. Other authenticated tabsets and modal focus behaviors still require the broader accessibility route sweep.

## Public Home Performance Checkpoint

Command:
`npx --no-install lighthouse http://127.0.0.1:4173/ --only-categories=performance --output=json ...` for mobile and `--preset=desktop`; Chrome DevTools `performance_start_trace` at `390x844`, Fast 4G, 4x CPU; `npm run build`; `npm run check:bundle-budget`.

Environment:
Local SPA only at `http://127.0.0.1:4173`; Node `v26.4.0`; Chrome/Lighthouse `13.4.1`; no production request or deployment.

Result:
PASS. Final Lighthouse mobile: score `100`, FCP `1,282 ms`, LCP `1,732 ms`, CLS `0`, TBT `0`, Speed Index `1,282 ms`, total transfer `201,778 B`. Final desktop checkpoint: score `100`, FCP `388 ms`, LCP `468 ms`, CLS `0`, TBT `0`, Speed Index `949 ms`, total transfer `199,725 B`. Chrome DevTools mobile Fast 4G/4x CPU trace: LCP `1,446 ms`, CLS `0.00`. Lighthouse reports zero unsized-image items.

Relevant Finding IDs:
`PERF-001`, `PERF-002`, `PERF-003`, `PERF-004`, `PERF-005`, `PERF-006`, `ARCH-004`, `OPS-003`.

Before:
Local Lighthouse mobile score `56`, FCP `10,412 ms`, LCP `12,000 ms`, total transfer `1,838,242 B`, JS `1,161,554 B`, CSS `383,461 B`, image `159,415 B`, font `127,562 B`. Desktop score `72`, FCP `2,305 ms`, LCP `2,636 ms`, CLS `0.0083`, total transfer `1,838,013 B`. The first DevTools mobile trace recorded LCP `2,905 ms`, CLS `0.3414`, a `2,623 ms` LCP image discovery delay, and `164 ms` forced reflow.

After:
The home route loads a dedicated public chunk instead of `app.js`: JS `14,475 B`, CSS `10,757 B`, images `137,379 B`, fonts `33,040 B`. Network trace contains only `style-loader.js`, `bootstrap.js`, `home.js`, and `home.css`; XLSX, QR, mock database, employee and admin services are absent. Largest transferred assets are `hoiso.webp` `70,485 B`, leadership card `21,586 B`, communication card `18,294 B`, and mobile LCP banner `14,404 B`. Build budgets enforce public JS <= `250 KB`, public CSS <= `100 KB`, and mobile LCP image <= `200 KB`.

Remaining limitation:
Results are local lab measurements, not production field data. `/login`, learner and admin routes still use the legacy monolith; production CDN compression/cache headers and authenticated-route payloads remain to be measured. The full artifact remains approximately `5.8 MB` because it still contains lazy authenticated/admin assets including XLSX.

## Login And Public Privacy Checkpoint

Command:
`npm run test:unit`; `npm run test:e2e:public`; Chrome DevTools DOM/accessibility inspection at `390x844`; `npm run build`; `node scripts/scan-static-artifact.mjs dist`.

Environment:
Local SPA and source-contract tests only; no production account or auth mutation.

Result:
PASS. Unit suite has `28` passing tests; public Playwright has `5` passing tests. Login runtime exposes `method=post`, the auth action, required email/password inputs, `autocomplete=email/current-password`, associated live error nodes, no literal `cannotLogin`, no horizontal overflow, and no console error. VI/EN/KR home route sweep shows no raw key or `undefined` text. Native validation blocks an empty form and an intercepted HTML API fallback renders a localized system alert without navigating or throwing.

Relevant Finding IDs:
`SEC-003`, `UX-002`, `UX-005`, `PERF-006`, `ARCH-005`.

Before:
`uiText("cannotLogin")` returned the raw key; login inputs had ARIA-required without native `required`; non-JSON auth responses were silently converted to an empty object; the public footer exposed an individual employee name and direct company email.

After:
The missing copy exists in VI/EN/KR, native form and password-manager semantics are present, HTML/non-JSON auth responses receive a safe user-facing system error, redirect fallback remains closed to `/login`, and public support copy is role-based without a personal email address. The artifact scanner has a regression rule for personal company email patterns.

Remaining limitation:
A failed-login server contract test still requires an ephemeral Worker/API runtime. The broader authenticated accessibility/tab/tabpanel sweep is not complete.

## Auth Route Split And Performance Checkpoint

Command:
`node --check src/features/auth/login.js`; `npm run test:unit`; `npm run build`; `npm run test:e2e:public`; Chrome DevTools performance trace at `390x844`, Fast 4G and 4x CPU; `npx --no-install lighthouse http://127.0.0.1:4173/login --only-categories=performance ...`; `npm run test:security`; `npm audit --audit-level=high`.

Environment:
Local static build at `http://127.0.0.1:4173`; synthetic/intercepted login inputs only; no production account, API mutation, deploy or database change.

Result:
PASS for syntax, 28 unit tests, 19 security tests, build/privacy/bundle gates, and 7 public Playwright tests. Chrome DevTools observed login LCP `948 ms` and CLS `0.00` under Fast 4G/4x CPU. Lighthouse mobile score is `100`, FCP `1,284 ms`, LCP `1,659 ms`, CLS `0`, TBT `0`, Speed Index `1,284 ms`, and total transfer `81,224 B`. The login network contains only the document, style/bootstrap loaders, auth JS/CSS, logo and two local font files; it does not contain `app.js`, `styles.css`, XLSX, QR, employee/admin modules, or the desktop office background at 390 px.

Relevant Finding IDs:
`PERF-005`, `PERF-006`, `UX-002`, `UX-004`, `UX-005`, `ARCH-004`, `ARCH-005`.

Before:
`/login` loaded the shared `app.js` monolith and global CSS. The unfinished auth split initially had a JavaScript syntax error and did not preserve the legacy automation selectors or modal focus restoration.

After:
`/login` has a dedicated route module and stylesheet, preserves `#loginForm/#loginEmail/#loginPassword/#loginSubmitBtn`, handles non-JSON responses, maintains the internal redirect allowlist, provides modal Tab trapping/Escape/focus restoration, and explains the requested protected destination. Private deep links call the signed read-only session probe before loading `app.js`; anonymous/invalid probes fail closed to `/login?returnTo=...`. Mobile delivery is approximately 81.2 KB and does not request the desktop background.

Remaining limitation:
`PERF-005` remains `IN_PROGRESS` because learner/admin/authoring/reporting routes still load the monolith. Real cookie-backed staging navigation remains part of `SEC-005` verification even though the `UX-004` redirect contract is locally verified. The later `NEW-SEC-001` checkpoint replaced the vulnerable SheetJS runtime and the current `npm audit` result is 0 vulnerabilities.

## Route Split, Navigation And Authenticated UI Checkpoint

Command:
`npm run test:unit`; `npm run test:e2e:public`; `npm run test:e2e:authenticated`; `PLAYWRIGHT_SUITE=authenticated-readonly npx playwright test --repeat-each=5`; targeted `e2e/about-kis-ui-polish.spec.js`; `npm run build`; `npm run measure:route-bundles`.

Environment:
Local SPA only; Chrome at 390x844 for route measurements; synthetic intercepted session/API payloads; no production account, request mutation or deploy.

Dataset:
Two synthetic learner courses/enrollments, one synthetic notification, one synthetic admin overview and report payload.

Finding IDs:
`PERF-005`, `UX-001`, `UX-006`, authenticated i18n/accessibility scope.

Expected:
Split routes must exclude `app.js`, global CSS, mock DB, XLSX and QR; navigation must be role-aware and keyboard accessible; About timeline and VI/EN/KR footer contracts must remain stable.

Actual:
Unit `38/38`, public E2E `8/8`, authenticated E2E `4/4`, and the expanded authenticated suite `20/20` under repeat-each=5. Targeted About UI test passes after the standalone extraction. Current bundle evidence: About 26,626 B JS/17,843 B CSS; learner dashboard 132,892 B/15,152 B; learner courses 129,421 B/15,152 B; admin dashboard 133,546 B/12,274 B; reports 142,959 B/12,583 B. Initial XLSX/QR are absent on every measured route.

Pass/Fail:
PASS for implemented split routes and `UX-001`; `PERF-005` remains `IN_PROGRESS` because the matrix identifies remaining monolith routes.

Artifacts:
`docs/audit-remediation/evidence/route-bundles.json`, `ROUTE_BUNDLE_MATRIX.md`, `NAVIGATION_COVERAGE.md`.

Remaining limitation:
Course player, quizzes, employee/course authoring, live training, scanner and most legacy authenticated routes still require route boundaries and broader axe/manual keyboard coverage.

## Public Lighthouse Regression Median

Command:
Three mobile Lighthouse performance runs each for `http://127.0.0.1:4173/` and `/login`, Chrome headless, JSON output in uncommitted `/tmp` files.

Environment:
Local SPA, Lighthouse `13.4.1`; no production traffic.

Finding IDs:
`PERF-001`, `PERF-003`, `PERF-004`, `PERF-005`, regression gate.

Expected:
Home/Login remain close to their verified score/LCP/transfer baselines; report median rather than selecting the best run.

Actual:
Home runs: score `99/99/76`, LCP `1.739/1.851/2.287 s`, transfer `203,763 B`, CLS `0`; median score `99`, LCP `1.851 s`, TBT `16.7 ms`. The third run had a local CPU/TBT outlier (`986.9 ms`). Login runs: score `100/100/100`, LCP `1.634/1.514/1.659 s`, transfer `83,209 B`, CLS/TBT `0`; median LCP `1.634 s`.

Pass/Fail:
PASS with documented local variation. Home median LCP is about 6.9% above 1.732 s and transfer about 1% above 201,778 B; Login median improves slightly versus 1.659 s and remains lightweight.

Artifacts:
Uncommitted `/tmp/kis-lh-home-*.json` and `/tmp/kis-lh-login-*.json`; summarized here only.

Remaining limitation:
These remain local lab measurements without production field/CDN evidence.

## Synthetic Employee And Report Load Checkpoint

Command:
`npm run test:load:ephemeral`; post-run SQL count verification.

Environment:
Isolated local Supabase/PostgreSQL `17.6.1.136` container `supabase_db_kis-lms-worker-supabase.tzteKG`; no Worker HTTP layer, staging or production.

Dataset:
100,000 synthetic profiles, 100 courses, 30,000 enrollments, 20,000 learning records, 30,000 notifications and 50,000 audit logs. All IDs used `load-*`; emails used `example.invalid`.

Finding IDs:
`PERF-007`, `OPS-004`.

Expected:
Bounded database-side pages/filters, query-plan evidence, p50/p95/p99, concurrent large-report behavior, payload estimate, cleanup and no production data.

Actual:
First-page p95 20.94 ms; deep offset p95 70.89 ms; leading-wildcard search p95 298.83 ms; indexed department/status filter p95 5.28 ms; large report p95 512.72 ms. Eight concurrent large reports had p95 1,987 ms and 0% errors. First-page payload estimate is 11,338 B; full 100k export is 21,173,895 B. Search/ordering/report plans include sequential scans. Post-run counts are zero for every `load-*` model.

Pass/Fail:
PASS as diagnostic evidence; findings remain `IN_PROGRESS` because keyset pagination, search/order indexes, bounded/async export and Worker HTTP load are not implemented.

Artifacts:
`docs/audit-remediation/evidence/load-test-results.json`, `LOAD_TEST_RESULTS.md`.

Remaining limitation:
SQL timing excludes Worker execution, PostgREST serialization, network transfer and browser rendering; the memory figure is container-level rather than per-query allocation.

## Schema Normalization Contract Checkpoint

Command:
`npm run test:unit`; static/dynamic table-name inventory with `rg` across Worker, legacy API, migrations and tests.

Environment:
Repository contract analysis plus isolated catalog evidence; no schema mutation.

Dataset:
Duplicate model groups for content, questions, assignments, progress and learning history; legacy role values.

Finding IDs:
`ARCH-007`.

Expected:
Every duplicate model must have an owner, canonical target, reader/writer evidence, risk and non-destructive migration/rollback decision.

Actual:
The machine-readable contract covers all required models; unit tests ensure current Worker writers use canonical tables and do not begin writing legacy duplicates. `course_content`, `quiz_questions` plus version rows, `enrollments`, `content_progress` and `learning_records` are the current targets. `trainer`, `manager` and `superAdmin` remain unresolved legacy values and are not accepted by the browser session bootstrap.

Pass/Fail:
PASS for preparation/contracts; `ARCH-007` remains `IN_PROGRESS` pending reconciliation queries, clean history replay and staging parity.

Artifacts:
`SCHEMA_NORMALIZATION_PLAN.md`, `schema-normalization-contract.json`, `tests/unit/schema-normalization-contract.test.mjs`.

Remaining limitation:
No table was copied, renamed, merged or dropped, and no schema finding is marked verified from planning evidence alone.
