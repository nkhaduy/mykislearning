import test from "node:test";
import assert from "node:assert/strict";

async function loadClient(label) {
  return import(`../../src/shared/api/client.js?api-cache-test=${label}-${Date.now()}-${Math.random()}`);
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("API-CACHE-001: concurrent GET requests share one in-flight response", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return jsonResponse({ value: calls });
  };
  try {
    const { apiJson } = await loadClient("dedupe");
    const [first, second] = await Promise.all([apiJson("/api/courses"), apiJson("/api/courses")]);
    assert.deepEqual(first, { value: 1 });
    assert.deepEqual(second, { value: 1 });
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("API-CACHE-002: a fresh GET is returned from memory", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => jsonResponse({ value: ++calls });
  try {
    const { apiJson } = await loadClient("fresh");
    assert.deepEqual(await apiJson("/api/employees?pageSize=50"), { value: 1 });
    assert.deepEqual(await apiJson("/api/employees?pageSize=50"), { value: 1 });
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("API-CACHE-003: stale data renders immediately and revalidates in the background", async () => {
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  let now = 1_000;
  let calls = 0;
  Date.now = () => now;
  globalThis.fetch = async () => jsonResponse({ value: ++calls });
  try {
    const { apiJson } = await loadClient("stale");
    assert.deepEqual(await apiJson("/api/courses", { staleTime: 10, gcTime: 1_000 }), { value: 1 });
    now += 20;
    assert.deepEqual(await apiJson("/api/courses", { staleTime: 10, gcTime: 1_000 }), { value: 1 });
    assert.equal(calls, 2);
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(await apiJson("/api/courses", { staleTime: 10, gcTime: 1_000 }), { value: 2 });
  } finally {
    Date.now = originalNow;
    globalThis.fetch = originalFetch;
  }
});

test("API-CACHE-004: successful mutations invalidate cached GET data", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (_path, options = {}) => jsonResponse({ call: ++calls, method: options.method || "GET" });
  try {
    const { apiJson } = await loadClient("mutation");
    assert.equal((await apiJson("/api/courses")).call, 1);
    await apiJson("/api/courses", { method: "POST", body: "{}" });
    assert.equal((await apiJson("/api/courses")).call, 3);
    assert.equal(calls, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("API-CACHE-005: explicit cache clearing removes authenticated data", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => jsonResponse({ value: ++calls });
  try {
    const { apiJson, clearApiCache } = await loadClient("clear");
    await apiJson("/api/employees?pageSize=50");
    clearApiCache();
    assert.equal((await apiJson("/api/employees?pageSize=50")).value, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

