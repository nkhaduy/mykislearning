import { execFileSync } from "node:child_process";
import { chmodSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_GATE_EVIDENCE_FILE,
  DEFAULT_MANIFEST_FILE,
  DEFAULT_MIGRATION_RECONCILIATION_EVIDENCE,
  DEFAULT_OWNER_POLICY_FILE,
  loadSecureRuntime,
  sha256,
} from "./runtime-contract.mjs";
import { PURGE_TABLES } from "./clean-reset/production-clean-reset-common.mjs";

const root = resolve(process.env.KIS_PRODUCTION_RELEASE_SOURCE_ROOT || fileURLToPath(new URL("../..", import.meta.url)));
const runtimeFile = process.env.KIS_PRODUCTION_RUNTIME_FILE;
const loaded = loadSecureRuntime(runtimeFile);
const { contract } = loaded;
const ownerPolicyPath = contract.KIS_PRODUCTION_OWNER_POLICY_FILE
  ? resolve(contract.KIS_PRODUCTION_OWNER_POLICY_FILE)
  : resolve(fileURLToPath(new URL("../..", import.meta.url)), DEFAULT_OWNER_POLICY_FILE);
const ownerPolicy = JSON.parse(readFileSync(ownerPolicyPath, "utf8"));
const manifestPath = resolve(contract.KIS_PRODUCTION_RELEASE_MANIFEST || DEFAULT_MANIFEST_FILE);
const gateEvidencePath = resolve(contract.KIS_PRODUCTION_GATE_EVIDENCE || DEFAULT_GATE_EVIDENCE_FILE);

const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const fileSha256 = (path) => sha256(readFileSync(resolve(root, path)));

function listFiles(directory) {
  const absolute = resolve(root, directory);
  const files = [];
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    const path = join(absolute, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(relative(root, path)));
    else if (entry.isFile()) files.push(path);
  }
  return files.sort();
}

function directoryDigest(directory) {
  const lines = listFiles(directory).map((path) => `${sha256(readFileSync(path))}  ${relative(root, path)}\n`);
  return { sha256: sha256(lines.join("")), files: lines.length };
}

const releaseCommitSha = git("rev-parse", "HEAD");
if (contract.KIS_RELEASE_COMMIT_SHA !== releaseCommitSha) throw new Error("runtime release SHA does not match HEAD");
if (git("status", "--porcelain", "--untracked-files=no")) throw new Error("tracked release worktree is not clean");

const migrationFiles = listFiles("supabase/migrations").filter((path) => basename(path).endsWith(".sql"));
const migrationLines = migrationFiles.map((path) => `${sha256(readFileSync(path))}  ${relative(root, path)}\n`);
const gateEvidence = JSON.parse(readFileSync(gateEvidencePath, "utf8"));
if (gateEvidence.status !== "pass" || gateEvidence.releaseCommitSha !== releaseCommitSha) {
  throw new Error("quality gate evidence is not a passing result for this release commit");
}

const canonicalStaging = JSON.parse(readFileSync(resolve(root, "docs/audit-remediation/evidence/CANONICAL_STAGING_RELEASE.json"), "utf8"));
const packageLockSha256 = fileSha256("package-lock.json");
const migrationsSha256 = sha256(migrationLines.join(""));
const approvedPostStagingMigrationNames = new Set([
  "20260729022415_consolidate_roles_to_hr_and_employee.sql",
  "20260729121500_fix_reporting_rpc_enrollment_compatibility.sql",
]);
const postStagingMigrationFiles = migrationFiles.filter((path) => approvedPostStagingMigrationNames.has(basename(path)));
const stagingMigrationLines = migrationFiles
  .filter((path) => !approvedPostStagingMigrationNames.has(basename(path)))
  .map((path) => `${sha256(readFileSync(path))}  ${relative(root, path)}\n`);
if (canonicalStaging.packageLockSha256 !== packageLockSha256 || canonicalStaging.migrationListSha256 !== sha256(stagingMigrationLines.join(""))) {
  throw new Error("release lockfile or migrations do not match the canonical staging rehearsal");
}
const targetPath = resolve(root, contract.KIS_PRODUCTION_TARGET_EVIDENCE || "docs/audit-remediation/evidence/PRODUCTION_TARGET_DISCOVERY.json");
const reconciliationPath = resolve(root, contract.KIS_PRODUCTION_MIGRATION_RECONCILIATION_EVIDENCE || DEFAULT_MIGRATION_RECONCILIATION_EVIDENCE);
const target = JSON.parse(readFileSync(targetPath, "utf8"));
const reconciliation = JSON.parse(readFileSync(reconciliationPath, "utf8"));
const runtimeSha256 = sha256(readFileSync(loaded.path));
const allowlistSha256 = sha256(JSON.stringify([...PURGE_TABLES].sort()));
const ownerApprovalPath = "docs/audit-remediation/evidence/PRODUCTION_CLEAN_RESET_OWNER_APPROVAL.json";
const twoRoleContractPath = "docs/audit-remediation/evidence/TWO_ROLE_AUTHORIZATION_CONTRACT.json";
const backupEvidencePath = "docs/audit-remediation/evidence/PRODUCTION_BACKUP_RESTORE.json";
const testEvidencePaths = [
  "docs/audit-remediation/evidence/CLEAN_ROOM_ROLE_AUDIT.json",
  "docs/audit-remediation/evidence/PRODUCTION_CLEAN_RESET_REHEARSAL.json",
  reconciliationPath,
  twoRoleContractPath,
];
const testEvidenceSha256 = sha256(testEvidencePaths.map((path) => `${fileSha256(path)}  ${path}\n`).join(""));
const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  releaseCommitSha,
  releaseTreeSha: git("rev-parse", "HEAD^{tree}"),
  branch: git("branch", "--show-current"),
  packageLockSha256,
  migrationsSha256,
  migrationFileCount: migrationFiles.length,
  approvedPostStagingMigrations: postStagingMigrationFiles.map((path) => relative(root, path)),
  wranglerSha256: fileSha256("wrangler.jsonc"),
  stagingReportSha256: fileSha256("docs/audit-remediation/STAGING_OPERATIONAL_READINESS_REPORT.md"),
  canonicalStagingEvidenceSha256: fileSha256("docs/audit-remediation/evidence/CANONICAL_STAGING_RELEASE.json"),
  build: directoryDigest("dist"),
  canonicalStagingVersion: canonicalStaging.versionId,
  productionApprovalId: contract.KIS_PRODUCTION_APPROVAL_ID,
  ownerPolicyId: ownerPolicy.policyId,
  ownerPolicySha256: sha256(readFileSync(ownerPolicyPath)),
  productionBackupId: contract.KIS_PRODUCTION_BACKUP_ID,
  previousProductionDeploymentId: target.cloudflare.currentDeploymentId,
  previousProductionVersionId: target.cloudflare.currentVersionId,
  qualityGateEvidenceSha256: sha256(readFileSync(gateEvidencePath)),
  productionRuntimeSha256: runtimeSha256,
  cleanResetAllowlistSha256: allowlistSha256,
  cleanResetOwnerApprovalSha256: fileSha256(ownerApprovalPath),
  pendingMigrationAllowlist: reconciliation.pendingProductionMigrations,
  rollbackWorkerVersion: contract.KIS_PRODUCTION_ROLLBACK_WORKER_VERSION || target.cloudflare.currentVersionId,
  backupEvidenceSha256: fileSha256(backupEvidencePath),
  twoRoleContractSha256: fileSha256(twoRoleContractPath),
  testEvidenceSha256,
};
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
chmodSync(manifestPath, 0o600);
console.log(JSON.stringify({
  manifestPath,
  releaseCommitSha,
  releaseTreeSha: manifest.releaseTreeSha,
  buildSha256: manifest.build.sha256,
  migrationsSha256: manifest.migrationsSha256,
}, null, 2));
