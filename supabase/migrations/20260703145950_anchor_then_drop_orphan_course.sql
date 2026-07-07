-- Insert a placeholder course row matching the orphaned course_versions record,
-- then delete it so ON DELETE CASCADE removes the orphan automatically.
-- This unblocks 20260703150000 which adds the FK with CASCADE.
do $$
begin
  insert into public.courses(id, status, delivery_mode, created_by, data)
  values ('smooth-delete-1783070782178', 'draft', 'online', 'system-cleanup', '{"_cleanup": true}'::jsonb)
  on conflict (id) do nothing;

  delete from public.courses where id = 'smooth-delete-1783070782178';
end;
$$;
