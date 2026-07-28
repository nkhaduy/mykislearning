import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const root = resolve(new URL("../..", import.meta.url).pathname);
const required = [
  "KIS_PRODUCTION_BACKUP_ID", "KIS_PRODUCTION_CLOUDFLARE_ACCOUNT_ID", "KIS_PRODUCTION_WORKER_NAME",
  "KIS_PRODUCTION_HOSTNAME", "KIS_PRODUCTION_SUPABASE_PROJECT_REF", "KIS_PRODUCTION_DATABASE_URL",
  "KIS_PRODUCTION_TARGET_ALLOWLIST", "KIS_PRODUCTION_ONE_TIME_APPROVAL_TOKEN",
];
function fail(message) { throw new Error(`PRODUCTION_APPROVAL_REFUSED: ${message}`); }
export function verifyProductionApproval(input = process.env) {
  const missing = required.filter((name) => !String(input[name] || "").trim());
  if (missing.length) fail(`missing ${missing.join(", ")}`);
  if (String(input.KIS_ALLOW_PRODUCTION_DEPLOYMENT || "") !== "I_APPROVE_KIS_LMS_PRODUCTION_DEPLOYMENT") fail("explicit production deployment confirmation is missing");
  const readiness = readFileSync(resolve(root, "docs/audit-remediation/STAGING_OPERATIONAL_READINESS_REPORT.md"), "utf8");
  if (!/STAGING READY(?: WITH OPERATIONAL FOLLOW-UP)?/i.test(readiness)) fail("staging report is not ready");
  const noMfa = readFileSync(resolve(root, "docs/audit-remediation/NO_MFA_SECURITY_ACCEPTANCE.md"), "utf8");
  if (!/Status:\s*\*\*Accepted\*\*/i.test(noMfa)) fail("No-MFA owner acceptance is not Accepted");
  const hostname = new URL(String(input.KIS_PRODUCTION_HOSTNAME).includes("://") ? input.KIS_PRODUCTION_HOSTNAME : `https://${input.KIS_PRODUCTION_HOSTNAME}`).hostname.toLowerCase();
  const workerName = String(input.KIS_PRODUCTION_WORKER_NAME).trim().toLowerCase();
  const projectRef = String(input.KIS_PRODUCTION_SUPABASE_PROJECT_REF).trim().toLowerCase();
  const accountId = String(input.KIS_PRODUCTION_CLOUDFLARE_ACCOUNT_ID).trim().toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(accountId)) fail("Cloudflare account ID is invalid");
  if (!/^[a-z0-9-]{8,64}$/.test(projectRef)) fail("Supabase project ref is invalid");
  const allowlist = new Set(String(input.KIS_PRODUCTION_TARGET_ALLOWLIST).split(",").map((value) => value.trim().toLowerCase()).filter(Boolean));
  if (!allowlist.has(hostname) && !allowlist.has(`hostname:${hostname}`)) fail("production hostname is not explicitly allowlisted");
  if (!allowlist.has(`worker:${workerName}`)) fail("production Worker is not explicitly allowlisted");
  if (!allowlist.has(`project:${projectRef}`)) fail("production Supabase project is not explicitly allowlisted");
  if (!allowlist.has(`account:${accountId}`)) fail("production Cloudflare account is not explicitly allowlisted");
  if (/staging|stage|dev/i.test(hostname) || /staging|stage|dev/i.test(input.KIS_PRODUCTION_WORKER_NAME)) fail("staging target supplied to production verifier");
  let databaseUrl;
  try { databaseUrl = new URL(input.KIS_PRODUCTION_DATABASE_URL); } catch { fail("production database URL is invalid"); }
  if (!/^postgres(?:ql)?:$/.test(databaseUrl.protocol)) fail("production database URL must use PostgreSQL");
  const databaseUser = decodeURIComponent(databaseUrl.username || "").toLowerCase();
  const databaseHost = databaseUrl.hostname.toLowerCase();
  const directDatabase = databaseHost === `db.${projectRef}.supabase.co` && databaseUser === "postgres";
  const transactionPooler = databaseHost.endsWith(".pooler.supabase.com") && databaseUser === `postgres.${projectRef}`;
  if (!directDatabase && !transactionPooler) fail("production database identity does not match the approved project ref");
  if (String(input.KIS_PRODUCTION_ONE_TIME_APPROVAL_TOKEN).length < 32) fail("one-time approval token is too short");
  return {
    environment: "production",
    backupId: input.KIS_PRODUCTION_BACKUP_ID,
    cloudflareAccountId: `${accountId.slice(0, 4)}...${accountId.slice(-4)}`,
    workerName,
    hostname,
    supabaseProjectRef: `${projectRef.slice(0, 4)}...${projectRef.slice(-4)}`,
    databaseHostname: databaseHost,
    approvalFingerprint: `sha256:${createHash("sha256").update(input.KIS_PRODUCTION_ONE_TIME_APPROVAL_TOKEN).digest("hex").slice(0, 12)}`,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try { console.log(JSON.stringify({ mode: "plan-only", target: verifyProductionApproval(process.env), productionMutation: false }, null, 2)); }
  catch (error) { console.error(error.message); process.exit(2); }
}
