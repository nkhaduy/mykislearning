/**
 * Shared auth for course API routes.
 * Same pattern as api/training/_auth.js — upgrade to Supabase JWT when auth migrates.
 */

const KNOWN_HR_IDS = new Set(["acc-hr-demo", "acc-hr-001"]);

export function resolveAccount(req) {
  const accountId = req.headers["x-account-id"];
  const roleHeader = req.headers["x-account-role"];
  if (!accountId) return null;
  const isKnownHr = KNOWN_HR_IDS.has(accountId) || roleHeader === "hr";
  const role = isKnownHr ? "hr" : "employee";
  return { accountId, role };
}

export function requireHr(req, res) {
  const acct = resolveAccount(req);
  if (!acct) { res.status(401).json({ error: "Unauthorized" }); return null; }
  if (acct.role !== "hr") { res.status(403).json({ error: "HR only" }); return null; }
  return acct;
}

export function requireAuth(req, res) {
  const acct = resolveAccount(req);
  if (!acct) { res.status(401).json({ error: "Unauthorized" }); return null; }
  return acct;
}

export function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Account-Id, X-Account-Role");
}
