import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_RUNTIME_FILE, ROOT, readJson, run, writePrivateJson } from "./staging-ops.mjs";
import { verifyStagingTarget } from "./staging-contract.mjs";

const runtimePath = process.env.KIS_STAGING_RUNTIME_FILE || DEFAULT_RUNTIME_FILE;
const runtime = readJson(runtimePath);
if (!runtime) throw new Error("staging runtime is missing");
verifyStagingTarget(runtime.contract);

const container = process.env.KIS_STAGING_RESTORE_CONTAINER || run("sh", ["-c", "docker ps --format '{{.Names}}' | sed -n '/^supabase_db_kis-lms-worker-supabase\\./{p;q;}'"]).stdout.trim();
if (!/^supabase_db_kis-lms-worker-supabase\.[A-Za-z0-9_-]+$/.test(container)) throw new Error("a disposable local Supabase database container is required");
const database = `kis_restore_${process.pid}_${randomBytes(4).toString("hex")}`;
const dumpPath = `/tmp/${database}.sql`;
const evidencePath = resolve(ROOT, "docs/audit-remediation/evidence/staging-rehearsal", runtime.executionId, "database-restore-drill.json");

function docker(args, input) {
  return run("docker", ["exec", ...(input === undefined ? [] : ["-i"]), container, ...args], { input });
}

function sql(source) {
  return docker(["psql", "--username", "postgres", "--dbname", database, "--set", "ON_ERROR_STOP=1", "--tuples-only", "--no-align", "--quiet"], source).stdout.trim();
}

const countSql = `select jsonb_build_object(
  'profiles',(select count(*) from public.profiles),
  'departments',(select count(*) from public.departments),
  'courses',(select count(*) from public.courses),
  'enrollments',(select count(*) from public.enrollments),
  'auth_sessions',(select count(*) from private.auth_sessions),
  'refresh_tokens',(select count(*) from private.refresh_tokens),
  'export_jobs',(select count(*) from private.export_jobs)
);`;

function parseJsonResult(raw) {
  const candidates = [String(raw).trim(), ...String(raw).split("\n").map((line) => line.trim()).filter(Boolean).reverse()];
  const embedded = String(raw).match(/\{[\s\S]*\}/);
  if (embedded) candidates.push(embedded[0]);
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      const value = Array.isArray(parsed) ? parsed[0] : parsed?.rows?.[0] || parsed?.data?.[0] || parsed;
      if (value && typeof value === "object") return value.jsonb_build_object || value;
    } catch { /* try the next CLI output shape */ }
  }
  return null;
}

try {
  docker(["createdb", "--username", "postgres", database]);
  sql(readFileSync(resolve(ROOT, "scripts/migration-test/bootstrap-supabase.sql"), "utf8"));
  for (const name of readdirSync(resolve(ROOT, "supabase/migrations")).filter((entry) => entry.endsWith(".sql")).sort()) {
    sql(readFileSync(resolve(ROOT, "supabase/migrations", name), "utf8"));
  }
  sql(`do $$ declare targets text; begin
    select string_agg(format('%I.%I', schemaname, tablename), ',') into targets
    from pg_tables where schemaname in ('public','private') and tablename <> 'spatial_ref_sys';
    if targets is not null then execute 'truncate table ' || targets || ' restart identity cascade'; end if;
  end $$;`);
  run("supabase", ["db", "dump", "--db-url", runtime.supabase.databaseUrl, "--data-only", "--schema", "public,private", "--use-copy", "--file", dumpPath]);
  chmodSync(dumpPath, 0o600);
  const dump = readFileSync(dumpPath, "utf8");
  sql(`set session_replication_role=replica;\n${dump}\nset session_replication_role=origin;`);
  sql("insert into auth.users(id) select distinct auth_user_id from public.profiles where auth_user_id is not null on conflict do nothing;");

  const remoteCountsOutput = run("supabase", ["db", "query", "--db-url", runtime.supabase.databaseUrl, countSql, "--output", "json"]).stdout;
  const remoteCounts = parseJsonResult(remoteCountsOutput);
  const restoredCounts = parseJsonResult(sql(countSql));
  if (!remoteCounts || !restoredCounts) throw new Error("row-count capture returned an unexpected shape");
  for (const counts of [remoteCounts, restoredCounts]) for (const key of Object.keys(counts)) counts[key] = Number(counts[key]);
  const integrity = JSON.parse(sql(`select jsonb_build_object(
    'invalid_indexes',(select count(*) from pg_index where not indisvalid),
    'unvalidated_foreign_keys',(select count(*) from pg_constraint where contype='f' and not convalidated),
    'public_tables_without_rls',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity),
    'profile_auth_orphans',(select count(*) from public.profiles p left join auth.users u on u.id=p.auth_user_id where p.auth_user_id is not null and u.id is null)
  );`));
  const rowCountsMatch = Object.keys(remoteCounts).sort().every((key) => remoteCounts[key] === restoredCounts[key]) && Object.keys(remoteCounts).length === Object.keys(restoredCounts).length;
  const integrityPass = Object.values(integrity).every((value) => Number(value) === 0);
  const result = { completedAt: new Date().toISOString(), source: "fresh disposable Supabase staging project", destination: "ephemeral local Supabase-compatible database", rowCountsMatch, remoteCounts, restoredCounts, integrity, status: rowCountsMatch && integrityPass ? "pass" : "fail" };
  writeFileSync(evidencePath, `${JSON.stringify(result, null, 2)}\n`);
  runtime.databaseRestoreDrill = { completedAt: result.completedAt, evidencePath, rowCountsMatch, integrityPass, status: result.status };
  writePrivateJson(runtimePath, runtime);
  console.log(JSON.stringify(runtime.databaseRestoreDrill, null, 2));
  if (result.status !== "pass") process.exitCode = 2;
} finally {
  docker(["dropdb", "--if-exists", "--force", "--username", "postgres", database]);
  if (existsSync(dumpPath)) unlinkSync(dumpPath);
}
