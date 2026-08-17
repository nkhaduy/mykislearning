# KIS LMS to Frappe Learning Migration Design

## Objective

Replace the authenticated KIS LMS product with native Frappe Learning. Preserve the Cloudflare-managed domain and all legacy data, but retire the Worker UI/API from the production request path after a verified cutover.

## Architecture decision

Use Frappe Learning `v2.61.0` on its native Frappe stack: web/backend workers, scheduler, websocket service, Redis and MariaDB. Cloudflare remains DNS/TLS/proxy only. Supabase becomes a read-only legacy archive after migration. This avoids a fake Frappe frontend and preserves upstream routing, authentication, permissions, course player and admin/instructor UX.

The deployment package pins both release commit and container digest. KIS-specific behavior lives outside upstream core in import tooling and, only where required, a small custom Frappe app. The first release changes branding and roles only.

## Identity and roles

Frappe native authentication replaces the custom HMAC session. Existing email addresses remain identity keys. Password hashes are not portable, so imported users receive reset/invite flows. Employee maps to LMS Student. HR maps to LMS Student, Course Creator, Moderator and System Manager for the requested administration scope.

## Data flow

An exporter reads a protected Supabase logical dump or sanitized JSON export. A normalizer validates and converts source rows into a versioned intermediate bundle. A Frappe importer uses stable legacy IDs, upserts in dependency order, commits in bounded batches and writes a reconciliation report. Unsupported KIS-only records remain in Supabase with documented disposition.

## Cutover

Build a new Frappe host at a staging hostname, restore/import, test Employee and HR flows, snapshot both systems, lower DNS TTL, then point `kislms.site` to the Frappe ingress. Keep the Worker deployment and Supabase database intact. Roll back by restoring the prior Cloudflare DNS/route to Worker version `b7c2c3a2-af8c-4881-834c-a96bd75d8c1c`.

## Failure handling

Migration commands default to dry-run and reject duplicate emails, missing foreign keys, unsupported required lesson types and count mismatches. They never log credentials or password hashes. Cutover aborts on auth, permission, course/lesson/progress, console, API or server-log blockers.

## Testing

Unit tests cover normalization, role mapping, hierarchy creation, idempotency and unmapped reports. Integration tests run the importer twice against disposable Frappe. Browser tests cover Employee and HR journeys on desktop and mobile, direct route refresh, logout/session persistence and unauthorized routes. Production is PASS only after real-domain browser and log verification.

## Hosting constraint

Cloudflare Workers cannot host this stateful multi-process stack. A Frappe-compatible VM or managed host with persistent storage is required. No such host credential or active session is currently present on this machine; local native staging and all deploy artifacts can be completed without changing production.
