import test from "node:test";
import assert from "node:assert/strict";
import { RateLimiterDurableObject } from "../../worker/rate-limiter-do.js";
import { trustedClientIp } from "../../worker/services/client-ip.js";
import { enforceRateLimit, normalizeDimension, validateRateLimitBinding } from "../../worker/services/rate-limit.js";

function fakeState() {
  const map = new Map();
  let alarm = null;
  return {
    storage: {
      async get(key) { return map.get(key); },
      async put(key, value) { map.set(key, value); },
      async transaction(callback) { return callback(this); },
      async list({ prefix }) { return new Map([...map].filter(([key]) => key.startsWith(prefix))); },
      async delete(key) { map.delete(key); },
      async getAlarm() { return alarm; },
      async setAlarm(value) { alarm = value; },
    },
  };
}

test("RATE-DO-001: multiple Worker contexts share one Durable Object bucket", async () => {
  const key = "a".repeat(43);
  const object = new RateLimiterDurableObject(fakeState());
  const responses = [];
  for (let index = 0; index < 3; index += 1) responses.push(await object.fetch(new Request("https://rate-limiter.internal/limit", {
    method: "POST", body: JSON.stringify({ key, limit: 2, windowSeconds: 60 }),
  })));
  const bodies = await Promise.all(responses.map((response) => response.json()));
  assert.equal(bodies.filter((body) => body.success).length, 2);
  assert.equal(bodies.filter((body) => !body.success).length, 1);
});

test("RATE-KEY-001: identifier normalization and Cloudflare IP trust prevent trivial bypass", () => {
  assert.equal(normalizeDimension("  Admin@Example.COM "), normalizeDimension("admin@example.com"));
  const request = new Request("https://lms.example.test/api/auth", { headers: { "CF-Connecting-IP": "203.0.113.10", "X-Forwarded-For": "198.51.100.99" } });
  assert.equal(trustedClientIp(request, { APP_ENV: "production" }), "203.0.113.10");
});

test("RATE-CONFIG-001: production fails clearly without the Durable Object binding", () => {
  assert.throws(() => validateRateLimitBinding({ APP_ENV: "production", RATE_LIMIT_KEY_SECRET: "x".repeat(32) }), /binding is missing/);
});

test("RATE-DO-002: unbounded or malformed bucket names are rejected", async () => {
  const object = new RateLimiterDurableObject(fakeState());
  const response = await object.fetch(new Request("https://rate-limiter.internal/limit", { method: "POST", body: JSON.stringify({ key: "attacker-input", limit: 1, windowSeconds: 60 }) }));
  assert.equal(response.status, 400);
});

test("RATE-DO-003: expired buckets are removed by the Durable Object alarm", async () => {
  const state = fakeState();
  const key = "b".repeat(43);
  await state.storage.put(`bucket:${key}`, { count: 3, resetAt: Date.now() - 1 });
  await new RateLimiterDurableObject(state).alarm();
  assert.equal(await state.storage.get(`bucket:${key}`), undefined);
});

test("RATE-CONFIG-002: production never falls back to the in-memory limiter", async () => {
  const response = await enforceRateLimit(
    new Request("https://lms.example.test/api/auth", { headers: { "CF-Connecting-IP": "203.0.113.10" } }),
    { APP_ENV: "production", RATE_LIMIT_KEY_SECRET: "x".repeat(32) },
    "login-account",
    "employee@example.test",
    { limit: 5, windowSeconds: 60, critical: true },
  );
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "RATE_LIMIT_UNAVAILABLE");
});
