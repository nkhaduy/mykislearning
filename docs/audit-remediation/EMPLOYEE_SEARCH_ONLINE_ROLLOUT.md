# Employee Search Online Rollout (Local/Staging Rehearsal Only)

This package is a rehearsal plan. It contains no production identifiers, tokens, or remote commands.

## Expand

1. Confirm the `pg_trgm` extension is available and the migration preflight reports the expected PostgreSQL major version.
2. Apply the additive generated columns `employee_search_document` and `employee_sort_name` as nullable-compatible changes.
3. Deploy the private `service_search_profiles` function while the legacy search path remains active.
4. Enable the search feature flag only for shadow comparison; do not change the public API contract yet.

## Backfill / Verify

Generated columns are maintained by PostgreSQL. For any future helper-column backfill, use a resumable keyset batch (`id > last_id`), commit each batch, record progress, throttle between batches, and support pause/cancel. Never use `OFFSET` or hold a long transaction. Verify row coverage, null counts, normalized search samples, and cursor ordering before indexing.

## Concurrent Index

Run outside a transaction during the approved maintenance window:

```sql
create index concurrently if not exists profiles_search_document_trgm_idx
  on public.profiles using gin (employee_search_document gin_trgm_ops);
```

If a prior attempt leaves an invalid index, inspect `pg_index.indisvalid`, drop only that named invalid index concurrently, then retry. Monitor `pg_stat_progress_create_index`, `pg_locks`, and write latency. A concurrent build may still consume I/O; stop/pause if lock or latency budgets are exceeded.

## Cutover

1. Keep legacy search available and compare a sampled set of legacy/new result IDs (shadow read).
2. Enable dual-read telemetry, then route reads to `service_search_profiles` behind a feature flag.
3. Validate exact filters, authorization scope, malformed cursors, and first/next page parity.
4. Monitor error rate, p95 latency, index health, and null/unbackfilled rows for the agreed stable period.

## Rollback

Disable the feature flag and return to the legacy query path. Do not drop the new columns or index during incident response. If an index is invalid, remove only the invalid index concurrently after catalog verification. Contract cleanup (dropping legacy search) requires a separate approved migration after the stable period.

## Rehearsal evidence

Capture preflight output, batch progress, index catalog state, `EXPLAIN (ANALYZE, BUFFERS)` for prefix/substring searches, shadow mismatches, lock observations, and the cutover/rollback timestamps. The local check is `npm run check:search-rollout`.
