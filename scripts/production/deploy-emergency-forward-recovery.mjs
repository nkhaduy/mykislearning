import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve } from "node:path";
import { loadSecureRuntime, tokenConsumptionFile } from "./runtime-contract.mjs";

const root = resolve(new URL("../..", import.meta.url).pathname);
const apply = process.argv.includes("--apply");
const loaded = loadSecureRuntime();
const { contract } = loaded;
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const command = (executable, args) => execFileSync(executable, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const run = (executable, args, options = {}) => {
  const result = spawnSync(executable, args, { cwd: root, encoding: "utf8", stdio: "inherit", env: process.env, ...options });
  if (result.error || result.status !== 0) throw result.error || new Error(`${executable} ${args.join(" ")} failed`);
};

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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function activeWindow(value) {
  const match = String(value || "").match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+07:00)\/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+07:00)$/);
  assert(match, "emergency maintenance window is invalid");
  const now = Date.now();
  assert(now >= new Date(match[1]).getTime() && now < new Date(match[2]).getTime(), "emergency recovery is outside the approved maintenance window");
  return { start: match[1], end: match[2] };
}

function verifyStaticContract() {
  assert(contract.KIS_PRODUCTION_EMERGENCY_RECOVERY === "true", "emergency recovery guard is not enabled");
  assert(contract.KIS_ALLOW_PRODUCTION_MUTATION === "true" && contract.KIS_ALLOW_PRODUCTION_DEPLOYMENT === "true", "production mutation guards are not enabled");
  assert(contract.KIS_PRODUCTION_EXECUTION_CONFIRM === "EXECUTE_EMERGENCY_FORWARD_RECOVERY_ONCE", "exact emergency execution confirmation is missing");
  assert(contract.KIS_PRODUCTION_DATABASE_STATE === "post-migration-clean-reset-canonical", "database state is not the approved canonical recovery state");
  assert(contract.KIS_PRODUCTION_PENDING_MIGRATION === "20260729121500_fix_reporting_rpc_enrollment_compatibility.sql", "unexpected emergency migration allowlist");
  assert(contract.KIS_PRODUCTION_HOSTNAME === "kislms.site" && contract.KIS_PRODUCTION_WORKER_NAME === "mykis-learning", "production target mismatch");
  assert(contract.KIS_PRODUCTION_SUPABASE_PROJECT_REF === "mooqdtiedfamnlpitqtq", "Supabase project mismatch");
  const allowlist = new Set(String(contract.KIS_PRODUCTION_TARGET_ALLOWLIST || "").split(","));
  for (const expected of ["hostname:kislms.site", "worker:mykis-learning", "project:mooqdtiedfamnlpitqtq", "account:b9ae472cee29c5729ee90ccbb3533f33"]) assert(allowlist.has(expected), `${expected} is not allowlisted`);
  assert(String(contract.KIS_PRODUCTION_ONE_TIME_APPROVAL_TOKEN || "").length >= 48, "emergency approval token is invalid");
  return activeWindow(contract.KIS_PRODUCTION_MAINTENANCE_WINDOW);
}

function pendingMigrations() {
  const output = command("supabase", ["db", "push", "--linked", "--include-all", "--dry-run"]);
  if (output.includes("Remote database is up to date.")) return [];
  return [...output.matchAll(/^\s*[•*]\s+(\d{3,14}_[A-Za-z0-9_]+\.sql)\s*$/gm)].map((match) => match[1]);
}

async function restCount(path) {
  const key = loaded.secrets.SUPABASE_SERVICE_ROLE_KEY;
  const response = await fetch(`${contract.KIS_PRODUCTION_SUPABASE_URL}/rest/v1/${path}`, {
    method: "HEAD",
    headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: "count=exact" },
  });
  const count = Number((response.headers.get("content-range") || "").split("/")[1] || -1);
  return { status: response.status, count };
}

async function reportRpc() {
  const key = loaded.secrets.SUPABASE_SERVICE_ROLE_KEY;
  const response = await fetch(`${contract.KIS_PRODUCTION_SUPABASE_URL}/rest/v1/rpc/service_report_overview`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_from: "2026-07-01T00:00:00+07:00", p_to: "2026-07-30T00:00:00+07:00", p_department: "", p_job_title: "", p_course_id: "", p_status: "", p_search: "", p_group_limit: 10, p_timeout_ms: 8000 }),
  });
  let body = {};
  try { body = await response.json(); } catch {}
  return { status: response.status, code: body.code || null, hasMetrics: Boolean(body.metrics) };
}

async function verifyPlan() {
  const window = verifyStaticContract();
  const head = command("git", ["rev-parse", "HEAD"]);
  assert(command("git", ["branch", "--show-current"]) === "hotfix/production-report-recovery-20260729", "HEAD is not on the emergency hotfix branch");
  assert(!command("git", ["status", "--porcelain", "--untracked-files=no"]), "tracked hotfix worktree is not clean");
  assert(contract.KIS_RELEASE_COMMIT_SHA === head, "runtime release SHA does not match HEAD");
  const manifest = JSON.parse(readFileSync(contract.KIS_PRODUCTION_RELEASE_MANIFEST, "utf8"));
  const gates = JSON.parse(readFileSync(contract.KIS_PRODUCTION_GATE_EVIDENCE, "utf8"));
  assert(gates.status === "pass" && gates.releaseCommitSha === head, "emergency quality gates are stale");
  assert(manifest.releaseCommitSha === head && manifest.releaseTreeSha === command("git", ["rev-parse", "HEAD^{tree}"]), "emergency manifest is stale");
  const dist = directoryDigest("dist");
  assert(manifest.dist?.sha256 === dist.sha256 && manifest.dist?.files === dist.files, "dist checksum does not match emergency manifest");
  assert(manifest.productionRuntimeSha256 === sha256(readFileSync(loaded.path)), "runtime checksum does not match emergency manifest");
  assert(manifest.qualityGateEvidenceSha256 === sha256(readFileSync(contract.KIS_PRODUCTION_GATE_EVIDENCE)), "gate checksum does not match emergency manifest");
  const deployment = JSON.parse(command(resolve(root, "node_modules/.bin/wrangler"), ["deployments", "status", "--name", contract.KIS_PRODUCTION_WORKER_NAME, "--json"]));
  assert(deployment.versions?.length === 1 && deployment.versions[0].percentage === 100, "production traffic is not on one verified Worker version");
  assert(deployment.versions[0].version_id === contract.KIS_PRODUCTION_EXPECTED_ACTIVE_WORKER_VERSION, "active Worker is not the recorded incompatible rollback version");
  const secretNames = new Set(JSON.parse(command(resolve(root, "node_modules/.bin/wrangler"), ["secret", "list", "--name", contract.KIS_PRODUCTION_WORKER_NAME, "--format", "json"])).map((item) => item.name));
  for (const name of ["AUDIT_IP_HASH_SALT", "CURSOR_SIGNING_SECRET", "JWT_SECRET", "RATE_LIMIT_KEY_SECRET", "REFRESH_TOKEN_HASH_SECRET", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_URL"]) assert(secretNames.has(name), `production Worker is missing secret ${name}`);
  assert(JSON.stringify(pendingMigrations()) === JSON.stringify([contract.KIS_PRODUCTION_PENDING_MIGRATION]), "live pending migrations do not match the emergency allowlist");
  const bootstrap = await restCount("profiles?id=eq.acc-hr-001&role=eq.hr&select=id");
  const profiles = await restCount("profiles?select=id");
  const courses = await restCount("courses?select=id");
  const quizzes = await restCount("quizzes?select=id");
  assert(bootstrap.status === 200 && bootstrap.count === 1, "bootstrap HR verification failed");
  assert(profiles.count === 1 && courses.count === 0 && quizzes.count === 0, "temporary smoke data cleanup verification failed");
  const report = await reportRpc();
  assert(report.status === 400 && report.code === "42703", "pre-apply report failure no longer matches the approved root cause");
  const consumption = tokenConsumptionFile(loaded.path);
  assert(!existsSync(consumption), "emergency recovery approval has already been consumed");
  return { head, window, deploymentId: deployment.id, activeVersion: deployment.versions[0].version_id, pending: [contract.KIS_PRODUCTION_PENDING_MIGRATION] };
}

try {
  const plan = await verifyPlan();
  console.log(JSON.stringify({ mode: apply ? "apply" : "plan-only", productionMutation: apply, plan }, null, 2));
  if (!apply) {
    console.log("GO FOR EMERGENCY FORWARD RECOVERY");
    process.exit(0);
  }

  run("npm", ["run", "build"]);
  run("npm", ["run", "scan:artifact"]);
  run("npm", ["run", "check:wrangler"]);
  const consumption = tokenConsumptionFile(loaded.path);
  writeFileSync(consumption, `${JSON.stringify({ schemaVersion: 1, consumedAt: new Date().toISOString(), approvalId: contract.KIS_PRODUCTION_APPROVAL_ID, approvalFingerprint: sha256(contract.KIS_PRODUCTION_ONE_TIME_APPROVAL_TOKEN), releaseCommitSha: plan.head }, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  chmodSync(consumption, 0o600);
  run("supabase", ["db", "push", "--linked", "--include-all", "--yes"]);
  assert(pendingMigrations().length === 0, "database is not up to date after the emergency migration");
  const report = await reportRpc();
  assert(report.status === 200 && report.hasMetrics, "report RPC did not recover after the emergency migration");

  const tempDirectory = mkdtempSync(join(tmpdir(), "kisvn-emergency-recovery-"));
  const secretsPath = join(tempDirectory, "worker-secrets.json");
  writeFileSync(secretsPath, `${JSON.stringify({ ...loaded.secrets, SUPABASE_URL: contract.KIS_PRODUCTION_SUPABASE_URL })}\n`, { mode: 0o600 });
  chmodSync(secretsPath, 0o600);
  run(resolve(root, "node_modules/.bin/wrangler"), ["deploy", "--name", contract.KIS_PRODUCTION_WORKER_NAME, "--secrets-file", secretsPath, "--message", `Emergency report recovery ${plan.head.slice(0, 12)}`]);
  const deployed = JSON.parse(command(resolve(root, "node_modules/.bin/wrangler"), ["deployments", "status", "--name", contract.KIS_PRODUCTION_WORKER_NAME, "--json"]));
  console.log(JSON.stringify({ status: "EMERGENCY_FORWARD_RECOVERY_DEPLOYED", deploymentId: deployed.id, versionId: deployed.versions?.[0]?.version_id, reportRpc: "pass" }, null, 2));
} catch (error) {
  console.error(`EMERGENCY FORWARD RECOVERY BLOCKED: ${error.message}`);
  process.exit(2);
}
