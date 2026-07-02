import { test, expect } from "playwright/test";
import { sanitizeAuditPayload } from "../worker/services/audit-redaction.js";
import { parseAuditFilters } from "../worker/services/audit-query-service.js";
import { withRequestContext } from "../worker/middleware/request-context.js";
import { json } from "../worker/services/responses.js";

const BASE = "https://mykis-learning.nkhaduy.workers.dev";
const HR_EMAIL = process.env.MYKIS_HR_EMAIL || "hr@kisvn.vn";
const HR_PASSWORD = process.env.MYKIS_HR_PASSWORD || "Training@2026";
const HR_HEADERS = { "Content-Type": "application/json", "X-Account-Id": "acc-hr-001", "X-Account-Role": "hr" };
const EMP_HEADERS = { "Content-Type": "application/json", "X-Account-Id": "emp-test-001", "X-Account-Role": "employee" };

async function loginHr(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#loginEmail", HR_EMAIL);
  await page.fill("#loginPassword", HR_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/admin|\/dashboard/, { timeout: 15000 });
}

async function fetchApi(page, path, options = {}) {
  return page.evaluate(async ({ base, path, options }) => {
    const r = await fetch(`${base}${path}`, options);
    const body = await r.json().catch(() => ({}));
    return {
      ok: r.ok,
      status: r.status,
      body,
      requestId: r.headers.get("X-Request-ID") || "",
      correlationId: r.headers.get("X-Correlation-ID") || "",
      contentType: r.headers.get("Content-Type") || "",
    };
  }, { base: BASE, path, options });
}

test.describe("Phase 7 audit log local guards", () => {
  test("redacts sensitive nested values and keeps non-sensitive fields", async () => {
    const payload = sanitizeAuditPayload({
      name: "Nguyen Van A",
      password: "secret",
      nested: { access_token: "token", signed_url: "https://example.test/private", department: "HR" },
    });
    expect(payload.name).toBe("Nguyen Van A");
    expect(payload.password).toBe("[REDACTED]");
    expect(payload.nested.access_token).toBe("[REDACTED]");
    expect(payload.nested.signed_url).toBe("[REDACTED]");
    expect(payload.nested.department).toBe("HR");
  });

  test("truncates oversized payloads safely", async () => {
    const payload = sanitizeAuditPayload(Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`field_${i}`, "x".repeat(1000)])));
    expect(payload.payload_truncated).toBe(true);
    expect(payload.preview).not.toContain("password");
  });

  test("request context returns sanitized request and correlation IDs", async () => {
    const req = new Request("https://example.test/api/admin/audit-logs", {
      headers: {
        "X-Request-ID": "bad id with spaces",
        "X-Correlation-ID": "corr_valid-1234",
        "User-Agent": "a".repeat(700),
        "CF-IPCountry": "VN",
        "CF-Connecting-IP": "203.0.113.10",
      },
    });
    const res = await withRequestContext(req, { AUDIT_IP_HASH_SALT: "test-salt" }, async () => json({ ok: true }));
    expect(res.headers.get("X-Request-ID")).toMatch(/^req_/);
    expect(res.headers.get("X-Correlation-ID")).toBe("corr_valid-1234");
  });

  test("query guard rejects invalid sort and long search", async () => {
    const badSort = new URL("https://example.test/api/admin/audit-logs?sortBy=created_at;drop");
    expect(() => parseAuditFilters(badSort)).toThrow(/INVALID_SORT_FIELD/);
    const longSearch = new URL(`https://example.test/api/admin/audit-logs?search=${"x".repeat(121)}`);
    expect(() => parseAuditFilters(longSearch)).toThrow(/SEARCH_TOO_LONG/);
  });
});

test.describe("Phase 7 audit log production", () => {
  test("API — request IDs, HR list/detail, employee block, and export", async ({ page }) => {
    const report = await fetchApi(page, "/api/admin/reports/export?report_type=overview&format=csv", {
      method: "GET",
      headers: { ...HR_HEADERS, "X-Request-ID": "phase7_req_valid_1234", "X-Correlation-ID": "phase7_corr_valid_1234" },
    });
    expect(report.ok).toBeTruthy();
    expect(report.requestId).toBe("phase7_req_valid_1234");

    const employeeList = await fetchApi(page, "/api/admin/audit-logs", { headers: EMP_HEADERS });
    expect(employeeList.status).toBe(403);

    const list = await fetchApi(page, "/api/admin/audit-logs?search=phase7_req_valid_1234&pageSize=5", { headers: HR_HEADERS });
    expect(list.ok).toBeTruthy();
    expect(list.requestId).toBeTruthy();
    expect(Array.isArray(list.body.rows)).toBeTruthy();
    expect(list.body.rows.length).toBeGreaterThan(0);
    expect(list.body.rows[0].before_data).toBeUndefined();
    expect(list.body.rows[0].after_data).toBeUndefined();

    const detail = await fetchApi(page, `/api/admin/audit-logs/${encodeURIComponent(list.body.rows[0].id)}`, { headers: HR_HEADERS });
    expect(detail.ok).toBeTruthy();
    expect(detail.body.request_id).toBe("phase7_req_valid_1234");
    expect(JSON.stringify(detail.body)).not.toMatch(/Training@2026|Test@123456|Authorization|Bearer /);

    const exported = await page.evaluate(async ({ base, headers }) => {
      const r = await fetch(`${base}/api/admin/audit-logs/export`, {
        method: "POST",
        headers,
        body: JSON.stringify({ format: "csv", filters: { search: "phase7_req_valid_1234" } }),
      });
      return { ok: r.ok, status: r.status, contentType: r.headers.get("Content-Type") || "" };
    }, { base: BASE, headers: HR_HEADERS });
    expect(exported.ok).toBeTruthy();
    expect(exported.contentType).toContain("text/csv");
  });

  test("Browser — HR audit log route renders without console errors", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(String(e)));
    await loginHr(page);
    await page.goto(`${BASE}/admin/audit-log`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1").filter({ hasText: /Nhật ký hệ thống|System audit log|시스템 감사 로그/i })).toBeVisible({ timeout: 15000 });
    await expect(page.locator("table, .empty-state").first()).toBeVisible({ timeout: 15000 });
    expect(pageErrors).toEqual([]);
  });
});
