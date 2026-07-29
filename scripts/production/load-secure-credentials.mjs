import { execFileSync, spawnSync } from "node:child_process";
import { lstatSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const SERVICE = "KISVN Production";
const KEYCHAIN_ACCOUNTS = {
  CLOUDFLARE_API_TOKEN: "cloudflare-api-token",
  SUPABASE_ACCESS_TOKEN: "supabase-access-token",
  KIS_PRODUCTION_DATABASE_URL: "supabase-database-url",
  KIS_PRODUCTION_ONE_TIME_APPROVAL_TOKEN: "production-runtime-nonce",
  SUPABASE_SERVICE_ROLE_KEY: "supabase-service-role-key",
  SUPABASE_ANON_KEY: "supabase-anon-key",
  HR_EMAIL: "bootstrap-hr-email",
  HR_PASSWORD: "bootstrap-hr-password",
  JWT_SECRET: "worker-jwt-secret",
  REFRESH_TOKEN_HASH_SECRET: "worker-refresh-token-hash-secret",
  CURSOR_SIGNING_SECRET: "worker-cursor-signing-secret",
  RATE_LIMIT_KEY_SECRET: "worker-rate-limit-secret",
  AUDIT_IP_HASH_SALT: "worker-audit-ip-hash-salt"
};

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? String(process.argv[index + 1] || "").trim() : "";
}

function readKeychain(account) {
  return execFileSync("security", ["find-generic-password", "-s", SERVICE, "-a", account, "-w"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  }).trim();
}

function writeKeychain(account, value) {
  if (!value) return;
  execFileSync("security", ["add-generic-password", "-U", "-s", SERVICE, "-a", account, "-w", value], {
    stdio: ["ignore", "ignore", "ignore"]
  });
}

function secureRuntime(path) {
  const absolute = resolve(path);
  const stat = lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o777) !== 0o600) {
    throw new Error("secure runtime must be a regular mode-0600 file");
  }
  const runtime = JSON.parse(readFileSync(absolute, "utf8"));
  if (runtime?.schemaVersion !== 1 || !runtime.contract || !runtime.secrets) {
    throw new Error("secure runtime schema is invalid");
  }
  return runtime;
}

const importRuntime = option("--import-runtime");
if (importRuntime) {
  const runtime = secureRuntime(importRuntime);
  const values = {
    KIS_PRODUCTION_DATABASE_URL: runtime.contract.KIS_PRODUCTION_DATABASE_URL,
    KIS_PRODUCTION_ONE_TIME_APPROVAL_TOKEN: runtime.contract.KIS_PRODUCTION_ONE_TIME_APPROVAL_TOKEN,
    SUPABASE_SERVICE_ROLE_KEY: runtime.secrets.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_ANON_KEY: runtime.secrets.SUPABASE_ANON_KEY,
    JWT_SECRET: runtime.secrets.JWT_SECRET,
    REFRESH_TOKEN_HASH_SECRET: runtime.secrets.REFRESH_TOKEN_HASH_SECRET,
    CURSOR_SIGNING_SECRET: runtime.secrets.CURSOR_SIGNING_SECRET,
    RATE_LIMIT_KEY_SECRET: runtime.secrets.RATE_LIMIT_KEY_SECRET,
    AUDIT_IP_HASH_SALT: runtime.secrets.AUDIT_IP_HASH_SALT
  };
  for (const [name, value] of Object.entries(values)) writeKeychain(KEYCHAIN_ACCOUNTS[name], value);
}

const separator = process.argv.indexOf("--");
const command = separator >= 0 ? process.argv.slice(separator + 1) : [];
const requested = (option("--require") || Object.keys(KEYCHAIN_ACCOUNTS).join(","))
  .split(",")
  .map((name) => name.trim())
  .filter(Boolean);
const unknown = requested.filter((name) => !KEYCHAIN_ACCOUNTS[name]);
if (unknown.length) throw new Error(`unknown credential name(s): ${unknown.join(", ")}`);

const loaded = {};
try {
  for (const name of requested) {
    const value = readKeychain(KEYCHAIN_ACCOUNTS[name]);
    if (!value) throw new Error(`required Keychain credential is empty: ${name}`);
    loaded[name] = value;
  }
  if (!command.length) {
    console.log(JSON.stringify({ status: "ready", service: SERVICE, credentialNames: requested }, null, 2));
  } else {
    const result = spawnSync(command[0], command.slice(1), {
      stdio: "inherit",
      env: { ...process.env, ...loaded }
    });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  }
} finally {
  for (const name of Object.keys(loaded)) {
    loaded[name] = "";
    delete process.env[name];
  }
}
