# KIS LMS Release Source Inventory

Date: 2026-07-28
Release branch: `release/kis-lms-production-20260728`
Baseline: `e0ff4f9b3d2b46e34e0669ef8f86c4d1be37c765`
Protection snapshot: `/tmp/kisvn-production-bootstrap-Vq3YlD`

## Included remediation source

- Worker authentication/session/rate-limit, reporting, search, export, Queue/DLQ/R2, route-policy, and audit changes.
- Frontend route split, public/authenticated route implementations, styles, static assets, and build tooling.
- Supabase containment, schema reconciliation, auth rotation, MFA removal, search, export, and reporting migrations.
- Unit, security, migration, integration, performance, and E2E tests plus CI quality gates.

## Included release artifacts

- Generated `dist` assets produced by the tested static build, including removal of the legacy monolith.
- Production/staging guards, runbooks, inventories, checksum evidence, and remediation reports.
- Private-data fixtures and legacy spreadsheet/employee exports are deleted from the release tree.

## Removed repository runtime state

- `.DS_Store` files.
- Local Wrangler/Miniflare state under `.wrangler/`.
- Supabase CLI link/runtime state under `supabase/.temp/`.
- Playwright output under `test-results/`.
- The local Claude worktree gitlink.

## Excluded local-only material

- `.agents/`, `.codex/`, `.claude/skills/`, and `skills-lock.json`.
- `docs/codebase/` onboarding notes because they were not part of the audited remediation evidence.
- Environment files, local runtime manifests, logs, and provider credentials.

The release commit must pass `git diff --check`, secret scanning, the repository quality gates, and a clean-worktree verification in an isolated Git worktree before production approval.
