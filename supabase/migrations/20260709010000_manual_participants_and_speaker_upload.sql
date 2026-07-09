-- Manual participants (HR-added) + speaker photo upload support

-- 1. Make participant_token_hash nullable so HR-added participants can have no token yet
ALTER TABLE public.public_training_participants
  ALTER COLUMN participant_token_hash DROP NOT NULL;

-- 2. Add source tracking and optional HR metadata columns
ALTER TABLE public.public_training_participants
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'self',
  ADD COLUMN IF NOT EXISTS is_external boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hr_note text,
  ADD COLUMN IF NOT EXISTS hr_department text,
  ADD COLUMN IF NOT EXISTS hr_location text,
  ADD COLUMN IF NOT EXISTS hr_mode text;

-- 3. Speaker photo storage bucket (public read, authenticated write)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'speaker-photos',
  'speaker-photos',
  true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: allow service-role to upload (worker uses service role key)
-- Public read is already enabled via bucket public=true
