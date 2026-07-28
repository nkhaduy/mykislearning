import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";

import { handleApiRequest } from "../worker/router.js";
import { signToken } from "../worker/services/crypto.js";

const credentialsPath = process.env.EPHEMERAL_RUNTIME_CREDENTIALS;
const statusPath = process.env.EPHEMERAL_SUPABASE_STATUS;
assert.ok(credentialsPath, "EPHEMERAL_RUNTIME_CREDENTIALS is required");
assert.ok(statusPath, "EPHEMERAL_SUPABASE_STATUS is required");

function parseEnvFile(path) {
  return Object.fromEntries(fs.readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean).map((line) => {
    const separator = line.indexOf("=");
    let value = line.slice(separator + 1);
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    return [line.slice(0, separator), value];
  }));
}

const runtime = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
const supabase = parseEnvFile(statusPath);
const baseUrl = runtime.baseUrl;

function cookiePair(setCookie) {
  return String(setCookie || "").split(";")[0];
}

function containsSensitiveValue(value) {
  return /__pwd__:|pbkdf2(?:-sha256)?\$|password_hash/i.test(JSON.stringify(value));
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { response, body, setCookie: response.headers.get("set-cookie") || "" };
}

async function login(identity, { rememberMe = false, ip = "198.51.100.10", cookie = "" } = {}) {
  const headers = { "Content-Type": "application/json", "cf-connecting-ip": ip };
  if (cookie) headers.Cookie = cookie;
  return request("/api/auth", {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "login", email: identity.email, password: identity.password, rememberMe }),
  });
}

async function serviceRest(path, options = {}) {
  const response = await fetch(`${supabase.REST_URL}/${path}`, {
    ...options,
    headers: {
      apikey: supabase.SERVICE_ROLE_KEY,
      Authorization: `Bearer ${supabase.SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { response, body };
}

const results = {
  login: {},
  cookie: {},
  identityScope: {},
  lifecycle: {},
  bootstrap: {},
  limitations: [],
};

const employeeALogin = await login(runtime.identities.employeeA, { ip: "198.51.100.11" });
assert.equal(employeeALogin.response.status, 200);
assert.equal(containsSensitiveValue(employeeALogin.body), false);
assert.match(employeeALogin.setCookie, /HttpOnly/i);
assert.match(employeeALogin.setCookie, /SameSite=Strict/i);
assert.match(employeeALogin.setCookie, /Path=\//i);
assert.match(employeeALogin.setCookie, /Max-Age=28800/i);
const employeeACookie = cookiePair(employeeALogin.setCookie);
results.login.employeeA = employeeALogin.response.status;
results.cookie.normalMaxAge = 28800;

const employeeBLogin = await login(runtime.identities.employeeB, { rememberMe: true, ip: "198.51.100.12" });
assert.equal(employeeBLogin.response.status, 200);
assert.match(employeeBLogin.setCookie, /Max-Age=604800/i);
const employeeBCookie = cookiePair(employeeBLogin.setCookie);
results.login.employeeB = employeeBLogin.response.status;
results.cookie.rememberMeMaxAge = 604800;

const sessionProbe = await request("/api/auth?action=session", { headers: { Cookie: employeeACookie } });
assert.equal(sessionProbe.response.status, 200);
assert.deepEqual(Object.keys(sessionProbe.body).sort(), ["account", "authenticated", "expires_at"]);
assert.deepEqual(Object.keys(sessionProbe.body.account).sort(), ["id", "role"]);
assert.equal(sessionProbe.body.account.id, runtime.identities.employeeA.id);
assert.equal(sessionProbe.body.account.role, "employee");
results.lifecycle.sessionProbeMinimal = true;

const conflictingHeaders = await request("/api/auth?action=session", {
  headers: { Cookie: employeeACookie, "X-Account-Id": runtime.identities.hr.id, "X-Account-Role": "hr" },
});
assert.equal(conflictingHeaders.response.status, 200);
assert.equal(conflictingHeaders.body.account.role, "employee");
results.identityScope.conflictingHeadersIgnored = true;

const tamperedCookie = `${employeeACookie.slice(0, -1)}${employeeACookie.endsWith("a") ? "b" : "a"}`;
assert.equal((await request("/api/auth?action=session", { headers: { Cookie: tamperedCookie } })).response.status, 401);
const expired = await signToken({ sub: runtime.identities.employeeA.id, role: "employee", exp: Math.floor(Date.now() / 1000) - 60, jti: crypto.randomUUID() }, runtime.jwtSecret);
assert.equal((await request("/api/auth?action=session", { headers: { Cookie: `mykis_session=${expired}` } })).response.status, 401);
results.lifecycle.invalidAndExpiredRejected = true;

const fixedLogin = await login(runtime.identities.employeeA, {
  ip: "198.51.100.13",
  cookie: "mykis_session=attacker-fixed-session",
});
assert.equal(fixedLogin.response.status, 200);
assert.notEqual(cookiePair(fixedLogin.setCookie), "mykis_session=attacker-fixed-session");
results.lifecycle.sessionFixationBlocked = true;

const workerEnv = parseEnvFile("/tmp/kis-lms-worker-supabase.tzteKG/worker.env");
const httpsLogin = await handleApiRequest(new Request("https://portal.example.test/api/auth", {
  method: "POST",
  headers: { "Content-Type": "application/json", "cf-connecting-ip": "198.51.100.14" },
  body: JSON.stringify({ action: "login", email: runtime.identities.employeeB.email, password: runtime.identities.employeeB.password }),
}), workerEnv);
assert.equal(httpsLogin.status, 200);
assert.match(httpsLogin.headers.get("set-cookie") || "", /; Secure/i);
results.cookie.secureOnHttps = true;

for (const [label, cookie, ownId, otherId] of [
  ["employeeA", employeeACookie, runtime.identities.employeeA.id, runtime.identities.employeeB.id],
  ["employeeB", employeeBCookie, runtime.identities.employeeB.id, runtime.identities.employeeA.id],
]) {
  const scopedResponses = await Promise.all([
    request("/api/learning-history/me", { headers: { Cookie: cookie } }),
    request("/api/notifications", { headers: { Cookie: cookie } }),
    request("/api/certificates/my", { headers: { Cookie: cookie } }),
    request("/api/compliance/my", { headers: { Cookie: cookie } }),
    request("/api/development-plans/my", { headers: { Cookie: cookie } }),
  ]);
  for (const scoped of scopedResponses) {
    assert.equal(scoped.response.status, 200);
    const serialized = JSON.stringify(scoped.body);
    assert.equal(serialized.includes(otherId), false, `${label} response leaked ${otherId}`);
  }
  assert.equal((await request(`/api/notifications?accountId=${encodeURIComponent(otherId)}`, { headers: { Cookie: cookie } })).response.status, 403);
  results.identityScope[label] = { ownDataOnly: true, crossNotificationDenied: true, identity: ownId };
}

assert.equal((await request("/api/certificates/my/00000000-0000-0000-0000-0000000000b2", { headers: { Cookie: employeeACookie } })).response.status, 403);
assert.equal((await request("/api/certificates/my/00000000-0000-0000-0000-0000000000a2", { headers: { Cookie: employeeBCookie } })).response.status, 403);
assert.equal((await request("/api/employees", { headers: { Cookie: employeeACookie } })).response.status, 403);
results.identityScope.symmetricCrossUserDenial = true;

const trainerLogin = await login(runtime.identities.trainer, { ip: "198.51.100.15" });
assert.equal(trainerLogin.response.status, 200);
assert.equal((await request("/api/employees", { headers: { Cookie: cookiePair(trainerLogin.setCookie) } })).response.status, 403);
results.identityScope.trainer = { employeePiiDenied: true, instructorRoleImplemented: false };

const hrLogin = await login(runtime.identities.hr, { ip: "198.51.100.16" });
assert.equal(hrLogin.response.status, 200);
const hrCookie = cookiePair(hrLogin.setCookie);
const employeeList = await request("/api/employees?page=1&pageSize=20", { headers: { Cookie: hrCookie } });
assert.equal(employeeList.response.status, 200);
assert.equal(containsSensitiveValue(employeeList.body), false);
results.identityScope.hr = { employeeListAllowed: true, credentialsAbsent: true };

const adminLogin = await login(runtime.identities.admin, { ip: "198.51.100.17" });
assert.equal(adminLogin.response.status, 200);
const adminCookie = cookiePair(adminLogin.setCookie);
const auditList = await request("/api/admin/audit-logs?page=1&pageSize=10", { headers: { Cookie: adminCookie } });
assert.equal(auditList.response.status, 200);
assert.equal(containsSensitiveValue(auditList.body), false);
results.identityScope.admin = { auditLogAllowed: true, credentialsAbsent: true };

const legacyProfile = {
  id: "synthetic-legacy-only",
  employee_code: "SYN-LO",
  full_name: "Synthetic Legacy Only",
  email: "legacy-only@example.invalid",
  role: "employee",
  department: "Local",
  position: "Legacy Test",
  account_status: "active",
  password_status: "normal",
  avatar_url: "__pwd__:pbkdf2-sha256$100000$00$00",
};
assert.equal((await serviceRest("profiles", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(legacyProfile) })).response.status, 201);
const legacyLogin = await request("/api/auth", {
  method: "POST",
  headers: { "Content-Type": "application/json", "cf-connecting-ip": "198.51.100.18" },
  body: JSON.stringify({ action: "login", email: legacyProfile.email, password: "does-not-matter" }),
});
assert.equal(legacyLogin.response.status, 403);
assert.equal(legacyLogin.body.error, "ACCOUNT_NEEDS_RESET");
await serviceRest(`profiles?id=eq.${encodeURIComponent(legacyProfile.id)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
results.lifecycle.legacyProfileFallbackDisabled = true;

const newEmployeeBPassword = `${crypto.randomBytes(18).toString("base64url")}Bb2!`;
const passwordChange = await request("/api/auth", {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: employeeBCookie, "cf-connecting-ip": "198.51.100.19" },
  body: JSON.stringify({ action: "change-password", currentPassword: runtime.identities.employeeB.password, newPassword: newEmployeeBPassword }),
});
assert.equal(passwordChange.response.status, 200);
assert.equal((await login(runtime.identities.employeeB, { ip: "198.51.100.20" })).response.status, 401);
const updatedEmployeeB = { ...runtime.identities.employeeB, password: newEmployeeBPassword };
const updatedEmployeeBLogin = await login(updatedEmployeeB, { ip: "198.51.100.21" });
assert.equal(updatedEmployeeBLogin.response.status, 200);
results.lifecycle.passwordChange = { oldRejected: true, newAccepted: true };

const resetEmployeeAPassword = `${crypto.randomBytes(18).toString("base64url")}Cc3!`;
const hrReset = await request("/api/auth", {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: hrCookie, "cf-connecting-ip": "198.51.100.22" },
  body: JSON.stringify({ action: "reset-password", targetUserId: runtime.identities.employeeA.id, newPassword: resetEmployeeAPassword, requireChange: true }),
});
assert.equal(hrReset.response.status, 200);
assert.equal((await login(runtime.identities.employeeA, { ip: "198.51.100.23" })).response.status, 401);
const resetEmployeeALogin = await login({ ...runtime.identities.employeeA, password: resetEmployeeAPassword }, { ip: "198.51.100.24" });
assert.equal(resetEmployeeALogin.response.status, 200);
assert.equal(resetEmployeeALogin.body.profile.passwordStatus, "resetRequired");
results.lifecycle.hrReset = { oldRejected: true, newAccepted: true, mustChange: true };

const logoutCookie = cookiePair(updatedEmployeeBLogin.setCookie);
const logoutToken = logoutCookie.slice("mykis_session=".length);
const payloadPart = logoutToken.slice(0, logoutToken.indexOf("."));
const tokenPayload = JSON.parse(Buffer.from(payloadPart.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
const logout = await request("/api/auth", {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: logoutCookie },
  body: JSON.stringify({ action: "logout" }),
});
assert.equal(logout.response.status, 200);
assert.match(logout.setCookie, /Max-Age=0/i);
assert.equal((await request("/api/auth?action=session", { headers: { Cookie: logoutCookie } })).response.status, 401);
const revoked = await serviceRest("rpc/service_is_session_revoked", { method: "POST", body: JSON.stringify({ p_session_id: tokenPayload.jti }) });
assert.equal(revoked.response.status, 200);
assert.equal(revoked.body, true);
results.lifecycle.logout = { cookieCleared: true, oldSessionRejected: true, revocationPersisted: true };

const refresh = await request("/api/auth", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "refresh" }),
});
assert.equal(refresh.response.status, 400);
results.limitations.push("Refresh token rotation/reuse is not implemented; SEC-005 cannot be marked VERIFIED.");

assert.notEqual(runtime.setupKey, supabase.SERVICE_ROLE_KEY);
assert.equal(supabase.SERVICE_ROLE_KEY.endsWith(runtime.setupKey), false);
const invalidSetup = await request("/api/auth", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Setup-Key": `${runtime.setupKey}x`, "cf-connecting-ip": "203.0.113.1" },
  body: JSON.stringify({ action: "setup-admin-password", email: runtime.identities.bootstrapAdmin.email, password: runtime.identities.bootstrapAdmin.password }),
});
assert.equal(invalidSetup.response.status, 401);

const bootstrapResponses = await Promise.all(Array.from({ length: 8 }, (_, index) => request("/api/auth", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Setup-Key": runtime.setupKey, "cf-connecting-ip": `203.0.113.${index + 10}` },
  body: JSON.stringify({ action: "setup-admin-password", email: runtime.identities.bootstrapAdmin.email, password: runtime.identities.bootstrapAdmin.password }),
})));
const bootstrapStatuses = bootstrapResponses.map(({ response }) => response.status);
assert.equal(bootstrapStatuses.filter((status) => status === 200).length, 1);
assert.equal(bootstrapStatuses.filter((status) => status === 410).length, 7);
const afterBootstrap = await request("/api/auth", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Setup-Key": runtime.setupKey, "cf-connecting-ip": "203.0.113.30" },
  body: JSON.stringify({ action: "setup-admin-password", email: runtime.identities.bootstrapAdmin.email, password: runtime.identities.bootstrapAdmin.password }),
});
assert.equal(afterBootstrap.response.status, 410);
assert.equal((await login(runtime.identities.bootstrapAdmin, { ip: "203.0.113.31" })).response.status, 200);
const bootstrapProfiles = await serviceRest(`profiles?id=eq.${encodeURIComponent(runtime.identities.bootstrapAdmin.id)}&select=id`);
assert.equal(bootstrapProfiles.response.status, 200);
assert.equal(bootstrapProfiles.body.length, 1);
const bootstrapAudit = await serviceRest("audit_logs?action=eq.auth.setup_admin_completed&select=id");
assert.equal(bootstrapAudit.response.status, 200);
assert.equal(bootstrapAudit.body.length, 1);
const bootstrapState = await serviceRest("rpc/service_bootstrap_status", { method: "POST", body: "{}" });
assert.equal(bootstrapState.response.status, 200);
assert.ok(bootstrapState.body?.consumed_at);
results.bootstrap = {
  concurrency: 8,
  success: 1,
  alreadyConsumed: 7,
  subsequentStatus: 410,
  profileCount: 1,
  auditCount: 1,
  secretIndependentFromServiceRole: true,
};

console.log(JSON.stringify(results, null, 2));
