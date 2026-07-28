import { expect, test } from "playwright/test";

const employeeId = "11111111-1111-4111-8111-111111111111";
const adminId = "55555555-5555-4555-8555-555555555555";

async function mockSession(page, { id, role }) {
  await page.route("**/api/auth?action=session*", (route) => route.fulfill({
    status: 200,
    json: { authenticated: true, account: { id, role }, expires_at: Math.floor(Date.now() / 1000) + 3600 },
  }));
}

function trackRequests(page) {
  const requests = [];
  page.on("request", (request) => requests.push(new URL(request.url()).pathname));
  return requests;
}

async function routeBytes(page) {
  return page.evaluate(() => performance.getEntriesByType("resource").reduce((totals, entry) => {
    const path = new URL(entry.name).pathname;
    const bytes = entry.encodedBodySize || entry.transferSize || 0;
    if (/\.js$/.test(path)) totals.js += bytes;
    if (/\.css$/.test(path)) totals.css += bytes;
    return totals;
  }, { js: 0, css: 0 }));
}

function expectForbiddenDependencies(requests) {
  const forbidden = ["/app.js", "/styles.css", "/lib/mockDatabase.js", "/vendor/xlsx.full.min.js", "/vendor/jsqr.min.js", "/vendor/qrcode.min.js"];
  for (const path of forbidden) expect(requests, `unexpected dependency ${path}`).not.toContain(path);
}

async function expectLandingFont(page, selector = "body") {
  const family = await page.locator(selector).evaluate((element) => getComputedStyle(element).fontFamily);
  expect(family).toContain("Be Vietnam Pro");
}

test("PERF-005/UX-001: learner dashboard is a lightweight role-aware split entry", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const requests = trackRequests(page);
  await mockSession(page, { id: employeeId, role: "employee" });
  await page.route("**/api/courses", (route) => route.fulfill({ json: [
    { id: "course-a", title: "An toàn thông tin", status: "published" },
    { id: "course-b", title: "Văn hóa KIS", status: "published" },
  ] }));
  await page.route("**/api/enrollments?accountId=*", (route) => route.fulfill({ json: [
    { id: "enr-a", courseId: "course-a", status: "inProgress", progressPercent: 45, deadline: "2026-08-15" },
    { id: "enr-b", courseId: "course-b", status: "completed", progressPercent: 100, deadline: "2026-07-20" },
  ] }));
  await page.route("**/api/notifications?accountId=*", (route) => route.fulfill({ json: [
    { id: "notification-a", title: "Khóa học mới", body: "Bạn đã được giao khóa học An toàn thông tin.", link: "/dashboard/courses/course-a", createdAt: "2026-07-27T01:00:00Z", isRead: false },
  ] }));

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1, name: "Tổng quan học tập" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Hành trình học tập của bạn" })).toBeVisible();
  const dashboardTypography = await page.locator("body").evaluate((element) => {
    const style = getComputedStyle(element);
    return { family: style.fontFamily, size: style.fontSize, lineHeight: style.lineHeight };
  });
  expect(dashboardTypography.family).toContain("Be Vietnam Pro");
  expect(dashboardTypography.size).toBe("15px");
  expect(dashboardTypography.lineHeight).toBe("24px");
  expect(await page.locator("body").getAttribute("data-route-entry")).toBe("learner-dashboard");
  expectForbiddenDependencies(requests);
  expect(requests.filter((path) => path === "/api/courses")).toHaveLength(1);
  expect(requests.filter((path) => path === "/api/enrollments")).toHaveLength(1);
  expect(requests.filter((path) => path === "/api/notifications")).toHaveLength(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  const menu = page.getByRole("button", { name: "Mở menu" });
  expect(await page.locator("#route-navigation").evaluate((element) => element.inert)).toBe(true);
  await expect(page.getByRole("combobox", { name: "Ngôn ngữ" })).toBeVisible();
  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#route-navigation")).toHaveAttribute("aria-hidden", "false");
  expect(await page.locator("#route-navigation").evaluate((element) => element.inert)).toBe(false);
  await expect(page.getByRole("link", { name: "Tài nguyên" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Lịch học" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Nhân viên" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  expect(await page.locator("#route-navigation").evaluate((element) => element.inert)).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await page.locator("#route-navigation").evaluate((element) => parseFloat(getComputedStyle(element).transitionDuration))).toBeLessThanOrEqual(0.001);
  const bytes = await routeBytes(page);
  expect(bytes.js).toBeLessThanOrEqual(350 * 1024);
  expect(bytes.css).toBeLessThanOrEqual(120 * 1024);
});

test("PERF-005/I18N: learner course list is split, searchable, and localizes status", async ({ page }) => {
  const requests = trackRequests(page);
  await mockSession(page, { id: employeeId, role: "employee" });
  await page.route("**/api/courses", (route) => route.fulfill({ json: [
    { id: "course-a", title: "An toàn thông tin", description: "Synthetic security course", status: "published", category: "Tuân thủ" },
    { id: "course-b", title: "Văn hóa KIS", description: "Synthetic onboarding course", status: "published", category: "Onboarding" },
  ] }));
  await page.route("**/api/enrollments?accountId=*", (route) => route.fulfill({ json: [
    { id: "enr-a", courseId: "course-a", status: "inProgress", progressPercent: 45, deadline: "2026-08-15" },
    { id: "enr-b", courseId: "course-b", status: "completed", progressPercent: 100, deadline: "2026-07-20" },
  ] }));

  await page.goto("/dashboard/courses");
  await expect(page.getByRole("heading", { level: 1, name: "Khóa học của tôi" })).toBeVisible();
  await expect(page.locator(".learner-course-card__status", { hasText: "Đang học" })).toBeVisible();
  await expect(page.locator(".learner-course-card__status", { hasText: "Hoàn thành" })).toBeVisible();
  expect(await page.locator("body").getAttribute("data-route-entry")).toBe("learner-courses");
  expectForbiddenDependencies(requests);
  expect(requests.filter((path) => path === "/api/courses")).toHaveLength(1);
  expect(requests.filter((path) => path === "/api/enrollments")).toHaveLength(1);
  await page.getByRole("searchbox", { name: "Tìm theo tên khóa học" }).fill("Văn hóa");
  await expect(page.getByRole("heading", { name: "Văn hóa KIS" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "An toàn thông tin" })).toHaveCount(0);
  const bodyText = await page.locator("body").innerText();
  expect(bodyText).not.toMatch(/\binProgress\b|\bundefined\b|\[object Object\]/);
  const bytes = await routeBytes(page);
  expect(bytes.js).toBeLessThanOrEqual(350 * 1024);
  expect(bytes.css).toBeLessThanOrEqual(120 * 1024);
});

test("PERF-005/UX-001: admin dashboard split excludes learner and reporting chunks", async ({ page }) => {
  const requests = trackRequests(page);
  await mockSession(page, { id: adminId, role: "hr" });
  await page.route("**/api/admin/overview", (route) => route.fulfill({ json: {
    totalEmployees: 10000, visitedToday: 721, onlineNow: 42, learningNow: 18, pendingActions: 2,
    activeCourseCount: 35, completionRate: 84,
    tasks: [{ id: "task-a", title: "Reset mật khẩu", taskTypeLabel: "Reset mật khẩu", priority: "high", priorityLabel: "Cao", status: "new", statusLabel: "Mới", createdAt: "2026-07-27T01:00:00Z", requester: { fullName: "Synthetic Employee" } }],
    onlineLearning: [{ accountId: employeeId, fullName: "Synthetic Learner", activityLabel: "Đang xem nội dung", pagePath: "/admin/training-tracking", lastSeenAt: "2026-07-27T01:05:00Z" }],
    inactiveEmployeeRows: [{ id: "inactive-a", fullName: "Inactive Synthetic", department: "IT", status: "15-30 ngày", lastSeenAt: "2026-07-01T01:00:00Z" }],
    upcomingSessions: [{ id: "session-a", title: "Đào tạo tuân thủ", startAt: "2026-08-01T02:00:00Z", locationName: "Synthetic Room" }],
  } }));

  await page.goto("/admin");
  await expect(page.getByRole("heading", { level: 1, name: "Tổng quan quản trị" })).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
  await expectLandingFont(page);
  expect(await page.locator("body").getAttribute("data-route-entry")).toBe("admin-dashboard");
  expectForbiddenDependencies(requests);
  expect(requests).not.toContain("/src/features/learner/dashboard.js");
  expect(requests).not.toContain("/src/features/reporting/reports.js");
  await expect(page.getByRole("link", { name: "Khung năng lực" })).toBeAttached();
  await expect(page.getByRole("link", { name: "Hồ sơ học tập" })).toBeAttached();
  await expect(page.getByRole("link", { name: "Khóa học của tôi" })).toHaveCount(0);
  const bytes = await routeBytes(page);
  expect(bytes.js).toBeLessThanOrEqual(500 * 1024);
  expect(bytes.css).toBeLessThanOrEqual(160 * 1024);
});

test("PERF-005/A11Y: reporting split uses keyboard tabs and server-side exports without XLSX runtime", async ({ page }) => {
  const requests = trackRequests(page);
  await mockSession(page, { id: adminId, role: "admin" });
  await page.route("**/api/admin/reports/overview?*", (route) => route.fulfill({ json: {
    metrics: { totalEmployees: 10000, activeLearners: 6400, openCourses: 35, completionRate: 84, onTimeCompletionRate: 79, overdueLearners: 120 },
    departmentComparison: [{ department: "IT", completionRate: 92 }, { department: "HR", completionRate: 88 }],
    priorityExceptions: [{ employee: "Synthetic Employee", title: "Compliance 2026", dueAt: "2026-07-31" }],
  } }));
  await page.route("**/api/admin/reports/employees?*", (route) => route.fulfill({ json: {
    total: 1,
    rows: [{ employee: "Synthetic Employee", employeeCode: "SYN-001", department: "IT", jobTitle: "Tester", assigned: 2, completed: 1, inProgress: 1, overdue: 0, completionRate: 50, lastActivityAt: "2026-07-27" }],
  } }));

  await page.goto("/admin/reports");
  await expect(page.getByRole("heading", { level: 1, name: "Báo cáo đào tạo" })).toBeVisible();
  await expectLandingFont(page);
  expect(await page.locator("body").getAttribute("data-route-entry")).toBe("admin-reporting");
  expectForbiddenDependencies(requests);
  expect(requests).not.toContain("/src/features/admin/dashboard.js");
  await expect(page.getByText(/IT: 92%/)).toBeAttached();

  const overviewTab = page.getByRole("tab", { name: "Tổng quan" });
  await overviewTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Nhân viên" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("table")).toContainText("SYN-001");
  expect(requests.filter((path) => path === "/api/admin/reports/overview")).toHaveLength(1);
  expect(requests.filter((path) => path === "/api/admin/reports/employees")).toHaveLength(1);
  const bodyText = await page.locator("body").innerText();
  expect(bodyText).not.toMatch(/\bundefined\b|\[object Object\]|reports\.[A-Za-z]/);
  const bytes = await routeBytes(page);
  expect(bytes.js).toBeLessThanOrEqual(500 * 1024);
  expect(bytes.css).toBeLessThanOrEqual(160 * 1024);
});

test("ARCH-ROUTE-001: learner legacy pages hand overview navigation to the canonical split shell", async ({ page }) => {
  await mockSession(page, { id: employeeId, role: "employee" });
  await page.route("**/api/courses", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/enrollments?accountId=*", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/notifications?accountId=*", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/quizzes**", (route) => route.fulfill({ json: [] }));

  await page.goto("/dashboard/quizzes");
  await page.locator('a[href="/dashboard"]').first().click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { level: 1, name: "Tổng quan học tập" })).toBeVisible();
  expect(await page.locator("body").getAttribute("data-route-entry")).toBe("learner-dashboard");
});

test("ARCH-ROUTE-002: admin legacy pages hand overview navigation to the canonical split shell", async ({ page }) => {
  await mockSession(page, { id: adminId, role: "admin" });
  await page.route("**/api/employees**", (route) => route.fulfill({ json: { items: [], data: [] } }));
  await page.route("**/api/admin/overview", (route) => route.fulfill({ json: {
    totalEmployees: 0, visitedToday: 0, onlineNow: 0, learningNow: 0,
    pendingActions: 0, activeCourseCount: 0, completionRate: 0,
    tasks: [], onlineLearning: [], inactiveEmployeeRows: [], upcomingSessions: [],
  } }));

  await page.goto("/admin/employees");
  await page.locator('a[href="/admin"]').first().click();

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { level: 1, name: "Tổng quan quản trị" })).toBeVisible();
  expect(await page.locator("body").getAttribute("data-route-entry")).toBe("admin-dashboard");
});
