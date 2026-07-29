import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(new URL("../../supabase/migrations/20260728013513_auth_rotation_mfa_hardening.sql", import.meta.url), "utf8");
const removalMigration = readFileSync(new URL("../../supabase/migrations/20260728030009_remove_mfa_2fa.sql", import.meta.url), "utf8");
const authRoutes = readFileSync(new URL("../../worker/routes/auth.js", import.meta.url), "utf8");
const accountSupportRoutes = readFileSync(new URL("../../worker/routes/account-support.js", import.meta.url), "utf8");

test("AUTH-ROTATION-001: schema stores hashes and family metadata, never plaintext refresh tokens", () => {
  assert.match(migration, /token_hash text not null unique/);
  assert.match(migration, /token_family_id uuid not null/);
  assert.match(migration, /parent_token_id uuid unique/);
  assert.match(migration, /service_rotate_refresh_token/);
  assert.match(migration, /for update/);
  assert.doesNotMatch(migration, /refresh_token text/i);
});

test("AUTH-ROTATION-002: reuse revokes the whole family", () => {
  assert.match(migration, /status', 'reuse_detected/);
  assert.match(migration, /where token_family_id = v_token\.token_family_id/);
  assert.match(migration, /revocation_reason.*refresh_reuse/);
});

test("AUTH-SESSION-001: password changes revoke auth sessions", () => {
  assert.match(migration, /credential_changed/);
  assert.match(migration, /service_revoke_all_auth_sessions/);
});

test("AUTH-PRIVILEGED-001: sensitive account actions require an HR session", () => {
  assert.match(authRoutes, /export async function requirePrivilegedSession/);
  assert.match(accountSupportRoutes, /action === "unlock"[\s\S]*requirePrivilegedSession/);
  assert.match(accountSupportRoutes, /action === "reactivate"[\s\S]*requirePrivilegedSession/);
  assert.doesNotMatch(authRoutes, /STEP_UP_REQUIRED|mfa-verify/);
  assert.match(removalMigration, /drop function if exists public\.service_set_session_assurance/);
});

test("AUTH-NETWORK-001: support audit metadata uses the centralized Cloudflare IP trust policy", () => {
  assert.match(accountSupportRoutes, /trustedClientIp\(request, env\)/);
  assert.doesNotMatch(accountSupportRoutes, /request\.headers\.get\("x-forwarded-for"\)/i);
});
