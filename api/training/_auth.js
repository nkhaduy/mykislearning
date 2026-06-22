/**
 * Shared auth helper for training API routes.
 * Validates X-Account-Id header and optionally requires HR role.
 *
 * Auth model: clients pass accountId + role from their localStorage session.
 * HR role is additionally validated against the known seed list.
 * Acceptable for an internal tool; upgrade to Supabase JWT when auth migrates.
 */

const KNOWN_HR_IDS = new Set(["acc-hr-demo", "acc-hr-001"]);
const KNOWN_EMPLOYEE_IDS = new Set(["acc-001", "acc-002", "acc-003", "acc-004", "acc-005", "acc-sa-001"]);

export function resolveAccount(req) {
  const accountId = req.headers["x-account-id"];
  if (!accountId) return null;

  // Never grant elevated access from a client-controlled role header.
  // TODO: replace this compatibility allow-list with Supabase JWT + user_roles.
  const isKnownHr = KNOWN_HR_IDS.has(accountId);
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
