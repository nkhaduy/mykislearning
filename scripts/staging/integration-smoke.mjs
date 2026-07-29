import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { readJson, run, DEFAULT_RUNTIME_FILE } from "./staging-ops.mjs";
import { verifyStagingTarget } from "./staging-contract.mjs";

const runtimePath = process.env.KIS_STAGING_RUNTIME_FILE || DEFAULT_RUNTIME_FILE;
const runtime = readJson(runtimePath);
if (!runtime) throw new Error("staging runtime is missing");
verifyStagingTarget(runtime.contract);
const base = `https://${runtime.cloudflare.names.hostname}`;
const requestTimeoutMs = Number(process.env.KIS_STAGING_REQUEST_TIMEOUT_MS || 20000);
const reportPacingMs = Number(process.env.KIS_STAGING_REPORT_PACING_MS || 3500);
const integrationDeadline = Date.now() + Number(process.env.KIS_STAGING_INTEGRATION_TIMEOUT_MS || 12 * 60 * 1000);
const accounts = JSON.parse(runtime.secrets.DEPLOYMENT_TEST_ACCOUNTS || "[]");
const admin = accounts.find((account) => account.role === "hr");
if (!admin) throw new Error("staging HR synthetic account is missing");

function cookies(response) {
  const setCookies = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [response.headers.get("set-cookie")].filter(Boolean);
  return setCookies.map((value) => value.split(";", 1)[0]).join("; ");
}

async function call(path, options = {}) {
  if (Date.now() >= integrationDeadline) throw new Error("staging integration deadline exceeded");
  return fetch(`${base}${path}`, { redirect: "manual", signal: AbortSignal.timeout(requestTimeoutMs), ...options });
}

let lastReportCall = 0;
async function reportCall(path, options = {}) {
  const remaining = reportPacingMs - (Date.now() - lastReportCall);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await call(path, options);
    lastReportCall = Date.now();
    if (response.status !== 429 || attempt === 2) return response;
    const retrySeconds = Math.max(1, Number(response.headers.get("retry-after") || 60));
    await new Promise((resolve) => setTimeout(resolve, retrySeconds * 1000));
  }
  throw new Error("report request retry loop exhausted");
}

async function json(response) {
  try { return await response.json(); } catch { return null; }
}

const login = await call("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "login", identifier: admin.username, password: admin.password }) });
if (login.status !== 200) throw new Error(`staging admin login failed (${login.status})`);
const cookie = cookies(login);
const results = [];
const overview = await reportCall("/api/admin/reports/overview", { headers: { Cookie: cookie } });
results.push({ check: "report overview", status: overview.status, pass: overview.status === 200 });
const detail = await reportCall("/api/admin/reports/employees?pageSize=10", { headers: { Cookie: cookie } });
results.push({ check: "report detail first page", status: detail.status, pass: detail.status === 200 });

const reportTypes = ["employees", "course-completion", "enrollments", "attendance", "quiz-results", "learning-records", "certificates", "compliance"];
const formats = ["csv", "xlsx", "pdf"];
const jobs = [];
for (const reportType of reportTypes) {
  for (const format of formats) {
    const create = await reportCall("/api/admin/report-exports", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json", "Idempotency-Key": `staging-${reportType}-${format}-${randomUUID()}` },
      body: JSON.stringify({ reportType, format }),
    });
    const created = await json(create);
    const jobId = created?.id || created?.jobId;
    jobs.push({ reportType, format, createStatus: create.status, jobId });
  }
}

await new Promise((resolve) => setTimeout(resolve, 30000));
for (const item of jobs) {
  let job = null;
  let state = "unknown";
  for (let attempt = 0; item.jobId && attempt < 3; attempt += 1) {
    const poll = await reportCall(`/api/admin/report-exports/${item.jobId}`, { headers: { Cookie: cookie } });
    job = await json(poll);
    state = String(job?.state || job?.status || "unknown");
    if (!["queued", "running", "unknown"].includes(state)) break;
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  const download = state === "completed" ? await reportCall(`/api/admin/report-exports/${item.jobId}/download`, { headers: { Cookie: cookie } }) : null;
  const downloadBytes = download ? new Uint8Array(await download.arrayBuffer()) : null;
  results.push({ check: `export ${item.reportType}.${item.format}`, createStatus: item.createStatus, state, errorCode: job?.error_code || null, downloadStatus: download?.status || null, bytes: downloadBytes?.byteLength || 0, pass: [200, 202].includes(item.createStatus) && state === "completed" && download?.status === 200 && downloadBytes?.byteLength > 0 });
}

const cancelledCreate = await reportCall("/api/admin/report-exports", { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json", "Idempotency-Key": `staging-cancel-${randomUUID()}` }, body: JSON.stringify({ reportType: "employees", format: "csv" }) });
const cancelledBody = await json(cancelledCreate);
if (cancelledBody?.id) {
  const cancelled = await reportCall(`/api/admin/report-exports/${cancelledBody.id}/cancel`, { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: "{}" });
  results.push({ check: "export cancellation", status: cancelled.status, pass: [200, 404, 409].includes(cancelled.status) });
}

const probeIdentifier = `rate-probe-${randomUUID()}`;
const rateResponses = [];
for (let index = 0; index < 7; index += 1) {
  const response = await call("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "login", identifier: probeIdentifier, password: "wrong-password" }) });
  rateResponses.push(response.status);
}
results.push({ check: "rate-limit threshold", statuses: rateResponses, pass: rateResponses.includes(429) });

const objectKey = `private/staging-smoke/${randomUUID()}.txt`;
const source = `/tmp/kisvn-r2-smoke-${randomUUID()}.txt`;
const downloaded = `${source}.downloaded`;
writeFileSync(source, "KIS LMS staging synthetic object\n", { mode: 0o600 });
try {
  run("npx", ["wrangler", "r2", "object", "put", `${runtime.cloudflare.names.r2}/${objectKey}`, "--file", source, "--remote", "--force"]);
  run("npx", ["wrangler", "r2", "object", "get", `${runtime.cloudflare.names.r2}/${objectKey}`, "--file", downloaded, "--remote"]);
  const sourceHash = createHash("sha256").update(readFileSync(source)).digest("hex");
  const downloadedHash = createHash("sha256").update(readFileSync(downloaded)).digest("hex");
  results.push({ check: "private R2 object round trip", pass: sourceHash === downloadedHash });
  run("npx", ["wrangler", "r2", "object", "delete", `${runtime.cloudflare.names.r2}/${objectKey}`, "--remote", "--force"]);
} finally {
  for (const path of [source, downloaded]) if (existsSync(path)) unlinkSync(path);
}
run("npx", ["wrangler", "queues", "info", runtime.cloudflare.names.queue]);
run("npx", ["wrangler", "queues", "info", runtime.cloudflare.names.dlq]);
const devUrl = run("npx", ["wrangler", "r2", "bucket", "dev-url", "get", runtime.cloudflare.names.r2], { allowFailure: true });
results.push({ check: "R2 dev URL disabled", outputRedacted: true, pass: devUrl.status !== 0 || /disabled|not enabled|no public/i.test(devUrl.stdout + devUrl.stderr) });

const failed = results.filter((result) => !result.pass);
runtime.integrationSmoke = { completedAt: new Date().toISOString(), total: results.length, passed: results.length - failed.length, failed: failed.length, results };
writeFileSync(runtimePath, `${JSON.stringify(runtime, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({ completedAt: runtime.integrationSmoke.completedAt, total: runtime.integrationSmoke.total, passed: runtime.integrationSmoke.passed, failed: runtime.integrationSmoke.failed, failedChecks: failed.map((item) => item.check) }, null, 2));
if (failed.length) process.exit(2);
