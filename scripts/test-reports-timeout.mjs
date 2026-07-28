import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../supabase/migrations/20260728103000_reporting_rpc.sql", import.meta.url), "utf8");
const reporting = readFileSync(new URL("../worker/services/reporting.js", import.meta.url), "utf8");
assert.match(sql, /set_config\('statement_timeout'/);
assert.match(sql, /pgrst\.db_pre_request/);
assert.match(sql, /service_report_pre_request[\s\S]*15000ms/);
assert.match(sql, /service_report_timeout_probe/);
assert.match(reporting, /REPORT_DB_TIMEOUT/);
assert.doesNotMatch(readFileSync(new URL("../worker/routes/reports.js", import.meta.url), "utf8"), /Promise\.race/);
console.log("PostgreSQL statement_timeout and timeout normalization are configured; no worker-only race timeout remains.");
