import { json, methodNotAllowed } from "../services/responses.js";
import { getSupabase } from "../services/supabase.js";
import { enforceRateLimit } from "../services/rate-limit.js";
import { writeAuditLog } from "../services/audit-service.js";
import { decryptEscrowPassword } from "../services/password-escrow.js";
import { requirePrivilegedSession } from "./auth.js";

export function isEmployeeAccountTarget(target, callerId) {
  return Boolean(target?.id && target.role === "employee" && target.id !== callerId);
}

function accountRow(row) {
  return {
    id: row.id,
    employeeCode: row.employee_code || "",
    fullName: row.full_name || "",
    email: row.email || "",
    username: row.username || "",
    department: row.department || "",
    position: row.position || "",
    accountStatus: row.account_status || "active",
    passwordStatus: row.password_status || "normal",
    mustChange: row.must_change === true,
    passwordRevealStatus: row.password_reveal_status || "unavailable_until_reset",
  };
}

export async function handleEmployeeAccounts(request, env) {
  const { caller, error: authError } = await requirePrivilegedSession(request, env);
  if (authError) return authError;

  const method = request.method.toUpperCase();
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/api\/admin\/employee-accounts(?:\/([^/]+)\/reveal-password)?$/);
  if (!match) return json({ error: "NOT_FOUND" }, 404);
  let targetId;
  try {
    targetId = match[1] ? decodeURIComponent(match[1]) : "";
  } catch {
    return json({ error: "INVALID_TARGET" }, 400, { "Cache-Control": "no-store" });
  }
  const supabase = getSupabase(env);

  if (!targetId && method === "GET") {
    const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("pageSize") || "30", 10) || 30));
    const search = String(url.searchParams.get("search") || "").trim().slice(0, 160);
    const status = String(url.searchParams.get("status") || "").trim().slice(0, 40);
    const { data, error } = await supabase.rpc("service_list_employee_accounts", {
      p_search: search,
      p_status: status,
      p_limit: pageSize,
      p_offset: (page - 1) * pageSize,
    });
    if (error) throw Object.assign(new Error("Employee account list unavailable"), { status: 503, code: "ACCOUNT_LIST_UNAVAILABLE" });
    const rows = Array.isArray(data) ? data : [];
    return json({
      items: rows.map(accountRow),
      total: Number(rows[0]?.total_count || 0),
      page,
      pageSize,
    }, 200, { "Cache-Control": "no-store" });
  }

  if (targetId && method === "POST") {
    const limit = await enforceRateLimit(request, env, "employee-password-reveal", `${caller.accountId}:${targetId}`, {
      limit: 5,
      windowSeconds: 300,
      critical: true,
    });
    if (limit) return limit;

    const { data: target, error: targetError } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", targetId)
      .single();
    if (targetError || !target) return json({ error: "ACCOUNT_NOT_FOUND" }, 404, { "Cache-Control": "no-store" });
    if (!isEmployeeAccountTarget(target, caller.accountId)) {
      return json({ error: target.id === caller.accountId ? "CANNOT_MODIFY_SELF" : "EMPLOYEE_ACCOUNT_REQUIRED" }, 403, { "Cache-Control": "no-store" });
    }

    const { data: record, error } = await supabase.rpc("service_read_password_escrow", {
      p_profile_id: targetId,
    });
    if (error) throw Object.assign(new Error("Password escrow read failed"), { status: 503, code: "PASSWORD_ESCROW_UNAVAILABLE" });
    if (!record) {
      return json({ error: "PASSWORD_UNAVAILABLE_UNTIL_RESET" }, 409, { "Cache-Control": "no-store" });
    }

    const password = await decryptEscrowPassword(record, targetId, env);
    await writeAuditLog(supabase, request, {
      actor: caller,
      action: "account.password_revealed",
      entityType: "profile",
      entityId: targetId,
      entityDisplayName: target.full_name,
      metadata: { reason: "hr_employee_account_support" },
    }, { critical: true });

    return json({ ok: true, targetId, password }, 200, { "Cache-Control": "no-store" });
  }

  return methodNotAllowed();
}
