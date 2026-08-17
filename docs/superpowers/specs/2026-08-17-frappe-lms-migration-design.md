# Frappe LMS Frontend on Supabase Design

## Objective

Replace the authenticated legacy KIS interface with the official Frappe Learning `v2.61.0` Vue frontend while replacing every native Frappe backend dependency with Supabase. The production system remains a static SPA on Cloudflare and requires no Frappe Framework, MariaDB, Redis, workers, scheduler, websocket server, VM, or Frappe Cloud.

## Source and upstream boundary

Track `https://github.com/frappe/lms` at commit `d3bfe97d178eb076310dffd7407106bcdec15d67`. Keep upstream source in a pinned git submodule and keep KIS code outside it wherever possible. Direct upstream edits are limited to build bootstrapping, imports that select the KIS adapter, route guards, and removal of hard runtime imports such as `sites/common_site_config.json`. Every direct edit is recorded in `docs/frappe-ui-upstream.md`.

## Architecture

The browser loads the upstream Vue 3 and Frappe UI application. A compatibility package implements the Frappe UI resource contracts used by upstream (`resourceFetcher`, list resources, method calls, session, uploads, and the small subset of realtime behavior needed by phase one). That package calls Supabase Auth, PostgREST/RPC, and Storage. Components receive Frappe-shaped objects so database column names do not leak into upstream pages.

Cloudflare serves immutable built assets and SPA fallback routes. The frontend bundle contains only the Supabase project URL and publishable/anon key. Elevated account-management operations, if required, use narrowly scoped Supabase Edge Functions that validate the caller's HR role; service-role credentials never enter the browser or repository.

## Phase-one product slice

Phase one ports login/logout/session refresh, protected routes, course catalogue, course details, enrollment, lesson player, previous/next navigation, persisted progress, profile, and HR course/chapter/lesson management. Upstream quiz, batches, programs, certificates, jobs, payments, email integrations, Raven, SCORM, programming exercises, and advanced reporting are hidden or marked deferred until their backend contracts are implemented.

## Data model and compatibility

Reuse compatible legacy tables where safe, then add an additive LMS compatibility migration for `profiles`, `courses`, `chapters`, `lessons`, `enrollments`, and `lesson_progress`. UUID auth identity is authoritative. Compatibility views/RPCs use `security_invoker` unless a privileged operation genuinely requires `security definer`; privileged functions live outside exposed schemas, validate `auth.uid()`, set a fixed `search_path`, and revoke default `PUBLIC` execution.

Course and lesson adapters return upstream names such as `name`, `title`, `published`, `image`, `instructors`, `chapters`, and `lessons`. Stable legacy IDs are retained in dedicated columns so migration reruns upsert rather than duplicate.

## Authorization and security

Authorization roles are `employee` and `hr`, stored in protected profile/application data rather than user-editable metadata. RLS permits authenticated users to read published courses, their own enrollment/progress/profile, and approved storage objects. HR receives course-authoring and learner-management policies. UPDATE policies include both `USING` and `WITH CHECK`; Employee cannot mutate another user's progress or any authoring record. Lesson HTML is sanitized with upstream DOMPurify before rendering.

Storage uses separate course-media, lesson-files, and avatars buckets with MIME/size restrictions. Public delivery is enabled only for assets intended for catalogue display; private lesson documents use authenticated access or signed URLs.

## Migration and rollback

Legacy rows are read from the linked production Supabase project and normalized in an idempotent SQL/TypeScript migration. The migration is additive and never truncates or overwrites without a verified backup. Legacy UI and Worker routes remain available as rollback infrastructure until production Employee and HR journeys pass; after cutover they are removed from the active request path, not immediately deleted.

## Verification

Unit tests cover adapter shapes, role guards, course ordering, enrollment, progress upserts, course completion calculation, and upload paths. Database tests exercise RLS as Employee and HR. Playwright covers Employee and HR journeys on desktop and mobile. Production is PASS only after `https://kislms.site` is ready, direct refresh works, authenticated flows pass, and browser console plus failed network requests are clean.

## License

Preserve Frappe Learning's AGPL-3.0-or-later notices and attribution. Publish the corresponding modified frontend source and build instructions for the deployed version, and document the exact upstream commit and local patch set.
