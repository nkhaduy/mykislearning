import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_RUNTIME_FILE, ROOT, readJson, run } from "./staging-ops.mjs";
import { verifyStagingTarget } from "./staging-contract.mjs";

const runtimePath = process.env.KIS_STAGING_RUNTIME_FILE || DEFAULT_RUNTIME_FILE;
const runtime = readJson(runtimePath);
if (!runtime) throw new Error("staging runtime is missing");
verifyStagingTarget(runtime.contract);
const evidenceDir = resolve(ROOT, "docs/audit-remediation/evidence/staging-rehearsal", runtime.executionId);
mkdirSync(evidenceDir, { recursive: true });
const databaseUrl = runtime.supabase.databaseUrl;

function capture(name, command, args, allowFailure = false) {
  const result = run(command, args, { allowFailure });
  writeFileSync(resolve(evidenceDir, `${name}.txt`), result.stdout + result.stderr);
  return { name, status: result.status, captured: true };
}

const captures = [];
captures.push(capture("migration-history", "supabase", ["migration", "list", "--db-url", databaseUrl]));
for (const inspection of ["db-stats", "table-stats", "index-stats", "locks", "long-running-queries", "role-stats"]) {
  captures.push(capture(`inspect-${inspection}`, "supabase", ["inspect", "db", inspection, "--db-url", databaseUrl], true));
}
captures.push(capture("database-advisors", "supabase", ["db", "advisors", "--db-url", databaseUrl, "--type", "all", "--level", "warn", "--fail-on", "none"], true));
captures.push(capture("catalog-snapshot", "supabase", ["db", "query", "--db-url", databaseUrl, "--file", "scripts/db-catalog-snapshot.sql", "--output", "json"]));

const inventorySql = `
select jsonb_build_object(
  'postgres_version', version(),
  'database_size_bytes', pg_database_size(current_database()),
  'table_count', (select count(*) from information_schema.tables where table_schema in ('public','private')),
  'view_count', (select count(*) from information_schema.views where table_schema in ('public','private')),
  'function_count', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private')),
  'trigger_count', (select count(*) from information_schema.triggers where trigger_schema in ('public','private')),
  'invalid_indexes', (select count(*) from pg_index where not indisvalid),
  'rls_tables', (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relrowsecurity),
  'extensions', (select jsonb_agg(extname order by extname) from pg_extension),
  'lock_waits', (select count(*) from pg_stat_activity where wait_event_type='Lock'),
  'long_transactions', (select count(*) from pg_stat_activity where xact_start < now() - interval '30 seconds')
);
`;
captures.push(capture("inventory-summary", "supabase", ["db", "query", "--db-url", databaseUrl, inventorySql, "--output", "json"]));

const headers = { apikey: runtime.secrets.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${runtime.secrets.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" };
const probeStart = Date.now();
const probe = await fetch(`${runtime.supabase.url}/rest/v1/rpc/service_report_timeout_probe`, { method: "POST", headers, body: JSON.stringify({ p_sleep_seconds: 1, p_timeout_ms: 100 }) });
const probeDurationMs = Date.now() - probeStart;
const overview = await fetch(`${runtime.supabase.url}/rest/v1/rpc/service_report_overview`, { method: "POST", headers, body: JSON.stringify({ p_from: new Date(Date.now() - 86400000).toISOString(), p_to: new Date().toISOString(), p_department: "", p_job_title: "", p_status: "", p_search: "", p_group_limit: 10, p_timeout_ms: 8000 }) });
const timeoutEvidence = { probeStatus: probe.status, probeDurationMs, databaseCancelled: !probe.ok && probeDurationMs < 1000, connectionReuseStatus: overview.status, connectionReusable: overview.ok };
writeFileSync(resolve(evidenceDir, "postgrest-timeout.json"), `${JSON.stringify(timeoutEvidence, null, 2)}\n`);

const summary = { capturedAt: new Date().toISOString(), target: verifyStagingTarget(runtime.contract), evidenceDir, captures, postgrestTimeout: timeoutEvidence };
writeFileSync(resolve(evidenceDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify({ evidenceDir, captureCount: captures.length, postgrestTimeout: timeoutEvidence }, null, 2));
if (!timeoutEvidence.databaseCancelled || !timeoutEvidence.connectionReusable) process.exit(2);
