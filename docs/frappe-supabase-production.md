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
