# Frappe LMS Frontend Diff

Baseline: `frappe/lms` tag `v2.61.0`, commit `d3bfe97d178eb076310dffd7407106bcdec15d67`.

The vendored frontend contains 446 files. 439 are byte-for-byte identical to the pinned upstream tree. No upstream visual component or page is replaced.

| Upstream file | Local file | Change | Reason |
| --- | --- | --- | --- |
| `frontend/index.html` | `frontend/index.html` | Routing/public shell integration | Load the combined static application and KIS metadata. |
| `frontend/package.json` | `frontend/package.json` | Backend dependency | Add the pinned Supabase browser client while retaining upstream dependencies. |
| `frontend/src/App.vue` | `frontend/src/App.vue` | Routing only | Isolate legacy public routes from the authenticated upstream LMS layout. |
| `frontend/src/main.js` | `frontend/src/main.js` | Data/auth bootstrap | Install the Supabase-backed Frappe resource transport and disable the unavailable Frappe socket backend. |
| `frontend/src/router.js` | `frontend/src/router.js` | Auth/routing only | Add public KIS routes, Supabase guards, and production URL aliases. |
| `frontend/src/stores/session.js` | `frontend/src/stores/session.js` | Auth only | Normalize Supabase Auth/session/profile into the upstream session contract. |
| `frontend/vite.config.js` | `frontend/vite.config.js` | Build/data alias | Alias Frappe UI calls to the compatibility adapter and emit the Cloudflare Pages artifact. |

All compatibility implementation and legacy public pages live outside the imported upstream paths, primarily under `frontend/src/backend/` and `frontend/src/legacy-public/`.
