-- Add step descriptions, copy-link flags, and active-flow singleton

-- Step descriptions on flows
alter table public.public_training_flows
  add column if not exists pretest_description text,
  add column if not exists posttest_description text,
  add column if not exists evaluation_description text;

-- Copy-link visibility flags
alter table public.public_training_flows
  add column if not exists pretest_show_copy_link boolean not null default false,
  add column if not exists posttest_show_copy_link boolean not null default false,
  add column if not exists evaluation_show_copy_link boolean not null default false;

-- Active-flow singleton table
create table if not exists public.public_training_active_flow (
  singleton_key text primary key default 'active',
  flow_id uuid references public.public_training_flows(id) on delete set null,
  updated_by text,
  updated_at timestamptz not null default now()
);

-- Seed the singleton row (no-op if already exists)
insert into public.public_training_active_flow (singleton_key)
values ('active')
on conflict (singleton_key) do nothing;
