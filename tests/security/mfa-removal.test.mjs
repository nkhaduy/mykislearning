import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const root = new URL("../../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("AUTH-MFA-REMOVAL-001: runtime no longer ships enrollment, challenge or verification handlers", () => {
  assert.equal(existsSync(new URL("worker/services/mfa.js", root)), false);
  const auth = read("worker/routes/auth.js");
  const login = read("src/features/auth/login.js");
  assert.doesNotMatch(auth, /mfa-enroll|mfa-verify|admin-reset-mfa|MFA_CHALLENGE/);
  assert.doesNotMatch(login, /mfa-enroll|mfa-verify|otpauth|recoveryCodes|QRCode/);
});

test("AUTH-MFA-REMOVAL-002: final migration removes MFA storage, RPCs and assurance columns", () => {
  const migration = read("supabase/migrations/20260728030009_remove_mfa_2fa.sql");
  assert.match(migration, /drop table if exists private\.mfa_recovery_codes/);
  assert.match(migration, /drop table if exists private\.mfa_factors/);
  assert.match(migration, /drop function if exists public\.service_read_mfa_factor/);
  assert.match(migration, /drop column if exists assurance_level/);
  assert.match(migration, /drop column if exists mfa_verified_at/);
  assert.match(migration, /drop column if exists step_up_at/);
});
