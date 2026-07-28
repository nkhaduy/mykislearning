# Security Remediation

This document records implementation decisions for findings `SEC-001` through `SEC-011`. The repository is changed only; no production deployment, production mutation, secret rotation, CDN purge, or production schema apply is performed in this task.

## Trust Boundaries

- Browser-supplied identity headers are untrusted.
- Private API identity must come from a verified session token or future HttpOnly session cookie.
- Authorization roles and assurance must be resolved from the server-side session/database; JWT role and AAL fields are informational only.
- The Worker/service layer is the only supported access path for private data while the custom JWT is not mapped to Supabase Auth claims.
- Supabase `anon` and `authenticated` roles must not have direct private-table grants.

## Implemented Repository Controls

- `SEC-001`: production/staging identity comes only from a verified signed bearer token or HttpOnly session cookie. Client identity headers are ignored unless an explicit local/dev/test-only flag is enabled.
- `SEC-002/SEC-011`: the canonical migration enables RLS on every public table and revokes `anon`/`authenticated` table, sequence, and function privileges. The private schema remains outside PostgREST exposure; narrowly scoped `search_path=''` RPCs are executable only by `service_role` for credential/session/bootstrap access.
- `SEC-003`: the static build uses explicit file-level asset/module allowlists, deletes tracked private data artifacts, removes personal employee contact details from the public shell, and fails on private-data paths, office data files, credential markers, private keys, personal company email patterns, and selected high-confidence secret patterns.
- `SEC-004`: password hashes move to `private.account_credentials`; profile/avatar fields are cleaned by migration and are not read as a fallback by runtime auth.
- `SEC-005`: login issues short-lived access and opaque rotating refresh cookies. Refresh tokens are HMAC-hashed at rest, every rotation is atomic, reuse revokes the whole family, and logout/password/account/MFA changes revoke server-side sessions.
- `SEC-006/SEC-010`: CORS uses an origin allowlist and excludes identity headers; all Worker/API responses receive CSP, HSTS on HTTPS, no-sniff, referrer, permissions, frame, and private-route noindex headers.
- `SEC-007`: a SQLite Durable Object provides atomic shared buckets for login, refresh, MFA, password reset, bootstrap, employee search, report export, uploads, public training/join, and attendance flows. Production auth-critical failures are fail-closed; memory buckets are local/test only.
- `SEC-008`: admin bootstrap defaults to 404, uses a dedicated one-time secret, and claims `private.bootstrap_state` before credential creation.
- `SEC-009`: the audited certificate create/update route uses explicit fields and rejects invalid dates/lengths while ignoring owner, role, approval, audit, and unknown fields.
- `SEC-005/UX-005`: the split login route posts only email, password and remember-me to the same-origin Worker, requires JSON responses, keeps credentials out of logs/storage, and loads legacy session metadata modules only after a successful cookie-setting response.
- `NEW-SEC-001`: the vulnerable SheetJS `0.18.5` npm package and browser vendor file are replaced by the official SheetJS CDN tarball pinned at `0.20.3`; package-lock integrity, browser runtime checksum and XLSX round-trip behavior are verified.

## Verification Status 2026-07-28

- `SEC-005`: VERIFIED LOCALLY. Access/refresh TTLs are explicit; opaque refresh families are hashed, rotated atomically with row locks, and replay revokes the family. Logout, logout-all, session listing/revocation, password change/reset, disable and MFA reset revocations pass migration/runtime checks.
- `SEC-007`: VERIFIED LOCALLY WITH EDGE VALIDATION PENDING. The Durable Object adapter has shared-state, cleanup, normalization, spoofed-header and production-missing-binding tests; local/test memory fallback is never selected for production. A real Cloudflare binding still requires approved staging evidence.
- `SEC-011`: VERIFIED LOCALLY. Fresh, legacy upgrade and partial migration scenarios pass, including private auth grants/RLS and concurrent refresh verification. Staging catalog parity and approved rehearsal remain operational gates.
- `MFA/step-up`: VERIFIED LOCALLY. HR/Admin active or forced enrollment policy, encrypted TOTP, one-time recovery codes, timestep replay prevention, server-side assurance expiry and privileged API checks pass. Employee accounts remain outside the mandatory MFA policy.
- `CI/readiness`: lint, typecheck, unit/security/E2E, migrations, build/artifact/budget, audit and Wrangler dry-runs pass. No remote Supabase request, production/staging data access, or deployment occurred.

## Historical Verification Status 2026-07-27

- Local automated verification passes for forged headers, invalid/expired tokens, anonymous and employee authorization matrices, CORS, security headers, rate limiting, setup-disabled behavior, mass assignment, cookie auth/logout, RLS migration source assertions, static artifact scanning, the public-shell PII regression check, and browser handling of an intercepted non-JSON login response.
- Ephemeral runtime verification is now available. The Worker-compatible baseline moved from 45/66 to 66/66 public tables with RLS, browser roles have zero public table/function privileges, and private-store RPCs deny browser roles while serving the Worker service role.
- Fresh replay, legacy upgrade and recoverable/conflicting partial-state scenarios now pass in isolated PostgreSQL. Private auth tables/RPC grants remain service-role-only and fail closed to `anon`/`authenticated`.
- No production request mutation, deployment, schema apply, key rotation, CDN purge, or history rewrite has been performed.

## Runtime Security Results 2026-07-27

- `SEC-002`: VERIFIED in isolated runtime. Anonymous REST matrix returned 401; Employee A/B own-data and symmetric cross-user denial passed; HR/admin responses contained no credential material.
- `SEC-004`: VERIFIED in isolated runtime. Legacy markers were backfilled/cleared, private credential RPCs are service-only, password change/reset and no-fallback recovery passed.
- `SEC-005`: at this historical checkpoint, cookie/session/revocation behavior had passed while refresh rotation/reuse and privileged MFA were still pending.
- `SEC-007`: at this historical checkpoint, local thresholds passed while distributed edge binding behavior was still pending.
- `SEC-008`: VERIFIED in isolated runtime. Atomic RPC claim, fixed-length setup secret comparison, 8-way concurrency, audit and disabled-after-consumption behavior passed.

## Checkpoint 2026-07-27 — Runtime Apply And Final Regression

- Final regression gates are green: unit `30/30`, security `20/20`, public E2E `7/7`, build/privacy/bundle budget, `npm audit` 0 vulnerabilities, and diff check.
- Full legacy migration replay is blocked by the pre-existing UUID/`department_id` versus text/`department` incompatibility at migration `005`; this is recorded as `SEC-011`/`ARCH-007` drift.
- A separate Worker-compatible local baseline is running with synthetic-only data. Pre/post catalogs, row/model inventory, auth results, rate-limit results, and structured diff are captured under `docs/audit-remediation/evidence/`.
- The containment migration has an explicit transaction, required-object/role preflight, and non-overwriting credential backfill. It applied successfully only to `/tmp/kis-lms-worker-supabase.tzteKG`; no staging or production apply occurred.

## Authorization Matrix

| Principal | Private employee endpoint | HR mutation | Own-data endpoint | Conflicting forged headers |
| --- | --- | --- | --- | --- |
| Anonymous | 401 | 401 | 401 | N/A |
| Invalid token | 401 | 401 | 401 | Headers ignored |
| Expired token | 401 | 401 | 401 | Headers ignored |
| Employee | 403 | 403 | Allowed for own account only | Signed claim wins |
| Instructor | 403 unless explicitly scoped later | 403 | Allowed for own account only | Signed claim wins |
| HR | Allowed | Allowed within HR policy | Allowed | Signed claim wins |
| Admin | Allowed | Allowed within system policy | Allowed | Signed claim wins |
| Forged headers only | 401 | 401 | 401 | No identity created |

## Open Production Actions

- Complete an approved disposable staging restore rehearsal and decide the initial session migration/revocation window before deployment.
- Review access logs for forged identity header use.
- Purge CDN objects that previously exposed private datasets.
- Review Git history for private data; do not rewrite history without explicit approval and a coordinated backup/rotation plan.
- Remove or sanitize the protected nested `.claude/worktrees/agent-a265abb8920927875` worktree separately; it contains old data copies but is not part of the production build allowlist.
- Validate the declared Durable Object binding and fail behavior against an actual staging Cloudflare environment; repository dry-runs intentionally do not provide remote binding evidence.
- Review SheetJS provenance and changelog before future upgrades; keep the official tarball URL and lockfile integrity pinned rather than drifting back to the vulnerable npm `0.18.5` release.

## Frontend And Load Checkpoint 2026-07-27

- Subsequent route splitting does not weaken the signed session probe: every new private entry still calls `/api/auth?action=session` before importing feature code.
- Public About and learner course entries contain no credential, mock database, XLSX, QR or service-role dependency. Public and authenticated dependency-negative E2E tests pass.
- The 100k synthetic load test mutated only the isolated local PostgreSQL container, used `example.invalid` identities, and removed all `load-*` rows after measurement.
- Security statuses are unchanged: `SEC-002`, `SEC-004`, `SEC-008` remain runtime-VERIFIED; `SEC-005`, `SEC-007`, `SEC-011` keep their documented limitations.
