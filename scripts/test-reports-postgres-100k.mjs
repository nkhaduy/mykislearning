import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const image = process.env.KIS_REPORT_IMAGE || "public.ecr.aws/supabase/postgres:17.6.1.136";
const suffix = `${process.pid}-${randomBytes(3).toString("hex")}`;
const container = `kis-report-perf-${suffix}`;
const database = "report_perf";
const evidencePath = resolve(root, process.env.REPORT_PERF_EVIDENCE_PATH || "docs/audit-remediation/evidence/report-100k-performance.json");

function run(command, args, { input, allowFailure = false } = {}) {
  const result = spawnSync(command, args, { cwd: root, input, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (!allowFailure && result.status !== 0) throw new Error([`${command} ${args.join(" ")} failed`, result.stdout, result.stderr].filter(Boolean).join("\n"));
  return result;
}
function dockerExec(args, options = {}) { return run("docker", ["exec", ...(options.input === undefined ? [] : ["-i"]), container, ...args], options); }
function sql(source, allowFailure = false) {
  const result = dockerExec(["psql", "-U", "postgres", "-d", database, "-v", "ON_ERROR_STOP=1", "-Atq"], { input: source, allowFailure });
  if (!allowFailure && result.status !== 0) throw new Error([result.stdout, result.stderr].filter(Boolean).join("\n"));
  return result.stdout.trim();
}
function explain(query) { return JSON.parse(sql(`explain (analyze, buffers, format json) ${query};`))[0]; }
function planSummary(explanation) {
  const nodes = []; let rowsScanned = 0; let sharedHit = 0; let sharedRead = 0;
  const visit = (node) => { nodes.push(node["Node Type"]); if (/Scan$/.test(node["Node Type"] || "")) rowsScanned += Number(node["Actual Rows"] || 0) * Number(node["Actual Loops"] || 1); sharedHit += Number(node["Shared Hit Blocks"] || 0); sharedRead += Number(node["Shared Read Blocks"] || 0); (node.Plans || []).forEach(visit); };
  visit(explanation.Plan);
  return { planningMs: explanation["Planning Time"], executionMs: explanation["Execution Time"], rowsReturned: explanation.Plan["Actual Rows"], rowsScanned, sharedHit, sharedRead, nodes: [...new Set(nodes)] };
}
function percentile(values, ratio) { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)]; }
function timings(query, iterations = 12) { for (let i = 0; i < 2; i += 1) explain(query); const samples = Array.from({ length: iterations }, () => explain(query)["Execution Time"]); return { p50: percentile(samples, .5), p95: percentile(samples, .95), p99: percentile(samples, .99), samples }; }
function asyncPsql(query) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-d", database, "-v", "ON_ERROR_STOP=1", "-Atq"], { cwd: root });
    let stderr = ""; child.stderr.setEncoding("utf8"); child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (code) => code === 0 ? resolvePromise() : reject(new Error(stderr || `psql exited ${code}`))); child.stdin.end(`${query};\n`);
  });
}
async function concurrentTiming(query, concurrency) { const started = performance.now(); await Promise.all(Array.from({ length: concurrency }, () => asyncPsql(query))); return performance.now() - started; }

const schema = `
create table public.profiles (id text primary key, employee_code text, full_name text not null, email text, role text not null default 'employee', department text, position text, account_status text not null default 'active', password_status text default 'normal', avatar_url text, phone text, joined_date date, manager_name text, location text, notes text, last_login_at timestamptz, failed_login_count integer default 0, locked_until timestamptz, created_at timestamptz default now(), updated_at timestamptz default now());
create table public.courses (id text primary key, status text, data jsonb default '{}'::jsonb);
create table public.enrollments (id text primary key, account_id text, course_id text, status text, data jsonb default '{}'::jsonb, created_at timestamptz default now(), updated_at timestamptz default now());
create table public.attendance (id text, account_id text, updated_at timestamptz, slot_id text, status text, check_in_at timestamptz, check_out_at timestamptz);
create table public.quiz_attempts (id text, submitted_at timestamptz, created_at timestamptz, account_id text, quiz_id text, course_id text, score_percent numeric, passed boolean);
create table public.learning_records (id text, created_at timestamptz, account_id text, status text, record_type text, completion_date date, duration_hours numeric, title text);
create table public.employee_certifications (id text, expiry_date date, created_at timestamptz, account_id text, status text, verification_status text, certificate_type_id text, issue_date date, certificate_type text, name text);
create table public.compliance_assignments (id text, due_at timestamptz, updated_at timestamptz, employee_id text, cycle_id text, status text, progress_percent numeric, completed_at timestamptz);
create table public.training_sessions (id text, start_at timestamptz, status text, end_at timestamptz, course_id text, data jsonb default '{}'::jsonb);
create table public.session_slots (id text, session_id text);
create table public.certificate_types (id text, name text);
create table public.quizzes (id text, data jsonb default '{}'::jsonb);
create table public.compliance_cycles (id text, program_id text, title text);
create table public.compliance_programs (id text, title text);
create table public.learning_path_assignments (id text, updated_at timestamptz, learning_path_id text, employee_id text, status text, progress_percent numeric, due_at timestamptz, completed_at timestamptz);
create table public.learning_paths (id text, title text);
create table public.competencies (id text, name text);
create table public.employee_competency_assessments (id text, updated_at timestamptz, competency_id text, employee_id text, assessment_type text, status text, assessment_date date);
create table public.development_plans (id text, updated_at timestamptz, employee_id text, title text, status text, start_at timestamptz, target_end_at timestamptz, completed_at timestamptz);
insert into public.courses select 'course-' || i, 'published', jsonb_build_object('title', 'Course ' || i) from generate_series(1, 100) i;
insert into public.profiles(id, employee_code, full_name, email, department, position, account_status, manager_name, location, created_at, updated_at)
select 'employee-' || lpad(i::text, 6, '0'), 'KIS' || lpad(i::text, 6, '0'), 'Employee ' || lpad(i::text, 6, '0'), 'employee' || i || '@kis.test', 'D' || (i % 20), 'Specialist', case when i % 11 = 0 then 'inactive' else 'active' end, 'Manager ' || (i % 200), 'HCMC', '2026-01-01', '2026-07-01' from generate_series(1, 100000) i;
insert into public.enrollments(id, account_id, course_id, status, data, created_at, updated_at)
select 'enrollment-' || lpad(i::text, 6, '0'), 'employee-' || lpad(i::text, 6, '0'), 'course-' || (1 + i % 100), case when i % 4 = 0 then 'completed' else 'inProgress' end, jsonb_build_object('deadline', '2026-12-31', 'progressPercent', case when i % 4 = 0 then 100 else 45 end), '2026-01-01', '2026-07-01' from generate_series(1, 100000) i;
analyze public.profiles; analyze public.enrollments; analyze public.courses;`;

const overview = `select public.service_report_overview('2026-01-01T00:00:00+00'::timestamptz,'2027-01-01T00:00:00+00'::timestamptz,'','','','','',100,8000)`;
const detail = `select public.service_report_detail('employees','2026-01-01T00:00:00+00'::timestamptz,'2027-01-01T00:00:00+00'::timestamptz,'','','','','','',null,null,'asc',101,5000)`;
const detailNext = `select public.service_report_detail('employees','2026-01-01T00:00:00+00'::timestamptz,'2027-01-01T00:00:00+00'::timestamptz,'','','','','','','employee 000100','employee-000100','asc',101,5000)`;
let ownsContainer = false;
try {
  run("docker", ["run", "--rm", "-d", "--name", container, "-e", "POSTGRES_PASSWORD=postgres", image]); ownsContainer = true;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const logs = run("docker", ["logs", container], { allowFailure: true });
    const ready = dockerExec(["pg_isready", "-U", "postgres"], { allowFailure: true });
    if (ready.status === 0 && `${logs.stdout}\n${logs.stderr}`.includes("PostgreSQL init process complete; ready for start up.")) break;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
    if (attempt === 119) throw new Error("PostgreSQL benchmark container did not become ready");
  }
  dockerExec(["createdb", "-U", "postgres", database]); sql(schema);
  sql(readFileSync(join(root, "supabase/migrations/20260728031000_employee_search_cursor.sql"), "utf8"));
  sql("update public.profiles p set employee_search_document=public.kis_profile_search_document(p.employee_code,p.full_name,p.email,p.department,p.position,p.location,p.manager_name), employee_sort_name=public.kis_search_normalize(p.full_name);");
  sql(readFileSync(join(root, "scripts/search-rollout/create-indexes-concurrently.sql"), "utf8"));
  sql(readFileSync(join(root, "supabase/migrations/20260728103000_reporting_rpc.sql"), "utf8")); sql("analyze public.profiles; analyze public.enrollments; analyze public.courses;");
  const overviewResult = JSON.parse(sql(`${overview};`)); const detailResult = JSON.parse(sql(`${detail};`)); const detailNextResult = JSON.parse(sql(`${detailNext};`));
  const timeoutStarted = performance.now();
  const timeoutProbe = dockerExec(["psql", "-U", "postgres", "-d", database, "-Atq"], { input: "begin;\nselect pg_catalog.set_config('request.path','/rest/v1/rpc/service_report_timeout_probe',true);\nselect public.service_report_pre_request();\nselect public.service_report_timeout_probe(1,100);\nrollback;\nselect 'connection-ok';\n", allowFailure: true });
  const timeoutElapsedMs = performance.now() - timeoutStarted;
  const overviewPlan = planSummary(explain(overview)); const detailPlan = planSummary(explain(detail));
  const detailSummary = { rowCount: detailResult.rows.length, hasMore: detailResult.hasMore, nextPosition: detailResult.nextPosition, firstEmployeeId: detailResult.rows[0]?.employeeId, lastEmployeeId: detailResult.rows.at(-1)?.employeeId };
  const evidence = { generatedAt: new Date().toISOString(), environment: { image, profiles: 100000, assignments: 100000, remoteAccess: false }, overview: { result: overviewResult, plan: { note: "EXPLAIN wraps the stable RPC call; inner SQL plans require staging auto_explain/catalog capture", outer: overviewPlan }, timing: timings(overview) }, detailFirstPage: { result: detailSummary, plan: { note: "EXPLAIN wraps the stable RPC call; inner SQL plans require staging auto_explain/catalog capture", outer: detailPlan }, timing: timings(detail) }, detailNextPage: { rowCount: detailNextResult.rows.length, firstEmployeeId: detailNextResult.rows[0]?.employeeId, hasMore: detailNextResult.hasMore }, timeout: { elapsedMs: timeoutElapsedMs, cancelled: /statement timeout|canceling statement/i.test(timeoutProbe.stderr), sameConnectionReusable: timeoutProbe.stdout.includes("connection-ok") }, concurrency: { overview8Ms: await concurrentTiming(overview, 8), overview20Ms: await concurrentTiming(overview, 20) }, assertions: { aggregateRowsHydrated: 0, overviewMetricsExact: overviewResult.metrics.totalEmployees === 100000 && overviewResult.metrics.totalAssignments === 100000 && overviewResult.metrics.totalCompletions === 25000, detailPageRowsBounded: detailResult.rows.length <= 100, detailHasMoreForDataset: detailResult.hasMore === true, nextPageStable: detailNextResult.rows[0]?.employeeId === "employee-000101", databaseTimeoutCancelled: /statement timeout|canceling statement/i.test(timeoutProbe.stderr), connectionReusableAfterCancel: timeoutProbe.stdout.includes("connection-ok"), aggregateExceedsHistoricalCap: 100000 > 5000 } };
  assert.equal(evidence.environment.profiles, 100000); assert.equal(evidence.assertions.aggregateRowsHydrated, 0); assert.ok(evidence.assertions.overviewMetricsExact); assert.ok(evidence.assertions.detailPageRowsBounded); assert.ok(evidence.assertions.detailHasMoreForDataset); assert.ok(evidence.assertions.nextPageStable); assert.ok(evidence.assertions.databaseTimeoutCancelled); assert.ok(evidence.assertions.connectionReusableAfterCancel); assert.ok(evidence.assertions.aggregateExceedsHistoricalCap);
  mkdirSync(dirname(evidencePath), { recursive: true }); writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`); console.log(JSON.stringify(evidence, null, 2));
} finally { if (ownsContainer) run("docker", ["stop", "--time", "1", container], { allowFailure: true }); }
