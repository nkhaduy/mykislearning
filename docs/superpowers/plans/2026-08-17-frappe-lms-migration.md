# Frappe Learning Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the production KIS LMS with native Frappe Learning while preserving legacy data and rollback capability.

**Architecture:** Deploy pinned Frappe Learning on Frappe's native MariaDB/Redis/process stack behind Cloudflare. Export and normalize legacy Supabase records, import them idempotently through Frappe APIs, and retain Supabase plus the old Worker as read-only rollback infrastructure.

**Tech Stack:** Frappe Framework, Frappe Learning v2.61.0, Python 3.10+, MariaDB, Redis, Docker Compose, Playwright, Cloudflare DNS/proxy.

**Spec:** `docs/superpowers/specs/2026-08-17-frappe-lms-migration-design.md`

## Global Constraints

- Pin Frappe Learning to `d3bfe97d178eb076310dffd7407106bcdec15d67`.
- Do not copy Frappe UI into the legacy Worker application.
- Do not migrate password hashes, tokens, MFA secrets or service credentials.
- Missing KIS-only features remain backlog items.
- Never cut over before staging Employee and HR E2E pass.
- Keep Worker version `b7c2c3a2-af8c-4881-834c-a96bd75d8c1c` available for rollback.

---

### Task 1: Native deployment package

**Files:**
- Create: `frappe/compose.yaml`
- Create: `frappe/.env.example`
- Create: `frappe/scripts/bootstrap-site.sh`
- Test: `tests/frappe/test_deployment_config.py`

**Interfaces:**
- Produces: a pinned, persistent Frappe stack exposing HTTP through one ingress port.

- [ ] Write tests that parse Compose and assert pinned LMS image/commit, MariaDB/Redis health checks, persistent volumes and no embedded secrets.
- [ ] Run `python3 -m unittest tests.frappe.test_deployment_config` and verify failure because files do not exist.
- [ ] Add the minimal Compose/bootstrap configuration.
- [ ] Rerun the test and `docker compose -f frappe/compose.yaml config`.
- [ ] Commit the deployment package.

### Task 2: Legacy normalization library

**Files:**
- Create: `migration/kis_frappe_migration/normalize.py`
- Create: `migration/kis_frappe_migration/models.py`
- Test: `tests/migration/test_normalize.py`

**Interfaces:**
- Consumes: versioned JSON objects keyed by legacy table name.
- Produces: normalized users, courses, chapters, lessons, enrollments, progress and quizzes with stable legacy IDs.

- [ ] Write failing tests for role mapping, generated chapters, lesson types, duplicate emails and unmapped records.
- [ ] Run the focused test and verify expected failures.
- [ ] Implement the typed normalizer without credential fields.
- [ ] Rerun focused and full migration tests.
- [ ] Commit the normalizer.

### Task 3: Idempotent Frappe importer

**Files:**
- Create: `migration/kis_frappe_migration/importer.py`
- Create: `migration/kis_frappe_migration/frappe_client.py`
- Create: `migration/import_legacy.py`
- Test: `tests/migration/test_importer.py`

**Interfaces:**
- Consumes: normalized bundle from Task 2 and a Frappe REST client.
- Produces: upserted Frappe documents plus reconciliation JSON.

- [ ] Write failing tests using an in-memory fake client for dependency order, rerun idempotency, count mismatch and dry-run behavior.
- [ ] Verify the test fails for missing importer behavior.
- [ ] Implement minimal upsert and reconciliation logic.
- [ ] Run tests twice against the same fake dataset.
- [ ] Commit the importer.

### Task 4: Staging bootstrap and migration rehearsal

**Files:**
- Create: `frappe/scripts/rehearse-migration.sh`
- Create: `docs/frappe-migration-rehearsal.md`

**Interfaces:**
- Consumes: Docker stack and sanitized source export.
- Produces: disposable native Frappe site and reconciliation evidence.

- [ ] Start the pinned stack and wait for health checks.
- [ ] Create Employee and HR fixtures, run the importer twice and compare counts.
- [ ] Run Frappe migrations and upstream smoke tests.
- [ ] Record exact commands, versions and results.
- [ ] Commit rehearsal evidence.

### Task 5: Native browser journeys

**Files:**
- Create: `e2e/frappe-employee.spec.js`
- Create: `e2e/frappe-hr.spec.js`
- Modify: `playwright.config.js`

**Interfaces:**
- Consumes: seeded native Frappe staging URL and test users.
- Produces: desktop/mobile evidence for authentication, learning and administration.

- [ ] Write failing Employee and HR journeys against the unseeded staging site.
- [ ] Seed course, lesson, quiz, enrollment and roles.
- [ ] Run desktop and mobile tests until clean.
- [ ] Add direct refresh, back/forward, unauthorized route and session persistence assertions.
- [ ] Commit E2E coverage.

### Task 6: Production cutover and rollback verification

**Files:**
- Create: `frappe/scripts/cutover.sh`
- Create: `frappe/scripts/rollback.sh`
- Create: `docs/frappe-production-runbook.md`

**Interfaces:**
- Consumes: a ready Frappe-compatible host, Cloudflare zone access and successful staging evidence.
- Produces: `kislms.site` routed to Frappe with tested rollback.

- [ ] Snapshot Frappe and legacy stores; capture current DNS and Worker version.
- [ ] Update Cloudflare origin/DNS only after all release gates pass.
- [ ] Run real-domain Employee/HR desktop/mobile smoke tests and inspect browser console/network plus server logs.
- [ ] Exercise rollback in a controlled window, then reapply cutover and repeat smoke tests.
- [ ] Commit final production evidence and retire legacy routes from the active deployment path.
