// @ts-check
/**
 * Phase 3: Compliance Training — production E2E/API tests.
 *
 * Migration 011_compliance_training.sql MUST be applied before running.
 * Run: npx playwright test e2e/phase3-compliance.spec.js
 */
import { test, expect } from "playwright/test";

const BASE = "https://mykis-learning.nkhaduy.workers.dev";
const HR_EMAIL = "hr@kisvn.vn";
const EMP_EMAIL = "employee.test@kisvn.vn";
const HR_PASSWORD = process.env.HR_PASSWORD || "Training@2026";
const EMP_PASSWORD = process.env.EMP_PASSWORD || "Test@123456";

async function loginAs(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#loginEmail", email);
  await page.fill("#loginPassword", password);
  await page.click("#loginSubmitBtn");
  await page.waitForURL(/\/(dashboard|admin)/, { timeout: 15000 });
}

async function api(page, method, path, body, role = "hr") {
  return page.evaluate(async ({ base, method, path, body, role }) => {
    const headers = { "Content-Type": "application/json" };
    if (role === "hr") {
      headers["X-Account-Id"] = "acc-hr-001";
      headers["X-Account-Role"] = "hr";
    } else {
      const session = JSON.parse(localStorage.getItem("mykis.session.v1") || "{}");
      if (session?.supabaseAccessToken) headers.Authorization = `Bearer ${session.supabaseAccessToken}`;
    }
    const r = await fetch(`${base}${path}`, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
    let data = null;
    try { data = await r.json(); } catch {}
    return { status: r.status, data };
  }, { base: BASE, method, path, body, role });
}

test("SCHEMA — Compliance overview returns non-500", async ({ page }) => {
  await loginAs(page, HR_EMAIL, HR_PASSWORD);
  const res = await api(page, "GET", "/api/admin/compliance/overview");
  expect(res.status, JSON.stringify(res.data)).toBe(200);
  expect(res.data).toHaveProperty("activePrograms");
});

test("HR API — create program, target, publish, cycle, preview, assign idempotently", async ({ page }) => {
  await loginAs(page, HR_EMAIL, HR_PASSWORD);
  const suffix = Date.now();
  const create = await api(page, "POST", "/api/admin/compliance/programs", {
    code: `TEST-AML-${suffix}`,
    title: `[TEST] AML Annual Training ${suffix}`,
    description: "Automated compliance test",
    resourceType: "course",
    resourceId: "test-course-completed",
    recurrenceType: "annual",
    defaultDurationDays: 30,
  });
  expect([200, 201], JSON.stringify(create.data)).toContain(create.status);
  const programId = create.data.id;

  const target = await api(page, "POST", `/api/admin/compliance/programs/${programId}/targets`, {
    targetType: "individual",
    targetValue: "emp-test-001",
  });
  expect([200, 201], JSON.stringify(target.data)).toContain(target.status);

  const publish = await api(page, "POST", `/api/admin/compliance/programs/${programId}/publish`, {});
  expect(publish.status, JSON.stringify(publish.data)).toBe(200);

  const cycle = await api(page, "POST", "/api/admin/compliance/cycles", {
    programId,
    cycleCode: `TEST-AML-${suffix}`,
    title: `[TEST] AML 2026 ${suffix}`,
    startAt: new Date().toISOString(),
    dueAt: new Date(Date.now() + 14 * 86400000).toISOString(),
  });
  expect([200, 201], JSON.stringify(cycle.data)).toContain(cycle.status);
  const cycleId = cycle.data.id;

  const preview = await api(page, "GET", `/api/admin/compliance/cycles/${cycleId}/preview-target`);
  expect(preview.status, JSON.stringify(preview.data)).toBe(200);
  expect(preview.data.willCreate).toBeGreaterThanOrEqual(1);

  expect((await api(page, "POST", `/api/admin/compliance/cycles/${cycleId}/activate`, {})).status).toBe(200);
  const assign1 = await api(page, "POST", `/api/admin/compliance/cycles/${cycleId}/assign`, {});
  const assign2 = await api(page, "POST", `/api/admin/compliance/cycles/${cycleId}/assign`, {});
  expect(assign1.status).toBe(200);
  expect(assign2.status).toBe(200);
  expect(assign2.data.created).toBe(0);
});

test("SECURITY — Employee cannot call HR endpoint or read arbitrary assignment", async ({ page }) => {
  await loginAs(page, EMP_EMAIL, EMP_PASSWORD);
  const hr = await api(page, "GET", "/api/admin/compliance/programs", null, "employee");
  expect(hr.status).toBe(403);
  const other = await api(page, "GET", "/api/compliance/my/not-my-assignment", null, "employee");
  expect([403, 404]).toContain(other.status);
});

test("Browser — HR and Employee Compliance routes render without console errors", async ({ browser }) => {
  const hrCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const hr = await hrCtx.newPage();
  const hrErrors = [];
  hr.on("pageerror", (e) => hrErrors.push(String(e)));
  await loginAs(hr, HR_EMAIL, HR_PASSWORD);
  await hr.goto(`${BASE}/admin/compliance`, { waitUntil: "domcontentloaded" });
  await expect(hr.locator("text=Đào tạo bắt buộc").first()).toBeVisible({ timeout: 8000 });
  expect(hrErrors).toHaveLength(0);
  await hrCtx.close();

  const empCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const emp = await empCtx.newPage();
  const empErrors = [];
  emp.on("pageerror", (e) => empErrors.push(String(e)));
  await loginAs(emp, EMP_EMAIL, EMP_PASSWORD);
  await emp.goto(`${BASE}/dashboard/compliance`, { waitUntil: "domcontentloaded" });
  await expect(emp.locator("text=Đào tạo bắt buộc").first()).toBeVisible({ timeout: 8000 });
  const overflow = await emp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);
  expect(empErrors).toHaveLength(0);
  await empCtx.close();
});
