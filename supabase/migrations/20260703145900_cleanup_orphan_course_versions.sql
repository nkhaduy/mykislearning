-- Remove orphaned course_versions rows where the parent course no longer exists.
-- This unblocks the 20260703150000 course_hard_delete_cascade migration.
delete from public.course_versions cv
where not exists (
  select 1 from public.courses c where c.id = cv.course_id
);
