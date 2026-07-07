create table if not exists public.public_training_roster (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references public.public_training_flows(id) on delete cascade,
  full_name text not null,
  normalized_name text not null,
  department text,
  location text,
  mode text,
  source_row integer,
  created_at timestamptz not null default now(),
  constraint public_training_roster_flow_name_key unique (flow_id, normalized_name)
);

create index if not exists public_training_roster_flow_idx on public.public_training_roster(flow_id);
create index if not exists public_training_roster_norm_idx on public.public_training_roster(normalized_name);

alter table public.public_training_roster enable row level security;

comment on table public.public_training_roster is 'Pre-loaded participant roster for live training sessions. Accessible only via Worker service role.';
