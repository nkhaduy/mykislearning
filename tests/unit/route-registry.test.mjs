import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { ROUTE_DEFINITIONS, getNavigationGroups, matchRoute } from "../../src/app/route-registry.js";
import { isKnownAppRoute } from "../../worker/services/route-policy.js";

const root = new URL("../../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("UX-001: every implemented route is classified and reachable or intentionally hidden", () => {
  const allowed = new Set(["nav", "detail", "hidden", "redirect"]);
  for (const route of ROUTE_DEFINITIONS) {
    assert.ok(allowed.has(route.classification), `${route.path || route.pattern} must be classified`);
    assert.ok(route.roles?.length, `${route.path || route.pattern} must define role visibility`);
    if (["detail", "redirect"].includes(route.classification)) {
      assert.ok(route.parent, `${route.path || route.pattern} must define a parent`);
      const parent = matchRoute(route.parent);
      assert.ok(parent, `${route.path || route.pattern} parent must exist`);
      assert.equal(parent.classification, "nav", `${route.path || route.pattern} parent must be navigable`);
    }
    if (route.path) assert.equal(isKnownAppRoute(route.path), true, `${route.path} must be in the Worker route policy`);
  }
});

test("UX-001: learner and HR navigation are role-aware with no duplicate destinations", () => {
  for (const role of ["employee", "hr"]) {
    const items = getNavigationGroups(role, "vi").flatMap((group) => group.items);
    assert.equal(items.length, new Set(items.map((item) => item.path)).size, `${role} navigation must not duplicate routes`);
    assert.ok(items.every((item) => item.roles.includes(role)), `${role} must only see allowed routes`);
  }
  const employeePaths = new Set(getNavigationGroups("employee", "vi").flatMap((group) => group.items.map((item) => item.path)));
  const hrPaths = new Set(getNavigationGroups("hr", "vi").flatMap((group) => group.items.map((item) => item.path)));
  assert.ok(employeePaths.has("/dashboard/resources"));
  assert.ok(employeePaths.has("/dashboard/calendar"));
  assert.ok(hrPaths.has("/hr/competencies"));
  assert.ok(hrPaths.has("/hr/learning-records"));
  assert.ok([...employeePaths].every((path) => !path.startsWith("/hr")));
  assert.ok([...hrPaths].every((path) => !path.startsWith("/dashboard")));
});

test("PERF-005: learner, HR, employee and reporting entries do not import the application monolith", () => {
  const routeAssets = read("src/app/route-assets.js");
  assert.match(routeAssets, /learner:\s*\(\)\s*=>\s*import\("\.\.\/features\/learner\/dashboard\.js"\)/);
  assert.match(routeAssets, /learnerCourses:\s*\(\)\s*=>\s*import\("\.\.\/features\/learner\/courses\.js"\)/);
  assert.match(routeAssets, /admin:\s*\(\)\s*=>\s*import\("\.\.\/features\/admin\/dashboard\.js"\)/);
  assert.match(routeAssets, /employees:\s*\(\)\s*=>\s*import\("\.\.\/features\/employees\/employees\.js(?:\?[^"']+)?"\)/);
  assert.match(routeAssets, /reporting:\s*\(\)\s*=>\s*import\("\.\.\/features\/reporting\/reports\.js"\)/);
  for (const path of ["src/features/learner/dashboard.js", "src/features/learner/courses.js", "src/features/admin/dashboard.js", "src/features/employees/employees.js", "src/features/reporting/reports.js"]) {
    const source = read(path);
    assert.doesNotMatch(source, /app\.js|mockDatabase|excelImportService|qrAttendanceService|jsqr|qrcode|xlsx\.full/);
  }
});
