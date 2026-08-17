# Structure

## Application

- `src/app/`: browser bootstrap, router and route registry.
- `src/features/`: public, auth, learner, HR and operational route modules.
- `src/shared/`: API, internationalization and common UI shell code.
- `worker/`: Cloudflare Worker entry point, middleware, services and API route handlers.
- `supabase/migrations/`: ordered production schema history.
- `e2e/`: Playwright flows and production verification tests.
- `scripts/`: build, import, migration and deployment automation.
- `docs/audit-remediation/`: production architecture, security and rollback evidence.

Generated `dist/`, `test-results/` and Wrangler state are not source architecture.

## Evidence

- `src/app/bootstrap.js`
- `src/app/route-registry.js`
- `worker/index.js`
- `worker/router.js`
- `docs/codebase/.codebase-scan.txt`
