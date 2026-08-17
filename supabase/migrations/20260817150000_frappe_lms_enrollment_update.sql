drop policy if exists lms_enrollments_self_update on public.enrollments;
create policy lms_enrollments_self_update on public.enrollments
for update to authenticated
using (account_id = (select private.lms_current_profile_id()))
with check (
  account_id = (select private.lms_current_profile_id())
  and exists (
    select 1 from public.courses c
    where c.id = course_id
      and c.self_enroll_enabled
      and (c.published or c.status = 'published')
  )
);
