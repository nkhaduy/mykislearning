# KIS LMS Production Required Inputs

Production remains a separate owner-approved session. Provide these values through a secure environment or secret manager, never a tracked file:

```text
KIS_ALLOW_PRODUCTION_DEPLOYMENT=I_APPROVE_KIS_LMS_PRODUCTION_DEPLOYMENT
KIS_PRODUCTION_EXECUTION_CONFIRM=EXECUTE_REVIEWED_PRODUCTION_PLAN_ONCE
KIS_PRODUCTION_BACKUP_ID
KIS_PRODUCTION_CLOUDFLARE_ACCOUNT_ID
KIS_PRODUCTION_WORKER_NAME
KIS_PRODUCTION_HOSTNAME
KIS_PRODUCTION_SUPABASE_PROJECT_REF
KIS_PRODUCTION_DATABASE_URL
KIS_PRODUCTION_DATABASE_PASSWORD_FILE
KIS_PRODUCTION_TARGET_ALLOWLIST
KIS_PRODUCTION_ONE_TIME_APPROVAL_TOKEN
```

`KIS_PRODUCTION_TARGET_ALLOWLIST` must contain exact entries for all approved identities, for example `hostname:kislms.site,worker:mykis-learning,project:<ref>,account:<account-id>`. A bare exact hostname is accepted only for the hostname entry; it cannot authorize the other identities.

Prefer a mode-`0600` password file outside the repository for `KIS_PRODUCTION_DATABASE_PASSWORD_FILE` and a password-free `KIS_PRODUCTION_DATABASE_URL`. The deploy script creates a temporary `pgpass` file, passes only a password-free URL to the Supabase CLI, and removes the file in `finally`.

Production Worker and Supabase runtime secrets must already be installed through their provider secret mechanisms. The deployment scripts never persist secret values in repository files.
