# Production Clean Reset Owner Approval

Owner: Nguyễn Khả Duy
Approval date: 2026-07-29 (Asia/Ho_Chi_Minh)
Decision: **APPROVED**

Scope: Exact 74-table clean-reset allowlist generated from the approved disposable rehearsal and `scripts/production/clean-reset/production-clean-reset-common.mjs`.

- Preserve bootstrap HR: **YES**
- Delete application business data: **YES**
- Delete Trainer application data: **YES**
- Canonical roles after reset: **hr, employee**
- Preserve system schemas, migration history, extensions, infrastructure, storage definitions, secrets, alert policies and release evidence: **YES**
- Allowlist checksum (SHA-256 of sorted JSON table array): `ea81e890bb275c65edf51420556cce9bdfc5021a7ffe28eea809a768902e720b`

The allowlist is explicit and does not use dynamic truncation. Application rows are deleted transactionally; the bootstrap HR profile, credentials and role mapping are retained and canonicalized to `hr` by the protected clean-reset command.
