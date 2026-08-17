# Testing

## Automated gates

- `npm run build` copies route assets, scans the artifact for private data and enforces bundle budgets.
- Playwright tests live in `e2e/` and run against Chrome projects defined by repository configuration.
- GitHub Actions quality gates are defined in `.github/workflows/quality-gates.yml`.
- Production release evidence includes authentication, authorization, migration and smoke-test records under `docs/audit-remediation/evidence/`.

## Gaps

- No general JavaScript unit-test runner is configured for Worker/services.
- Current browser coverage is oriented around the legacy product and will be replaced by Frappe-native E2E coverage.

## Evidence

- `package.json`
- `playwright.config.js`
- `e2e/public-readonly.spec.js`
- `.github/workflows/quality-gates.yml`
