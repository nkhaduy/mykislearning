begin;

alter table private.export_jobs add column if not exists manual_replay_count smallint not null default 0;
alter table private.export_jobs add column if not exists last_replayed_at timestamptz;
alter table private.export_jobs add column if not exists last_replayed_by text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='export_jobs_manual_replay_limit') then
    alter table private.export_jobs add constraint export_jobs_manual_replay_limit check (manual_replay_count between 0 and 3) not valid;
  end if;
end $$;
alter table private.export_jobs validate constraint export_jobs_manual_replay_limit;

create or replace function public.service_authorize_export_requester(p_requester_id text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'active', p.account_status = 'active' and p.role in ('hr','admin') and c.profile_id is not null,
    'role', p.role,
    'account_status', p.account_status,
    'credential_version', c.credential_version
  )
  from public.profiles p
  left join private.account_credentials c on c.profile_id = p.id
  where p.id::text = p_requester_id;
$$;

create or replace function public.service_requeue_export_job(p_job_id uuid,p_actor_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_job private.export_jobs%rowtype;
begin
  select * into v_job from private.export_jobs where id=p_job_id for update;
  if not found then return jsonb_build_object('requeued',false,'state','missing'); end if;
  if v_job.status <> 'failed' then return jsonb_build_object('requeued',false,'state',v_job.status); end if;
  if v_job.manual_replay_count >= 3 then return jsonb_build_object('requeued',false,'state','replay_limit'); end if;
  update private.export_jobs set status='queued',retryable=false,error_code=null,lease_token=null,lease_expires_at=null,
    manual_replay_count=manual_replay_count+1,last_replayed_at=now(),last_replayed_by=left(p_actor_id,120),updated_at=now()
  where id=p_job_id returning * into v_job;
  return jsonb_build_object('requeued',true,'id',v_job.id,'manual_replay_count',v_job.manual_replay_count);
end;
$$;

create or replace function public.service_cleanup_export_job_metadata(p_limit integer default 500)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_deleted bigint;
begin
  with doomed as (
    select id from private.export_jobs
    where (status='expired' and updated_at < now()-interval '30 days')
       or (status='failed' and updated_at < now()-interval '14 days')
       or (status='cancelled' and updated_at < now()-interval '14 days')
    order by updated_at limit least(2000,greatest(1,p_limit)) for update skip locked
  ) delete from private.export_jobs j using doomed d where j.id=d.id;
  get diagnostics v_deleted=row_count;
  return jsonb_build_object('deleted',v_deleted);
end;
$$;

revoke all on function public.service_authorize_export_requester(text) from public,anon,authenticated;
revoke all on function public.service_requeue_export_job(uuid,text) from public,anon,authenticated;
revoke all on function public.service_cleanup_export_job_metadata(integer) from public,anon,authenticated;
grant execute on function public.service_authorize_export_requester(text) to service_role;
grant execute on function public.service_requeue_export_job(uuid,text) to service_role;
grant execute on function public.service_cleanup_export_job_metadata(integer) to service_role;

commit;
