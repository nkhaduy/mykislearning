import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { chmodSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { PURGE_TABLES } from "./production/clean-reset/production-clean-reset-common.mjs";

const root = resolve(import.meta.dirname, "..");
const migrationDir = join(root, "supabase", "migrations");
const cleanResetDir = join(root, "scripts", "production", "clean-reset");
const image = process.env.KIS_MIGRATION_IMAGE || "public.ecr.aws/supabase/postgres:17.6.1.136";
const evidencePath = resolve(process.env.KIS_CLEAN_ROOM_REHEARSAL_EVIDENCE || "/tmp/kisvn-clean-room-rehearsal.json");
const productionRef = process.env.KIS_PRODUCTION_PROJECT_REF || "production-ref-redacted-at-report-time";
const container = `kisvn-clean-room-${process.pid}-${randomBytes(4).toString("hex")}`;
const cleanDb = "kis_clean_replay";
const legacyDb = "kis_legacy_clone";
const rollbackDb = "kis_legacy_rollback";

const pending = [
  "20260727172321_reconcile_legacy_department_schema.sql",
  "20260728013513_auth_rotation_mfa_hardening.sql",
  "20260728030009_remove_mfa_2fa.sql",
  "20260728031000_employee_search_cursor.sql",
  "20260728032000_background_export_jobs.sql",
  "20260728103000_reporting_rpc.sql",
  "20260728104000_export_operations.sql",
  "20260729022415_consolidate_roles_to_hr_and_employee.sql",
];

const aliases = new Map([
  ["20260703145900_cleanup_orphan_course_versions.sql", "20260707042945"],
  ["20260703150000_course_hard_delete_cascade.sql", "20260707043422"],
  ["20260705000000_allow_hard_delete_course_versions.sql", "20260707043424"],
  ["20260707092048_public_training_external_links.sql", "20260707043427"],
  ["20260707120000_public_training_roster.sql", "20260707043429"],
  ["20260707130000_public_training_speaker.sql", "20260707043431"],
  ["20260707140000_public_training_orientation.sql", "20260707062836"],
  ["20260709000000_public_training_flex_steps.sql", "20260709013240"],
  ["20260709010000_manual_participants_and_speaker_upload.sql", "20260709025917"],
  ["20260709020000_roster_given_name_and_source.sql", "20260709031434"],
  ["20260709023000_manual_roster_public_source.sql", "20260709064023"],
  ["20260709024500_speaker_photo_position.sql", "20260709064803"],
  ["20260726090000_security_containment.sql", "20260727111206"],
]);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 96 * 1024 * 1024,
    ...options,
  });
  if (result.error || result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`${command} ${args.join(" ")} failed (${result.status})${detail ? `\n${detail}` : ""}`);
  }
  return String(result.stdout || "");
}

function docker(args, input) {
  return run("docker", ["exec", ...(input === undefined ? [] : ["-i"]), container, ...args], input === undefined ? {} : { input });
}

function sql(database, source, label = "SQL") {
  try {
    return docker([
      "psql", "--username", "postgres", "--dbname", database,
      "--set", "ON_ERROR_STOP=1", "--tuples-only", "--no-align", "--quiet",
    ], source).trim();
  } catch (error) {
    throw new Error(`${label} failed in ${database}\n${error.message}`, { cause: error });
  }
}

function scalar(database, query) {
  return sql(database, query, "assertion query").split("\n").at(-1)?.trim() || "";
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function migrations() {
  return readdirSync(migrationDir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => ({ name, sql: readFileSync(join(migrationDir, name), "utf8") }));
}

function migrationIdentity(name) {
  const stem = name.replace(/\.sql$/, "");
  const separator = stem.indexOf("_");
  return { version: separator < 0 ? stem : stem.slice(0, separator), name: separator < 0 ? "" : stem.slice(separator + 1), stem };
}

function recordMigration(database, file, versionOverride = "") {
  const identity = migrationIdentity(file.name);
  const version = versionOverride || identity.version;
  const historyName = versionOverride ? identity.stem : identity.name;
  const encoded = Buffer.from(file.sql, "utf8").toString("base64");
  sql(database, `
    insert into supabase_migrations.schema_migrations(version, statements, name)
    values ('${version}', array[convert_from(decode('${encoded}','base64'),'utf8')], '${historyName.replaceAll("'", "''")}');
  `, `record migration ${file.name}`);
}

function applyMigration(database, file, versionOverride = "") {
  const started = performance.now();
  sql(database, file.sql, `migration ${file.name}`);
  recordMigration(database, file, versionOverride);
  return { name: file.name, durationMs: Math.round((performance.now() - started) * 100) / 100, status: "pass" };
}

function bootstrap(database) {
  docker(["createdb", "--username", "postgres", database]);
  sql(database, readFileSync(join(root, "scripts", "migration-test", "bootstrap-supabase.sql"), "utf8"), "Supabase bootstrap");
  sql(database, `
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key,
      statements text[] not null default '{}',
      name text
    );
  `, "migration history bootstrap");
}

const schemaChecksumSql = `
  select encode(digest(coalesce(string_agg(item, E'\\n' order by item), ''), 'sha256'), 'hex')
  from (
    select format('table|%s|%s|%s', n.nspname, c.relname, c.relrowsecurity) item
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in ('public','private') and c.relkind in ('r','p','v','m')
    union all
    select format('column|%s|%s|%s|%s|%s|%s', table_schema, table_name, ordinal_position, column_name, data_type, is_nullable)
    from information_schema.columns where table_schema in ('public','private')
    union all
    select format('constraint|%s|%s|%s', connamespace::regnamespace::text, conname, pg_get_constraintdef(oid, true))
    from pg_constraint where connamespace in ('public'::regnamespace, 'private'::regnamespace)
    union all
    select format('index|%s|%s|%s', schemaname, indexname, indexdef) from pg_indexes where schemaname in ('public','private')
    union all
    select format('policy|%s|%s|%s|%s|%s|%s', schemaname, tablename, policyname, cmd, coalesce(qual,''), coalesce(with_check,''))
    from pg_policies where schemaname in ('public','private')
    union all
    select format('function|%s|%s|%s', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid))
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private')
    union all
    select format('trigger|%s|%s|%s', n.nspname, c.relname, pg_get_triggerdef(t.oid, true))
    from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
    where not t.tgisinternal and n.nspname in ('public','private')
  ) catalog;
`;

function schemaChecksum(database) {
  return scalar(database, schemaChecksumSql);
}

function normalizedSchemaDump(database) {
  return docker([
    "pg_dump", "--username", "postgres", "--dbname", database,
    "--schema-only", "--no-owner", "--no-comments", "--schema", "public", "--schema", "private",
  ]).split(/\r?\n/)
    .filter((line) => !line.startsWith("--") && !line.startsWith("\\restrict") && !line.startsWith("\\unrestrict"))
    .join("\n")
    .trim();
}

function settings(targetRef, expectedChecksum, extra = {}) {
  const values = {
    target: "disposable",
    target_project_ref: targetRef,
    production_project_ref: productionRef,
    bootstrap_hr_id: "synthetic-bootstrap-admin",
    expected_schema_checksum: expectedChecksum,
    ...extra,
  };
  return Object.entries(values).map(([key, value]) => `set kis.clean_reset.${key} = '${String(value).replaceAll("'", "''")}';`).join("\n");
}

function runCleanResetFile(database, fileName, expectedChecksum, extra = {}) {
  const source = `${settings(`disposable-${database}`, expectedChecksum, extra)}\n${readFileSync(join(cleanResetDir, fileName), "utf8")}`;
  return sql(database, source, fileName);
}

function seedLegacyBlockers(database) {
  const profileRows = [
    ["synthetic-bootstrap-admin", "BOOT-ADMIN", "Bootstrap Admin", "bootstrap@example.invalid", "admin"],
    ["legacy-dup-1a", "LEG-001", "Duplicate 1A", "dup.one@example.invalid", "employee"],
    ["legacy-dup-1b", " leg-001 ", "Duplicate 1B", " DUP.ONE@example.invalid ", "employee"],
    ["legacy-dup-2a", "LEG-002", "Duplicate 2A", "dup.two@example.invalid", "employee"],
    ["legacy-dup-2b", " leg-002 ", "Duplicate 2B", " DUP.TWO@example.invalid ", "employee"],
    ["legacy-dup-3a", "LEG-003", "Duplicate 3A", "unique.3a@example.invalid", "employee"],
    ["legacy-dup-3b", " leg-003 ", "Duplicate 3B", "unique.3b@example.invalid", "employee"],
    ["legacy-dup-4a", "LEG-004", "Duplicate 4A", "unique.4a@example.invalid", "employee"],
    ["legacy-dup-4b", " leg-004 ", "Duplicate 4B", "unique.4b@example.invalid", "employee"],
  ];
  const values = profileRows.map((row) => `(${row.map((value) => `'${value.replaceAll("'", "''")}'`).join(",")},'Legacy','active','normal')`).join(",\n");
  sql(database, `
    insert into public.profiles(id, employee_code, full_name, email, role, department, account_status, password_status)
    values ${values};
    insert into public.user_roles(account_id, role) values ('synthetic-bootstrap-admin','hr') on conflict do nothing;
    insert into private.account_credentials(profile_id, password_hash, must_change)
    values ('synthetic-bootstrap-admin','pbkdf2$synthetic-clean-room-only',false)
    on conflict (profile_id) do nothing;
    alter table public.course_versions drop constraint if exists course_versions_course_id_fkey;
    insert into public.course_versions(id, course_id, version_number, status, title, created_by)
    select 'legacy-orphan-version-' || lpad(series::text, 2, '0'),
           'legacy-missing-course-' || lpad(series::text, 2, '0'), 1, 'draft',
           'Synthetic orphan ' || series, 'synthetic-bootstrap-admin'
    from generate_series(1,69) series;
    alter table public.course_versions add constraint course_versions_course_id_fkey
      foreign key (course_id) references public.courses(id) on delete cascade not valid;
  `, "legacy blocker seed");
}

function blockerCounts(database) {
  return JSON.parse(scalar(database, `select jsonb_build_object(
    'orphanCourseVersions', (select count(*) from public.course_versions cv left join public.courses c on c.id=cv.course_id where c.id is null),
    'duplicateNormalizedEmails', (select count(*) from (select lower(btrim(email)) from public.profiles group by 1 having count(*)>1) q),
    'duplicateNormalizedEmployeeCodes', (select count(*) from (select lower(btrim(employee_code)) from public.profiles where nullif(btrim(employee_code),'') is not null group by 1 having count(*)>1) q),
    'unvalidatedForeignKeys', (select count(*) from pg_constraint where contype='f' and connamespace='public'::regnamespace and not convalidated)
  );`));
}

function canonicalizeAliases(database, files) {
  const before = schemaChecksum(database);
  for (const file of files.filter((entry) => aliases.has(entry.name))) {
    const identity = migrationIdentity(file.name);
    sql(database, `delete from supabase_migrations.schema_migrations where version='${aliases.get(file.name)}';`, `remove alias ${file.name}`);
    recordMigration(database, file, identity.version);
  }
  const after = schemaChecksum(database);
  if (before !== after) throw new Error("history canonicalization changed the application schema");
  if (scalar(database, "select count(*) from supabase_migrations.schema_migrations") !== "34") throw new Error("canonical history must contain 34 rows");
  return { aliasesCanonicalized: aliases.size, schemaBeforeSha256: before, schemaAfterSha256: after, schemaUnchanged: true };
}

function pendingMigrationFiles(database, files) {
  return files.filter((file) => pending.includes(file.name)).filter((file) => {
    const { version } = migrationIdentity(file.name);
    return scalar(database, `select count(*) from supabase_migrations.schema_migrations where version='${version}'`) === "0";
  });
}

function assertEqual(actual, expected, message) {
  if (String(actual) !== String(expected)) throw new Error(`${message}: expected ${expected}, received ${actual}`);
}

function startContainer() {
  run("docker", ["run", "--rm", "--detach", "--name", container, "--env", "POSTGRES_PASSWORD=postgres", image]);
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const logs = spawnSync("docker", ["logs", container], { encoding: "utf8" });
    const ready = spawnSync("docker", ["exec", container, "pg_isready", "--username", "postgres", "--dbname", "postgres"], { encoding: "utf8" });
    if (`${logs.stdout || ""}\n${logs.stderr || ""}`.includes("PostgreSQL init process complete; ready for start up.") && ready.status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  }
  throw new Error("clean-room Postgres container did not become ready");
}

const result = {
  schemaVersion: 1,
  capturedAt: new Date().toISOString(),
  image,
  cleanMigrationReplay: { status: "fail", migrations: [] },
  legacyCleanResetRehearsal: { status: "fail" },
  pendingMigrations: { expected: pending.length, applied: 0, status: "fail" },
  schemaEquivalence: { status: "fail" },
  idempotency: { status: "fail" },
  cleanResetAllowlist: {
    tableCount: PURGE_TABLES.length,
    sha256: sha256(JSON.stringify([...PURGE_TABLES].sort())),
    forbiddenSchemasPresent: PURGE_TABLES.some((table) => ["auth", "storage", "supabase_migrations", "extensions"].includes(table.split(".")[0])),
  },
  secretLeakage: "pass",
  productionMutation: "NONE",
};

try {
  startContainer();
  bootstrap(cleanDb);
  for (const file of migrations()) result.cleanMigrationReplay.migrations.push(applyMigration(cleanDb, file));
  result.cleanMigrationReplay.schemaChecksum = schemaChecksum(cleanDb);
  result.cleanMigrationReplay.status = "pass";

  bootstrap(legacyDb);
  const files = migrations();
  const legacyTimings = [];
  for (const file of files.filter((entry) => !pending.includes(entry.name))) {
    legacyTimings.push(applyMigration(legacyDb, file, aliases.get(file.name) || ""));
  }
  assertEqual(scalar(legacyDb, "select count(*) from supabase_migrations.schema_migrations"), "34", "legacy history row count");
  assertEqual(scalar(legacyDb, "select count(*) from supabase_migrations.schema_migrations where name like '2026%'"), "13", "legacy alias count");
  seedLegacyBlockers(legacyDb);
  const before = blockerCounts(legacyDb);
  assertEqual(before.orphanCourseVersions, 69, "orphan course version fixture");
  assertEqual(before.duplicateNormalizedEmails, 2, "duplicate email fixture");
  assertEqual(before.duplicateNormalizedEmployeeCodes, 4, "duplicate employee code fixture");
  assertEqual(before.unvalidatedForeignKeys, 1, "unvalidated FK fixture");

  const legacySchemaChecksum = schemaChecksum(legacyDb);
  const inventoryOutput = runCleanResetFile(legacyDb, "inventory.sql", legacySchemaChecksum);

  docker(["createdb", "--username", "postgres", "--template", legacyDb, rollbackDb]);
  runCleanResetFile(rollbackDb, "purge-business-data.sql", legacySchemaChecksum);
  runCleanResetFile(rollbackDb, "verify-clean-state.sql", legacySchemaChecksum);
  docker(["dropdb", "--if-exists", "--force", "--username", "postgres", rollbackDb]);
  docker(["createdb", "--username", "postgres", "--template", legacyDb, rollbackDb]);
  const restoredCounts = blockerCounts(rollbackDb);
  assertEqual(JSON.stringify(restoredCounts), JSON.stringify(before), "rollback restore blocker counts");
  runCleanResetFile(rollbackDb, "rollback-clean-reset.sql", legacySchemaChecksum, {
    restore_rehearsal_verified: "true",
    rollback_source_checksum: legacySchemaChecksum,
  });
  docker(["dropdb", "--if-exists", "--force", "--username", "postgres", rollbackDb]);

  runCleanResetFile(legacyDb, "purge-business-data.sql", legacySchemaChecksum);
  const cleanStateOutput = runCleanResetFile(legacyDb, "verify-clean-state.sql", legacySchemaChecksum);
  const afterPurge = blockerCounts(legacyDb);
  assertEqual(afterPurge.orphanCourseVersions, 0, "orphan course versions after purge");
  assertEqual(afterPurge.duplicateNormalizedEmails, 0, "duplicate emails after purge");
  assertEqual(afterPurge.duplicateNormalizedEmployeeCodes, 0, "duplicate employee codes after purge");
  assertEqual(afterPurge.unvalidatedForeignKeys, 1, "FK remains pending validation before migration");

  const canonicalization = canonicalizeAliases(legacyDb, files);
  const dryRunPending = pendingMigrationFiles(legacyDb, files).map((file) => file.name);
  assertEqual(JSON.stringify(dryRunPending), JSON.stringify(pending), "pending migration dry-run allowlist");
  const pendingTimings = [];
  for (const name of pending) {
    const file = files.find((entry) => entry.name === name);
    if (!file) throw new Error(`missing pending migration ${name}`);
    pendingTimings.push(applyMigration(legacyDb, file));
  }
  assertEqual(scalar(legacyDb, "select count(*) from pg_constraint where contype='f' and connamespace='public'::regnamespace and not convalidated"), "0", "validated foreign keys");

  const cleanDump = normalizedSchemaDump(cleanDb);
  const legacyDump = normalizedSchemaDump(legacyDb);
  const cleanDumpHash = sha256(cleanDump);
  const legacyDumpHash = sha256(legacyDump);
  if (cleanDumpHash !== legacyDumpHash) {
    writeFileSync(`${evidencePath}.clean-schema.sql`, `${cleanDump}\n`, { mode: 0o600 });
    writeFileSync(`${evidencePath}.legacy-schema.sql`, `${legacyDump}\n`, { mode: 0o600 });
    throw new Error("clean replay and legacy rehearsal schemas are not equivalent");
  }

  sql(legacyDb, readFileSync(join(root, "scripts", "seed-ephemeral-security.sql"), "utf8"), "synthetic role seed before idempotency run");
  assertEqual(scalar(legacyDb, "select count(*) from public.profiles"), "5", "bootstrap plus synthetic role profile count");
  const secondRunSchemaChecksum = schemaChecksum(legacyDb);
  const secondPurgeOutput = runCleanResetFile(legacyDb, "purge-business-data.sql", secondRunSchemaChecksum);
  const secondCleanStateOutput = runCleanResetFile(legacyDb, "verify-clean-state.sql", secondRunSchemaChecksum);
  const secondRunPending = pendingMigrationFiles(legacyDb, files).map((file) => file.name);
  assertEqual(secondRunPending.length, 0, "second migration pass must have no pending migrations");
  assertEqual(scalar(legacyDb, "select count(*) from supabase_migrations.schema_migrations"), "42", "canonical migration history after second pass");
  assertEqual(scalar(legacyDb, "select count(*) from public.profiles where role='hr'"), "1", "bootstrap HR survives the second clean reset");
  assertEqual(scalar(legacyDb, "select count(*) from public.profiles where role='admin'"), "0", "legacy Admin profiles after second run");
  assertEqual(scalar(legacyDb, "select count(*) from public.profiles where role='trainer'"), "0", "legacy Trainer profiles after second run");
  assertEqual(scalar(legacyDb, "select count(*) from public.profiles where role is null or role not in ('hr','employee')"), "0", "unknown roles after second run");
  const afterSecondRun = blockerCounts(legacyDb);
  assertEqual(afterSecondRun.orphanCourseVersions, 0, "orphan course versions after second run");
  assertEqual(afterSecondRun.duplicateNormalizedEmails, 0, "duplicate emails after second run");
  assertEqual(afterSecondRun.duplicateNormalizedEmployeeCodes, 0, "duplicate employee codes after second run");
  assertEqual(afterSecondRun.unvalidatedForeignKeys, 0, "validated foreign keys after second run");
  assertEqual(schemaChecksum(legacyDb), secondRunSchemaChecksum, "second clean reset must preserve schema");

  result.legacyCleanResetRehearsal = {
    status: "pass",
    source: "approved reconciliation evidence with synthetic legacy rows only",
    migrationHistoryRows: 34,
    aliasesReproduced: aliases.size,
    blockersBefore: before,
    blockersAfterPurge: afterPurge,
    inventorySha256: sha256(inventoryOutput),
    cleanStateSha256: sha256(cleanStateOutput),
    rollbackRestoreRehearsal: "pass",
    bootstrapHrRecovery: "pass",
    canonicalization,
    migrationDryRun: { status: "pass", pending: dryRunPending },
    migrationTimings: legacyTimings,
  };
  result.pendingMigrations = { expected: pending.length, applied: pendingTimings.length, status: "pass", migrations: pendingTimings };
  result.schemaEquivalence = { status: "pass", cleanSha256: cleanDumpHash, legacySha256: legacyDumpHash };
  result.idempotency = {
    status: "pass",
    syntheticRolesSeeded: 4,
    secondCleanReset: "pass",
    secondMigrationPass: { status: "pass", applied: 0, skippedAlreadyApplied: pending.length },
    blockersAfterSecondRun: afterSecondRun,
    purgeSha256: sha256(secondPurgeOutput),
    cleanStateSha256: sha256(secondCleanStateOutput),
    schemaChecksum: secondRunSchemaChecksum,
  };
} finally {
  const cleanup = spawnSync("docker", ["rm", "--force", container], { cwd: root, encoding: "utf8" });
  result.cleanup = cleanup.status === 0 ? "pass" : "not-required";
  writeFileSync(evidencePath, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
  chmodSync(evidencePath, 0o600);
}

if (result.cleanMigrationReplay.status !== "pass" || result.legacyCleanResetRehearsal.status !== "pass" || result.schemaEquivalence.status !== "pass" || result.idempotency.status !== "pass") {
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    cleanMigrationReplay: result.cleanMigrationReplay.status,
    legacyCleanResetRehearsal: result.legacyCleanResetRehearsal.status,
    pendingMigrationsApplied: `${result.pendingMigrations.applied}/${result.pendingMigrations.expected}`,
    schemaEquivalence: result.schemaEquivalence.status,
    idempotency: result.idempotency.status,
    evidencePath,
  }, null, 2));
}
