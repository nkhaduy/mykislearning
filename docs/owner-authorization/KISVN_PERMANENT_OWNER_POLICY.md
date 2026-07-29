# KISVN Permanent Owner Policy

Owner: Nguyễn Khả Duy  
Status: APPROVED  
Effective from: 2026-07-29T15:20:00+07:00  
Expiration: NONE  
Revocation: only by a newer owner policy explicitly marked REVOKED or SUPERSEDED

## Scope

KISVN source code, CI, Cloudflare production resources, Supabase production resources, migrations, database business data, releases, deployments, rollbacks and production incident recovery.

Production identity:

- Project: `/Users/khaduy/Documents/KISVN`
- Domain: `https://kislms.site`
- Cloudflare Worker: `mykis-learning`
- Supabase project: the production project independently verified by repository evidence and the protected runtime
- Canonical roles: `hr`, `employee`

## Durable Authorization

Codex may perform source, CI, release, Cloudflare, Supabase, migration, business-data remediation, user administration, backup, restore-test, deployment, rollback, forward-fix, smoke-test, security-verification, evidence, and incident-recovery operations within the scope above without requesting a new owner approval for each commit or deployment.

Provider authentication and 2FA remain mandatory when Cloudflare, Supabase, macOS Keychain, or another provider requires them. This policy does not authorize bypassing authentication, 2FA, provider controls, or the protected production pipeline.

## Release Integrity

Every production release must create a fresh runtime and release manifest bound to:

- the exact Git commit and tree;
- the exact build checksum;
- the exact migration allowlist and live migration state;
- the exact production target and Worker bindings;
- the rollback Worker version;
- validation evidence;
- the SHA-256 checksum of `KISVN_PERMANENT_OWNER_POLICY.json`.

Runtime and manifest refreshes are technical integrity checks. They do not constitute a new owner-approval requirement.

## Maintenance Windows

- Timezone: `Asia/Ho_Chi_Minh`
- Default duration: 180 minutes
- Default start: five minutes after creation
- Extension: up to 120 minutes while deployment or recovery remains active
- Production mutation is forbidden outside the runtime maintenance window
- Each window must be recorded in runtime and audit evidence

## Safety Contract

Production operations must retain exact-target verification, backups before destructive database mutations, restore rehearsal for major schema or data changes, migration dry-runs, artifact and secret scanning, role/RLS/security tests, rollback readiness, post-deploy smoke tests, alert delivery, database recovery planning, and audit evidence.

No token, password, service-role key, signing secret, or plaintext credential may be committed to the repository or written to ordinary logs or reports.

