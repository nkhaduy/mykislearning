-- Phase 8 immutability fix: allow hard delete of published course_versions
-- while continuing to block in-place UPDATE of immutable content fields.
--
-- Previously the trigger raised PUBLISHED_VERSION_IMMUTABLE on any DELETE of
-- a published/retired/archived version row. This blocked HR hard-delete because
-- the Worker deletes course_versions rows before deleting the parent courses row.
--
-- Fix: remove the DELETE branch from the guard. DELETE is a legitimate operation
-- for the hard-delete flow (service-role Worker). Only UPDATE that changes
-- content fields on a published version is prohibited.
--
-- quiz_versions and learning_path_versions share the same function so they also
-- benefit: their hard-delete paths are equally unblocked.

create or replace function public.block_published_version_mutation()
returns trigger language plpgsql as $$
begin
  -- Allow hard-delete (DELETE operation) — the hard-delete Worker flow
  -- removes version rows deliberately. Only block in-place content edits.
  if tg_op = 'DELETE' then
    return old;
  end if;

  -- Block UPDATE that changes content fields on a published/retired/archived version.
  if old.status in ('published', 'retired', 'archived') then
    if row_to_json(old)::jsonb - 'status' - 'retired_by' - 'retired_at' - 'updated_at'
       is distinct from row_to_json(new)::jsonb - 'status' - 'retired_by' - 'retired_at' - 'updated_at' then
      raise exception 'PUBLISHED_VERSION_IMMUTABLE';
    end if;
  end if;

  return new;
end $$;
