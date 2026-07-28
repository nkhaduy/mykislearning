import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolve } from "node:path";
import { verifyProductionApproval } from "./verify-production-approval.mjs";

const root = resolve(new URL("../..", import.meta.url).pathname);
const apply = process.argv.includes("--apply");
let target;
try { target = verifyProductionApproval(process.env); } catch (error) { console.error(error.message); process.exit(2); }
console.log(JSON.stringify({ mode: apply ? "apply" : "plan-only", target, checkpoints: ["validated backup", "migration preflight", "Worker dry-run", "database migration", "Worker deployment", "smoke tests", "rollback checkpoint"] }, null, 2));
if (!apply) process.exit(0);
if (process.env.KIS_PRODUCTION_EXECUTION_CONFIRM !== "EXECUTE_REVIEWED_PRODUCTION_PLAN_ONCE") {
  console.error("PRODUCTION_DEPLOY_REFUSED: one-time execution confirmation is missing");
  process.exit(2);
}
const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", stdio: "inherit", ...options });
  if (result.error || result.status !== 0) throw new Error(`${command} failed`);
};
run("npm", ["run", "build"]);
run("npm", ["run", "check:wrangler"]);
run("npx", ["wrangler", "deploy", "--dry-run"]);
const databaseUrl = new URL(process.env.KIS_PRODUCTION_DATABASE_URL);
const passwordFile = String(process.env.KIS_PRODUCTION_DATABASE_PASSWORD_FILE || "").trim();
const password = decodeURIComponent(databaseUrl.password || "") || (passwordFile ? readFileSync(passwordFile, "utf8").trim() : "");
if (!password) {
  console.error("PRODUCTION_DEPLOY_REFUSED: provide the database password in a mode-0600 KIS_PRODUCTION_DATABASE_PASSWORD_FILE or the secure database URL source");
  process.exit(2);
}
const tempDirectory = mkdtempSync(join(tmpdir(), "kisvn-production-db-"));
const pgpassPath = join(tempDirectory, "pgpass");
const escapePgpass = (value) => String(value).replace(/\\/g, "\\\\").replace(/:/g, "\\:");
const username = decodeURIComponent(databaseUrl.username);
const database = databaseUrl.pathname.replace(/^\//, "") || "postgres";
writeFileSync(pgpassPath, `${[databaseUrl.hostname, databaseUrl.port || "5432", database, username, password].map(escapePgpass).join(":")}\n`, { mode: 0o600 });
databaseUrl.password = "";
try {
  run("supabase", ["db", "push", "--db-url", databaseUrl.toString(), "--include-all", "--yes"], { env: { ...process.env, PGPASSFILE: pgpassPath, KIS_PRODUCTION_DATABASE_URL: "" } });
} finally {
  rmSync(tempDirectory, { recursive: true, force: true });
}
run("npx", ["wrangler", "deploy", "--name", process.env.KIS_PRODUCTION_WORKER_NAME, "--message", "KIS LMS owner-approved production deployment"]);
