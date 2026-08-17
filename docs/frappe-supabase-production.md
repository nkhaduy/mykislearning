# Frappe Supabase Production

- Supabase project: `mooqdtiedfamnlpitqtq`
- Frontend preview: `https://frappe-supabase-preview.kislms-frappe.pages.dev`
- Backup: `/Users/khaduy/Documents/KISVN-backups/20260817-135502-pre-frappe-ui-supabase`
- Core migrations: `20260817142000_frappe_lms_core.sql`, `20260817150000_frappe_lms_enrollment_update.sql`
- Storage buckets: `course-images`, `lesson-files`, `avatars`
- Edge Functions: none; core CRUD uses PostgREST plus RLS.

Authorization is derived from `profiles.auth_user_id` and database policies. Browser-supplied role fields are not trusted. Service-role credentials are not included in the frontend bundle.

Production verification uses dedicated HR and Employee identities whose credentials are stored in macOS Keychain. Legacy password hashes are not migrated; staff migration proceeds by verified email invitation/reset.
