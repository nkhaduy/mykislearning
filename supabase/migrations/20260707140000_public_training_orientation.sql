alter table public.public_training_participants
  add column if not exists orientation_acknowledged_at timestamptz;
