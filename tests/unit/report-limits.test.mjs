import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { parseReportFilters } from "../../worker/services/reporting.js";

test("REPORT-PERF-001: report date ranges and filter payloads are bounded", () => {
  assert.throws(() => parseReportFilters(new URL("https://lms.test/api/admin/reports/employees?from_date=2024-01-01&to_date=2026-01-02"), "employees"), /REPORT_RANGE_TOO_LARGE/);
  const filters = parseReportFilters(new URL(`https://lms.test/api/admin/reports/employees?from_date=2026-01-01&to_date=2026-12-31&q=${"x".repeat(200)}&department=${"d".repeat(200)}&pageSize=999`), "employees");
  assert.equal(filters.q.length, 80);
  assert.equal(filters.department.length, 120);
  assert.equal(filters.pageSize, 100);
});

test("REPORT-PERF-002: synchronous exports are capped and large employee CSV uses background jobs", () => {
  const reporting = readFileSync(new URL("../../worker/services/reporting.js", import.meta.url), "utf8");
  const route = readFileSync(new URL("../../worker/routes/report-exports.js", import.meta.url), "utf8");
  assert.match(reporting, /SYNCHRONOUS_EXPORT_ROW_LIMIT = 2000/);
  assert.match(reporting, /ASYNC_EXPORT_REQUIRED/);
  assert.match(route, /ASYNC_EXPORT_TYPE_UNSUPPORTED|createExportJob/);
});

test("REPORT-PERF-003: report requests have a timeout and generic client errors", () => {
  const route = readFileSync(new URL("../../worker/routes/reports.js", import.meta.url), "utf8");
  const reporting = readFileSync(new URL("../../worker/services/reporting.js", import.meta.url), "utf8");
  const migration = readFileSync(new URL("../../supabase/migrations/20260728103000_reporting_rpc.sql", import.meta.url), "utf8");
  assert.doesNotMatch(route, /Promise\.race/);
  assert.match(reporting, /REPORT_DB_TIMEOUT/);
  assert.match(reporting, /overviewTimeoutMs: 8000/);
  assert.match(migration, /set_config\('statement_timeout'/);
  assert.match(migration, /service_report_timeout_probe/);
  assert.match(route, /REPORT_QUERY_FAILED/);
});

test("REPORT-RECOVERY-001: forward fix keeps overview compatible with legacy enrollments", () => {
  const migration = readFileSync(new URL("../../supabase/migrations/20260729121500_fix_reporting_rpc_enrollment_compatibility.sql", import.meta.url), "utf8");
  assert.match(migration, /create or replace function public\.service_report_overview/);
  assert.match(migration, /select e\.id, e\.account_id, e\.course_id, e\.status, e\.updated_at,/);
  assert.doesNotMatch(migration, /select e\.id, e\.account_id, e\.course_id, e\.status, e\.created_at/);
  assert.doesNotMatch(migration, /\b(drop|delete|truncate)\b/i);
});
