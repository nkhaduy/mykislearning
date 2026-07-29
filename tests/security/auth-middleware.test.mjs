import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { resolveAccount } from "../../worker/middleware/auth.js";
import { handleApiRequest } from "../../worker/router.js";
import { signToken } from "../../worker/services/crypto.js";
import worker from "../../worker/index.js";
import { enforceRateLimit } from "../../worker/services/rate-limit.js";

const JWT_SECRET = "test-only-session-secret-at-least-32-characters";
const fakeQuery = () => {
  const chain = new Proxy({}, {
    get(_target, property) {
      if (property === "then") return (resolve) => resolve({ data: null, error: null });
      return () => chain;
    },
  });
  return chain;
};
const testSupabase = {
  from: () => fakeQuery(),
  async rpc(name, params = {}) {
    if (name === "service_get_auth_session") {
      const marker = String(params.p_profile_id || "").replace(/^test-/, "") || "employee";
      const role = marker.split("-")[0];
      return { data: { valid: true, profile_id: params.p_profile_id, role, session_id: params.p_session_id, family_id: "00000000-0000-4000-8000-000000000099", expires_at: new Date(Date.now() + 3600_000).toISOString() }, error: null };
    }
    return { data: true, error: null };
  },
};
const rateLimiterBinding = {
  idFromName: (name) => name,
  get: () => ({ fetch: async () => Response.json({ success: true, retryAfter: 1 }) }),
};
const baseEnv = {
  APP_ENV: "production",
  NODE_ENV: "test",
  JWT_SECRET,
  REFRESH_TOKEN_HASH_SECRET: "refresh-token-test-secret-at-least-32-chars",
  RATE_LIMIT_KEY_SECRET: "rate-limit-test-secret-at-least-32-chars",
  RATE_LIMITER_DO: rateLimiterBinding,
  TEST_SUPABASE_CLIENT: testSupabase,
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "test-only-service-role-placeholder",
};

function employeeRequest(headers = {}) {
  return new Request("https://lms.example.test/api/employees", { headers });
}

async function tokenFor(role, exp = Math.floor(Date.now() / 1000) + 300) {
  return signToken({ sub: `test-${role}`, role, sid: `00000000-0000-4000-8000-0000000000${role === "hr" ? "02" : "01"}`, exp }, JWT_SECRET);
}

async function tokenForSubject(subject, claimedRole = "employee") {
  return signToken({ sub: subject, role: claimedRole, sid: "00000000-0000-4000-8000-000000000002", exp: Math.floor(Date.now() / 1000) + 300 }, JWT_SECRET);
}

test("SEC-001: production rejects forged identity headers without a bearer token", async () => {
  const response = await handleApiRequest(employeeRequest({
    "X-Account-Id": "forged-account",
    "X-Account-Role": "hr",
  }), baseEnv);

  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "UNAUTHORIZED");
});

test("SEC-001: anonymous private endpoint matrix fails closed with 401", async () => {
  const endpoints = [
    ["GET", "/api/courses"],
    ["GET", "/api/enrollments"],
    ["POST", "/api/content-progress"],
    ["GET", "/api/training/sessions"],
    ["POST", "/api/attendance/scan"],
    ["GET", "/api/external-training"],
    ["GET", "/api/certificates/my"],
    ["GET", "/api/admin/certificates"],
    ["POST", "/api/learning-history"],
    ["GET", "/api/admin/learning-records"],
    ["GET", "/api/employees"],
    ["POST", "/api/admin/backfill"],
    ["POST", "/api/activity/heartbeat"],
    ["GET", "/api/admin/overview"],
    ["GET", "/api/admin/account-support/requests"],
    ["GET", "/api/notifications"],
    ["GET", "/api/quizzes"],
    ["GET", "/api/admin/courses/course-1/versions"],
    ["GET", "/api/learning-paths/my"],
    ["GET", "/api/admin/learning-paths"],
    ["GET", "/api/admin/reports"],
    ["GET", "/api/competencies/my"],
    ["GET", "/api/admin/competencies"],
    ["GET", "/api/development-plans/my"],
    ["GET", "/api/admin/development-plans"],
    ["GET", "/api/admin/audit-logs"],
    ["GET", "/api/compliance/my"],
    ["GET", "/api/admin/compliance/overview"],
    ["GET", "/api/admin/training-tracking"],
    ["GET", "/api/admin/cchn/catalog"],
    ["GET", "/api/admin/cchn/registrations"],
  ];

  for (const [method, path] of endpoints) {
    const response = await handleApiRequest(new Request(`https://lms.example.test${path}`, {
      method,
      headers: method === "POST" ? { "Content-Type": "application/json" } : {},
      body: method === "POST" ? "{}" : undefined,
    }), baseEnv);
    assert.equal(response.status, 401, `${method} ${path}`);
  }
});

test("SEC-001: employee cannot call HR-only endpoint matrix", async () => {
  const token = await tokenFor("employee");
  const endpoints = [
    ["GET", "/api/employees"],
    ["POST", "/api/admin/backfill"],
    ["GET", "/api/admin/overview"],
    ["GET", "/api/admin/reports"],
    ["GET", "/api/admin/audit-logs"],
    ["GET", "/api/admin/compliance/overview"],
  ];

  for (const [method, path] of endpoints) {
    const response = await handleApiRequest(new Request(`https://lms.example.test${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
      },
      body: method === "POST" ? "{}" : undefined,
    }), baseEnv);
    assert.equal(response.status, 403, `${method} ${path}`);
  }
});

test("SEC-001: invalid bearer never falls through to forged headers", async () => {
  const response = await handleApiRequest(employeeRequest({
    Authorization: "Bearer invalid-token",
    "X-Account-Id": "forged-account",
    "X-Account-Role": "hr",
  }), baseEnv);

  assert.equal(response.status, 401);
});

test("SEC-001: expired bearer returns 401", async () => {
  const token = await tokenFor("hr", Math.floor(Date.now() / 1000) - 1);
  const response = await handleApiRequest(employeeRequest({ Authorization: `Bearer ${token}` }), baseEnv);

  assert.equal(response.status, 401);
});

test("SEC-001: signed employee claim wins over conflicting forged HR headers", async () => {
  const token = await tokenFor("employee");
  const response = await handleApiRequest(employeeRequest({
    Authorization: `Bearer ${token}`,
    "X-Account-Id": "forged-account",
    "X-Account-Role": "hr",
  }), baseEnv);

  assert.equal(response.status, 403);
});

test("SEC-001: server-side role resolution rejects a privileged JWT role claim for an employee", async () => {
  const token = await tokenForSubject("test-employee", "admin");
  const response = await handleApiRequest(employeeRequest({ Authorization: `Bearer ${token}` }), baseEnv);
  assert.equal(response.status, 401);
});

test("AUTH-PRIVILEGED-002: privileged API rejects role mismatch and accepts a matching HR role", async () => {
  const employeeToken = await tokenForSubject("test-employee", "admin");
  const forbidden = await handleApiRequest(new Request("https://lms.example.test/api/auth?action=admin-revoke-sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${employeeToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ targetAccountId: "test-other-employee" }),
  }), baseEnv);
  assert.equal(forbidden.status, 401);
  assert.equal((await forbidden.json()).error, "UNAUTHORIZED");

  const hrToken = await tokenForSubject("test-hr", "hr");
  const allowed = await handleApiRequest(new Request("https://lms.example.test/api/auth?action=admin-revoke-sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${hrToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ targetAccountId: "test-employee" }),
  }), baseEnv);
  assert.equal(allowed.status, 200);
});

test("SEC-001: a valid signed claim is the resolved identity", async () => {
  const token = await tokenFor("hr");
  const account = await resolveAccount(employeeRequest({
    Authorization: `Bearer ${token}`,
    "X-Account-Id": "forged-account",
    "X-Account-Role": "employee",
  }), baseEnv);

  assert.equal(account.accountId, "test-hr");
  assert.equal(account.role, "hr");
  assert.match(account.sessionId, /^[0-9a-f-]{36}$/);
});

test("SEC-001: legacy headers require explicit local-only configuration", async () => {
  const request = employeeRequest({
    "X-Account-Id": "local-account",
    "X-Account-Role": "hr",
  });

  assert.equal(await resolveAccount(request, {
    ...baseEnv,
    APP_ENV: "staging",
    ALLOW_LEGACY_IDENTITY_HEADERS: "true",
  }), null);

  assert.deepEqual(await resolveAccount(request, {
    ...baseEnv,
    APP_ENV: "local",
    ALLOW_LEGACY_IDENTITY_HEADERS: "true",
  }), { accountId: "local-account", role: "hr" });
});

test("SEC-006: untrusted CORS preflight is rejected", async () => {
  const response = await handleApiRequest(new Request("https://lms.example.test/api/employees", {
    method: "OPTIONS",
    headers: { Origin: "https://attacker.example" },
  }), baseEnv);

  assert.equal(response.status, 403);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
});

test("SEC-006: approved CORS preflight excludes identity headers", async () => {
  const response = await handleApiRequest(new Request("https://lms.example.test/api/employees", {
    method: "OPTIONS",
    headers: { Origin: "https://portal.example.test" },
  }), { ...baseEnv, CORS_ALLOWED_ORIGINS: "https://portal.example.test" });

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://portal.example.test");
  assert.doesNotMatch(response.headers.get("access-control-allow-headers") || "", /x-account-(id|role)/i);
});

test("SEC-010: API responses include the security header baseline", async () => {
  const response = await handleApiRequest(employeeRequest(), baseEnv);

  assert.match(response.headers.get("strict-transport-security") || "", /max-age=31536000/);
  assert.match(response.headers.get("content-security-policy") || "", /frame-ancestors 'self'/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.match(response.headers.get("permissions-policy") || "", /camera=\(self\)/);
  assert.match(response.headers.get("x-robots-tag") || "", /noindex/);
});

test("SEC-008: setup-admin endpoint is disabled by default", async () => {
  const response = await handleApiRequest(new Request("https://lms.example.test/api/auth?action=setup-admin-password", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Setup-Key": "forged" },
    body: JSON.stringify({ email: "admin@example.test", password: "not-used" }),
  }), baseEnv);

  assert.equal(response.status, 404);
});

test("SEC-008: setup key comparison uses a fixed-length digest", async () => {
  const source = await readFile(new URL("../../worker/routes/auth.js", import.meta.url), "utf8");
  assert.match(source, /constantTimeSecretEqual/);
  assert.match(source, /crypto\.subtle\.digest\("SHA-256"/);
  assert.doesNotMatch(source, /setupKey\s*!==\s*expectedKey/);
});

test("SEO-001: Worker serves robots and sitemap contracts instead of the SPA shell", async () => {
  const env = { ...baseEnv, ASSETS: { fetch: async () => new Response("<html>shell</html>", { headers: { "Content-Type": "text/html" } }) } };
  const robots = await worker.fetch(new Request("https://lms.example.test/robots.txt"), env, {});
  const sitemap = await worker.fetch(new Request("https://lms.example.test/sitemap.xml"), env, {});

  assert.equal(robots.status, 200);
  assert.match(robots.headers.get("content-type") || "", /^text\/plain/);
  assert.match(await robots.text(), /Disallow: \/hr\//);
  assert.equal(sitemap.status, 200);
  assert.match(sitemap.headers.get("content-type") || "", /application\/xml/);
  assert.match(await sitemap.text(), /<urlset/);
});

test("UX-003/SEO-003: unknown Worker navigation returns 404 and noindex", async () => {
  const env = { ...baseEnv, ASSETS: { fetch: async () => new Response("<html>shell</html>", { headers: { "Content-Type": "text/html" } }) } };
  const response = await worker.fetch(new Request("https://lms.example.test/does-not-exist"), env, {});

  assert.equal(response.status, 404);
  assert.match(response.headers.get("x-robots-tag") || "", /noindex/);
});

test("SEC-007: rate limiter returns 429 with Retry-After after the configured threshold", async () => {
  const request = new Request("https://lms.example.test/api/auth", { headers: { "CF-Connecting-IP": `192.0.2.${Math.floor(Math.random() * 200) + 1}` } });
  assert.equal(await enforceRateLimit(request, {}, "test-login", "account@example.invalid", { limit: 2, windowSeconds: 60 }), null);
  assert.equal(await enforceRateLimit(request, {}, "test-login", "account@example.invalid", { limit: 2, windowSeconds: 60 }), null);
  const response = await enforceRateLimit(request, {}, "test-login", "account@example.invalid", { limit: 2, windowSeconds: 60 });
  assert.equal(response.status, 429);
  assert.match(response.headers.get("retry-after") || "", /^\d+$/);
});

test("SEC-005: HttpOnly session cookie authenticates when no bearer header is present", async () => {
  const token = await tokenFor("employee");
  const account = await resolveAccount(employeeRequest({ Cookie: `mykis_session=${encodeURIComponent(token)}` }), baseEnv);
  assert.equal(account.accountId, "test-employee");
  assert.equal(account.role, "employee");
});

test("SEC-005: logout clears the HttpOnly session cookie", async () => {
  const token = await tokenFor("employee");
  const response = await handleApiRequest(new Request("https://lms.example.test/api/auth?action=logout", {
    method: "POST",
    headers: { Cookie: `mykis_session=${encodeURIComponent(token)}` },
  }), baseEnv);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie") || "", /mykis_session=;/);
  assert.match(response.headers.get("set-cookie") || "", /HttpOnly/);
  assert.match(response.headers.get("set-cookie") || "", /Max-Age=0/);
});

test("SEC-005/UX-004: session probe fails closed for anonymous requests", async () => {
  const response = await handleApiRequest(new Request("https://lms.example.test/api/auth?action=session"), baseEnv);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { authenticated: false, error: "UNAUTHORIZED" });
});

test("SEC-005/UX-004: session probe returns only signed identity metadata", async () => {
  const token = await tokenFor("employee");
  const response = await handleApiRequest(new Request("https://lms.example.test/api/auth?action=session", {
    headers: { Cookie: `mykis_session=${encodeURIComponent(token)}` },
  }), baseEnv);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.authenticated, true);
  assert.deepEqual(body.account, { id: "test-employee", role: "employee" });
  assert.equal(typeof body.expires_at, "number");
  assert.doesNotMatch(JSON.stringify(body), /password|token|email|fullName/i);
});
