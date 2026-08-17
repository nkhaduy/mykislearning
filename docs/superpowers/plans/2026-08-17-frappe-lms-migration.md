# Frappe LMS Frontend on Supabase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the official Frappe Learning Vue UI at `kislms.site` with Supabase Auth, PostgreSQL, Storage, and RLS replacing the native Frappe backend.

**Architecture:** Pin upstream as a submodule, preserve its Vue/Frappe UI pages, and route its resource contracts through a KIS compatibility adapter. Use additive Supabase migrations and Cloudflare static SPA hosting.

**Tech Stack:** Vue 3, Frappe UI, Vite, TypeScript, Vitest, Supabase JS/PostgreSQL/Auth/Storage, Playwright, Cloudflare Workers assets.

**Spec:** `docs/superpowers/specs/2026-08-17-frappe-lms-migration-design.md`

## Global Constraints

- Pin Frappe Learning to `d3bfe97d178eb076310dffd7407106bcdec15d67` (`v2.61.0`).
- Do not deploy Frappe Framework, MariaDB, Redis, workers, scheduler, websocket backend, Docker Frappe, OCI VM, or Frappe Cloud.
- Keep Supabase service-role credentials out of browser bundles and git.
- Preserve upstream UI and AGPL notices; direct upstream patches stay minimal and documented.
- Defer KIS-specific and advanced upstream features until the core Employee and HR flows pass.

---

### Task 1: Pin and build upstream frontend

**Files:** `.gitmodules`, `upstream/frappe-lms`, `frontend/package.json`, `frontend/vite.config.ts`, `frontend/src/main.ts`, `tests/upstream.test.ts`

**Interfaces:** Produces a standalone Vite entry that imports upstream `App.vue`, router, CSS, and Frappe UI at the pinned commit.

- [ ] Write a failing test that asserts the submodule commit, upstream license, Vue entry, and absence of native Frappe runtime imports from the KIS entry.
- [ ] Run the focused test and confirm it fails before the standalone entry exists.
- [ ] Add the pinned submodule and minimal wrapper build.
- [ ] Run Vitest and `npm run build` until both pass.
- [ ] Commit the upstream baseline and build wrapper.

### Task 2: Supabase schema and RLS

**Files:** `supabase/migrations/*_frappe_lms_core.sql`, `tests/database/frappe_lms_rls.test.ts`

**Interfaces:** Produces tables/views/RPCs for profiles, courses, chapters, lessons, enrollments, lesson progress, role checks, ordering, and atomic completion.

- [ ] Write database tests proving Employee ownership boundaries and HR authoring permissions.
- [ ] Run tests against local Supabase and observe missing-table/policy failures.
- [ ] Add an idempotent additive migration, explicit grants, RLS, indexes, triggers, and atomic progress RPC.
- [ ] Run database tests and Supabase advisors; fix every security finding in scope.
- [ ] Commit schema and RLS.

### Task 3: Auth and resource compatibility core

**Files:** `frontend/src/data/client.ts`, `frontend/src/data/auth.ts`, `frontend/src/data/resource-fetcher.ts`, `frontend/src/data/types.ts`, `frontend/src/stores/session.ts`, `frontend/src/router.ts`, `frontend/src/data/*.test.ts`

**Interfaces:** Produces `resourceFetcher(options): Promise<unknown>`, `login(email,password)`, `logout()`, `getSession()`, and protected/HR route guards.

- [ ] Write failing tests for login persistence, refresh, expiry redirect, role guard, and Frappe response unwrapping.
- [ ] Confirm failures are caused by missing adapter behavior.
- [ ] Implement the minimal Supabase-backed session and resource dispatcher.
- [ ] Run focused and full unit tests.
- [ ] Commit auth and compatibility core.

### Task 4: Catalogue, course, lesson, enrollment, and progress adapters

**Files:** `frontend/src/data/courses.ts`, `frontend/src/data/lessons.ts`, `frontend/src/data/progress.ts`, `frontend/src/data/frappe-shapes.ts`, related tests

**Interfaces:** Produces Frappe-shaped course lists/details, ordered outlines, lesson content, enrollment state, and atomic persisted completion percentage.

- [ ] Write failing contract tests using literal upstream-shaped fixtures.
- [ ] Verify failures for missing queries/mappers.
- [ ] Implement Supabase queries and compatibility mappers without changing upstream card/player markup.
- [ ] Run tests including concurrent/repeated progress upserts.
- [ ] Commit learner data adapters.

### Task 5: Profile, HR authoring, and Storage

**Files:** `frontend/src/data/profile.ts`, `frontend/src/data/admin.ts`, `frontend/src/data/storage.ts`, adapter tests, storage policy migration

**Interfaces:** Produces profile reads/updates, course/chapter/lesson CRUD/reorder/publish, instructor assignment, and safe media upload URLs.

- [ ] Write failing tests for HR-only writes, ordering, publish visibility, upload type/size/path validation, and Employee denial.
- [ ] Implement minimal adapters and Storage policies.
- [ ] Run unit, database, and negative authorization tests.
- [ ] Wire upstream editor resources to these adapter methods with the smallest patch set.
- [ ] Commit HR and Storage support.

### Task 6: Legacy migration and reconciliation

**Files:** `scripts/migrate-frappe-supabase.mjs`, `tests/migration/frappe-supabase.test.ts`, `docs/frappe-data-migration.md`

**Interfaces:** Produces a dry-run/default idempotent migration for users, courses, lessons, enrollments, progress, and media plus count/unmapped reports.

- [ ] Write failing tests for stable IDs, rerun idempotency, missing foreign keys, and non-destructive dry run.
- [ ] Implement normalization and upsert batches using legacy tables as source.
- [ ] Run twice against staging/local data and compare counts.
- [ ] Back up production, apply the reviewed migration, and record reconciliation without secrets.
- [ ] Commit migration tooling and evidence.

### Task 7: Production E2E, visual regression, and cutover

**Files:** `e2e/frappe-supabase-employee.spec.ts`, `e2e/frappe-supabase-hr.spec.ts`, `e2e/frappe-supabase-security.spec.ts`, `wrangler.jsonc`, `docs/frappe-ui-upstream.md`, `docs/frappe-lms-gap-analysis.md`

**Interfaces:** Produces a deployed Cloudflare SPA and production evidence for Employee, HR, security, desktop, mobile, console, and network health.

- [ ] Capture upstream reference screenshots and write failing Employee/HR/security journeys against the pre-cutover site.
- [ ] Build, deploy, wait for readiness, and run tests on a staging/preview URL.
- [ ] Apply production Supabase migration only after backup and staging PASS.
- [ ] Deploy to `kislms.site`, verify desktop/mobile authenticated flows, console, network, refresh, and persistence.
- [ ] Record deployed commit, retire legacy UI routes from the active deployment, and commit final evidence.
