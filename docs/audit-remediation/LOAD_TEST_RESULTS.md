# Synthetic Load Test Results

Date: 2026-07-27
Findings: `PERF-007`, `OPS-004`
Status: `IN_PROGRESS`
Environment: isolated local Supabase/PostgreSQL `17.6.1.136`; no staging or production traffic/data. Raw structured evidence: `docs/audit-remediation/evidence/load-test-results.json`.

## Dataset

| Model | Synthetic rows |
| --- | ---: |
| Employee profiles | 100,000 |
| Courses | 100 |
| Enrollments | 30,000 |
| Learning records | 20,000 |
| Notifications | 30,000 |
| Audit logs | 50,000 |

Rows used the `load-*` prefix and `example.invalid` addresses. The script removed all load-test rows in `finally`; the post-run verification found zero remaining rows in every seeded model.

## Query Latency

Thirty in-database iterations per query:

| Query | p50 | p95 | p99 | Plan summary |
| --- | ---: | ---: | ---: | --- |
| Employee first page, 50 rows | 18.40 ms | 20.94 ms | 22.54 ms | Sequential scan + sort |
| Employee deep page, offset 99,950 | 53.12 ms | 70.89 ms | 80.39 ms | Sequential scan + sort |
| Employee leading-wildcard search | 250.82 ms | 298.83 ms | 422.87 ms | Sequential scan + sort |
| Department/status filter | 4.34 ms | 5.28 ms | 9.41 ms | `profiles_department_idx` bitmap scan + sort |
| Role filter | 16.35 ms | 18.57 ms | 18.79 ms | Sequential scan + sort |
| Small department report | 2.68 ms | 3.24 ms | 4.70 ms | Department index + aggregate |
| Large completion report | 264.26 ms | 512.72 ms | 808.14 ms | Sequential scans + hash join + aggregate |

## Concurrency And Payload

| Scenario | Concurrency | p50 | p95 | p99 | Error rate | Container memory |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Large completion report | 8 | 1,973 ms | 1,987 ms | 1,987 ms | 0% | 228.1 MiB baseline/observed peak |

- Employee first-page JSON payload estimate: 11,338 B.
- Full 100k employee export payload estimate before HTTP/CSV overhead: 21,173,895 B.
- Queries select explicit fields and filter/paginate in PostgreSQL; no memory-side filtering was used by the benchmark.

## Bottlenecks And Decisions

- Search uses leading wildcards across four columns, so current btree indexes cannot help. Add a reviewed `pg_trgm`/GIN search index or a normalized search vector before marking `PERF-007` verified.
- Offset pagination is bounded but not stable under concurrent inserts and grows with page depth. Add optional keyset pagination on `(full_name, id)` and keep a compatibility path for existing clients.
- Add an index matching stable order/filter requirements, likely `(full_name, id)` plus a partial/compound strategy for active employees after staging plan review.
- A 21 MB synchronous export is not bounded enough for routine use. Move large exports to an asynchronous job/object workflow or enforce a lower synchronous row cap.
- Eight concurrent large reports approach two seconds without errors. Add pre-aggregation/cache or an asynchronous report job before claiming `OPS-004` verified.
- SQL timings exclude Worker execution, PostgREST serialization, network transfer and browser rendering; an ephemeral Worker HTTP benchmark remains required.
