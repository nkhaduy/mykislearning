# Employee Search Evidence

The old endpoint selected 18 list columns including `notes`, requested an exact count, used offset pagination and emitted an OR of wildcard `ILIKE` predicates. Empty search could become an uncontrolled table scan.

The new endpoint trims/limits input, requires server-side role authorization, selects 11 fields, rejects tampered/requester-mismatched cursors and calls `service_search_profiles`. PostgreSQL adds `pg_trgm`, normalized generated `employee_search_document`, generated `employee_sort_name`, a GIN trigram index, status/name cursor indexes and prefix indexes. Sort is stable by `(employee_sort_name, id)`.

Synthetic local evidence (`100,000` profiles, PostgreSQL 17.6.1) is in `docs/audit-remediation/evidence/employee-search-performance.json`:

| Query | p50 | p95 | p99 |
|---|---:|---:|---:|
| legacy accent substring + offset | 49.9 ms | 103.5 ms | 190.4 ms |
| generated-column substring + keyset | 19.0 ms | 69.6 ms | 71.8 ms |
| selective employee-code prefix | 1.27 ms | 1.68 ms | 1.75 ms |
| cursor page | 0.09 ms | 0.15 ms | 0.16 ms |

The latest local run (2026-07-28 04:06 UTC) records node types, buffers and eight-request concurrency: baseline 475 ms versus optimized 200 ms. Wall-clock values vary with the local container, so the gate asserts plan shape, index use, bounded payload and no sequential scan rather than brittle millisecond thresholds. Production rollout must use the generated-column migration risk notes and verify `EXPLAIN (ANALYZE, BUFFERS)` against representative tenant distributions.

## Production index rollout note

The local migration is intentionally transactional for replay tests. On a populated production table, stored generated columns can rewrite `profiles`, and ordinary index creation can hold strong locks. The deployment runbook should instead use an expand/backfill sequence: add compatible nullable search columns, backfill in bounded primary-key batches, run `ANALYZE`, create GIN/B-tree indexes with `CREATE INDEX CONCURRENTLY` outside a transaction, switch the RPC to the populated columns, then enforce generated-column invariants in a later maintenance window. Do not run the local migration verbatim against live traffic without a lock-budget rehearsal.
