# Production Clean-Reset Plan

Production mutation: `NONE`
Production deploy: `NONE`
Owner: Nguyễn Khả Duy
Recommended maintenance duration: 120 minutes (hard minimum: 90 minutes)

## Two-role reset contract

- Preserve schema, migrations, RLS/grants, system configuration, infrastructure and the owner-approved bootstrap HR account.
- Canonicalize legacy Admin profiles to `hr` before preserving the bootstrap identity.
- Purge Trainer application profiles, mappings, sessions and business/test data according to the explicit allowlist. Trainer Auth users are deleted only by an explicit owner-approved user-ID allowlist; otherwise access is revoked/disabled.
- Purge duplicate/owner-approved business data only from the explicit 74-table `PURGE_TABLES` allowlist.
- Never target `auth`, `storage`, `supabase_migrations`, extensions or Cloudflare resources.

## Preconditions

- Mode-`0600` runtime supplies the exact project, backup, schema checksum, bootstrap HR ID and owner-approved row-count plan.
- The 13 migration aliases match the approved byte-identical mapping.
- The linked dry-run lists exactly the 8 approved pending migrations (7 existing plus `20260729022415_consolidate_roles_to_hr_and_employee.sql`).
- Disposable restore, clean reset, rollback restore, role migration replay and bootstrap HR recovery pass.
- The release manifest, quality gates, alert delivery and active >=90-minute maintenance window pass protected verification.

## Rehearsal evidence

- Fresh replay: `PASS`.
- Legacy restore fixture: `PASS` (34 history rows, 13 aliases, synthetic blockers).
- Clean reset and role migration: `PASS` (`8/8` pending migrations).
- Idempotency: `PASS` (second reset pass, 0 migrations applied).
- Schema equivalence: `PASS`.
- Final counts: HR >= 1, Admin `0`, Trainer `0`, unknown `0`.
- Allowlist: 74 tables; checksum `ea81e890bb275c65edf51420556cce9bdfc5021a7ffe28eea809a768902e720b`.

Evidence: `evidence/PRODUCTION_CLEAN_RESET_REHEARSAL.json` and `evidence/CLEAN_ROOM_ROLE_AUDIT.json`.

## Protected commands

```text
npm run production:clean-reset:plan
npm run production:clean-reset:apply-approved
npm run production:clean-reset:verify
npm run production:clean-reset:rollback
```

No apply, linked migration repair, reset or deployment command was run in this preparation step.
