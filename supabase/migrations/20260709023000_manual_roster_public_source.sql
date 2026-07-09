-- Normalize HR-added roster entries to a descriptive source value.
-- Visibility for public_training_roster is controlled by flow membership, not source.

UPDATE public.public_training_roster
SET source = 'manual'
WHERE source = 'hr_manual';
