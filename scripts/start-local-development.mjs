import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);

function findLocalWorkerEnv() {
  const explicit = process.env.KIS_LOCAL_WORKER_ENV;
  if (explicit) return path.resolve(explicit);

  return readdirSync(tmpdir(), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("kis-lms-worker-supabase."))
    .map((entry) => path.join(tmpdir(), entry.name, "worker.env"))
    .filter(existsSync)
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0] || "";
}

function readEnvFile(filePath) {
  const result = {};
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator);
    let value = line.slice(separator + 1);
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    result[key] = value;
  }
  return result;
}

const workerEnvPath = findLocalWorkerEnv();
if (!workerEnvPath) {
  console.error("No local Supabase Worker environment was found. Set KIS_LOCAL_WORKER_ENV to a local-only worker.env file.");
  process.exit(1);
}

const workerEnv = readEnvFile(workerEnvPath);
let supabaseHost = "";
try { supabaseHost = new URL(workerEnv.SUPABASE_URL || "").hostname; } catch {}
if (!localHosts.has(supabaseHost)) {
  console.error("Refusing to start the development admin against a non-local Supabase URL.");
  process.exit(1);
}

const build = spawnSync("npm", ["run", "build"], { cwd: repositoryRoot, stdio: "inherit" });
if (build.status !== 0) process.exit(build.status || 1);

const overlayPath = path.join(tmpdir(), `kis-lms-local-dev-${process.pid}.env`);
const overlay = [
  "APP_ENV=development",
  "NODE_ENV=development",
  "LOCAL_DEV_ADMIN_ENABLED=true",
];
if (process.env.LOCAL_DEV_ADMIN_USERNAME) overlay.push(`LOCAL_DEV_ADMIN_USERNAME=${process.env.LOCAL_DEV_ADMIN_USERNAME}`);
if (process.env.LOCAL_DEV_ADMIN_PASSWORD) overlay.push(`LOCAL_DEV_ADMIN_PASSWORD=${process.env.LOCAL_DEV_ADMIN_PASSWORD}`);
writeFileSync(overlayPath, `${overlay.join("\n")}\n`, { mode: 0o600 });

const port = String(Number(process.env.PORT || 8787));
console.log(`Starting KIS LMS development Worker at http://127.0.0.1:${port}/`);
const child = spawn("npx", [
  "wrangler", "dev", "--env", "local", "--local", "--ip", "127.0.0.1", "--port", port,
  "--env-file", workerEnvPath, "--env-file", overlayPath,
], { cwd: repositoryRoot, stdio: "inherit" });

const cleanup = () => {
  try { unlinkSync(overlayPath); } catch {}
};
child.once("exit", (code, signal) => {
  cleanup();
  if (signal) process.kill(process.pid, signal);
  else process.exit(code || 0);
});
process.once("SIGINT", () => child.kill("SIGINT"));
process.once("SIGTERM", () => child.kill("SIGTERM"));
