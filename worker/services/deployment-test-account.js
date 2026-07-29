import { hashPassword, verifyPassword } from "./crypto.js";
import { readCredential, writeCredential } from "./credentials.js";

const DEPLOYMENT_RUNTIMES = new Set(["production", "prod", "staging", "stage"]);
const TEST_PROFILE_PREFIX = "deployment-test:";
const LEGACY_TEST_PROFILE_ID = "deployment-test-account";
const ALLOWED_ROLES = new Set(["employee", "hr"]);

function normalizeAccount(candidate) {
  const username = String(candidate?.username || "").trim().toLowerCase();
  const password = String(candidate?.password || "");
  const role = candidate?.role;
  if (!username || !password || !ALLOWED_ROLES.has(role)) return null;
  return { username, password, role };
}

/** Read deployment-only credentials from Worker secrets. */
export function deploymentTestAccounts(env = {}) {
  let parsed = [];
  try {
    const value = JSON.parse(String(env.DEPLOYMENT_TEST_ACCOUNTS || "[]"));
    parsed = Array.isArray(value) ? value : [];
  } catch {
    return [];
  }

  const accounts = parsed.map(normalizeAccount).filter(Boolean).slice(0, 5);
  return accounts.filter((account, index) => (
    accounts.findIndex((candidate) => candidate.username === account.username) === index
  ));
}

export function deploymentTestAccountsEnabled(request, env = {}) {
  const runtime = String(env.APP_ENV || env.RUNTIME_ENV || env.NODE_ENV || "").trim().toLowerCase();
  let url;
  try { url = new URL(String(request?.url || "")); } catch { return false; }
  return env.DEPLOYMENT_TEST_ACCOUNT_ENABLED === "true"
    && DEPLOYMENT_RUNTIMES.has(runtime)
    && url.protocol === "https:"
    && !["localhost", "127.0.0.1", "::1"].includes(url.hostname)
    && deploymentTestAccounts(env).length > 0;
}

export function deploymentTestAccountForLogin(request, env, identifier) {
  if (!deploymentTestAccountsEnabled(request, env)) return null;
  const normalizedIdentifier = String(identifier || "").trim().toLowerCase();
  return deploymentTestAccounts(env).find((account) => account.username === normalizedIdentifier) || null;
}

export function isReservedDeploymentTestProfile(profile) {
  const id = String(profile?.id || "");
  return id === LEGACY_TEST_PROFILE_ID || id.startsWith(TEST_PROFILE_PREFIX);
}

/** Ensure one deploy-only account exists without exposing its secret. */
export async function ensureDeploymentTestAccount(supabase, account) {
  const normalized = normalizeAccount(account);
  if (!normalized) return null;

  const profileId = `${TEST_PROFILE_PREFIX}${normalized.username}`;
  const profile = {
    id: profileId,
    employee_code: normalized.username,
    full_name: normalized.role === "hr" ? "Deployment Test HR" : "Deployment Test Account",
    email: `${normalized.username}@deployment.invalid`,
    role: normalized.role,
    department: "Test",
    position: normalized.role === "hr" ? "Test HR" : "Test Account",
    account_status: "active",
    password_status: "normal",
    failed_login_count: 0,
    locked_until: null,
    updated_at: new Date().toISOString(),
  };

  const { data: existing, error: lookupError } = await supabase
    .from("profiles")
    .select("id, email, role, account_status")
    .eq("id", profileId)
    .maybeSingle();
  if (lookupError) throw Object.assign(new Error("DEPLOYMENT_TEST_ACCOUNT_LOOKUP_FAILED"), { status: 503, code: "TEST_ACCOUNT_STORE_UNAVAILABLE" });

  if (existing) {
    const { error } = await supabase.from("profiles").update(profile).eq("id", profileId);
    if (error) throw Object.assign(new Error("DEPLOYMENT_TEST_ACCOUNT_UPDATE_FAILED"), { status: 503, code: "TEST_ACCOUNT_STORE_UNAVAILABLE" });
  } else {
    const { error } = await supabase.from("profiles").insert({ ...profile, created_at: new Date().toISOString() });
    if (error) throw Object.assign(new Error("DEPLOYMENT_TEST_ACCOUNT_CREATE_FAILED"), { status: 503, code: "TEST_ACCOUNT_STORE_UNAVAILABLE" });
  }

  const credential = await readCredential(supabase, profileId);
  const passwordMatches = credential?.password_hash
    ? await verifyPassword(normalized.password, credential.password_hash)
    : false;
  if (!passwordMatches || credential?.must_change === true) {
    await writeCredential(supabase, profileId, await hashPassword(normalized.password), { mustChange: false });
  }

  return profile;
}
