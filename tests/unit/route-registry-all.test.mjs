import test from "node:test";
import assert from "node:assert/strict";

import { ROUTE_DEFINITIONS, matchRoute } from "../../src/app/route-registry.js";

const secondaryPaths = [
  "/training", "/change-password", "/dashboard/learning-paths", "/dashboard/gallery", "/dashboard/resources",
  "/dashboard/calendar", "/dashboard/learning-history", "/dashboard/history", "/dashboard/compliance", "/dashboard/skills",
  "/dashboard/development-plan", "/dashboard/notifications", "/hr/assign", "/hr/learning-paths", "/hr/sessions",
  "/hr/training-tracking", "/hr/cchn-registrations", "/hr/accounts", "/hr/competencies", "/hr/skills-matrix",
  "/hr/development-plans", "/hr/retraining", "/hr/compliance", "/hr/certificates", "/hr/certifications",
  "/hr/gallery", "/hr/notifications", "/hr/audit-log",
];

const dynamicCases = [
  ["/join/:token", "/join/abc_123", "token", "abc_123"],
  ["/dashboard/courses/:id", "/dashboard/courses/course-1", "id", "course-1"],
  ["/dashboard/learning-paths/:id", "/dashboard/learning-paths/path-1", "id", "path-1"],
  ["/dashboard/gallery/:id", "/dashboard/gallery/album-1", "id", "album-1"],
  ["/dashboard/compliance/:id", "/dashboard/compliance/cycle-1", "id", "cycle-1"],
  ["/dashboard/development-plan/:id", "/dashboard/development-plan/plan-1", "id", "plan-1"],
  ["/hr/courses/:id", "/hr/courses/course-1", "id", "course-1"],
  ["/hr/learning-paths/:id", "/hr/learning-paths/path-1", "id", "path-1"],
  ["/hr/compliance/cycles/:id", "/hr/compliance/cycles/cycle-1", "id", "cycle-1"],
];

test("ROUTE-ALL-001: every secondary route has an explicit split entry", () => {
  for (const path of secondaryPaths) {
    const route = ROUTE_DEFINITIONS.find((candidate) => candidate.path === path);
    assert.ok(route, `missing route definition: ${path}`);
    assert.ok(route.splitEntry, `missing split entry: ${path}`);
    assert.ok(matchRoute(path), `route does not match: ${path}`);
  }
});

test("ROUTE-ALL-002: dynamic routes decode safe identifiers and preserve route specificity", () => {
  for (const [pattern, path, key, value] of dynamicCases) {
    const route = matchRoute(path);
    assert.equal(route?.pattern, pattern);
    assert.equal(route.params[key], value);
  }
  assert.equal(matchRoute("/hr/courses/course-1")?.pattern, "/hr/courses/:id");
  assert.equal(matchRoute("/hr/compliance/cycles/cycle-1")?.pattern, "/hr/compliance/cycles/:id");
});

test("ROUTE-ALL-003: malformed IDs and traversal attempts are rejected", () => {
  for (const path of [
    "/hr/courses/%2Fetc%2Fpasswd", "/hr/courses/..", "/hr/courses/%2e%2e", "/hr/courses/a%5Cb",
    "/hr/courses/%00", "/hr/courses/a%2Fb", `/hr/courses/${"x".repeat(129)}`,
  ]) assert.equal(matchRoute(path), null, path);
});

test("ROUTE-ALL-004: aliases are explicit redirects instead of broad feature matches", () => {
  assert.equal(matchRoute("/dashboard/history")?.redirectTo, "/dashboard/learning-history");
  assert.equal(matchRoute("/hr/certifications")?.redirectTo, "/hr/certificates");
  assert.equal(matchRoute("/hr/courses/course-1")?.path, undefined);
});
