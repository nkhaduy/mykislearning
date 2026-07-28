-- Rehearsal only. Supply :last_id from the persisted checkpoint and commit each batch.
-- Repeat until returned last_id is null. Never replace this keyset loop with OFFSET.
with batch as (
  select id
  from public.profiles
  where id::text > :'last_id'
  order by id::text
  limit 1000
)
update public.profiles p
set employee_search_document = public.kis_profile_search_document(
      p.employee_code, p.full_name, p.email, p.department, p.position, p.location, p.manager_name
    ),
    employee_sort_name = public.kis_search_normalize(p.full_name)
from batch
where p.id = batch.id;
