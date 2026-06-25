/**
 * Auth middleware for Worker routes.
 *
 * Priority:
 * 1. Bearer token (HMAC-signed JWT issued by /api/auth?action=login)
 * 2. X-Account-Id + X-Account-Role headers (legacy localStorage sessions, backward compat)
 *
 * Auth-critical endpoints (reset-password, change-password, create-user) always
 * require a valid Bearer token via requireHrSession() in routes/auth.js.
 */

import { verifySession } from "../routes/auth.js";

const KNOWN_HR_IDS = new Set(["acc-hr-demo", "acc-hr-001"]);

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
  if (env) {
    try {
      const jwt = await verifySession(request, env);
      if (jwt) return jwt;
    } catch { /* fall through to header auth */ }
  }
  return resolveFromHeader(request);
}

export async function requireAuth(request, env) {
  return resolveAccount(request, env);
}

export async function requireHr(request, env) {
  const acct = await resolveAccount(request, env);
  if (!acct || !["hr", "admin"].includes(acct.role)) return null;
  return acct;
}
