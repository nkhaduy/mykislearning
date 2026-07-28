import { createHash, randomBytes } from "node:crypto";
import { chmodSync, existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";

const root = new URL("../..", import.meta.url).pathname;
const projectRef = "mooqdtiedfamnlpitqtq";
const container = execFileSync("sh", ["-c", "docker ps --format '{{.Names}}' | sed -n '/^supabase_db_kis-lms-worker-supabase\\./{p;q;}'"], { encoding: "utf8" }).trim();
if (!container) throw new Error("disposable local Supabase database container is unavailable");
const suffix = `${Date.now()}-${randomBytes(3).toString("hex")}`;
const database = `kis_production_restore_${process.pid}_${randomBytes(3).toString("hex")}`;
const schemaDump = `/tmp/kis-production-${suffix}-schema.sql`;
const dataDump = `/tmp/kis-production-${suffix}-data.sql`;
const evidencePath = `${root}/docs/audit-remediation/evidence/PRODUCTION_BACKUP_RESTORE.json`;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024, ...options });
  if (result.error || result.status !== 0) throw new Error(`${command} failed: ${String(result.stderr || result.stdout).split("\n").slice(-3).join(" ")}`);
  return String(result.stdout || "");
}
function docker(args, input) {
  return run("docker", ["exec", ...(input === undefined ? [] : ["-i"]), container, ...args], input === undefined ? {} : { input });
}
function localSql(sql) {
  return docker(["psql", "--username", "postgres", "--dbname", database, "--set", "ON_ERROR_STOP=1", "--tuples-only", "--no-align", "--quiet"], sql).trim();
}
function sourceJson(sql) {
  const output = run("supabase", ["db", "query", "--linked", "--output", "json", sql]);
  return JSON.parse(output).rows?.[0];
}
const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const countSql = `select coalesce(jsonb_object_agg(schema_name || '.' || table_name, row_count order by schema_name, table_name), '{}'::jsonb) as counts from (
  select n.nspname schema_name, c.relname table_name, (xpath('/row/c/text()', query_to_xml(format('select count(*) c from %I.%I', n.nspname, c.relname), false, true, '')))[1]::text::bigint row_count
  from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('r','p') and n.nspname in ('public','private')
) q;`;
const catalogSql = `select jsonb_build_object(
  'tables',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('r','p') and n.nspname in ('public','private')),
  'views',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('v','m') and n.nspname in ('public','private')),
  'functions',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private')),
  'triggers',(select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and n.nspname in ('public','private')),
  'invalid_indexes',(select count(*) from pg_index i join pg_class c on c.oid=i.indexrelid join pg_namespace n on n.oid=c.relnamespace where not i.indisvalid and n.nspname in ('public','private')),
  'unvalidated_foreign_keys',(select count(*) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where c.contype='f' and not c.convalidated and n.nspname in ('public','private')),
  'public_tables_without_rls',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('r','p') and n.nspname='public' and not c.relrowsecurity),
  'policies',(select count(*) from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private')),
  'browser_grants',(select count(*) from information_schema.role_table_grants where table_schema in ('public','private') and grantee in ('anon','authenticated'))
) as catalog;`;

const startedAt = new Date();
try {
  run("supabase", ["db", "dump", "--linked", "--schema", "public,private", "--file", schemaDump]);
  run("supabase", ["db", "dump", "--linked", "--data-only", "--schema", "public,private", "--use-copy", "--file", dataDump]);
  chmodSync(schemaDump, 0o600);
  chmodSync(dataDump, 0o600);
  docker(["createdb", "--username", "postgres", database]);
  localSql(readFileSync(`${root}/scripts/migration-test/bootstrap-supabase.sql`, "utf8"));
  localSql(readFileSync(schemaDump, "utf8"));
  localSql(`set session_replication_role=replica;\n${readFileSync(dataDump, "utf8")}\nset session_replication_role=origin;`);
  const sourceCounts = sourceJson(countSql).counts;
  const restoredCounts = JSON.parse(localSql(countSql));
  const sourceCatalog = sourceJson(catalogSql).catalog;
  const restoredCatalog = JSON.parse(localSql(catalogSql));
  const normalize = (object) => Object.fromEntries(Object.entries(object).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, Number(item)]));
  const rowCountsMatch = JSON.stringify(normalize(sourceCounts)) === JSON.stringify(normalize(restoredCounts));
  const catalogMatch = ["tables", "views", "triggers", "policies"].every((key) => Number(sourceCatalog[key]) === Number(restoredCatalog[key]))
    && Number(restoredCatalog.functions) >= Number(sourceCatalog.functions);
  const integrityPass = Number(restoredCatalog.invalid_indexes) === Number(sourceCatalog.invalid_indexes)
    && Number(restoredCatalog.unvalidated_foreign_keys) === Number(sourceCatalog.unvalidated_foreign_keys)
    && Number(restoredCatalog.public_tables_without_rls) === Number(sourceCatalog.public_tables_without_rls)
    && Number(restoredCatalog.browser_grants) === Number(sourceCatalog.browser_grants);
  const sourcePreflightReady = Number(sourceCatalog.invalid_indexes) === 0 && Number(sourceCatalog.unvalidated_foreign_keys) === 0;
  const applicationContractSmoke = localSql("select to_regclass('public.profiles') is not null and to_regprocedure('public.service_bootstrap_status()') is not null and (select count(*) from public.profiles) >= 0;") === "t";
  const backupId = `LOGICAL-${startedAt.toISOString().replace(/[-:.]/g, "").replace("Z", "Z")}-${sha256(schemaDump).slice(0, 12)}`;
  const result = {
    schemaVersion: 1,
    projectRef,
    backupId,
    type: "logical pg_dump via Supabase linked ephemeral credentials",
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    schemaSha256: sha256(schemaDump),
    dataSha256: sha256(dataDump),
    sourceCounts,
    restoredCounts,
    sourceCatalog,
    restoredCatalog,
    rowCountsMatch,
    catalogMatch,
    integrityPass,
    sourcePreflightReady,
    applicationContractSmoke,
    destination: "disposable local Supabase-compatible PostgreSQL database",
    status: rowCountsMatch && catalogMatch && integrityPass && applicationContractSmoke ? "pass" : "fail"
  };
  writeFileSync(evidencePath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ backupId, status: result.status, rowCountsMatch, catalogMatch, integrityPass, sourcePreflightReady, applicationContractSmoke, durationMs: new Date(result.completedAt) - startedAt }, null, 2));
  if (result.status !== "pass") process.exitCode = 2;
} finally {
  docker(["dropdb", "--if-exists", "--force", "--username", "postgres", database]);
  if (existsSync(schemaDump)) unlinkSync(schemaDump);
  if (existsSync(dataDump)) unlinkSync(dataDump);
}
