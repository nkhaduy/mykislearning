begin;

create schema if not exists private;

create table if not exists private.export_jobs (
  id uuid primary key,
  requester_id text not null references public.profiles(id) on delete restrict,
  report_type text not null,
  format text not null,
  parameters jsonb not null default '{}'::jsonb,
  permission_snapshot jsonb not null default '{}'::jsonb,
  policy_version text not null,
  status text not null default 'queued' check (status in ('queued','running','completed','failed','cancelled','expired')),
  progress smallint not null default 0 check (progress between 0 and 100),
  attempt_count smallint not null default 0 check (attempt_count >= 0),
  max_attempts smallint not null default 5 check (max_attempts between 1 and 10),
  error_code text,
  retryable boolean not null default false,
  output_object_key text,
  output_file_name text,
  output_content_type text,
  output_size_bytes bigint,
  output_checksum text,
  idempotency_key text not null,
  lease_token uuid,
  lease_expires_at timestamptz,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  unique (requester_id, idempotency_key)
);

create index if not exists export_jobs_requester_created_idx
  on private.export_jobs(requester_id, created_at desc);
create index if not exists export_jobs_status_lease_idx
  on private.export_jobs(status, lease_expires_at, created_at);
create index if not exists export_jobs_expiry_idx
  on private.export_jobs(expires_at) where status in ('completed','failed','cancelled');

revoke all on table private.export_jobs from public, anon, authenticated;

create or replace function public.service_create_export_job(
  p_id uuid,
  p_requester_id text,
  p_report_type text,
  p_format text,
  p_parameters jsonb,
  p_permission_snapshot jsonb,
  p_policy_version text,
  p_idempotency_key text,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job private.export_jobs%rowtype;
  v_created boolean := true;
begin
  insert into private.export_jobs(
    id, requester_id, report_type, format, parameters, permission_snapshot,
    policy_version, idempotency_key, expires_at
  ) values (
    p_id, p_requester_id, p_report_type, p_format,
    coalesce(p_parameters, '{}'::jsonb), coalesce(p_permission_snapshot, '{}'::jsonb),
    p_policy_version, p_idempotency_key, p_expires_at
  )
  on conflict (requester_id, idempotency_key) do nothing
  returning * into v_job;

  if not found then
    v_created := false;
    select * into v_job from private.export_jobs
    where requester_id = p_requester_id and idempotency_key = p_idempotency_key;
  end if;

  return jsonb_build_object(
    'id', v_job.id,
    'status', v_job.status,
    'created', v_created,
    'created_at', v_job.created_at,
    'expires_at', v_job.expires_at
  );
end;
$$;

create or replace function public.service_get_export_job(
  p_job_id uuid,
  p_requester_id text,
  p_is_admin boolean default false
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', j.id,
    'report_type', j.report_type,
    'format', j.format,
    'status', case when j.expires_at <= now() and j.status = 'completed' then 'expired' else j.status end,
    'progress', j.progress,
    'attempt_count', j.attempt_count,
    'error_code', j.error_code,
    'file_name', j.output_file_name,
    'file_size', j.output_size_bytes,
    'checksum', j.output_checksum,
    'created_at', j.created_at,
    'started_at', j.started_at,
    'completed_at', j.completed_at,
    'cancelled_at', j.cancelled_at,
    'expires_at', j.expires_at
  )
  from private.export_jobs j
  where j.id = p_job_id
    and (j.requester_id = p_requester_id or p_is_admin);
$$;

create or replace function public.service_claim_export_job(
  p_job_id uuid,
  p_lease_token uuid,
  p_lease_seconds integer default 120
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_job private.export_jobs%rowtype;
begin
  select * into v_job from private.export_jobs where id = p_job_id for update;
  if not found then return jsonb_build_object('claimed', false, 'state', 'missing'); end if;
  if v_job.expires_at <= now() then
    update private.export_jobs set status = 'expired', updated_at = now() where id = p_job_id;
    return jsonb_build_object('claimed', false, 'state', 'expired');
  end if;
  if v_job.status in ('completed','cancelled','expired') then
    return jsonb_build_object('claimed', false, 'state', v_job.status);
  end if;
  if v_job.status = 'running' and v_job.lease_expires_at > now() then
    return jsonb_build_object('claimed', false, 'state', 'leased');
  end if;
  if v_job.attempt_count >= v_job.max_attempts then
    update private.export_jobs set status = 'failed', error_code = 'MAX_ATTEMPTS_EXCEEDED', retryable = false, updated_at = now()
    where id = p_job_id;
    return jsonb_build_object('claimed', false, 'state', 'failed');
  end if;

  update private.export_jobs set
    status = 'running',
    attempt_count = attempt_count + 1,
    started_at = coalesce(started_at, now()),
    lease_token = p_lease_token,
    lease_expires_at = now() + make_interval(secs => least(600, greatest(30, p_lease_seconds))),
    retryable = false,
    error_code = null,
    updated_at = now()
  where id = p_job_id
  returning * into v_job;

  return jsonb_build_object(
    'claimed', true,
    'id', v_job.id,
    'requester_id', v_job.requester_id,
    'report_type', v_job.report_type,
    'format', v_job.format,
    'parameters', v_job.parameters,
    'permission_snapshot', v_job.permission_snapshot,
    'policy_version', v_job.policy_version,
    'attempt_count', v_job.attempt_count,
    'max_attempts', v_job.max_attempts,
    'lease_token', v_job.lease_token
  );
end;
$$;

create or replace function public.service_update_export_job_progress(
  p_job_id uuid,
  p_lease_token uuid,
  p_progress integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_updated integer;
begin
  update private.export_jobs set
    progress = least(99, greatest(progress, p_progress)),
    lease_expires_at = now() + interval '2 minutes',
    updated_at = now()
  where id = p_job_id and status = 'running' and lease_token = p_lease_token and expires_at > now();
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.service_complete_export_job(
  p_job_id uuid,
  p_lease_token uuid,
  p_object_key text,
  p_file_name text,
  p_content_type text,
  p_size_bytes bigint,
  p_checksum text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_updated integer;
begin
  update private.export_jobs set
    status = 'completed', progress = 100, completed_at = now(), updated_at = now(),
    output_object_key = p_object_key, output_file_name = p_file_name,
    output_content_type = p_content_type, output_size_bytes = p_size_bytes,
    output_checksum = p_checksum, lease_token = null, lease_expires_at = null,
    error_code = null, retryable = false
  where id = p_job_id and status = 'running' and lease_token = p_lease_token and expires_at > now();
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.service_fail_export_job(
  p_job_id uuid,
  p_lease_token uuid,
  p_error_code text,
  p_retryable boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_job private.export_jobs%rowtype;
begin
  select * into v_job from private.export_jobs where id = p_job_id for update;
  if not found or v_job.lease_token is distinct from p_lease_token then
    return jsonb_build_object('updated', false, 'retry', false);
  end if;
  update private.export_jobs set
    status = case when p_retryable and attempt_count < max_attempts then 'queued' else 'failed' end,
    retryable = p_retryable and attempt_count < max_attempts,
    error_code = left(coalesce(p_error_code, 'EXPORT_FAILED'), 120),
    lease_token = null, lease_expires_at = null, updated_at = now()
  where id = p_job_id
  returning * into v_job;
  return jsonb_build_object('updated', true, 'retry', v_job.status = 'queued', 'attempt_count', v_job.attempt_count);
end;
$$;

create or replace function public.service_cancel_export_job(
  p_job_id uuid,
  p_requester_id text,
  p_is_admin boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_job private.export_jobs%rowtype;
begin
  select * into v_job from private.export_jobs
  where id = p_job_id and (requester_id = p_requester_id or p_is_admin)
  for update;
  if not found then return null; end if;
  if v_job.status not in ('queued','running') then
    return jsonb_build_object('id', v_job.id, 'status', v_job.status, 'cancelled', false);
  end if;
  update private.export_jobs set status = 'cancelled', cancelled_at = now(), updated_at = now(),
    lease_token = null, lease_expires_at = null
  where id = p_job_id returning * into v_job;
  return jsonb_build_object('id', v_job.id, 'status', v_job.status, 'cancelled', true);
end;
$$;

create or replace function public.service_get_export_download(
  p_job_id uuid,
  p_requester_id text,
  p_is_admin boolean default false
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when j.expires_at <= now() then jsonb_build_object('available', false, 'state', 'expired')
    when j.status <> 'completed' then jsonb_build_object('available', false, 'state', j.status)
    else jsonb_build_object(
      'available', true, 'object_key', j.output_object_key, 'file_name', j.output_file_name,
      'content_type', j.output_content_type, 'size_bytes', j.output_size_bytes,
      'checksum', j.output_checksum
    )
  end
  from private.export_jobs j
  where j.id = p_job_id and (j.requester_id = p_requester_id or p_is_admin);
$$;

create or replace function public.service_export_employee_chunk(
  p_parameters jsonb,
  p_cursor_name text default null,
  p_cursor_id text default null,
  p_limit integer default 500
)
returns table (
  id text,
  employee text,
  employee_code text,
  department text,
  job_title text,
  assigned bigint,
  completed bigint,
  in_progress bigint,
  not_started bigint,
  overdue bigint,
  completion_rate numeric,
  last_activity_at timestamptz,
  sort_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  with employee_page as materialized (
    select p.*
    from public.profiles p
    where p.role = 'employee'
      and p.account_status <> 'disabled'
      and (p.notes is null or p.notes not ilike '%"soft_deleted":true%')
      and (coalesce(p_parameters->>'department', '') = '' or p.department = p_parameters->>'department')
      and (coalesce(p_parameters->>'jobTitle', '') = '' or p.position = p_parameters->>'jobTitle')
      and (coalesce(p_parameters->>'employeeId', '') = '' or p.id::text = p_parameters->>'employeeId')
      and (
        coalesce(p_parameters->>'q', '') = ''
        or p.employee_search_document like '%' || public.kis_search_normalize(p_parameters->>'q') || '%'
      )
      and (p_cursor_name is null or (p.employee_sort_name, p.id::text) > (p_cursor_name, p_cursor_id))
    order by p.employee_sort_name, p.id::text
    limit least(1000, greatest(1, p_limit))
  )
  select
    p.id::text,
    p.full_name,
    p.employee_code,
    p.department,
    p.position,
    coalesce(stats.assigned, 0),
    coalesce(stats.completed, 0),
    coalesce(stats.in_progress, 0),
    coalesce(stats.not_started, 0),
    coalesce(stats.overdue, 0),
    case when coalesce(stats.assigned, 0) = 0 then null
      else round((coalesce(stats.completed, 0)::numeric / stats.assigned::numeric) * 100, 1) end,
    stats.last_activity_at,
    p.employee_sort_name
  from employee_page p
  left join lateral (
    select
      count(*) as assigned,
      count(*) filter (where e.status = 'completed') as completed,
      count(*) filter (where e.status = 'inProgress') as in_progress,
      count(*) filter (where e.status = 'notStarted') as not_started,
      count(*) filter (
        where e.status not in ('completed','cancelled','exempted')
          and (e.data->>'deadline') ~ '^\d{4}-\d{2}-\d{2}$'
          and (e.data->>'deadline')::date < current_date
      ) as overdue,
      max(e.updated_at) as last_activity_at
    from public.enrollments e
    where e.account_id::text = p.id::text
      and (coalesce(p_parameters->>'courseId', '') = '' or e.course_id::text = p_parameters->>'courseId')
      and (coalesce(p_parameters->>'status', '') = '' or e.status = p_parameters->>'status')
      and (coalesce(p_parameters->>'fromIso', '') = '' or e.updated_at >= (p_parameters->>'fromIso')::timestamptz)
      and (coalesce(p_parameters->>'toIsoExclusive', '') = '' or e.updated_at < (p_parameters->>'toIsoExclusive')::timestamptz)
  ) stats on true
  order by p.employee_sort_name, p.id::text;
$$;

create or replace function public.service_expire_export_jobs(p_limit integer default 100)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_keys jsonb;
begin
  -- A consumer that reaches the platform DLQ can leave a lease behind. Mark
  -- bounded stale leases failed so the UI and retention job do not see them
  -- as permanently running.
  with stale_running as (
    select id from private.export_jobs
    where status = 'running'
      and lease_expires_at <= now()
      and expires_at > now()
    order by lease_expires_at
    limit least(500, greatest(1, p_limit))
    for update skip locked
  )
  update private.export_jobs j
  set status = 'failed', retryable = false, error_code = 'EXPORT_LEASE_EXPIRED',
      lease_token = null, lease_expires_at = null, updated_at = now()
  from stale_running s
  where j.id = s.id;

  with expired as (
    update private.export_jobs set status = 'expired', lease_token = null,
      lease_expires_at = null, updated_at = now()
    where id in (
      select id from private.export_jobs
      where expires_at <= now() and status in ('queued','running','completed','failed','cancelled')
      order by expires_at limit least(500, greatest(1, p_limit))
      for update skip locked
    )
    returning output_object_key
  )
  select coalesce(jsonb_agg(output_object_key) filter (where output_object_key is not null), '[]'::jsonb)
  into v_keys from expired;
  return v_keys;
end;
$$;

revoke all on function public.service_create_export_job(uuid, text, text, text, jsonb, jsonb, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.service_get_export_job(uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.service_claim_export_job(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.service_update_export_job_progress(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.service_complete_export_job(uuid, uuid, text, text, text, bigint, text) from public, anon, authenticated;
revoke all on function public.service_fail_export_job(uuid, uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.service_cancel_export_job(uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.service_get_export_download(uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.service_export_employee_chunk(jsonb, text, text, integer) from public, anon, authenticated;
revoke all on function public.service_expire_export_jobs(integer) from public, anon, authenticated;

grant execute on function public.service_create_export_job(uuid, text, text, text, jsonb, jsonb, text, text, timestamptz) to service_role;
grant execute on function public.service_get_export_job(uuid, text, boolean) to service_role;
grant execute on function public.service_claim_export_job(uuid, uuid, integer) to service_role;
grant execute on function public.service_update_export_job_progress(uuid, uuid, integer) to service_role;
grant execute on function public.service_complete_export_job(uuid, uuid, text, text, text, bigint, text) to service_role;
grant execute on function public.service_fail_export_job(uuid, uuid, text, boolean) to service_role;
grant execute on function public.service_cancel_export_job(uuid, text, boolean) to service_role;
grant execute on function public.service_get_export_download(uuid, text, boolean) to service_role;
grant execute on function public.service_export_employee_chunk(jsonb, text, text, integer) to service_role;
grant execute on function public.service_expire_export_jobs(integer) to service_role;

commit;
