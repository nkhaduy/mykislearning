import { hashPassword, verifyPassword } from "./crypto.js";
import { readCredential, writeCredential } from "./credentials.js";

const DEVELOPMENT_RUNTIMES = new Set(["local", "development", "dev"]);
const BLOCKED_RUNTIMES = new Set(["production", "prod", "staging", "stage"]);
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export const LOCAL_ADMIN_PROFILE_ID = "00000000-0000-4000-8000-000000000001";
export const LOCAL_ADMIN_EMAIL = "local-admin@localhost.invalid";

function runtimeName(env = {}) {
  return String(env.APP_ENV || env.RUNTIME_ENV || env.NODE_ENV || "").trim().toLowerCase();
}

function isLocalUrl(value) {
  try {
    return LOCAL_HOSTS.has(new URL(String(value || "")).hostname);
  } catch {
    return false;
  }
}

export function localDevelopmentAdminEnabled(request, env = {}) {
  const runtime = runtimeName(env);
  if (BLOCKED_RUNTIMES.has(runtime) || String(env.NODE_ENV || "").trim().toLowerCase() === "production") return false;
  if (!DEVELOPMENT_RUNTIMES.has(runtime) || env.LOCAL_DEV_ADMIN_ENABLED !== "true") return false;
  return isLocalUrl(request.url) && isLocalUrl(env.SUPABASE_URL);
}

export function localDevelopmentAdminCredentials(env = {}) {
  return {
    username: String(env.LOCAL_DEV_ADMIN_USERNAME || "1"),
    password: String(env.LOCAL_DEV_ADMIN_PASSWORD || "1"),
  };
}

export function isReservedLocalAdminProfile(profile) {
  return profile?.id === LOCAL_ADMIN_PROFILE_ID || String(profile?.email || "").toLowerCase() === LOCAL_ADMIN_EMAIL;
}

export async function ensureLocalDevelopmentAdmin(supabase, request, env) {
  if (!localDevelopmentAdminEnabled(request, env)) return null;

  const { password } = localDevelopmentAdminCredentials(env);
  const profileShape = {
    id: LOCAL_ADMIN_PROFILE_ID,
    employee_code: "1",
    full_name: "Local HR",
    email: LOCAL_ADMIN_EMAIL,
    role: "hr",
    department: "Local Development",
    position: "HR Development",
    account_status: "active",
    password_status: "normal",
    failed_login_count: 0,
    locked_until: null,
    updated_at: new Date().toISOString(),
  };

  const { data: existing, error: lookupError } = await supabase
    .from("profiles")
    .select("id, email, role, account_status")
    .eq("id", LOCAL_ADMIN_PROFILE_ID)
    .maybeSingle();
  if (lookupError) throw Object.assign(new Error("LOCAL_ADMIN_LOOKUP_FAILED"), { status: 503, code: "LOCAL_ADMIN_STORE_UNAVAILABLE" });

  if (existing) {
    const { error } = await supabase.from("profiles").update(profileShape).eq("id", LOCAL_ADMIN_PROFILE_ID);
    if (error) throw Object.assign(new Error("LOCAL_ADMIN_UPDATE_FAILED"), { status: 503, code: "LOCAL_ADMIN_STORE_UNAVAILABLE" });
  } else {
    const { error } = await supabase.from("profiles").insert({
      ...profileShape,
      created_at: new Date().toISOString(),
    });
    if (error) throw Object.assign(new Error("LOCAL_ADMIN_CREATE_FAILED"), { status: 503, code: "LOCAL_ADMIN_STORE_UNAVAILABLE" });
  }

  const credential = await readCredential(supabase, LOCAL_ADMIN_PROFILE_ID);
  const defaultPasswordWorks = credential?.password_hash
    ? await verifyPassword(password, credential.password_hash)
    : false;
  if (!defaultPasswordWorks || credential?.must_change === true) {
    await writeCredential(supabase, LOCAL_ADMIN_PROFILE_ID, await hashPassword(password), { mustChange: false });
  }

  return profileShape;
}
