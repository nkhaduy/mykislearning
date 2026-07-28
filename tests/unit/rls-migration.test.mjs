import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migrationFiles = [
  "supabase-courses-migration.sql",
  "supabase-training-migration.sql",
  "supabase/migrations/007_hr_operational_overview.sql",
  "supabase/migrations/010_learning_paths.sql",
  "supabase/migrations/011_compliance_training.sql",
  "supabase/migrations/012_compliance_training_rls.sql",
  "supabase/migrations/20260701085524_notification_reminder_engine.sql",
  "supabase/migrations/20260726090000_security_containment.sql",
];

function activeSql(path) {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
}

test("SEC-002/SEC-011: canonical migrations do not disable RLS", () => {
  for (const path of migrationFiles) {
    assert.doesNotMatch(activeSql(path), /disable\s+row\s+level\s+security/i, path);
  }
});

test("SEC-002/SEC-011: legacy migrations do not grant private tables to browser roles", () => {
  for (const path of migrationFiles) {
    assert.doesNotMatch(activeSql(path), /^\s*grant\s+[^\n]*\s+to\s+(?:anon|authenticated)\b/im, path);
  }
});

test("SEC-004/SEC-008: containment migration creates private credential, session, and bootstrap stores", () => {
  const sql = activeSql("supabase/migrations/20260726090000_security_containment.sql");
  assert.match(sql, /private\.account_credentials/i);
  assert.match(sql, /private\.revoked_sessions/i);
  assert.match(sql, /private\.bootstrap_state/i);
  assert.match(sql, /revoke all on private\.account_credentials from public, anon, authenticated/i);
  assert.match(sql, /service_read_account_credential/i);
  assert.match(sql, /service_write_account_credential/i);
  assert.match(sql, /service_is_session_revoked/i);
  assert.match(sql, /service_claim_bootstrap/i);
  assert.match(sql, /security definer[\s\S]*set search_path = ''/i);
  assert.match(sql, /left\(avatar_url, length\('__pwd__:'\)\) = '__pwd__:'/i);
});
