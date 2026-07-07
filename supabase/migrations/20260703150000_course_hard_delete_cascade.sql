-- Migration: change course_versions.course_id FK from RESTRICT to CASCADE
-- This enables hard delete of courses without needing to manually delete versions first.
-- The worker still deletes versions explicitly for audit/impact tracking,
-- but CASCADE ensures the DB-level constraint doesn't block deletion.

-- Drop the existing RESTRICT constraint and replace with CASCADE
alter table public.course_versions
  drop constraint if exists course_versions_course_id_fkey;

-- Remove the known orphaned test fixture row that was not cleaned up
delete from public.course_versions where course_id = 'smooth-delete-1783070782178';

alter table public.course_versions
  add constraint course_versions_course_id_fkey
  foreign key (course_id) references public.courses(id) on delete cascade;
