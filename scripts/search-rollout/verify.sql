-- Read-only verification queries for staging rehearsal.
select count(*) as unbackfilled_rows
from public.profiles
where employee_search_document is null or employee_sort_name is null;
select indexrelid::regclass as index_name, indisvalid, indisready
from pg_catalog.pg_index
where indexrelid::text like 'profiles_%search%';
select phase, lockers_total, lockers_done, blocks_total, blocks_done
from pg_catalog.pg_stat_progress_create_index;
explain (analyze, buffers, format json)
select id, full_name from public.profiles
where employee_search_document like '%nguyen%'
order by employee_sort_name, id limit 50;
