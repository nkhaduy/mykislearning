import { test, expect } from "playwright/test";

const BASE = "https://mykis-learning.nkhaduy.workers.dev";
const HR_HEADERS = { "X-Account-Id": "acc-hr-001", "X-Account-Role": "hr" };
const EMP_HEADERS = { "X-Account-Id": "emp-test-001", "X-Account-Role": "employee" };
const EMP_ID = "emp-test-001";

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

async function seedCompetency(page, suffix) {
  const cat = await api(page, "POST", "/api/admin/competencies/categories", HR_HEADERS, {
    code: `test-phase9-cat-${suffix}`,
    name: `[TEST] Năng lực Phase 9 ${suffix}`,
  });
  expect(cat.ok).toBeTruthy();
  const comp = await api(page, "POST", "/api/admin/competencies", HR_HEADERS, {
    categoryId: cat.body.data.id,
    code: `test-phase9-comp-${suffix}`,
    name: `[TEST] Năng lực Phân tích kỹ thuật ${suffix}`,
    description: "[TEST] competency fixture",
  });
  expect(comp.ok).toBeTruthy();
  const levels = [];
  for (const [code, name, rank] of [["0", "Chưa có", 0], ["1", "Nhận biết", 1], ["2", "Cơ bản", 2], ["3", "Thành thạo", 3]]) {
    const level = await api(page, "POST", `/api/admin/competencies/${comp.body.data.id}/levels`, HR_HEADERS, { code, name, rank });
    expect(level.ok).toBeTruthy();
    levels.push(level.body.data);
  }
  const active = await api(page, "POST", `/api/admin/competencies/${comp.body.data.id}/activate`, HR_HEADERS, {});
  expect(active.ok).toBeTruthy();
  return { category: cat.body.data, competency: active.body.data, levels };
}

test("Schema/security API guards and catalog workflow", async ({ page, request }) => {
  const suffix = Date.now();
  const fixture = await seedCompetency(page, suffix);

  const publicRest = await request.get(`${BASE}/rest/v1/competencies?select=id`, { headers: { apikey: "anon" } });
  expect([401, 403]).toContain(publicRest.status());

  const employeeBlocked = await api(page, "GET", "/api/admin/competencies", EMP_HEADERS);
  expect(employeeBlocked.status).toBe(403);

  const duplicateLevel = await api(page, "POST", `/api/admin/competencies/${fixture.competency.id}/levels`, HR_HEADERS, { code: "3", name: "Duplicate", rank: 3 });
  expect(duplicateLevel.status).toBe(409);

  const archived = await api(page, "POST", `/api/admin/competencies/${fixture.competency.id}/archive`, HR_HEADERS, {});
  expect(archived.ok).toBeTruthy();
});

test("Requirements resolve priority, matrix calculates gaps, and duplicate requirement is blocked", async ({ page }) => {
  const suffix = Date.now();
  const { competency, levels } = await seedCompetency(page, suffix);

  const all = await api(page, "POST", "/api/admin/competencies/requirements", HR_HEADERS, {
    competencyId: competency.id,
    targetType: "all_employees",
    requiredLevelId: levels[1].id,
    priority: 10,
  });
  expect(all.ok).toBeTruthy();

  const individual = await api(page, "POST", "/api/admin/competencies/requirements", HR_HEADERS, {
    competencyId: competency.id,
    targetType: "individual",
    targetValue: EMP_ID,
    requiredLevelId: levels[3].id,
    priority: 100,
  });
  expect(individual.ok).toBeTruthy();

  const duplicate = await api(page, "POST", "/api/admin/competencies/requirements", HR_HEADERS, {
    competencyId: competency.id,
    targetType: "individual",
    targetValue: EMP_ID,
    requiredLevelId: levels[3].id,
    priority: 90,
  });
  expect(duplicate.status).toBe(409);
  expect(duplicate.body.error).toBe("DUPLICATE_REQUIREMENT");

  const matrix = await api(page, "GET", `/api/admin/skills-matrix?employee=${EMP_ID}&competency=${competency.id}`, HR_HEADERS);
  expect(matrix.ok).toBeTruthy();
  const cell = matrix.body.rows[0].cells.find((c) => c.competencyId === competency.id);
  expect(cell.requiredLevel.rank).toBe(3);
  expect(cell.status).toBe("not_assessed");
});

test("Evidence, assessment, verification, export, and employee IDOR controls", async ({ page }) => {
  const suffix = Date.now();
  const { competency, levels } = await seedCompetency(page, suffix);
  await api(page, "POST", "/api/admin/competencies/requirements", HR_HEADERS, { competencyId: competency.id, targetType: "individual", targetValue: EMP_ID, requiredLevelId: levels[2].id });

  const self = await api(page, "POST", `/api/competencies/my/${competency.id}/self-assessment`, EMP_HEADERS, {
    assessedLevelId: levels[2].id,
    reason: "[TEST] evidence note",
  });
  expect(self.status).toBe(201);
  expect(self.body.data.status).toBe("pending");

  const my = await api(page, "GET", "/api/competencies/my", EMP_HEADERS);
  const pendingCell = my.body.rows[0].cells.find((c) => c.competencyId === competency.id);
  expect(pendingCell.effectiveLevel).toBeFalsy();

  const rejectNoReason = await api(page, "POST", `/api/admin/competency-assessments/${self.body.data.id}/reject`, HR_HEADERS, {});
  expect(rejectNoReason.status).toBe(400);
  expect(rejectNoReason.body.error).toBe("ASSESSMENT_REASON_REQUIRED");

  const verify = await api(page, "POST", `/api/admin/competency-assessments/${self.body.data.id}/verify`, HR_HEADERS, { reason: "[TEST] HR verified" });
  expect(verify.ok).toBeTruthy();

  const employeeCannotVerify = await api(page, "POST", `/api/admin/competency-assessments/${self.body.data.id}/verify`, EMP_HEADERS, { reason: "no" });
  expect(employeeCannotVerify.status).toBe(403);

  const matrix = await api(page, "GET", `/api/admin/skills-matrix?employee=${EMP_ID}&competency=${competency.id}`, HR_HEADERS);
  const cell = matrix.body.rows[0].cells.find((c) => c.competencyId === competency.id);
  expect(cell.status).toBe("met");

  const exportCsv = await api(page, "GET", `/api/admin/skills-matrix/export?format=csv&employee=${EMP_ID}`, HR_HEADERS);
  expect(exportCsv.ok).toBeTruthy();
  expect(exportCsv.contentType).toContain("text/csv");

  const employeeMatrixIdor = await api(page, "GET", `/api/admin/skills-matrix/employees/acc-hr-001`, EMP_HEADERS);
  expect(employeeMatrixIdor.status).toBe(403);
});

test("Development plan workflow, resource anti-cheat sync, and ownership", async ({ page }) => {
  const suffix = Date.now();
  const { competency, levels } = await seedCompetency(page, suffix);

  const plan = await api(page, "POST", "/api/admin/development-plans", HR_HEADERS, {
    employeeId: EMP_ID,
    title: `[TEST] Kế hoạch phát triển 2026 ${suffix}`,
    description: "[TEST] plan",
  });
  expect(plan.status).toBe(201);

  const item = await api(page, "POST", `/api/admin/development-plans/${plan.body.data.id}/items`, HR_HEADERS, {
    competencyId: competency.id,
    targetLevelId: levels[2].id,
    resourceType: "course",
    resourceId: `test-course-not-completed-${suffix}`,
    resourceVersionId: `v-${suffix}`,
    dueAt: "2026-01-01T00:00:00.000Z",
  });
  expect(item.status).toBe(201);
  expect(item.body.data.resource_version_id).toBe(`v-${suffix}`);

  const activated = await api(page, "POST", `/api/admin/development-plans/${plan.body.data.id}/activate`, HR_HEADERS, {});
  expect(activated.ok).toBeTruthy();

  const mine = await api(page, "GET", "/api/development-plans/my", EMP_HEADERS);
  expect(mine.ok).toBeTruthy();
  expect(mine.body.data.some((p) => p.id === plan.body.data.id)).toBeTruthy();

  const started = await api(page, "POST", `/api/development-plans/my/${plan.body.data.id}/items/${item.body.data.id}/start`, EMP_HEADERS, {});
  expect(started.ok).toBeTruthy();
  const blockedSync = await api(page, "POST", `/api/development-plans/my/${plan.body.data.id}/items/${item.body.data.id}/sync`, EMP_HEADERS, {});
  expect(blockedSync.status).toBe(409);
  expect(blockedSync.body.error).toBe("RESOURCE_NOT_COMPLETED");

  const idor = await api(page, "GET", `/api/development-plans/my/${plan.body.data.id}`, { "X-Account-Id": "emp-other", "X-Account-Role": "employee" });
  expect(idor.status).toBe(404);
});

test("Browser HR and Employee Phase 9 pages render on desktop and mobile", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("mykis.session.v1", JSON.stringify({ accountId: "acc-hr-001", role: "hr", fullName: "HR Test", loginAt: new Date().toISOString() })));
  await page.goto(`${BASE}/admin/competencies`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("h1")).toContainText(/Năng lực|Competency/);
  await page.goto(`${BASE}/admin/skills-matrix`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).not.toContainText("Không thể tải trang");
  await page.goto(`${BASE}/admin/development-plans`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).not.toContainText("Không thể tải trang");

  await page.addInitScript(() => localStorage.setItem("mykis.session.v1", JSON.stringify({ accountId: "emp-test-001", role: "employee", fullName: "Employee Test", loginAt: new Date().toISOString() })));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/dashboard/skills`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).not.toContainText("Không thể tải trang");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
  expect(overflow).toBeFalsy();
});
