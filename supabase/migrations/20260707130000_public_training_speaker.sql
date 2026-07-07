alter table public.public_training_flows
  add column if not exists speaker_name text,
  add column if not exists speaker_title text,
  add column if not exists speaker_org text,
  add column if not exists speaker_bio text,
  add column if not exists speaker_photo_url text;
