import { test, expect } from "playwright/test";

const BASE = "https://mykis-learning.nkhaduy.workers.dev";
const HR_EMAIL = process.env.MYKIS_HR_EMAIL || "hr@kisvn.vn";
const HR_PASSWORD = process.env.MYKIS_HR_PASSWORD || "Training@2026";
const EMP_EMAIL = process.env.MYKIS_EMP_EMAIL || "employee.test@kisvn.vn";
const EMP_PASSWORD = process.env.MYKIS_EMP_PASSWORD || "Test@123456";

async function login(page, email, password) {
  await page.goto(`${BASE}/login`);
  await page.fill("#loginEmail", email);
  await page.fill("#loginPassword", password);
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => {
    const raw = localStorage.getItem("mykis.session.v1") || localStorage.getItem("mykis.session");
    if (!raw) return false;
    try {
      const session = JSON.parse(raw);
      return Boolean(session.supabaseAccessToken || session.accessToken);
    } catch {
      return false;
    }
  }, null, { timeout: 15000 });
  const token = await page.evaluate(() => {
    const raw = localStorage.getItem("mykis.session.v1") || localStorage.getItem("mykis.session");
    const session = raw ? JSON.parse(raw) : {};
    return session.supabaseAccessToken || session.accessToken || "";
  });
  expect(token).toBeTruthy();
  return token;
}

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

test("API — HR creates idempotent notification event, employee can read and mark unread/read", async ({ page }) => {
  const hrToken = await login(page, HR_EMAIL, HR_PASSWORD);
  const employeeToken = await login(page, EMP_EMAIL, EMP_PASSWORD);
  const employeeId = await page.evaluate(() => JSON.parse(localStorage.getItem("mykis.session.v1") || "{}").accountId);
  const key = `phase6:${Date.now()}:${employeeId}`;

  const payload = {
    notifications: [{
      account_id: employeeId,
      type: "course_assigned",
      title: "Phase 6 notification",
      body: "Idempotency check",
      link: "/dashboard/courses",
      entity_type: "e2e_notification",
      entity_id: key,
      idempotency_key: key,
      data: { course_title: "Phase 6 course" },
    }],
  };

  const first = await api(page, "POST", "/api/notifications", hrToken, payload);
  expect(first.ok).toBeTruthy();
  expect(first.body.count).toBe(1);

  const second = await api(page, "POST", "/api/notifications", hrToken, payload);
  expect(second.ok).toBeTruthy();
  expect(second.body.duplicates).toBeGreaterThanOrEqual(1);

  const list = await api(page, "GET", "/api/notifications", employeeToken);
  expect(list.ok).toBeTruthy();
  const rows = list.body;
  const created = rows.find((n) => n.eventId && n.type === "course_assigned" && n.title);
  expect(created).toBeTruthy();
  expect(created.link).toContain("/dashboard/courses");

  const unread = await api(page, "PATCH", "/api/notifications", employeeToken, { id: created.id, read: false });
  expect(unread.ok).toBeTruthy();

  const read = await api(page, "PATCH", "/api/notifications", employeeToken, { id: created.id });
  expect(read.ok).toBeTruthy();
});

test("SECURITY — employee cannot create notifications or run reminder monitor", async ({ page }) => {
  const empToken = await login(page, EMP_EMAIL, EMP_PASSWORD);

  const create = await api(page, "POST", "/api/notifications", empToken, { account_id: "someone-else", type: "course_assigned", title: "bad" });
  expect(create.status).toBe(403);

  const monitor = await api(page, "GET", "/api/admin/notifications/monitor", empToken);
  expect(monitor.status).toBe(403);

  const run = await api(page, "POST", "/api/admin/notifications/run-reminders", empToken);
  expect(run.status).toBe(403);
});

test("HR monitor exposes reminder rules and delivery history", async ({ page }) => {
  const hrToken = await login(page, HR_EMAIL, HR_PASSWORD);
  const monitor = await api(page, "GET", "/api/admin/notifications/monitor", hrToken);
  expect(monitor.ok).toBeTruthy();
  const body = monitor.body;
  expect(Array.isArray(body.rules)).toBeTruthy();
  expect(body.rules.some((rule) => rule.event_type === "certificate_expiring_30")).toBeTruthy();
  expect(Array.isArray(body.deliveries)).toBeTruthy();
});
