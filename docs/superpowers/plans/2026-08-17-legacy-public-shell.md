# Legacy KIS Public Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the exact legacy KIS landing, About KIS, and login UI around the current Supabase-backed Frappe LMS without regressing authenticated Employee or HR flows.

**Architecture:** Port only the public source from commit `1fe33aa6fcce` into isolated Vue components under `frontend/src/legacy-public/`. Keep current protected LMS routes and Supabase services, add explicit public/protected route metadata, and conditionally render the Frappe shell only for protected routes.

**Tech Stack:** Vue 3.5, Vue Router 4.6, Pinia 2, Supabase JS 2.108.2, Vite 5, Vitest 4, Cloudflare Pages.

**Spec:** `docs/superpowers/specs/2026-08-17-legacy-public-shell-design.md`

## Global Constraints

- Production remains `https://kislms.site` on Cloudflare Pages project `kislms-frappe`.
- Reuse public source and assets from commit `1fe33aa6fcce`; do not recreate or generate replacements.
- Keep `/courses`, `/courses/:id`, `/courses/:courseId/lessons/:lessonId`, and `/admin` unchanged.
- Do not restore legacy dashboard, course player, admin, Worker auth, API client, stores, or password hashes.
- Supabase Auth remains the only login/session provider.
- Never print or persist the supplied password, cookies, access tokens, refresh tokens, or service-role credentials.
- Public CSS must not affect the authenticated Frappe-derived shell.
- Deploy preview before production; production is PASS only after direct desktop/mobile browser verification.

---

### Task 1: Add route-policy tests and helpers

**Files:**
- Create: `frontend/src/routing/policy.js`
- Create: `frontend/src/routing/policy.test.js`
- Modify: `frontend/src/router.js`

**Interfaces:**
- Produces: `safeProtectedDestination(value: unknown): string`
- Produces: `homeForSession(store): string`
- Consumes: `useSessionStore()` with `session` and `isHr`

- [ ] **Step 1: Write failing route-policy tests**

```js
import { describe, expect, it } from 'vitest'
import { safeProtectedDestination } from './policy'

describe('safeProtectedDestination', () => {
  it.each(['/courses', '/courses/course-1', '/courses/course-1/lessons/lesson-1', '/admin'])(
    'accepts known protected path %s',
    (path) => expect(safeProtectedDestination(path)).toBe(path),
  )

  it.each(['https://evil.example', '//evil.example', '/', '/login', '/about-kis', '/unknown'])(
    'falls back for unsafe destination %s',
    (path) => expect(safeProtectedDestination(path)).toBe('/courses'),
  )
})
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `cd frontend && npm test -- --run src/routing/policy.test.js`

Expected: FAIL because `src/routing/policy.js` does not exist.

- [ ] **Step 3: Implement the minimal route policy**

```js
const protectedPatterns = [
  /^\/courses$/,
  /^\/courses\/[^/]+$/,
  /^\/courses\/[^/]+\/lessons\/[^/]+$/,
  /^\/admin$/,
]

export function safeProtectedDestination(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return '/courses'
  const path = value.split(/[?#]/, 1)[0]
  return protectedPatterns.some((pattern) => pattern.test(path)) ? value : '/courses'
}
```

- [ ] **Step 4: Add route metadata and guards**

Configure `/`, `/about-kis`, `/login` with `meta.public = true`, add `/about` as a redirect, keep existing protected paths unchanged, and route guest access through `safeProtectedDestination(to.fullPath)`. Preserve HR-only protection for `/admin` and redirect authenticated `/login` visits to `/courses`.

- [ ] **Step 5: Run route-policy tests**

Run: `cd frontend && npm test -- --run src/routing/policy.test.js`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/routing frontend/src/router.js
git commit -m "test: define public and protected route policy"
```

### Task 2: Restore the exact legacy public assets

**Files:**
- Create: `frontend/public/legacy-public/assets/kis-logo-horizontal.png`
- Create: `frontend/public/legacy-public/assets/kis-logo-white.png`
- Create: `frontend/public/legacy-public/images/mykis-learning-banner-desktop.png`
- Create: `frontend/public/legacy-public/images/mykis-learning-banner-desktop.webp`
- Create: `frontend/public/legacy-public/images/mykis-learning-banner-mobile.png`
- Create: `frontend/public/legacy-public/images/mykis-learning-banner-mobile.webp`
- Create: `frontend/public/legacy-public/images/hoiso.webp`
- Create: `frontend/public/legacy-public/images/kis-head-office.webp`
- Create: `frontend/public/legacy-public/images/about/about-kis.webp`
- Create: `frontend/public/legacy-public/images/about/global-network.webp`
- Create: `frontend/public/legacy-public/images/about/leader-cho-hun-hee.jpg`
- Create: `frontend/public/legacy-public/images/about/leader-choi-eun-suk.jpg`
- Create: `frontend/public/legacy-public/images/about/leader-shin-hyun-jae.jpg`
- Create: `frontend/public/legacy-public/images/about/tgd.jpeg`
- Create: `frontend/public/legacy-public/images/timeline/2015.jpeg`
- Create: `frontend/public/legacy-public/images/timeline/2016.jpeg`
- Create: `frontend/public/legacy-public/images/timeline/2018.png`
- Create: `frontend/public/legacy-public/images/timeline/2019.jpeg`
- Create: `frontend/public/legacy-public/images/timeline/2020.png`
- Create: `frontend/public/legacy-public/images/timeline/2021.png`
- Create: `frontend/public/legacy-public/images/timeline/2025.jpeg`
- Create: `frontend/public/legacy-public/fonts/be-vietnam-pro-*.woff2`

**Interfaces:**
- Produces: immutable static paths under `/legacy-public/`
- Consumes: blobs from commit `1fe33aa6fcce`

- [ ] **Step 1: Extract only the referenced legacy assets**

Use `git show 1fe33aa6fcce:<path>` to copy the exact tracked blobs. Include only files referenced by landing, About KIS, login, and the shared font stylesheet.

- [ ] **Step 2: Verify blob identity**

Run SHA-256 checks against temporary `git show` output for each copied file and confirm every copied asset matches its source blob.

- [ ] **Step 3: Verify no LMS assets were copied**

Run: `find frontend/public/legacy-public -type f | sort`

Expected: only logos, public photography, banners, About/timeline images, and fonts listed in this task.

- [ ] **Step 4: Commit**

```bash
git add frontend/public/legacy-public
git commit -m "assets: restore legacy KIS public media"
```

### Task 3: Port the legacy public layout and landing page

**Files:**
- Create: `frontend/src/legacy-public/public-copy.js`
- Create: `frontend/src/legacy-public/usePublicLanguage.js`
- Create: `frontend/src/legacy-public/PublicHeader.vue`
- Create: `frontend/src/legacy-public/PublicFooter.vue`
- Create: `frontend/src/legacy-public/LandingView.vue`
- Create: `frontend/src/legacy-public/styles/font.css`
- Create: `frontend/src/legacy-public/styles/home.css`
- Modify: `frontend/src/router.js`

**Interfaces:**
- Produces: `usePublicLanguage()` returning `language`, `setLanguage`, and localized copy
- Produces: `/` route component
- Consumes: assets under `/legacy-public/`

- [ ] **Step 1: Add a language persistence test**

Test that unsupported stored values fall back to `vi` and that selecting `en` or `kr` updates `localStorage` key `mykis-language`.

- [ ] **Step 2: Run the test and confirm failure**

Run: `cd frontend && npm test -- --run src/legacy-public/usePublicLanguage.test.js`

Expected: FAIL because the composable does not exist.

- [ ] **Step 3: Port shared public copy and language state**

Copy the exact `vi`, `en`, and `kr` public strings from legacy `home.js` and `about.js`. Keep language state shared through `localStorage` and update `document.documentElement.lang`.

- [ ] **Step 4: Port header and footer**

Translate the legacy header/footer markup directly into Vue templates. Preserve desktop/mobile login CTAs, active navigation, menu keyboard behavior, language switcher, HR support contact, and internal-use footer text.

- [ ] **Step 5: Port the landing page**

Translate the legacy hero, stats, About banner, final CTA, lazy image behavior, count-up behavior, and reduced-motion support. Change only asset prefixes from `/assets` or `/public/images` to `/legacy-public/...`.

- [ ] **Step 6: Scope the legacy CSS**

Copy legacy font and home styles, replacing global selectors with `.legacy-public-root` descendants where practical. Keep CSS custom properties on `.legacy-public-root`; do not redefine global `.brand`, `.page`, `.main`, `.sidebar`, `.eyebrow`, or `.muted` outside that root.

- [ ] **Step 7: Run tests and build**

Run: `cd frontend && npm test -- --run src/legacy-public/usePublicLanguage.test.js && npm run build`

Expected: PASS and Vite emits the landing chunk/assets.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/legacy-public frontend/src/router.js
git commit -m "feat: restore legacy KIS landing page"
```

### Task 4: Port the legacy About KIS page

**Files:**
- Create: `frontend/src/legacy-public/AboutKisView.vue`
- Create: `frontend/src/legacy-public/styles/about.css`
- Modify: `frontend/src/legacy-public/public-copy.js`
- Modify: `frontend/src/router.js`

**Interfaces:**
- Produces: `/about-kis` view and `/about` redirect
- Consumes: shared public header/footer, language state, About and timeline assets

- [ ] **Step 1: Port exact About KIS content**

Translate the legacy hero, overview, leadership, philosophy, global network, timeline carousel, CEO section, public header, and footer from `src/features/public/about.js` at `1fe33aa6fcce`.

- [ ] **Step 2: Port interactive timeline behavior**

Use Vue state for active year, preserve keyboard-accessible controls and semantic tab/panel relationships, and retain reduced-motion behavior.

- [ ] **Step 3: Scope About styles**

Copy the exact responsive visual rules under `.legacy-about-page` and update only public asset paths. Ensure selectors cannot target authenticated LMS elements.

- [ ] **Step 4: Build and smoke-render both aliases**

Run: `cd frontend && npm run build`

Expected: PASS. Locally verify `/about-kis` renders and `/about` resolves to `/about-kis`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/legacy-public frontend/src/router.js
git commit -m "feat: restore legacy About KIS page"
```

### Task 5: Restore the legacy login presentation with Supabase Auth

**Files:**
- Create: `frontend/src/legacy-public/LoginView.vue`
- Create: `frontend/src/legacy-public/login-error.js`
- Create: `frontend/src/legacy-public/login-error.test.js`
- Create: `frontend/src/legacy-public/login-submit.js`
- Create: `frontend/src/legacy-public/login-submit.test.js`
- Create: `frontend/src/legacy-public/styles/auth.css`
- Modify: `frontend/src/router.js`
- Modify: `frontend/src/stores/session.js`
- Delete: `frontend/src/views/LoginView.vue`

**Interfaces:**
- Consumes: `session.signIn(email, password)` backed by `supabase.auth.signInWithPassword`
- Consumes: `safeProtectedDestination(route.query.next)`
- Produces: `submitLogin({ session, router, destination, email, password })`
- Produces: localized legacy login UI and redirects

- [ ] **Step 1: Write login error mapping tests**

```js
import { describe, expect, it } from 'vitest'
import { loginErrorCode } from './login-error'

describe('loginErrorCode', () => {
  it('maps invalid credentials without exposing backend text', () => {
    expect(loginErrorCode({ message: 'Invalid login credentials' })).toBe('invalid')
  })

  it('maps rate limits', () => {
    expect(loginErrorCode({ status: 429 })).toBe('rate')
  })

  it('uses a generic system error otherwise', () => {
    expect(loginErrorCode(new Error('internal detail'))).toBe('system')
  })
})
```

Add a submission test with mocked collaborators:

```js
import { describe, expect, it, vi } from 'vitest'
import { submitLogin } from './login-submit'

describe('submitLogin', () => {
  it('authenticates through the current session store and redirects', async () => {
    const session = { signIn: vi.fn().mockResolvedValue(undefined) }
    const router = { replace: vi.fn().mockResolvedValue(undefined) }

    await submitLogin({
      session,
      router,
      destination: '/courses/course-1',
      email: 'employee@example.com',
      password: 'not-a-real-secret',
    })

    expect(session.signIn).toHaveBeenCalledWith('employee@example.com', 'not-a-real-secret')
    expect(router.replace).toHaveBeenCalledWith('/courses/course-1')
  })
})
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `cd frontend && npm test -- --run src/legacy-public/login-error.test.js src/legacy-public/login-submit.test.js`

Expected: FAIL because `login-error.js` does not exist.

- [ ] **Step 3: Port the legacy login template**

Preserve the split desktop layout, KIS office background, logo, language switcher, inputs, password visibility button, remember copy, loading state, mobile presentation, accessible error regions, and home link from legacy `login.js`.

- [ ] **Step 4: Replace the action layer**

Implement the tested helper and call it from the component:

```js
export async function submitLogin({ session, router, destination, email, password }) {
  await session.signIn(email, password)
  await router.replace(destination)
}
```

Pass `safeProtectedDestination(route.query.next)` as `destination`. Do not call `/api/auth`, legacy cookies, role selection, or legacy session endpoints.

- [ ] **Step 5: Replace broken support behavior**

Render the localized “Không thể đăng nhập?” action as a `mailto:thanh.ntc@kisvn.vn` link with a localized subject and body. Do not include the typed password or any session data.

- [ ] **Step 6: Port and scope login CSS**

Copy `auth.css` and `auth-visual.css` into a scoped stylesheet rooted at `.legacy-login-page`. Keep viewport-height behavior local to the login view and remove global `html:has(...)`/`body:has(...)` selectors.

- [ ] **Step 7: Run focused tests and build**

Run: `cd frontend && npm test -- --run src/legacy-public/login-error.test.js src/legacy-public/login-submit.test.js src/routing/policy.test.js && npm run build`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/legacy-public frontend/src/router.js frontend/src/stores/session.js frontend/src/views/LoginView.vue
git commit -m "feat: connect legacy login UI to Supabase Auth"
```

### Task 6: Isolate public and authenticated application shells

**Files:**
- Modify: `frontend/src/App.vue`
- Modify: `frontend/src/style.css`
- Create: `frontend/src/routing/shell.test.js`

**Interfaces:**
- Consumes: `route.meta.public`
- Produces: public views without LMS sidebar and protected views with the unchanged Frappe sidebar

- [ ] **Step 1: Write shell classification tests**

Test that `/`, `/about-kis`, and `/login` are public and that `/courses`, lesson routes, and `/admin` are protected.

- [ ] **Step 2: Make `App.vue` route-aware**

Use `useRoute()` and render `<RouterView />` directly for public routes. Render the existing `.app-shell`, sidebar, user block, and `.main` wrapper only for protected routes with a session.

- [ ] **Step 3: Namespace authenticated shared CSS**

Limit Frappe shell selectors such as `.brand`, `.page`, `.eyebrow`, and `.muted` to `.lms-shell` or rename them so they cannot collide with public classes. Do not change their rendered appearance.

- [ ] **Step 4: Run all frontend tests and build**

Run: `cd frontend && npm test && npm run build`

Expected: all Vitest tests PASS and production build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.vue frontend/src/style.css frontend/src/routing/shell.test.js
git commit -m "fix: isolate public and LMS application shells"
```

### Task 7: Add browser regression coverage

**Files:**
- Create: `scripts/e2e-public-shell.mjs`
- Modify: `scripts/e2e-frappe-preview.mjs`
- Modify: `frontend/package.json`

**Interfaces:**
- Consumes: `TARGET_URL`, Keychain-backed Employee/HR test accounts
- Produces: screenshots and a non-zero exit on console, page, HTTP, routing, auth, or responsive failures

- [ ] **Step 1: Add guest public checks**

Cover `/`, `/about-kis`, `/about`, and `/login` at 1440x1000 and 390x844. Assert KIS headings, legacy logo/banner/background assets, header/footer, mobile navigation, HTTP success, and direct refresh.

- [ ] **Step 2: Update authenticated login selectors**

Change preview login automation to use localized accessible names that match the restored login UI. Keep passwords sourced only from Keychain and never print filled values.

- [ ] **Step 3: Add auth guard checks**

Verify guest `/courses` redirects to `/login?next=%2Fcourses`, successful login reaches `/courses`, authenticated `/login` redirects to `/courses`, Employee `/admin` returns to `/courses`, logout reaches `/login`, and relogin succeeds.

- [ ] **Step 4: Keep LMS regression checks**

Retain course enrollment, lesson completion persistence, HR course create/publish, mobile course rendering, console error capture, pageerror capture, and failed response capture.

- [ ] **Step 5: Run against the local production build**

Run the Vite preview or existing SPA fallback server, then execute both browser scripts with `TARGET_URL` set to the local URL.

Expected: guest public PASS; Employee persistence PASS; HR authoring PASS; mobile PASS; console/network PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/e2e-public-shell.mjs scripts/e2e-frappe-preview.mjs frontend/package.json frontend/package-lock.json
git commit -m "test: cover legacy public shell and LMS regression"
```

### Task 8: Verify and grant HR authorization to the requested account

**Files:**
- No repository file changes unless an existing operational evidence document requires a non-secret result entry.

**Interfaces:**
- Consumes: linked production Supabase project `mooqdtiedfamnlpitqtq`
- Produces: active `profiles.role = 'hr'` authorization for `nkhaduy@gmail.com`

- [ ] **Step 1: Discover the supported Supabase command surface**

Run `supabase --help` and the relevant subgroup help. Prefer the authenticated Supabase MCP/API when available; do not guess CLI commands.

- [ ] **Step 2: Inspect the account relationship safely**

Query only the auth user ID and matching profile fields needed to verify linkage: profile ID, `auth_user_id`, normalized email, role, and account status. Do not select password hashes, sessions, tokens, or metadata unrelated to authorization.

- [ ] **Step 3: Apply the minimal authorization update**

Update the matching `public.profiles` row to `role = 'hr'`, `account_status = 'active'`, and the correct `auth_user_id` if linkage is missing and the identity match is unambiguous. Do not alter LMS content or schema.

- [ ] **Step 4: Verify authorization**

Requery the safe profile fields and authenticate through the rendered application using the supplied credentials without logging the password. Confirm `/admin` is accessible and HR authoring policies work.

### Task 9: Run full local quality gates

**Files:**
- Modify only files required to fix failures introduced by this release.

- [ ] **Step 1: Run frontend tests**

Run: `cd frontend && npm test`

Expected: PASS.

- [ ] **Step 2: Run frontend production build**

Run: `cd frontend && npm run build`

Expected: PASS and `dist-frappe/` contains `_redirects` plus built public assets.

- [ ] **Step 3: Run repository checks**

Run: `npm run typecheck && npm run lint`

Expected: PASS within the repository's existing warning threshold.

- [ ] **Step 4: Run local browser regression**

Run public, Employee, HR, mobile, console/network, and SPA-refresh checks against the production build.

- [ ] **Step 5: Review repository diff and build contents**

Run `git diff --check`, inspect `git status --short`, and confirm no secrets, test credentials, legacy LMS modules, or unrelated generated artifacts are staged.

### Task 10: Deploy preview and production

**Files:**
- Modify: `docs/frappe-supabase-production.md`

**Interfaces:**
- Consumes: Cloudflare Pages project `kislms-frappe`
- Produces: verified preview deployment, production deployment, deployed git commit, and rollback record

- [ ] **Step 1: Commit the release candidate**

Commit any final verification/documentation changes. Record the candidate commit SHA.

- [ ] **Step 2: Deploy a Pages preview**

Use the existing authenticated Wrangler/Cloudflare workflow to deploy `dist-frappe` as a preview without changing DNS or custom-domain bindings.

- [ ] **Step 3: Wait for preview readiness and verify**

Run the full guest, Employee, HR, mobile, console/network, and SPA-refresh browser suite against the preview URL. Fix and redeploy if any release-introduced defect appears.

- [ ] **Step 4: Deploy the verified build to production**

Deploy the same build/source commit to the production branch of `kislms-frappe`. Do not attach the legacy Worker or change DNS.

- [ ] **Step 5: Verify the real production domain**

Open `https://kislms.site` in a real browser and repeat public, login, session refresh, logout/relogin, protected-route redirect, Employee catalogue/course/lesson/progress, HR authoring, mobile, console/network, and direct-refresh checks.

- [ ] **Step 6: Record production and rollback evidence**

Update `docs/frappe-supabase-production.md` with the deployed commit, preview/production result, and previous Pages deployment identifier. Rollback method is to promote the previous Pages deployment; Supabase data/schema remains untouched.

- [ ] **Step 7: Commit and push release documentation**

```bash
git add docs/frappe-supabase-production.md
git commit -m "docs: record legacy public shell production release"
git push origin migration/frappe-lms
```
