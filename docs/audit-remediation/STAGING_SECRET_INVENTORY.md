# KIS LMS Staging Secret Inventory

Last reviewed: 2026-07-28. This document records names and governance only. It must never contain secret values, connection strings, tokens, or full fingerprints.

The staging Worker is deployed as `mykis-learning-staging`. Values were generated independently with CSPRNG and installed through Wrangler's protected secret deployment input. Values remain only in the mode-0600 private runtime outside the repository; this document contains governance metadata only.

| Name | Purpose | Owner role | Configuration date | Rotation policy | Status |
| --- | --- | --- | --- | --- | --- |
| `JWT_SECRET` | Signs short-lived access/session tokens | Security owner | 2026-07-28 | Rotate before initial staging deploy and after suspected disclosure | Configured in staging Worker |
| `REFRESH_TOKEN_HASH_SECRET` | HMACs refresh tokens and request metadata used by session security | Security owner | 2026-07-28 | Independent from `JWT_SECRET`; rotate with a session-revocation plan | Configured in staging Worker |
| `CURSOR_SIGNING_SECRET` | Signs report and employee-search cursors | Security owner | 2026-07-28 | Independent staging value; rotate with cursor invalidation | Configured in staging Worker |
| `RATE_LIMIT_KEY_SECRET` | HMACs rate-limit dimensions before Durable Object storage | Security owner | 2026-07-28 | Independent staging value; rotate after privacy/security events | Configured in staging Worker |
| `AUDIT_IP_HASH_SALT` | Hashes bounded IP metadata in audit/request context | Security owner | 2026-07-28 | Rotate under an approved audit-correlation transition | Configured in staging Worker |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only database access for the Worker | Database owner | 2026-07-28 | Staging-only key; rotate before go-live rehearsal and after exposure | Configured with staging project key only |
| `SETUP_ADMIN_ONE_TIME_KEY` | Optional one-time bootstrap gate | Security owner | Not configured | Generate per approved bootstrap event, then disable and rotate | Disabled by default; do not configure unless approved |
| `DEPLOYMENT_TEST_ACCOUNTS` | Optional synthetic staging smoke-test credentials | QA/security owner | 2026-07-28 | Synthetic accounts only; rotate/delete after rehearsal | Configured for bounded staging smoke window |

## Non-secret staging configuration

| Name | Purpose | Required staging value/state | Status |
| --- | --- | --- | --- |
| `SUPABASE_URL` | Supabase Data API endpoint | Explicit staging project URL | Configured at staging deploy |
| `SUPABASE_ANON_KEY` | Browser-safe publishable/legacy anon key returned by `/api/config` | Staging project key only | Configured at staging deploy |
| `PUBLIC_APP_ORIGIN` | Canonical staging application origin | Explicit allowlisted staging origin | Configured at staging deploy |
| `CORS_ALLOWED_ORIGINS` | Exact allowed browser origins | Staging origins only | Configured at staging deploy |
| `APP_ENV` | Enables production-like fail-closed behavior | `staging` | Configured in `wrangler.jsonc` |
| `MAX_CONCURRENT_SESSIONS` | Session cap | Reviewed numeric staging value | Configured as `10` |
| `ALLOW_LEGACY_IDENTITY_HEADERS` | Legacy identity-header compatibility | Unset/false | Configured false |
| `SETUP_ADMIN_ENABLED` | Public bootstrap availability | Unset/false except approved one-time event | Configured false |
| `DEPLOYMENT_TEST_ACCOUNT_ENABLED` | Synthetic deployment test login | False except controlled smoke window | Enabled only for current staging rehearsal |
| `LOCAL_DEV_ADMIN_ENABLED` | Local-only admin path | Unset/false | Configured false |

Password credentials use versioned PBKDF2-SHA256 with a per-record random salt. The current architecture has no shared credential-encryption secret; adding one would require a separate reviewed migration and rotation design.

## Configuration rules

- Generate each staging secret independently with a CSPRNG and at least 256 bits of entropy where the value is an opaque key.
- Do not reuse development or production values.
- Set secrets through Wrangler's protected secret input, never command arguments, shell history, repository files, snapshots, or CI logs.
- Before mutation, compare the staging service-role SHA-256 fingerprint against an approved production fingerprint denylist without printing the key.
- After configuration, record only the secret name, date, owner, rotation policy, and a shortened fingerprint when operationally necessary.
