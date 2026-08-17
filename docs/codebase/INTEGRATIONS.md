# Integrations

## Production services

- Cloudflare Workers and custom domain `kislms.site` provide compute, static assets, cron and DNS/proxy.
- Supabase project `mooqdtiedfamnlpitqtq` provides Postgres and storage primitives.
- YouTube/external media URLs are accepted by course content.
- XLSX, QR decoding and QR generation run in browser/admin workflows.

Secrets are supplied to Cloudflare and deployment automation; service-role material must never reach static assets. Vercel configuration remains in the repository but its historical deployment is no longer active.

## Evidence

- `wrangler.jsonc`
- `vercel.json`
- `worker/routes/config.js`
- `docs/audit-remediation/evidence/PRODUCTION_TARGET_DISCOVERY.json`
- `package.json`
