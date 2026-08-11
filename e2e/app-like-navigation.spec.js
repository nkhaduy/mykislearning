import { expect, test } from "playwright/test";

const hrAccount = {
  id: "55555555-5555-4555-8555-555555555555",
  role: "hr",
  fullName: "HR Navigation Test",
};

async function mockAuthenticatedHr(page, counters) {
  await page.route("**/api/auth?action=session*", (route) => {
    counters.session += 1;
    return route.fulfill({
      status: 200,
      json: { authenticated: true, account: hrAccount, expires_at: Math.floor(Date.now() / 1000) + 3600 },
    });
  });
  await page.route("**/api/admin/overview", (route) => route.fulfill({
    json: {
      totalEmployees: 2,
      visitedToday: 2,
      onlineNow: 1,
      learningNow: 1,
      pendingActions: 0,
      activeCourseCount: 1,
      completionRate: 80,
      tasks: [],
      onlineLearning: [],
      inactiveEmployeeRows: [],
      upcomingSessions: [],
    },
  }));
  await page.route("**/api/employees?*", (route) => {
    counters.employees += 1;
    return route.fulfill({
      json: {
        items: [{
          id: "employee-a",
          fullName: "Nhân viên A",
          email: "employee-a@example.test",
          employeeCode: "EMP-A",
          department: "QA",
          position: "Tester",
          accountStatus: "active",
        }],
        nextCursor: null,
        hasMore: false,
      },
    });
  });
  await page.route("**/api/courses", (route) => {
    counters.courses += 1;
    return route.fulfill({
      json: [{ id: "course-a", title: "An toàn thông tin", status: "published", delivery_mode: "online" }],
    });
  });
}

test("SPA-NAV-001: HR sidebar navigation keeps one document and one shell", async ({ page }) => {
  const counters = { session: 0, employees: 0, courses: 0 };
  const documentRequests = [];
  page.on("request", (request) => {
    if (request.resourceType() === "document") documentRequests.push(new URL(request.url()).pathname);
  });
  await mockAuthenticatedHr(page, counters);

  await page.goto("/hr");
  await expect(page.getByRole("heading", { level: 1, name: "Tổng quan quản trị" })).toBeVisible();
  await page.evaluate(() => {
    window.__mykisNavigationTest = {
      sidebar: document.querySelector(".route-sidebar"),
      topbar: document.querySelector(".route-topbar"),
    };
  });
  const initialDocumentCount = documentRequests.length;
  const sidebar = page.locator(".route-sidebar");

  await sidebar.getByRole("link", { name: "Nhân viên", exact: true }).click();
  await expect(page).toHaveURL(/\/hr\/employees$/);
  await expect(page.getByRole("heading", { level: 1, name: "Quản lý nhân viên" })).toBeVisible();

  expect(documentRequests.slice(initialDocumentCount), "internal route clicks must not request another HTML document").toEqual([]);
  expect(await page.evaluate(() => ({
    sidebar: window.__mykisNavigationTest?.sidebar === document.querySelector(".route-sidebar"),
    topbar: window.__mykisNavigationTest?.topbar === document.querySelector(".route-topbar"),
  }))).toEqual({ sidebar: true, topbar: true });
  expect(counters.session, "the validated session must be reused across route changes").toBe(1);
});

test("SPA-NAV-002: cached HR route revisit does not duplicate GET requests", async ({ page }) => {
  const counters = { session: 0, employees: 0, courses: 0 };
  await mockAuthenticatedHr(page, counters);

  await page.goto("/hr");
  const sidebar = page.locator(".route-sidebar");
  await sidebar.getByRole("link", { name: "Nhân viên", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Quản lý nhân viên" })).toBeVisible();
  await sidebar.getByRole("link", { name: "Khóa học", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Quản lý khóa học" })).toBeVisible();
  await sidebar.getByRole("link", { name: "Nhân viên", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Quản lý nhân viên" })).toBeVisible();

  expect(counters.employees, "a fresh cached employee list should be reused on revisit").toBe(1);
  expect(counters.courses).toBe(1);
  expect(counters.session).toBe(1);
});
