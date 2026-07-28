# Database Policy Matrix

Environment: isolated local Supabase/PostgreSQL 17.6.1.136 with synthetic-only data. No production/staging database was contacted.

Evidence:

- `evidence/db-before/catalog.json`
- `evidence/db-after/catalog.json`
- `evidence/db-after/security-verification.json`
- `evidence/db-after/auth-runtime.json`
- `evidence/db-diff.md`

## Runtime model

The custom Worker JWT is not a Supabase Auth JWT. Direct `anon` and `authenticated` Data API access is therefore fully revoked; application identities are enforced by the Worker, which uses `service_role` server-side. The `private` schema is not exposed through PostgREST. Six service-role-only RPC functions bridge credential, revocation and bootstrap operations.

## Assertions

Identity: Anonymous
Operation: `SELECT` and mutation attempts through PostgREST
Resource: profiles, learning records/attachments, external requests, notifications, sessions, attendance, certificates, compliance, development plans, courses/enrollments/progress
Expected: no private read or write
Actual: all sampled REST reads returned `401`; direct SQL role select/write attempts failed; no public table/function grants remain
Result: PASS
Finding ID: `SEC-002`, `SEC-011`

Identity: Employee A
Operation: own-data GET and cross-user GET
Resource: learning history, notifications, certificates, compliance assignments, development plans, employee list
Expected: own rows only; Employee B and HR list denied
Actual: five own-data endpoints returned `200` without Employee B identifiers; explicit Employee B notification/certificate access returned `403`; employee list returned `403`
Result: PASS
Finding ID: `SEC-002`

Identity: Employee B
Operation: symmetric own-data and cross-user GET
Resource: same resources as Employee A
Expected: own rows only; Employee A denied
Actual: symmetric checks passed; no Employee A identifier appeared and cross-user notification/certificate access returned `403`
Result: PASS
Finding ID: `SEC-002`

Identity: Employee A/B
Operation: role escalation and identity-header conflict
Resource: session probe and HR employee endpoint
Expected: cookie claim remains employee; forged HR headers do not change identity
Actual: probe returned signed employee role and minimal fields; HR endpoint returned `403`
Result: PASS
Finding ID: `SEC-001`, `SEC-005`

Identity: Trainer
Operation: read employee PII / HR endpoint
Resource: employee list
Expected: denied
Actual: `403`
Result: PASS for denial; `NOT_IMPLEMENTED` for an independent `instructor` role/course-scoped policy
Finding ID: `SEC-002`, `PROD-001`

Identity: Manager
Operation: team-scope reads
Resource: profiles and learning data
Expected: role-aware team scope if role exists
Actual: no manager role exists in the Worker-compatible profile constraint; no policy was invented
Result: NOT_IMPLEMENTED
Finding ID: `PROD-001`, `ARCH-007`

Identity: HR
Operation: employee list and credential exposure check
Resource: `/api/employees`
Expected: business data allowed; no password marker/hash
Actual: `200`; response contained no legacy marker, PBKDF2 string or `password_hash`
Result: PASS
Finding ID: `SEC-002`, `SEC-004`

Identity: Admin
Operation: audit log access and credential exposure check
Resource: `/api/admin/audit-logs`
Expected: audit access allowed; credentials absent
Actual: `200`; no credential material returned
Result: PASS
Finding ID: `SEC-004`, `SEC-008`

Identity: Service role
Operation: table select and private-store RPC
Resource: all 66 public tables; private credential/session/bootstrap stores
Expected: server-side access only; direct private schema not exposed
Actual: service role can select all 66 public tables and call 11 public functions; credential RPC returned the expected shape; private REST schema request returned `406`; browser roles returned `401` for the RPC
Result: PASS
Finding ID: `SEC-002`, `SEC-004`, `SEC-005`, `SEC-008`, `SEC-011`

## Table coverage

Present and exercised or catalog-verified: `profiles`, `courses`, `enrollments`, `content_progress`, `learning_records`, `learning_record_attachments`, `external_training_requests`, `notifications`, `training_sessions`, `attendance`, `employee_certifications`, `compliance_assignments`, `development_plans`, `audit_logs`, `course_versions`.

Absent from the Worker-compatible baseline: `user_roles`, `course_assignments`, `lesson_progress`, `content_versions`, `file_uploads`, and a generic `certificates` table. Available equivalents are documented where applicable; absent models remain `ARCH-007` drift and are not treated as verified policy objects.

## Status decision

- `SEC-002`: VERIFIED in the isolated runtime; production/staging apply remains a separate operational gate.
- `SEC-011`: IMPLEMENTED_NOT_VERIFIED because the Worker-compatible runtime passes but full history (`001` through `005`) still fails and production catalog parity is unknown.
