# Production Post-Deploy Audit

Captured: 2026-08-11T11:53:50+07:00

Production URL: https://kislms.site

Release branch: `release/kislms-employee-account-auth`

Deployed release commit: `1fe33aa6fccea4a2584329b41c6eafdccf83aa9e`

Cloudflare deployment: `09ae3f96-9d71-425b-984b-93d6e2944973`

Cloudflare Worker version: `b7c2c3a2-af8c-4881-834c-a96bd75d8c1c`

## Root cause

- Authenticated sidebar links previously performed document navigation, so the browser requested a new HTML document and replaced the application shell.
- Route bootstrap and feature mounts did not preserve the existing sidebar/topbar while route chunks and API data were loading.
- Authenticated GET data had no bounded fresh-cache reuse, so revisiting Employees issued a second GET and removed ready content before the new result was available.
- Language changes used a hard reload and rapid route completion could publish stale content after a newer click.

## Changes

- `src/app/router.js`: History API navigation, same-origin click interception, Back/Forward, scroll restoration, route-generation race protection, and in-place language rerender.
- `src/app/route-assets.js`: cached route modules/styles plus bounded intent/idle prefetch for primary routes.
- `src/shared/ui/route-shell.js`: persistent shell identity, synchronous active state/title updates, and content-area-only pending state.
- `src/shared/api/client.js`: memory-only GET deduplication, 60-second freshness, stale-while-revalidate, mutation invalidation, and logout/identity cache clearing.
- `e2e/app-like-navigation.spec.js`: regression coverage for document requests, shell identity, API counts, rapid navigation, mobile blank frames, CLS, Back/Forward, and language changes.

## Navigation verification

| Signal | Before | Production after deploy |
| --- | --- | --- |
| Internal document requests | 1 document request on Dashboard -> Employees baseline | 0 across the 6-test app-like suite |
| Employee GETs on revisit | 2 | 1 inside the fresh cache window |
| Shell identity | Sidebar/topbar replaced | Sidebar/topbar retained |
| Blank sampled frames | User-visible white/blank transition reported | 0 in mobile slow-navigation frame sampling |
| CLS during transition | Not captured | `<= 0.01` |
| Session GET during internal route changes | Navigation-blocking validation path | 0 after initial authenticated bootstrap |
| Console/page errors | Not captured | 0 in navigation suite |

The production navigation suite passed `6/6` against the deployed assets at `https://kislms.site`, including synchronous active state, Back/Forward, ten rapid route changes, cache revisit, slow mobile navigation, and language rerender without document reload.

Exact click-to-content-visible timing was not captured in a real authenticated production session. Test duration is not used as a substitute for interaction latency.

## Quality gates and tests

- Protected production gates: `30/30 PASS` for the exact deployed commit.
- Lint: 0 errors, 135 existing warnings under the 139-warning ceiling.
- Typecheck: PASS.
- Unit: `137/137 PASS`.
- Security: `50/50 PASS`.
- Public E2E local gate: `9/9 PASS`.
- Authenticated E2E local gate: `8/8 PASS`.
- Production public read-only: `9/9 PASS`.
- Production authenticated route contracts: `8/8 PASS` using synthetic read-only session/API interception.
- Production app-like navigation: `6/6 PASS` using the deployed frontend with deterministic read-only session/API interception.
- Build, artifact privacy scan, public/route bundle budgets, Wrangler dry-run, migration replay, PostgreSQL 100k benchmark, search/report/export/queue checks, and `npm audit`: PASS.

## Deployment

- Protected plan printed the literal `GO FOR PRODUCTION DEPLOYMENT` inside the active maintenance window.
- Deployment used only `npm run production:deploy-approved` with a fresh mode-0600 runtime and one-time approval token.
- Supabase migration dry-run and apply reported the remote database was already up to date.
- Cloudflare reports deployment `09ae3f96-9d71-425b-984b-93d6e2944973`, version `b7c2c3a2-af8c-4881-834c-a96bd75d8c1c`, at 100% traffic.
- Rollback target is version `3ee65804-17f6-4ef6-9fc3-3946ed7c05b8`.

## Authentication smoke blocker

The Keychain `HR_EMAIL`/`HR_PASSWORD` pair returned `401 INVALID_CREDENTIALS`. Read-only identity resolution confirmed `nkhaduy` is active, unlocked, and has both Employee and HR grants, but the saved password is stale and the account has no password escrow record. No authenticated browser session was available. Testing stopped after observing three failed attempts to avoid account lockout.

No password reset, credential bypass, direct session fabrication, or production account mutation was performed. A real-credential Dashboard -> Employees -> Courses -> Dashboard smoke remains required after the owner refreshes the secure credential or signs in to an available browser session.

## Final decision

The SPA navigation release is deployed and all deterministic production navigation tests pass. The requested end-to-end real-credential production smoke is not complete, so the final status must remain:

`MYKIS APP-LIKE NAVIGATION: AUTH SMOKE BLOCKED`
