# Ephemeral Migration Preflight

Date: 2026-07-27 (Asia/Ho_Chi_Minh)

Runtime: local Supabase CLI 2.107.0, PostgreSQL 17.6.1.136, Colima profile `kis-lms-ephemeral`; project workdir is under `/tmp/kis-lms-worker-supabase.tzteKG` and is not linked to the repository project-ref.

Migration: `supabase/migrations/20260726090000_security_containment.sql`

## Safety checks

| Check | Result | Evidence |
| --- | --- | --- |
| Explicit transaction | PASS | Migration begins with `begin;` and ends with `commit;`; a fail-fast preflight `DO` block runs before object creation. |
| Required source objects | PASS | `public.profiles` exists with `id`, `avatar_url`, and `password_status`. |
| Required roles | PASS | `anon`, `authenticated`, and `service_role` exist and cannot log in. |
| Existing private objects | PASS | `private` schema and all three containment tables are absent before apply. |
| Idempotency primitives | PASS WITH LIMITATION | Schema/table/index creation, grants, RLS enablement and profile cleanup are repeat-safe. Credential backfill uses `ON CONFLICT DO NOTHING` to preserve an existing private credential. Apply is still a one-time migration and requires catalog comparison on rerun. |
| Data to migrate | PASS | Three synthetic profiles carry legacy `__pwd__:` markers; no legacy `password_status` hash markers exist. Hash material is not printed. |
| Lock risk | REVIEW REQUIRED | `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and the looped ACL changes can take strong table/catalog locks; profile cleanup scans `public.profiles`. Apply only during a controlled maintenance window after backup/catalog capture. |
| Secret/data safety | PASS | No production connection, row payload, password, token or connection string is stored in the committed evidence. |

## Known schema limitation

The Worker-compatible baseline contains 66 public tables but not `user_roles`, `course_assignments`, `lesson_progress`, `content_versions`, or `file_uploads`. `enrollments`, `content_progress`, `course_versions`, and `learning_record_attachments` are the available canonical equivalents for this runtime. This is schema drift evidence for `SEC-011`/`ARCH-007`, not a reason to create synthetic policy objects.
