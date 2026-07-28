# KIS LMS Staging Bootstrap Result

Date: 2026-07-28

Result: **PASS - STAGING-ONLY RESOURCES BOOTSTRAPPED**

## Contract correction

- Added one canonical contract in `scripts/staging/staging-contract.mjs`.
- Normalized legacy aliases and failed closed on conflicts.
- Updated guard, bootstrap, preflight, npm commands, provisioning docs, and rollback/readiness commands to use the same contract.
- Added immutable repository production denylists with source evidence and bypass tests.

## Discovery and targets

- Cloudflare account: `b9ae...3f33`; production Worker evidence found, but never mutated.
- Supabase organization: `sprb...`; existing unknown/linked projects were denied by default.
- New project: `kis-lms-staging`, ref `vwaw...kewm`, region `ap-northeast-2`.
- Worker/hostname: `mykis-learning-staging` / `mykis-learning-staging.nkhaduy.workers.dev`.
- Queue/DLQ/R2: `kis-lms-export-staging`, `kis-lms-export-dlq-staging`, `kis-lms-exports-staging`.
- Durable Object: `RATE_LIMITER_DO`; cron: hourly.

## Secrets

Staging-only CSPRNG values were installed for `JWT_SECRET`, `REFRESH_TOKEN_HASH_SECRET`, `CURSOR_SIGNING_SECRET`, `RATE_LIMIT_KEY_SECRET`, `AUDIT_IP_HASH_SALT`, `SUPABASE_SERVICE_ROLE_KEY`, and synthetic deployment accounts. Values were never printed or committed. The private runtime is mode `0600` outside the repository.

## Provision/deploy result

- Bootstrap plan and apply are idempotent and target verification passes.
- Fresh hosted migrations, DB evidence, PostgREST timeout/connection reuse, logical restore, smoke, 24-format export integration, and rollback pass.
- Stable version after rollback: `1c8d06e9-393e-4eff-917c-5761a23ddc89`.
- Queue retention is 86,400 seconds due to the account maximum; application/R2 cleanup remains configured.
- Real integration found and fixed R2 multipart API handling and Queue batch concurrency. Final integration passes 30/30.

## Boundaries

No production Worker, database, Queue, R2, secrets, DNS, routes, or feature flags were changed. No-MFA acceptance remains Pending and was not signed by the implementation agent.

Technical conclusion: **STAGING READY WITH OPERATIONAL FOLLOW-UP**.

Production conclusion: **PRODUCTION BLOCKED** pending owner acceptance, critical alert provisioning, and the separate production backup/secrets/approval package.
