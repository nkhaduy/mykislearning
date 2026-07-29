\set ON_ERROR_STOP on

-- In-place reconstruction is deliberately prohibited. The supported rollback is
-- restore of the verified pre-purge disposable clone or production backup.
do $$
begin
  if current_setting('kis.clean_reset.target', true) <> 'disposable' then
    raise exception 'rollback rehearsal may only target a disposable database';
  end if;
  if current_setting('kis.clean_reset.restore_rehearsal_verified', true) <> 'true' then
    raise exception 'verified restore rehearsal evidence is required';
  end if;
  if current_setting('kis.clean_reset.rollback_source_checksum', true) !~ '^[a-f0-9]{64}$' then
    raise exception 'rollback source checksum is missing or invalid';
  end if;
end $$;

select 'RESTORE_FROM_VERIFIED_BACKUP_REQUIRED' as rollback_method,
       current_setting('kis.clean_reset.rollback_source_checksum') as source_checksum;
