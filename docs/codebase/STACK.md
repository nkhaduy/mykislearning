# Stack

## Runtime

- Production is a Cloudflare Worker serving static assets from `dist/` and JavaScript API routes from `worker/`.
- The browser application is framework-free ES modules with route-specific modules under `src/`.
- Supabase Postgres is the primary database; server requests use `@supabase/supabase-js` with the service role.
- Node dependencies are installed with npm. Playwright provides browser tests and Wrangler provides build/deploy tooling.

## Build and deploy

- `npm run build` copies and validates the static artifact.
- `npm run cf:deploy` builds and deploys the Worker.
- `scripts/deploy-production.sh` applies migrations, deploys, and performs smoke checks.

## Evidence

- `package.json`
- `wrangler.jsonc`
- `scripts/build-static.mjs`
- `scripts/deploy-production.sh`
