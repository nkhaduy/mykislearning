import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { loadSecureRuntime, sha256 } from "../../scripts/production/runtime-contract.mjs";
import { ProductionApprovalError, verifyProductionApproval } from "../../scripts/production/verify-production-approval.mjs";
import { PURGE_TABLES } from "../../scripts/production/clean-reset/production-clean-reset-common.mjs";

const confirmation = "Tôi hiểu và chấp nhận rủi ro còn lại khi tài khoản HR vận hành không có MFA/2FA. Tôi xác nhận đây là quyết định có chủ đích của chủ dự án, đồng thời chấp nhận áp dụng các biện pháp bù trừ gồm mật khẩu mạnh, refresh-token rotation, session revocation, rate limiting, audit logging, giám sát sự cố và quy trình khóa tài khoản.";
const write = (root, path, value) => {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`);
};
const git = (root, ...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

function fixture({ alertsVerified = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), "kis-production-verifier-test-"));
  const canonical = {
    versionId: "1c8d06e9-393e-4eff-917c-5761a23ddc89",
    workerName: "mykis-learning-staging",
    queueName: "kis-lms-export-staging",
    r2BucketName: "kis-lms-exports-staging",
    supabaseProjectRef: "vwawtqbkchmdnqetkewm",
    smoke: { status: "pass" },
  };
  write(root, "package-lock.json", "{}\n");
  write(root, "wrangler.jsonc", "{}\n");
  write(root, "dist/index.html", "ready\n");
  write(root, "supabase/migrations/20260727172321_reconcile_legacy_department_schema.sql", "alter table public.course_versions validate constraint course_versions_course_id_fkey;\n");
  const migrationLine = `${sha256(readFileSync(join(root, "supabase/migrations/20260727172321_reconcile_legacy_department_schema.sql")))}  supabase/migrations/20260727172321_reconcile_legacy_department_schema.sql\n`;
  canonical.packageLockSha256 = sha256(readFileSync(join(root, "package-lock.json")));
  canonical.migrationListSha256 = sha256(migrationLine);
  write(root, "docs/audit-remediation/evidence/CANONICAL_STAGING_RELEASE.json", canonical);
  write(root, "docs/audit-remediation/STAGING_OPERATIONAL_READINESS_REPORT.md", "STAGING READY WITH OPERATIONAL FOLLOW-UP\n");
  write(root, "docs/audit-remediation/NO_MFA_SECURITY_ACCEPTANCE.md", `Status: **Accepted**\n- Incident response owner: Nguyễn Khả Duy\n- Approved by: Nguyễn Khả Duy\n- Confirmation: ${confirmation}\n`);
  write(root, "docs/audit-remediation/evidence/PRODUCTION_TARGET_DISCOVERY.json", {
    cloudflare: { accountId: "b9ae472cee29c5729ee90ccbb3533f33", workerName: "mykis-learning", hostname: "kislms.site", customDomainVerified: true, currentDeploymentId: "deployment-current", currentVersionId: "version-current" },
    supabase: { projectRef: "mooqdtiedfamnlpitqtq", status: "ACTIVE_HEALTHY", evidence: ["worker config", "migration history"] },
    stagingIsolation: { resourcesDistinct: true },
  });
  write(root, "docs/audit-remediation/evidence/PRODUCTION_RESOURCE_INVENTORY.json", {
    status: "provisioned", accountId: "b9ae472cee29c5729ee90ccbb3533f33", worker: { name: "mykis-learning", durableObjectBinding: "RATE_LIMITER_DO", cron: "0 * * * *" },
    queue: { name: "mykis-report-exports", expectedBatchSize: 3, expectedMaxConcurrency: 3 }, dlq: { name: "mykis-report-exports-dlq" },
    r2: { name: "mykis-report-exports", publicDevUrlEnabled: false }, stagingResourcesReused: false,
  });
  write(root, "docs/audit-remediation/evidence/PRODUCTION_BACKUP_RESTORE.json", {
    backupId: "LOGICAL-TEST-BACKUP", projectRef: "mooqdtiedfamnlpitqtq", status: "pass", rowCountsMatch: true, catalogMatch: true,
    integrityPass: true, applicationContractSmoke: true, sourcePreflightReady: false, sourceCatalog: { invalid_indexes: 0, unvalidated_foreign_keys: 1 },
  });
  write(root, "docs/audit-remediation/evidence/PRODUCTION_ALERT_READINESS.json", {
    status: alertsVerified ? "verified" : "blocked-permission",
    apiAlertingAccess: alertsVerified,
    deliveryTested: alertsVerified,
    criticalPoliciesConfigured: alertsVerified,
  });
  const cleanResetAllowlistSha256 = sha256(JSON.stringify([...PURGE_TABLES].sort()));
  write(root, "docs/audit-remediation/evidence/CLEAN_ROOM_ROLE_AUDIT.json", {
    canonicalRoles: ["hr", "employee"],
    trainerRoleCount: 0,
    adminRoleCount: 0,
    unknownRoleCount: 0,
    activeApplicationRoleSurfaces: { trainerRoutes: 0, adminRoleRoutes: 0, trainerPolicies: 0, adminRolePolicies: 0 },
    migration: { cleanReplay: "PASS", legacyCleanReset: "PASS", schemaEquivalence: "PASS", rollbackRestoreRehearsal: "PASS" },
    roles: { employee: { status: "PASS" }, hr: { status: "PASS" } },
    invalidLegacyRoleAudit: "PASS",
    remainingBlockers: 0,
  });
  write(root, "docs/audit-remediation/evidence/PRODUCTION_CLEAN_RESET_REHEARSAL.json", {
    legacyCleanResetRehearsal: { status: "pass", rollbackRestoreRehearsal: "pass", bootstrapHrRecovery: "pass" },
    schemaEquivalence: { status: "pass" },
    idempotency: { status: "pass" },
    cleanResetAllowlist: { tableCount: PURGE_TABLES.length, sha256: cleanResetAllowlistSha256, forbiddenSchemasPresent: false },
    pendingMigrations: { expected: 8, applied: 8, status: "pass" },
  });
  git(root, "init", "-q");
  git(root, "config", "user.name", "Verifier Test");
  git(root, "config", "user.email", "verifier@example.invalid");
  git(root, "add", ".");
  git(root, "commit", "-qm", "fixture");
  git(root, "branch", "-M", "release/kis-lms-production-20260728-test");
  const head = git(root, "rev-parse", "HEAD");
  const tree = git(root, "rev-parse", "HEAD^{tree}");
  const contract = {
    KIS_ALLOW_PRODUCTION_MUTATION: "true", APP_ENV: "production", KIS_ALLOW_PRODUCTION_DEPLOYMENT: "true",
    KIS_PRODUCTION_EXECUTION_CONFIRM: "EXECUTE_REVIEWED_PRODUCTION_PLAN_ONCE",
    KIS_PRODUCTION_CLOUDFLARE_ACCOUNT_ID: "b9ae472cee29c5729ee90ccbb3533f33", KIS_PRODUCTION_WORKER_NAME: "mykis-learning", KIS_PRODUCTION_HOSTNAME: "kislms.site",
    KIS_PRODUCTION_QUEUE_NAME: "mykis-report-exports", KIS_PRODUCTION_DLQ_NAME: "mykis-report-exports-dlq", KIS_PRODUCTION_R2_BUCKET_NAME: "mykis-report-exports",
    KIS_PRODUCTION_SUPABASE_PROJECT_REF: "mooqdtiedfamnlpitqtq", KIS_PRODUCTION_SUPABASE_URL: "https://mooqdtiedfamnlpitqtq.supabase.co",
    KIS_PRODUCTION_DATABASE_URL: "postgresql://postgres.mooqdtiedfamnlpitqtq@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres",
    KIS_PRODUCTION_TARGET_ALLOWLIST: "account:b9ae472cee29c5729ee90ccbb3533f33,worker:mykis-learning,hostname:kislms.site,project:mooqdtiedfamnlpitqtq,queue:mykis-report-exports,dlq:mykis-report-exports-dlq,r2:mykis-report-exports",
    KIS_PRODUCTION_ONE_TIME_APPROVAL_TOKEN: "x".repeat(64), KIS_PRODUCTION_APPROVAL_ID: `OWNER-PRODUCTION-20260728T000000Z-${head.slice(0, 8)}`,
    KIS_PRODUCTION_APPROVED_BY: "Nguyễn Khả Duy", KIS_PRODUCTION_CHANGE_OWNER: "Nguyễn Khả Duy", KIS_PRODUCTION_ROLLBACK_OWNER: "Nguyễn Khả Duy",
    KIS_PRODUCTION_MAINTENANCE_WINDOW: "2026-07-28T20:00:00+07:00/2026-07-28T23:00:00+07:00",
    KIS_PRODUCTION_CLEAN_RESET_ALLOWLIST_APPROVED: "true",
    KIS_PRODUCTION_CLEAN_RESET_ALLOWLIST_SHA256: cleanResetAllowlistSha256,
    KIS_CANONICAL_STAGING_VERSION: canonical.versionId, KIS_RELEASE_COMMIT_SHA: head,
  };
  const gatesPath = join(root, "quality-gates.json");
  writeFileSync(gatesPath, `${JSON.stringify({ status: "pass", releaseCommitSha: head })}\n`);
  const manifestPath = join(root, "release-manifest.json");
  const buildLine = `${sha256(readFileSync(join(root, "dist/index.html")))}  dist/index.html\n`;
  writeFileSync(manifestPath, `${JSON.stringify({
    releaseCommitSha: head, releaseTreeSha: tree, packageLockSha256: canonical.packageLockSha256, migrationsSha256: canonical.migrationListSha256,
    wranglerSha256: sha256(readFileSync(join(root, "wrangler.jsonc"))), stagingReportSha256: sha256(readFileSync(join(root, "docs/audit-remediation/STAGING_OPERATIONAL_READINESS_REPORT.md"))),
    canonicalStagingEvidenceSha256: sha256(readFileSync(join(root, "docs/audit-remediation/evidence/CANONICAL_STAGING_RELEASE.json"))), build: { sha256: sha256(buildLine), files: 1 },
    canonicalStagingVersion: canonical.versionId, productionBackupId: contract.KIS_PRODUCTION_BACKUP_ID = "LOGICAL-TEST-BACKUP", productionApprovalId: contract.KIS_PRODUCTION_APPROVAL_ID,
    qualityGateEvidenceSha256: sha256(readFileSync(gatesPath)),
  })}\n`);
  contract.KIS_PRODUCTION_RELEASE_MANIFEST = manifestPath;
  contract.KIS_PRODUCTION_GATE_EVIDENCE = gatesPath;
  return { root, contract, consumptionFile: join(root, "unused-consumption.json") };
}

test("production verifier accepts the complete canonical contract without exposing secrets", () => {
  const state = fixture();
  try {
    const result = verifyProductionApproval(state.contract, {
      root: state.root, now: "2026-07-28T14:30:00.000Z", consumptionFile: state.consumptionFile,
      providerSecretNames: ["AUDIT_IP_HASH_SALT", "CURSOR_SIGNING_SECRET", "JWT_SECRET", "RATE_LIMIT_KEY_SECRET", "REFRESH_TOKEN_HASH_SECRET", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_URL"],
      providerDeployment: { deploymentId: "deployment-current", versionId: "version-current" },
    });
    assert.equal(result.environment, "production");
    assert.doesNotMatch(JSON.stringify(result), /x{16}/);
  } finally { rmSync(state.root, { recursive: true, force: true }); }
});

test("production verifier reports only the real alert blocker when alert delivery is unavailable", () => {
  const state = fixture({ alertsVerified: false });
  try {
    assert.throws(() => verifyProductionApproval(state.contract, {
      root: state.root, now: "2026-07-28T14:30:00.000Z", consumptionFile: state.consumptionFile,
      providerSecretNames: ["AUDIT_IP_HASH_SALT", "CURSOR_SIGNING_SECRET", "JWT_SECRET", "RATE_LIMIT_KEY_SECRET", "REFRESH_TOKEN_HASH_SECRET", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_URL"],
      providerDeployment: { deploymentId: "deployment-current", versionId: "version-current" },
    }), (error) => error instanceof ProductionApprovalError && error.blockers.length === 1 && /critical alerts/.test(error.blockers[0]));
  } finally { rmSync(state.root, { recursive: true, force: true }); }
});

test("plan verification can precede manifest generation while apply verification cannot", () => {
  const state = fixture();
  try {
    rmSync(state.contract.KIS_PRODUCTION_RELEASE_MANIFEST);
    const options = {
      root: state.root, now: "2026-07-28T14:30:00.000Z", consumptionFile: state.consumptionFile,
      providerSecretNames: ["AUDIT_IP_HASH_SALT", "CURSOR_SIGNING_SECRET", "JWT_SECRET", "RATE_LIMIT_KEY_SECRET", "REFRESH_TOKEN_HASH_SECRET", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_URL"],
      providerDeployment: { deploymentId: "deployment-current", versionId: "version-current" },
    };
    const plan = verifyProductionApproval(state.contract, { ...options, allowMissingManifest: true });
    assert.equal(plan.releaseManifest, null);
    assert.throws(() => verifyProductionApproval(state.contract, options), /release manifest is missing or invalid/);
  } finally { rmSync(state.root, { recursive: true, force: true }); }
});

test("production verifier requires passing migration reconciliation evidence and an exact pending allowlist", () => {
  const state = fixture();
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
  const evidencePath = join(state.root, "migration-reconciliation.json");
  try {
    writeFileSync(evidencePath, `${JSON.stringify({
      schemaVersion: 1,
      status: "pass",
      projectRef: state.contract.KIS_PRODUCTION_SUPABASE_PROJECT_REF,
      releaseCommitSha: state.contract.KIS_RELEASE_COMMIT_SHA,
      remoteOnlyCount: 0,
      approvedBaselineMapping: { status: "approved" },
      schemaDiff: { status: "approved" },
      disposableRehearsal: { status: "pass" },
      repairEvidenceChecksum: "a".repeat(64),
      pendingProductionMigrations: pending,
    })}\n`);
    const result = verifyProductionApproval(state.contract, {
      root: state.root,
      now: "2026-07-28T14:30:00.000Z",
      consumptionFile: state.consumptionFile,
      requireMigrationReconciliation: true,
      migrationReconciliationEvidence: evidencePath,
      providerMigrationReconciliation: { remoteOnlyCount: 0, pendingProductionMigrations: pending, dryRunStatus: "pass" },
      providerSecretNames: ["AUDIT_IP_HASH_SALT", "CURSOR_SIGNING_SECRET", "JWT_SECRET", "RATE_LIMIT_KEY_SECRET", "REFRESH_TOKEN_HASH_SECRET", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_URL"],
      providerDeployment: { deploymentId: "deployment-current", versionId: "version-current" },
    });
    assert.equal(result.migrationReconciliation.status, "pass");

    assert.throws(() => verifyProductionApproval(state.contract, {
      root: state.root,
      now: "2026-07-28T14:30:00.000Z",
      consumptionFile: state.consumptionFile,
      requireMigrationReconciliation: true,
      migrationReconciliationEvidence: evidencePath,
      providerMigrationReconciliation: { remoteOnlyCount: 1, pendingProductionMigrations: pending, dryRunStatus: "pass" },
      providerSecretNames: ["AUDIT_IP_HASH_SALT", "CURSOR_SIGNING_SECRET", "JWT_SECRET", "RATE_LIMIT_KEY_SECRET", "REFRESH_TOKEN_HASH_SECRET", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_URL"],
      providerDeployment: { deploymentId: "deployment-current", versionId: "version-current" },
    }), /unexplained remote-only/);
  } finally { rmSync(state.root, { recursive: true, force: true }); }
});

test("production verifier requires clean-reset readiness and zero role-audit blockers", () => {
  const state = fixture();
  try {
    const options = {
      root: state.root,
      now: "2026-07-28T14:30:00.000Z",
      consumptionFile: state.consumptionFile,
      requireCleanResetReadiness: true,
      providerSecretNames: ["AUDIT_IP_HASH_SALT", "CURSOR_SIGNING_SECRET", "JWT_SECRET", "RATE_LIMIT_KEY_SECRET", "REFRESH_TOKEN_HASH_SECRET", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_URL"],
      providerDeployment: { deploymentId: "deployment-current", versionId: "version-current" },
    };
    const result = verifyProductionApproval(state.contract, options);
    assert.equal(result.cleanResetReadiness.status, "pass");
    const roleAuditPath = join(state.root, "docs/audit-remediation/evidence/CLEAN_ROOM_ROLE_AUDIT.json");
    const roleAudit = JSON.parse(readFileSync(roleAuditPath, "utf8"));
    roleAudit.remainingBlockers = 1;
    writeFileSync(roleAuditPath, `${JSON.stringify(roleAudit)}\n`);
    assert.throws(() => verifyProductionApproval(state.contract, options), /remaining blocker/);
  } finally { rmSync(state.root, { recursive: true, force: true }); }
});

test("production plan requires active clean-reset gates, an exact manifest, and a 90-minute window", () => {
  const source = readFileSync(new URL("../../scripts/production/deploy-production.mjs", import.meta.url), "utf8");
  assert.match(source, /requireActiveWindow:\s*true/);
  assert.match(source, /requireCleanResetReadiness:\s*true/);
  assert.match(source, /allowMissingManifest:\s*false/);

  const state = fixture();
  try {
    state.contract.KIS_PRODUCTION_MAINTENANCE_WINDOW = "2026-07-28T20:00:00+07:00/2026-07-28T21:00:00+07:00";
    assert.throws(() => verifyProductionApproval(state.contract, {
      root: state.root,
      now: "2026-07-28T13:30:00.000Z",
      consumptionFile: state.consumptionFile,
      requireActiveWindow: true,
      providerSecretNames: ["AUDIT_IP_HASH_SALT", "CURSOR_SIGNING_SECRET", "JWT_SECRET", "RATE_LIMIT_KEY_SECRET", "REFRESH_TOKEN_HASH_SECRET", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_URL"],
      providerDeployment: { deploymentId: "deployment-current", versionId: "version-current" },
    }), /at least 90 minutes/);
  } finally { rmSync(state.root, { recursive: true, force: true }); }
});

test("secure runtime loader refuses permissive files", () => {
  const directory = mkdtempSync(join(tmpdir(), "kis-runtime-mode-test-"));
  const path = join(directory, "runtime.json");
  try {
    writeFileSync(path, JSON.stringify({ schemaVersion: 1, contract: {}, secrets: {} }), { mode: 0o644 });
    chmodSync(path, 0o644);
    assert.throws(() => loadSecureRuntime(path), /0600/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
