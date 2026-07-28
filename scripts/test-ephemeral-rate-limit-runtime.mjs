import assert from "node:assert/strict";
import fs from "node:fs";

const credentials = JSON.parse(fs.readFileSync(process.env.EPHEMERAL_RUNTIME_CREDENTIALS, "utf8"));
const baseUrl = credentials.baseUrl;

async function call(path, { method = "GET", headers = {}, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "cf-connecting-ip": "198.18.0.1", ...headers },
    body,
  });
  return { status: response.status, retryAfter: response.headers.get("retry-after") };
}

async function login(identity, ip) {
  const response = await fetch(`${baseUrl}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "cf-connecting-ip": ip },
    body: JSON.stringify({ action: "login", email: identity.email, password: identity.password }),
  });
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie").split(";")[0];
}

async function threshold(path, limit, options = {}) {
  const results = [];
  for (let index = 0; index < limit + 1; index += 1) {
    results.push(await call(path, options));
  }
  const throttled = results[limit];
  assert.equal(throttled.status, 429, `${path} did not throttle at ${limit + 1}`);
  assert.ok(Number(throttled.retryAfter) > 0, `${path} missing Retry-After`);
  assert.equal(results.slice(0, limit).some((result) => result.status === 429), false, `${path} throttled early`);
  return { limit, requests: results.length, firstStatuses: results.slice(0, 3).map((result) => result.status), throttledStatus: throttled.status, retryAfterPresent: true };
}

const nonexistentLogin = await threshold("/api/auth", 5, {
  method: "POST",
  headers: { "Content-Type": "application/json", "cf-connecting-ip": "198.18.0.10" },
  body: JSON.stringify({ action: "login", email: "rate-limit-login@example.invalid", password: "wrong" }),
});

const reset = await threshold("/api/auth", 3, {
  method: "POST",
  headers: { "Content-Type": "application/json", "cf-connecting-ip": "198.18.0.11" },
  body: JSON.stringify({ action: "request-password-reset", email: "rate-limit-reset@example.invalid" }),
});

const setup = await threshold("/api/auth", 3, {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Setup-Key": "invalid-key", "cf-connecting-ip": "198.18.0.12" },
  body: JSON.stringify({ action: "setup-admin-password", email: credentials.identities.bootstrapAdmin.email, password: credentials.identities.bootstrapAdmin.password }),
});

const hrCookie = await login(credentials.identities.hr, "198.18.0.13");
const employeeSearch = await threshold("/api/employees?page=1&pageSize=1", 120, { headers: { Cookie: hrCookie, "cf-connecting-ip": "198.18.0.14" } });

const adminCookie = await login(credentials.identities.admin, "198.18.0.15");
const report = await threshold("/api/admin/reports", 20, { headers: { Cookie: adminCookie, "cf-connecting-ip": "198.18.0.16" } });

const upload = await threshold("/api/certificates/my/upload", 10, { headers: { Cookie: adminCookie, "cf-connecting-ip": "198.18.0.17" } });
const attendance = await threshold("/api/attendance/scan", 60, { headers: { "cf-connecting-ip": "198.18.0.18" } });
const publicJoin = await threshold("/api/public/live-training/join", 60, { method: "GET", headers: { "cf-connecting-ip": "198.18.0.19" } });

// Different platform-provided client addresses get independent buckets.
const firstBucket = await call("/api/auth", { method: "POST", headers: { "Content-Type": "application/json", "cf-connecting-ip": "198.18.0.20" }, body: JSON.stringify({ action: "login", email: "bucket-a@example.invalid", password: "wrong" }) });
const secondBucket = await call("/api/auth", { method: "POST", headers: { "Content-Type": "application/json", "cf-connecting-ip": "198.18.0.21" }, body: JSON.stringify({ action: "login", email: "bucket-a@example.invalid", password: "wrong" }) });
assert.notEqual(firstBucket.status, 429);
assert.notEqual(secondBucket.status, 429);

console.log(JSON.stringify({
  login: nonexistentLogin,
  passwordReset: reset,
  setup,
  employeeSearch,
  reports: report,
  upload,
  attendance,
  publicJoin,
  distinctPlatformAddressBuckets: true,
  limitation: "The local runtime uses in-memory buckets; distributed Durable Object/Cloudflare binding behavior remains staging-only evidence.",
}, null, 2));
