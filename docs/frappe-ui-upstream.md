# Frappe Learning UI Upstream

## Implemented sync

Upstream is stored as a reproducible blobless sparse snapshot under `vendor/frappe-lms`. Run `scripts/sync-frappe-ui.sh`; `vendor/frappe-lms/manifest.json` records the pinned source, excluded MP4/Apple splash media, and tree checksum. The deployable phase-one shell and Supabase adapter live under `frontend/`.

- Repository: `https://github.com/frappe/lms`
- Tag: `v2.61.0`
- Commit: `d3bfe97d178eb076310dffd7407106bcdec15d67`
- License: AGPL-3.0-or-later
- Frontend entry: `frontend/src/main.js`
- Router: `frontend/src/router.js`

## Integration policy

The production UI is built from the official Vue/Frappe UI source and visual language. KIS owns a separate Supabase compatibility layer under `frontend/src/data/supabase/`.

Direct upstream changes are restricted to selecting the KIS resource fetcher, replacing Frappe session/route redirects, removing the hard socket/common-site-config import, and excluding deferred routes. No visual redesign or legacy KIS component is introduced after login.

## Current audit

The pinned frontend contains 403 Vue/TypeScript/JavaScript files. Core reusable surfaces include layouts, desktop/mobile navigation, home, catalogue, course cards, course details, outline, lesson player/sidebar, progress UI, profile, course editor, lesson editor, loading states, and responsive behavior.

Backend coupling is concentrated in Frappe UI resources but appears throughout pages: generic `frappe.client` CRUD/search calls, LMS Python methods, session redirects, upload endpoints, Jinja boot data, and socket.io. `docs/frappe-supabase-api-map.md` records the replacement strategy.

## Sync procedure

1. Fetch upstream tags and inspect release notes/license changes.
2. Update the submodule to the selected commit in a dedicated branch.
3. Reapply the documented minimal integration patches.
4. Run adapter contract tests, upstream Vitest tests, build, Employee/HR Playwright, and visual comparison.
5. Publish the modified source and build instructions required by AGPL before production cutover.

## License obligations

Retain upstream copyright and AGPL notices. Because the modified application is offered over a network, make the corresponding deployed source, local patches, dependency lockfile, and build instructions available in compliance with AGPL section 13. Do not remove upstream attribution.
