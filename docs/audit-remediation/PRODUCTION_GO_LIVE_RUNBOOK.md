# KIS LMS Production Go-Live Runbook

Do not run this package until staging is ready, the restore-tested production backup is identified, and `NO_MFA_SECURITY_ACCEPTANCE.md` is `Accepted` by an authorized owner.

1. Record production backup ID and verify restore evidence.
2. Configure production secrets through the provider secret manager.
3. Review `PRODUCTION_REQUIRED_INPUTS.md`, create the exact account/Worker/hostname/project allowlist, and provide the database password through a mode-`0600` file outside the repository.
4. Run `npm run production:plan`; verify the redacted account, Worker, hostname, project ref, backup, and approval fingerprint.
5. Run local gates and the migration dry-run in the approved window.
6. Run `npm run production:deploy -- --apply` only after the owner supplies the second one-time execution confirmation.
7. Record deployment/version IDs, run production smoke tests, and keep the previous Worker version and backup restore checkpoint available.
8. On failure, stop traffic changes, roll back the Worker version, disable search/export cutover, pause Queue delivery, and choose reviewed roll-forward or full restore.

The production scripts are plan-only by default and refuse staging targets, a database identity that does not match the approved project, missing owner acceptance, missing backup ID, incomplete exact target allowlists, or a short approval token. The database password is never placed in the Supabase CLI argument list.
