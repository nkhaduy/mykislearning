-- Unified learning history and certificate workflow.
-- Additive and safe to re-run. Does not drop/truncate existing data.

create table if not exists public.learning_records (
  id text primary key default gen_random_uuid()::text,
  account_id text not null,
  record_type text not null default 'external_course'
    check (record_type in ('internal_online_course','internal_offline_training','external_course','self_learning')),
  source_type text not null default 'employee_submission'
    check (source_type in ('system','employee_submission','hr_entry','import')),
  source_id text,
  title text not null,
  category text,
  provider text,
  delivery_method text,
  start_date date,
  completion_date date,
  duration_hours numeric(8,2) not null default 0 check (duration_hours >= 0),
  result text,
  description text,
  skills text,
  status text not null default 'draft'
    check (status in ('draft','submitted','in_review','needs_revision','approved','rejected','archived')),
  submitted_by text,
  reviewed_by text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  revision_note text,
  rejection_reason text,
  created_by_role text default 'employee',
  data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists learning_records_account_status_idx on public.learning_records(account_id, status, created_at desc);
create index if not exists learning_records_review_idx on public.learning_records(status, submitted_at desc);
create unique index if not exists learning_records_source_unique_idx
  on public.learning_records(source_type, source_id, account_id)
  where source_id is not null and source_type in ('employee_submission','hr_entry','import');

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'learning_records_account_id_fkey') then
    alter table public.learning_records
      add constraint learning_records_account_id_fkey foreign key (account_id) references public.profiles(id) on delete restrict;
  end if;
end $$;

alter table public.employee_certifications add column if not exists learning_record_id text;
alter table public.employee_certifications add column if not exists score text;
alter table public.employee_certifications add column if not exists no_expiry boolean not null default false;
alter table public.employee_certifications add column if not exists verification_status text not null default 'approved';
alter table public.employee_certifications add column if not exists submitted_by text;
alter table public.employee_certifications add column if not exists reviewed_by text;
alter table public.employee_certifications add column if not exists approved_at timestamptz;
alter table public.employee_certifications add column if not exists submitted_at timestamptz;
alter table public.employee_certifications add column if not exists revision_note text;
alter table public.employee_certifications add column if not exists rejection_reason text;
alter table public.employee_certifications add column if not exists source_type text default 'hr_entry';
alter table public.employee_certifications add column if not exists source text;
alter table public.employee_certifications add column if not exists data jsonb not null default '{}';

create index if not exists emp_cert_verification_idx on public.employee_certifications(verification_status, created_at desc);
create index if not exists emp_cert_learning_record_idx on public.employee_certifications(learning_record_id);

create table if not exists public.learning_record_attachments (
  id text primary key default gen_random_uuid()::text,
  learning_record_id text references public.learning_records(id) on delete cascade,
  certificate_id text,
  file_name text not null,
  storage_path text not null,
  mime_type text not null,
  file_size bigint not null default 0,
  uploaded_by text,
  created_at timestamptz not null default now(),
  check (learning_record_id is not null or certificate_id is not null)
);
create index if not exists learning_record_attachments_record_idx on public.learning_record_attachments(learning_record_id);
create index if not exists learning_record_attachments_cert_idx on public.learning_record_attachments(certificate_id);

create table if not exists public.approval_events (
  id text primary key default gen_random_uuid()::text,
  entity_type text not null check (entity_type in ('learning_record','certificate')),
  entity_id text not null,
  actor_account_id text,
  action text not null,
  from_status text,
  to_status text,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists approval_events_entity_idx on public.approval_events(entity_type, entity_id, created_at desc);

do $$ begin
  alter table public.hr_tasks drop constraint if exists hr_tasks_task_type_check;
  alter table public.hr_tasks add constraint hr_tasks_task_type_check check (task_type in (
    'password_reset', 'account_unlock', 'external_training', 'certification',
    'course_approval', 'assignment', 'data_issue',
    'external_learning_approval', 'certificate_verification', 'learning_record_revision'
  ));
end $$;

insert into storage.buckets(id, name, public)
values ('learning-evidence','learning-evidence',false)
on conflict (id) do update set public = false;

insert into public.learning_records(
  id, account_id, record_type, source_type, source_id, title, provider, description,
  duration_hours, status, submitted_by, reviewed_by, submitted_at, reviewed_at,
  approved_at, rejected_at, revision_note, rejection_reason, data, created_at, updated_at
)
select
  'legacy-ext-' || id,
  account_id,
  'external_course',
  'employee_submission',
  id,
  course_name,
  provider,
  learning_content,
  0,
  case status
    when 'accepted' then 'approved'
    when 'needs_info' then 'needs_revision'
    when 'rejected' then 'rejected'
    else 'submitted'
  end,
  account_id,
  reviewed_by,
  created_at,
  reviewed_at,
  case when status = 'accepted' then reviewed_at else null end,
  case when status = 'rejected' then reviewed_at else null end,
  case when status = 'needs_info' then hr_feedback else null end,
  case when status = 'rejected' then hr_feedback else null end,
  jsonb_build_object('legacy_table','external_training_requests','study_time',study_time,'cost',cost,'evidence_url',evidence_url,'note',note),
  created_at,
  updated_at
from public.external_training_requests
on conflict do nothing;

update public.employee_certifications
set source = 'list1.xls',
    source_type = 'import',
    data = coalesce(data, '{}'::jsonb) || jsonb_build_object('source','list1.xls')
where (source is null or source = '')
  and (
    coalesce(notes,'') ilike '%list1.xls%'
    or coalesce(evidence_path,'') ilike '%list1.xls%'
  );

do $$ begin
  if not exists (select 1 from information_schema.triggers where trigger_name = 'learning_records_updated_at') then
    create trigger learning_records_updated_at before update on public.learning_records
      for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from information_schema.triggers where trigger_name = 'employee_certifications_updated_at_008') then
    create trigger employee_certifications_updated_at_008 before update on public.employee_certifications
      for each row execute function public.set_updated_at();
  end if;
end $$;
