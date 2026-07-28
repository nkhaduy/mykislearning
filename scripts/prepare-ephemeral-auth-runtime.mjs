import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";

import { hashPassword } from "../worker/services/crypto.js";

const statusPath = process.env.EPHEMERAL_SUPABASE_STATUS;
const credentialsPath = process.env.EPHEMERAL_RUNTIME_CREDENTIALS;
const workerEnvPath = process.env.EPHEMERAL_WORKER_ENV;
assert.ok(statusPath && credentialsPath && workerEnvPath, "ephemeral status, credentials and Worker env paths are required");

function parseEnvFile(path) {
  return Object.fromEntries(fs.readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean).map((line) => {
    const separator = line.indexOf("=");
    let value = line.slice(separator + 1);
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    return [line.slice(0, separator), value];
  }));
}

const status = parseEnvFile(statusPath);
const password = () => `${crypto.randomBytes(18).toString("base64url")}Aa1!`;
const identities = {
  employeeA: { id: "synthetic-employee-a", email: "employee-a@example.invalid", role: "employee", password: password(), mustChange: true },
  employeeB: { id: "synthetic-employee-b", email: "employee-b@example.invalid", role: "employee", password: password(), mustChange: false },
  trainer: { id: "synthetic-trainer", email: "trainer@example.invalid", role: "trainer", password: password(), mustChange: false },
  hr: { id: "synthetic-hr", email: "hr@example.invalid", role: "hr", password: password(), mustChange: false },
  admin: { id: "synthetic-admin", email: "admin@example.invalid", role: "admin", password: password(), mustChange: false },
  bootstrapAdmin: { id: "synthetic-bootstrap-admin", email: "bootstrap-admin@example.invalid", role: "admin", password: password(), mustChange: true },
};

for (const identity of Object.values(identities)) identity.passwordHash = await hashPassword(identity.password);

const runtime = {
  baseUrl: "http://127.0.0.1:8787",
  setupKey: crypto.randomBytes(32).toString("base64url"),
  jwtSecret: crypto.randomBytes(48).toString("base64url"),
  identities,
};
fs.writeFileSync(credentialsPath, JSON.stringify(runtime), { mode: 0o600 });
fs.writeFileSync(workerEnvPath, [
  `SUPABASE_URL=${status.API_URL}`,
  `SUPABASE_SERVICE_ROLE_KEY=${status.SERVICE_ROLE_KEY}`,
  `JWT_SECRET=${runtime.jwtSecret}`,
  `AUDIT_IP_HASH_SALT=${crypto.randomBytes(32).toString("hex")}`,
  "APP_ENV=test",
  "CORS_ALLOWED_ORIGINS=http://127.0.0.1:8787,http://127.0.0.1:4173",
  "SETUP_ADMIN_ENABLED=true",
  `SETUP_ADMIN_ONE_TIME_KEY=${runtime.setupKey}`,
].join("\n") + "\n", { mode: 0o600 });

for (const [name, identity] of Object.entries(identities)) {
  if (name === "bootstrapAdmin") continue;
  const response = await fetch(`${status.REST_URL}/rpc/service_write_account_credential`, {
    method: "POST",
    headers: { apikey: status.SERVICE_ROLE_KEY, Authorization: `Bearer ${status.SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_profile_id: identity.id, p_password_hash: identity.passwordHash, p_must_change: identity.mustChange }),
  });
  assert.equal(response.status, 200, `credential RPC failed for ${name}`);
}

const bootstrapProfile = await fetch(`${status.REST_URL}/profiles`, {
  method: "POST",
  headers: {
    apikey: status.SERVICE_ROLE_KEY,
    Authorization: `Bearer ${status.SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=minimal",
  },
  body: JSON.stringify({
    id: identities.bootstrapAdmin.id,
    employee_code: "SYN-BA",
    full_name: "Synthetic Bootstrap Admin",
    email: identities.bootstrapAdmin.email,
    role: "admin",
    department: "Platform",
    position: "Bootstrap Administrator",
    account_status: "active",
    password_status: "normal",
  }),
});
assert.equal(bootstrapProfile.status, 201);

console.log(JSON.stringify({ prepared: true, identities: Object.keys(identities).length, secretsPersistedOnlyInTempFiles: true }));
