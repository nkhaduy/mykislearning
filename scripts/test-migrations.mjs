import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(scriptDir, "..");
const migrationDir = join(rootDir, "supabase", "migrations");
const fixtureDir = join(scriptDir, "migration-test");
const image = process.env.KIS_MIGRATION_IMAGE || "public.ecr.aws/supabase/postgres:17.6.1.136";
const requestedScenario = process.argv[2] || "all";
const supportedScenarios = new Set(["all", "fresh", "upgrade", "partial"]);

if (!supportedScenarios.has(requestedScenario)) {
  throw new Error(`Unknown migration scenario: ${requestedScenario}`);
}

const suffix = `${process.pid}-${randomBytes(4).toString("hex")}`;
const externalContainer = process.env.KIS_MIGRATION_DB_CONTAINER || "";
const containerName = externalContainer || `kis-lms-migrations-${suffix}`;
const createdDatabases = new Set();
let ownsContainer = false;

/**
 * @typedef {{ input?: string | Buffer, allowFailure?: boolean }} RunOptions
 */

/**
 * @param {string} command
 * @param {string[]} args
 * @param {RunOptions} options
 */
function run(command, args, { input, allowFailure = false } = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    encoding: "utf8",
    input,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (!allowFailure && result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`${command} ${args.join(" ")} failed (${result.status})${detail ? `\n${detail}` : ""}`);
  }
  return result;
}

function dockerExec(args, options = {}) {
  const flags = options.input === undefined ? [] : ["-i"];
  return run("docker", ["exec", ...flags, containerName, ...args], options);
}

function startPsql(database) {
  const child = spawn("docker", [
    "exec", "-i", containerName,
    "psql", "--username", "postgres", "--dbname", database,
    "--set", "ON_ERROR_STOP=1", "--tuples-only", "--no-align", "--quiet",
  ], { cwd: rootDir, stdio: ["pipe", "pipe", "pipe"] });
  const session = { child, stdout: "", stderr: "", status: null, exited: null };
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { session.stdout += chunk; });
  child.stderr.on("data", (chunk) => { session.stderr += chunk; });
  session.exited = new Promise((resolve) => {
    child.on("close", (status) => { session.status = status; resolve(status); });
  });
  return session;
}

async function waitForOutput(session, marker, timeoutMs = 5000) {
  const startedAt = Date.now();
  while (!session.stdout.includes(marker)) {
    if (session.status !== null) throw new Error(`psql exited before ${marker}: ${session.stderr}`);
    if (Date.now() - startedAt > timeoutMs) throw new Error(`Timed out waiting for psql output: ${marker}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

function sql(database, source, label = "SQL") {
  const result = dockerExec([
    "psql",
    "--username", "postgres",
    "--dbname", database,
    "--set", "ON_ERROR_STOP=1",
    "--tuples-only",
    "--no-align",
  ], { input: source, allowFailure: true });
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`${label} failed in ${database}\n${detail}`);
  }
  return result.stdout.trim();
}

function sqlFile(database, path, label = path) {
  return sql(database, readFileSync(path, "utf8"), label);
}

function createDatabase(label) {
  const database = `kis_${label}_${suffix.replaceAll("-", "_")}`;
  dockerExec(["dropdb", "--if-exists", "--username", "postgres", database]);
  dockerExec(["createdb", "--username", "postgres", database]);
  createdDatabases.add(database);
  sqlFile(database, join(fixtureDir, "bootstrap-supabase.sql"), "Supabase bootstrap fixture");
  return database;
}

function migrations() {
  return readdirSync(migrationDir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => ({ name, path: join(migrationDir, name) }));
}

function applyMigrations(database, filter = () => true) {
  for (const migration of migrations().filter(filter)) {
    sqlFile(database, migration.path, `Migration ${migration.name}`);
  }
}

function assertEqual(actual, expected, message) {
  if (String(actual) !== String(expected)) {
    throw new Error(`${message}: expected ${expected}, received ${actual}`);
  }
}

function scalar(database, query) {
  return sql(database, `${query.replace(/;\s*$/, "")};`, "Assertion query").split("\n").at(-1)?.trim() || "";
}

function verifyCommon(database) {
  assertEqual(scalar(database, `
    select count(*) from pg_class
    where relnamespace = 'public'::regnamespace
      and relkind in ('r', 'p')
      and not relrowsecurity
  `), "0", "All public tables must have RLS");

  assertEqual(scalar(database, `
    select count(*) from information_schema.role_table_grants
    where table_schema = 'public' and grantee in ('anon', 'authenticated')
  `), "0", "anon/authenticated table grants must be absent");

  assertEqual(scalar(database, `
    select count(*) from pg_constraint
    where contype = 'f' and connamespace = 'public'::regnamespace and not convalidated
  `), "0", "All public foreign keys must be validated");

  assertEqual(scalar(database, `
    select count(*) from (
      select child.account_id from public.enrollments child left join public.profiles parent on parent.id = child.account_id where parent.id is null
      union all select child.course_id from public.enrollments child left join public.courses parent on parent.id = child.course_id where parent.id is null
      union all select child.account_id from public.content_progress child left join public.profiles parent on parent.id = child.account_id where parent.id is null
      union all select child.course_id from public.content_progress child left join public.courses parent on parent.id = child.course_id where child.course_id is not null and parent.id is null
      union all select child.account_id from public.training_participants child left join public.profiles parent on parent.id = child.account_id where parent.id is null
      union all select child.session_id from public.training_participants child left join public.training_sessions parent on parent.id = child.session_id where parent.id is null
      union all select child.account_id from public.learning_records child left join public.profiles parent on parent.id = child.account_id where parent.id is null
    ) orphan
  `), "0", "Logical orphan checks must pass");

  assertEqual(scalar(database, `
    select count(*) from public.profiles profile
    join public.departments department on department.id = profile.department_id
    where profile.department is distinct from department.name
  `), "0", "Department UUID/text mappings must agree");

  assertEqual(scalar(database, `
    select count(*) from pg_proc function_row
    join pg_namespace namespace_row on namespace_row.oid = function_row.pronamespace
    where namespace_row.nspname = 'public' and function_row.prorettype = 0
  `), "0", "Public functions must have valid return types");
}

function verifyAuthHardening(database) {
  const output = sqlFile(database, join(fixtureDir, "auth-hardening-verification.sql"), "Auth hardening verification");
  assertEqual(output.split("\n").at(-1), "t", "Private auth grants and auth runtime verification");
}

async function verifyConcurrentRefresh(database) {
  const familyId = "20000000-0000-4000-8000-000000000010";
  sql(database, `
    select public.service_create_auth_session(
      '10000000-0000-4000-8000-000000000010', '${familyId}',
      '30000000-0000-4000-8000-000000000010', repeat('d', 43),
      'local-development-admin', now() + interval '8 hours', now() + interval '8 hours',
      repeat('i', 43), 'refresh-race-seed', 10
    );
  `, "Concurrent refresh seed");

  const first = startPsql(database);
  let second;
  try {
    first.child.stdin.write(`
      begin;
      set application_name = 'kis-refresh-race-1';
      select public.service_rotate_refresh_token(
        repeat('d', 43), '30000000-0000-4000-8000-000000000011', repeat('e', 43),
        now() + interval '8 hours', repeat('j', 43), 'refresh-race-first'
      )->>'status';
    `);
    await waitForOutput(first, "rotated");

    second = startPsql(database);
    second.child.stdin.end(`
      set application_name = 'kis-refresh-race-2';
      select public.service_rotate_refresh_token(
        repeat('d', 43), '30000000-0000-4000-8000-000000000012', repeat('f', 43),
        now() + interval '8 hours', repeat('k', 43), 'refresh-race-second'
      )->>'status';
    `);

    let waiting = false;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      waiting = scalar(database, `
        select count(*) from pg_stat_activity
        where application_name = 'kis-refresh-race-2' and wait_event_type = 'Lock'
      `) === "1";
      if (waiting) break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    if (!waiting) throw new Error("Second refresh did not wait on the token row lock");

    first.child.stdin.end("commit;\n");
    await Promise.all([first.exited, second.exited]);
    if (first.status !== 0 || second.status !== 0) {
      throw new Error(`Concurrent refresh psql failure\nfirst: ${first.stderr}\nsecond: ${second.stderr}`);
    }
    if (!first.stdout.includes("rotated") || !second.stdout.includes("reuse_detected")) {
      throw new Error(`Concurrent refresh result mismatch\nfirst: ${first.stdout}\nsecond: ${second.stdout}`);
    }
    assertEqual(scalar(database, `
      select count(*) from private.auth_sessions
      where token_family_id = '${familyId}' and revocation_reason = 'refresh_reuse'
    `), "1", "Concurrent refresh reuse must revoke the session family");
    assertEqual(scalar(database, `
      select count(*) from private.refresh_tokens
      where token_family_id = '${familyId}' and revoked_at is null
    `), "0", "Concurrent refresh reuse must leave no active family token");
  } finally {
    if (first.status === null) first.child.kill();
    if (second?.status === null) second.child.kill();
  }
}

async function scenarioFresh() {
  const database = createDatabase("fresh");
  applyMigrations(database);
  sqlFile(database, join(fixtureDir, "fresh-seed.sql"), "Fresh synthetic seed");
  verifyCommon(database);
  verifyAuthHardening(database);
  await verifyConcurrentRefresh(database);
  assertEqual(scalar(database, "select count(*) from public.profiles"), "4", "Fresh profile count");
  assertEqual(scalar(database, "select count(*) from private.account_credentials where profile_id = 'local-development-admin'"), "1", "Local bootstrap credential store shape");
  assertEqual(scalar(database, "select count(*) from public.enrollments where id = 'synthetic-enrollment'"), "1", "Fresh enrollment seed");
  return { scenario: "fresh", database, status: "pass" };
}

function scenarioUpgrade() {
  const database = createDatabase("upgrade");
  applyMigrations(database, ({ name }) => /^(001|002|003|004)_/.test(name));
  sqlFile(database, join(fixtureDir, "legacy-seed.sql"), "Legacy UUID seed");
  applyMigrations(database, ({ name }) => !/^(001|002|003|004)_/.test(name));
  verifyCommon(database);

  const canonicalEmployeeId = "11111111-1111-1111-1111-111111111111";
  assertEqual(scalar(database, `select id from public.profiles where employee_code = 'LEG-E-001'`), canonicalEmployeeId, "Legacy profile ID canonicalization");
  assertEqual(scalar(database, `select auth_user_id::text from public.profiles where employee_code = 'LEG-E-001'`), canonicalEmployeeId, "Legacy Supabase Auth linkage");
  assertEqual(scalar(database, `select department from public.profiles where id = '${canonicalEmployeeId}'`), "Legacy Department", "Legacy department backfill");
  assertEqual(scalar(database, "select count(*) from public.profiles"), "3", "Legacy profile preservation");
  assertEqual(scalar(database, "select count(*) from public.courses where id = '44444444-4444-4444-4444-444444444444'"), "1", "Legacy course preservation");
  assertEqual(scalar(database, "select count(*) from public.enrollments where id = '66666666-6666-6666-6666-666666666666'"), "1", "Legacy enrollment backfill");
  assertEqual(scalar(database, "select count(*) from public.content_progress where id = '67676767-6767-6767-6767-676767676767'"), "1", "Legacy progress backfill");
  assertEqual(scalar(database, "select count(*) from public.training_participants where id = '89898989-8989-8989-8989-898989898989'"), "1", "Legacy participant backfill");
  assertEqual(scalar(database, "select count(*) from public.quiz_questions where id = '91919191-9191-9191-9191-919191919191'"), "1", "Legacy question backfill");
  assertEqual(scalar(database, "select count(*) from public.quiz_attempts where id = '94949494-9494-9494-9494-949494949494'"), "1", "Legacy attempt preservation");
  assertEqual(scalar(database, "select count(*) from public.learning_records where id in ('legacy-history-77777777-7777-7777-7777-777777777777','legacy-submission-96969696-9696-9696-9696-969696969696')"), "2", "Legacy learning history backfill");

  const reconciliation = migrations().find(({ name }) => name.includes("reconcile_legacy_department_schema"));
  sqlFile(database, reconciliation.path, "Idempotent reconciliation replay");
  assertEqual(scalar(database, "select count(*) from public.learning_records where id like 'legacy-%'"), "2", "Reconciliation must not duplicate learning records");
  return { scenario: "upgrade", database, status: "pass" };
}

function applyWorkerHistoryWithoutReconciliation(database) {
  applyMigrations(database, ({ name }) => {
    return !/^(001|002|003|004)_/.test(name) && !name.includes("reconcile_legacy_department_schema");
  });
}

function scenarioPartial() {
  const recoverableDatabase = createDatabase("partial_recoverable");
  applyWorkerHistoryWithoutReconciliation(recoverableDatabase);
  sqlFile(recoverableDatabase, join(fixtureDir, "partial-recoverable.sql"), "Recoverable partial state");
  const reconciliation = migrations().find(({ name }) => name.includes("reconcile_legacy_department_schema"));
  sqlFile(recoverableDatabase, reconciliation.path, "Recoverable reconciliation");
  verifyCommon(recoverableDatabase);
  assertEqual(scalar(recoverableDatabase, "select department from public.profiles where id = 'partial-employee'"), "Partial Engineering", "UUID-to-text partial backfill");
  assertEqual(scalar(recoverableDatabase, "select count(*) from public.profiles where department_id is null"), "0", "Text-to-UUID partial backfill");
  assertEqual(scalar(recoverableDatabase, "select count(*) from pg_indexes where schemaname='public' and tablename='profiles' and indexname in ('profiles_department_idx','profiles_department_id_idx')"), "2", "Department indexes must be reconciled");

  const conflictDatabase = createDatabase("partial_conflict");
  applyWorkerHistoryWithoutReconciliation(conflictDatabase);
  sqlFile(conflictDatabase, join(fixtureDir, "partial-conflict.sql"), "Conflicting partial state");
  const result = dockerExec([
    "psql", "--username", "postgres", "--dbname", conflictDatabase,
    "--set", "ON_ERROR_STOP=1",
  ], { input: readFileSync(reconciliation.path, "utf8"), allowFailure: true });
  if (result.status === 0 || !`${result.stdout}\n${result.stderr}`.includes("conflicting profile mappings")) {
    throw new Error(`Conflicting department state did not fail clearly\n${result.stdout}\n${result.stderr}`);
  }
  assertEqual(scalar(conflictDatabase, "select count(*) from pg_constraint where conrelid='public.profiles'::regclass and conname='profiles_department_id_fkey'"), "0", "Conflict reconciliation must roll back its FK change");
  assertEqual(scalar(conflictDatabase, "select department from public.profiles where id='conflict-employee'"), "Different Text Department", "Conflict rollback must preserve text value");
  return { scenario: "partial", databases: [recoverableDatabase, conflictDatabase], status: "pass" };
}

function startContainer() {
  if (externalContainer) return;
  run("docker", [
    "run", "--rm", "--detach", "--name", containerName,
    "--env", "POSTGRES_PASSWORD=postgres",
    image,
  ]);
  ownsContainer = true;

  for (let attempt = 0; attempt < 120; attempt += 1) {
    const logs = run("docker", ["logs", containerName], { allowFailure: true });
    const ready = dockerExec(["pg_isready", "--username", "postgres", "--dbname", "postgres"], { allowFailure: true });
    if (`${logs.stdout}\n${logs.stderr}`.includes("PostgreSQL init process complete; ready for start up.") && ready.status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  }
  throw new Error(`Postgres container ${containerName} did not become ready`);
}

function cleanup() {
  if (!ownsContainer) {
    for (const database of createdDatabases) {
      dockerExec(["dropdb", "--if-exists", "--force", "--username", "postgres", database], { allowFailure: true });
    }
  }
  if (ownsContainer) {
    run("docker", ["rm", "--force", containerName], { allowFailure: true });
  }
}

const results = [];
try {
  startContainer();
  if (requestedScenario === "all" || requestedScenario === "fresh") results.push(await scenarioFresh());
  if (requestedScenario === "all" || requestedScenario === "upgrade") results.push(scenarioUpgrade());
  if (requestedScenario === "all" || requestedScenario === "partial") results.push(scenarioPartial());
  console.log(JSON.stringify({ status: "pass", image, results }, null, 2));
} finally {
  cleanup();
}
