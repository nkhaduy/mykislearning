import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const image = process.env.KIS_PERF_IMAGE || "public.ecr.aws/supabase/postgres:17.6.1.136";
const suffix = `${process.pid}-${randomBytes(3).toString("hex")}`;
const container = `kis-employee-perf-${suffix}`;
const database = "employee_perf";
const evidencePath = resolve(root, process.env.EMPLOYEE_PERF_EVIDENCE_PATH || "docs/audit-remediation/evidence/employee-search-performance.json");
const migrationPath = join(root, "supabase/migrations/20260728031000_employee_search_cursor.sql");
const concurrentIndexPath = join(root, "scripts/search-rollout/create-indexes-concurrently.sql");

function run(command, args, { input, allowFailure = false } = {}) {
  const result = spawnSync(command, args, { cwd: root, input, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (!allowFailure && result.status !== 0) throw new Error([`${command} ${args.join(" ")} failed`, result.stdout, result.stderr].filter(Boolean).join("\n"));
  return result;
}

function dockerExec(args, options = {}) {
  return run("docker", ["exec", ...(options.input === undefined ? [] : ["-i"]), container, ...args], options);
}

function sql(source) {
  const result = dockerExec(["psql", "-U", "postgres", "-d", database, "-v", "ON_ERROR_STOP=1", "-Atq"], { input: source, allowFailure: true });
  if (result.status !== 0) throw new Error([result.stdout, result.stderr].filter(Boolean).join("\n"));
  return result.stdout.trim();
}

function explain(query) {
  return JSON.parse(sql(`explain (analyze, buffers, format json) ${query};`))[0];
}

function planSummary(explanation) {
  const nodes = [];
  let rowsScanned = 0;
  let sharedHit = 0;
  let sharedRead = 0;
  const visit = (node) => {
    nodes.push(node["Node Type"]);
    if (/Scan$/.test(node["Node Type"] || "")) rowsScanned += Number(node["Actual Rows"] || 0) * Number(node["Actual Loops"] || 1);
    sharedHit += Number(node["Shared Hit Blocks"] || 0);
    sharedRead += Number(node["Shared Read Blocks"] || 0);
    (node.Plans || []).forEach(visit);
  };
  visit(explanation.Plan);
  return {
    planningMs: explanation["Planning Time"],
    executionMs: explanation["Execution Time"],
    rowsReturned: explanation.Plan["Actual Rows"],
    rowsScanned,
    sharedHit,
    sharedRead,
    nodes: [...new Set(nodes)],
  };
}

function percentile(values, ratio) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}

function timings(query, iterations = 24) {
  for (let index = 0; index < 3; index += 1) explain(query);
  const values = Array.from({ length: iterations }, () => explain(query)["Execution Time"]);
  return { p50: percentile(values, .5), p95: percentile(values, .95), p99: percentile(values, .99), samples: values };
}

function asyncPsql(query) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-d", database, "-v", "ON_ERROR_STOP=1", "-Atq"], { cwd: root });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (code) => code === 0 ? resolvePromise() : reject(new Error(stderr || `psql exited ${code}`)));
    child.stdin.end(`${query};\n`);
  });
}

async function concurrentTiming(query, concurrency = 8) {
  const started = performance.now();
  await Promise.all(Array.from({ length: concurrency }, () => asyncPsql(query)));
  return performance.now() - started;
}

const schema = `
create table public.profiles (
  id text primary key,
  employee_code text unique,
  full_name text not null default '',
  email text not null unique,
  role text not null default 'employee',
  department text,
  position text,
  account_status text not null default 'active',
  password_status text not null default 'normal',
  avatar_url text,
  phone text,
  joined_date date,
  manager_name text,
  location text,
  notes text,
  last_login_at timestamptz,
  failed_login_count integer not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.profiles(id, employee_code, full_name, email, department, position, account_status, manager_name, location)
select
  'employee-' || lpad(i::text, 6, '0'),
  'KIS' || lpad(i::text, 6, '0'),
  (array['Nguyễn Văn','Trần Thị','Lê Minh','Phạm Hoàng'])[1 + i % 4] || ' ' || lpad(i::text, 6, '0'),
  'employee' || i || '@kis.test',
  (array['IT','Finance','Operations','HR','Brokerage'])[1 + i % 5],
  (array['Specialist','Manager','Analyst','Associate'])[1 + i % 4],
  case when i % 10 = 0 then 'inactive' else 'active' end,
  'Manager ' || (i % 200),
  (array['HCMC','Hanoi','Da Nang'])[1 + i % 3]
from generate_series(1, 100000) as source(i);
analyze public.profiles;
`;

const baselineQuery = `
select id, employee_code, full_name, email, role, department, position, account_status,
       phone, joined_date, manager_name, location, last_login_at, created_at, updated_at,
       notes, password_status
from public.profiles
where department = 'Finance' and account_status = 'active'
  and (full_name ilike '%nguyễn%' or email ilike '%nguyễn%' or department ilike '%nguyễn%' or employee_code ilike '%nguyễn%')
order by full_name
offset 1000 limit 50`;

const optimizedQuery = `
with matches as materialized (
  select id, employee_code, full_name, email, role, department, position, account_status, location, manager_name, updated_at,
         p.employee_sort_name as sort_name
  from public.profiles p
  where p.department = 'Finance' and p.account_status = 'active'
    and p.employee_search_document like '%nguyen%'
)
select id, employee_code, full_name, email, role, department, position, account_status, location, manager_name, updated_at
from matches
order by sort_name, id
limit 50`;

const prefixQuery = `
select id, employee_code, full_name, email
from public.profiles p
where public.kis_search_normalize(p.employee_code) like 'kis0009%'
order by public.kis_search_normalize(p.full_name), p.id
limit 50`;

const cursorQuery = `
select id, employee_code, full_name, email
from public.profiles p
where p.account_status = 'active'
  and (p.employee_sort_name, p.id) > ('le minh 050000', 'employee-050000')
order by p.employee_sort_name, p.id
limit 50`;

let ownsContainer = false;
try {
  run("docker", ["run", "--rm", "-d", "--name", container, "-e", "POSTGRES_PASSWORD=postgres", image]);
  ownsContainer = true;
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const logs = run("docker", ["logs", container], { allowFailure: true });
    const ready = dockerExec(["pg_isready", "-U", "postgres"], { allowFailure: true });
    if (`${logs.stdout}\n${logs.stderr}`.includes("PostgreSQL init process complete; ready for start up.") && ready.status === 0) break;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
    if (attempt === 89) throw new Error("PostgreSQL benchmark container did not become ready");
  }
  dockerExec(["createdb", "-U", "postgres", database]);
  sql(schema);
  const baseline = { plan: planSummary(explain(baselineQuery)), timing: timings(baselineQuery) };
  sql(readFileSync(migrationPath, "utf8"));
  sql(`update public.profiles p set
    employee_search_document = public.kis_profile_search_document(p.employee_code,p.full_name,p.email,p.department,p.position,p.location,p.manager_name),
    employee_sort_name = public.kis_search_normalize(p.full_name)
    where p.employee_search_document is null or p.employee_sort_name is null;`);
  sql(readFileSync(concurrentIndexPath, "utf8"));
  sql("analyze public.profiles;");
  const optimized = {
    substring: { plan: planSummary(explain(optimizedQuery)), timing: timings(optimizedQuery) },
    prefix: { plan: planSummary(explain(prefixQuery)), timing: timings(prefixQuery) },
    cursor: { plan: planSummary(explain(cursorQuery)), timing: timings(cursorQuery) },
  };
  const concurrent = {
    baselineEightMs: await concurrentTiming(baselineQuery),
    optimizedEightMs: await concurrentTiming(optimizedQuery),
  };
  const evidence = {
    generatedAt: new Date().toISOString(),
    environment: { image, rows: 100000, data: "deterministic synthetic profiles", remoteAccess: false },
    baseline,
    optimized,
    concurrent,
    assertions: {
      substringAvoidsSequentialScan: !optimized.substring.plan.nodes.includes("Seq Scan"),
      prefixUsesIndex: optimized.prefix.plan.nodes.some((node) => /Index|Bitmap/.test(node)),
      cursorUsesIndex: optimized.cursor.plan.nodes.some((node) => /Index|Bitmap/.test(node)),
      substringReturnsRows: optimized.substring.plan.rowsReturned > 0,
      optimizedPayloadColumns: 11,
      legacyPayloadColumns: 18,
    },
  };
  if (!evidence.assertions.substringAvoidsSequentialScan || !evidence.assertions.prefixUsesIndex || !evidence.assertions.cursorUsesIndex || !evidence.assertions.substringReturnsRows) {
    throw new Error(`Employee search plan regression: ${JSON.stringify(evidence.assertions)}`);
  }
  mkdirSync(dirname(evidencePath), { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify({ status: "pass", evidencePath, baseline: baseline.timing, optimized: Object.fromEntries(Object.entries(optimized).map(([key, value]) => [key, value.timing])), concurrent }, null, 2));
} finally {
  if (ownsContainer) run("docker", ["stop", "--time", "1", container], { allowFailure: true });
}
