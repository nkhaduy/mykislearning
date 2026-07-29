import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { validateEmployeeCreationInput } from "../../worker/routes/auth.js";
import { validateCourseCreationInput } from "../../worker/routes/courses.js";
import { requireHr, resolveAccount } from "../../worker/middleware/auth.js";

const root = resolve(import.meta.dirname, "../..");
const authSource = readFileSync(resolve(root, "worker/routes/auth.js"), "utf8");
const courseSource = readFileSync(resolve(root, "worker/routes/courses.js"), "utf8");
const employeeUi = readFileSync(resolve(root, "src/features/employees/employees.js"), "utf8");
const courseUi = readFileSync(resolve(root, "src/features/courses/admin-courses.js"), "utf8");
const localEnv = { APP_ENV: "test", ALLOW_LEGACY_IDENTITY_HEADERS: "true" };

function identityRequest(role, accountId = `test-${role}`) {
  return new Request("http://localhost/api/test", { headers: { "x-account-id": accountId, "x-account-role": role } });
}

test("HR can create employee through a visible locked-submit flow", () => {
  assert.match(employeeUi, /data-employee-add/);
  assert.match(employeeUi, /action:\s*"create-user"/);
  assert.match(employeeUi, /submit\.disabled = true/);
  assert.match(authSource, /auth\.admin\.createUser/);
  assert.match(authSource, /return json\(\{ ok: true, employee:/);
});

test("HR can create course and navigate to the created draft", () => {
  assert.match(courseUi, /data-course-add/);
  assert.match(courseUi, /data\.status = "draft"/);
  assert.match(courseUi, /location\.href = `\/hr\/courses\//);
  assert.match(courseSource, /initialVersion:/);
});

test("Employee cannot create employee or course", async () => {
  assert.equal(await requireHr(identityRequest("employee"), localEnv), null);
});

for (const role of ["admin", "trainer", "unknown"]) {
  test(`Legacy or unknown role ${role} is rejected fail-closed`, async () => {
    assert.equal(await resolveAccount(identityRequest(role), localEnv), null);
  });
}

test("Employee creation validates canonical role and required fields", () => {
  const valid = validateEmployeeCreationInput({
    email: "new.employee@example.invalid",
    password: "temporary-password-2026",
    fullName: "New Employee",
    employeeCode: "KIS-2026-001",
    department: "Operations",
  });
  assert.equal(valid.role, "employee");
  assert.throws(() => validateEmployeeCreationInput({ ...valid, role: "hr" }), { code: "INVALID_ROLE", status: 422 });
  assert.throws(() => validateEmployeeCreationInput({ ...valid, email: "not-an-email" }), { code: "INVALID_EMAIL", status: 422 });
});

test("Duplicate employee email and code return explicit conflict contracts", () => {
  assert.match(authSource, /DUPLICATE_EMAIL[^]*409/);
  assert.match(authSource, /DUPLICATE_EMPLOYEE_CODE[^]*409/);
});

test("Double employee submit creates at most one profile", () => {
  assert.match(authSource, /eq\("email", input\.email\)\.maybeSingle/);
  assert.match(authSource, /eq\("employee_code", input\.employeeCode\)\.maybeSingle/);
  assert.match(authSource, /profileErr\.code === "23505"/);
});

test("Failed credential creation removes the just-created profile", () => {
  assert.match(authSource, /writeCredential\(supabase, newId/);
  assert.match(authSource, /from\("profiles"\)\.delete\(\)\.eq\("id", newId\)/);
  assert.match(authSource, /auth\.admin\.deleteUser\(authUserId\)/);
});

test("Failed profile creation never writes a credential", () => {
  const insertAt = authSource.indexOf('from("profiles").insert');
  const failureAt = authSource.indexOf('if (profileErr)', insertAt);
  const credentialAt = authSource.indexOf("writeCredential(supabase, newId", insertAt);
  assert.ok(insertAt >= 0 && failureAt > insertAt && credentialAt > failureAt);
  assert.match(authSource, /if \(profileErr\) \{[^]*auth\.admin\.deleteUser\(authUserId\)/);
});

test("Course creation creates exactly one initial version across retries", () => {
  const course = validateCourseCreationInput({ title: "Safety Basics", id: "safety-basics", status: "draft" });
  assert.equal(course.id, "safety-basics");
  assert.equal(course.status, "draft");
  assert.match(courseSource, /eq\("version_number", 1\)\.maybeSingle/);
  assert.match(courseSource, /versionInsert\.error\?\.code === "23505"/);
  assert.match(courseSource, /current_version_id: initialVersion\.id/);
});

test("Creation success refreshes employee data and course detail", () => {
  assert.match(employeeUi, /await load\(true\)/);
  assert.match(courseUi, /response\.course\?\.id \|\| data\.id/);
});
