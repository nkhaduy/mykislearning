#!/usr/bin/env node
/**
 * Create or repair a non-HR employee test account and minimal sample data.
 *
 * Uses Worker API with an HR session. Does not print secrets or password hashes.
 *
 * Env:
 * All target and credential values are required and must point to local/disposable infrastructure.
 */

import { assertSafeE2ETarget } from "./assert-safe-e2e-target.mjs";

const BASE_URL = process.env.BASE_URL || "";
const HR_EMAIL = process.env.HR_EMAIL || "";
const HR_PASSWORD = process.env.HR_PASSWORD || "";
assertSafeE2ETarget({ baseURL: BASE_URL, suite: "mutation", mutationAllowed: true });
if (!HR_EMAIL || !HR_PASSWORD || !process.env.TEST_EMPLOYEE_EMAIL || !process.env.TEST_EMPLOYEE_PASSWORD) {
  throw new Error("isolated HR and employee runtime credentials are required");
}

const TEST = {
  id: "emp-test-001",
  employeeCode: "TEST001",
  fullName: "Nhân viên Test",
  email: process.env.TEST_EMPLOYEE_EMAIL,
  password: process.env.TEST_EMPLOYEE_PASSWORD,
};

async function api(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, options);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${options.method || "GET"} ${path} failed: ${body.error || body.message || res.status}`);
  return body;
}

async function loginHr() {
  const body = await api("/api/auth?action=login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: HR_EMAIL, password: HR_PASSWORD }),
  });
  if (body.profile?.role !== "hr") throw new Error("Configured account is not HR.");
  return body.access_token;
}

function headers(token = "") {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function findExisting(token) {
  const body = await api(`/api/employees?search=${encodeURIComponent(TEST.email)}&includeDemo=true&pageSize=20`, {
    headers: headers(token),
  });
  return (body.items || []).find((item) => item.email?.toLowerCase() === TEST.email) || null;
}

async function ensureProfile(token) {
  const existing = await findExisting(token);
  const targetId = existing?.id || TEST.id;
  await api(`/api/employees/${encodeURIComponent(targetId)}`, {
    method: "PATCH",
    headers: headers(token),
    body: JSON.stringify({
      full_name: TEST.fullName,
      email: TEST.email,
      employee_code: TEST.employeeCode,
      role: "employee",
      department: "QA",
      position: "Employee Test",
      account_status: "active",
      password_status: "normal",
      _notes: { is_demo: true, test_account: true, source: "scripts/create-or-repair-employee-test.mjs" },
    }),
  });
  await api("/api/admin/hr-account-actions", {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ action: "reset-password", targetId, newPassword: TEST.password, requireChange: false }),
  });
  return targetId;
}

async function ensureCoursesAndEnrollments(token, accountId) {
  const inProgressCourse = {
    id: "test-course-in-progress",
    title: "Khóa học test đang học",
    description: "Dữ liệu mẫu cho employee.test@kisvn.vn",
    status: "published",
    deliveryMode: "online",
    durationHours: 2,
    category: "Test",
    createdBy: "System",
  };
  const completedCourse = {
    id: "test-course-completed",
    title: "Khóa học test đã hoàn thành",
    description: "Dữ liệu mẫu đã hoàn thành cho employee test",
    status: "published",
    deliveryMode: "online",
    durationHours: 1,
    category: "Test",
    createdBy: "System",
  };
  await api("/api/courses", { method: "POST", headers: headers(token), body: JSON.stringify(inProgressCourse) });
  await api("/api/courses", { method: "POST", headers: headers(token), body: JSON.stringify(completedCourse) });
  await api("/api/enrollments", {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({
      enrollments: [
        {
          id: "enr-test-in-progress",
          courseId: inProgressCourse.id,
          accountId,
          status: "inProgress",
          progressPercent: 40,
          assignedAt: new Date().toISOString(),
          deadline: "2026-12-31",
          note: "Sample in-progress enrollment",
        },
        {
          id: "enr-test-completed",
          courseId: completedCourse.id,
          accountId,
          status: "completed",
          progressPercent: 100,
          assignedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          deadline: "2026-12-31",
          note: "Sample completed enrollment",
        },
      ],
    }),
  });
}

async function ensureNotification(token, accountId) {
  await api("/api/notifications", {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({
      id: "notif-test-employee-welcome",
      account_id: accountId,
      type: "system",
      title: "Thông báo test",
      body: "Dữ liệu mẫu cho tài khoản employee test.",
      link: "/dashboard",
      is_read: false,
      data: { source: "create-or-repair-employee-test" },
    }),
  });
}

async function main() {
  const token = await loginHr();
  const accountId = await ensureProfile(token);
  await ensureCoursesAndEnrollments(token, accountId);
  await ensureNotification(token, accountId);
  console.log(JSON.stringify({
    ok: true,
    accountId,
    emailConfigured: true,
    passwordPersistedOnlyInRuntime: true,
    role: "employee",
    status: "active",
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
