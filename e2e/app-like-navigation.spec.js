import { expect, test } from "playwright/test";

const hrAccount = {
  id: "55555555-5555-4555-8555-555555555555",
  role: "hr",
  fullName: "HR Navigation Test",
};

async function mockAuthenticatedHr(page, counters, { employeeDelay = 0 } = {}) {
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
      delay: employeeDelay,
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

function sidebarLink(page, name) {
  return page.locator(".route-sidebar").getByRole("link", { name, exact: true });
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
  await sidebarLink(page, "Nhân viên").click();
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
  await sidebarLink(page, "Nhân viên").click();
  await expect(page.getByRole("heading", { level: 1, name: "Quản lý nhân viên" })).toBeVisible();
  await sidebarLink(page, "Khóa học").click();
  await expect(page.getByRole("heading", { level: 1, name: "Quản lý khóa học" })).toBeVisible();
  await sidebarLink(page, "Nhân viên").click();
  await expect(page.getByRole("heading", { level: 1, name: "Quản lý nhân viên" })).toBeVisible();

  expect(counters.employees, "a fresh cached employee list should be reused on revisit").toBe(1);
  expect(counters.courses).toBe(1);
  expect(counters.session).toBe(1);
});

test("SPA-NAV-003: active state is synchronous and Back/Forward reuse the shell", async ({ page }) => {
  const counters = { session: 0, employees: 0, courses: 0 };
  const documentRequests = [];
  page.on("request", (request) => {
    if (request.resourceType() === "document") documentRequests.push(request.url());
  });
  await mockAuthenticatedHr(page, counters);
  await page.goto("/hr");
  await expect(page.getByRole("heading", { level: 1, name: "Tổng quan quản trị" })).toBeVisible();
  const initialDocumentCount = documentRequests.length;
  await page.evaluate(() => { window.__stableSidebar = document.querySelector(".route-sidebar"); });

  const immediate = await page.evaluate(() => {
    const link = document.querySelector('.route-sidebar a[href="/hr/employees"]');
    link.click();
    return { active: link.classList.contains("active"), current: link.getAttribute("aria-current"), path: location.pathname };
  });
  expect(immediate).toEqual({ active: true, current: "page", path: "/hr/employees" });
  await expect(page.getByRole("heading", { level: 1, name: "Quản lý nhân viên" })).toBeVisible();
  await sidebarLink(page, "Khóa học").click();
  await expect(page.getByRole("heading", { level: 1, name: "Quản lý khóa học" })).toBeVisible();

  await page.evaluate(() => history.back());
  await expect(page).toHaveURL(/\/hr\/employees$/);
  await expect(page.getByRole("heading", { level: 1, name: "Quản lý nhân viên" })).toBeVisible();
  await page.evaluate(() => history.forward());
  await expect(page).toHaveURL(/\/hr\/courses$/);
  await expect(page.getByRole("heading", { level: 1, name: "Quản lý khóa học" })).toBeVisible();

  expect(documentRequests.slice(initialDocumentCount)).toEqual([]);
  expect(await page.evaluate(() => window.__stableSidebar === document.querySelector(".route-sidebar"))).toBe(true);
  expect(counters.session).toBe(1);
});

test("SPA-NAV-004: rapid route changes cannot overwrite the latest route", async ({ page }) => {
  const counters = { session: 0, employees: 0, courses: 0 };
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await mockAuthenticatedHr(page, counters, { employeeDelay: 350 });
  await page.goto("/hr");
  await expect(page.getByRole("heading", { level: 1, name: "Tổng quan quản trị" })).toBeVisible();

  await page.evaluate(() => {
    const paths = ["/hr/employees", "/hr/courses", "/hr", "/hr/employees", "/hr/courses", "/hr", "/hr/employees", "/hr/courses", "/hr", "/hr/employees", "/hr"];
    for (const path of paths) document.querySelector(`.route-sidebar a[href="${path}"]`).click();
  });

  await expect(page).toHaveURL(/\/hr$/);
  await expect(page.getByRole("heading", { level: 1, name: "Tổng quan quản trị" })).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.getByRole("heading", { level: 1, name: "Tổng quan quản trị" })).toBeVisible();
  expect(errors).toEqual([]);
  expect(counters.session).toBe(1);
  expect(counters.employees).toBeLessThanOrEqual(1);
  expect(counters.courses).toBeLessThanOrEqual(1);
});

test("SPA-NAV-005: mobile slow navigation never exposes a blank content frame", async ({ page }) => {
  const counters = { session: 0, employees: 0, courses: 0 };
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.setViewportSize({ width: 390, height: 844 });
  await mockAuthenticatedHr(page, counters, { employeeDelay: 900 });
  await page.goto("/hr");
  await expect(page.getByRole("heading", { level: 1, name: "Tổng quan quản trị" })).toBeVisible();
  await page.evaluate(() => {
    window.__navigationFrames = [];
    window.__navigationCls = 0;
    window.__stableShell = document.querySelector(".route-shell");
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__navigationCls += entry.value;
    }).observe({ type: "layout-shift", buffered: true });
    const stopAt = performance.now() + 1_500;
    const sample = () => {
      const shell = document.querySelector(".route-shell");
      const content = document.querySelector("[data-route-content]");
      window.__navigationFrames.push(Boolean(shell && content && content.children.length && content.getBoundingClientRect().height > 0));
      if (performance.now() < stopAt) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });

  await page.locator("[data-open-route-nav]").click();
  await sidebarLink(page, "Nhân viên").click();
  await expect(page.getByRole("heading", { level: 1, name: "Quản lý nhân viên" })).toBeVisible();
  await page.waitForTimeout(650);

  const result = await page.evaluate(() => ({
    allFramesHaveContent: window.__navigationFrames.length > 20 && window.__navigationFrames.every(Boolean),
    cls: window.__navigationCls,
    shellStable: window.__stableShell === document.querySelector(".route-shell"),
  }));
  expect(result.allFramesHaveContent).toBe(true);
  expect(result.cls).toBeLessThanOrEqual(0.01);
  expect(result.shellStable).toBe(true);
  expect(errors).toEqual([]);
});

test("SPA-NAV-006: language changes rerender in place without reloading auth or shell", async ({ page }) => {
  const counters = { session: 0, employees: 0, courses: 0 };
  const documents = [];
  page.on("request", (request) => { if (request.resourceType() === "document") documents.push(request.url()); });
  await mockAuthenticatedHr(page, counters);
  await page.goto("/hr");
  await expect(page.getByRole("heading", { level: 1, name: "Tổng quan quản trị" })).toBeVisible();
  const initialDocuments = documents.length;
  await page.evaluate(() => { window.__languageShell = document.querySelector(".route-shell"); });

  await page.locator("[data-route-language]").selectOption("en");
  await expect(page.getByRole("heading", { level: 1, name: "Administration overview" })).toBeVisible();

  expect(documents.slice(initialDocuments)).toEqual([]);
  expect(await page.evaluate(() => window.__languageShell === document.querySelector(".route-shell"))).toBe(true);
  expect(counters.session).toBe(1);
});
