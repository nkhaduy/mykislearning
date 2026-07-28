# KIS LMS Cloudflare Staging Provisioning Plan

Status: executed for the approved staging-only bootstrap on 2026-07-28. The commands remain an idempotent reference; production resources were not changed.

Run only after `npm run staging:verify-target` prints `STAGING_TARGET_VERIFIED`. Before every mutation, the operator must print and approve the Cloudflare account, Supabase project ref, environment, hostname, Worker, Queue, DLQ, R2 bucket, and exact command. Do not use `scripts/deploy-production.sh`.

## Intended resources

| Resource | Name |
| --- | --- |
| Worker/assets/consumer/cron | `mykis-learning-staging` |
| Queue | `kis-lms-export-staging` |
| DLQ | `kis-lms-export-dlq-staging` |
| R2 bucket | `kis-lms-exports-staging` |
| Durable Object binding | `RATE_LIMITER_DO` / `RateLimiterDurableObject` |

## Provision sequence

The command syntax below matches Wrangler `4.114.0`. Re-run `--help` if the version changes.

```bash
npm run staging:verify-target
npx wrangler whoami
npx wrangler queues list
npx wrangler r2 bucket list
npx wrangler deployments list --name mykis-learning-staging --json
```

After verifying that the exact resources are absent and no conflicting production resource exists:

```bash
npx wrangler queues create kis-lms-export-staging --message-retention-period-secs 86400
npx wrangler queues create kis-lms-export-dlq-staging --message-retention-period-secs 1209600
npx wrangler r2 bucket create kis-lms-exports-staging --location apac --storage-class Standard
npx wrangler r2 bucket dev-url disable kis-lms-exports-staging
npx wrangler r2 bucket lifecycle add kis-lms-exports-staging abort-incomplete-multipart private/report-exports/v3/ --abort-multipart-days 1
```

The current Cloudflare account rejected retention above 86,400 seconds for these Queue resources, so the staging Queue and DLQ use the provider maximum of 86,400 seconds. Database job expiry, R2 retention, DLQ audit, and hourly cleanup remain the durable retention controls.

Do not configure a public custom domain or CORS for the private export bucket. Application cleanup enforces the 12-hour PDF and 24-hour CSV/XLSX expiry through database job expiry plus the hourly scheduled handler. R2 lifecycle is a backstop for incomplete multipart uploads; its day-granularity expiration cannot replace the application retention contract.

Set staging secrets through protected Wrangler input only after the secret inventory is approved. Then validate without deploying:

```bash
npm run build
npx wrangler deploy --env staging --dry-run
npx wrangler secret list --env staging
```

Deploy staging only after database rehearsal and backup/restore validation pass:

```bash
npx wrangler deploy --env staging
```

## Post-provision read-only verification

```bash
npx wrangler queues info kis-lms-export-staging
npx wrangler queues info kis-lms-export-dlq-staging
npx wrangler r2 bucket info kis-lms-exports-staging --json
npx wrangler r2 bucket dev-url get kis-lms-exports-staging
npx wrangler r2 bucket lifecycle list kis-lms-exports-staging
npx wrangler r2 bucket cors list kis-lms-exports-staging
npx wrangler deployments list --name mykis-learning-staging --json
```

Expected results: staging suffixes on every resource, no public R2 development URL, no CORS, private Worker-proxy downloads only, Queue consumer settings matching `wrangler.jsonc`, SQLite Durable Object migration present, and hourly UTC cron configured.
