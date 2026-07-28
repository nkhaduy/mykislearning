import { execFile, execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = resolve(new URL("..", import.meta.url).pathname);
const evidencePath = resolve(root, process.env.LOAD_EVIDENCE_PATH || "docs/audit-remediation/evidence/load-test-results.json");
const container = process.env.SUPABASE_DB_CONTAINER || "supabase_db_kis-lms-worker-supabase.tzteKG";
if (!/^supabase_db_kis-lms-worker-supabase\.[A-Za-z0-9_-]+$/.test(container)) {
  throw new Error("Refusing load test: database container is not the isolated KIS Supabase runtime");
}

const psqlArgs = ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "-X", "-v", "ON_ERROR_STOP=1", "-At"];
const runSql = (sql, maxBuffer = 32 * 1024 * 1024) => execFileSync("docker", [...psqlArgs, "-c", sql], { encoding: "utf8", maxBuffer }).trim();
const runSqlAsync = async (sql) => (await execFileAsync("docker", [...psqlArgs, "-c", sql], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 })).stdout.trim();

const cleanupSql = `
delete from public.learning_records where id like 'load-record-%';
delete from public.notifications where id like 'load-notification-%';
delete from public.audit_logs where id like 'load-audit-%';
delete from public.enrollments where id like 'load-enrollment-%';
delete from public.courses where id like 'load-course-%';
delete from public.profiles where id like 'load-profile-%';`;

const seedSql = `
${cleanupSql}
insert into public.profiles(id, employee_code, full_name, email, role, department, position, account_status, password_status, joined_date, notes)
select 'load-profile-' || lpad(g::text, 6, '0'), 'SYN-' || lpad(g::text, 6, '0'),
       'Synthetic Employee ' || lpad(g::text, 6, '0'), 'synthetic-' || g || '@example.invalid', 'employee',
       (array['IT','HR','Operations','Finance','Compliance','Sales','Research','Risk'])[1 + (g % 8)],
       (array['Associate','Specialist','Senior Specialist','Manager'])[1 + (g % 4)],
       case when g % 20 = 0 then 'inactive' else 'active' end, 'normal', date '2020-01-01' + (g % 2000),
       jsonb_build_object('synthetic_load_test', true)::text
from generate_series(1, 100000) g;

insert into public.courses(id, status, delivery_mode, created_by, data)
select 'load-course-' || lpad(g::text, 3, '0'), 'published', case when g % 3 = 0 then 'offline' else 'online' end,
       'load-profile-000001', jsonb_build_object('title', 'Synthetic Course ' || lpad(g::text, 3, '0'), 'category', 'Load test')
from generate_series(1, 100) g;

insert into public.enrollments(id, course_id, account_id, status, data)
select 'load-enrollment-' || g || '-' || n,
       'load-course-' || lpad((((g + n) % 100) + 1)::text, 3, '0'),
       'load-profile-' || lpad(g::text, 6, '0'),
       (array['notStarted','inProgress','completed','overdue'])[1 + ((g + n) % 4)],
       jsonb_build_object('progressPercent', ((g * n) % 101), 'deadline', (date '2026-08-01' + (g % 90))::text)
from generate_series(1, 10000) g cross join generate_series(1, 3) n;

insert into public.learning_records(id, account_id, record_type, source_type, source_id, title, duration_hours, status, data)
select 'load-record-' || g, 'load-profile-' || lpad((((g - 1) % 10000) + 1)::text, 6, '0'),
       'internal_online_course', 'system', null, 'Synthetic Learning Record ' || g, 1 + (g % 16),
       (array['approved','submitted','in_review','archived'])[1 + (g % 4)], jsonb_build_object('synthetic_load_test', true)
from generate_series(1, 20000) g;

insert into public.notifications(id, account_id, type, title, body, is_read, data)
select 'load-notification-' || g, 'load-profile-' || lpad((((g - 1) % 10000) + 1)::text, 6, '0'),
       'course', 'Synthetic Notification ' || g, 'Synthetic load-test notification', g % 3 = 0,
       jsonb_build_object('synthetic_load_test', true)
from generate_series(1, 30000) g;

insert into public.audit_logs(id, actor_id, action, target_type, target_id, result, details, actor_type, actor_role, category, severity, entity_type, entity_id, source, status, metadata)
select 'load-audit-' || g, 'load-profile-' || lpad((((g - 1) % 10000) + 1)::text, 6, '0'),
       'load_test.read', 'profile', 'load-profile-' || lpad((((g - 1) % 10000) + 1)::text, 6, '0'), 'success', '{}'::jsonb,
       'user', 'employee', 'report', 'info', 'profile', 'load-profile-' || lpad((((g - 1) % 10000) + 1)::text, 6, '0'), 'api', 'success', jsonb_build_object('synthetic_load_test', true)
from generate_series(1, 50000) g;
analyze public.profiles; analyze public.courses; analyze public.enrollments; analyze public.learning_records; analyze public.notifications; analyze public.audit_logs;`;

const queries = {
  employeeFirstPage: `select id, employee_code, full_name, email, role, department, position, account_status from public.profiles where id like 'load-profile-%' order by full_name, id limit 50`,
  employeeDeepPage: `select id, employee_code, full_name, email, role, department, position, account_status from public.profiles where id like 'load-profile-%' order by full_name, id offset 99950 limit 50`,
  employeeSearch: `select id, employee_code, full_name, email, department, account_status from public.profiles where id like 'load-profile-%' and (full_name ilike '%Employee 050000%' or email ilike '%Employee 050000%' or department ilike '%Employee 050000%' or employee_code ilike '%Employee 050000%') order by full_name, id limit 50`,
  employeeFilter: `select id, employee_code, full_name, email, department, account_status from public.profiles where id like 'load-profile-%' and department = 'IT' and account_status = 'active' order by full_name, id limit 50`,
  employeeRoleFilter: `select id, employee_code, full_name, email, role from public.profiles where id like 'load-profile-%' and role = 'employee' order by full_name, id limit 50`,
  reportSmall: `select p.department, count(*) employees from public.profiles p where p.id like 'load-profile-%' and p.department = 'IT' group by p.department`,
  reportLarge: `select p.department, count(distinct p.id) employees, count(e.id) assignments, count(e.id) filter (where e.status = 'completed') completed, round(100.0 * count(e.id) filter (where e.status = 'completed') / nullif(count(e.id), 0), 2) completion_rate from public.profiles p left join public.enrollments e on e.account_id = p.id where p.id like 'load-profile-%' group by p.department order by p.department`,
};

function explain(name, query) {
  const raw = runSql(`explain (analyze, buffers, format json) ${query}`);
  const parsed = JSON.parse(raw)[0];
  const nodes = [];
  const visit = (node) => {
    nodes.push({ nodeType: node["Node Type"], relation: node["Relation Name"] || null, index: node["Index Name"] || null, actualRows: node["Actual Rows"] });
    (node.Plans || []).forEach(visit);
  };
  visit(parsed.Plan);
  return { name, planningMs: parsed["Planning Time"], executionMs: parsed["Execution Time"], nodes, sharedHitBlocks: parsed.Plan["Shared Hit Blocks"] || 0, sharedReadBlocks: parsed.Plan["Shared Read Blocks"] || 0 };
}

function latencyDistribution(query, iterations = 30) {
  const escaped = query.replace(/'/g, "''");
  const raw = runSql(`create temp table load_timings(ms double precision); do $$ declare started timestamptz; i integer; begin for i in 1..${iterations} loop started := clock_timestamp(); execute '${escaped}'; insert into load_timings values (extract(epoch from clock_timestamp() - started) * 1000); end loop; end $$; select json_build_object('iterations', count(*), 'p50', percentile_cont(0.5) within group(order by ms), 'p95', percentile_cont(0.95) within group(order by ms), 'p99', percentile_cont(0.99) within group(order by ms), 'max', max(ms)) from load_timings;`);
  return JSON.parse(raw.split("\n").at(-1));
}

function memoryMiB() {
  const raw = execFileSync("docker", ["stats", "--no-stream", "--format", "{{.MemUsage}}", container], { encoding: "utf8" }).trim().split("/")[0].trim();
  const match = raw.match(/^([\d.]+)([KMG]iB)$/i);
  if (!match) return null;
  const value = Number(match[1]);
  return match[2].toLowerCase() === "gib" ? value * 1024 : match[2].toLowerCase() === "kib" ? value / 1024 : value;
}

function percentile(values, fraction) {
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.min(ordered.length - 1, Math.floor((ordered.length - 1) * fraction))] || 0;
}

async function concurrentQuery(query, concurrency = 8) {
  const baselineMemory = memoryMiB();
  let peakMemory = baselineMemory;
  const started = performance.now();
  const tasks = Array.from({ length: concurrency }, async () => {
    const requestStart = performance.now();
    try {
      await runSqlAsync(`copy (${query}) to stdout with csv header`);
      return { ok: true, ms: performance.now() - requestStart };
    } catch (error) {
      return { ok: false, ms: performance.now() - requestStart, error: String(error.message || error) };
    }
  });
  while (tasks.some(Boolean)) {
    const settled = await Promise.race([Promise.all(tasks), new Promise((resolvePromise) => setTimeout(() => resolvePromise(null), 20))]);
    peakMemory = Math.max(peakMemory || 0, memoryMiB() || 0);
    if (settled) {
      const latencies = settled.map((item) => item.ms);
      return { concurrency, wallMs: performance.now() - started, p50: percentile(latencies, 0.5), p95: percentile(latencies, 0.95), p99: percentile(latencies, 0.99), errorRate: settled.filter((item) => !item.ok).length / settled.length, baselineMemoryMiB: baselineMemory, peakMemoryMiB: peakMemory };
    }
  }
}

let evidence;
try {
  runSql(seedSql, 64 * 1024 * 1024);
  const counts = JSON.parse(runSql(`select json_build_object('profiles', count(*) filter (where id like 'load-profile-%'), 'courses', (select count(*) from public.courses where id like 'load-course-%'), 'enrollments', (select count(*) from public.enrollments where id like 'load-enrollment-%'), 'learningRecords', (select count(*) from public.learning_records where id like 'load-record-%'), 'notifications', (select count(*) from public.notifications where id like 'load-notification-%'), 'auditLogs', (select count(*) from public.audit_logs where id like 'load-audit-%')) from public.profiles;`));
  const plans = Object.entries(queries).map(([name, query]) => explain(name, query));
  const distributions = Object.fromEntries(Object.entries(queries).map(([name, query]) => [name, latencyDistribution(query)]));
  const pagePayloadBytes = Number(runSql(`select coalesce(sum(octet_length(row_to_json(x)::text)),0) from (${queries.employeeFirstPage}) x`));
  const exportPayloadBytes = Number(runSql(`select coalesce(sum(octet_length(row_to_json(x)::text)),0) from (select id, employee_code, full_name, email, department, position, account_status from public.profiles where id like 'load-profile-%' order by full_name, id) x`));
  const concurrent = await concurrentQuery(queries.reportLarge, 8);
  evidence = {
    generatedAt: new Date().toISOString(),
    environment: { runtime: "isolated local Supabase", postgres: runSql("show server_version"), container, productionMutation: false },
    findingIds: ["PERF-007", "OPS-004"],
    dataset: counts,
    distributions,
    plans,
    concurrency: concurrent,
    payloadBytes: { employeeFirstPage: pagePayloadBytes, employeeExport100k: exportPayloadBytes },
    limitations: ["Worker/HTTP serialization is not included in SQL timing.", "The current employee endpoint uses offset pagination; concurrent-insert stability remains unverified and keyset pagination is recommended.", "Leading-wildcard search cannot use the current btree indexes."],
  };
} finally {
  try { runSql(cleanupSql); } catch {}
}

mkdirSync(dirname(evidencePath), { recursive: true });
writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(`Ephemeral load evidence written to ${evidencePath}`);
console.log(JSON.stringify({ dataset: evidence.dataset, concurrency: evidence.concurrency, payloadBytes: evidence.payloadBytes }, null, 2));
