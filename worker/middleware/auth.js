/**
 * Auth middleware for Worker routes.
 *
 * Production and staging accept only a verified Bearer token. Legacy identity
 * headers are available solely for explicitly enabled local development.
 */

import { verifySession } from "../routes/auth.js";

const KNOWN_HR_IDS = new Set(["acc-hr-demo", "acc-hr-001"]);

export function hasAdministrativeAccess(accountOrRole) {
  const role = typeof accountOrRole === "string" ? accountOrRole : accountOrRole?.role;
  return role === "hr" || role === "admin";
}

function runtimeName(env = {}) {
  return String(env.APP_ENV || env.RUNTIME_ENV || env.NODE_ENV || "").trim().toLowerCase();
}

function legacyHeaderAuthEnabled(env = {}) {
  const runtime = runtimeName(env);
  return env.ALLOW_LEGACY_IDENTITY_HEADERS === "true"
    && ["local", "development", "dev", "test"].includes(runtime)
    && !["production", "prod", "staging", "stage"].includes(runtime);
}

function resolveFromHeader(request) {
  const accountId = request.headers.get("x-account-id");
  if (!accountId) return null;
  const headerRole = request.headers.get("x-account-role");
  const role = headerRole === "hr"
    ? "hr"
    : KNOWN_HR_IDS.has(accountId)
      ? "hr"
      : "employee";
  return { accountId, role };
}

export async function resolveAccount(request, env) {
  const authorization = request.headers.get("authorization") || "";
  if (authorization) {
    if (!authorization.startsWith("Bearer ")) return null;
    return verifySession(request, env);
  }

  const cookieSession = await verifySession(request, env);
  if (cookieSession) return cookieSession;
  return legacyHeaderAuthEnabled(env) ? resolveFromHeader(request) : null;
}

function unauthorized() {
  return Object.assign(new Error("Authentication required"), {
    status: 401,
    code: "UNAUTHORIZED",
  });
}

export async function requireAuth(request, env) {
  const account = await resolveAccount(request, env);
  if (!account) throw unauthorized();
  return account;
}

export async function requireHr(request, env) {
  const acct = await requireAuth(request, env);
  if (!hasAdministrativeAccess(acct)) return null;
  return acct;
}
