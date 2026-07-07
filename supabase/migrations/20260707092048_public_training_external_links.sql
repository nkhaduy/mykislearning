create table if not exists public.public_training_flows (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  access_token text unique not null,
  status text not null default 'draft',
  training_session_id text references public.training_sessions(id) on delete set null,
  pretest_url text,
  posttest_url text,
  evaluation_url text,
  pretest_state text not null default 'closed',
  posttest_state text not null default 'closed',
  evaluation_state text not null default 'closed',
  completion_state text not null default 'closed',
  pretest_required boolean not null default true,
  posttest_required boolean not null default true,
  evaluation_required boolean not null default true,
  expires_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint public_training_flows_status_check check (status in ('draft', 'live', 'closed')),
  constraint public_training_flows_step_state_check check (
    pretest_state in ('closed', 'open')
    and posttest_state in ('closed', 'open')
    and evaluation_state in ('closed', 'open')
    and completion_state in ('closed', 'open')
  )
);

create table if not exists public.public_training_participants (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references public.public_training_flows(id) on delete cascade,
  display_name text not null,
  normalized_name text not null,
  participant_token_hash text not null,
  pretest_started_at timestamptz,
  pretest_completed_at timestamptz,
  posttest_started_at timestamptz,
  posttest_completed_at timestamptz,
  evaluation_started_at timestamptz,
  evaluation_completed_at timestamptz,
  completed_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint public_training_participants_flow_name_key unique (flow_id, normalized_name)
);

create index if not exists public_training_flows_status_idx on public.public_training_flows(status);
create index if not exists public_training_flows_expires_at_idx on public.public_training_flows(expires_at);
create index if not exists public_training_participants_flow_idx on public.public_training_participants(flow_id);
create index if not exists public_training_participants_normalized_name_idx on public.public_training_participants(normalized_name);
create index if not exists public_training_participants_completed_at_idx on public.public_training_participants(completed_at);
create index if not exists public_training_participants_last_seen_at_idx on public.public_training_participants(last_seen_at);

drop trigger if exists public_training_flows_updated_at on public.public_training_flows;
create trigger public_training_flows_updated_at
before update on public.public_training_flows
for each row execute function public.set_updated_at();

drop trigger if exists public_training_participants_updated_at on public.public_training_participants;
create trigger public_training_participants_updated_at
before update on public.public_training_participants
for each row execute function public.set_updated_at();

alter table public.public_training_flows enable row level security;
alter table public.public_training_participants enable row level security;

comment on table public.public_training_flows is 'Link-based public training journeys. Public access is mediated by the Worker service role only.';
comment on table public.public_training_participants is 'Self-confirmed public training participant progress. Quizizz/Google Forms results are not synchronized.';
