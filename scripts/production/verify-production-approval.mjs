import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_GATE_EVIDENCE_FILE,
  DEFAULT_MANIFEST_FILE,
  loadSecureRuntime,
  sha256,
  tokenConsumptionFile,
} from "./runtime-contract.mjs";

const defaultRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const exactRiskConfirmation = "Tôi hiểu và chấp nhận rủi ro còn lại khi tài khoản HR và Admin vận hành không có MFA/2FA. Tôi xác nhận đây là quyết định có chủ đích của chủ dự án, đồng thời chấp nhận áp dụng các biện pháp bù trừ gồm mật khẩu mạnh, refresh-token rotation, session revocation, rate limiting, audit logging, giám sát sự cố và quy trình khóa tài khoản.";
const requiredSecretNames = [
  "AUDIT_IP_HASH_SALT",
  "CURSOR_SIGNING_SECRET",
  "JWT_SECRET",
  "RATE_LIMIT_KEY_SECRET",
  "REFRESH_TOKEN_HASH_SECRET",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_URL",
];

export class ProductionApprovalError extends Error {
  constructor(blockers) {
    super(`PRODUCTION_APPROVAL_REFUSED: ${blockers.join("; ")}`);
    this.blockers = blockers;
  }
}

const redact = (value) => {
  const text = String(value || "");
  return text.length <= 10 ? "<redacted>" : `${text.slice(0, 4)}...${text.slice(-4)}`;
};

function command(root, executable, args) {
  return execFileSync(executable, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function readJson(root, path, blockers, label) {
  try {
    return JSON.parse(readFileSync(resolve(root, path), "utf8"));
  } catch {
    blockers.push(`${label} evidence is missing or invalid`);
    return null;
  }
}

function directoryDigest(root, directory) {
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

function parseWindow(value, now, requireActive, blockers) {
  const match = String(value || "").match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?\+07:00)\/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?\+07:00)$/);
  if (!match) {
    blockers.push("a real Asia/Ho_Chi_Minh maintenance window is required in start/end ISO-8601 form");
    return null;
  }
  const start = new Date(match[1]);
  const end = new Date(match[2]);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start || end - start < 60 * 60 * 1000) {
    blockers.push("maintenance window must be valid and at least 60 minutes");
    return null;
  }
  if (end <= now) blockers.push("maintenance window has expired");
  if (requireActive && (now < start || now >= end)) blockers.push("production deploy is outside the approved maintenance window");
  return { start: start.toISOString(), end: end.toISOString(), state: now < start ? "scheduled" : now < end ? "active" : "expired" };
}

function liveSecretNames(root, workerName) {
  const executable = resolve(root, "node_modules/.bin/wrangler");
  const output = command(root, executable, ["secret", "list", "--name", workerName]);
  return JSON.parse(output).map((item) => item.name);
}

function liveDeployment(root, workerName) {
  const executable = resolve(root, "node_modules/.bin/wrangler");
  const deployments = JSON.parse(command(root, executable, ["deployments", "list", "--name", workerName, "--json"]));
  const current = deployments.at(-1);
  return current ? { deploymentId: current.id, versionId: current.versions?.find((item) => item.percentage === 100)?.version_id } : null;
}

export function verifyProductionApproval(input, options = {}) {
  const root = options.root || defaultRoot;
  const blockers = [];
  const required = [
    "KIS_PRODUCTION_BACKUP_ID", "KIS_PRODUCTION_CLOUDFLARE_ACCOUNT_ID", "KIS_PRODUCTION_WORKER_NAME",
    "KIS_PRODUCTION_HOSTNAME", "KIS_PRODUCTION_QUEUE_NAME", "KIS_PRODUCTION_DLQ_NAME", "KIS_PRODUCTION_R2_BUCKET_NAME",
    "KIS_PRODUCTION_SUPABASE_PROJECT_REF", "KIS_PRODUCTION_SUPABASE_URL", "KIS_PRODUCTION_DATABASE_URL",
    "KIS_PRODUCTION_TARGET_ALLOWLIST", "KIS_PRODUCTION_ONE_TIME_APPROVAL_TOKEN", "KIS_PRODUCTION_APPROVAL_ID",
    "KIS_PRODUCTION_APPROVED_BY", "KIS_PRODUCTION_CHANGE_OWNER", "KIS_PRODUCTION_ROLLBACK_OWNER",
    "KIS_CANONICAL_STAGING_VERSION", "KIS_RELEASE_COMMIT_SHA",
  ];
  for (const name of required) if (!String(input[name] || "").trim()) blockers.push(`${name} is missing`);
  if (input.KIS_ALLOW_PRODUCTION_MUTATION !== "true" || input.APP_ENV !== "production" || input.KIS_ALLOW_PRODUCTION_DEPLOYMENT !== "true") {
    blockers.push("explicit production mutation and deployment guards are not enabled");
  }
  if (input.KIS_PRODUCTION_EXECUTION_CONFIRM !== "EXECUTE_REVIEWED_PRODUCTION_PLAN_ONCE") blockers.push("exact production execution confirmation is missing");

  const accountId = String(input.KIS_PRODUCTION_CLOUDFLARE_ACCOUNT_ID || "").toLowerCase();
  const workerName = String(input.KIS_PRODUCTION_WORKER_NAME || "").toLowerCase();
  const hostname = String(input.KIS_PRODUCTION_HOSTNAME || "").toLowerCase();
  const projectRef = String(input.KIS_PRODUCTION_SUPABASE_PROJECT_REF || "").toLowerCase();
  const queueName = String(input.KIS_PRODUCTION_QUEUE_NAME || "").toLowerCase();
  const dlqName = String(input.KIS_PRODUCTION_DLQ_NAME || "").toLowerCase();
  const r2Name = String(input.KIS_PRODUCTION_R2_BUCKET_NAME || "").toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(accountId)) blockers.push("Cloudflare account ID is invalid");
  if (!/^[a-z0-9]{20}$/.test(projectRef)) blockers.push("Supabase project ref is invalid");
  if (/staging|stage|dev/i.test([workerName, hostname, queueName, dlqName, r2Name].join(" "))) blockers.push("a staging/development resource is present in the production target");

  const allowlist = new Set(String(input.KIS_PRODUCTION_TARGET_ALLOWLIST || "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean));
  for (const entry of [`account:${accountId}`, `worker:${workerName}`, `hostname:${hostname}`, `project:${projectRef}`, `queue:${queueName}`, `dlq:${dlqName}`, `r2:${r2Name}`]) {
    if (!allowlist.has(entry)) blockers.push(`${entry.split(":")[0]} target is not exactly allowlisted`);
  }

  try {
    const supabaseUrl = new URL(input.KIS_PRODUCTION_SUPABASE_URL);
    if (supabaseUrl.protocol !== "https:" || supabaseUrl.hostname !== `${projectRef}.supabase.co`) blockers.push("Supabase URL does not match the approved project");
  } catch { blockers.push("Supabase URL is invalid"); }
  try {
    const databaseUrl = new URL(input.KIS_PRODUCTION_DATABASE_URL);
    const user = decodeURIComponent(databaseUrl.username || "").toLowerCase();
    const host = databaseUrl.hostname.toLowerCase();
    const direct = host === `db.${projectRef}.supabase.co` && user === "postgres";
    const pooler = host.endsWith(".pooler.supabase.com") && user === `postgres.${projectRef}`;
    if (!/^postgres(?:ql)?:$/.test(databaseUrl.protocol) || (!direct && !pooler)) blockers.push("production database identity does not match the approved Supabase project");
  } catch { blockers.push("production database URL is invalid"); }
  if (String(input.KIS_PRODUCTION_ONE_TIME_APPROVAL_TOKEN || "").length < 48) blockers.push("one-time approval token is too short");
  if (!String(input.KIS_PRODUCTION_APPROVAL_ID || "").endsWith(`-${String(input.KIS_RELEASE_COMMIT_SHA || "").slice(0, 8)}`)) blockers.push("approval ID is not bound to the release commit");

  const noMfa = (() => { try { return readFileSync(resolve(root, "docs/audit-remediation/NO_MFA_SECURITY_ACCEPTANCE.md"), "utf8"); } catch { return ""; } })();
  if (!/^Status:\s*\*\*Accepted\*\*/m.test(noMfa)) blockers.push("No-MFA owner acceptance is not Accepted");
  if (!noMfa.includes(`- Approved by: ${input.KIS_PRODUCTION_APPROVED_BY}`)) blockers.push("production approver does not match No-MFA owner acceptance");
  if (!noMfa.includes(`- Incident response owner: ${input.KIS_PRODUCTION_CHANGE_OWNER}`)) blockers.push("incident/change owner does not match No-MFA acceptance");
  if (!noMfa.includes(`- Confirmation: ${exactRiskConfirmation}`)) blockers.push("No-MFA residual-risk confirmation is incomplete");

  const now = options.now ? new Date(options.now) : new Date();
  const maintenanceWindow = parseWindow(input.KIS_PRODUCTION_MAINTENANCE_WINDOW, now, Boolean(options.requireActiveWindow), blockers);
  const staging = readJson(root, "docs/audit-remediation/evidence/CANONICAL_STAGING_RELEASE.json", blockers, "canonical staging release");
  if (staging) {
    if (staging.versionId !== input.KIS_CANONICAL_STAGING_VERSION || staging.smoke?.status !== "pass" || staging.workerName !== "mykis-learning-staging") blockers.push("canonical stable staging release is not a passing verified deployment");
    if (staging.supabaseProjectRef === projectRef || staging.queueName === queueName || staging.r2BucketName === r2Name) blockers.push("production target reuses a staging resource");
  }

  const target = readJson(root, "docs/audit-remediation/evidence/PRODUCTION_TARGET_DISCOVERY.json", blockers, "production target discovery");
  if (target) {
    if (target.cloudflare?.accountId !== accountId || target.cloudflare?.workerName !== workerName || target.cloudflare?.hostname !== hostname || !target.cloudflare?.customDomainVerified) blockers.push("Cloudflare production identity does not match discovery evidence");
    if (target.supabase?.projectRef !== projectRef || target.supabase?.status !== "ACTIVE_HEALTHY" || !Array.isArray(target.supabase?.evidence) || target.supabase.evidence.length < 2) blockers.push("Supabase production identity is not independently verified");
    if (!target.stagingIsolation?.resourcesDistinct) blockers.push("production/staging isolation is not verified");
  }

  const resources = readJson(root, "docs/audit-remediation/evidence/PRODUCTION_RESOURCE_INVENTORY.json", blockers, "production resource inventory");
  if (resources) {
    const resourcePass = resources.status === "provisioned" && resources.accountId === accountId && resources.worker?.name === workerName
      && resources.worker?.durableObjectBinding === "RATE_LIMITER_DO" && resources.worker?.cron === "0 * * * *"
      && resources.queue?.name === queueName && resources.queue?.expectedBatchSize === 3 && resources.queue?.expectedMaxConcurrency === 3
      && resources.dlq?.name === dlqName && resources.r2?.name === r2Name && resources.r2?.publicDevUrlEnabled === false
      && resources.stagingResourcesReused === false;
    if (!resourcePass) blockers.push("production Queue/DLQ/R2/Durable Object/cron inventory is incomplete or mismatched");
  }

  const backup = readJson(root, "docs/audit-remediation/evidence/PRODUCTION_BACKUP_RESTORE.json", blockers, "production backup restore");
  if (backup) {
    const plannedForeignKeyValidation = backup.sourceCatalog?.invalid_indexes === 0 && backup.sourceCatalog?.unvalidated_foreign_keys === 1
      && readFileSync(resolve(root, "supabase/migrations/20260727172321_reconcile_legacy_department_schema.sql"), "utf8").includes("validate constraint");
    const backupPass = backup.backupId === input.KIS_PRODUCTION_BACKUP_ID && backup.projectRef === projectRef && backup.status === "pass"
      && backup.rowCountsMatch && backup.catalogMatch && backup.integrityPass && backup.applicationContractSmoke
      && (backup.sourcePreflightReady || plannedForeignKeyValidation);
    if (!backupPass) blockers.push("production backup/restore evidence is not a passing result for the approved project and migration plan");
  }

  const alerts = readJson(root, "docs/audit-remediation/evidence/PRODUCTION_ALERT_READINESS.json", blockers, "critical alert readiness");
  if (!alerts || alerts.status !== "verified" || !alerts.apiAlertingAccess || !alerts.deliveryTested || !alerts.criticalPoliciesConfigured) {
    blockers.push("Cloudflare critical alerts require Alerting permission, configured policies, and a successful delivery test");
  }

  let secretNames = options.providerSecretNames;
  try { secretNames ||= liveSecretNames(root, workerName); } catch { blockers.push("live production Worker secret-name inventory could not be verified"); }
  if (secretNames) {
    const names = new Set(secretNames);
    const missing = requiredSecretNames.filter((name) => !names.has(name));
    if (missing.length) blockers.push(`production Worker is missing required secret names: ${missing.join(", ")}`);
  }

  const manifestPath = input.KIS_PRODUCTION_RELEASE_MANIFEST || DEFAULT_MANIFEST_FILE;
  let manifest = null;
  try { manifest = JSON.parse(readFileSync(manifestPath, "utf8")); } catch { blockers.push("release manifest is missing or invalid"); }
  const gatePath = input.KIS_PRODUCTION_GATE_EVIDENCE || DEFAULT_GATE_EVIDENCE_FILE;
  let gates = null;
  try { gates = JSON.parse(readFileSync(gatePath, "utf8")); } catch { blockers.push("production quality-gate evidence is missing or invalid"); }

  let head = "";
  let tree = "";
  try {
    head = command(root, "git", ["rev-parse", "HEAD"]);
    tree = command(root, "git", ["rev-parse", "HEAD^{tree}"]);
    if (command(root, "git", ["status", "--porcelain", "--untracked-files=no"])) blockers.push("tracked release worktree is not clean");
    if (!command(root, "git", ["branch", "--show-current"]).startsWith("release/kis-lms-production-20260728")) blockers.push("HEAD is not on the approved production release branch");
  } catch { blockers.push("Git release identity could not be verified"); }
  if (head && head !== input.KIS_RELEASE_COMMIT_SHA) blockers.push("runtime release SHA does not match HEAD");
  if (manifest) {
    const migrationFiles = command(root, "git", ["ls-files", "supabase/migrations/*.sql"]).split("\n").filter(Boolean).sort();
    const migrationLines = migrationFiles.map((path) => `${sha256(readFileSync(resolve(root, path)))}  ${path}\n`);
    const expected = {
      releaseCommitSha: head,
      releaseTreeSha: tree,
      packageLockSha256: sha256(readFileSync(resolve(root, "package-lock.json"))),
      migrationsSha256: sha256(migrationLines.join("")),
      wranglerSha256: sha256(readFileSync(resolve(root, "wrangler.jsonc"))),
      stagingReportSha256: sha256(readFileSync(resolve(root, "docs/audit-remediation/STAGING_OPERATIONAL_READINESS_REPORT.md"))),
      canonicalStagingEvidenceSha256: sha256(readFileSync(resolve(root, "docs/audit-remediation/evidence/CANONICAL_STAGING_RELEASE.json"))),
    };
    for (const [name, value] of Object.entries(expected)) if (manifest[name] !== value) blockers.push(`release manifest ${name} checksum does not match the release source`);
    try {
      const build = directoryDigest(root, "dist");
      if (manifest.build?.sha256 !== build.sha256 || manifest.build?.files !== build.files) blockers.push("release manifest build checksum does not match dist");
    } catch { blockers.push("release build artifact is missing"); }
    if (gates && manifest.qualityGateEvidenceSha256 !== sha256(readFileSync(gatePath))) blockers.push("release manifest quality-gate checksum is stale");
    if (manifest.canonicalStagingVersion !== input.KIS_CANONICAL_STAGING_VERSION || manifest.productionBackupId !== input.KIS_PRODUCTION_BACKUP_ID || manifest.productionApprovalId !== input.KIS_PRODUCTION_APPROVAL_ID) blockers.push("release manifest is not bound to the approved staging/backup/approval package");
    if (staging && (manifest.packageLockSha256 !== staging.packageLockSha256 || manifest.migrationsSha256 !== staging.migrationListSha256)) blockers.push("release lockfile or migrations do not match the canonical staging rehearsal");
  }
  if (!gates || gates.status !== "pass" || gates.releaseCommitSha !== head) blockers.push("all production quality gates have not passed for the release commit");

  const consumptionPath = options.consumptionFile || tokenConsumptionFile(options.runtimeFile);
  const approvalFingerprint = sha256(String(input.KIS_PRODUCTION_ONE_TIME_APPROVAL_TOKEN || ""));
  if (existsSync(consumptionPath)) {
    try {
      const consumed = JSON.parse(readFileSync(consumptionPath, "utf8"));
      if (consumed.approvalFingerprint === approvalFingerprint) blockers.push("one-time production approval token has already been used");
      else blockers.push("an approval-consumption marker already exists for this runtime");
    } catch { blockers.push("approval-consumption marker is invalid"); }
  }

  let deployment = options.providerDeployment;
  try { deployment ||= liveDeployment(root, workerName); } catch { blockers.push("current production Worker rollback version could not be verified"); }
  if (target && deployment && (target.cloudflare?.currentDeploymentId !== deployment.deploymentId || target.cloudflare?.currentVersionId !== deployment.versionId)) blockers.push("production rollback version evidence is stale");

  if (blockers.length) throw new ProductionApprovalError([...new Set(blockers)]);
  return {
    environment: "production",
    releaseCommitSha: head,
    releaseTreeSha: tree,
    approvalId: input.KIS_PRODUCTION_APPROVAL_ID,
    approvalFingerprint: `sha256:${approvalFingerprint.slice(0, 12)}`,
    backupId: redact(input.KIS_PRODUCTION_BACKUP_ID),
    cloudflareAccountId: redact(accountId),
    workerName,
    hostname,
    supabaseProjectRef: redact(projectRef),
    canonicalStagingVersion: input.KIS_CANONICAL_STAGING_VERSION,
    maintenanceWindow,
    previousProductionVersionId: deployment.versionId,
    releaseManifest: basename(manifestPath),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const loaded = loadSecureRuntime();
    const target = verifyProductionApproval(loaded.contract, { runtimeFile: loaded.path });
    console.log(JSON.stringify({ mode: "plan-only", productionMutation: false, target }, null, 2));
    console.log("GO FOR PRODUCTION DEPLOYMENT");
  } catch (error) {
    const blockers = error instanceof ProductionApprovalError ? error.blockers : [error.message];
    console.error("PRODUCTION PLAN BLOCKED");
    for (const blocker of blockers) console.error(`- ${blocker}`);
    process.exit(2);
  }
}
