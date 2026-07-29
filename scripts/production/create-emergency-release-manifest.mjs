import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chmodSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { loadSecureRuntime } from "./runtime-contract.mjs";

const root = resolve(new URL("../..", import.meta.url).pathname);
const loaded = loadSecureRuntime();
const { contract } = loaded;
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const fileSha = (path) => sha256(readFileSync(resolve(root, path)));

function directoryDigest(directory) {
  const files = [];
  const visit = (path) => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const child = join(path, entry.name);
      if (entry.isDirectory()) visit(child);
      else if (entry.isFile()) files.push(child);
    }
  };
  visit(resolve(root, directory));
  const lines = files.sort().map((path) => `${sha256(readFileSync(path))}  ${relative(root, path)}\n`);
  return { sha256: sha256(lines.join("")), files: lines.length };
}

const head = git("rev-parse", "HEAD");
if (git("branch", "--show-current") !== "hotfix/production-report-recovery-20260729") throw new Error("manifest requires the approved hotfix branch");
if (git("status", "--porcelain", "--untracked-files=no")) throw new Error("tracked hotfix worktree is not clean");
if (contract.KIS_RELEASE_COMMIT_SHA !== head) throw new Error("runtime release SHA does not match HEAD");

const gates = JSON.parse(readFileSync(contract.KIS_PRODUCTION_GATE_EVIDENCE, "utf8"));
if (gates.status !== "pass" || gates.releaseCommitSha !== head) throw new Error("emergency quality gates are missing or stale");
const migrations = git("ls-files", "supabase/migrations/*.sql").split("\n").filter(Boolean).sort();
const migrationLines = migrations.map((path) => `${fileSha(path)}  ${path}\n`);
const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  emergencyRecovery: true,
  releaseCommitSha: head,
  releaseTreeSha: git("rev-parse", "HEAD^{tree}"),
  branch: git("branch", "--show-current"),
  dist: directoryDigest("dist"),
  packageLockSha256: fileSha("package-lock.json"),
  migrationsSha256: sha256(migrationLines.join("")),
  migrationFileCount: migrations.length,
  pendingMigrationAllowlist: [contract.KIS_PRODUCTION_PENDING_MIGRATION],
  databaseState: contract.KIS_PRODUCTION_DATABASE_STATE,
  wranglerSha256: fileSha("wrangler.jsonc"),
  workerBindings: ["ASSETS", "RATE_LIMITER_DO", "REPORT_EXPORT_QUEUE", "REPORT_EXPORT_BUCKET"],
  emergencyFeatureState: { reports: contract.KIS_PRODUCTION_REPORTS_FEATURE_STATE, exports: "disabled" },
  bootstrapHrVerification: { id: "acc-hr-001", role: "hr", expectedCount: 1 },
  qualityGateEvidenceSha256: sha256(readFileSync(contract.KIS_PRODUCTION_GATE_EVIDENCE)),
  productionRuntimeSha256: sha256(readFileSync(loaded.path)),
  previousWorkerVersion: contract.KIS_PRODUCTION_EXPECTED_ACTIVE_WORKER_VERSION,
  compatibleRollbackVersion: contract.KIS_PRODUCTION_COMPATIBLE_ROLLBACK_VERSION,
  recoveryEvidenceSha256: fileSha("docs/audit-remediation/evidence/PRODUCTION_TWO_ROLE_GO_LIVE.json"),
};
const path = resolve(contract.KIS_PRODUCTION_RELEASE_MANIFEST);
writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
chmodSync(path, 0o600);
if ((statSync(path).mode & 0o777) !== 0o600) throw new Error("emergency manifest must have mode 0600");
console.log(JSON.stringify({ manifestPath: path, releaseCommitSha: head, distSha256: manifest.dist.sha256, migrationsSha256: manifest.migrationsSha256 }, null, 2));
