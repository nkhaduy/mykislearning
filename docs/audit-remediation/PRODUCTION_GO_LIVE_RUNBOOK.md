# KIS LMS Production Go-Live Runbook

Do not run this package until staging is ready, the restore-tested production backup is identified, and `NO_MFA_SECURITY_ACCEPTANCE.md` is `Accepted` by an authorized owner.

1. Record production backup ID and verify restore evidence.
2. Configure production secrets through the provider secret manager.
3. Review `PRODUCTION_REQUIRED_INPUTS.md` and the canonical mode-`0600` secure runtime outside the repository. Database access uses Supabase linked ephemeral credentials; no database password is placed on the command line.
4. Run `npm run production:plan`; verify the redacted account, Worker, hostname, project ref, backup, and approval fingerprint.
5. Run local gates and the migration dry-run in the approved window.
6. Run `npm run production:deploy-approved` only after the plan prints the literal GO line and the maintenance window is active.
7. Record deployment/version IDs, run production smoke tests, and keep the previous Worker version and backup restore checkpoint available.
8. On failure, stop traffic changes, roll back the Worker version, disable search/export cutover, pause Queue delivery, and choose reviewed roll-forward or full restore.
9. If the rolled-back Worker is incompatible with the migrated schema, do not redeploy in the same session. Verify the exact root cause, use only a verified database restore/PITR path, and keep further deployment blocked when recovery is unavailable.

The 2026-07-29 release attempt followed this procedure: the Worker rollback succeeded, the root cause was proven as `service_report_overview` referencing missing `enrollments.created_at`, and Supabase reported PITR disabled. Browser smoke was therefore stopped and no roll-forward was attempted.

The production scripts are plan-only by default and refuse staging/unknown targets, stale release checksums, dirty tracked source, missing owner acceptance, missing or consumed approval tokens, incomplete target allowlists, failed backup restore, missing secret names, unverified alerts, or an invalid maintenance window. Secret values are never printed, and production deploy always reruns preflight before consuming the one-time token.
