import { createHash } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const DEFAULT_RUNTIME_FILE = "/tmp/kisvn-production-runtime.json";
export const DEFAULT_MANIFEST_FILE = "/tmp/kisvn-production-release-manifest.json";
export const DEFAULT_GATE_EVIDENCE_FILE = "/tmp/kisvn-production-quality-gates.json";
export const DEFAULT_MIGRATION_RECONCILIATION_EVIDENCE = "docs/audit-remediation/evidence/PRODUCTION_MIGRATION_HISTORY_RECONCILIATION.json";

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function tokenConsumptionFile(runtimeFile = DEFAULT_RUNTIME_FILE) {
  return `${resolve(runtimeFile)}.approval-consumed.json`;
}

export function loadSecureRuntime(runtimeFile = process.env.KIS_PRODUCTION_RUNTIME_FILE || DEFAULT_RUNTIME_FILE) {
  const path = resolve(runtimeFile);
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("secure production runtime must be a regular file");
  if ((stat.mode & 0o777) !== 0o600) throw new Error("secure production runtime must have mode 0600");
  const runtime = JSON.parse(readFileSync(path, "utf8"));
  if (runtime?.schemaVersion !== 1 || !runtime.contract || typeof runtime.contract !== "object" || !runtime.secrets || typeof runtime.secrets !== "object") {
    throw new Error("secure production runtime schema is invalid");
  }
  return { path, runtime, contract: runtime.contract, secrets: runtime.secrets };
}
