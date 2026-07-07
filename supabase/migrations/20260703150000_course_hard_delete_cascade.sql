-- Migration: change course_versions.course_id FK from RESTRICT to CASCADE
-- This enables hard delete of courses without needing to manually delete versions first.
-- The worker still deletes versions explicitly for audit/impact tracking,
-- but CASCADE ensures the DB-level constraint doesn't block deletion.

-- Drop the existing RESTRICT constraint and replace with CASCADE
alter table public.course_versions
  drop constraint if exists course_versions_course_id_fkey;

-- Remove any orphaned course_versions rows whose parent course was deleted
-- (test fixtures may leave these behind)
delete from public.course_versions cv
where not exists (select 1 from public.courses c where c.id = cv.course_id);

alter table public.course_versions
  add constraint course_versions_course_id_fkey
  foreign key (course_id) references public.courses(id) on delete cascade;
