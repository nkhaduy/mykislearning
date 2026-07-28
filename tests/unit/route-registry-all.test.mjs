import test from "node:test";
import assert from "node:assert/strict";

import { ROUTE_DEFINITIONS, matchRoute } from "../../src/app/route-registry.js";

const secondaryPaths = [
  "/training", "/change-password", "/dashboard/learning-paths", "/dashboard/gallery", "/dashboard/resources",
  "/dashboard/calendar", "/dashboard/learning-history", "/dashboard/history", "/dashboard/compliance", "/dashboard/skills",
  "/dashboard/development-plan", "/dashboard/notifications", "/admin/assign", "/admin/learning-paths", "/admin/sessions",
  "/admin/training-tracking", "/admin/cchn-registrations", "/admin/accounts", "/admin/competencies", "/admin/skills-matrix",
  "/admin/development-plans", "/admin/retraining", "/admin/compliance", "/admin/certificates", "/admin/certifications",
  "/admin/gallery", "/admin/notifications", "/admin/audit-log",
];

const dynamicCases = [
  ["/join/:token", "/join/abc_123", "token", "abc_123"],
  ["/dashboard/courses/:id", "/dashboard/courses/course-1", "id", "course-1"],
  ["/dashboard/learning-paths/:id", "/dashboard/learning-paths/path-1", "id", "path-1"],
  ["/dashboard/gallery/:id", "/dashboard/gallery/album-1", "id", "album-1"],
  ["/dashboard/compliance/:id", "/dashboard/compliance/cycle-1", "id", "cycle-1"],
  ["/dashboard/development-plan/:id", "/dashboard/development-plan/plan-1", "id", "plan-1"],
  ["/admin/courses/:id", "/admin/courses/course-1", "id", "course-1"],
  ["/admin/learning-paths/:id", "/admin/learning-paths/path-1", "id", "path-1"],
  ["/admin/compliance/cycles/:id", "/admin/compliance/cycles/cycle-1", "id", "cycle-1"],
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
  assert.equal(matchRoute("/admin/courses/course-1")?.pattern, "/admin/courses/:id");
  assert.equal(matchRoute("/admin/compliance/cycles/cycle-1")?.pattern, "/admin/compliance/cycles/:id");
});

test("ROUTE-ALL-003: malformed IDs and traversal attempts are rejected", () => {
  for (const path of [
    "/admin/courses/%2Fetc%2Fpasswd", "/admin/courses/..", "/admin/courses/%2e%2e", "/admin/courses/a%5Cb",
    "/admin/courses/%00", "/admin/courses/a%2Fb", `/admin/courses/${"x".repeat(129)}`,
  ]) assert.equal(matchRoute(path), null, path);
});

test("ROUTE-ALL-004: aliases are explicit redirects instead of broad feature matches", () => {
  assert.equal(matchRoute("/dashboard/history")?.redirectTo, "/dashboard/learning-history");
  assert.equal(matchRoute("/admin/certifications")?.redirectTo, "/admin/certificates");
  assert.equal(matchRoute("/admin/courses/course-1")?.path, undefined);
});
