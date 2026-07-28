# Ephemeral Catalog Diff

Date: 2026-07-27 (Asia/Ho_Chi_Minh)

Source snapshots: `db-before/catalog.json` and `db-after/catalog.json`.

## Summary

| Object/security control | Before | After | Diff |
| --- | ---: | ---: | ---: |
| Public tables | 66 | 66 | unchanged |
| Public tables with RLS enabled | 45 | 66 | +21; all public tables covered |
| Public policies | 32 | 32 | unchanged; direct browser grants are removed, so custom JWT stays Worker-only |
| Private tables | 0 | 3 | `account_credentials`, `revoked_sessions`, `bootstrap_state` added |
| Browser-role public table grants | 147 each for `anon`/`authenticated` (non-DML ACLs included) | 0 | all revoked |
| Service-role public table grants | 218 | 462 | full service-role table access for 66 public tables |
| Public function `EXECUTE` for `PUBLIC` | 5 | 0 | replaced by `service_role` execute grants |
| Functions | 115 | 121 | +6 service-role-only RPC bridges for the non-exposed private schema |
| Security-definer functions | 7 total / 1 public | 13 total / 7 public | +6 RPC bridges with `search_path=''`; browser execute is revoked |
| Public indexes | 399 | 403 | +4 private-table indexes |
| Public foreign keys | 91 | 91 | unchanged |
| Legacy avatar credential markers | 3 | 0 | backfilled then cleared |
| Legacy `password_status` hash markers | 0 | 0 | unchanged |
| Private credential rows | 0 | 3 | 1 marked `must_change` |

## Added objects

- `private.account_credentials` with primary key on `profile_id`.
- `private.revoked_sessions` with expiry index.
- `private.bootstrap_state` with a one-row boolean key constraint.
- `public.service_read_account_credential`, `service_write_account_credential`, `service_is_session_revoked`, `service_revoke_session`, `service_bootstrap_status`, and `service_claim_bootstrap`.

## RLS changes

The 21 newly protected public tables are:

`approval_events`, `attendance`, `content_progress`, `course_content`, `courses`, `enrollments`, `external_training_requests`, `gallery_albums`, `learning_record_attachments`, `learning_records`, `notifications`, `profiles`, `public_training_active_flow`, `qr_tokens`, `quiz_attempts`, `quiz_questions`, `quizzes`, `session_slots`, `training_participants`, `training_registrations`, `training_sessions`.

No table was changed from RLS-enabled to disabled.

## Interpretation

- The migration is fail-closed for direct Data API access: `anon` and `authenticated` have no public table, sequence, or function privileges after apply.
- `service_role` access is intentionally broad because the canonical Worker is the authorization boundary; the service key must remain server-side.
- The private schema remains absent from PostgREST exposed schemas. The Worker uses the six narrowly named RPC bridges; all are revoked from `PUBLIC`, `anon`, and `authenticated`, granted only to `service_role`, and use an empty search path.
- Existing policies remain in catalog for future role-aware auth, but they are not a substitute for the Worker authorization layer while custom Worker JWTs are not mapped to Supabase `auth.uid()`.
- This diff verifies the containment behavior in the isolated runtime only. It does not prove staging/production catalog parity.
