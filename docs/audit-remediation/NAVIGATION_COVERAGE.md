# Navigation Coverage

Date: 2026-07-27
Finding: `UX-001`
Status: `VERIFIED` for the implemented route inventory.

`src/app/route-registry.js` is the machine-readable source shared by the Worker route policy, split route shell and legacy side navigation. Every implemented route is classified as `nav`, `detail`, `hidden`, or `redirect` and declares role visibility.

## Coverage Rules

- `nav`: reachable from the role-aware learner or admin navigation group.
- `detail`: intentionally excluded from side navigation and linked to a declared navigable parent.
- `hidden`: authentication, tokenized join, scanner or other workflow route that should not appear in the side navigation.
- `redirect`: legacy alias with a declared navigable parent.
- Employee navigation cannot expose `/admin` routes; HR/admin navigation cannot expose `/dashboard` routes.

## Automated Evidence

- `tests/unit/route-registry.test.mjs` verifies classification, parent validity, Worker route-policy parity, no duplicate destinations and role visibility.
- `e2e/authenticated-route-split.spec.js` verifies active route shells, learner/admin separation, mobile drawer ARIA state, Escape close and focus restoration.
- Current result: no orphan implemented route outside the intentional detail/hidden/redirect lists.

## Intentional Non-Side-Nav Routes

- Course, learning-path, gallery, development-plan, compliance and live-training detail routes inherit a parent breadcrumb/navigation destination.
- `/login`, `/change-password`, `/training`, `/join/:token` and `/attendance/scan` are workflow routes.
- `/dashboard/history` and `/admin/certifications` are compatibility redirects.

The server continues to enforce identity and role permissions independently of navigation visibility.
