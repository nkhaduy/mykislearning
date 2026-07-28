import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadSecureRuntime } from "./runtime-contract.mjs";

const value = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? String(process.argv[index + 1] || "").trim() : "";
};
const root = resolve(new URL("../..", import.meta.url).pathname);
const loaded = loadSecureRuntime(value("--runtime-file") || undefined);
const releaseSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const backup = JSON.parse(readFileSync(resolve(root, "docs/audit-remediation/evidence/PRODUCTION_BACKUP_RESTORE.json"), "utf8"));
const maintenanceWindow = value("--maintenance-window") || loaded.contract.KIS_PRODUCTION_MAINTENANCE_WINDOW || "";
const utc = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const releaseChanged = loaded.contract.KIS_RELEASE_COMMIT_SHA !== releaseSha;
loaded.contract.KIS_RELEASE_COMMIT_SHA = releaseSha;
loaded.contract.KIS_PRODUCTION_BACKUP_ID = backup.backupId;
loaded.contract.KIS_PRODUCTION_MAINTENANCE_WINDOW = maintenanceWindow;
loaded.contract.KIS_PRODUCTION_RELEASE_MANIFEST ||= "/tmp/kisvn-production-release-manifest.json";
loaded.contract.KIS_PRODUCTION_GATE_EVIDENCE ||= "/tmp/kisvn-production-quality-gates.json";
loaded.secrets.SUPABASE_URL = loaded.contract.KIS_PRODUCTION_SUPABASE_URL;
if (releaseChanged) {
  loaded.contract.KIS_PRODUCTION_APPROVAL_ID = `OWNER-PRODUCTION-${utc}-${releaseSha.slice(0, 8)}`;
  loaded.contract.KIS_PRODUCTION_ONE_TIME_APPROVAL_TOKEN = randomBytes(48).toString("base64url");
}
loaded.runtime.updatedAt = new Date().toISOString();
writeFileSync(loaded.path, `${JSON.stringify(loaded.runtime, null, 2)}\n`, { mode: 0o600 });
chmodSync(loaded.path, 0o600);
console.log(JSON.stringify({
  runtimeFile: loaded.path,
  mode: "0600",
  releaseCommitSha: releaseSha,
  approvalId: loaded.contract.KIS_PRODUCTION_APPROVAL_ID,
  backupId: backup.backupId,
  maintenanceWindowConfigured: Boolean(maintenanceWindow),
  approvalTokenRotated: releaseChanged,
}, null, 2));
