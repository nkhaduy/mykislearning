# KIS LMS Staging Observability Runbook

This is a staging configuration and response specification. No alert was created in the current phase because the staging Worker, Queue, DLQ, R2 bucket, Durable Object namespace, and database target do not exist or are not approved.

## Data handling

- Never log access/refresh tokens, passwords, service keys, recovery material, raw export rows, or request bodies containing credentials.
- Hash IP and bounded user-agent metadata using staging-only salts.
- Correlation IDs must be random opaque values and must not embed email, employee code, profile ID, or other PII.
- Audit events must contain actor, action, target, result/status, correlation ID, and bounded non-sensitive metadata.
- Error labels and queue/DLQ metadata must use normalized codes, not raw database errors or bind values.

## Initial staging alerts

Thresholds are initial rehearsal gates and require owner approval before production reuse.

| Signal | Initial staging threshold | Severity | First response |
| --- | --- | --- | --- |
| Queue backlog age | Oldest message over 5 minutes for 10 minutes | High | Check consumer deployment, Supabase health, retry codes, and concurrency |
| Queue backlog depth | Over 100 messages for 10 minutes | Medium | Check arrival rate, consumer duration, and database saturation |
| DLQ depth | Any message for 5 minutes | High | Stop replay, inspect normalized error code, confirm requester authorization and fix cause |
| Export failure rate | Over 5% in 15 minutes or three consecutive failures | High | Disable export producer flag, preserve jobs/objects, inspect DB/R2/Queue errors |
| Export processing duration | p95 over 10 minutes for 15 minutes | Medium | Check report plan, chunk progress, Queue concurrency, R2 multipart latency |
| R2 write/read errors | Over 1% in 5 minutes or any sustained 5xx | High | Disable new exports, preserve downloads, verify binding/bucket availability |
| Multipart abort failure | Any event | High | Record upload/job IDs only, retry bounded cleanup, inspect orphan inventory |
| Durable Object errors | Over 1% in 5 minutes | High | Treat auth-critical rate-limit failures as fail-closed; inspect namespace/binding |
| Rate-limit unavailable | Any auth-critical `RATE_LIMIT_UNAVAILABLE` for 5 minutes | Critical | Halt auth rollout, verify DO binding/migration/account availability |
| Refresh-token reuse | Any confirmed reuse event | Critical | Revoke token family/sessions, disable account if warranted, start incident review |
| Login failure spike | Over 50 failures in 5 minutes or 5x the rolling baseline | High | Check credential stuffing/IP distribution without logging raw identifiers |
| PostgreSQL timeout | Over 1% of report requests or five events in 5 minutes | High | Capture plan/locks, pause export producer, keep timeout fail-closed |
| Database connections | Over 80% for 10 minutes; over 90% immediate | High/Critical | Reduce Queue concurrency, identify long transactions, protect interactive requests |
| Migration/backfill failure | Any failure, invalid index, or checkpoint regression | Critical | Stop phase, do not cut over, preserve catalog/lock evidence |
| Search latency | p95 over 500 ms for 15 minutes or 2x baseline | High | Disable search cutover flag, verify index validity/coverage/plans |
| Report overview latency | p95 over 2 seconds for 15 minutes | High | Inspect inner plan/buffers; keep 8-second DB timeout |
| Report detail latency | p95 over 1 second for 15 minutes | High | Inspect cursor/index/filter plan; keep 5-second DB timeout |

## Required dashboards

- Worker requests: volume, status class, CPU time, exceptions, route, deployment version.
- Queue: producer rate, backlog depth/age, consumer batch duration, retries, DLQ depth.
- R2: writes, reads, deletes, error rate, bytes, multipart completion/abort failures.
- Durable Object: request/error rate, latency, alarm failures, storage operations by hashed shard.
- Authentication: login success/failure, refresh success/reuse/failure, session revoke, account disable.
- Database: connections, long transactions, lock waits, statement timeout, CPU/I/O, cache hit, temporary files.
- Search/reporting: p50/p95/p99, error rate, timeout rate, result/cursor validation failures.

## Alert response rules

1. Attach deployment ID, commit SHA, migration checksum, config checksum, correlation IDs, time window, and normalized error codes.
2. Never attach raw tokens, SQL bind values, export contents, or database row samples.
3. For Queue/DLQ incidents, disable or pause the producer before bounded replay; do not purge.
4. For search incidents, disable cutover first and retain additive columns/indexes for analysis.
5. For database incidents, distinguish transaction rollback, reviewed roll-forward, and restore; do not create destructive down migrations.
6. Close an alert only after the signal is below threshold, smoke tests pass, and cleanup/orphan checks are recorded.
