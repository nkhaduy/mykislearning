# Concerns

## Migration-critical risks

- Production authentication is custom and password hashes are not portable to Frappe.
- Cloudflare Workers cannot run Frappe's stateful multi-process stack.
- The current local Supabase database password is stale, so the latest physical dump cannot be refreshed without credential rotation; a prior verified logical backup and the live database remain available.
- The production Worker release is not the current `main` branch; release and rollback must use recorded deployment version IDs.
- KIS-only compliance, attendance, competency and regulatory workflows have no complete upstream equivalent and must remain archived/backlogged.

## Legacy health

Earlier monolithic UI code remains in the repository alongside split route modules. The replacement should retire the entire legacy request path rather than refactor it further.

## Evidence

- `worker/routes/auth.js`
- `docs/audit-remediation/LEGACY_MONOLITH_MAP.md`
- `docs/audit-remediation/evidence/PRODUCTION_BACKUP_RESTORE.json`
- `docs/audit-remediation/evidence/PRODUCTION_TARGET_DISCOVERY.json`
- `docs/frappe-lms-gap-analysis.md`
