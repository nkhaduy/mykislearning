import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createPaginationCursor, readPaginationCursor } from "../../worker/services/pagination-cursor.js";
import { employeeListParameters, employeeSearchOnlineEnabled } from "../../worker/routes/employees.js";

const env = { JWT_SECRET: "employee-cursor-test-secret-at-least-32-characters" };
const filters = { search: "nguyen", department: "IT", status: "active", direction: "asc", pageSize: 50 };

test("PERF-EMP-001: employee list input is bounded and never creates an empty wildcard query", () => {
  const url = new URL("https://lms.test/api/employees?search=%20%20%20&pageSize=999&direction=sideways");
  const params = employeeListParameters(url);
  assert.equal(params.search, "");
  assert.equal(params.pageSize, 100);
  assert.equal(params.direction, "asc");

  const noisy = employeeListParameters(new URL(`https://lms.test/api/employees?search=${encodeURIComponent("Nguyễn $$$ Văn A".repeat(20))}&pageSize=1`));
  assert.ok(noisy.search.length <= 80);
  assert.doesNotMatch(noisy.search, /\$/);
  assert.equal(noisy.pageSize, 10);
});

test("PERF-EMP-002: employee cursors are requester- and filter-bound", async () => {
  const token = await createPaginationCursor(env, {
    requesterId: "hr-1",
    scope: "employee-list-v1",
    filters,
    position: { name: "nguyen van a", id: "employee-10" },
  });
  assert.ok(token.length > 40);
  assert.deepEqual(await readPaginationCursor(env, token, {
    requesterId: "hr-1",
    scope: "employee-list-v1",
    filters,
  }), { name: "nguyen van a", id: "employee-10" });
  await assert.rejects(() => readPaginationCursor(env, token, {
    requesterId: "hr-2",
    scope: "employee-list-v1",
    filters,
  }), /Invalid cursor/);
  await assert.rejects(() => readPaginationCursor(env, token, {
    requesterId: "hr-1",
    scope: "employee-list-v1",
    filters: { ...filters, department: "Finance" },
  }), /does not match/);
});

test("PERF-EMP-003: search migration uses trigram search, stable keyset ordering, and private RPC grants", () => {
  const source = readFileSync(new URL("../../supabase/migrations/20260728031000_employee_search_cursor.sql", import.meta.url), "utf8");
  const indexes = readFileSync(new URL("../../scripts/search-rollout/create-indexes-concurrently.sql", import.meta.url), "utf8");
  assert.match(source, /create extension if not exists pg_trgm/i);
  assert.match(indexes, /create index concurrently[\s\S]*profiles_search_document_trgm_idx[\s\S]*using gin/i);
  assert.match(source, /add column if not exists employee_search_document text/i);
  assert.match(source, /profiles_search_fields_write/i);
  assert.match(source, /coalesce\(p\.employee_sort_name[\s\S]*p\.id::text/i);
  assert.match(source, /revoke all on function public\.service_search_profiles[\s\S]*anon, authenticated/i);
  assert.match(source, /grant execute on function public\.service_search_profiles[\s\S]*service_role/i);
});

test("ARCH-ROUTE-003: employee management has an independent entry with no legacy monolith dependencies", () => {
  const root = new URL("../../", import.meta.url);
  const registry = readFileSync(new URL("src/app/route-registry.js", root), "utf8");
  const bootstrap = readFileSync(new URL("src/app/bootstrap.js", root), "utf8");
  const feature = readFileSync(new URL("src/features/employees/employees.js", root), "utf8");
  assert.match(registry, /path: "\/admin\/employees"[^\n]*splitEntry: "employees"/);
  assert.match(bootstrap, /employees:\s*\(\)\s*=>\s*import\("\.\.\/features\/employees\/employees\.js"\)/);
  assert.doesNotMatch(feature, /app\.js|mockDatabase|employeeService|xlsx\.full|jsqr|qrcode|window\._(?!_)/);
  assert.match(feature, /AbortController/);
});

test("PERF-EMP-004: staging search cutover is reversible without changing production defaults", () => {
  assert.equal(employeeSearchOnlineEnabled({ APP_ENV: "staging", SEARCH_ROLLOUT_ENABLED: "false" }), false);
  assert.equal(employeeSearchOnlineEnabled({ APP_ENV: "staging", SEARCH_ROLLOUT_ENABLED: "true" }), true);
  assert.equal(employeeSearchOnlineEnabled({ APP_ENV: "production" }), true);
});
