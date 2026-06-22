/**
 * Auth middleware for Worker routes.
 * Uses X-Account-Id header with a hardcoded HR allow-list.
 * TODO: replace with Supabase JWT when auth migrates fully.
 */

const KNOWN_HR_IDS = new Set(["acc-hr-demo", "acc-hr-001"]);

export function resolveAccount(request) {
  const accountId = request.headers.get("x-account-id");
  if (!accountId) return null;
  const role = KNOWN_HR_IDS.has(accountId) ? "hr" : "employee";
  return { accountId, role };
}

export function requireAuth(request) {
  return resolveAccount(request);
}

export function requireHr(request) {
  const acct = resolveAccount(request);
  if (!acct || acct.role !== "hr") return null;
  return acct;
}
