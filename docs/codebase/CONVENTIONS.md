# Conventions

## Source

- JavaScript uses ES modules, camelCase functions/variables and kebab-case route/service filenames.
- Worker handlers return standardized responses through `worker/services/responses.js`.
- API errors carry a stable code and HTTP status; request context supplies correlation IDs.
- SQL migrations are ordered, additive where possible and increasingly use guarded/idempotent DDL.

## Quality

The repository has no configured TypeScript compiler, ESLint command or unit-test runner. Playwright and build-time privacy/bundle checks are the enforced local gates.

## Evidence

- `package.json`
- `worker/services/responses.js`
- `worker/middleware/request-context.js`
- `supabase/migrations/20260727172321_reconcile_legacy_department_schema.sql`
