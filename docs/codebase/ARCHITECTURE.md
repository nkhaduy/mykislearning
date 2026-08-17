# Architecture

## Current request flow

Cloudflare routes `/api/*` through `worker/index.js` and `worker/router.js`; handlers create a privileged Supabase client and return JSON. Other requests resolve to built static assets with SPA fallback. Browser modules store a custom bearer token and call the Worker API.

Authentication is application-owned: `worker/routes/auth.js` validates PBKDF2 hashes stored on profile records and signs HMAC tokens. Authorization checks `employee`, `hr` and `admin` roles in route middleware/handlers.

## Migration impact

The architecture is incompatible with native Frappe Learning, which owns server rendering/API, sessions, permissions, background jobs, Redis and MariaDB. The Worker becomes rollback-only after cutover; Cloudflare remains the edge/DNS layer.

## Evidence

- `wrangler.jsonc`
- `worker/index.js`
- `worker/router.js`
- `worker/routes/auth.js`
- `worker/services/supabase.js`
