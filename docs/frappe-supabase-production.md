# Frappe Supabase Production

- Supabase project: `mooqdtiedfamnlpitqtq`
- Production URL: `https://kislms.site`
- Cloudflare Pages project: `kislms-frappe`
- Frontend preview: `https://frappe-supabase-preview.kislms-frappe.pages.dev`
- Backup: `/Users/khaduy/Documents/KISVN-backups/20260817-135502-pre-frappe-ui-supabase`
- Core migrations: `20260817142000_frappe_lms_core.sql`, `20260817150000_frappe_lms_enrollment_update.sql`
- Storage buckets: `course-images`, `lesson-files`, `avatars`
- Edge Functions: none; core CRUD uses PostgREST plus RLS.

Authorization is derived from `profiles.auth_user_id` and database policies. Browser-supplied role fields are not trusted. Service-role credentials are not included in the frontend bundle.

Production verification uses dedicated HR and Employee identities whose credentials are stored in macOS Keychain. Legacy password hashes are not migrated; staff migration proceeds by verified email invitation/reset.

## Production cutover (2026-08-17)

- Deployed migration commit: `53f7ded3e6c74ddc5d6d977369947a9bf035a99d`.
- Pages custom domain `kislms.site` is Active with SSL enabled.
- Apex DNS changed from the managed Worker record (`AAAA 100::`) to a proxied CNAME targeting `kislms-frappe.pages.dev`.
- `www.kislms.site` remains a proxied CNAME to `kislms.site`; the Google site-verification TXT record is unchanged.
- The `kislms.site` custom-domain binding was removed from legacy Worker `mykis-learning`. The Worker and version `b7c2c3a2-af8c-4881-834c-a96bd75d8c1c` remain available for rollback.
- Supabase Auth Site URL is `https://kislms.site`; the redirect allow list is `https://kislms.site/**`.

Rollback restores the `kislms.site` custom domain on `mykis-learning` from the Worker's Domains tab. Cloudflare then recreates the managed Worker DNS record. Remove the Pages custom-domain binding first if Cloudflare reports an ownership conflict; do not delete the Worker or legacy Supabase data.

## Legacy public shell release (2026-08-17)

- Source commit: `b57c6deb35978e773edbcdba75f7f53d86125b14`.
- Preview deployment: `240f2a46-8600-4e80-90af-b2b69069668f` (`public-shell-preview`).
- Production deployment: `2105d5a8-70cb-4b90-96bf-6fc0bd667fc4` (`main`).
- Previous production deployment: `76fb25b0-3d83-4d4c-a648-e366abe9065e` at source commit `53f7ded3e6c74ddc5d6d977369947a9bf035a99d`.
- Public routes `/`, `/about-kis`, `/about`, and `/login` use the isolated legacy KIS public presentation. Protected routes remain `/courses`, `/courses/:id`, `/courses/:courseId/lessons/:lessonId`, and `/admin`.
- Login, refresh persistence, logout, Employee lesson progress, HR authoring, mobile layouts, direct SPA refresh, console, and network checks passed on `https://kislms.site`.
- `nkhaduy@gmail.com` is linked to an active Supabase profile with role `hr`; production login, refresh, `/admin`, and logout passed.

Rollback promotes Pages deployment `76fb25b0-3d83-4d4c-a648-e366abe9065e`. No Supabase schema or LMS data rollback is required.
