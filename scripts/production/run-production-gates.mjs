import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_GATE_EVIDENCE_FILE, loadSecureRuntime } from "./runtime-contract.mjs";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const { contract } = loadSecureRuntime();
const evidencePath = resolve(contract.KIS_PRODUCTION_GATE_EVIDENCE || DEFAULT_GATE_EVIDENCE_FILE);
const releaseCommitSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const commands = [
  ["npm", ["run", "lint"]],
  ["npm", ["run", "typecheck"]],
  ["npm", ["run", "test:migrations"]],
  ["npm", ["run", "test:unit"]],
  ["npm", ["run", "test:security"]],
  ["npm", ["run", "test:auth-rotation"]],
  ["npm", ["run", "test:mfa"]],
  ["npm", ["run", "test:rate-limit"]],
  ["npm", ["run", "test:session-security"]],
  ["npm", ["run", "test:reports"]],
  ["npm", ["run", "test:export-jobs"]],
  ["npm", ["run", "test:e2e:public"]],
  ["npm", ["run", "test:e2e:authenticated"]],
  ["npm", ["run", "test:routes:all"]],
  ["npm", ["run", "test:reports:100k"]],
  ["npm", ["run", "test:reports:concurrency"]],
  ["npm", ["run", "test:reports:timeout"]],
  ["npm", ["run", "test:exports:all"]],
  ["npm", ["run", "test:queue-dlq"]],
  ["npm", ["run", "test:r2-authorization"]],
  ["npm", ["run", "test:employee-search"]],
  ["npm", ["run", "check:search-rollout"]],
  ["npm", ["run", "build"]],
  ["npm", ["run", "scan:artifact"]],
  ["npm", ["run", "check:bundle-budget"]],
  ["npm", ["run", "measure:route-bundles"]],
  ["npm", ["run", "check:legacy-monolith"]],
  ["npm", ["run", "check:wrangler"]],
  ["npm", ["audit", "--audit-level=high"]],
  ["git", ["diff", "--check"]],
];

const startedAt = new Date();
const results = [];
let status = "pass";
for (const [command, args] of commands) {
  const commandStartedAt = new Date();
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", stdio: "inherit", env: process.env });
  results.push({
    command: [command, ...args].join(" "),
    startedAt: commandStartedAt.toISOString(),
    completedAt: new Date().toISOString(),
    exitCode: result.status ?? 1,
  });
  if (result.error || result.status !== 0) {
    status = "fail";
    break;
  }
}
const evidence = {
  schemaVersion: 1,
  releaseCommitSha,
  startedAt: startedAt.toISOString(),
  completedAt: new Date().toISOString(),
  status,
  results,
};
writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
chmodSync(evidencePath, 0o600);
console.log(JSON.stringify({ evidencePath, releaseCommitSha, status, checksCompleted: results.length }, null, 2));
if (status !== "pass") process.exitCode = 2;
