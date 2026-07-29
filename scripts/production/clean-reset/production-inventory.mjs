import { PURGE_TABLES, loadPlan, runLinkedQuery, safePlanOutput } from "./production-clean-reset-common.mjs";

const plan = loadPlan();
if (!process.argv.includes("--live-readonly")) {
  console.log(JSON.stringify({ ...safePlanOutput(plan), inventory: "evidence-only" }, null, 2));
  process.exit(0);
}

const names = PURGE_TABLES.map((table) => `('${table.replaceAll("'", "''")}')`).join(",");
const existingResult = runLinkedQuery(`select table_name, to_regclass(table_name) is not null as exists_flag from (values ${names}) v(table_name);`);
const existing = new Set((existingResult.rows || []).filter((row) => row.exists_flag).map((row) => row.table_name));
const countExpressions = PURGE_TABLES.map((table) => existing.has(table)
  ? `${JSON.stringify(table)}, (select count(*)::bigint from ${table})`
  : `${JSON.stringify(table)}, 0`).join(",");
const result = runLinkedQuery(`select jsonb_build_object(${countExpressions}) as counts;`);
console.log(JSON.stringify({ ...safePlanOutput(plan), inventory: "live-readonly", countFields: Object.keys(result.rows?.[0]?.counts || {}).length }, null, 2));
