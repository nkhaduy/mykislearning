/**
 * Account Support Request routes.
 * Uses hr_tasks table as backing store with specific task_types.
 * Metadata (submitted_identifier, submitted_name, message, etc.) stored as JSON in description field.
 */

import { json, readJson, corsPreflight } from "../services/responses.js";
import { getSupabase } from "../services/supabase.js";
import { requireHr } from "../middleware/auth.js";
import { hashPassword, markMustChange } from "../services/crypto.js";

const HASH_PREFIX = "__pwd__:";

const SUPPORT_TYPES = ["forgot_password", "unlock_account", "reactivate_account", "login_issue", "account_access"];

// Map to task_type values allowed by hr_tasks CHECK constraint
const TASK_TYPE_MAP = {
  forgot_password: "password_reset",
  unlock_account: "account_unlock",
  reactivate_account: "assignment",
  login_issue: "data_issue",
  account_access: "assignment",
};
// Reverse map: stored task_type → request_type (via meta)
const STORED_SUPPORT_TASK_TYPES = ["password_reset", "account_unlock", "assignment", "data_issue"];
const SUPPORT_MARKER = '"_is_support":true';

const TYPE_LABELS = {
  forgot_password: "Quên mật khẩu",
  unlock_account: "Mở khóa tài khoản",
  reactivate_account: "Kích hoạt lại tài khoản",
  login_issue: "Lỗi đăng nhập",
  account_access: "Yêu cầu truy cập",
};

const STATUS_LABELS = {
  new: "Mới",
  in_progress: "Đang xử lý",
  waiting_for_user: "Chờ người dùng",
  done: "Đã hoàn tất",
  rejected: "Đã từ chối",
};

const AUTO_PRIORITY = {
  unlock_account: "high",
  reactivate_account: "high",
  forgot_password: "normal",
  login_issue: "low",
  account_access: "low",
};

function parseMeta(description) {
  if (!description) return {};
  try {
    const obj = JSON.parse(description);
    return obj && obj._meta ? obj : { message: String(description) };
  } catch {
    return { message: String(description) };
  }
}

function mapRequest(row) {
  const meta = parseMeta(row.description);
  const requestType = meta.request_type || row.task_type;
  return {
    id: row.id,
    requestType,
    requestTypeLabel: TYPE_LABELS[requestType] || TYPE_LABELS[row.task_type] || row.task_type,
    requesterAccountId: row.requester_account_id || null,
    submittedIdentifier: meta.submitted_identifier || "",
    submittedName: meta.submitted_name || (row.requester?.full_name || ""),
    submittedEmployeeCode: meta.submitted_employee_code || "",
    message: meta.message || "",
    status: row.status,
    statusLabel: STATUS_LABELS[row.status] || row.status,
    priority: row.priority || "normal",
    assignedTo: meta.assigned_to || null,
    resolutionType: meta.resolution_type || "",
    resolutionNote: meta.resolution_note || "",
    acceptedAt: meta.accepted_at || null,
    rejectedAt: meta.rejected_at || null,
    source: meta.source || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at || null,
    resolvedBy: row.resolved_by || null,
    profile: row.requester ? {
      id: row.requester.id,
      fullName: row.requester.full_name || "",
      email: row.requester.email || "",
      department: row.requester.department || "",
      position: row.requester.position || "",
      accountStatus: row.requester.account_status || "active",
      lastLoginAt: row.requester.last_login_at || null,
      failedLoginCount: row.requester.failed_login_count || 0,
      lockedUntil: row.requester.locked_until || null,
    } : null,
  };
}

function auditLog(supabase, row) {
  Promise.resolve(supabase.from("audit_logs").insert(row)).then(null, () => {});
}

export async function handleAccountSupport(request, env) {
  const method = request.method.toUpperCase();
  if (method === "OPTIONS") return corsPreflight();

  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const supabase = getSupabase(env);

  // POST /api/account-support/requests — public, no auth required
  if (parts[1] === "account-support" && method === "POST") {
    const body = await readJson(request);
    const requestType = String(body.requestType || "").trim();

    if (!SUPPORT_TYPES.includes(requestType)) {
      return json({ error: "INVALID_REQUEST_TYPE" }, 400);
    }

    const submittedIdentifier = String(body.submittedIdentifier || "").trim().toLowerCase().slice(0, 255);
    const submittedName = String(body.submittedName || "").trim().slice(0, 255);
    const submittedEmployeeCode = String(body.submittedEmployeeCode || "").trim().slice(0, 50);
    const message = String(body.message || "").trim().slice(0, 2000);

    if (!submittedIdentifier && !submittedName) {
      return json({ error: "IDENTIFIER_REQUIRED", message: "Vui lòng nhập email hoặc họ tên." }, 400);
    }

    // Rate limit: block same identifier within 10 minutes
    const cooldownStart = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    if (submittedIdentifier) {
      const safeId = submittedIdentifier.replace(/%/g, "").replace(/_/g, "\\_").slice(0, 100);
      const { data: existing } = await supabase
        .from("hr_tasks")
        .select("id")
        .in("task_type", STORED_SUPPORT_TASK_TYPES)
        .in("status", ["new", "in_progress"])
        .gte("created_at", cooldownStart)
        .ilike("description", `%"submitted_identifier":"${safeId}"%`)
        .limit(1);

      if (existing && existing.length > 0) {
        return json({
          error: "DUPLICATE_ACTIVE_REQUEST",
          message: "Bạn đã có một yêu cầu đang được xử lý. Vui lòng đợi ít nhất 10 phút trước khi gửi lại.",
        }, 429);
      }
    }

    // Try to match account (don't reveal result to caller)
    let matchedProfileId = null;
    if (submittedIdentifier) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", submittedIdentifier)
        .single();
      if (profile) matchedProfileId = profile.id;
    }

    const ip = (request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "").slice(0, 50);
    const userAgent = (request.headers.get("user-agent") || "").slice(0, 200);

    const meta = {
      _meta: true,
      _is_support: true,
      request_type: requestType,
      submitted_identifier: submittedIdentifier,
      submitted_name: submittedName,
      submitted_employee_code: submittedEmployeeCode,
      message,
      source: "login_page",
      ip,
      user_agent: userAgent,
    };

    const displayName = submittedName || submittedIdentifier || "Không rõ";

    const { error: insertErr } = await supabase.from("hr_tasks").insert({
      task_type: TASK_TYPE_MAP[requestType] || "assignment",
      requester_account_id: matchedProfileId,
      reference_type: matchedProfileId ? "profile" : null,
      reference_id: matchedProfileId,
      title: `${TYPE_LABELS[requestType]} - ${displayName}`,
      description: JSON.stringify(meta),
      priority: AUTO_PRIORITY[requestType] || "normal",
      status: "new",
      updated_at: new Date().toISOString(),
    });

    if (insertErr) {
      return json({ error: "REQUEST_FAILED", message: "Không thể gửi yêu cầu. Vui lòng thử lại sau." }, 500);
    }

    auditLog(supabase, {
      actor_id: matchedProfileId, action: "account_support_requested", target_type: "profile",
      target_id: matchedProfileId, result: "success", details: { requestType, submittedIdentifier },
    });

    return json({ ok: true, message: "Yêu cầu hỗ trợ đã được gửi đến HR. Vui lòng chờ HR kiểm tra và phản hồi." });
  }

  // Admin routes
  if (parts[1] === "admin" && parts[2] === "account-support") {
    const acct = await requireHr(request, env);
    if (!acct) return json({ error: "HR_ONLY" }, 403);

    // parts: ["api","admin","account-support","requests",id?,action?]
    const requestId = parts[4] || null;
    const action = parts[5] || null;

    // GET /api/admin/account-support/requests
    if (!requestId && method === "GET") {
      const status = url.searchParams.get("status") || "";
      const requestType = url.searchParams.get("requestType") || "";
      const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
      const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") || "20", 10)));

      let query = supabase
        .from("hr_tasks")
        .select("*, requester:profiles!hr_tasks_requester_account_id_fkey(id, full_name, email, department, position, account_status, last_login_at, failed_login_count, locked_until)", { count: "exact" })
        .in("task_type", STORED_SUPPORT_TASK_TYPES)
        .ilike("description", `%${SUPPORT_MARKER}%`)
        .order("created_at", { ascending: false });

      if (status) query = query.eq("status", status);
      if (requestType) {
        // Filter by request_type stored in description
        const safeType = requestType.replace(/[^a-z_]/g, "");
        query = query.ilike("description", `%"request_type":"${safeType}"%`);
      }

      const from = (page - 1) * pageSize;
      const { data, error, count } = await query.range(from, from + pageSize - 1);
      if (error) return json({ error: error.message }, 500);

      return json({ items: (data || []).map(mapRequest), total: count || 0, page, pageSize });
    }

    // GET /api/admin/account-support/requests/:id
    if (requestId && !action && method === "GET") {
      const { data, error } = await supabase
        .from("hr_tasks")
        .select("*, requester:profiles!hr_tasks_requester_account_id_fkey(id, full_name, email, department, position, account_status, last_login_at, failed_login_count, locked_until, notes)")
        .eq("id", requestId)
        .ilike("description", `%${SUPPORT_MARKER}%`)
        .single();

      if (error || !data) return json({ error: "REQUEST_NOT_FOUND" }, 404);

      let previousRequests = [];
      if (data.requester_account_id) {
        const { data: prev } = await supabase
          .from("hr_tasks")
          .select("id, task_type, status, created_at, resolved_at")
          .eq("requester_account_id", data.requester_account_id)
          .neq("id", requestId)
          .in("task_type", STORED_SUPPORT_TASK_TYPES)
          .ilike("description", `%${SUPPORT_MARKER}%`)
          .order("created_at", { ascending: false })
          .limit(5);
        previousRequests = prev || [];
      }

      return json({ request: mapRequest(data), previousRequests });
    }

    if (!requestId) return json({ error: "NOT_FOUND" }, 404);

    // Fetch task for all action endpoints
    const { data: task, error: fetchErr } = await supabase
      .from("hr_tasks")
      .select("id, status, task_type, requester_account_id, description")
      .eq("id", requestId)
      .ilike("description", `%${SUPPORT_MARKER}%`)
      .single();

    if (fetchErr || !task) return json({ error: "REQUEST_NOT_FOUND" }, 404);

    // PATCH /api/admin/account-support/requests/:id/status
    if (action === "status" && method === "PATCH") {
      const body = await readJson(request);
      const newStatus = String(body.status || "");
      const validStatuses = ["new", "in_progress", "waiting_for_user", "done", "rejected"];
      if (!validStatuses.includes(newStatus)) return json({ error: "INVALID_STATUS" }, 400);
      if (["done", "rejected"].includes(task.status)) return json({ error: "REQUEST_ALREADY_RESOLVED" }, 409);

      const meta = parseMeta(task.description);
      const now = new Date().toISOString();

      if (newStatus === "in_progress" && !meta.accepted_at) {
        meta.accepted_at = now;
        meta.assigned_to = acct.accountId;
      }
      if (newStatus === "rejected" && !meta.rejected_at) meta.rejected_at = now;

      const patch = {
        status: newStatus,
        updated_at: now,
        description: JSON.stringify(meta),
      };
      if (["done", "rejected"].includes(newStatus)) {
        patch.resolved_at = now;
        patch.resolved_by = acct.accountId;
      }

      const { error } = await supabase.from("hr_tasks").update(patch).eq("id", requestId);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    // POST /api/admin/account-support/requests/:id/reject
    if (action === "reject" && method === "POST") {
      if (["done", "rejected"].includes(task.status)) return json({ error: "REQUEST_ALREADY_RESOLVED" }, 409);
      const body = await readJson(request);
      const resolutionNote = String(body.resolutionNote || "").trim().slice(0, 1000);
      const now = new Date().toISOString();

      const meta = parseMeta(task.description);
      meta.resolution_type = "rejected";
      meta.resolution_note = resolutionNote;
      meta.rejected_at = now;

      const { error } = await supabase.from("hr_tasks").update({
        status: "rejected",
        resolved_at: now,
        resolved_by: acct.accountId,
        updated_at: now,
        description: JSON.stringify(meta),
      }).eq("id", requestId);

      if (error) return json({ error: error.message }, 500);

      auditLog(supabase, {
        actor_id: acct.accountId, action: "account_support_rejected",
        target_type: "hr_task", target_id: requestId, result: "success",
        details: { resolutionNote: resolutionNote.slice(0, 100) },
      });

      return json({ ok: true });
    }

    // POST /api/admin/account-support/requests/:id/reset-password
    if (action === "reset-password" && method === "POST") {
      if (!task.requester_account_id) return json({ error: "ACCOUNT_NOT_FOUND" }, 404);
      if (task.status === "done") return json({ error: "REQUEST_ALREADY_RESOLVED" }, 409);

      const body = await readJson(request);
      const newPassword = String(body.newPassword || "");
      if (newPassword.length < 6) return json({ error: "PASSWORD_TOO_SHORT" }, 400);
      const requireChange = body.requireChange !== false;

      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("id, full_name, account_status, password_status, avatar_url")
        .eq("id", task.requester_account_id)
        .single();

      if (profileErr || !profile) return json({ error: "ACCOUNT_NOT_FOUND" }, 404);

      const rawHash = await hashPassword(newPassword);
      const storedHash = requireChange ? markMustChange(rawHash) : rawHash;

      // Try password_status first
      const { error: pw1 } = await supabase.from("profiles").update({ password_status: storedHash }).eq("id", profile.id);
      if (pw1) {
        const { error: pw2 } = await supabase.from("profiles").update({ avatar_url: HASH_PREFIX + storedHash }).eq("id", profile.id);
        if (pw2) return json({ error: "PASSWORD_RESET_FAILED" }, 500);
      }

      // Unlock + reset counter
      await supabase.from("profiles").update({
        account_status: "active",
        failed_login_count: 0,
        locked_until: null,
        updated_at: new Date().toISOString(),
      }).eq("id", profile.id);

      // Resolve request
      const meta = parseMeta(task.description);
      meta.resolution_type = "temporary_password_created";
      meta.resolution_note = "Mật khẩu tạm đã được tạo bởi HR";
      const now = new Date().toISOString();

      await supabase.from("hr_tasks").update({
        status: "done",
        resolved_at: now,
        resolved_by: acct.accountId,
        updated_at: now,
        description: JSON.stringify(meta),
      }).eq("id", requestId);

      auditLog(supabase, {
        actor_id: acct.accountId, action: "password_reset_by_hr",
        target_type: "profile", target_id: profile.id, result: "success",
        details: { requestId, requireChange },
      });

      return json({ ok: true, targetId: profile.id, targetName: profile.full_name });
    }

    // POST /api/admin/account-support/requests/:id/unlock
    if (action === "unlock" && method === "POST") {
      if (!task.requester_account_id) return json({ error: "ACCOUNT_NOT_FOUND" }, 404);

      const { error: unlockErr } = await supabase.from("profiles").update({
        account_status: "active",
        failed_login_count: 0,
        locked_until: null,
        updated_at: new Date().toISOString(),
      }).eq("id", task.requester_account_id);

      if (unlockErr) return json({ error: "ACCOUNT_UNLOCK_FAILED", message: unlockErr.message }, 500);

      const meta = parseMeta(task.description);
      meta.resolution_type = "account_unlocked";
      const now = new Date().toISOString();

      await supabase.from("hr_tasks").update({
        status: "done",
        resolved_at: now,
        resolved_by: acct.accountId,
        updated_at: now,
        description: JSON.stringify(meta),
      }).eq("id", requestId);

      auditLog(supabase, {
        actor_id: acct.accountId, action: "account_unlocked",
        target_type: "profile", target_id: task.requester_account_id, result: "success",
        details: { requestId },
      });

      return json({ ok: true });
    }

    // POST /api/admin/account-support/requests/:id/reactivate
    if (action === "reactivate" && method === "POST") {
      if (!task.requester_account_id) return json({ error: "ACCOUNT_NOT_FOUND" }, 404);

      const { error: reactivateErr } = await supabase.from("profiles").update({
        account_status: "active",
        failed_login_count: 0,
        locked_until: null,
        updated_at: new Date().toISOString(),
      }).eq("id", task.requester_account_id);

      if (reactivateErr) return json({ error: "ACCOUNT_REACTIVATE_FAILED", message: reactivateErr.message }, 500);

      const meta = parseMeta(task.description);
      meta.resolution_type = "account_reactivated";
      const now = new Date().toISOString();

      await supabase.from("hr_tasks").update({
        status: "done",
        resolved_at: now,
        resolved_by: acct.accountId,
        updated_at: now,
        description: JSON.stringify(meta),
      }).eq("id", requestId);

      auditLog(supabase, {
        actor_id: acct.accountId, action: "account_reactivated",
        target_type: "profile", target_id: task.requester_account_id, result: "success",
        details: { requestId },
      });

      return json({ ok: true });
    }

    return json({ error: "NOT_FOUND" }, 404);
  }

  return json({ error: "NOT_FOUND" }, 404);
}

/**
 * HR standalone account actions (not tied to a support request).
 * Used by the HR accounts page directly.
 */
export async function handleHrAccountActions(request, env) {
  const method = request.method.toUpperCase();
  if (method === "OPTIONS") return corsPreflight();

  const acct = await requireHr(request, env);
  if (!acct) return json({ error: "HR_ONLY" }, 403);

  const url = new URL(request.url);
  const body = await readJson(request);
  const action = url.searchParams.get("action") || body.action;
  const supabase = getSupabase(env);

  // Prevent acting on own account
  const targetId = String(body.targetId || "");
  if (!targetId) return json({ error: "ACCOUNT_NOT_FOUND" }, 400);
  if (targetId === acct.accountId) return json({ error: "CANNOT_MODIFY_SELF" }, 403);

  const { data: target, error: fetchErr } = await supabase
    .from("profiles")
    .select("id, full_name, account_status, role")
    .eq("id", targetId)
    .single();

  if (fetchErr || !target) return json({ error: "ACCOUNT_NOT_FOUND" }, 404);
  if (target.role === "superAdmin") return json({ error: "CANNOT_MODIFY_SYSTEM_ACCOUNT" }, 403);

  function auditAction(act, result, details = {}) {
    auditLog(supabase, {
      actor_id: acct.accountId, action: act,
      target_type: "profile", target_id: targetId, result,
      details: { targetName: target.full_name, ...details },
    });
  }

  if (action === "lock") {
    const lockedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h manual lock
    const { error } = await supabase.from("profiles").update({
      locked_until: lockedUntil,
      updated_at: new Date().toISOString(),
    }).eq("id", targetId);
    if (error) return json({ error: "ACCOUNT_LOCK_FAILED", message: error.message }, 500);
    auditAction("account_locked", "success");
    return json({ ok: true, lockedUntil });
  }

  if (action === "unlock") {
    const { error } = await supabase.from("profiles").update({
      account_status: "active",
      failed_login_count: 0,
      locked_until: null,
      updated_at: new Date().toISOString(),
    }).eq("id", targetId);
    if (error) return json({ error: "ACCOUNT_UNLOCK_FAILED", message: error.message }, 500);
    auditAction("account_unlocked", "success");
    return json({ ok: true });
  }

  if (action === "disable") {
    const reason = String(body.reason || "").trim().slice(0, 500);
    const { error } = await supabase.from("profiles").update({
      account_status: "inactive",
      updated_at: new Date().toISOString(),
    }).eq("id", targetId);
    if (error) return json({ error: "ACCOUNT_DISABLE_FAILED", message: error.message }, 500);
    auditAction("account_disabled", "success", { reason });
    return json({ ok: true });
  }

  if (action === "enable") {
    const { error } = await supabase.from("profiles").update({
      account_status: "active",
      failed_login_count: 0,
      locked_until: null,
      updated_at: new Date().toISOString(),
    }).eq("id", targetId);
    if (error) return json({ error: "ACCOUNT_ENABLE_FAILED", message: error.message }, 500);
    auditAction("account_reactivated", "success");
    return json({ ok: true });
  }

  if (action === "reset-password") {
    const newPassword = String(body.newPassword || "");
    if (newPassword.length < 6) return json({ error: "PASSWORD_TOO_SHORT" }, 400);
    const requireChange = body.requireChange !== false;

    const { data: profile } = await supabase.from("profiles").select("id, password_status, avatar_url").eq("id", targetId).single();
    if (!profile) return json({ error: "ACCOUNT_NOT_FOUND" }, 404);

    const rawHash = await hashPassword(newPassword);
    const storedHash = requireChange ? markMustChange(rawHash) : rawHash;

    const { error: pw1 } = await supabase.from("profiles").update({ password_status: storedHash }).eq("id", targetId);
    if (pw1) {
      const { error: pw2 } = await supabase.from("profiles").update({ avatar_url: HASH_PREFIX + storedHash }).eq("id", targetId);
      if (pw2) return json({ error: "PASSWORD_RESET_FAILED" }, 500);
    }

    // Unlock + reset counter on password reset
    await supabase.from("profiles").update({
      account_status: "active",
      failed_login_count: 0,
      locked_until: null,
      updated_at: new Date().toISOString(),
    }).eq("id", targetId);

    auditAction("password_reset_by_hr", "success", { requireChange });
    return json({ ok: true, targetId });
  }

  return json({ error: "INVALID_ACTION" }, 400);
}
