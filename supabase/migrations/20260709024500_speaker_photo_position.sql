ALTER TABLE public.public_training_flows
  ADD COLUMN IF NOT EXISTS speaker_photo_position_y integer NOT NULL DEFAULT 50
  CHECK (speaker_photo_position_y >= 0 AND speaker_photo_position_y <= 100);
