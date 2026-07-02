import { test, expect } from "playwright/test";

const BASE = "https://mykis-learning.nkhaduy.workers.dev";
const HR_HEADERS = { "X-Account-Id": "acc-hr-001", "X-Account-Role": "hr" };
const EMP_ID = "emp-test-001";

async function api(page, method, path, token, data) {
  return page.evaluate(async ({ base, method, path, token, data }) => {
    const r = await fetch(`${base}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    const body = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, body };
  }, { base: BASE, method, path, token, data });
}

async function apiWithHeaders(page, method, path, headers, data) {
  return page.evaluate(async ({ base, method, path, headers, data }) => {
    const r = await fetch(`${base}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    const body = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, body };
  }, { base: BASE, method, path, headers, data });
}

test("Phase 8 course version lifecycle, pinning, retraining, and employee guard", async ({ page }) => {
  const suffix = Date.now();
  const courseId = `test-versioned-course-${suffix}`;

  const created = await apiWithHeaders(page, "POST", "/api/courses", HR_HEADERS, {
    id: courseId,
    title: `[TEST] Versioned Course ${suffix}`,
    description: "v1",
    status: "published",
    durationMinutes: 15,
  });
  expect(created.ok).toBeTruthy();

  const listV1 = await apiWithHeaders(page, "GET", `/api/admin/courses/${courseId}/versions`, HR_HEADERS);
  expect(listV1.ok).toBeTruthy();
  expect(listV1.body.data[0].version_number).toBe(1);
  const v1 = listV1.body.data[0];

  const assignedOld = await apiWithHeaders(page, "POST", "/api/enrollments", HR_HEADERS, {
    enrollments: [{ id: `test-enroll-old-${suffix}`, courseId, accountId: EMP_ID, status: "notStarted" }],
  });
  expect(assignedOld.ok).toBeTruthy();
  const oldEnrollment = await apiWithHeaders(page, "GET", `/api/enrollments?courseId=${courseId}&accountId=${EMP_ID}`, HR_HEADERS);
  expect(oldEnrollment.body[0].courseVersion).toBe("v1");

  const draftRes = await apiWithHeaders(page, "POST", `/api/admin/courses/${courseId}/versions`, HR_HEADERS, { createdFromVersionId: v1.id });
  expect(draftRes.ok).toBeTruthy();
  const draft = draftRes.body.version;
  expect(draft.version_number).toBe(2);

  const updated = await apiWithHeaders(page, "PATCH", `/api/admin/courses/${courseId}/versions/${draft.id}`, HR_HEADERS, {
    title: `[TEST] Versioned Course ${suffix} v2`,
    change_type: "major",
    change_summary: "Major policy update requires retraining review",
  });
  expect(updated.ok).toBeTruthy();

  const immutable = await apiWithHeaders(page, "PATCH", `/api/admin/courses/${courseId}/versions/${v1.id}`, HR_HEADERS, { title: "should fail" });
  expect(immutable.status).toBe(409);
  expect(immutable.body.error).toBe("PUBLISHED_VERSION_IMMUTABLE");

  const publish = await apiWithHeaders(page, "POST", `/api/admin/courses/${courseId}/versions/${draft.id}/publish`, HR_HEADERS);
  expect(publish.ok).toBeTruthy();
  expect(publish.body.version.status).toBe("published");
  expect(publish.body.retrainingReview.status).toBe("pending");

  const oldEnrollmentAfter = await apiWithHeaders(page, "GET", `/api/enrollments?courseId=${courseId}&accountId=${EMP_ID}`, HR_HEADERS);
  expect(oldEnrollmentAfter.body[0].courseVersion).toBe("v1");

  const employeeDraftBlock = await apiWithHeaders(page, "GET", `/api/admin/courses/${courseId}/versions`, {
    "X-Account-Id": EMP_ID,
    "X-Account-Role": "employee",
  });
  expect(employeeDraftBlock.status).toBe(403);

  const preview = await apiWithHeaders(page, "POST", `/api/admin/retraining-reviews/${publish.body.retrainingReview.id}/preview`, HR_HEADERS, {});
  expect(preview.ok).toBeTruthy();
  expect(preview.body.affectedEmployeeCount).toBeGreaterThanOrEqual(0);

  const approved = await apiWithHeaders(page, "POST", `/api/admin/retraining-reviews/${publish.body.retrainingReview.id}/approve`, HR_HEADERS, {});
  expect(approved.ok).toBeTruthy();
  const applied = await apiWithHeaders(page, "POST", `/api/admin/retraining-reviews/${publish.body.retrainingReview.id}/apply`, HR_HEADERS, {});
  expect(applied.ok).toBeTruthy();
  const appliedAgain = await apiWithHeaders(page, "POST", `/api/admin/retraining-reviews/${publish.body.retrainingReview.id}/apply`, HR_HEADERS, {});
  expect(appliedAgain.status).toBe(409);
  expect(appliedAgain.body.error).toBe("RETRAINING_ALREADY_APPLIED");
});

test("Phase 8 HR retraining page renders", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("mykis.session.v1", JSON.stringify({
      accountId: "acc-hr-001",
      role: "hr",
      fullName: "HR Test",
      email: "hr-test@example.invalid",
      supabaseAccessToken: "test-ui-session",
      loginAt: new Date().toISOString(),
    }));
  });
  await page.goto(`${BASE}/admin/retraining`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("h1")).toContainText("Tái đào tạo");
  await expect(page.locator("body")).not.toContainText("Không thể tải trang");
});
