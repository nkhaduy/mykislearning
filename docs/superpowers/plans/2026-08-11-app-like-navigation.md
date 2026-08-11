# MyKIS App-Like Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert authenticated MyKIS navigation into a persistent-shell SPA with zero internal document reloads, cached revisits, route prefetch, and regression coverage.

**Architecture:** A long-lived bootstrap router intercepts known same-origin routes and drives feature modules through a persistent shared shell. Route assets and GET data use bounded in-memory caches; authorization remains enforced by the signed server session and API.

**Tech Stack:** Vanilla ES modules, History API, Cloudflare Worker static assets, Node test runner, Playwright, Supabase-backed HTTP APIs.

## Global Constraints

- Header/sidebar/navigation must retain DOM identity during authenticated route changes.
- No authenticated internal click may create a new `document` request.
- Old content stays visible until new route content is ready; loading UI is content-area only.
- Authenticated data cache is memory-only and cleared on logout/identity change.
- Login/logout, HR/Employee RBAC, deep links, refresh, forms, mobile navigation, and API security must remain intact.
- Production deployment must use the protected release pipeline and fresh verification evidence.

---

### Task 1: Navigation Regression Harness

**Files:**
- Create: `e2e/app-like-navigation.spec.js`
- Modify: `playwright.config.js`

**Interfaces:**
- Consumes: existing mocked session/API routes and the real browser document.
- Produces: assertions for document requests, shell identity, active navigation, blank frames, Back/Forward, rapid clicks, mobile, and GET call counts.

- [ ] **Step 1: Write the failing browser test** that opens `/hr`, stores sidebar/topbar nodes in `window`, clicks `/hr/employees`, `/hr/courses`, and `/hr`, and asserts zero additional `document` requests plus stable node identity.
- [ ] **Step 2: Add interaction tests** for immediate active state, rapid route changes, Back/Forward, mobile drawer navigation, and a cached `/hr/employees` revisit with one API request inside the stale window.
- [ ] **Step 3: Run the test against the current implementation** with `PLAYWRIGHT_SUITE=app-like-navigation npx playwright test e2e/app-like-navigation.spec.js` and verify it fails because a sidebar click creates a new document and replaces the shell.
- [ ] **Step 4: Commit the red test** with `git add e2e/app-like-navigation.spec.js playwright.config.js && git commit -m "test: capture app-like navigation regressions"`.

### Task 2: Persistent Router And Shell

**Files:**
- Create: `src/app/router.js`
- Modify: `src/app/bootstrap.js`
- Modify: `src/shared/ui/route-shell.js`
- Modify: `src/shared/i18n/runtime.js`
- Test: `e2e/app-like-navigation.spec.js`

**Interfaces:**
- Produces: `startRouter()`, `navigate(path, options)`, `rerenderCurrentRoute()`, `registerNavigationGuard()`, and persistent shell transition methods.
- Consumes: `matchRoute()`, split-entry loaders, validated session state, and feature `mount()` functions.

- [ ] **Step 1: Implement same-origin click interception** that ignores external URLs, modifiers, downloads, non-left clicks, `_blank`, hashes on the current document, and prevented events.
- [ ] **Step 2: Implement history navigation** with generation tokens, `pushState`, `replaceState`, `popstate`, scroll capture/restoration, role authorization, and safe redirects.
- [ ] **Step 3: Reuse compatible shell DOM** in `createRouteShell()`, update title/eyebrow/active link synchronously, keep old outlet content during pending work, and replace only the outlet after mount.
- [ ] **Step 4: Replace language hard reload** with `rerenderCurrentRoute()` after saving the selected language.
- [ ] **Step 5: Run the focused E2E test** and verify document requests are zero and shell identity is stable.
- [ ] **Step 6: Commit** with `git add src/app/router.js src/app/bootstrap.js src/shared/ui/route-shell.js src/shared/i18n/runtime.js e2e/app-like-navigation.spec.js && git commit -m "feat: add persistent authenticated router"`.

### Task 3: Route Styles And Prefetch

**Files:**
- Create: `src/app/route-assets.js`
- Modify: `src/app/bootstrap.js`
- Modify: `src/app/style-loader.js`
- Modify: `src/shared/ui/route-shell.js`
- Test: `tests/unit/performance-delivery.test.mjs`
- Test: `e2e/app-like-navigation.spec.js`

**Interfaces:**
- Produces: `loadRouteModule(route)`, `ensureRouteStyles(route)`, `prefetchRoute(path)`, and `prefetchPrimaryRoutes(role)`.
- Consumes: route registry `splitEntry` values and the existing feature CSS paths.

- [ ] **Step 1: Add failing behavior assertions** proving navigation waits for route CSS without removing the existing shell and intent prefetch requests a route chunk only once.
- [ ] **Step 2: Move split-entry imports and CSS metadata** into `route-assets.js`; cache module promises and stylesheet promises.
- [ ] **Step 3: Add pointer/focus intent prefetch** for visible navigation links and idle prefetch for the bounded HR/Employee primary route lists.
- [ ] **Step 4: Keep initial document CSS behavior compatible** while removing `document.write` from subsequent route transitions.
- [ ] **Step 5: Run route bundle budgets, unit tests, and focused E2E**.
- [ ] **Step 6: Commit** with `git add src/app/route-assets.js src/app/bootstrap.js src/app/style-loader.js src/shared/ui/route-shell.js tests/unit/performance-delivery.test.mjs e2e/app-like-navigation.spec.js && git commit -m "perf: prefetch route chunks and styles"`.

### Task 4: Session And Stale-While-Revalidate Data Cache

**Files:**
- Modify: `src/shared/api/client.js`
- Modify: `src/app/bootstrap.js`
- Modify: mutation-capable feature modules under `src/features/`
- Create: `tests/unit/api-cache.test.mjs`
- Test: `e2e/app-like-navigation.spec.js`

**Interfaces:**
- Produces: `apiJson(path, options)`, `invalidateApiCache(match)`, `clearApiCache()`, request deduplication, and stale-while-revalidate GET behavior.
- Consumes: cookie-authenticated fetch and the existing single-flight refresh mechanism.

- [ ] **Step 1: Write failing unit tests** for concurrent GET deduplication, fresh cache hits, stale cached return with background refresh, mutation invalidation, and cache clearing.
- [ ] **Step 2: Implement a memory-only cache** with a 60-second default stale time and no caching for non-GET, `no-store`, error, or file responses.
- [ ] **Step 3: Keep session metadata in bootstrap memory** and revalidate in the background rather than probing `/session` per route.
- [ ] **Step 4: Invalidate affected keys after create/update/delete operations** and clear all cached data after logout or identity change.
- [ ] **Step 5: Run unit and navigation E2E tests** and verify a route revisit uses cached data without duplicate API requests.
- [ ] **Step 6: Commit** with `git add src/shared/api/client.js src/app/bootstrap.js src/features tests/unit/api-cache.test.mjs e2e/app-like-navigation.spec.js && git commit -m "perf: cache authenticated route data"`.

### Task 5: Loading, Race, And Layout Stability

**Files:**
- Modify: `src/shared/ui/route-shell.js`
- Modify: `src/shared/ui/route-shell.css`
- Modify: route modules that clear content before requests
- Test: `e2e/app-like-navigation.spec.js`

**Interfaces:**
- Produces: content-area pending state, stale-navigation suppression, and stable skeleton dimensions.
- Consumes: router generation tokens and persistent content outlet.

- [ ] **Step 1: Add failing slow-network and rapid-navigation tests** that sample every animation frame and reject missing shell/content, stale route overwrite, CLS above 0.01, console errors, and unhandled rejections.
- [ ] **Step 2: Add a lightweight pending indicator** that does not reduce content opacity below 1 or replace the shell/content with a fullscreen loader.
- [ ] **Step 3: Ensure feature mounts publish only current-generation content** and preserve previous content until valid replacement HTML exists.
- [ ] **Step 4: Match skeleton/min-height geometry** to major HR and employee route layouts and honor reduced motion.
- [ ] **Step 5: Run desktop/mobile/slow-network/rapid navigation tests**.
- [ ] **Step 6: Commit** with `git add src/shared/ui/route-shell.js src/shared/ui/route-shell.css src/features e2e/app-like-navigation.spec.js && git commit -m "fix: eliminate blank route transitions"`.

### Task 6: Full Verification And Production Release

**Files:**
- Modify: `docs/audit-remediation/PRODUCTION_POST_DEPLOY_AUDIT.md`
- Create: navigation evidence under `docs/audit-remediation/evidence/`

**Interfaces:**
- Consumes: protected production runtime, release approval artifacts, Cloudflare deployment metadata, and production browser credentials from macOS Keychain.
- Produces: exact commit SHA, deployment/version IDs, before/after navigation metrics, and production smoke evidence.

- [ ] **Step 1: Run local gates**: `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:security`, `npm run build`, `npm run check:bundle-budget`, `npm run check:route-bundle-budget`, `npm run test:e2e:public`, `npm run test:e2e:authenticated`, and the app-like navigation suite.
- [ ] **Step 2: Run `git diff --check`, `npm audit --audit-level=high`, and Cloudflare dry-run validation**.
- [ ] **Step 3: Commit the verified release** and push the release branch without force.
- [ ] **Step 4: Refresh the protected production runtime/manifest/approval evidence** for the exact commit and maintenance window, then run the protected deployment plan and apply command.
- [ ] **Step 5: Run production browser automation** for HR Dashboard -> Employees -> Courses -> Dashboard, 10 rapid tabs, Back/Forward, direct deep URL, desktop, mobile, and throttled network; capture document requests, shell identity, blank frames, API counts, CLS, console errors, and timings.
- [ ] **Step 6: Record deployment ID/version and final evidence**; report PASS only when production satisfies every navigation acceptance criterion.

