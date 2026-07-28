begin;

create extension if not exists pg_trgm;

create or replace function public.kis_search_normalize(p_value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select pg_catalog.translate(
    pg_catalog.lower(coalesce(p_value, '')),
    'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ',
    'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd'
  );
$$;

create or replace function public.kis_profile_search_document(
  p_employee_code text,
  p_full_name text,
  p_email text,
  p_department text,
  p_position text,
  p_location text,
  p_manager_name text
)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select public.kis_search_normalize(pg_catalog.concat_ws(
    ' ', p_employee_code, p_full_name, p_email, p_department, p_position, p_location, p_manager_name
  ));
$$;

alter table public.profiles
  add column if not exists employee_search_document text,
  add column if not exists employee_sort_name text;

create or replace function public.kis_profiles_search_fields_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.employee_search_document := public.kis_profile_search_document(
    new.employee_code, new.full_name, new.email, new.department, new.position, new.location, new.manager_name
  );
  new.employee_sort_name := public.kis_search_normalize(new.full_name);
  return new;
end;
$$;

drop trigger if exists profiles_search_fields_write on public.profiles;
create trigger profiles_search_fields_write
before insert or update of employee_code, full_name, email, department, position, location, manager_name
on public.profiles for each row execute function public.kis_profiles_search_fields_write();

create or replace function public.service_search_profiles(
  p_search text default '',
  p_department text default '',
  p_status text default '',
  p_location text default '',
  p_position text default '',
  p_manager text default '',
  p_cursor_name text default null,
  p_cursor_id text default null,
  p_direction text default 'asc',
  p_limit integer default 51
)
returns table (
  id text,
  employee_code text,
  full_name text,
  email text,
  role text,
  department text,
  "position" text,
  account_status text,
  location text,
  manager_name text,
  updated_at timestamptz,
  sort_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text := public.kis_search_normalize(pg_catalog.left(pg_catalog.btrim(coalesce(p_search, '')), 80));
  v_limit integer := least(101, greatest(2, coalesce(p_limit, 51)));
begin
  if p_direction not in ('asc', 'desc') then
    raise exception 'invalid direction' using errcode = '22023';
  end if;

  if p_direction = 'desc' then
    return query
      select
        p.id::text,
        p.employee_code,
        p.full_name,
        p.email,
        p.role,
        p.department,
        p.position,
        p.account_status,
        p.location,
        p.manager_name,
        p.updated_at,
        coalesce(p.employee_sort_name, public.kis_search_normalize(p.full_name))
      from public.profiles p
      where (p.notes is null or p.notes not ilike '%"soft_deleted":true%')
        and (p.notes is null or p.notes not ilike '%"is_demo":true%')
        and (coalesce(p_department, '') = '' or p.department = p_department)
        and (coalesce(p_status, '') = '' or p.account_status = p_status)
        and (coalesce(p_location, '') = '' or p.location = p_location)
        and (coalesce(p_position, '') = '' or p.position = p_position)
        and (coalesce(p_manager, '') = '' or p.manager_name = p_manager)
        and (
          v_search = ''
          or (
            pg_catalog.length(v_search) < 3
            and (
              public.kis_search_normalize(p.employee_code) like v_search || '%'
              or public.kis_search_normalize(p.email) like v_search || '%'
              or public.kis_search_normalize(p.full_name) like v_search || '%'
            )
          )
          or (
            pg_catalog.length(v_search) >= 3
            and coalesce(p.employee_search_document, public.kis_profile_search_document(p.employee_code,p.full_name,p.email,p.department,p.position,p.location,p.manager_name)) like '%' || v_search || '%'
          )
        )
        and (
          p_cursor_name is null
          or (coalesce(p.employee_sort_name, public.kis_search_normalize(p.full_name)), p.id::text) < (p_cursor_name, p_cursor_id)
        )
      order by coalesce(p.employee_sort_name, public.kis_search_normalize(p.full_name)) desc, p.id::text desc
      limit v_limit;
  else
    return query
      select
        p.id::text,
        p.employee_code,
        p.full_name,
        p.email,
        p.role,
        p.department,
        p.position,
        p.account_status,
        p.location,
        p.manager_name,
        p.updated_at,
        coalesce(p.employee_sort_name, public.kis_search_normalize(p.full_name))
      from public.profiles p
      where (p.notes is null or p.notes not ilike '%"soft_deleted":true%')
        and (p.notes is null or p.notes not ilike '%"is_demo":true%')
        and (coalesce(p_department, '') = '' or p.department = p_department)
        and (coalesce(p_status, '') = '' or p.account_status = p_status)
        and (coalesce(p_location, '') = '' or p.location = p_location)
        and (coalesce(p_position, '') = '' or p.position = p_position)
        and (coalesce(p_manager, '') = '' or p.manager_name = p_manager)
        and (
          v_search = ''
          or (
            pg_catalog.length(v_search) < 3
            and (
              public.kis_search_normalize(p.employee_code) like v_search || '%'
              or public.kis_search_normalize(p.email) like v_search || '%'
              or public.kis_search_normalize(p.full_name) like v_search || '%'
            )
          )
          or (
            pg_catalog.length(v_search) >= 3
            and coalesce(p.employee_search_document, public.kis_profile_search_document(p.employee_code,p.full_name,p.email,p.department,p.position,p.location,p.manager_name)) like '%' || v_search || '%'
          )
        )
        and (
          p_cursor_name is null
          or (coalesce(p.employee_sort_name, public.kis_search_normalize(p.full_name)), p.id::text) > (p_cursor_name, p_cursor_id)
        )
      order by coalesce(p.employee_sort_name, public.kis_search_normalize(p.full_name)), p.id::text
      limit v_limit;
  end if;
end;
$$;

revoke all on function public.kis_search_normalize(text) from public, anon, authenticated;
revoke all on function public.kis_profile_search_document(text, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.kis_profiles_search_fields_write() from public, anon, authenticated;
revoke all on function public.service_search_profiles(text, text, text, text, text, text, text, text, text, integer) from public, anon, authenticated;

grant execute on function public.kis_search_normalize(text) to service_role;
grant execute on function public.kis_profile_search_document(text, text, text, text, text, text, text) to service_role;
grant execute on function public.kis_profiles_search_fields_write() to service_role;
grant execute on function public.service_search_profiles(text, text, text, text, text, text, text, text, text, integer) to service_role;

commit;
