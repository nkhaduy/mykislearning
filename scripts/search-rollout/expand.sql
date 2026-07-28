-- Rehearsal only. Run with an approved operator role and a short lock timeout.
set lock_timeout = '2s';
set statement_timeout = '30s';
alter table public.profiles add column if not exists employee_search_document text;
alter table public.profiles add column if not exists employee_sort_name text;
-- The trigger is installed by 20260728031000_employee_search_cursor.sql.
