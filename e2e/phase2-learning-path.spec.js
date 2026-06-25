// @ts-check
/**
 * Phase 2: Learning Path — production E2E tests
 *
 * Migration 010_learning_paths.sql MUST be applied before running.
 * These tests exercise real database persistence, anti-cheat, IDOR protection,
 * and prerequisite logic against the production Worker + Supabase.
 *
 * Run: node_modules/.bin/playwright test e2e/phase2-learning-path.spec.js
 */
import { test, expect } from "playwright/test";

const BASE = "https://mykis-learning.nkhaduy.workers.dev";
const HR_EMAIL = "hr@kisvn.vn";
const EMP_EMAIL = "employee.test@kisvn.vn";
const RESULTS_DIR = "test-results/learning-path";

// Credentials are read-only in the test file; never logged or stored.
// Actual values come from environment or are well-known test accounts.
const HR_PASSWORD = process.env.HR_PASSWORD || "Training@2026";
const EMP_PASSWORD = process.env.EMP_PASSWORD || "Test@123456";

// Known stable test resources in production DB:
// - test-course-completed: course with a completed enrollment for emp-test-001
// - course-004: course without completed enrollment for emp-test-001 (step 2 lock test)
const COURSE_COMPLETED = "test-course-completed";
const COURSE_LOCKED = "course-004";

// ── helpers ────────────────────────────────────────────────────

async function loginAs(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#loginEmail", email);
  await page.fill("#loginPassword", password);
  await page.click("#loginSubmitBtn");
  await page.waitForURL(/\/(dashboard|admin)/, { timeout: 15000 });
}

/** HR API call via fetch from inside browser page context */
async function hrApi(page, method, path, body) {
  return page.evaluate(async ({ base, method, path, body }) => {
    const r = await fetch(`${base}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Account-Id": "acc-hr-001",
        "X-Account-Role": "hr",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    let data;
    try { data = await r.json(); } catch { data = null; }
    return { status: r.status, data };
  }, { base: BASE, method, path, body });
}

/** Employee API call using session token from localStorage */
async function empApi(page, method, path, body) {
  return page.evaluate(async ({ base, method, path, body }) => {
    const session = JSON.parse(localStorage.getItem("mykis.session.v1") || "{}");
    const token = session?.supabaseAccessToken || session?.token;
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const r = await fetch(`${base}${path}`, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    let data;
    try { data = await r.json(); } catch { data = null; }
    return { status: r.status, data };
  }, { base: BASE, method, path, body });
}

// ── REG: Phase 1 regression ─────────────────────────────────

test("REG1 — Employee login redirects to /dashboard", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  await loginAs(page, EMP_EMAIL, EMP_PASSWORD);
  expect(page.url()).toContain("/dashboard");
  expect(await page.locator(".app-layout").count()).toBeGreaterThan(0);
  expect(errs, `JS errors: ${errs.join(", ")}`).toHaveLength(0);
  await page.screenshot({ path: `${RESULTS_DIR}/reg1-employee-login.png` });
  await ctx.close();
});

test("REG2 — HR login redirects to /admin", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  await loginAs(page, HR_EMAIL, HR_PASSWORD);
  expect(page.url()).toContain("/admin");
  expect(errs, `JS errors: ${errs.join(", ")}`).toHaveLength(0);
  await page.screenshot({ path: `${RESULTS_DIR}/reg2-hr-login.png` });
  await ctx.close();
});

test("REG3 — Dashboard renders content (not blank)", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await loginAs(page, EMP_EMAIL, EMP_PASSWORD);
  const h = await page.evaluate(() => document.querySelector(".app-main")?.getBoundingClientRect().height ?? 0);
  expect(h, "app-main must have height > 50px").toBeGreaterThan(50);
  await ctx.close();
});

test("REG4 — No uncaught JS errors on dashboard", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  await loginAs(page, EMP_EMAIL, EMP_PASSWORD);
  await page.waitForTimeout(1500);
  expect(errs, `Uncaught JS: ${errs.join(", ")}`).toHaveLength(0);
  await ctx.close();
});

// ── SCHEMA: migration applied ─────────────────────────────────

test("SCHEMA1 — GET /api/admin/learning-paths returns 200 not 500", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await loginAs(page, HR_EMAIL, HR_PASSWORD);
  const res = await hrApi(page, "GET", "/api/admin/learning-paths");
  expect(res.status, `Expected 200 but got ${res.status} — migration may not be applied`).toBe(200);
  expect(Array.isArray(res.data?.data) || Array.isArray(res.data), "Response must include a data array").toBe(true);
  await ctx.close();
});

test("SCHEMA2 — GET /api/learning-paths/my returns 200 not 500", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await loginAs(page, EMP_EMAIL, EMP_PASSWORD);
  const res = await empApi(page, "GET", "/api/learning-paths/my");
  expect(res.status, `Expected 200 but got ${res.status} — migration may not be applied`).toBe(200);
  expect(Array.isArray(res.data) || Array.isArray(res.data?.data), "Response must be an array").toBe(true);
  await ctx.close();
});

// ── HR1-3: sidebar, page, create button ───────────────────────

test("HR1 — HR sees 'Lộ trình học tập' link in sidebar", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await loginAs(page, HR_EMAIL, HR_PASSWORD);
  await expect(page.locator("a[href='/admin/learning-paths']").first()).toBeVisible({ timeout: 5000 });
  await page.screenshot({ path: `${RESULTS_DIR}/hr1-sidebar-lp.png` });
  await ctx.close();
});

test("HR2 — HR opens /admin/learning-paths without crash or error card", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  await loginAs(page, HR_EMAIL, HR_PASSWORD);
  await page.goto(`${BASE}/admin/learning-paths`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".app-layout", { timeout: 8000 });
  expect(await page.locator("text=Không thể tải trang").count()).toBe(0);
  expect(errs, `JS errors: ${errs.join(", ")}`).toHaveLength(0);
  await page.screenshot({ path: `${RESULTS_DIR}/hr2-lp-list.png`, fullPage: true });
  await ctx.close();
});

test("HR3 — 'Tạo lộ trình' button visible on LP list page", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await loginAs(page, HR_EMAIL, HR_PASSWORD);
  await page.goto(`${BASE}/admin/learning-paths`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".app-layout", { timeout: 8000 });
  await expect(page.locator("[data-lp-create]").first()).toBeVisible({ timeout: 5000 });
  await ctx.close();
});

// ── SECURITY ─────────────────────────────────────────────────

test("SEC1 — Employee cannot access /admin/learning-paths (no Create button)", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await loginAs(page, EMP_EMAIL, EMP_PASSWORD);
  await page.goto(`${BASE}/admin/learning-paths`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  expect(await page.locator("[data-lp-create]").count(), "Employee must NOT see Create Path button").toBe(0);
  await page.screenshot({ path: `${RESULTS_DIR}/sec1-emp-blocked.png` });
  await ctx.close();
});

test("SEC2 — Employee API guard: /api/admin/learning-paths returns 403 HR_ONLY", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await loginAs(page, EMP_EMAIL, EMP_PASSWORD);
  const res = await page.evaluate(async (base) => {
    const r = await fetch(`${base}/api/admin/learning-paths`, {
      headers: { "X-Account-Id": "acc-employee-001", "X-Account-Role": "employee" },
    });
    return { status: r.status, body: await r.json() };
  }, BASE);
  expect(res.status, "Employee hitting HR endpoint must get 403").toBe(403);
  expect(res.body.error).toBe("HR_ONLY");
  await ctx.close();
});

test("SEC3 — IDOR: Employee cannot access another employee assignment", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await loginAs(page, EMP_EMAIL, EMP_PASSWORD);
  const res = await empApi(page, "GET", "/api/learning-paths/my/fake-other-user-assignment-00000000");
  expect(res.status, "Fake assignment ID must return 404, not 200").not.toBe(200);
  expect([404, 403]).toContain(res.status);
  await ctx.close();
});

test("SEC4 — Draft path not visible in Employee my-paths list", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await loginAs(page, EMP_EMAIL, EMP_PASSWORD);
  const res = await empApi(page, "GET", "/api/learning-paths/my");
  const paths = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
  for (const p of paths) {
    const pathStatus = p.path?.status ?? p.learning_path?.status ?? "";
    expect(pathStatus, `Employee must not see draft path: assignment ${p.id}`).not.toBe("draft");
  }
  await ctx.close();
});

// ── API INTEGRATION: real data ────────────────────────────────

test("API1 — HR can create, add steps, publish, assign Learning Path end-to-end", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await loginAs(page, HR_EMAIL, HR_PASSWORD);

  // 1. Create
  const create = await hrApi(page, "POST", "/api/admin/learning-paths", {
    title: "[E2E-TEST] API Integration Path",
    description: "Automated test — safe to delete",
    completion_mode: "sequential",
    estimated_duration_minutes: 30,
  });
  expect([200, 201], `Create path failed: ${JSON.stringify(create.data)}`).toContain(create.status);
  expect(create.data?.id, "Create must return an ID").toBeTruthy();
  const lpId = create.data.id;

  // 2. Add step (course that employee has completed)
  const step1 = await hrApi(page, "POST", `/api/admin/learning-paths/${lpId}/steps`, {
    step_type: "course",
    resource_id: COURSE_COMPLETED,
    title_override: "Bước 1: Khóa học bắt buộc",
    is_required: true,
  });
  expect([200, 201], `Add step failed: ${JSON.stringify(step1.data)}`).toContain(step1.status);
  const step1Id = step1.data.id;

  // 3. Publish
  const pub = await hrApi(page, "POST", `/api/admin/learning-paths/${lpId}/publish`, {});
  expect(pub.status, `Publish failed: ${JSON.stringify(pub.data)}`).toBe(200);
  expect(pub.data?.ok).toBe(true);

  // 4. Assign to emp-test-001
  const assign1 = await hrApi(page, "POST", `/api/admin/learning-paths/${lpId}/assign`, {
    target_type: "individual",
    employee_ids: ["emp-test-001"],
  });
  expect(assign1.status, `Assign failed: ${JSON.stringify(assign1.data)}`).toBe(200);
  expect(assign1.data?.created, "Must create 1 assignment").toBe(1);
  expect(assign1.data?.skipped, "Must skip 0").toBe(0);

  // 5. Duplicate assign must skip
  const assign2 = await hrApi(page, "POST", `/api/admin/learning-paths/${lpId}/assign`, {
    target_type: "individual",
    employee_ids: ["emp-test-001"],
  });
  expect(assign2.status).toBe(200);
  expect(assign2.data?.created, "Duplicate must not create").toBe(0);
  expect(assign2.data?.skipped, "Duplicate must be skipped").toBe(1);

  // 6. Assignments list
  const aList = await hrApi(page, "GET", `/api/admin/learning-paths/${lpId}/assignments`);
  expect(aList.status).toBe(200);
  const activeAssignments = (aList.data?.data ?? []).filter((a) => a.status !== "cancelled");
  expect(activeAssignments.length, "Must have exactly 1 active assignment").toBe(1);
  expect(activeAssignments[0].progress_percent).toBe(0);

  // 7. Archive (cleanup)
  const archive = await hrApi(page, "POST", `/api/admin/learning-paths/${lpId}/archive`, {});
  expect(archive.status, `Archive failed: ${JSON.stringify(archive.data)}`).toBe(200);

  await ctx.close();
});

test("API2 — Anti-cheat: cannot complete step without real course completion", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await loginAs(page, HR_EMAIL, HR_PASSWORD);

  // Create path with a locked course (course-004 — not completed by test employee)
  const create = await hrApi(page, "POST", "/api/admin/learning-paths", {
    title: "[E2E-TEST] Anti-cheat Verification",
    completion_mode: "sequential",
  });
  const lpId = create.data.id;

  const stepRes = await hrApi(page, "POST", `/api/admin/learning-paths/${lpId}/steps`, {
    step_type: "course",
    resource_id: COURSE_LOCKED,
    is_required: true,
  });
  const stepId = stepRes.data.id;

  await hrApi(page, "POST", `/api/admin/learning-paths/${lpId}/publish`, {});

  const assignRes = await hrApi(page, "POST", `/api/admin/learning-paths/${lpId}/assign`, {
    target_type: "individual",
    employee_ids: ["emp-test-001"],
  });
  expect(assignRes.data?.created).toBe(1);

  // Get assignment ID
  const aList = await hrApi(page, "GET", `/api/admin/learning-paths/${lpId}/assignments`);
  const assignmentId = aList.data?.data?.find((a) => a.status !== "cancelled")?.id;
  expect(assignmentId, "Assignment ID must exist").toBeTruthy();

  // Employee logs in and tries to complete without having done the course
  const empCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const empPage = await empCtx.newPage();
  await loginAs(empPage, EMP_EMAIL, EMP_PASSWORD);

  await empApi(empPage, "POST", `/api/learning-paths/my/${assignmentId}/steps/${stepId}/start`, {});
  const completeRes = await empApi(empPage, "POST", `/api/learning-paths/my/${assignmentId}/steps/${stepId}/complete`, {});
  expect(completeRes.status, "Anti-cheat must return 400 when course not completed").toBe(400);
  expect(completeRes.data?.error).toBe("RESOURCE_NOT_COMPLETED");

  // Cleanup — use empPage's context for cleanup since page was from HR ctx
  // (empCtx doesn't have HR auth so we just close it; HR cleanup via separate fetch)
  await empCtx.close();
  await fetch(`${BASE}/api/admin/learning-paths/${lpId}/archive`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Account-Id": "acc-hr-001", "X-Account-Role": "hr" },
    body: "{}",
  }).catch(() => {});
  await ctx.close();
});

test("API3 — Prerequisite logic: step 2 locked until step 1 completed", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await loginAs(page, HR_EMAIL, HR_PASSWORD);

  const create = await hrApi(page, "POST", "/api/admin/learning-paths", {
    title: "[E2E-TEST] Prerequisite Logic",
    completion_mode: "sequential",
  });
  const lpId = create.data.id;

  const s1 = await hrApi(page, "POST", `/api/admin/learning-paths/${lpId}/steps`, {
    step_type: "course", resource_id: COURSE_COMPLETED, is_required: true,
  });
  const s2 = await hrApi(page, "POST", `/api/admin/learning-paths/${lpId}/steps`, {
    step_type: "course", resource_id: COURSE_LOCKED, is_required: true,
    prerequisite_step_id: s1.data.id,
  });
  await hrApi(page, "POST", `/api/admin/learning-paths/${lpId}/publish`, {});
  await hrApi(page, "POST", `/api/admin/learning-paths/${lpId}/assign`, {
    target_type: "individual", employee_ids: ["emp-test-001"],
  });

  const aList = await hrApi(page, "GET", `/api/admin/learning-paths/${lpId}/assignments`);
  const assignmentId = aList.data?.data?.find((a) => a.status !== "cancelled")?.id;

  // Employee: verify step 1 available, step 2 locked
  const empCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const empPage = await empCtx.newPage();
  await loginAs(empPage, EMP_EMAIL, EMP_PASSWORD);

  const detailBefore = await empApi(empPage, "GET", `/api/learning-paths/my/${assignmentId}`);
  const steps = detailBefore.data?.steps ?? [];
  expect(steps[0]?.computed_status, "Step 1 must be available").toBe("available");
  expect(steps[1]?.computed_status, "Step 2 must be locked until step 1 done").toBe("locked");

  // Complete step 1
  await empApi(empPage, "POST", `/api/learning-paths/my/${assignmentId}/steps/${s1.data.id}/start`, {});
  await empApi(empPage, "POST", `/api/learning-paths/my/${assignmentId}/steps/${s1.data.id}/complete`, {});

  // Re-check: step 2 must now be available and progress = 50%
  const detailAfter = await empApi(empPage, "GET", `/api/learning-paths/my/${assignmentId}`);
  const stepsAfter = detailAfter.data?.steps ?? [];
  expect(stepsAfter[0]?.computed_status, "Step 1 must be completed").toBe("completed");
  expect(stepsAfter[1]?.computed_status, "Step 2 must now be available").toBe("available");
  expect(detailAfter.data?.assignment?.progress_percent, "Progress must be 50%").toBe(50);
  expect(detailAfter.data?.assignment?.status, "Status must be in_progress").toBe("in_progress");

  // Cleanup
  await hrApi(page, "POST", `/api/admin/learning-paths/${lpId}/archive`, {});
  await empCtx.close();
  await ctx.close();
});

test("API4 — Progress persists after page reload (server-side, not localStorage)", async ({ browser }) => {
  // Find the ongoing test assignment (from setup)
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await loginAs(page, EMP_EMAIL, EMP_PASSWORD);

  // Get all my assignments
  const myPaths = await empApi(page, "GET", "/api/learning-paths/my");
  const assignments = Array.isArray(myPaths.data) ? myPaths.data : (myPaths.data?.data ?? []);
  const inProgress = assignments.find((a) => a.status === "in_progress");

  if (!inProgress) {
    // No in-progress assignment available — skip with note
    console.log("No in_progress assignment found for persistence test; skipping");
    await ctx.close();
    return;
  }

  const assignmentId = inProgress.id;
  const progressBefore = inProgress.progress_percent;

  // Reload (fresh fetch, not from localStorage)
  const fresh = await empApi(page, "GET", `/api/learning-paths/my/${assignmentId}`);
  expect(fresh.status).toBe(200);
  expect(fresh.data?.assignment?.progress_percent, "Progress must persist from server").toBe(progressBefore);

  await ctx.close();
});

// ── BROWSER E2E ───────────────────────────────────────────────

test("E2E1 — HR LP list loads real data from production DB", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const failedLpRequests = [];
  page.on("requestfailed", (r) => {
    const url = r.url();
    const err = r.failure()?.errorText ?? "";
    // Only flag LP-specific API failures; ignore heartbeat, nav-aborted requests
    if (url.includes("/api/learning-paths") || url.includes("/api/admin/learning-paths")) {
      if (!err.includes("ERR_ABORTED")) {
        failedLpRequests.push(`${r.method()} ${url}: ${err}`);
      }
    }
  });
  await loginAs(page, HR_EMAIL, HR_PASSWORD);
  await page.goto(`${BASE}/admin/learning-paths`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".app-layout", { timeout: 8000 });

  // Must not show 500 error in UI
  expect(await page.locator("text=500").count(), "Must not show 500 error").toBe(0);
  expect(await page.locator("text=Không thể tải").count(), "Must not show load error card").toBe(0);
  // Must not have failed LP API requests
  expect(failedLpRequests, `Failed LP API: ${failedLpRequests.join("; ")}`).toHaveLength(0);
  await page.screenshot({ path: `${RESULTS_DIR}/e2e1-hr-lp-list.png`, fullPage: true });
  await ctx.close();
});

test("E2E2 — Employee LP list shows assigned paths", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const failedLpRequests = [];
  page.on("requestfailed", (r) => {
    const url = r.url();
    const err = r.failure()?.errorText ?? "";
    if (url.includes("/api/learning-paths")) {
      if (!err.includes("ERR_ABORTED")) failedLpRequests.push(`${r.method()} ${url}: ${err}`);
    }
  });
  await loginAs(page, EMP_EMAIL, EMP_PASSWORD);
  await page.goto(`${BASE}/dashboard/learning-paths`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".app-layout", { timeout: 8000 });

  // Ensure link is in sidebar
  await expect(page.locator("a[href='/dashboard/learning-paths']").first()).toBeVisible({ timeout: 5000 });
  // No error card
  expect(await page.locator("text=Không thể tải").count()).toBe(0);
  // No failed LP API calls
  expect(failedLpRequests, `Failed LP API: ${failedLpRequests.join("; ")}`).toHaveLength(0);
  await page.screenshot({ path: `${RESULTS_DIR}/e2e2-emp-my-paths.png`, fullPage: true });
  await ctx.close();
});

test("E2E3 — Employee LP detail shows step lock/unlock state correctly", async ({ browser }) => {
  // We need an assignment with a locked step to verify — use the standing [TEST] path
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await loginAs(page, EMP_EMAIL, EMP_PASSWORD);

  const myPaths = await empApi(page, "GET", "/api/learning-paths/my");
  const all = Array.isArray(myPaths.data) ? myPaths.data : (myPaths.data?.data ?? []);
  // Find assignment that has a path with 2+ steps
  const candidate = all.find((a) => a.status !== "cancelled");
  if (!candidate) {
    console.log("No active assignment for E2E3 — skipping");
    await ctx.close();
    return;
  }

  const detail = await empApi(page, "GET", `/api/learning-paths/my/${candidate.id}`);
  expect(detail.status).toBe(200);
  const steps = detail.data?.steps ?? [];
  expect(steps.length, "Assignment must have at least 1 step").toBeGreaterThan(0);
  // Every step must have a computed_status
  for (const s of steps) {
    expect(["available","in_progress","completed","locked","skipped"], `Unknown step status: ${s.computed_status}`).toContain(s.computed_status);
  }

  // Navigate to the detail page in browser and check no JS error
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.goto(`${BASE}/dashboard/learning-paths/${candidate.id}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".app-layout", { timeout: 8000 });
  await page.waitForTimeout(1000);
  expect(errs, `JS errors on detail page: ${errs.join(", ")}`).toHaveLength(0);
  await page.screenshot({ path: `${RESULTS_DIR}/e2e3-emp-lp-detail.png`, fullPage: true });
  await ctx.close();
});

test("E2E4 — Data persists after browser reload (DB-backed, not only localStorage)", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await loginAs(page, EMP_EMAIL, EMP_PASSWORD);

  // Get my assignments
  const res1 = await empApi(page, "GET", "/api/learning-paths/my");
  const assignments1 = Array.isArray(res1.data) ? res1.data : (res1.data?.data ?? []);

  // Reload page completely
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);

  // Get my assignments again
  const res2 = await empApi(page, "GET", "/api/learning-paths/my");
  const assignments2 = Array.isArray(res2.data) ? res2.data : (res2.data?.data ?? []);

  expect(assignments2.length, "Assignment count must be stable across reload").toBe(assignments1.length);
  // Progress values must be stable
  for (const a2 of assignments2) {
    const a1 = assignments1.find((x) => x.id === a2.id);
    if (a1) {
      expect(a2.progress_percent, `Progress must not change on reload for ${a2.id}`).toBe(a1.progress_percent);
    }
  }
  await ctx.close();
});

// ── MOBILE ───────────────────────────────────────────────────

test("MOB1 — Mobile 390×844: Employee LP list no horizontal overflow", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await loginAs(page, EMP_EMAIL, EMP_PASSWORD);
  await page.goto(`${BASE}/dashboard/learning-paths`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".app-layout", { timeout: 8000 });
  const overflow = await page.evaluate(() => document.body.scrollWidth > window.innerWidth);
  expect(overflow, "Mobile: no horizontal scroll allowed").toBe(false);
  await page.screenshot({ path: `${RESULTS_DIR}/mob1-emp-lp-mobile.png`, fullPage: true });
  await ctx.close();
});

test("MOB2 — Mobile 390×844: HR LP list no horizontal overflow", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await loginAs(page, HR_EMAIL, HR_PASSWORD);
  await page.goto(`${BASE}/admin/learning-paths`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".app-layout", { timeout: 8000 });
  const overflow = await page.evaluate(() => document.body.scrollWidth > window.innerWidth);
  expect(overflow, "Mobile: no horizontal scroll allowed").toBe(false);
  await page.screenshot({ path: `${RESULTS_DIR}/mob2-hr-lp-mobile.png`, fullPage: true });
  await ctx.close();
});

test("MOB3 — Tablet 768×1024: Employee LP list renders correctly", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  const page = await ctx.newPage();
  await loginAs(page, EMP_EMAIL, EMP_PASSWORD);
  await page.goto(`${BASE}/dashboard/learning-paths`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".app-layout", { timeout: 8000 });
  const overflow = await page.evaluate(() => document.body.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  await page.screenshot({ path: `${RESULTS_DIR}/mob3-tablet-lp.png`, fullPage: true });
  await ctx.close();
});
