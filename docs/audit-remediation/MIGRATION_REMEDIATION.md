# Migration remediation

## Root cause

`001_schema.sql` creates `public.profiles.department_id UUID`. When the same
database reaches `005_cloudflare_missing_tables_patch.sql`, its `CREATE TABLE IF
NOT EXISTS public.profiles` is skipped because the UUID table already exists.
The original `005` then created `profiles_department_idx` on
`public.profiles.department`, a column that had never been added. The immediate
error was therefore `column profiles.department does not exist`, but the deeper
issue was two incompatible histories: `001-004` use Supabase Auth UUID IDs and
normalized departments, while `005-006` use application-owned TEXT IDs and a
denormalized department name.

## Schema transition

```text
001-004 legacy                         reconciled runtime
auth.users.id UUID                    auth.users.id UUID
        |                                     |
profiles.id UUID PK/FK                profiles.auth_user_id UUID NULL FK
profiles.department_id UUID FK   ->   profiles.id TEXT PK
departments.id UUID PK                profiles.department_id UUID FK
                                      profiles.department TEXT
legacy workflow tables UUID FKs       canonical Worker tables TEXT FKs
                                      legacy rows retained for audit/recovery
```

## Strategy and compatibility

- `005` performs the UUID-to-TEXT compatibility bridge only when
  `profiles.id` is actually UUID. Values use PostgreSQL's canonical UUID text;
  the affected public FK graph is rebuilt with its original actions.
- The old Auth relationship is retained in `profiles.auth_user_id`; it is not
  discarded or coerced into an application account identifier.
- Policy removal is limited to the explicit tables whose expressions depend on
  converted identifiers. Unrelated department/category policies are retained.
- `006` backfills canonical Worker tables with deterministic legacy IDs and
  `ON CONFLICT DO NOTHING`; source rows remain intact.
- The new reconciliation migration handles already-existing Worker databases,
  backfills department values both directions, and raises on UUID/text conflict
  inside one transaction. It also validates security and referential integrity.

The modified `005/006` files affect future fresh replays. A database that has
already recorded them as applied does not rerun them; its supported remediation
path is the new reconciliation migration. On a legacy UUID database the bridge
does table/index rewrites and takes access-exclusive locks, so real upgrades
still require backup, catalog snapshot and a maintenance window. No evidence is
available to claim `001-004` were never applied in production.

## Automated scenarios

`scripts/test-migrations.mjs` runs against a uniquely named ephemeral
`public.ecr.aws/supabase/postgres:17.6.1.136` container. The bootstrap fixture
adds only the Supabase primitives needed by application migrations (`auth`,
`storage`, roles, `auth.uid()` and `storage.buckets`). It never uses the user's
application database or any remote project.

| Scenario | Assertions |
| --- | --- |
| Fresh replay | All migrations apply in order; synthetic profiles/enrollment/private credential shape survive; all public tables have RLS; browser grants, invalid FKs, logical orphans and department mismatches are zero. |
| Legacy upgrade | `001-004` plus representative UUID data upgrade through the latest migration; canonical IDs, Auth linkage, profiles, course/enrollment/progress, training participant, quiz/attempt and learning history are preserved; reconciliation rerun creates no duplicate. |
| Partial state | Recoverable columns/indexes/tables backfill idempotently. Conflicting UUID/text departments fail with a clear error and the transaction rolls back its FK/data changes. |

The harness always removes databases or its owned container in `finally`.
