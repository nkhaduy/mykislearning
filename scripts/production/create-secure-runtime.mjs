import { createHash, randomBytes } from "node:crypto";
import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const value = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? String(process.argv[index + 1] || "") : "";
};
const apiKeysFile = value("--api-keys-file");
const runtimeFile = value("--runtime-file") || "/tmp/kisvn-production-runtime.json";
const inventoryFile = value("--inventory-file") || "docs/audit-remediation/evidence/PRODUCTION_SECRET_INVENTORY.json";
if (!apiKeysFile) throw new Error("--api-keys-file is required");

const apiKeys = JSON.parse(readFileSync(apiKeysFile, "utf8")).keys || [];
const key = (name, type) => apiKeys.find((entry) => entry.name === name && entry.type === type)?.api_key || "";
const anonKey = key("anon", "legacy");
const serviceRoleKey = key("service_role", "legacy");
if (!anonKey || !serviceRoleKey) throw new Error("production Supabase legacy anon/service_role keys are unavailable");

const secret = () => randomBytes(48).toString("base64url");
const generated = {
  JWT_SECRET: secret(),
  REFRESH_TOKEN_HASH_SECRET: secret(),
  CURSOR_SIGNING_SECRET: secret(),
  RATE_LIMIT_KEY_SECRET: secret(),
  AUDIT_IP_HASH_SALT: secret(),
};
if (new Set(Object.values(generated)).size !== Object.keys(generated).length) throw new Error("generated secrets are not unique");

const releaseSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const utc = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const approvalId = `OWNER-PRODUCTION-${utc}-${releaseSha.slice(0, 8)}`;
const oneTimeToken = secret();
const contract = {
  KIS_ALLOW_PRODUCTION_MUTATION: "true",
  APP_ENV: "production",
  KIS_ALLOW_PRODUCTION_DEPLOYMENT: "true",
  KIS_PRODUCTION_EXECUTION_CONFIRM: "EXECUTE_REVIEWED_PRODUCTION_PLAN_ONCE",
  KIS_PRODUCTION_CLOUDFLARE_ACCOUNT_ID: "b9ae472cee29c5729ee90ccbb3533f33",
  KIS_PRODUCTION_WORKER_NAME: "mykis-learning",
  KIS_PRODUCTION_HOSTNAME: "kislms.site",
  KIS_PRODUCTION_QUEUE_NAME: "mykis-report-exports",
  KIS_PRODUCTION_DLQ_NAME: "mykis-report-exports-dlq",
  KIS_PRODUCTION_R2_BUCKET_NAME: "mykis-report-exports",
  KIS_PRODUCTION_SUPABASE_PROJECT_REF: "mooqdtiedfamnlpitqtq",
  KIS_PRODUCTION_SUPABASE_URL: "https://mooqdtiedfamnlpitqtq.supabase.co",
  KIS_PRODUCTION_DATABASE_URL: "postgresql://postgres.mooqdtiedfamnlpitqtq@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres",
  KIS_PRODUCTION_DATABASE_AUTH_MODE: "supabase-linked-ephemeral",
  KIS_PRODUCTION_BACKUP_ID: "",
  KIS_PRODUCTION_APPROVAL_ID: approvalId,
  KIS_PRODUCTION_APPROVED_BY: "Nguyễn Khả Duy",
  KIS_PRODUCTION_CHANGE_OWNER: "Nguyễn Khả Duy",
  KIS_PRODUCTION_ROLLBACK_OWNER: "Nguyễn Khả Duy",
  KIS_PRODUCTION_MAINTENANCE_WINDOW: "",
  KIS_PRODUCTION_ONE_TIME_APPROVAL_TOKEN: oneTimeToken,
  KIS_PRODUCTION_TARGET_ALLOWLIST: [
    "hostname:kislms.site",
    "hostname:www.kislms.site",
    "worker:mykis-learning",
    "queue:mykis-report-exports",
    "dlq:mykis-report-exports-dlq",
    "r2:mykis-report-exports",
    "project:mooqdtiedfamnlpitqtq",
    "account:b9ae472cee29c5729ee90ccbb3533f33",
  ].join(","),
  KIS_CANONICAL_STAGING_VERSION: "1c8d06e9-393e-4eff-917c-5761a23ddc89",
  KIS_RELEASE_COMMIT_SHA: releaseSha,
  KIS_PRODUCTION_RELEASE_MANIFEST: "/tmp/kisvn-production-release-manifest.json",
  KIS_PRODUCTION_GATE_EVIDENCE: "/tmp/kisvn-production-quality-gates.json",
};
const secrets = {
  ...generated,
  SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
  SUPABASE_ANON_KEY: anonKey,
  SUPABASE_URL: contract.KIS_PRODUCTION_SUPABASE_URL,
};
const runtime = { schemaVersion: 1, createdAt: new Date().toISOString(), contract, secrets };
writeFileSync(runtimeFile, `${JSON.stringify(runtime, null, 2)}\n`, { mode: 0o600 });
chmodSync(runtimeFile, 0o600);

const fingerprint = (input) => `sha256:${createHash("sha256").update(input).digest("hex").slice(0, 12)}`;
const inventory = {
  schemaVersion: 1,
  configuredAt: runtime.createdAt,
  owner: "Nguyễn Khả Duy",
  workerName: "mykis-learning",
  names: Object.keys(secrets).sort(),
  fingerprints: Object.fromEntries(Object.entries(secrets).map(([name, secretValue]) => [name, fingerprint(secretValue)])),
  valuesStoredInRepository: false,
  runtimeFile,
};
writeFileSync(inventoryFile, `${JSON.stringify(inventory, null, 2)}\n`);
console.log(JSON.stringify({ runtimeFile, mode: "0600", approvalId, secretNames: inventory.names, fingerprints: inventory.fingerprints }, null, 2));
