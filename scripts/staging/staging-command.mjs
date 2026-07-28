import { chmodSync, existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { verifyStagingTarget, fingerprint } from "./staging-contract.mjs";
import { DEFAULT_RUNTIME_FILE, ROOT, readJson, run, writePrivateJson } from "./staging-ops.mjs";

const action = process.argv[2];
const runtimePath = process.env.KIS_STAGING_RUNTIME_FILE || DEFAULT_RUNTIME_FILE;
const runtime = readJson(runtimePath);
if (!runtime) {
  console.error(`STAGING_COMMAND_REFUSED: private runtime file not found at ${runtimePath}`);
  process.exit(2);
}

function persist() { writePrivateJson(runtimePath, runtime); }
function safeTarget() { return verifyStagingTarget(runtime.contract); }
function contains(output, value) { return String(output || "").toLowerCase().includes(String(value).toLowerCase()); }
function latestVersion(versions) {
  return [...(Array.isArray(versions) ? versions : [])].sort((a, b) => Number(b.number || 0) - Number(a.number || 0))[0] || null;
}
function latestDeployment(deployments) {
  return [...(Array.isArray(deployments) ? deployments : [])].sort((a, b) => String(b.created_on || "").localeCompare(String(a.created_on || "")))[0] || null;
}

function createQueue(name, retention) {
  const desired = run("npx", ["wrangler", "queues", "create", name, "--message-retention-period-secs", String(retention)], { allowFailure: true });
  if (desired.status === 0 || /already exists/i.test(desired.stderr + desired.stdout)) return retention;
  const fallback = run("npx", ["wrangler", "queues", "create", name, "--message-retention-period-secs", "86400"]);
  return fallback.status === 0 ? 86400 : retention;
}

function provision() {
  const target = safeTarget();
  const queueList = run("npx", ["wrangler", "queues", "list"]).stdout;
  const bucketList = run("npx", ["wrangler", "r2", "bucket", "list"]).stdout;
  const result = { target, created: [], reused: [], retentionSeconds: {} };
  for (const [name, retention] of [[runtime.cloudflare.names.queue, 345600], [runtime.cloudflare.names.dlq, 1209600]]) {
    if (contains(queueList, name)) result.reused.push(name);
    else {
      result.retentionSeconds[name] = createQueue(name, retention);
      result.created.push(name);
    }
  }
  const bucket = runtime.cloudflare.names.r2;
  if (contains(bucketList, bucket)) result.reused.push(bucket);
  else {
    run("npx", ["wrangler", "r2", "bucket", "create", bucket, "--location", "apac", "--storage-class", "Standard"]);
    result.created.push(bucket);
  }
  run("npx", ["wrangler", "r2", "bucket", "dev-url", "disable", bucket, "--force"]);
  const lifecycle = run("npx", ["wrangler", "r2", "bucket", "lifecycle", "list", bucket], { allowFailure: true });
  if (!contains(lifecycle.stdout + lifecycle.stderr, "abort-incomplete-multipart")) {
    run("npx", ["wrangler", "r2", "bucket", "lifecycle", "add", bucket, "abort-incomplete-multipart", "private/report-exports/v3/", "--abort-multipart-days", "1", "--force"]);
  }
  runtime.provisioning = { ...result, completedAt: new Date().toISOString(), durableObject: "provisioned by staging Worker SQLite migration", cron: "0 * * * *" };
  persist();
  console.log(JSON.stringify(result, null, 2));
}

function waitForProject() {
  const ref = runtime.supabase.projectRef;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const projects = JSON.parse(run("supabase", ["projects", "list", "--output", "json"]).stdout);
    const project = projects.find((item) => item.ref === ref);
    if (project?.status === "ACTIVE_HEALTHY") {
      runtime.supabase.region = project.region;
      persist();
      return project;
    }
    run("sleep", ["10"]);
  }
  throw new Error("Supabase staging project did not become healthy within five minutes");
}

function migrate() {
  const project = waitForProject();
  run("npm", ["run", "test:migrations"]);
  let pushed = run("supabase", ["db", "push", "--db-url", runtime.supabase.databaseUrl, "--include-all", "--yes"], { allowFailure: true });
  if (pushed.status !== 0) {
    const region = project.region || runtime.supabase.region;
    if (!region || !runtime.databasePassword) throw new Error("remote migration failed and no safe transaction-pooler identity is available");
    const poolerHost = `aws-1-${region}.pooler.supabase.com`;
    const poolerUrl = `postgresql://postgres.${runtime.supabase.projectRef}:${encodeURIComponent(runtime.databasePassword)}@${poolerHost}:5432/postgres`;
    runtime.supabase.databaseUrl = poolerUrl;
    runtime.contract.KIS_STAGING_DATABASE_URL = poolerUrl;
    safeTarget();
    persist();
    pushed = run("supabase", ["db", "push", "--db-url", poolerUrl, "--include-all", "--yes"]);
  }
  runtime.databaseRehearsal = {
    appliedAt: new Date().toISOString(),
    migrationChecksum: fingerprint(run("sh", ["-c", "find supabase/migrations -maxdepth 1 -type f -print0 | LC_ALL=C sort -z | xargs -0 cat"]).stdout),
    freshProject: runtime.contract.KIS_STAGING_BACKUP_OR_CLONE_ID.startsWith("SUPABASE-FRESH-"),
    cliOutputCapturedWithoutSecrets: true,
    status: "pass",
  };
  persist();
  return pushed;
}

function deploymentSecretsFile() {
  const path = `/tmp/kisvn-staging-secrets-${runtime.executionId}.json`;
  writeFileSync(path, `${JSON.stringify(runtime.secrets)}\n`, { mode: 0o600 });
  chmodSync(path, 0o600);
  return path;
}

function deploy({ searchEnabled = true, exportEnabled = true, message = "KIS LMS staging deployment" } = {}) {
  safeTarget();
  if (!runtime.provisioning?.completedAt) provision();
  if (!runtime.databaseRehearsal?.appliedAt) migrate();
  if (!runtime.publicAnonKey || !runtime.secrets.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase staging API credentials are unavailable");
  run("npm", ["run", "build"]);
  run("npm", ["run", "check:wrangler"]);
  run("npx", ["wrangler", "deploy", "--env", "staging", "--dry-run"]);
  const before = run("npx", ["wrangler", "versions", "list", "--name", runtime.cloudflare.names.worker, "--json"], { allowFailure: true });
  const beforeVersions = (() => { try { return JSON.parse(before.stdout); } catch { return []; } })();
  const secretsFile = deploymentSecretsFile();
  try {
    const vars = {
      APP_ENV: "staging",
      SUPABASE_URL: runtime.supabase.url,
      SUPABASE_ANON_KEY: runtime.publicAnonKey,
      PUBLIC_APP_ORIGIN: `https://${runtime.cloudflare.names.hostname}`,
      CORS_ALLOWED_ORIGINS: `https://${runtime.cloudflare.names.hostname}`,
      MAX_CONCURRENT_SESSIONS: "10",
      SEARCH_ROLLOUT_ENABLED: String(searchEnabled),
      EXPORT_FEATURE_ENABLED: String(exportEnabled),
      ALLOW_LEGACY_IDENTITY_HEADERS: "false",
      SETUP_ADMIN_ENABLED: "false",
      DEPLOYMENT_TEST_ACCOUNT_ENABLED: "true",
      LOCAL_DEV_ADMIN_ENABLED: "false",
    };
    const args = ["wrangler", "deploy", "--env", "staging", "--name", runtime.cloudflare.names.worker, "--secrets-file", secretsFile, "--message", message];
    for (const [name, value] of Object.entries(vars)) args.push("--var", `${name}:${value}`);
    const deployed = run("npx", args);
    const discoveredUrl = (deployed.stdout + deployed.stderr).match(/https:\/\/([a-z0-9.-]+\.workers\.dev)/i)?.[1];
    if (discoveredUrl) {
      runtime.cloudflare.names.hostname = discoveredUrl.toLowerCase();
      runtime.contract.KIS_STAGING_HOSTNAME = discoveredUrl.toLowerCase();
    }
  } finally {
    if (existsSync(secretsFile)) unlinkSync(secretsFile);
  }
  const versions = JSON.parse(run("npx", ["wrangler", "versions", "list", "--name", runtime.cloudflare.names.worker, "--json"]).stdout);
  const deployments = JSON.parse(run("npx", ["wrangler", "deployments", "list", "--name", runtime.cloudflare.names.worker, "--json"]).stdout);
  const secretList = JSON.parse(run("npx", ["wrangler", "secret", "list", "--name", runtime.cloudflare.names.worker, "--format", "json"]).stdout);
  const latest = latestDeployment(deployments);
  runtime.deployment = {
    deployedAt: new Date().toISOString(),
    currentVersionId: latestVersion(versions)?.id || latestVersion(versions)?.version_id || latest?.versions?.[0]?.version_id || null,
    previousVersionId: latestVersion(beforeVersions)?.id || latestVersion(beforeVersions)?.version_id || null,
    deploymentId: latest?.id || null,
    hostname: runtime.cloudflare.names.hostname,
    searchEnabled,
    exportEnabled,
    secretNames: secretList.map((item) => item.name).sort(),
  };
  persist();
  console.log(JSON.stringify({ target: safeTarget(), deployment: runtime.deployment }, null, 2));
}

function cookieHeader(response) {
  const values = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [response.headers.get("set-cookie")].filter(Boolean);
  return values.map((value) => value.split(";", 1)[0]).join("; ");
}

async function request(path, options = {}) {
  const response = await fetch(`https://${runtime.cloudflare.names.hostname}${path}`, { redirect: "manual", ...options });
  return response;
}

async function smoke() {
  safeTarget();
  if (!runtime.deployment?.deployedAt) throw new Error("staging deployment is required before smoke tests");
  const checks = [];
  for (const path of ["/", "/about-kis", "/login", "/robots.txt", "/api/config"]) {
    const response = await request(path);
    checks.push({ name: `GET ${path}`, status: response.status, pass: response.status === 200 });
  }
  const mfa = await request("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "mfa-enroll" }) });
  checks.push({ name: "MFA endpoint absent", status: mfa.status, pass: [400, 404, 405].includes(mfa.status) });
  const accounts = JSON.parse(runtime.secrets.DEPLOYMENT_TEST_ACCOUNTS || "[]");
  for (const account of accounts) {
    const login = await request("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "login", identifier: account.username, password: account.password }) });
    const cookie = cookieHeader(login);
    checks.push({ name: `${account.role} login`, status: login.status, pass: login.status === 200 && Boolean(cookie) });
    if (login.status !== 200 || !cookie) continue;
    const session = await request("/api/auth?action=session", { headers: { Cookie: cookie } });
    checks.push({ name: `${account.role} session`, status: session.status, pass: session.status === 200 });
    const employees = await request("/api/employees?pageSize=10", { headers: { Cookie: cookie } });
    checks.push({ name: `${account.role} employee scope`, status: employees.status, pass: account.role === "employee" ? employees.status === 403 : employees.status === 200 });
    const refresh = await request("/api/auth", { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify({ action: "refresh" }) });
    checks.push({ name: `${account.role} refresh rotation`, status: refresh.status, pass: refresh.status === 200 });
    const logoutCookie = cookieHeader(refresh) || cookie;
    const logout = await request("/api/auth", { method: "POST", headers: { Cookie: logoutCookie, "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) });
    checks.push({ name: `${account.role} logout`, status: logout.status, pass: logout.status === 200 });
  }
  const localLogin = await request("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "login", identifier: "1", password: "1" }) });
  checks.push({ name: "local 1/1 rejected", status: localLogin.status, pass: localLogin.status === 401 });
  const failed = checks.filter((item) => !item.pass);
  runtime.smoke = { completedAt: new Date().toISOString(), checks, status: failed.length ? "fail" : "pass" };
  persist();
  console.log(JSON.stringify(runtime.smoke, null, 2));
  if (failed.length) throw new Error(`${failed.length} staging smoke checks failed`);
}

async function rollbackDrill() {
  if (!runtime.deployment?.currentVersionId) throw new Error("a deployed staging version is required");
  const stableVersion = runtime.deployment.currentVersionId;
  deploy({ searchEnabled: false, exportEnabled: false, message: "KIS LMS staging rollback drill candidate" });
  const rollbackCandidate = runtime.deployment.currentVersionId;
  run("npx", ["wrangler", "queues", "pause-delivery", runtime.cloudflare.names.queue]);
  run("npx", ["wrangler", "queues", "resume-delivery", runtime.cloudflare.names.queue]);
  run("npx", ["wrangler", "rollback", stableVersion, "--env", "staging", "--name", runtime.cloudflare.names.worker, "--message", "KIS LMS staging rollback drill", "--yes"]);
  const deployments = JSON.parse(run("npx", ["wrangler", "deployments", "list", "--name", runtime.cloudflare.names.worker, "--json"]).stdout);
  const resultingDeployment = latestDeployment(deployments);
  const resultingVersion = resultingDeployment?.versions?.[0]?.version_id || null;
  runtime.deployment.currentVersionId = resultingVersion;
  runtime.deployment.previousVersionId = rollbackCandidate;
  runtime.deployment.deploymentId = resultingDeployment?.id || runtime.deployment.deploymentId;
  runtime.deployment.searchEnabled = true;
  runtime.deployment.exportEnabled = true;
  runtime.rollback = { completedAt: new Date().toISOString(), stableVersion, rollbackCandidate, resultingVersion, queuePauseResume: "pass", applicationRollback: stableVersion !== rollbackCandidate && resultingVersion === stableVersion ? "pass" : "inconclusive_same_version" };
  persist();
  await smoke();
  console.log(JSON.stringify(runtime.rollback, null, 2));
}

function readiness() {
  const noMfa = readFileSync(resolve(ROOT, "docs/audit-remediation/NO_MFA_SECURITY_ACCEPTANCE.md"), "utf8");
  const technicalPass = runtime.provisioning?.completedAt && runtime.databaseRehearsal?.status === "pass" && runtime.databaseRestoreDrill?.status === "pass" && runtime.deployment?.deployedAt && runtime.smoke?.status === "pass" && runtime.integrationSmoke?.failed === 0 && runtime.rollback?.applicationRollback === "pass";
  const criticalAlertsPass = runtime.observability?.criticalAlerts === "pass";
  const noMfaAccepted = /Status:\s*\*\*Accepted\*\*/i.test(noMfa);
  const result = {
    technicalStaging: technicalPass ? "STAGING READY WITH OPERATIONAL FOLLOW-UP" : "STAGING NOT READY",
    production: noMfaAccepted && technicalPass && criticalAlertsPass ? "READY FOR OWNER-APPROVED PRODUCTION DEPLOYMENT" : technicalPass && criticalAlertsPass ? "BLOCKED ONLY BY NO-MFA OWNER ACCEPTANCE" : "PRODUCTION BLOCKED",
    target: safeTarget(),
    gates: {
      resources: Boolean(runtime.provisioning?.completedAt),
      database: runtime.databaseRehearsal?.status || "missing",
      databaseRestore: runtime.databaseRestoreDrill?.status || "missing",
      deployment: Boolean(runtime.deployment?.deployedAt),
      smoke: runtime.smoke?.status || "missing",
      integration: runtime.integrationSmoke?.failed === 0 ? "pass" : "missing-or-failed",
      rollback: runtime.rollback?.applicationRollback || "missing",
      criticalAlerts: criticalAlertsPass ? "pass" : "operational-follow-up",
      noMfaAcceptance: noMfaAccepted ? "Accepted" : "Pending",
    },
  };
  console.log(JSON.stringify(result, null, 2));
  if (!technicalPass) process.exitCode = 2;
}

try {
  if (action === "provision") provision();
  else if (action === "deploy") deploy();
  else if (action === "smoke") await smoke();
  else if (action === "rollback-drill") await rollbackDrill();
  else if (action === "readiness") readiness();
  else throw new Error(`unknown staging action: ${action}`);
} catch (error) {
  console.error(`STAGING_${String(action || "COMMAND").toUpperCase().replace(/-/g, "_")}_FAILED: ${error.message}`);
  process.exit(2);
}
