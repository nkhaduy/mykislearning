# Frappe Learning Upstream

- Repository: `https://github.com/frappe/lms`
- Production baseline: tag `v2.61.0`
- Pinned commit: `d3bfe97d178eb076310dffd7407106bcdec15d67`
- Audit comparison: `develop` commit `d61e9a3a19a5bbdb23004537f09b8d7e844dc3a8` from 2026-08-13
- License: GNU Affero General Public License v3 or later (`AGPL-3.0-or-later`)
- Deployment image base: `frappe/frappe_docker` commit `600744eb07e86584a7fdf3f9d5e4336c08f30f39`

## Deployment note

The published `ghcr.io/frappe/lms:v2.61.0` and `stable` images inspected on 2026-08-17 contain only the `frappe` app. The KIS deployment therefore builds a layered image from the pinned Frappe Docker commit with `payments` (`version-15`) and LMS (`v2.61.0`) declared in `frappe/apps.json`. The resulting image was verified to contain all three apps and report LMS `2.61.0`.

Frappe Learning cannot run on the existing Cloudflare Workers runtime: it requires MariaDB, Redis, background workers, scheduler, websocket service, and persistent site/file volumes. Production cutover requires a Frappe-compatible VM or managed host plus its credentials. Until that host exists, `kislms.site`, the Cloudflare Worker, and Supabase remain unchanged as the production/rollback environment.

## Customization policy

Run upstream Frappe Learning unchanged wherever possible. KIS code is limited to a separate migration/custom app, deployment configuration, light brand settings, role assignment and stable legacy-ID fields. Do not copy Frappe components into the Worker application and do not port the KIS design system into Frappe.

AGPL license and source notices must remain available. Any server-side modification to the covered application offered over a network must have corresponding source made available as required by AGPL section 13.

## Updating

1. Fetch upstream tags and verify the release notes and Frappe compatibility range.
2. Update the pinned tag and commit in deployment configuration.
3. Rebuild a disposable staging site from backup/export data.
4. Run migration dry-run, unit tests, upstream tests and Employee/HR E2E flows.
5. Run `bench migrate`, then production smoke tests before switching traffic.
6. Record the new image digest, app commit and rollback image/database snapshot.

Direct patches to upstream core require a file in `docs/frappe-patches/` explaining the reason and rebase impact. The preferred alternative is a Frappe hook, custom field, fixture or separate KIS app.

## Evidence

- Upstream `README.md`
- Upstream `license.txt`
- Upstream `pyproject.toml`
- Upstream `package.json`
- Upstream `lms/hooks.py`
