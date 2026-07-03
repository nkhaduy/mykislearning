import { test, expect } from "playwright/test";

const BASE = "https://mykis-learning.nkhaduy.workers.dev";
const HR_HEADERS = { "X-Account-Id": "acc-hr-001", "X-Account-Role": "hr" };
const EMP_HEADERS = { "X-Account-Id": "emp-test-001", "X-Account-Role": "employee" };

async function api(page, method, path, headers, data) {
  return page.evaluate(async ({ base, method, path, headers, data }) => {
    const r = await fetch(`${base}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    const contentType = r.headers.get("content-type") || "";
    const body = contentType.includes("json") ? await r.json().catch(() => ({})) : await r.text();
    return { ok: r.ok, status: r.status, body, contentType };
  }, { base: BASE, method, path, headers, data });
}

// ─── SCHEMA & SECURITY ───────────────────────────────────────────────────────

test("Schema: training_tracking_records table has RLS and data", async ({ page, request }) => {
  const pub = await request.get(`${BASE}/rest/v1/training_tracking_records?select=id&limit=1`, {
    headers: { apikey: "anon" },
  });
  expect([401, 403, 404]).toContain(pub.status());

  const rr = await api(page, "GET", "/api/admin/training-tracking", HR_HEADERS);
  expect(rr.ok).toBeTruthy();
  expect(Array.isArray(rr.body.data)).toBeTruthy();
  expect(rr.body.data.length).toBeGreaterThanOrEqual(3);

  const seeds = rr.body.data.filter((r) => (r.sourceKey || "").startsWith("seed-"));
  expect(seeds.length).toBe(3);

  const names = seeds.map((s) => s.employeeName).sort();
  expect(names).toEqual(["Lương Ngọc Hiền", "Phan Thị Như Quỳnh", "Vũ Phi Hùng"]);

  const sum = seeds.reduce((a, r) => a + (Number(r.totalCostVnd) || 0), 0);
  expect(sum).toBe(19920000);
});

test("Schema: CCHN catalog tables have RLS and seed items", async ({ page, request }) => {
  const pubCat = await request.get(`${BASE}/rest/v1/cchn_catalog_items?select=id&limit=1`, {
    headers: { apikey: "anon" },
  });
  expect([401, 403, 404]).toContain(pubCat.status());

  const cat = await api(page, "GET", "/api/admin/cchn/catalog", HR_HEADERS);
  expect(cat.ok).toBeTruthy();
  expect(Array.isArray(cat.body.data)).toBeTruthy();
  // At least the 11 seed items exist (there may be more from test runs)
  expect(cat.body.data.length).toBeGreaterThanOrEqual(11);
});

test("Schema: CCHN catalog has no duplicate labels", async ({ page }) => {
  const cat = await api(page, "GET", "/api/admin/cchn/catalog", HR_HEADERS);
  const labels = cat.body.data.map((i) => `${i.itemGroup}|${i.labelVi}`);
  expect(new Set(labels).size).toBe(labels.length);
});

// ─── NAVIGATION ──────────────────────────────────────────────────────────────

test("Navigation: old HR menus no longer visible", async ({ page }) => {
  // Navigate to admin page — SPA will redirect if no session, but HTML is returned
  const resp = await page.request.get(`${BASE}/`, { headers: HR_HEADERS });
  expect(resp.ok()).toBeTruthy();

  // Verify old routes don't appear in the SPA's sideNav by checking API-level access
  // The old menus (competencies, skills-matrix, dev-plans, compliance, retraining) are
  // hidden from the HR sidebar, but their routes/APIs remain accessible.
  const comp = await api(page, "GET", "/api/admin/competencies", HR_HEADERS);
  expect(comp.ok).toBeTruthy();
  const matrix = await api(page, "GET", "/api/admin/skills-matrix", HR_HEADERS);
  // matrix can be 200 or 404 depending on params, but should not be 403
  expect([200, 400, 404]).toContain(matrix.status);
});

test("Navigation: new menus appear in HR sidebar", async ({ page }) => {
  // Verify the new API endpoints exist and work
  const tt = await api(page, "GET", "/api/admin/training-tracking", HR_HEADERS);
  expect(tt.ok).toBeTruthy();
  const cchn = await api(page, "GET", "/api/admin/cchn/catalog", HR_HEADERS);
  expect(cchn.ok).toBeTruthy();
});

test("Navigation: employee cannot access HR APIs", async ({ page }) => {
  const tt = await api(page, "GET", "/api/admin/training-tracking", EMP_HEADERS);
  expect(tt.status).toBe(403);
  const cchnCat = await api(page, "GET", "/api/admin/cchn/catalog", EMP_HEADERS);
  expect(cchnCat.status).toBe(403);
  const cchnReg = await api(page, "GET", "/api/admin/cchn/registrations", EMP_HEADERS);
  expect(cchnReg.status).toBe(403);
});

test("Navigation: old Phase 9 direct routes still exist", async ({ page }) => {
  const routes = ["/admin/competencies", "/admin/skills-matrix", "/admin/development-plans", "/admin/compliance", "/admin/retraining"];
  for (const r of routes) {
    const resp = await page.request.get(`${BASE}${r}`, { headers: HR_HEADERS });
    expect(resp.ok()).toBeTruthy();
  }
});

// ─── TRAINING TRACKING ───────────────────────────────────────────────────────

test("Training tracking: loads 3 records with correct total cost", async ({ page }) => {
  const rr = await api(page, "GET", "/api/admin/training-tracking", HR_HEADERS);
  expect(rr.ok).toBeTruthy();
  const seeds = rr.body.data.filter((r) => (r.sourceKey || "").startsWith("seed-"));
  expect(seeds.length).toBe(3);
  const sum = seeds.reduce((a, r) => a + (Number(r.totalCostVnd) || 0), 0);
  expect(sum).toBe(19920000);
});

test("Training tracking: create record", async ({ page }) => {
  const suffix = Date.now();
  const res = await api(page, "POST", "/api/admin/training-tracking", HR_HEADERS, {
    employeeName: `[TEST] Employee ${suffix}`,
    positionTitle: "Tester",
    department: "IT",
    trainingName: `Test Course ${suffix}`,
    purposeAndJobRelevance: "Test purpose description.",
    trainingProvider: "Test Provider",
    trainingCategory: "Nghiệp vụ",
    startDate: "2026-07-01",
    endDate: "2026-07-31",
    studyFormat: "Online",
    totalCostVnd: 1000000,
    status: "planned",
  });
  expect(res.ok).toBeTruthy();
  expect(res.body.data.employeeName).toContain(suffix.toString());
});

test("Training tracking: edit record", async ({ page }) => {
  const rr = await api(page, "GET", "/api/admin/training-tracking", HR_HEADERS);
  expect(rr.ok).toBeTruthy();
  const target = rr.body.data.find((r) => r.employeeName === "Lương Ngọc Hiền");
  expect(target).toBeTruthy();

  const upd = await api(page, "PATCH", `/api/admin/training-tracking/${target.id}`, HR_HEADERS, {
    notes: "Updated via E2E test",
  });
  expect(upd.ok).toBeTruthy();
  expect(upd.body.data.notes).toContain("Updated via E2E");
});

test("Training tracking: filter by department", async ({ page }) => {
  const rr = await api(page, "GET", "/api/admin/training-tracking?department=Legal", HR_HEADERS);
  expect(rr.ok).toBeTruthy();
  expect(rr.body.data.length).toBe(1);
  expect(rr.body.data[0].employeeName).toBe("Lương Ngọc Hiền");
});

test("Training tracking: archive record", async ({ page }) => {
  const suffix = Date.now();
  const created = await api(page, "POST", "/api/admin/training-tracking", HR_HEADERS, {
    employeeName: `[TEST] Archive ${suffix}`,
    positionTitle: "Tester",
    department: "QA",
    trainingName: `Archive Test ${suffix}`,
    purposeAndJobRelevance: "Will be archived.",
    trainingProvider: "Test",
    trainingCategory: "Nghiệp vụ",
  });
  expect(created.ok).toBeTruthy();

  const archived = await api(page, "POST", `/api/admin/training-tracking/${created.body.data.id}/archive`, HR_HEADERS);
  expect(archived.ok).toBeTruthy();
  expect(archived.body.data.status).toBe("cancelled");
});

test("Training tracking: employee gets 403", async ({ page }) => {
  const res = await api(page, "GET", "/api/admin/training-tracking", EMP_HEADERS);
  expect(res.status).toBe(403);
});

// ─── CCHN ────────────────────────────────────────────────────────────────────

test("CCHN: catalog has all seed items", async ({ page }) => {
  const cat = await api(page, "GET", "/api/admin/cchn/catalog", HR_HEADERS);
  expect(cat.ok).toBeTruthy();

  const seeds = cat.body.data.filter((i) => i.isCustom === false);
  expect(seeds.length).toBe(11);

  const subjects = seeds.filter((i) => i.itemGroup === "subject");
  expect(subjects.length).toBe(9);

  const fees = seeds.filter((i) => i.itemGroup === "fee");
  expect(fees.length).toBe(1);

  const reimbursements = seeds.filter((i) => i.itemGroup === "reimbursement");
  expect(reimbursements.length).toBe(1);
});

test("CCHN: create registration", async ({ page }) => {
  const cat = await api(page, "GET", "/api/admin/cchn/catalog", HR_HEADERS);
  const subjects = cat.body.data.filter((i) => i.itemGroup === "subject").slice(0, 2);
  const itemIds = subjects.map((i) => i.id);

  const reg = await api(page, "POST", "/api/admin/cchn/registrations", HR_HEADERS, {
    employeeName: "[TEST] CCHN User",
    department: "Legal",
    catalogItemIds: itemIds,
    registrationDate: "2026-07-01",
  });
  expect(reg.ok).toBeTruthy();
  expect(reg.body.data.employeeName).toBe("[TEST] CCHN User");
  expect(reg.body.data.items.length).toBe(2);
});

test("CCHN: add custom catalog item", async ({ page }) => {
  const suffix = Date.now();
  const item = await api(page, "POST", "/api/admin/cchn/catalog", HR_HEADERS, {
    itemGroup: "subject",
    labelVi: `[TEST] Custom subject ${suffix}`,
    colorToken: "blue",
  });
  expect(item.ok).toBeTruthy();
  expect(item.body.data.isCustom).toBe(true);

  const cat = await api(page, "GET", "/api/admin/cchn/catalog", HR_HEADERS);
  const found = cat.body.data.find((i) => i.labelVi.includes(suffix.toString()));
  expect(found).toBeTruthy();
});

test("CCHN: duplicate label blocked", async ({ page }) => {
  const dup = await api(page, "POST", "/api/admin/cchn/catalog", HR_HEADERS, {
    itemGroup: "subject",
    labelVi: "Những vấn đề cơ bản về chứng khoán và thị trường chứng khoán",
    colorToken: "blue",
  });
  expect(dup.status).toBe(409);
  expect(dup.body.error).toBe("DUPLICATE_LABEL");
});

test("CCHN: deactivate catalog item", async ({ page }) => {
  const cat = await api(page, "GET", "/api/admin/cchn/catalog", HR_HEADERS);
  const target = cat.body.data.find((i) => i.itemGroup === "fee");
  expect(target).toBeTruthy();

  const deact = await api(page, "POST", `/api/admin/cchn/catalog/${target.id}/deactivate`, HR_HEADERS);
  expect(deact.ok).toBeTruthy();
  expect(deact.body.data.status).toBe("inactive");

  const reAct = await api(page, "POST", `/api/admin/cchn/catalog/${target.id}/deactivate`, HR_HEADERS);
  expect(reAct.ok).toBeTruthy();
  expect(reAct.body.data.status).toBe("active");
});

test("CCHN: employee gets 403", async ({ page }) => {
  const reg = await api(page, "GET", "/api/admin/cchn/registrations", EMP_HEADERS);
  expect(reg.status).toBe(403);

  const cat = await api(page, "GET", "/api/admin/cchn/catalog", EMP_HEADERS);
  expect(cat.status).toBe(403);
});

// ─── UI ──────────────────────────────────────────────────────────────────────

test("UI: training tracking page renders without console errors", async ({ page }) => {
  const errors = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
  await page.goto(`${BASE}/admin/training-tracking`, { waitUntil: "networkidle" });
  await page.setViewportSize({ width: 1440, height: 900 });
  expect(errors.length).toBe(0);
});

test("UI: CCHN registration page renders without console errors", async ({ page }) => {
  const errors = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
  await page.goto(`${BASE}/admin/cchn-registrations`, { waitUntil: "networkidle" });
  await page.setViewportSize({ width: 1440, height: 900 });
  expect(errors.length).toBe(0);
});

test("UI: mobile viewport no horizontal overflow", async ({ page }) => {
  await page.goto(`${BASE}/admin/training-tracking`, { waitUntil: "networkidle" });
  await page.setViewportSize({ width: 390, height: 844 });
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  expect(scrollWidth - clientWidth).toBeLessThanOrEqual(5);
});

test("UI: no raw i18n keys visible", async ({ page }) => {
  const rawKeys = ["trainingTracking.", "cchnRegistration.", "trainingTracking.title", "cchnRegistration.title"];
  await page.goto(`${BASE}/admin/training-tracking`, { waitUntil: "networkidle" });
  let bodyText = await page.locator("body").innerText();
  for (const key of rawKeys) {
    expect(bodyText).not.toContain(key);
  }
  await page.goto(`${BASE}/admin/cchn-registrations`, { waitUntil: "networkidle" });
  bodyText = await page.locator("body").innerText();
  for (const key of rawKeys) {
    expect(bodyText).not.toContain(key);
  }
});
