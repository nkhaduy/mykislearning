import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSecureRuntime, sha256, tokenConsumptionFile } from "./runtime-contract.mjs";
import { verifyProductionApproval } from "./verify-production-approval.mjs";

const root = resolve(process.env.KIS_PRODUCTION_RELEASE_SOURCE_ROOT || fileURLToPath(new URL("../..", import.meta.url)));
const apply = process.argv.includes("--apply");
const loaded = loadSecureRuntime();
let target;
try {
  target = verifyProductionApproval(loaded.contract, {
    root,
    runtimeFile: loaded.path,
    requireActiveWindow: true,
    requireMigrationReconciliation: true,
    requireCleanResetReadiness: true,
    allowMissingManifest: false,
  });
} catch (error) {
  const blockers = Array.isArray(error.blockers) ? error.blockers : [error.message];
  console.error("PRODUCTION PLAN BLOCKED");
  for (const blocker of blockers) console.error(`- ${blocker}`);
  process.exit(2);
}

console.log(JSON.stringify({
  mode: apply ? "apply" : "plan-only",
  productionMutation: apply,
  target,
  checkpoints: [
    "revalidated release manifest and one-time approval",
    "active maintenance window",
    "restore-tested backup",
    "migration-history reconciliation evidence and dry-run allowlist",
    "Supabase migration dry-run",
    "Worker build and dry-run",
    "database migration",
    "atomic Worker/assets/secrets/Queue/cron deployment",
    "post-deploy smoke and rollback checkpoint",
  ],
}, null, 2));
if (!apply) {
  console.log("GO FOR PRODUCTION DEPLOYMENT");
  process.exit(0);
}

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", stdio: "inherit", env: process.env, ...options });
  if (result.error || result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed`);
};

run("npm", ["run", "build"]);
run("npm", ["run", "scan:artifact"]);
run("npm", ["run", "check:wrangler"]);
run("supabase", ["db", "push", "--linked", "--include-all", "--dry-run"]);

const consumptionPath = tokenConsumptionFile(loaded.path);
const approvalFingerprint = sha256(loaded.contract.KIS_PRODUCTION_ONE_TIME_APPROVAL_TOKEN);
writeFileSync(consumptionPath, `${JSON.stringify({
  schemaVersion: 1,
  consumedAt: new Date().toISOString(),
  approvalId: loaded.contract.KIS_PRODUCTION_APPROVAL_ID,
  approvalFingerprint,
  releaseCommitSha: loaded.contract.KIS_RELEASE_COMMIT_SHA,
}, null, 2)}\n`, { mode: 0o600, flag: "wx" });
chmodSync(consumptionPath, 0o600);

const tempDirectory = mkdtempSync(join(tmpdir(), "kisvn-production-deploy-"));
const secretsPath = join(tempDirectory, "worker-secrets.json");
try {
  const secrets = {
    ...loaded.secrets,
    SUPABASE_URL: loaded.contract.KIS_PRODUCTION_SUPABASE_URL,
  };
  writeFileSync(secretsPath, `${JSON.stringify(secrets)}\n`, { mode: 0o600 });
  chmodSync(secretsPath, 0o600);
  run("supabase", ["db", "push", "--linked", "--include-all", "--yes"]);
  run(resolve(root, "node_modules/.bin/wrangler"), [
    "deploy",
    "--name", loaded.contract.KIS_PRODUCTION_WORKER_NAME,
    "--secrets-file", secretsPath,
    "--message", `KIS LMS approved release ${loaded.contract.KIS_RELEASE_COMMIT_SHA.slice(0, 12)}`,
  ]);
} finally {
  rmSync(tempDirectory, { recursive: true, force: true });
}
