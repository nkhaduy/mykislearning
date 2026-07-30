import { execFileSync } from "node:child_process";
import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_GATE_EVIDENCE_FILE,
  DEFAULT_RELEASE_APPROVAL_FILE,
  loadSecureRuntime,
  releaseApprovalChecksum,
  sha256,
} from "./runtime-contract.mjs";

const root = resolve(process.env.KIS_PRODUCTION_RELEASE_SOURCE_ROOT || fileURLToPath(new URL("../..", import.meta.url)));
const loaded = loadSecureRuntime();
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), "utf8"));
const releaseCommitSha = git("rev-parse", "HEAD");
const approvedBranch = git("branch", "--show-current");

if (!approvedBranch.startsWith("release/") || /[*?[\]]/.test(approvedBranch)) {
  throw new Error("release approval requires one exact release branch");
}
if (loaded.contract.KIS_RELEASE_COMMIT_SHA !== releaseCommitSha) {
  throw new Error("secure runtime release SHA does not match HEAD");
}
if (git("status", "--porcelain", "--untracked-files=no")) {
  throw new Error("tracked release worktree is not clean");
}

const gates = JSON.parse(readFileSync(resolve(loaded.contract.KIS_PRODUCTION_GATE_EVIDENCE || DEFAULT_GATE_EVIDENCE_FILE), "utf8"));
const roleAudit = readJson("docs/audit-remediation/evidence/CLEAN_ROOM_ROLE_AUDIT.json");
const backup = readJson("docs/audit-remediation/evidence/PRODUCTION_BACKUP_RESTORE.json");
const migration = readJson("docs/audit-remediation/evidence/PRODUCTION_MIGRATION_HISTORY_RECONCILIATION.json");
const alerts = readJson("docs/audit-remediation/evidence/PRODUCTION_ALERT_READINESS.json");
const credentialRotation = readJson("docs/audit-remediation/evidence/PRODUCTION_CREDENTIAL_ROTATION.json");
const target = readJson("docs/audit-remediation/evidence/PRODUCTION_TARGET_DISCOVERY.json");

const auditResults = {
  qualityGates: gates.status === "pass" && gates.releaseCommitSha === releaseCommitSha ? "PASS" : "FAIL",
  cleanRoomRoleAudit: roleAudit.remainingBlockers === 0 ? "PASS" : "FAIL",
  backupRestore: backup.status === "pass" ? "PASS" : "FAIL",
  migrationReconciliation: migration.status === "pass" ? "PASS" : "FAIL",
  alertPolicyVerification: alerts.status === "verified" && alerts.criticalPoliciesConfigured ? "PASS" : "FAIL",
  alertDeliveryTest: alerts.deliveryTested && alerts.deliveryTest?.apiSuccess ? "PASS" : "FAIL",
  securityRegression: credentialRotation.securityRegression === "PASS" ? "PASS" : "FAIL",
};
const credentialRotationResult = {
  newCredentialVerified: credentialRotation.newCredentialVerified,
  oldExposedCredentialRevoked: credentialRotation.oldExposedCredentialRevoked,
  activeExposedCloudflareCredentials: credentialRotation.activeExposedCloudflareCredentials,
  credentialFingerprint: credentialRotation.credentials?.cloudflareDeploymentToken?.fingerprint || null,
};
if (Object.values(auditResults).some((value) => value !== "PASS")) throw new Error("release approval audit results are not all PASS");
if (credentialRotationResult.newCredentialVerified !== "PASS"
  || credentialRotationResult.oldExposedCredentialRevoked !== "PASS"
  || credentialRotationResult.activeExposedCloudflareCredentials !== 0) {
  throw new Error("release approval credential rotation is incomplete");
}

const now = new Date();
const maintenanceEnd = String(loaded.contract.KIS_PRODUCTION_MAINTENANCE_WINDOW || "").split("/")[1];
const validUntil = maintenanceEnd && Number.isFinite(new Date(maintenanceEnd).getTime())
  ? new Date(maintenanceEnd)
  : new Date(now.getTime() + 24 * 60 * 60 * 1000);
if (validUntil <= now) throw new Error("release approval validity window has expired");

const artifact = {
  schemaVersion: 1,
  status: "APPROVED",
  approvalId: loaded.contract.KIS_PRODUCTION_APPROVAL_ID,
  owner: "Nguyễn Khả Duy",
  approvedBranch,
  approvedCommitSha: releaseCommitSha,
  approvedAt: now.toISOString(),
  validUntil: validUntil.toISOString(),
  auditResults,
  credentialRotationResult,
  rollbackWorkerVersion: target.cloudflare.currentVersionId,
  checksumAlgorithm: "sha256",
};
artifact.checksum = releaseApprovalChecksum(artifact);

const artifactPath = resolve(loaded.contract.KIS_PRODUCTION_RELEASE_APPROVAL_FILE || DEFAULT_RELEASE_APPROVAL_FILE);
const bytes = `${JSON.stringify(artifact, null, 2)}\n`;
writeFileSync(artifactPath, bytes, { mode: 0o600 });
chmodSync(artifactPath, 0o600);
loaded.contract.KIS_PRODUCTION_RELEASE_APPROVAL_FILE = artifactPath;
loaded.contract.KIS_PRODUCTION_RELEASE_APPROVAL_SHA256 = sha256(bytes);
loaded.contract.KIS_PRODUCTION_RELEASE_APPROVAL_ID = artifact.approvalId;
loaded.contract.KIS_PRODUCTION_RELEASE_APPROVAL_CHECKSUM = artifact.checksum;
loaded.runtime.updatedAt = now.toISOString();
writeFileSync(loaded.path, `${JSON.stringify(loaded.runtime, null, 2)}\n`, { mode: 0o600 });
chmodSync(loaded.path, 0o600);

console.log(JSON.stringify({
  artifactFile: basename(artifactPath),
  mode: "0600",
  approvalId: artifact.approvalId,
  approvedBranch,
  approvedCommitSha: releaseCommitSha,
  validUntil: artifact.validUntil,
  checksum: artifact.checksum,
}, null, 2));
