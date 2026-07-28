import { expect, test } from "playwright/test";

const employeeId = "11111111-1111-4111-8111-111111111111";
const adminId = "55555555-5555-4555-8555-555555555555";
const employeeRoutes = [
  "/dashboard/learning-paths", "/dashboard/learning-paths/path-1", "/dashboard/gallery", "/dashboard/gallery/album-1",
  "/dashboard/resources", "/dashboard/calendar", "/dashboard/learning-history", "/dashboard/history", "/dashboard/compliance",
  "/dashboard/compliance/cycle-1", "/dashboard/skills", "/dashboard/development-plan", "/dashboard/development-plan/plan-1", "/dashboard/notifications",
];
const adminRoutes = [
  "/admin/assign", "/admin/learning-paths", "/admin/learning-paths/path-1", "/admin/sessions", "/admin/training-tracking",
  "/admin/cchn-registrations", "/admin/accounts", "/admin/competencies", "/admin/skills-matrix", "/admin/development-plans",
  "/admin/retraining", "/admin/compliance", "/admin/compliance/cycles/cycle-1", "/admin/certificates", "/admin/certifications",
  "/admin/gallery", "/admin/notifications", "/admin/audit-log",
];

async function mockApis(page) {
  await page.route((url) => url.pathname.startsWith("/api/"), (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.startsWith("/api/public/live-training/")) return route.fulfill({ status: 200, json: { flow: { title: "Synthetic session", description: "Parity" }, steps: {} } });
    return route.fulfill({ status: 200, json: { items: [], rows: [], data: [] } });
  });
  await page.route((url) => url.pathname === "/api/auth" && url.searchParams.get("action") === "session", (route) => route.fulfill({ status: 200, json: { authenticated: true, account: { id: employeeId, role: "employee" }, expires_at: Math.floor(Date.now() / 1000) + 3600 } }));
}

test("ROUTE-E2E-ALL: secondary routes support direct navigation, reload, empty state, and no monolith", async ({ page }) => {
  test.setTimeout(120_000);
  await mockApis(page);
  for (const path of ["/training", ...employeeRoutes]) {
    await page.goto(path);
    await expect(page.locator("main").first()).toBeVisible();
    expect(await page.evaluate(() => performance.getEntriesByType("resource").some((entry) => entry.name.endsWith("/app.js")))).toBe(false);
    await page.reload();
    await expect(page.locator("main").first()).toBeVisible();
  }
});

test("ROUTE-E2E-ALL: admin secondary routes render forbidden for employee and authorized for admin", async ({ page }) => {
  test.setTimeout(120_000);
  await page.route((url) => url.pathname.startsWith("/api/"), (route) => route.fulfill({ status: 200, json: { items: [], rows: [], data: [] } }));
  const sessionRoute = (url) => url.pathname === "/api/auth" && url.searchParams.get("action") === "session";
  await page.route(sessionRoute, (route) => route.fulfill({ status: 200, json: { authenticated: true, account: { id: employeeId, role: "employee" }, expires_at: Math.floor(Date.now() / 1000) + 3600 } }));
  for (const path of adminRoutes) {
    await page.goto(path);
    await expect(page.locator("main").first()).toBeVisible();
    await expect(page.getByText(/không có quyền|403/i).first()).toBeVisible();
  }
  await page.unroute(sessionRoute);
  await page.route(sessionRoute, (route) => route.fulfill({ status: 200, json: { authenticated: true, account: { id: adminId, role: "admin" }, expires_at: Math.floor(Date.now() / 1000) + 3600 } }));
  for (const path of adminRoutes) {
    await page.goto(path);
    await expect(page.locator("main").first()).toBeVisible();
    expect(await page.locator("body").getAttribute("data-route-entry")).toMatch(/^admin-secondary/);
  }
});
