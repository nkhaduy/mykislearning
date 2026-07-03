-- Fix created_by type from uuid to text for training & CCHN tables
-- because account IDs (e.g. "acc-hr-001") are not valid UUIDs.

alter table public.training_tracking_records
  alter column created_by type text;

alter table public.cchn_catalog_items
  alter column created_by type text;

alter table public.cchn_registrations
  alter column created_by type text;
