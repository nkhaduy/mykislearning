-- ============================================================
-- Phase 8: Content Versioning, Publication Governance,
-- and Retraining Workflow.
-- Safe to re-run. Additive only; no progress/result resets.
-- ============================================================

create extension if not exists pgcrypto;

alter table public.courses add column if not exists current_version_id text;
alter table public.quizzes add column if not exists current_version_id text;
alter table public.learning_paths add column if not exists current_version_id text;

create table if not exists public.course_versions (
  id text primary key default gen_random_uuid()::text,
  course_id text not null references public.courses(id) on delete restrict,
  version_number int not null check (version_number > 0),
  status text not null default 'draft' check (status in ('draft','in_review','published','retired','archived')),
  title text,
  description text,
  objectives jsonb not null default '[]',
  content_snapshot jsonb not null default '[]',
  duration_minutes int,
  delivery_mode text,
  completion_rules jsonb not null default '{}',
  quiz_version_id text,
  source_data jsonb not null default '{}',
  change_type text not null default 'patch' check (change_type in ('patch','minor','major')),
  change_summary text not null default 'Initial backfill',
  created_from_version_id text references public.course_versions(id) on delete set null,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_by text,
  published_at timestamptz,
  retired_by text,
  retired_at timestamptz,
  unique (course_id, version_number)
);

create table if not exists public.quiz_versions (
  id text primary key default gen_random_uuid()::text,
  quiz_id text not null references public.quizzes(id) on delete restrict,
  version_number int not null check (version_number > 0),
  status text not null default 'draft' check (status in ('draft','in_review','published','retired','archived')),
  title text,
  instructions text,
  passing_score int check (passing_score is null or passing_score between 0 and 100),
  time_limit_minutes int,
  max_attempts int,
  configuration jsonb not null default '{}',
  source_data jsonb not null default '{}',
  change_type text not null default 'patch' check (change_type in ('patch','minor','major')),
  change_summary text not null default 'Initial backfill',
  created_from_version_id text references public.quiz_versions(id) on delete set null,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_by text,
  published_at timestamptz,
  retired_by text,
  retired_at timestamptz,
  unique (quiz_id, version_number)
);

create table if not exists public.quiz_question_versions (
  id text primary key default gen_random_uuid()::text,
  quiz_version_id text not null references public.quiz_versions(id) on delete cascade,
  question_key text not null,
  position int not null default 0,
  question_type text,
  prompt text,
  options jsonb not null default '[]',
  correct_answer jsonb,
  explanation text,
  points numeric,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (quiz_version_id, question_key)
);

create table if not exists public.learning_path_versions (
  id text primary key default gen_random_uuid()::text,
  learning_path_id text not null references public.learning_paths(id) on delete restrict,
  version_number int not null check (version_number > 0),
  status text not null default 'draft' check (status in ('draft','in_review','published','retired','archived')),
  title text,
  description text,
  completion_mode text,
  completion_rules jsonb not null default '{}',
  source_data jsonb not null default '{}',
  change_type text not null default 'patch' check (change_type in ('patch','minor','major')),
  change_summary text not null default 'Initial backfill',
  created_from_version_id text references public.learning_path_versions(id) on delete set null,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_by text,
  published_at timestamptz,
  retired_by text,
  retired_at timestamptz,
  unique (learning_path_id, version_number)
);

create table if not exists public.learning_path_version_steps (
  id text primary key default gen_random_uuid()::text,
  learning_path_version_id text not null references public.learning_path_versions(id) on delete cascade,
  source_step_id text,
  step_key text not null,
  position int not null default 0,
  title text,
  description text,
  resource_type text not null check (resource_type in ('course','quiz','training_session','document','external_link')),
  resource_id text,
  resource_version_id text,
  is_required boolean not null default true,
  prerequisite_step_key text,
  configuration jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (learning_path_version_id, step_key),
  unique (learning_path_version_id, position)
);

create table if not exists public.retraining_reviews (
  id text primary key default gen_random_uuid()::text,
  entity_type text not null check (entity_type in ('course','quiz','learning_path','compliance_program')),
  entity_id text not null,
  from_version_id text,
  to_version_id text not null,
  status text not null default 'pending' check (status in ('pending','approved','dismissed','applied','cancelled')),
  recommended_scope text not null default 'completed_users',
  target_rule jsonb not null default '{}',
  affected_employee_count int not null default 0 check (affected_employee_count >= 0),
  decision text,
  decision_reason text,
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_type, entity_id, from_version_id, to_version_id)
);

create table if not exists public.retraining_assignments (
  id text primary key default gen_random_uuid()::text,
  review_id text not null references public.retraining_reviews(id) on delete cascade,
  employee_id text not null,
  assignment_type text not null check (assignment_type in ('course','learning_path','compliance_cycle')),
  assignment_id text,
  version_id text not null,
  status text not null default 'created' check (status in ('created','skipped','failed')),
  error_code text,
  created_at timestamptz not null default now(),
  unique (review_id, employee_id, assignment_type)
);

alter table public.enrollments add column if not exists course_version_id text references public.course_versions(id) on delete restrict;
alter table public.quiz_attempts add column if not exists quiz_version_id text references public.quiz_versions(id) on delete restrict;
alter table public.learning_path_assignments add column if not exists learning_path_version_id text references public.learning_path_versions(id) on delete restrict;
alter table public.learning_path_step_progress add column if not exists version_step_id text references public.learning_path_version_steps(id) on delete set null;
alter table public.compliance_cycles add column if not exists resource_version_id text;
alter table public.compliance_programs add column if not exists resource_version_policy text not null default 'latest_published' check (resource_version_policy in ('latest_published','pinned'));
alter table public.compliance_programs add column if not exists pinned_resource_version_id text;
alter table public.compliance_assignments add column if not exists resource_version_id text;
alter table public.compliance_completion_records add column if not exists resource_version_id text;

create index if not exists course_versions_course_status_idx on public.course_versions(course_id, status, version_number desc);
create index if not exists quiz_versions_quiz_status_idx on public.quiz_versions(quiz_id, status, version_number desc);
create index if not exists quiz_question_versions_quiz_version_idx on public.quiz_question_versions(quiz_version_id, position);
create index if not exists lp_versions_path_status_idx on public.learning_path_versions(learning_path_id, status, version_number desc);
create index if not exists lp_version_steps_version_idx on public.learning_path_version_steps(learning_path_version_id, position);
create index if not exists enrollments_course_version_idx on public.enrollments(course_version_id);
create index if not exists quiz_attempts_quiz_version_idx on public.quiz_attempts(quiz_version_id);
create index if not exists lpa_path_version_idx on public.learning_path_assignments(learning_path_version_id);
create index if not exists compliance_cycles_resource_version_idx on public.compliance_cycles(resource_version_id);
create index if not exists retraining_reviews_status_idx on public.retraining_reviews(status, created_at desc);

create or replace function public.block_published_version_mutation()
returns trigger language plpgsql as $$
begin
  if old.status in ('published','retired','archived') then
    if tg_op = 'DELETE' then
      raise exception 'PUBLISHED_VERSION_IMMUTABLE';
    end if;
    if row_to_json(old)::jsonb - 'status' - 'retired_by' - 'retired_at' - 'updated_at'
       is distinct from row_to_json(new)::jsonb - 'status' - 'retired_by' - 'retired_at' - 'updated_at' then
      raise exception 'PUBLISHED_VERSION_IMMUTABLE';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists course_versions_immutable on public.course_versions;
create trigger course_versions_immutable before update or delete on public.course_versions
for each row execute function public.block_published_version_mutation();

drop trigger if exists quiz_versions_immutable on public.quiz_versions;
create trigger quiz_versions_immutable before update or delete on public.quiz_versions
for each row execute function public.block_published_version_mutation();

drop trigger if exists learning_path_versions_immutable on public.learning_path_versions;
create trigger learning_path_versions_immutable before update or delete on public.learning_path_versions
for each row execute function public.block_published_version_mutation();

insert into public.quiz_versions (
  quiz_id, version_number, status, title, instructions, passing_score, time_limit_minutes,
  max_attempts, configuration, source_data, change_type, change_summary, created_by, published_at
)
select
  q.id,
  1,
  case when q.status = 'archived' then 'archived' when q.status = 'published' then 'published' else 'draft' end,
  coalesce(q.data->>'title', q.data->>'name'),
  q.data->>'instructions',
  nullif(q.data->>'passingScore','')::int,
  nullif(q.data->>'timeLimitMinutes','')::int,
  nullif(q.data->>'maxAttempts','')::int,
  q.data,
  q.data,
  'patch',
  'Initial backfill',
  q.created_by,
  case when q.status = 'published' then coalesce(q.updated_at, q.created_at) end
from public.quizzes q
where not exists (select 1 from public.quiz_versions v where v.quiz_id = q.id and v.version_number = 1);

insert into public.quiz_question_versions (
  quiz_version_id, question_key, position, question_type, prompt, options, correct_answer, explanation, points, metadata
)
select
  v.id,
  qq.id,
  qq.sort_order,
  coalesce(qq.data->>'type', qq.data->>'questionType'),
  coalesce(qq.data->>'prompt', qq.data->>'question', qq.data->>'text'),
  coalesce(qq.data->'options', '[]'::jsonb),
  coalesce(qq.data->'correctAnswer', qq.data->'correct_answer', qq.data->'answer'),
  qq.data->>'explanation',
  nullif(coalesce(qq.data->>'points', qq.data->>'score'), '')::numeric,
  qq.data
from public.quiz_questions qq
join public.quiz_versions v on v.quiz_id = qq.quiz_id and v.version_number = 1
where not exists (
  select 1 from public.quiz_question_versions qv
  where qv.quiz_version_id = v.id and qv.question_key = qq.id
);

insert into public.course_versions (
  course_id, version_number, status, title, description, objectives, content_snapshot,
  duration_minutes, delivery_mode, completion_rules, quiz_version_id, source_data,
  change_type, change_summary, created_by, published_at
)
select
  c.id,
  1,
  case when c.status = 'archived' then 'archived' when c.status = 'published' then 'published' else 'draft' end,
  coalesce(c.data->>'title', c.data->>'name'),
  c.data->>'description',
  coalesce(c.data->'objectives', '[]'::jsonb),
  coalesce((
    select jsonb_agg(jsonb_build_object('id', cc.id, 'type', cc.type, 'sort_order', cc.sort_order, 'data', cc.data) order by cc.sort_order)
    from public.course_content cc where cc.course_id = c.id
  ), '[]'::jsonb),
  nullif(coalesce(c.data->>'durationMinutes', c.data->>'duration_minutes'), '')::int,
  c.delivery_mode,
  coalesce(c.data->'completionRules', c.data->'completion_rules', '{}'::jsonb),
  (
    select qv.id from public.quizzes q
    join public.quiz_versions qv on qv.quiz_id = q.id and qv.version_number = 1
    where q.course_id = c.id
    order by q.created_at
    limit 1
  ),
  c.data,
  'patch',
  'Initial backfill',
  c.created_by,
  case when c.status = 'published' then coalesce(c.updated_at, now()) end
from public.courses c
where not exists (select 1 from public.course_versions v where v.course_id = c.id and v.version_number = 1);

insert into public.learning_path_versions (
  learning_path_id, version_number, status, title, description, completion_mode,
  completion_rules, source_data, change_type, change_summary, created_by, published_at
)
select
  lp.id,
  1,
  case when lp.status = 'archived' then 'archived' when lp.status = 'published' then 'published' else 'draft' end,
  lp.title,
  lp.description,
  lp.completion_mode,
  coalesce(lp.data->'completionRules', lp.data->'completion_rules', '{}'::jsonb),
  lp.data,
  'patch',
  'Initial backfill',
  lp.created_by,
  lp.published_at
from public.learning_paths lp
where not exists (select 1 from public.learning_path_versions v where v.learning_path_id = lp.id and v.version_number = 1);

insert into public.learning_path_version_steps (
  learning_path_version_id, source_step_id, step_key, position, title, description,
  resource_type, resource_id, resource_version_id, is_required, prerequisite_step_key, configuration
)
select
  lpv.id,
  s.id,
  s.id,
  s.position,
  s.title_override,
  s.description_override,
  s.step_type,
  s.resource_id,
  case
    when s.step_type = 'course' then (select cv.id from public.course_versions cv where cv.course_id = s.resource_id and cv.version_number = 1 limit 1)
    when s.step_type = 'quiz' then (select qv.id from public.quiz_versions qv where qv.quiz_id = s.resource_id and qv.version_number = 1 limit 1)
    else null
  end,
  s.is_required,
  s.prerequisite_step_id,
  jsonb_build_object(
    'due_offset_days', s.due_offset_days,
    'estimated_duration_minutes', s.estimated_duration_minutes,
    'data', s.data
  )
from public.learning_path_steps s
join public.learning_path_versions lpv on lpv.learning_path_id = s.learning_path_id and lpv.version_number = 1
where not exists (
  select 1 from public.learning_path_version_steps vs
  where vs.learning_path_version_id = lpv.id and vs.step_key = s.id
);

update public.quizzes q
set current_version_id = v.id
from public.quiz_versions v
where v.quiz_id = q.id and v.version_number = 1 and q.current_version_id is null;

update public.courses c
set current_version_id = v.id
from public.course_versions v
where v.course_id = c.id and v.version_number = 1 and c.current_version_id is null;

update public.learning_paths lp
set current_version_id = v.id
from public.learning_path_versions v
where v.learning_path_id = lp.id and v.version_number = 1 and lp.current_version_id is null;

update public.enrollments e
set course_version_id = c.current_version_id
from public.courses c
where c.id = e.course_id and e.course_version_id is null;

update public.quiz_attempts a
set quiz_version_id = q.current_version_id
from public.quizzes q
where q.id = a.quiz_id and a.quiz_version_id is null;

update public.learning_path_assignments a
set learning_path_version_id = lp.current_version_id
from public.learning_paths lp
where lp.id = a.learning_path_id and a.learning_path_version_id is null;

update public.learning_path_step_progress p
set version_step_id = vs.id
from public.learning_path_assignments a
join public.learning_path_version_steps vs on vs.learning_path_version_id = a.learning_path_version_id
where a.id = p.assignment_id
  and vs.source_step_id = p.step_id
  and p.version_step_id is null;

update public.compliance_cycles cy
set resource_version_id = case
  when cy.resource_type = 'course' then (select c.current_version_id from public.courses c where c.id = cy.resource_id)
  when cy.resource_type = 'learning_path' then (select lp.current_version_id from public.learning_paths lp where lp.id = cy.resource_id)
  else null
end
where cy.resource_version_id is null;

update public.compliance_assignments a
set resource_version_id = cy.resource_version_id
from public.compliance_cycles cy
where cy.id = a.cycle_id and a.resource_version_id is null;

update public.compliance_completion_records r
set resource_version_id = cy.resource_version_id
from public.compliance_cycles cy
where cy.id = r.cycle_id and r.resource_version_id is null;

alter table public.course_versions enable row level security;
alter table public.quiz_versions enable row level security;
alter table public.quiz_question_versions enable row level security;
alter table public.learning_path_versions enable row level security;
alter table public.learning_path_version_steps enable row level security;
alter table public.retraining_reviews enable row level security;
alter table public.retraining_assignments enable row level security;
