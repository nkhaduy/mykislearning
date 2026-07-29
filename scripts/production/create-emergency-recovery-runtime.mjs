import { randomBytes } from "node:crypto";
import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(new URL("../..", import.meta.url).pathname);
const sourcePath = resolve(process.env.KIS_SOURCE_PRODUCTION_RUNTIME_FILE || "/tmp/kisvn-production-runtime.json");
const targetPath = resolve(process.env.KIS_PRODUCTION_RUNTIME_FILE || "/tmp/kisvn-emergency-production-runtime.json");
const maintenanceWindow = process.env.KIS_EMERGENCY_MAINTENANCE_WINDOW || "2026-07-29T12:10:00+07:00/2026-07-29T14:10:00+07:00";
const source = JSON.parse(readFileSync(sourcePath, "utf8"));
const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const branch = execFileSync("git", ["branch", "--show-current"], { cwd: root, encoding: "utf8" }).trim();

if (branch !== "hotfix/production-report-recovery-20260729") throw new Error("emergency runtime requires the approved hotfix branch");

const contract = {
  KIS_ALLOW_PRODUCTION_MUTATION: "true",
  KIS_ALLOW_PRODUCTION_DEPLOYMENT: "true",
  KIS_PRODUCTION_EMERGENCY_RECOVERY: "true",
  KIS_PRODUCTION_EXECUTION_CONFIRM: "EXECUTE_EMERGENCY_FORWARD_RECOVERY_ONCE",
  APP_ENV: "production",
  KIS_PRODUCTION_CLOUDFLARE_ACCOUNT_ID: source.contract.KIS_PRODUCTION_CLOUDFLARE_ACCOUNT_ID,
  KIS_PRODUCTION_WORKER_NAME: source.contract.KIS_PRODUCTION_WORKER_NAME,
  KIS_PRODUCTION_HOSTNAME: source.contract.KIS_PRODUCTION_HOSTNAME,
  KIS_PRODUCTION_SUPABASE_PROJECT_REF: source.contract.KIS_PRODUCTION_SUPABASE_PROJECT_REF,
  KIS_PRODUCTION_SUPABASE_URL: source.contract.KIS_PRODUCTION_SUPABASE_URL,
  KIS_PRODUCTION_TARGET_ALLOWLIST: source.contract.KIS_PRODUCTION_TARGET_ALLOWLIST,
  KIS_PRODUCTION_APPROVED_BY: "Nguyen Kha Duy",
  KIS_PRODUCTION_CHANGE_OWNER: "Nguyen Kha Duy",
  KIS_PRODUCTION_ROLLBACK_OWNER: "Nguyen Kha Duy",
  KIS_PRODUCTION_MAINTENANCE_WINDOW: maintenanceWindow,
  KIS_PRODUCTION_APPROVAL_ID: `OWNER-EMERGENCY-RECOVERY-20260729-${head.slice(0, 8)}`,
  KIS_PRODUCTION_ONE_TIME_APPROVAL_TOKEN: randomBytes(48).toString("base64url"),
  KIS_RELEASE_COMMIT_SHA: head,
  KIS_PRODUCTION_RELEASE_MANIFEST: "/tmp/kisvn-emergency-production-release-manifest.json",
  KIS_PRODUCTION_GATE_EVIDENCE: "/tmp/kisvn-emergency-production-quality-gates.json",
  KIS_PRODUCTION_DATABASE_STATE: "post-migration-clean-reset-canonical",
  KIS_PRODUCTION_PENDING_MIGRATION: "20260729121500_fix_reporting_rpc_enrollment_compatibility.sql",
  KIS_PRODUCTION_EXPECTED_ACTIVE_WORKER_VERSION: "49c5cb16-2ca1-49ac-9b8c-ecaf117e59ca",
  KIS_PRODUCTION_COMPATIBLE_ROLLBACK_VERSION: "be4cb405-9dc6-41f9-8045-1c1cce7d343e",
  KIS_PRODUCTION_REPORTS_FEATURE_STATE: "enabled",
};

writeFileSync(targetPath, `${JSON.stringify({ schemaVersion: 1, contract, secrets: source.secrets }, null, 2)}\n`, { mode: 0o600 });
chmodSync(targetPath, 0o600);
console.log(JSON.stringify({ runtimePath: targetPath, mode: "0600", releaseCommitSha: head, maintenanceWindow }, null, 2));
