// @ts-check
import { test, expect } from "playwright/test";

const BASE = "https://mykis-learning.nkhaduy.workers.dev";
const HR_EMAIL = "hr@kisvn.vn";
const HR_PASSWORD = "Training@2026";
const EMP_EMAIL = "employee.test@kisvn.vn";
const EMP_PASSWORD = "Test@123456";

// ─── Helpers ────────────────────────────────────────────────────────────────

async function loginAsHr(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#loginEmail", HR_EMAIL);
  await page.fill("#loginPassword", HR_PASSWORD);
  await page.click("#loginSubmitBtn");
  await page.waitForURL("**/admin**", { timeout: 15000 });
}

async function loginAsEmployee(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#loginEmail", EMP_EMAIL);
  await page.fill("#loginPassword", EMP_PASSWORD);
  await page.click("#loginSubmitBtn");
  await page.waitForURL("**/dashboard**", { timeout: 15000 });
}

/** Read session from localStorage (session stored as mykis.session.v1) */
async function getSessionHeaders(page) {
  return page.evaluate(() => {
    try {
      const raw = localStorage.getItem("mykis.session.v1");
      const s = raw ? JSON.parse(raw) : null;
      return {
        "X-Account-Id": s?.accountId || "",
        "X-Account-Role": s?.role || "hr",
      };
    } catch { return { "X-Account-Id": "", "X-Account-Role": "hr" }; }
  });
}

/** Create a test course via API and return its id */
async function createFixtureCourse(page, suffix) {
  const id = `test-fixture-${suffix}-${Date.now()}`;
  const authHeaders = await getSessionHeaders(page);
  const res = await page.evaluate(async ({ id, BASE, authHeaders }) => {
    const r = await fetch(`${BASE}/api/courses`, {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        title: `[TEST] Fixture Course ${id}`,
        status: "draft",
        category: "Test",
        durationHours: 1,
        description: "Fixture course for automated test — safe to delete",
      }),
    });
    return r.status;
  }, { id, BASE, authHeaders });
  expect(res, "fixture course POST should return 200").toBe(200);
  return id;
}

/** Hard-delete a course by ID via API (cleanup helper) */
async function cleanupFixtureCourse(page, courseId) {
  const authHeaders = await getSessionHeaders(page);
  await page.evaluate(async ({ courseId, BASE, authHeaders }) => {
    await fetch(`${BASE}/api/courses?id=${encodeURIComponent(courseId)}&force=true`, {
      method: "DELETE",
      headers: { ...authHeaders, "Content-Type": "application/json" },
    });
  }, { courseId, BASE, authHeaders });
}

// ─── Skeleton / loading tests ─────────────────────────────────────────────

test.describe("Skeleton / Loading UI", () => {
  test("T01 - Course list initial load shows skeleton then data", async ({ page }) => {
    await loginAsHr(page);
    // Navigate to courses page fresh
    await page.goto(`${BASE}/admin/courses`, { waitUntil: "domcontentloaded" });
    // Should eventually have the course table or empty state — never stuck on skeleton
    await expect(page.locator(".app-main")).toBeVisible({ timeout: 15000 });
    const stuck = await page.locator(".hr-overview-skeleton").count();
    // Skeleton may briefly appear but must resolve
    await page.waitForFunction(() => !document.querySelector(".hr-overview-skeleton"), { timeout: 10000 }).catch(() => {});
    const finalStuck = await page.locator(".hr-overview-skeleton").count();
    expect(finalStuck, "skeleton should not be present after data loads").toBe(0);
  });

  test("T02 - Course list loaded: filter does not blank out list", async ({ page }) => {
    await loginAsHr(page);
    await page.goto(`${BASE}/admin/courses`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".app-main", { timeout: 10000 });
    // Wait for initial data to appear
    await page.waitForFunction(() => !document.querySelector(".hr-overview-skeleton"), { timeout: 10000 });
    // Apply filter
    await page.selectOption("[data-course-filter-status]", "published");
    // Table or empty state should still be visible — not a blank
    const mainVisible = await page.locator(".app-main").isVisible();
    expect(mainVisible, "app-main should remain visible after filter").toBe(true);
    // No white screen
    const skeleton = await page.locator(".hr-overview-skeleton").count();
    expect(skeleton, "filter should not trigger loading skeleton").toBe(0);
  });

  test("T03 - Empty API response shows empty state, not skeleton", async ({ page }) => {
    await loginAsHr(page);
    await page.goto(`${BASE}/admin/courses`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".app-main", { timeout: 10000 });
    await page.waitForFunction(() => !document.querySelector(".hr-overview-skeleton"), { timeout: 10000 });
    // Apply filter that unlikely matches any real course
    await page.fill("[data-course-search]", "zzznonexistentcourse999");
    await page.waitForTimeout(300);
    // Should show empty state, not skeleton
    const skeleton = await page.locator(".hr-overview-skeleton").count();
    expect(skeleton, "search with no results should not show skeleton").toBe(0);
  });

  test("T04 - No console fatal errors on course list", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await loginAsHr(page);
    await page.goto(`${BASE}/admin/courses`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".app-main", { timeout: 10000 });
    await page.waitForFunction(() => !document.querySelector(".hr-overview-skeleton"), { timeout: 10000 });
    const fatal = errors.filter(e => !e.includes("ResizeObserver"));
    expect(fatal, `fatal page errors: ${fatal.join(", ")}`).toHaveLength(0);
  });

  test("T05 - Course detail page loads without blank flash", async ({ page }) => {
    await loginAsHr(page);
    await page.goto(`${BASE}/admin/courses`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => !document.querySelector(".hr-overview-skeleton"), { timeout: 10000 });
    // Click first course row — may open drawer/modal or navigate to /admin/courses/:id
    const firstRow = page.locator("table tbody tr").first();
    const hasRows = await firstRow.count();
    if (!hasRows) {
      test.skip(); // No courses to click
      return;
    }
    await firstRow.click();
    // Wait for either a modal or the course detail page to appear
    await page.waitForFunction(
      () => document.querySelector(".modal-backdrop, .course-drawer-content, [data-course-detail], .course-detail") || window.location.pathname.includes("/admin/courses/"),
      { timeout: 10000 }
    );
    const mainVisible = await page.locator(".app-main").isVisible();
    expect(mainVisible, "app-main should remain visible after clicking course").toBe(true);
  });

  test("T06 - Offline sessions page does not infinite-load", async ({ page }) => {
    await loginAsHr(page);
    await page.goto(`${BASE}/admin/sessions`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".app-main", { timeout: 10000 });
    // Wait up to 12s for loading to resolve
    await page.waitForFunction(
      () => !document.querySelector(".spinner, [aria-busy='true']"),
      { timeout: 12000 }
    ).catch(() => {});
    const spinner = await page.locator(".spinner").count();
    expect(spinner, "spinner should not be visible after sessions load").toBe(0);
  });

  test("T07 - HR overview tasks do not flicker on update", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await loginAsHr(page);
    await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".app-main", { timeout: 10000 });
    await page.waitForFunction(() => !document.querySelector(".hr-overview-skeleton"), { timeout: 12000 });
    const mainVisible = await page.locator(".app-main").isVisible();
    expect(mainVisible).toBe(true);
    expect(errors.filter(e => !e.includes("ResizeObserver"))).toHaveLength(0);
  });
});

// ─── Hard delete tests ────────────────────────────────────────────────────

test.describe("Course Hard Delete", () => {
  let fixtureId = "";

  test.beforeEach(async ({ page }) => {
    await loginAsHr(page);
  });

  test("T13 - Create fixture course for delete tests", async ({ page }) => {
    fixtureId = await createFixtureCourse(page, "delete");
    expect(fixtureId).toMatch(/^test-fixture-delete-/);
  });

  test("T14 - Impact endpoint returns counts for fixture course", async ({ page }) => {
    if (!fixtureId) test.skip();
    const authHeaders = await getSessionHeaders(page);
    const body = await page.evaluate(async ({ fixtureId, BASE, authHeaders }) => {
      const r = await fetch(`${BASE}/api/courses/impact?id=${encodeURIComponent(fixtureId)}`, { headers: authHeaders });
      return r.json();
    }, { fixtureId, BASE, authHeaders });
    expect(body.ok).toBe(true);
    expect(typeof body.impact.enrollments).toBe("number");
    expect(typeof body.impact.content).toBe("number");
  });

  test("T19 - Non-force DELETE still hard-deletes (server always hard-deletes)", async ({ page }) => {
    if (!fixtureId) test.skip();
    const authHeaders = await getSessionHeaders(page);
    // Send DELETE without force=true — server now always hard-deletes
    const status = await page.evaluate(async ({ fixtureId, BASE, authHeaders }) => {
      const r = await fetch(`${BASE}/api/courses?id=${encodeURIComponent(fixtureId)}`, {
        method: "DELETE",
        headers: { ...authHeaders, "Content-Type": "application/json" },
      });
      return r.status;
    }, { fixtureId, BASE, authHeaders });
    expect(status).toBe(200);
    // Verify it's gone
    const verifyStatus = await page.evaluate(async ({ fixtureId, BASE, authHeaders }) => {
      const r = await fetch(`${BASE}/api/courses/impact?id=${encodeURIComponent(fixtureId)}`, { headers: authHeaders });
      return r.status;
    }, { fixtureId, BASE, authHeaders });
    expect(verifyStatus).toBe(404);
    fixtureId = ""; // Already deleted
  });

  test("T20 - Force delete API removes course row completely", async ({ page }) => {
    const id = await createFixtureCourse(page, "force");
    const authHeaders = await getSessionHeaders(page);
    const res = await page.evaluate(async ({ id, BASE, authHeaders }) => {
      const r = await fetch(`${BASE}/api/courses?id=${encodeURIComponent(id)}&force=true`, {
        method: "DELETE",
        headers: { ...authHeaders, "Content-Type": "application/json" },
      });
      return r.json();
    }, { id, BASE, authHeaders });
    expect(res.ok).toBe(true);
    expect(res.method).toBe("hard");
    expect(res.status).toBe("deleted");
  });

  test("T23 - After hard delete, course row is gone from Supabase", async ({ page }) => {
    const id = await createFixtureCourse(page, "verify");
    const authHeaders = await getSessionHeaders(page);
    await page.evaluate(async ({ id, BASE, authHeaders }) => {
      await fetch(`${BASE}/api/courses?id=${encodeURIComponent(id)}&force=true`, {
        method: "DELETE",
        headers: { ...authHeaders, "Content-Type": "application/json" },
      });
    }, { id, BASE, authHeaders });
    const verify = await page.evaluate(async ({ id, BASE, authHeaders }) => {
      const r = await fetch(`${BASE}/api/courses/impact?id=${encodeURIComponent(id)}`, { headers: authHeaders });
      return r.status;
    }, { id, BASE, authHeaders });
    expect(verify).toBe(404);
  });

  test("T25 - GET courses list does not return deleted course", async ({ page }) => {
    const id = await createFixtureCourse(page, "list");
    const authHeaders = await getSessionHeaders(page);
    await page.evaluate(async ({ id, BASE, authHeaders }) => {
      await fetch(`${BASE}/api/courses?id=${encodeURIComponent(id)}&force=true`, {
        method: "DELETE",
        headers: { ...authHeaders, "Content-Type": "application/json" },
      });
    }, { id, BASE, authHeaders });
    const list = await page.evaluate(async ({ BASE, authHeaders }) => {
      const r = await fetch(`${BASE}/api/courses`, { headers: authHeaders });
      return r.json();
    }, { BASE, authHeaders });
    expect(Array.isArray(list)).toBe(true);
    const found = list.find((c) => c.id === id);
    expect(found, "deleted course should not appear in list").toBeUndefined();
  });

  test("T27 - After F5, deleted course not visible in browser", async ({ page }) => {
    const id = await createFixtureCourse(page, "f5");
    const authHeaders = await getSessionHeaders(page);
    await page.evaluate(async ({ id, BASE, authHeaders }) => {
      await fetch(`${BASE}/api/courses?id=${encodeURIComponent(id)}&force=true`, {
        method: "DELETE",
        headers: { ...authHeaders, "Content-Type": "application/json" },
      });
    }, { id, BASE, authHeaders });
    await page.goto(`${BASE}/admin/courses`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => !document.querySelector(".hr-overview-skeleton"), { timeout: 10000 });
    const body = await page.textContent("body");
    expect(body).not.toContain(`[TEST] Fixture Course test-fixture-f5-`);
  });

  test("T28 - Employee cannot see deleted course", async ({ browser }) => {
    const hrCtx = await browser.newContext();
    const hrPage = await hrCtx.newPage();
    await loginAsHr(hrPage);
    const id = await createFixtureCourse(hrPage, "emp-vis");
    const hrHeaders = await getSessionHeaders(hrPage);
    await hrPage.evaluate(async ({ id, BASE, hrHeaders }) => {
      await fetch(`${BASE}/api/courses?id=${encodeURIComponent(id)}&force=true`, {
        method: "DELETE",
        headers: { ...hrHeaders, "Content-Type": "application/json" },
      });
    }, { id, BASE, hrHeaders });
    await hrCtx.close();

    const empCtx = await browser.newContext();
    const empPage = await empCtx.newPage();
    await loginAsEmployee(empPage);
    const empHeaders = await getSessionHeaders(empPage);
    const empCourses = await empPage.evaluate(async ({ BASE, empHeaders }) => {
      const r = await fetch(`${BASE}/api/courses`, { headers: empHeaders });
      return r.json();
    }, { BASE, empHeaders });
    const found = (Array.isArray(empCourses) ? empCourses : []).find((c) => c.id === id);
    expect(found, "employee should not see deleted course").toBeUndefined();
    await empCtx.close();
  });

  test("T30 - Employee DELETE request returns 403", async ({ page }) => {
    const id = await createFixtureCourse(page, "403");
    // Re-login as employee
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.fill("#loginEmail", EMP_EMAIL);
    await page.fill("#loginPassword", EMP_PASSWORD);
    await page.click("#loginSubmitBtn");
    await page.waitForURL("**/dashboard**", { timeout: 15000 });
    const empHeaders = await getSessionHeaders(page);
    const status = await page.evaluate(async ({ id, BASE, empHeaders }) => {
      const r = await fetch(`${BASE}/api/courses?id=${encodeURIComponent(id)}&force=true`, {
        method: "DELETE",
        headers: { ...empHeaders, "Content-Type": "application/json" },
      });
      return r.status;
    }, { id, BASE, empHeaders });
    expect(status).toBe(403);

    // Cleanup as HR
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.fill("#loginEmail", HR_EMAIL);
    await page.fill("#loginPassword", HR_PASSWORD);
    await page.click("#loginSubmitBtn");
    await page.waitForURL("**/admin**", { timeout: 15000 });
    await cleanupFixtureCourse(page, id);
  });
});
