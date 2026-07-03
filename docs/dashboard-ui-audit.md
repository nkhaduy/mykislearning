# DASHBOARD UI PHASE 1 — Audit Employee Dashboard & HR Admin

Audit date: 2026-07-02  
Repository: `/Users/khaduy/Documents/KISVN`  
Production reference: `https://mykis-learning.nkhaduy.workers.dev`  
Scope: Employee dashboard and HR admin frontend only. No redesign, no implementation, no deploy.

## 1. Repository State

- Current branch: `main`
- Current HEAD: `ad1e882 feat: add content versioning and retraining`
- Recent commits reviewed: `ad1e882`, `3e9f488`, `6297e8c`, `8afddda`, `790ef64`, `36b430c`, `d8970c6`, `193047c`, `938a79a`, `76aecff`
- Worktrees:
  - `/Users/khaduy/Documents/KISVN` on `main` at `ad1e882`
  - `/Users/khaduy/Documents/KISVN-phase9` on `phase9-competency` at `5a9fcc1`
  - `/Users/khaduy/Documents/KISVN/.claude/worktrees/agent-a265abb8920927875` on `worktree-agent-a265abb8920927875`
- Dirty state existed before audit:
  - Modified: `.DS_Store`, `.claude/worktrees/agent-a265abb8920927875`, `app.js`, `dist/app.js`, `dist/styles.css`, `e2e/timeline-check.spec.js`, `scripts/check-timeline.mjs`, `styles.css`, `supabase/.temp/cli-latest`, existing `test-results/learning-path/*.png`
  - Untracked: `images/goc.xls`, `test-results/auth-session-dashboard/`
- Audit artifacts created:
  - `docs/dashboard-ui-audit.md`
  - `test-results/dashboard-ui-audit/*.png`

No worktree was created. No merge, cherry-pick, cleanup, deploy, backend, API, DB, auth, landing page, or About KIS changes were made.

## 2. Phase 9 Integration Status

Phase 9 is not integrated into the current `main` router. The current branch has Phase 2 learning paths plus later compliance, certificates, reports, notifications, audit log, content versioning and retraining. The Phase 9 work appears to live in the separate worktree `/Users/khaduy/Documents/KISVN-phase9` on branch `phase9-competency`.

Verified in `app.js` route rendering, not from commit messages:

- Exists: `/dashboard/learning-paths`
- Exists: `/admin/learning-paths`
- Missing: `/dashboard/skills`
- Missing: `/dashboard/development-plan`
- Missing: `/admin/competencies`
- Missing: `/admin/skills-matrix`
- Missing: `/admin/development-plans`

The missing routes currently fall through to `landingPage()` after auth/session handling, so authenticated users can land on a public/incorrect page instead of a scoped not-found state.

## 3. Route Inventory

Employee:

| Route | Status | Current rendering |
|---|---:|---|
| `/dashboard` | Exists | `employeeDashboard(false)` |
| `/dashboard/courses` | Exists | `myCoursesPage()` |
| `/dashboard/quizzes` | Exists | `employeeQuizzesPage()` |
| `/dashboard/learning-paths` | Exists | `myLearningPathsPage()` |
| `/dashboard/compliance` | Exists | `myCompliancePage()` |
| `/dashboard/certificates` | Exists | `myCertificatesPage()` |
| `/dashboard/notifications` | Missing | falls through to landing page; notifications are only modal/panel |
| `/dashboard/skills` | Missing | falls through to landing page |
| `/dashboard/development-plan` | Missing | falls through to landing page |

HR Admin:

| Route | Status | Current rendering |
|---|---:|---|
| `/admin` | Exists | `adminDashboard(false)` |
| `/admin/courses` | Exists | `coursesPage()` |
| `/admin/assign` | Exists | `assignPage()` |
| `/admin/quizzes` | Exists | `adminQuizzesPage()` |
| `/admin/learning-paths` | Exists | `adminLearningPathsPage()` |
| `/admin/compliance` | Exists | `adminCompliancePage()` |
| `/admin/certificates` | Exists | `adminCertificatesPage()` |
| `/admin/reports` | Exists | `reportsPage()` |
| `/admin/notifications` | Exists | `notificationsPage()` |
| `/admin/audit-log` | Exists | `auditLogPage()` |
| `/admin/retraining` | Exists | `retrainingPage()` |
| `/admin/competencies` | Missing | falls through to landing page |
| `/admin/skills-matrix` | Missing | falls through to landing page |
| `/admin/development-plans` | Missing | falls through to landing page |

## 4. Shared Shell Audit

Files/components read:

- App shell/router: `app.js`, `render()`, `sideNav()`, `topbar()`, `adminTopbar()`
- Employee pages: `employeeDashboard()`, `myCoursesPage()`, `employeeQuizzesPage()`, `myLearningPathsPage()`, `myCompliancePage()`, `myCertificatesPage()`, `notificationModal()`
- HR pages: `adminDashboard()`, `coursesPage()`, `assignPage()`, `adminQuizzesPage()`, `adminLearningPathsPage()`, `adminCompliancePage()`, `adminCertificatesPage()`, `reportsPage()`, `notificationsPage()`, `auditLogPage()`, `retrainingPage()`, `adminLearningPage()`
- Shared CSS: `styles.css`, especially app shell, topbar, sidebar, card/table/modal/filter responsive rules and additive admin design-system overrides
- i18n: `lib/i18n/vi.js`, `lib/i18n/en.js`, `lib/i18n/kr.js`

Shared findings:

| Route | Component | Issue | Impact | Proposal | Priority |
|---|---|---|---|---|---|
| All dashboard/admin | `.app-sidebar` | Sidebar is always visible on mobile; screenshots show it taking ~55% width and leaving a white/content strip instead of a drawer. | Mobile task flow starts with navigation, not page content; high risk of horizontal/visual overflow. | Add breakpoint shell with hidden sidebar, topbar menu button, drawer overlay, focus trap, escape close. | Critical |
| All dashboard/admin | Shell | No mobile drawer/collapse behavior is implemented in `sideNav()`. | User cannot access a compact mobile layout; content is squeezed below/alongside nav. | One shared responsive shell for Employee and HR. | Critical |
| HR `/admin` vs other HR pages | Topbar | `/admin` uses `adminTopbar()`/`.adm-topbar`, most other admin routes use generic `topbar()`. | HR visual system changes route to route; admin feels assembled from separate phases. | Standardize one HR topbar with contextual title, language, user menu, notification, logout. | High |
| All dashboard/admin | Sidebar | Menu is long; HR has 17 links plus groups and no internal scroll/compact mode. | On laptop/mobile, lower items can be hard to reach; scanning cost is high. | Keep grouped nav, add scroll containment and reduce label density. | High |
| All dashboard/admin | Active state | Active state exists via `.active` and `aria-current`, but missing routes fall through without active nav. | Missing routes feel like broken public navigation, not authenticated app errors. | Add authenticated 404/coming-soon route state. | High |
| All dashboard/admin | Content | Container width and padding vary by page and phase; cards often float with heavy shadows. | Wide desktop has uneven rhythm; mobile gets stacked cards but not a coherent content system. | Use a shared content container and page header pattern. | Medium |
| Shared UI | Buttons | Several mini actions are visually similar to primary/secondary, sometimes <44px. | Hard to scan primary task and weaker touch accessibility. | Define button sizes/hierarchy; mini only in dense tables, 44px touch on mobile. | High |
| Shared UI | Tables | Table wrappers overflow horizontally but lack sticky columns or mobile card fallback. | HR pages become scroll-heavy and hard to scan on mobile. | Define table responsive modes by data type. | High |
| Shared UI | Modals/drawers | Modal markup uses dialogs visually but not native focus management; close buttons vary. | Keyboard and screen-reader behavior likely inconsistent. | Shared modal/drawer primitive with focus trap, labelled close, escape. | High |
| Shared UI | Loading/empty/error | Skeletons, spinners, blank dashes, and empty cards differ by page. | Users cannot distinguish loading vs no data vs failed API. | Shared skeleton/empty/error components with retry and context. | Medium |

## 5. Employee Route Audit

### `/dashboard`

Goal: show the learner’s next action, deadlines, progress, and useful notifications.

First thing user should see: continue learning item and overdue/due-soon status.

Findings:

| Component | Issue | Impact | Proposal | Priority |
|---|---|---|---|---|
| Mobile shell | Sidebar dominates first viewport. | Learner does not see dashboard content first. | Mobile drawer with hidden nav by default. | Critical |
| Continue hero | Stronger than other content, but progress shows `0%` despite “continue” wording in audited local state. | CTA reads inconsistent with progress/status. | Align hero copy to status: Start vs Continue, overdue badge, next lesson. | High |
| Metrics | “Số giờ đào tạo” and “Tổng thời gian học” duplicate concept. | Metrics look equally important but one repeats another. | Replace with overdue/due-soon/pending quiz or combine time metric. | Medium |
| Recent courses | Course rows are compact but status and CTA sit at same level. | Deadline, progress, and action compete. | Use deadline-first row hierarchy with status chip and primary CTA. | Medium |
| Notifications | Recent notifications are a full panel equal to learning tasks. | Notifications can outrank training deadlines. | Keep notifications secondary unless critical/unread high priority. | Medium |
| A11y | Header hierarchy mixes topbar `h2`, page `h1`, card `h3`. | Screen-reader outline is inconsistent. | One page `h1`; topbar title as non-heading or scoped. | High |

Desktop issue: wide view leaves much of the page in cards with similar shadows instead of clear editorial hierarchy.  
Tablet issue: sidebar consumes too much horizontal space.  
Mobile issue: sidebar is not a drawer and content starts too late.  
Empty/loading/error: empty state exists; loading for dashboard is mostly dashes/skeleton fallback.  
Priority: Critical due mobile shell.

### `/dashboard/courses`

Goal: find assigned courses, understand progress/deadline/status, and start/continue.

Findings:

| Component | Issue | Impact | Proposal | Priority |
|---|---|---|---|---|
| Filter bar | Status tabs are buttons in a generic filter bar. | Works, but not enough hierarchy for overdue/due soon. | Add “Needs attention” grouping and due-date sort. | Medium |
| Course cards | Image, title, status, progress and CTA are all card-level. | Repeated cards are visually heavy; deadline can be missed. | Make deadline/status row visually stronger; reduce card chrome. | High |
| Mobile cards | Cards stack but image+metadata make long scrolling. | Slow scan when many courses. | Compact mobile card with smaller thumbnail and deadline line. | Medium |
| Image crop | `object-fit: cover` works but course images can become generic hero art. | Training type is harder to recognize. | Prefer consistent course thumbnail ratio and fallback icon by category. | Nice to have |
| A11y | Status depends on badge text plus color, acceptable, but progress lacks semantic `progressbar`. | Assistive tech misses progress value. | Use `<progress>` or ARIA progressbar. | Medium |

### `/dashboard/quizzes`

Goal: show quiz attempts, passing score, result, deadline and retake/start state.

Findings:

| Component | Issue | Impact | Proposal | Priority |
|---|---|---|---|---|
| Quiz cards/list | Presentation is too close to course-style cards. | Quiz-specific concepts like attempts/result/passing score are not immediately scannable. | Dedicated quiz row/card pattern with score, attempts left, pass/fail state. | High |
| Retake state | CTA state depends on logic but is not visually separated from first attempt. | Employee can miss retake constraints. | Explicit attempt counter and retake eligibility line. | High |
| Empty/loading | Empty state exists, but no educational next step. | “No quiz” does not tell whether user must finish courses first. | Empty copy should mention course prerequisites. | Medium |
| Mobile | Same shell problem; content scanning is secondary. | Mobile quiz task is delayed. | Shared mobile shell first. | Critical |

### `/dashboard/learning-paths`

Goal: show assigned paths, current step, locked steps, prerequisite and progress.

Findings:

| Component | Issue | Impact | Proposal | Priority |
|---|---|---|---|---|
| Path cards | Current step is less prominent than path title/card chrome. | Employee may not know the next step. | Promote “Current step” as the primary row. | High |
| Step detail | Lock reason exists in code, but visual priority is low. | Learner may not understand prerequisite. | Use explicit lock reason block with required previous step. | Medium |
| Version | Version/change information is not visible in list. | Reassigned/updated paths may confuse employees. | Add version/update metadata only when relevant. | Medium |
| Mobile | Step rows wrap and actions can stack awkwardly. | Long step names/Korean text may be hard to scan. | Mobile step timeline with one action per row. | High |

### `/dashboard/compliance`

Goal: show mandatory compliance items by urgency and completion evidence.

Findings:

| Component | Issue | Impact | Proposal | Priority |
|---|---|---|---|---|
| Header/action | Reload button is prominent beside title. | Operational reload competes with compliance action. | Move reload to secondary icon/overflow. | Medium |
| Compliance cards | Mandatory/due/overdue are present but need stronger urgency sorting. | Due soon may not surface first. | Group Overdue, Due soon, Active, Completed. | High |
| Red usage | Overdue card uses border/background; not excessive in current code. | Positive: avoids full red page. | Keep restrained red only for urgent states. | Nice to have |
| Detail action | Start, Go to resource, Sync result appear as peers. | Employee may think manual sync is the main action. | Primary = Go to resource; Sync as secondary technical action. | High |

### `/dashboard/certificates`

Goal: show verified/pending/rejected/expiring certificates and upload/renew actions.

Findings:

| Component | Issue | Impact | Proposal | Priority |
|---|---|---|---|---|
| Certificate list | Card list is clearer than a table for employee, but status priority depends on sorting only. | Expiring/rejected can be missed if card text is long. | Attention banner or grouped sections for action-required states. | High |
| Upload CTA | Upload button is visible. | Good primary task placement. | Keep; add renewal-specific CTA in expiring cards. | Medium |
| Modal | Upload modal uses generic modal behavior. | Focus/escape/labels need verification. | Shared accessible modal primitive. | High |
| Mobile | Better than table, but shell blocks first viewport. | Mobile users start in nav. | Shared mobile shell. | Critical |

### `/dashboard/notifications`

Status: missing route. Notifications exist as dashboard panel/modal only.

Findings:

| Component | Issue | Impact | Proposal | Priority |
|---|---|---|---|---|
| Router | `/dashboard/notifications` falls through to landing page. | Employee loses authenticated context from nav/deep links. | Add route or redirect to dashboard with notification modal. | High |
| Modal | Unread dot has `aria-label`, but small dot may be weak visually. | Priority/unread can be missed. | Add text status and priority chips. | Medium |
| Deep links | Modal supports actionUrl. | Good foundation. | Ensure invalid links stay within app guard. | Medium |
| Mark read | Mark-all and item mark-read exist. | Good. | Keep but ensure keyboard focus remains stable. | Medium |

### `/dashboard/skills`

Status: missing route.

Required Phase 9 concepts (required/current level, gap, evidence, self-assessment) are not present on `main`. Do not implement fake UI until Phase 9 is merged or the route contract is confirmed.

Priority: High for integration; not a UI redesign task until route exists.

### `/dashboard/development-plan`

Status: missing route.

Required Phase 9 concepts (goals, current/target level, resource, version, progress, due date, CTA, employee cannot self-mark complete) are not present on `main`. Do not design against invented data.

Priority: High for integration; not a UI redesign task until route exists.

## 6. HR Route Audit

### `/admin`

Goal: executive HR/L&D summary with tasks, compliance risk, pending approvals, quick actions.

Findings:

| Component | Issue | Impact | Proposal | Priority |
|---|---|---|---|---|
| Mobile shell | Sidebar dominates and content follows below/right. | Admin dashboard is not usable as a mobile dashboard. | Mobile drawer. | Critical |
| KPI row | Six KPI cards are visually equal, many showing dash/no data. | Admin cannot identify risk or action. | Risk-first KPI hierarchy: overdue, pending approvals, compliance risk, active learners. | High |
| Quick actions | Uses emoji-like icons and equal grid buttons. | Feels generic and less financial-enterprise. | Use consistent icon set and group by workflow. | Medium |
| Task table | “Việc cần xử lý” is below KPI row but table is empty in local state. | Good placement, weak empty state. | Empty state should explain what would appear and where to configure. | Medium |
| Visual system | `/admin` has `adm-*` design system, unlike other admin pages. | Route-to-route inconsistency. | Consolidate with shared HR shell. | High |

### Catalog pages: `/admin/courses`, `/admin/quizzes`, `/admin/learning-paths`, `/admin/competencies`

`/admin/competencies` is missing.

Findings:

| Route | Component | Issue | Impact | Proposal | Priority |
|---|---|---|---|---|---|
| `/admin/courses` | Table/filter | Search/filter/action exist, but table is desktop-first. | Mobile fallback relies on horizontal scroll. | Add responsive card rows or sticky first/action columns. | High |
| `/admin/courses` | Course drawer | Drawer is implemented as modal with large two-column layout. | Long content/enrollment lists are cramped on smaller screens. | Real side drawer on desktop, full-screen sheet on mobile. | Medium |
| `/admin/quizzes` | Builder modal | Quiz creation is a long form inside modal. | Complex authoring is hard to review and easy to lose context. | Full-page builder or stepper; modal only for small edits. | High |
| `/admin/learning-paths` | Detail/edit | Good route structure exists, but step/action density is high. | HR can miss publish/archive/assign consequences. | Separate authoring, preview target, assignment actions. | Medium |
| `/admin/competencies` | Router | Missing route. | Phase 9 catalog cannot be audited on main. | Merge/confirm Phase 9 first. | High |

### Operational pages: `/admin/assign`, `/admin/compliance`, `/admin/certificates`, `/admin/retraining`, `/admin/development-plans`

`/admin/development-plans` is missing.

Findings:

| Route | Component | Issue | Impact | Proposal | Priority |
|---|---|---|---|---|---|
| `/admin/assign` | Assignment workflow | Uses modal/query route for assignment; form density is high. | HR can lose target/course context. | Dedicated workflow panel with target summary, deadline, confirmation. | High |
| `/admin/compliance` | Program/cycle forms | Forms are in modals; actions activate/assign/exempt/manual complete appear close to table actions. | Risk of accidental operational action. | Separate destructive/exception actions with confirm and audit reason. | High |
| `/admin/certificates` | Tabs/table | Good task grouping, but table is horizontally dense. | HR review on tablet/mobile is poor. | Sticky employee/status/action columns and review drawer. | High |
| `/admin/retraining` | Table | Technical version IDs dominate entity/from/to columns. | HR sees implementation IDs before business impact. | Business-first row: content title, changed version label, affected users, decision. | High |
| `/admin/development-plans` | Router | Missing route. | Cannot audit Phase 9 workflow. | Merge/confirm Phase 9 first. | High |

### Analytical/system pages: `/admin/reports`, `/admin/notifications`, `/admin/audit-log`, `/admin/skills-matrix`

`/admin/skills-matrix` is missing.

Findings:

| Route | Component | Issue | Impact | Proposal | Priority |
|---|---|---|---|---|---|
| `/admin/reports` | KPI cards | Many cards show dashes and equal weight. | Analytics looks empty/broken rather than filtered/no data. | Distinguish loading, no data, and unavailable. | High |
| `/admin/reports` | Filter bar | Filters are clear on desktop, but route is card-heavy and wide. | Tablet/mobile will need long scrolling and tab overflow. | Sticky filter summary with collapsible filters on mobile. | Medium |
| `/admin/reports` | Export buttons | CSV/Excel/PDF prominent and clear. | Good. | Keep but add disabled/loading state when no data. | Medium |
| `/admin/notifications` | Composer modal | Recipient/content/settings form is modal-based. | Complex campaign creation can be cramped. | Full-page composer or drawer with preview. | Medium |
| `/admin/audit-log` | Raw JSON/detail | Detail drawer exposes IDs, JSON, user-agent, hash. | Technical data can overwhelm business audit review. | Business summary first; raw JSON collapsed by default. | High |
| `/admin/audit-log` | Table | 10 columns plus request ID/action. | Horizontal overflow and low scanability. | Sticky time/action/entity; collapse metadata. | High |
| `/admin/skills-matrix` | Router | Missing route. | Matrix cannot be audited on current branch. | Merge/confirm Phase 9 first. | High |

## 7. Responsive Findings

Tested via screenshots and browser automation attempts at: 390×844, 430×932, 768×1024, 1024×768, 1440×900, 1920×1080. Required screenshots are in `test-results/dashboard-ui-audit/`.

Key findings:

| Route | Component | Issue | Impact | Proposal | Priority |
|---|---|---|---|---|---|
| All | Mobile sidebar | Sidebar remains inline and consumes the first viewport. | Critical mobile blocker. | Implement drawer shell. | Critical |
| HR routes | Long sidebar | HR menu height is long and not clearly scroll-contained. | Lower links can be awkward on smaller screens. | Sidebar internal scroll and group compaction. | High |
| Table routes | Tables | Horizontal table wrappers exist, but no sticky columns/mobile cards. | Data scan is poor on mobile/tablet. | Table responsive pattern by route class. | High |
| Filter routes | Filter bars | Filters wrap unpredictably and can become multi-row controls. | Search/filter workflow slows on mobile. | Collapsible filter drawer/chips. | Medium |
| Topbar | Long Korean/user text | Text truncation exists in some selectors, but topbar/user identity can still crowd actions. | Korean labels and names can collide with language/logout controls. | Fixed topbar grid, truncation, overflow menu. | Medium |
| Modal/drawer | Large modals | Large modals use `max-height` but not full mobile sheet behavior consistently. | Form buttons can be below fold and focus order unclear. | Mobile full-screen sheet with sticky footer. | High |

## 8. Accessibility Findings

| Route | Component | Issue | Impact | Proposal | Priority |
|---|---|---|---|---|---|
| All | Mobile nav | No drawer trigger, `aria-expanded`, focus trap, or escape behavior because sidebar is inline. | Keyboard/mobile screen-reader navigation is poor. | Shared nav drawer primitive. | Critical |
| All | Headings | Topbar `h2` plus page `h1/h2/h3` varies by route. | Screen-reader outline inconsistent. | One page `h1`; cards use ordered headings. | High |
| Modals | Dialog behavior | `role="dialog"`/`aria-modal` exists in some modals, but focus trap/initial focus/escape are not centralized. | Keyboard users can lose focus context. | Shared modal service. | High |
| Buttons | Icon/mini buttons | Some `×`, arrows, refresh/menu buttons rely on symbols or short labels; not all have consistent accessible names. | Screen-reader ambiguity. | Enforce `aria-label` on icon-only buttons. | High |
| Tables | Headers | Tables generally have `th`, but dense tables lack caption/summary and row action context. | Assistive users lack table purpose and action target. | Add captions/sr-only summaries and contextual action labels. | Medium |
| Status | Color/state | Badges include text, which is good; dots/unread indicators need text fallback. | Low-vision users can miss priority. | Text+icon status pattern. | Medium |
| Motion | Route/modal animations | Reduced motion exists for some classes, but not all additive animations/transitions. | Motion-sensitive users may still see transitions. | Central reduced-motion coverage. | Medium |
| Touch | Mini actions | Dense mini buttons may be below 44px on desktop-derived mobile pages. | Touch target failure risk. | Mobile min-height 44px. | High |

Critical accessibility issues:

1. Mobile sidebar is not a drawer and has no expanded/collapsed semantics.
2. Modal/drawer focus management is not centralized.
3. Heading hierarchy is inconsistent across app routes.

## 9. Performance and Frontend Quality Findings

| Route | Component | Issue | Impact | Proposal | Priority |
|---|---|---|---|---|---|
| Global | `app.js` | Single large render file contains router, shell, pages, events, forms, modals, API calls. | High regression risk; duplicate patterns. | Split by shell, employee pages, HR pages, shared UI. | High |
| Global | `bindEvents()` | Event listeners are rebound after every render; most are direct per-node bindings. | Performance risk as pages grow; harder cleanup. | Event delegation or component lifecycle boundaries. | Medium |
| Global | API fetch in render branches | Render triggers fetches via route checks/queueMicrotask. | Duplicate fetch/race risk and skeleton flicker. | Route-level data loaders with cache state. | Medium |
| CSS | `styles.css` | Multiple design systems and overrides: base, 2026 redesign, `adm-*`, page-specific rules. | Specificity drift and hard-to-predict UI. | Token/component extraction in Phase 2. | High |
| Tables/matrix | Dense rows | No virtualization for large HR tables/matrix. | Future skills matrix can become slow. | Virtualize large matrix/table or paginate. | High |
| Images | Course/gallery | Some images lazy-load; hero/other assets vary. | Mostly acceptable, but course thumbnails need consistent optimization. | Keep lazy loading; define thumbnail sizes. | Medium |
| Shadows/blur | Cards | Many cards combine borders and soft shadows. | Heavy DOM paint and generic SaaS look. | Reduce shadow levels and card use. | Medium |
| Console | Static audit | Local static login warns because backend `/api/auth` is unavailable. | Audit-only; production Worker may differ. | Use Worker dev for auth QA; static ok for visual local session. | Nice to have |

## 10. Design-System Recommendation

Direction: Premium Korean enterprise, modern financial institution, professional internal LMS, clean navy/blue, editorial hierarchy, controlled whitespace, high information clarity. Avoid generic SaaS templates, card grids everywhere, emoji-like admin icons, and decorative gradients.

Recommended system:

- Color tokens:
  - `navy-950 #06172c`, `navy-900 #09213e`, `navy-800 #0d2e52`
  - `blue-600 #2563eb`, `blue-500 #3974ff`, `blue-50 #f3f7ff`
  - Neutral page `#f4f7fb`, surface `#ffffff`, border `#dfe7f1`
  - Text primary `#10243e`, secondary `#607089`, muted `#8a98ad`
  - Status: success green, warning amber, danger red, info blue, each with text+icon and light background
- Typography:
  - Single UI sans stack: system/Inter/Manrope only if loaded consistently
  - Scale: 12, 13, 14, 16, 18, 22, 28; no viewport-fluid product headings
  - Page title 24-28 desktop, 20-22 mobile; cards 15-18
- Spacing:
  - 4px base scale: 4, 8, 12, 16, 20, 24, 32, 40
  - Mobile content padding 16; desktop 28-36; wide cap around 1440 content
- Container:
  - Shared `.app-content` max width for normal pages; full-width mode for matrix/report tables
- Sidebar:
  - Desktop 252-264px; wide 280px max
  - Mobile off-canvas drawer 320px or 84vw, hidden by default
  - HR groups retained but scroll-contained
- Topbar:
  - 64px desktop, 56-60px mobile
  - Menu button, page context, notifications, language, user menu
- Radius:
  - Cards 10-12px; buttons/inputs 8px; badges pill only
- Shadows:
  - Level 0 border only
  - Level 1 subtle `0 2px 8px rgba(15,31,54,.06)`
  - Level 2 overlay `0 12px 32px rgba(15,31,54,.14)`
- Buttons:
  - Primary for one main action per section
  - Secondary outline
  - Ghost for low-risk navigation
  - Danger explicit and confirmed
- Tables:
  - Dense HR: 44px rows desktop, 52px touch rows mobile
  - Sticky first/action columns for audit/cert/report tables
  - Mobile card fallback for operational tasks
- Filters:
  - Desktop horizontal filter bar
  - Mobile collapsible filter drawer with active chips
- Motion:
  - 150-200ms state transitions only
  - Reduced motion disables route/modal transitions

## 11. Critical Issues

1. All authenticated dashboard/admin mobile routes: sidebar is not a drawer and blocks the first viewport.
2. All authenticated routes: missing Phase 9 routes fall through to public landing instead of authenticated not-found/coming-soon.
3. All modal/drawer workflows: no centralized focus trap/escape/initial focus behavior.

## 12. High-Priority Issues

1. HR shell has two competing visual systems (`adminTopbar`/`adm-*` vs generic `topbar`).
2. HR tables are desktop-first with horizontal overflow only.
3. `/admin/audit-log` exposes technical data before business audit summary.
4. `/admin/retraining` foregrounds technical entity/version IDs.
5. `/admin/quizzes` builder is too complex for a modal.
6. `/admin/assign` and `/admin/compliance` workflows need clearer confirmation/destructive-action hierarchy.
7. Employee `/dashboard/compliance` detail actions make resource action and sync action look equal.
8. Employee `/dashboard/quizzes` needs quiz-specific hierarchy for attempts/result/retake.
9. Employee certificate action-required states need stronger grouping.
10. `styles.css` has overlapping design-system layers and high maintenance risk.

## 13. Medium Issues

1. Dashboard metric cards duplicate training time concepts.
2. Notifications can take too much priority on learner overview.
3. Filters need mobile chip/drawer pattern.
4. Empty/loading/error states vary by page.
5. Progress bars should expose semantic progress values.
6. Korean/long labels need explicit topbar/sidebar truncation rules.
7. Course images need consistent ratio/category fallback.
8. Reduced-motion coverage should be centralized.

## 14. Nice-to-Have Issues

1. Replace emoji-like quick action icons with one icon library.
2. Reduce card shadows for a more financial-institution feel.
3. Add route-level breadcrumbs where hierarchy is deep.
4. Add export disabled/loading states when report data is unavailable.

## 15. Proposed Phase 2-7 Roadmap

### Phase 2 — Shared Shell & Design System

- Routes: all `/dashboard*` and `/admin*`
- Files expected: `app.js`, `styles.css`, possible new shared shell/component modules if project structure is split
- Risks: high because every authenticated route uses shell
- Required tests: desktop/mobile route smoke; keyboard nav; sidebar drawer; language switcher; logout; reduced motion
- Acceptance criteria:
  - Mobile sidebar is a drawer with focus trap and `aria-expanded`
  - One topbar system for Employee and HR
  - Shared button, card, table, badge, filter, modal primitives documented in CSS/classes
  - Missing authenticated routes show authenticated not-found/coming-soon, not landing page

### Phase 3 — Employee Dashboard Overview

- Routes: `/dashboard`, notification modal/panel
- Files expected: `app.js`, `styles.css`, i18n dictionaries if copy changes
- Risks: medium; must not alter course progress logic
- Required tests: employee login/session, dashboard desktop/mobile, empty course state, notifications read/mark-all
- Acceptance criteria:
  - Continue/start learning is the first content priority
  - Overdue/due-soon status is visible
  - Metrics are non-duplicative
  - Mobile first viewport shows dashboard content, not sidebar

### Phase 4 — Employee Learning Pages

- Routes: `/dashboard/courses`, `/dashboard/quizzes`, `/dashboard/learning-paths`, `/dashboard/compliance`, `/dashboard/certificates`, plus `/dashboard/skills` and `/dashboard/development-plan` only after Phase 9 integration
- Files expected: `app.js`, `styles.css`, i18n
- Risks: high around course player/progress/compliance evidence semantics
- Required tests: course card, quiz attempts, learning-path lock, compliance resource/sync, certificate upload modal, mobile
- Acceptance criteria:
  - Each page has task-specific hierarchy, not generic card repetition
  - Status/CTA/deadline are scannable
  - Employee cannot infer manual self-completion where evidence is required

### Phase 5 — HR Dashboard Overview

- Routes: `/admin`
- Files expected: `app.js`, `styles.css`, HR overview API display only if needed
- Risks: medium; admin overview currently has custom `adm-*` system
- Required tests: HR desktop/mobile, empty/no-data, pending task states, quick actions
- Acceptance criteria:
  - Executive summary is risk/action oriented
  - Pending approvals and compliance risk outrank generic KPI cards
  - Quick actions are grouped and visually consistent

### Phase 6 — HR Management Pages

- Routes: `/admin/courses`, `/admin/assign`, `/admin/quizzes`, `/admin/learning-paths`, `/admin/compliance`, `/admin/certificates`, `/admin/reports`, `/admin/notifications`, `/admin/audit-log`, `/admin/retraining`, plus `/admin/competencies`, `/admin/skills-matrix`, `/admin/development-plans` only after Phase 9 integration
- Files expected: `app.js`, `styles.css`, i18n
- Risks: high due dense tables/forms and operational actions
- Required tests: table responsive, filters, modals, destructive confirmation, export, audit detail, retraining approval/apply
- Acceptance criteria:
  - Dense tables have sticky/mobile patterns
  - Long forms are not forced into cramped modals
  - Technical data is secondary to business decisions
  - Destructive/exception actions require confirmation and reason where appropriate

### Phase 7 — Final Responsive/Accessibility/Performance QA

- Routes: all Employee and HR routes in scope
- Files expected: tests, screenshots, possible small CSS/JS fixes
- Risks: low to medium; should be verification-focused
- Required tests: 390×844, 430×932, 768×1024, 1024×768, 1440×900, 1920×1080; keyboard; screen-reader labels; console; no horizontal overflow; large data tables
- Acceptance criteria:
  - No page-level horizontal overflow
  - Touch targets meet 44px on mobile
  - Modal/drawer keyboard behavior passes
  - Console has no route render errors
  - Performance risks from large tables/matrix are mitigated

## 16. Screenshot Index

Stored in: `test-results/dashboard-ui-audit/`

Employee:

- `employee-dashboard-desktop.png`
- `employee-dashboard-mobile.png`
- `employee-courses.png`
- `employee-learning-paths.png`
- `employee-compliance.png`
- `employee-skills-missing.png`
- `employee-development-plan-missing.png`

HR:

- `hr-admin-desktop.png`
- `hr-admin-mobile.png`
- `hr-courses.png`
- `hr-compliance.png`
- `hr-reports.png`
- `hr-audit-log.png`
- `hr-skills-matrix-missing.png`
- `hr-development-plans-missing.png`

Note: Local static server cannot authenticate through `/api/auth` without the Worker backend, so screenshots use the app’s legacy localStorage session path to render authenticated frontend routes. This affects auth only, not the audited UI shell/page rendering.

## 17. Blockers Before Phase 2

1. Confirm whether Phase 9 branch `phase9-competency` should be merged before redesigning skills/development-plan/competency/matrix pages.
2. Decide whether Phase 2 should refactor `app.js` into modules or keep one-file rendering with shared primitives.
3. Decide authenticated missing-route behavior: 404, coming soon, or redirect to nearest existing route.
4. Use Worker dev or production-like auth for final QA because static fallback server does not run `/api/auth`.


## Dashboard UI Phase 2 implementation

Implementation date: 2026-07-03
Scope: shared authenticated app shell and design-system foundations for Employee and HR routes. No business workflow redesign, backend/API/auth, database, Landing Page, or About KIS changes.

### Shell changes

- Employee and HR now use the same shell language: sidebar, topbar, content container, drawer overlay, user identity, language switcher, notification access, and logout affordance.
- `/admin` no longer presents a separate topbar visual system; the HR overview keeps its existing dashboard content cards while the shell/topbar matches other admin routes.
- The shared sidebar renderer is retained and tightened to the Phase 2 route groups instead of making every legacy route a primary navigation item.

### Design tokens and foundations

- Added a Phase 2 token layer for navy/blue brand colors, neutral surfaces, semantic status colors, typography/layout primitives, spacing, radius, shadows, and shell dimensions.
- Existing variables are aliased to the Phase 2 token layer for compatibility with older page content.
- Added additive foundations for buttons, icon buttons, compact table actions, forms, badges/statuses, cards, metric containers, tables, filter bars, modals/dialogs, loading/empty/error blocks, pagination, and reduced motion.

### Sidebar and mobile drawer

- Desktop sidebar is scroll-contained with grouped labels, subtle active state, fixed brand area, and a separated logout area.
- Mobile sidebar is a fixed left drawer with backdrop instead of normal document flow; it no longer occupies the first viewport.
- Drawer behavior includes open/close controls, `aria-expanded`, `aria-controls`, Escape close, backdrop close, close-on-nav-click, body scroll lock, focus movement into the drawer, focus trap, focus return, and desktop-resize cleanup.

### Topbar and user menu

- Topbar includes mobile menu control, current page context, notifications, language switcher, user name/role label, avatar/initials, dropdown menu, and logout.
- User dropdown is keyboard usable, closes on Escape/outside click, and preserves focus behavior.
- Mobile topbar keeps controls compact and truncates long VI/EN/KR user/page labels.

### Modal/drawer accessibility

- Shared dialog open/close now preserves and returns focus.
- Central focus-trap behavior applies to the active mobile drawer or modal dialog.
- Escape closes shared dialogs/drawer/user menu in the expected order.
- Existing business modals remain in place; Phase 2 adds the accessibility foundation rather than rewriting long forms.

### Shared components

- Page container rhythm is normalized through `.content` and additive shell tokens.
- Table wrappers keep overflow local to the table rather than the whole page.
- Filter bars wrap predictably and collapse to one/two columns on smaller viewports.
- Empty/error/loading surfaces use a calmer enterprise style with text plus structure rather than color-only cues.

### Remaining issues for Phase 3–7

- Phase 3 should redesign the Employee dashboard overview hierarchy and metrics; Phase 2 intentionally did not change dashboard business content.
- Phase 4 should apply task-specific hierarchy to employee course, quiz, learning-path, compliance, certificate, skills, and development-plan content.
- Phase 5 should redesign HR overview KPIs/quick actions beyond the shell.
- Phase 6 should address dense HR tables/forms and operational workflows route by route.
- Phase 7 should complete full route-level responsive, accessibility, and performance QA, including any mobile card fallbacks for dense tables.
