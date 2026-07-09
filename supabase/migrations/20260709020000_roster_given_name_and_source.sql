-- Add given_name and source to roster for HR-added entries and sorting

ALTER TABLE public.public_training_roster
  ADD COLUMN IF NOT EXISTS given_name text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'excel';

-- Back-fill: existing entries from Excel import have source 'excel'
UPDATE public.public_training_roster SET source = 'excel' WHERE source IS NULL OR source = '';
