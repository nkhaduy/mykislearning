import { createHash } from "node:crypto";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { DEFAULT_RUNTIME_FILE, readJson } from "./staging/staging-ops.mjs";
import { verifyStagingTarget } from "./staging/staging-contract.mjs";

const root = resolve(new URL("..", import.meta.url).pathname);
const mode = process.argv.includes("--capture") ? "capture" : "plan";
const confirmation = process.env.KIS_STAGING_REHEARSAL_CONFIRM || "";
const runtimePath = process.env.KIS_STAGING_RUNTIME_FILE || DEFAULT_RUNTIME_FILE;
const runtime = existsSync(runtimePath) ? readJson(runtimePath) : null;

function fail(message) {
  console.error(`STAGING_PREFLIGHT_REFUSED: ${message}`);
  process.exit(2);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", ...options });
  if (result.error || result.status !== 0) fail(`${command} failed`);
  return result.stdout.trim();
}

function migrationChecksum() {
  const directory = resolve(root, "supabase/migrations");
  const hash = createHash("sha256");
  for (const filename of readdirSync(directory).filter((name) => name.endsWith(".sql")).sort()) {
    hash.update(filename);
    hash.update("\0");
    hash.update(readFileSync(resolve(directory, filename)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

const sha = run("git", ["rev-parse", "HEAD"]);
const lockHash = createHash("sha256").update(readFileSync(resolve(root, "package-lock.json"))).digest("hex");
console.log(JSON.stringify({ mode, commit: sha, packageLockSha256: lockHash, migrationsSha256: migrationChecksum() }, null, 2));

if (mode === "plan") {
  console.log("PLAN_ONLY: no database connection was attempted. Use --capture only during an approved staging maintenance rehearsal.");
  process.exit(0);
}

if (confirmation !== "I_UNDERSTAND_STAGING_ONLY") fail("KIS_STAGING_REHEARSAL_CONFIRM is missing");
if (!runtime?.contract) fail(`staging runtime is missing at ${runtimePath}`);
try { verifyStagingTarget(runtime.contract); } catch (error) { fail(error.message.replace(/^STAGING_TARGET_REFUSED:\s*/, "")); }
if (process.env.KIS_STAGING_CAPTURE_CONFIRM !== "CAPTURE_READ_ONLY_SNAPSHOTS") fail("read-only capture confirmation is missing");

console.log("CAPTURE_GUARDS_PASSED: run the catalog, RLS/grant, row-count, constraint/index, version, and headroom commands from the runbook manually.");
console.log("This preflight intentionally does not run migrations, deploy, restore, or mutate any database.");
