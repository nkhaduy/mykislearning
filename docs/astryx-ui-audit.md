# Astryx UI Audit — MyKIS Learning Platform

**Date:** 2026-07-06  
**Phase:** 1  
**Status:** IN PROGRESS

---

## 1. Astryx Package

| Item | Value |
|---|---|
| Package | `@astryxdesign/core` |
| Version | `0.1.3` |
| CSS exports | `astryx.css` (122 KB pre-compiled StyleX), `reset.css`, `tailwind-theme.css` |
| JS exports | React 19 components (Button, Card, Dialog, SideNav, AppShell, TabList, Table, Toast, Badge, Skeleton, DropdownMenu, etc.) |
| Docs | `docs.mjs` CLI — listing verified |

## 2. Peer Dependencies

| Peer | Required | Installed |
|---|---|---|
| `react` | `>=19.0.0` | ❌ NOT installed |
| `react-dom` | `>=19.0.0` | ❌ NOT installed |
| `@stylexjs/stylex` | `^0.18.3` | ❌ NOT installed |

**Conclusion:** All Astryx JS components require React 19 + StyleX — they CANNOT be used directly in this project.

## 3. Codebase Framework

| Item | Value |
|---|---|
| Framework | **Vanilla JavaScript SPA** |
| Rendering | Template strings + `innerHTML` |
| Entry point | `app.js` (768 KB in dist) |
| CSS | Single `styles.css` (308 KB in dist, 11307 lines) |
| Build | `node scripts/build-static.mjs` → `dist/` (file copy, no bundler) |
| Runtime | Cloudflare Workers (serves `dist/` as static assets) |
| Router | Custom hash-free SPA router using `history.pushState` |
| Modal/Dialog | Custom Vanilla JS, `innerHTML`-based |
| Events | Direct `addEventListener` on rendered DOM |
| No bundler | No Webpack, Vite, or Rollup |

The app renders every page by assigning `app.innerHTML = pageFunction()`. There is no virtual DOM, no component lifecycle, no React runtime.

## 4. Integration Strategy

**SELECTED: Strategy A — Astryx tokens/styles only**

**Reasons:**
1. React 19 + react-dom not installed. Installing them just for Astryx components would add ~200 KB+ to the production bundle.
2. StyleX not installed. All component JS relies on StyleX class generation at compile time.
3. Astryx React components cannot be mounted in Vanilla JS `innerHTML` flow without a React root, which would require complex lifecycle management and would break on every `render()` call that replaces `app.innerHTML`.
4. The app's render model (full `innerHTML` replacement on navigate) is incompatible with React island pattern without significant architectural work.
5. Bundle risk: adding React islands only for visual components has no business logic benefit.

**What we use from Astryx:**
- Design token values from `astryx.css` `:root` declarations (spacing, radius, shadow, motion, color semantics) → mapped to `--ui-*` namespace
- Docs as visual reference for component behavior and pattern conventions
- Visual language principles (density, motion, border treatment, typography scale)

**What we do NOT use:**
- `astryx.css` wholesale (122 KB of dead StyleX component styles for components we don't use)
- `reset.css` (too risky without full baseline testing — deferred to Phase 2)
- Any Astryx React components directly

## 5. Astryx Components Audit

### Used directly (components)
None — not applicable (Vanilla JS only).

### Used via tokens/inspiration
| Astryx Component | Vanilla JS/CSS equivalent created |
|---|---|
| Button | `.ui-button`, `.ui-button--primary/secondary/ghost/destructive` |
| Badge | `.ui-badge`, `.ui-badge--published/draft/archived/success/warning/error` |
| Card | `.ui-card`, `.ui-card--muted`, `.ui-card--elevated` |
| Table | `.ui-table`, `.ui-table-wrap`, `.ui-table--compact` |
| TabList / Tab | `.ui-tab-list`, `.ui-tab` |
| EmptyState | `.ui-empty-state` |
| Skeleton | `.ui-skeleton` |
| Breadcrumbs | `.ui-breadcrumb` |
| SideNav | CSS refinements on existing `.app-sidebar .side-nav` |
| TopNav | CSS refinements on existing `.topbar` |
| AppShell | CSS refinements on existing `.app-layout` |

### Not applicable (Vanilla JS constraints)
| Astryx Component | Reason |
|---|---|
| Dialog, AlertDialog | Requires React portal + focus management. Vanilla equivalent already exists. |
| Toast | React-state based. Vanilla toast function already exists. |
| DropdownMenu | React-controlled. Vanilla implementation already exists. |
| Popover, HoverCard | React-controlled positioning. Deferred to Phase 2 planning. |
| Calendar, DateInput | Complex React state. Deferred. |
| CommandPalette | React-only. Deferred. |
| Layer | React context. Not applicable. |

## 6. CSS Reset Risk

`reset.css` was **NOT imported**. Risks identified:
- Astryx reset targets `button`, `input`, `a`, `table`, `ul`, `h1–h6`, `*`
- Would override existing KIS button styles, form inputs, landing page typography, About KIS hero
- Would break `min-height: var(--control-h)` rule on all buttons
- Would reset `border-radius` on all inputs
- Deferred to Phase 2 after baseline screenshot comparison

## 7. CSS/Reset Risks Summary

| Risk | Status |
|---|---|
| Astryx reset breaks buttons | AVOIDED — reset not imported |
| Astryx reset breaks typography | AVOIDED — reset not imported |
| Astryx token names conflict with KIS tokens | SAFE — Astryx uses `--color-*`, `--spacing-*`, `--radius-element/container`; KIS uses `--primary`, `--radius-sm/md/lg` — no conflict |
| New `.ui-*` classes conflict | SAFE — new namespace, additive only |
| `@layer astryx-base` from astryx.css cascading | AVOIDED — astryx.css not imported |

## 8. Bundle / Performance Impact

**Baseline (before Phase 1):**
| Asset | Size (dist) |
|---|---|
| `app.js` | 768 KB |
| `styles.css` | 308 KB |
| React runtime | 0 KB (not installed) |

**After Phase 1:**
| Asset | Change |
|---|---|
| `app.js` | +~2 KB (minimal HTML class additions) |
| `styles.css` | +~8 KB (token bridge + UI primitives, all additive) |
| React runtime | 0 KB (NOT added to production) |
| Astryx JS bundle | 0 KB (NOT imported — tokens only, via CSS variables) |

**No duplicate React runtime** — React is not in the project at all.

## 9. Existing UI Inconsistencies (from Audit)

| Area | Issue | Priority |
|---|---|---|
| Course List | Filter bar lacks visual container/separation | High |
| Course Detail | Tabs use `btn btn-primary/ghost` — not semantic tab role with proper border indicator | High |
| Course Detail | Breadcrumb exists but small and low contrast | Medium |
| Sidebar | Nav group labels lack consistent uppercase treatment | Medium |
| Topbar | Not sticky on scroll on some pages | Medium |
| All tables | `.table-wrap table` has no consistent header background | Medium |
| Status badges | `badge.done/learning/new` not differentiated enough | Medium |
| Empty states | Inconsistent between modules | Low |
| Skeleton | Multiple patterns used across modules | Low |
| Course breadcrumb | Uses inline `nav.breadcrumb` — no consistent CSS class naming | Low |

## 10. Route Priority

| Route | Issues | Priority | Phase |
|---|---|---|---|
| `/admin/courses` | Filter bar, table header, page header | P1 | Phase 1 |
| `/admin/courses/:id` | Tabs, breadcrumb, page header, content rows | P1 | Phase 1 |
| `/admin` | Overview cards, metrics grid | P2 | Phase 2 |
| `/dashboard` | Employee overview cards | P2 | Phase 2 |
| `/dashboard/courses` | Course cards | P2 | Phase 2 |
| `/login` | Form, buttons | P2 | Phase 2 |
| `/about-kis` | Already polished in prior session | P3 | Phase 2 |
| `/` | Landing hero, course cards | P3 | Phase 3 |
| All `/admin/*` (other) | Consistency pass | P2–P3 | Phase 2–3 |

## 11. Migration Roadmap

### Phase 1 (this session)
- [x] Compatibility audit
- [x] KIS × Astryx token bridge (`--ui-*` namespace in `styles.css`)
- [x] Shared UI primitives (`.ui-button`, `.ui-badge`, `.ui-card`, `.ui-table`, `.ui-tab-list`, `.ui-skeleton`, `.ui-empty-state`, `.ui-filter-bar`, `.ui-page-header`)
- [x] Shell refinements (sidebar group labels, nav link active state, topbar sticky)
- [x] Course Management pilot (`/admin/courses`, `/admin/courses/:id`)
- [x] Audit doc + E2E tests

### Phase 2 (planned, not started)
- [ ] Evaluate `reset.css` import safety with full screenshot baseline
- [ ] Refactor admin dashboard overview cards with `ui-card` + metrics patterns
- [ ] Employee dashboard cards
- [ ] Login page form refinement
- [ ] Install `@astryxdesign/theme-neutral` for token reference if needed
- [ ] Consistent empty/error states across all modules

### Phase 3 (future)
- [ ] Landing page course cards
- [ ] Evaluate React islands for isolated components (only if clear benefit)
- [ ] Full accessibility pass (WCAG 2.1 AA)

## 12. What NOT migrated in Phase 1
- Auth flow, login, session management
- Database queries, API calls
- Hard-delete course business logic
- About KIS / Landing hero (regression risk)
- Compliance, certificates, reports modules
- Notifications, audit log
- Employee management
- React migration (not in scope)

---

## Route × Astryx Primitive Table

| Route | Issue | Astryx Primitive Reference | Priority | Phase |
|---|---|---|---|---|
| `/admin/courses` | Filter bar visual hierarchy | FilterBar, TextInput, Selector | P1 | 1 |
| `/admin/courses` | Table header / row styling | Table | P1 | 1 |
| `/admin/courses` | Status badge differentiation | Badge | P1 | 1 |
| `/admin/courses` | Page header layout | AppShell / Section | P1 | 1 |
| `/admin/courses/:id` | Tabs semantic / indicator | TabList | P1 | 1 |
| `/admin/courses/:id` | Breadcrumb contrast | Breadcrumbs | P1 | 1 |
| `/admin/courses/:id` | Action buttons grouping | ButtonGroup | P1 | 1 |
| All authenticated | Sidebar nav group labels | SideNav | P1 | 1 |
| All authenticated | Topbar sticky behavior | TopNav | P1 | 1 |
| `/admin` | Metric cards | Card, StatusDot | P2 | 2 |
| `/dashboard` | Employee overview | Card, ProgressBar | P2 | 2 |
| `/login` | Form inputs | TextInput, Field | P2 | 2 |
| All | Empty states consistency | EmptyState | P2 | 2 |
| All | Skeleton consistency | Skeleton | P2 | 2 |
