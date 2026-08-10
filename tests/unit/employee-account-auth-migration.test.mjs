import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  new URL("../../supabase/migrations/20260810061944_employee_account_auth.sql", import.meta.url),
  "utf8",
);

test("AUTH-ACCOUNT-001: migration isolates identities, grants, and escrow", () => {
  assert.match(sql, /create table if not exists private\.account_login_identities/i);
  assert.match(sql, /create table if not exists private\.account_role_grants/i);
  assert.match(sql, /create table if not exists private\.password_escrow/i);
  assert.match(sql, /add column if not exists effective_role text/i);
  assert.match(sql, /service_resolve_login_identity/i);
  assert.match(sql, /service_list_employee_accounts/i);
  assert.match(sql, /service_write_credential_bundle/i);
  assert.match(sql, /revoke all on function[\s\S]*anon, authenticated/i);
  assert.doesNotMatch(sql, /plaintext_password|password_plain/i);
});

test("AUTH-ACCOUNT-002: service RPCs are private to the Worker service role", () => {
  assert.match(sql, /security definer[\s\S]*set search_path = ''/i);
  assert.match(sql, /revoke all on private\.password_escrow from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.service_resolve_login_identity\(text\) to service_role/i);
  assert.match(sql, /grant execute on function public\.service_read_password_escrow\(text\) to service_role/i);
});

test("AUTH-ACCOUNT-003: selectable roles remain server-side grants", () => {
  assert.match(sql, /role text not null check \(role in \('employee', 'hr'\)\)/i);
  assert.match(sql, /lower\(i\.username\) = lower\(btrim\(p_identifier\)\)/i);
  assert.match(sql, /effective_role/i);
  assert.match(sql, /private\.account_role_grants/i);
});
