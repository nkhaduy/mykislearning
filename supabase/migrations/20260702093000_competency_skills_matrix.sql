create table if not exists public.competency_categories (
  id text primary key,
  code text not null unique,
  name text not null,
  description text,
  position integer not null default 0,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.competencies (
  id text primary key,
  category_id text references public.competency_categories(id) on delete set null,
  code text not null unique,
  name text not null,
  description text,
  status text not null default 'draft' check (status in ('draft','active','inactive','archived')),
  effective_from date not null default current_date,
  effective_until date,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_until is null or effective_until >= effective_from)
);

create table if not exists public.competency_levels (
  id text primary key,
  competency_id text references public.competencies(id) on delete cascade,
  code text not null,
  name text not null,
  rank integer not null check (rank >= 0),
  description text,
  behavioral_indicators jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (competency_id, code),
  unique (competency_id, rank)
);

create table if not exists public.competency_requirements (
  id text primary key,
  competency_id text not null references public.competencies(id) on delete cascade,
  target_type text not null check (target_type in ('all_employees','department','job_title','individual')),
  target_value text not null default '',
  required_level_id text not null references public.competency_levels(id) on delete restrict,
  priority integer not null default 100,
  is_mandatory boolean not null default true,
  effective_from date not null default current_date,
  effective_until date,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_until is null or effective_until >= effective_from),
  unique (competency_id, target_type, target_value, effective_from)
);

create table if not exists public.competency_resource_mappings (
  id text primary key,
  competency_id text not null references public.competencies(id) on delete cascade,
  resource_type text not null check (resource_type in ('course','learning_path','quiz','certificate_type','compliance_program')),
  resource_id text not null,
  resource_version_id text not null default '',
  awarded_level_id text not null references public.competency_levels(id) on delete restrict,
  evidence_rule jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.employee_competency_assessments (
  id text primary key,
  employee_id text not null,
  competency_id text not null references public.competencies(id) on delete cascade,
  assessment_type text not null check (assessment_type in ('self','hr','system')),
  assessed_level_id text not null references public.competency_levels(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','verified','rejected','superseded')),
  assessor_id text,
  assessment_date timestamptz not null default now(),
  reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  verified_by text,
  verified_at timestamptz
);

create table if not exists public.employee_competency_evidence (
  id text primary key,
  employee_id text not null,
  competency_id text not null references public.competencies(id) on delete cascade,
  source_type text not null check (source_type in ('course_completion','learning_path_completion','quiz_pass','certificate_verified','compliance_completion','manual')),
  source_id text not null,
  source_version_id text not null default '',
  awarded_level_id text not null references public.competency_levels(id) on delete restrict,
  status text not null default 'active' check (status in ('active','expired','revoked','superseded','rejected')),
  evidence_date timestamptz not null default now(),
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.development_plans (
  id text primary key,
  employee_id text not null,
  title text not null,
  description text,
  status text not null default 'draft' check (status in ('draft','active','completed','cancelled','archived')),
  start_at timestamptz,
  target_end_at timestamptz,
  created_by text,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.development_plan_items (
  id text primary key,
  development_plan_id text not null references public.development_plans(id) on delete cascade,
  competency_id text not null references public.competencies(id) on delete cascade,
  current_level_id text references public.competency_levels(id) on delete set null,
  target_level_id text not null references public.competency_levels(id) on delete restrict,
  resource_type text check (resource_type in ('course','learning_path','quiz','certificate_type','compliance_program')),
  resource_id text,
  resource_version_id text not null default '',
  status text not null default 'planned' check (status in ('planned','in_progress','completed','overdue','cancelled')),
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  due_at timestamptz,
  assigned_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_competencies_category_status on public.competencies(category_id, status);
create index if not exists idx_competency_levels_competency_rank on public.competency_levels(competency_id, rank);
create index if not exists idx_competency_requirements_target on public.competency_requirements(target_type, target_value, effective_from, effective_until);
create index if not exists idx_competency_requirements_competency on public.competency_requirements(competency_id, priority);
create index if not exists idx_competency_mappings_resource on public.competency_resource_mappings(resource_type, resource_id, resource_version_id, status);
create unique index if not exists uq_competency_mapping_version
  on public.competency_resource_mappings(competency_id, resource_type, resource_id, resource_version_id);
create index if not exists idx_employee_comp_assessments_employee on public.employee_competency_assessments(employee_id, competency_id, status, assessment_date desc);
create index if not exists idx_employee_comp_evidence_employee on public.employee_competency_evidence(employee_id, competency_id, status, evidence_date desc);
create unique index if not exists uq_employee_competency_evidence_source
  on public.employee_competency_evidence(employee_id, competency_id, source_type, source_id, source_version_id);
create index if not exists idx_development_plans_employee on public.development_plans(employee_id, status, target_end_at);
create index if not exists idx_development_plan_items_plan on public.development_plan_items(development_plan_id, status, due_at);
create index if not exists idx_development_plan_items_resource on public.development_plan_items(resource_type, resource_id, resource_version_id);

create or replace function public.set_phase9_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_competency_categories_updated_at on public.competency_categories;
create trigger trg_competency_categories_updated_at before update on public.competency_categories for each row execute function public.set_phase9_updated_at();
drop trigger if exists trg_competencies_updated_at on public.competencies;
create trigger trg_competencies_updated_at before update on public.competencies for each row execute function public.set_phase9_updated_at();
drop trigger if exists trg_competency_levels_updated_at on public.competency_levels;
create trigger trg_competency_levels_updated_at before update on public.competency_levels for each row execute function public.set_phase9_updated_at();
drop trigger if exists trg_competency_requirements_updated_at on public.competency_requirements;
create trigger trg_competency_requirements_updated_at before update on public.competency_requirements for each row execute function public.set_phase9_updated_at();
drop trigger if exists trg_competency_resource_mappings_updated_at on public.competency_resource_mappings;
create trigger trg_competency_resource_mappings_updated_at before update on public.competency_resource_mappings for each row execute function public.set_phase9_updated_at();
drop trigger if exists trg_employee_competency_assessments_updated_at on public.employee_competency_assessments;
create trigger trg_employee_competency_assessments_updated_at before update on public.employee_competency_assessments for each row execute function public.set_phase9_updated_at();
drop trigger if exists trg_employee_competency_evidence_updated_at on public.employee_competency_evidence;
create trigger trg_employee_competency_evidence_updated_at before update on public.employee_competency_evidence for each row execute function public.set_phase9_updated_at();
drop trigger if exists trg_development_plans_updated_at on public.development_plans;
create trigger trg_development_plans_updated_at before update on public.development_plans for each row execute function public.set_phase9_updated_at();
drop trigger if exists trg_development_plan_items_updated_at on public.development_plan_items;
create trigger trg_development_plan_items_updated_at before update on public.development_plan_items for each row execute function public.set_phase9_updated_at();

alter table public.competency_categories enable row level security;
alter table public.competencies enable row level security;
alter table public.competency_levels enable row level security;
alter table public.competency_requirements enable row level security;
alter table public.competency_resource_mappings enable row level security;
alter table public.employee_competency_assessments enable row level security;
alter table public.employee_competency_evidence enable row level security;
alter table public.development_plans enable row level security;
alter table public.development_plan_items enable row level security;

drop policy if exists deny_anon_competency_categories on public.competency_categories;
drop policy if exists deny_anon_competencies on public.competencies;
drop policy if exists deny_anon_competency_levels on public.competency_levels;
drop policy if exists deny_anon_competency_requirements on public.competency_requirements;
drop policy if exists deny_anon_competency_resource_mappings on public.competency_resource_mappings;
drop policy if exists deny_anon_employee_competency_assessments on public.employee_competency_assessments;
drop policy if exists deny_anon_employee_competency_evidence on public.employee_competency_evidence;
drop policy if exists deny_anon_development_plans on public.development_plans;
drop policy if exists deny_anon_development_plan_items on public.development_plan_items;

create policy deny_anon_competency_categories on public.competency_categories for all to anon, authenticated using (false) with check (false);
create policy deny_anon_competencies on public.competencies for all to anon, authenticated using (false) with check (false);
create policy deny_anon_competency_levels on public.competency_levels for all to anon, authenticated using (false) with check (false);
create policy deny_anon_competency_requirements on public.competency_requirements for all to anon, authenticated using (false) with check (false);
create policy deny_anon_competency_resource_mappings on public.competency_resource_mappings for all to anon, authenticated using (false) with check (false);
create policy deny_anon_employee_competency_assessments on public.employee_competency_assessments for all to anon, authenticated using (false) with check (false);
create policy deny_anon_employee_competency_evidence on public.employee_competency_evidence for all to anon, authenticated using (false) with check (false);
create policy deny_anon_development_plans on public.development_plans for all to anon, authenticated using (false) with check (false);
create policy deny_anon_development_plan_items on public.development_plan_items for all to anon, authenticated using (false) with check (false);
