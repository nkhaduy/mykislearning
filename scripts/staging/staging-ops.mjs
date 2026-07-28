import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { userInfo } from "node:os";
import { randomBytes, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fingerprint, loadProductionDenylist } from "./staging-contract.mjs";

export const ROOT = resolve(new URL("../..", import.meta.url).pathname);
export const DEFAULT_RUNTIME_FILE = "/tmp/kisvn-staging-runtime.json";

export function run(command, args, { input, allowFailure = false, env = process.env } = {}) {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: "utf8", input, env, maxBuffer: 16 * 1024 * 1024 });
  if (!allowFailure && (result.error || result.status !== 0)) {
    const detail = String(result.stderr || result.stdout || result.error?.message || "command failed").split("\n").filter(Boolean).slice(-4).join(" ");
    throw new Error(`${command} failed: ${detail}`);
  }
  return { ...result, stdout: String(result.stdout || ""), stderr: String(result.stderr || "") };
}

export function readJson(path) {
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
}

export function writePrivateJson(path, value) {
  mkdirSync(resolve(path, ".."), { recursive: true, mode: 0o700 });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  chmodSync(path, 0o600);
}

export function randomSecret(bytes = 32) { return randomBytes(bytes).toString("base64url"); }

export function deriveOwner() {
  const name = run("git", ["config", "user.name"], { allowFailure: true }).stdout.trim();
  const email = run("git", ["config", "user.email"], { allowFailure: true }).stdout.trim();
  if (name) return email ? `${name} (email ${fingerprint(email)})` : name;
  return `${userInfo().username || "local-system"} (source local-system-owner)`;
}

export function gitHead() { return run("git", ["rev-parse", "HEAD"]).stdout.trim(); }

function parseAccountId(text) { return text.match(/\b[a-f0-9]{32}\b/i)?.[0]?.toLowerCase() || ""; }

export function discoverCloudflare() {
  const whoami = run("npx", ["wrangler", "whoami"]);
  const accountId = parseAccountId(whoami.stdout + whoami.stderr);
  if (!accountId) throw new Error("Cloudflare account ID could not be discovered");
  const queues = run("npx", ["wrangler", "queues", "list"]).stdout.split("\n").map((line) => line.trim()).filter(Boolean).filter((line) => !/^name:/i.test(line) && !/^created/i.test(line));
  const buckets = run("npx", ["wrangler", "r2", "bucket", "list"]).stdout.split("\n").map((line) => line.trim()).filter((line) => /^name:/i.test(line)).map((line) => line.replace(/^name:\s*/i, ""));
  const productionDeployments = run("npx", ["wrangler", "deployments", "list", "--name", "mykis-learning", "--json"], { allowFailure: true });
  const stagingDeployments = run("npx", ["wrangler", "deployments", "list", "--name", "mykis-learning-staging", "--json"], { allowFailure: true });
  return {
    accountId,
    accountIdMasked: `${accountId.slice(0, 4)}...${accountId.slice(-4)}`,
    worker: "mykis-learning",
    productionDeployments: productionDeployments.status === 0,
    stagingWorkerExists: stagingDeployments.status === 0,
    queues,
    buckets,
    tokenOutputRedacted: true,
  };
}

export function discoverSupabase() {
  const projectsResult = run("supabase", ["projects", "list", "--output", "json"]);
  const orgsResult = run("supabase", ["orgs", "list", "--output", "json"]);
  let projects;
  let orgs;
  try { projects = JSON.parse(projectsResult.stdout); } catch { throw new Error("Supabase project discovery returned invalid JSON"); }
  try { orgs = JSON.parse(orgsResult.stdout); } catch { throw new Error("Supabase organization discovery returned invalid JSON"); }
  const staging = projects.find((project) => /(^|[-_])(kis[-_]?lms|mykis)[-_](staging|stage|dev)($|[-_])/i.test(project.name || ""));
  return {
    projects: projects.map((project) => ({ ref: project.ref, name: project.name, linked: Boolean(project.linked), region: project.region, status: project.status })),
    organizations: orgs.map((org) => ({ id: org.id, name: org.name, slug: org.slug })),
    linkedRefs: projects.filter((project) => project.linked).map((project) => project.ref),
    stagingProject: staging ? { ref: staging.ref, name: staging.name, region: staging.region, status: staging.status } : null,
  };
}

export function deriveCloudflareNames(cloudflare) {
  const existing = new Set([...(cloudflare.queues || []), ...(cloudflare.buckets || [])].map((value) => value.toLowerCase()));
  const names = {
    worker: "mykis-learning-staging",
    queue: "kis-lms-export-staging",
    dlq: "kis-lms-export-dlq-staging",
    r2: "kis-lms-exports-staging",
  };
  const intendedNamesExist = existing.has(names.queue) || existing.has(names.dlq) || existing.has(names.r2);
  if (intendedNamesExist && !cloudflare.stagingWorkerExists) {
    const suffix = randomUUID().slice(0, 8);
    names.queue = `kis-lms-export-staging-${suffix}`;
    names.dlq = `kis-lms-export-dlq-staging-${suffix}`;
    names.r2 = `kis-lms-exports-staging-${suffix}`;
  }
  const productionHost = "mykis-learning.nkhaduy.workers.dev";
  const suffix = productionHost.replace(/^mykis-learning\./, "");
  names.hostname = `${names.worker}.${suffix}`;
  return names;
}

export function buildRuntime({ cloudflare, supabase, names, metadata, project, secrets, databasePassword, backupOrCloneId }) {
  const projectRef = project?.ref || "pendingstagingproject";
  const supabaseUrl = project?.url || `https://${projectRef}.supabase.co`;
  const databaseUrl = project?.databaseUrl || `postgresql://postgres:${encodeURIComponent(databasePassword || "pending") }@db.${projectRef}.supabase.co:5432/postgres`;
  const contract = {
    KIS_ALLOW_STAGING_MUTATION: "true",
    APP_ENV: "staging",
    KIS_STAGING_CLOUDFLARE_ACCOUNT_ID: cloudflare.accountId,
    KIS_STAGING_WORKER_NAME: names.worker,
    KIS_STAGING_HOSTNAME: names.hostname,
    KIS_STAGING_QUEUE_NAME: names.queue,
    KIS_STAGING_DLQ_NAME: names.dlq,
    KIS_STAGING_R2_BUCKET_NAME: names.r2,
    KIS_STAGING_SUPABASE_PROJECT_REF: projectRef,
    KIS_STAGING_SUPABASE_URL: supabaseUrl,
    KIS_STAGING_DATABASE_URL: databaseUrl,
    KIS_STAGING_APPROVAL_ID: metadata.approvalId,
    KIS_STAGING_APPROVED_BY: metadata.approvedBy,
    KIS_STAGING_CHANGE_OWNER: metadata.changeOwner,
    KIS_STAGING_ROLLBACK_OWNER: metadata.rollbackOwner,
    KIS_STAGING_BACKUP_OR_CLONE_ID: backupOrCloneId || `PENDING-${metadata.executionId}`,
    KIS_PRODUCTION_HOSTNAME_DENYLIST: loadProductionDenylist().hostnames.join(","),
    KIS_PRODUCTION_PROJECT_REF_DENYLIST: [...new Set(["mooqdtiedfamnlpitqtq", "xnlnmnibjxbmhmrgevjs", ...(supabase?.linkedRefs || [])])].join(","),
    KIS_PRODUCTION_RESOURCE_DENYLIST: loadProductionDenylist().resources.join(","),
  };
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    executionId: metadata.executionId,
    owner: metadata,
    cloudflare: { accountId: cloudflare.accountId, names },
    supabase: { projectRef, url: supabaseUrl, databaseUrl, organizations: supabase?.organizations || [], linkedRefs: supabase?.linkedRefs || [] },
    contract,
    secrets: secrets || {},
    databasePassword,
  };
}

export function secretSet() {
  const account = (role) => ({ username: `kis-staging-${role}`, password: `${randomSecret(24)}Aa1!`, role });
  const deploymentAccounts = [account("employee"), account("hr"), account("admin")];
  return {
    JWT_SECRET: randomSecret(),
    REFRESH_TOKEN_HASH_SECRET: randomSecret(),
    CURSOR_SIGNING_SECRET: randomSecret(),
    RATE_LIMIT_KEY_SECRET: randomSecret(),
    AUDIT_IP_HASH_SALT: randomSecret(),
    DEPLOYMENT_TEST_ACCOUNTS: JSON.stringify(deploymentAccounts),
  };
}

export function redactRuntime(runtime) {
  return {
    executionId: runtime.executionId,
    createdAt: runtime.createdAt,
    owner: runtime.owner,
    cloudflare: { accountId: `${runtime.cloudflare.accountId.slice(0, 4)}...${runtime.cloudflare.accountId.slice(-4)}`, names: runtime.cloudflare.names },
    supabase: { projectRef: `${runtime.supabase.projectRef.slice(0, 4)}...${runtime.supabase.projectRef.slice(-4)}`, url: runtime.supabase.url, databaseHost: new URL(runtime.supabase.databaseUrl).hostname },
    secretNames: Object.keys(runtime.secrets || {}).sort(),
    secretFingerprints: Object.fromEntries(Object.entries(runtime.secrets || {}).map(([name, value]) => [name, fingerprint(value)])),
  };
}
