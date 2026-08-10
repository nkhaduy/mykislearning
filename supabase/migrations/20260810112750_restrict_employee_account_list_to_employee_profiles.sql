begin;

create or replace function public.service_list_employee_accounts(
  p_search text default '',
  p_status text default '',
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id text,
  employee_code text,
  full_name text,
  email text,
  username text,
  department text,
  "position" text,
  account_status text,
  password_status text,
  must_change boolean,
  password_reveal_status text,
  total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id::text,
    p.employee_code,
    p.full_name,
    p.email,
    i.username,
    p.department,
    p.position,
    p.account_status,
    p.password_status,
    coalesce(c.must_change, false),
    case when e.profile_id is null then 'unavailable_until_reset' else 'available' end,
    count(*) over()
  from public.profiles p
  join private.account_role_grants g
    on g.profile_id = p.id::text and g.role = 'employee'
  left join private.account_login_identities i on i.profile_id = p.id::text
  left join private.account_credentials c on c.profile_id = p.id::text
  left join private.password_escrow e on e.profile_id = p.id::text
  where p.role = 'employee'
    and (coalesce(p_status, '') = '' or p.account_status = p_status)
    and (
      coalesce(p_search, '') = ''
      or lower(coalesce(p.full_name, '')) like '%' || lower(btrim(p_search)) || '%'
      or lower(coalesce(p.employee_code, '')) like '%' || lower(btrim(p_search)) || '%'
      or lower(coalesce(p.email, '')) like '%' || lower(btrim(p_search)) || '%'
      or lower(coalesce(i.username, '')) like '%' || lower(btrim(p_search)) || '%'
    )
  order by lower(p.full_name), p.id::text
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.service_list_employee_accounts(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.service_list_employee_accounts(text, text, integer, integer)
  to service_role;

commit;
