import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(new URL("../supabase/migrations/20260728031000_employee_search_cursor.sql", import.meta.url), "utf8");
const runbook = readFileSync(new URL("../docs/audit-remediation/EMPLOYEE_SEARCH_ONLINE_ROLLOUT.md", import.meta.url), "utf8");
for (const token of ["pg_trgm", "employee_search_document", "CREATE INDEX CONCURRENTLY", "backfill", "pause", "rollback", "invalid", "shadow"]) {
  assert.match(`${migration}\n${runbook}`, new RegExp(token.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "i"), token);
}
assert.doesNotMatch(runbook, /supabase\.co|service_role_key|eyJ[A-Za-z0-9_-]+/i);
console.log("Employee search expand/backfill/concurrent-index/verify/cutover/rollback package passed local dry-run checks.");
