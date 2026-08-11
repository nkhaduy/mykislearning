# MyKIS App-Like Navigation Design

## Objective

Make authenticated navigation on `kislms.site` behave like a persistent-shell SPA: URL and active navigation update immediately, no document reload occurs, the sidebar/topbar keep their DOM identity, and route data is served from memory cache before background revalidation.

## Verified Root Cause

The deployed modular frontend is route-split but not a client-side router. `src/app/bootstrap.js` evaluates one pathname per document, probes `/api/auth?action=session`, dynamically imports one feature, and exits. Every sidebar link in `src/shared/ui/route-shell.js` is a normal anchor, so the browser requests a new HTML document. Every feature then calls `createRouteShell()`, which assigns `app.innerHTML` and reconstructs the sidebar, topbar, live region, and content area. Route-specific CSS is selected at parse time by `src/app/style-loader.js`, so a newly requested document must discover CSS and JavaScript again. Feature mounts also await route APIs before replacing the initial loader, and GET responses are not cached across route visits.

This creates four user-visible delays in series:

1. document navigation and HTML response;
2. route CSS and module discovery;
3. blocking session validation;
4. route API fetch and full shell reconstruction.

## Selected Architecture

### 1. Single Runtime Router

`src/app/bootstrap.js` becomes a long-lived runtime. It owns `navigate()`, `renderRoute()`, same-origin click interception, `popstate`, route generation tokens, and scroll restoration. It uses `history.pushState`/`replaceState`; it never calls document navigation for a known same-role authenticated route.

The router keeps public/auth cross-boundary redirects conservative. Logout, expired sessions, unsafe URLs, external links, downloads, modifier-clicks, and explicit new-tab links retain native browser behavior.

### 2. Persistent App Shell

`createRouteShell()` creates the shell only when no compatible shell exists. For navigation within the same authenticated role it reuses the existing `.route-shell`, `.route-sidebar`, and `.route-topbar`, updates title/active navigation synchronously, and hands feature modules the existing content outlet.

The old content remains visible while a route module, stylesheet, or initial data request is pending. A non-blocking `aria-busy` state and content-area progress indicator communicate the transition. Only after the new feature has valid content does `setContent()` replace the outlet. A navigation generation check prevents a slow previous route from overwriting a newer route after rapid clicks.

### 3. Route Assets And Prefetch

Move route-to-module and route-to-stylesheet metadata into an importable runtime map. `ensureRouteStyles()` loads missing CSS through `<link rel="stylesheet">` and resolves only after it is ready. The current page keeps its old content during this wait, eliminating CSS flash.

After the first authenticated paint, idle prefetch warms only high-value role routes:

- HR: `/hr`, `/hr/employees`, `/hr/courses`, `/hr/reports`;
- Employee: `/dashboard`, `/dashboard/courses`, `/dashboard/calendar`.

Pointer/focus intent prefetch warms any visible navigation target. Prefetch loads route JS/CSS only; it does not fetch user data.

### 4. Session And Data Cache

Keep the validated session in memory for the document lifetime. Navigation reuses it and schedules non-blocking revalidation before expiry. A failed sensitive API request still uses the existing single-flight refresh path and redirects to login only when refresh fails.

Extend the shared API client with a memory-only GET cache:

- in-flight request deduplication;
- default `staleTime` of 60 seconds;
- cached value returned immediately while stale data revalidates in the background;
- explicit invalidation after mutations;
- complete cache clearing on logout or identity change.

No authenticated response is persisted to localStorage, Cache Storage, or a service worker.

### 5. Navigation UX

- Active sidebar state and URL update in the click task.
- Existing content remains mounted until replacement content is ready.
- Skeletons/loaders stay inside `[data-route-content]`; no fullscreen spinner is introduced.
- Back/Forward uses the same router and cached modules/data.
- Each history entry stores scroll position. List routes restore their prior scroll; new detail routes start at the top unless the URL contains a hash.
- Rapid navigation aborts or ignores obsolete results without unhandled rejections.
- Language changes save the preference and rerender the current route through the router instead of `location.reload()`.

## Error And Security Behavior

- Route authorization is checked against the in-memory signed session metadata before module mount.
- API authorization remains server-side and cookie-based; the router does not trust client role changes.
- Unknown, malformed, or cross-role routes fail closed or redirect to the signed role home.
- Unsaved-change protection can cancel a route before history mutation through a runtime guard hook; native `beforeunload` remains available for document exits.
- A route load failure leaves the previous shell visible and replaces only the content outlet with a retryable error state.

## Verification Contract

Automated browser tests must prove for Dashboard -> Employees -> Courses -> Dashboard, rapid navigation, Back/Forward, mobile, slow network, and cached revisits:

- zero navigation requests with resource type `document` after initial load;
- identical sidebar and topbar DOM nodes across route changes;
- active route state changes immediately;
- no sampled frame without a visible shell/content outlet;
- no duplicate GET request while a matching request is in flight or fresh;
- cached revisit renders without waiting for another network response;
- zero console errors, page errors, and unhandled rejections.

Direct deep URLs and hard refresh remain document loads by definition, but must reconstruct the correct authenticated route without redirect loops or blank output.

