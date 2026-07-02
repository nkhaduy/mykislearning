/**
 * Auth routes: login, reset-password, change-password, setup-admin-password, create-user.
 *
 * Password storage strategy:
 *   1. Try profiles.password_status (after running the schema migration)
 *   2. Fall back to profiles.avatar_url with "__pwd__:" prefix (works without migration)
 *
 * Migration SQL (run once in Supabase SQL Editor to prefer password_status column):
 *   ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_password_status_check;
 *   ALTER TABLE profiles ADD CONSTRAINT profiles_password_status_check
 *     CHECK (password_status IS NULL
 *       OR password_status IN ('normal','resetRequired','pendingActivation')
 *       OR password_status LIKE 'pbkdf2$%'
 *       OR password_status LIKE 'reset:pbkdf2$%');
 *
 * Sessions: HMAC-signed compact tokens (sub=profileId, role, exp).
 * Secret: env.JWT_SECRET or last 32 chars of env.SUPABASE_SERVICE_ROLE_KEY.
 */

import { json, readJson, methodNotAllowed } from "../services/responses.js";
import { getSupabase } from "../services/supabase.js";
import {
  hashPassword, verifyPassword, isHashFormat, isMustChange, markMustChange,
  signToken, verifyToken,
} from "../services/crypto.js";
import { auditLater, writeAuditLog } from "../services/audit-service.js";

const HASH_PREFIX = "__pwd__:";

function jwtSecret(env) {
  return env.JWT_SECRET || env.SUPABASE_SERVICE_ROLE_KEY?.slice(-32) || "dev-secret";
}

/** Fire-and-forget audit log — never throws, doesn't block response. */
function auditLog(supabase, row) {
  Promise.resolve(supabase.from("audit_logs").insert(row)).then(null, () => {});
}

function taskStatusForResolution(status) {
  return status === "rejected" ? "rejected" : "done";
}

/** Verify a Bearer token and return { accountId, role } or null. */
export async function verifySession(request, env) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  const payload = await verifyToken(token, jwtSecret(env));
  if (!payload?.sub || !payload?.role) return null;
  return { accountId: payload.sub, role: payload.role };
}

async function requireHrSession(request, env) {
  const acct = await verifySession(request, env);
  if (!acct) return { error: json({ error: "Unauthorized" }, 401) };
  if (!["hr", "admin"].includes(acct.role)) return { error: json({ error: "Insufficient permissions" }, 403) };
  return { caller: acct };
}

/** Read stored hash — checks password_status first, then avatar_url fallback. */
function readStoredHash(profile) {
  if (profile.password_status && isHashFormat(profile.password_status)) return profile.password_status;
  if (profile.avatar_url?.startsWith(HASH_PREFIX)) return profile.avatar_url.slice(HASH_PREFIX.length);
  return null;
}

/**
 * Persist a hash to the profile.
 * Tries password_status first; if constraint error, stores in avatar_url.
 */
async function writeHash(supabase, profileId, hash) {
  const { error } = await supabase.from("profiles")
    .update({ password_status: hash })
    .eq("id", profileId);
  if (!error) return { column: "password_status" };
  // Constraint violation — fall back to avatar_url
  const { error: err2 } = await supabase.from("profiles")
    .update({ avatar_url: HASH_PREFIX + hash })
    .eq("id", profileId);
  if (err2) return { error: err2.message };
  return { column: "avatar_url" };
}

export async function handleAuth(request, env) {
  const method = request.method.toUpperCase();
  if (method !== "POST") return methodNotAllowed();

  const url = new URL(request.url);
  const body = await readJson(request);
  const action = url.searchParams.get("action") || body.action;
  const supabase = getSupabase(env);

  // ── LOGIN ────────────────────────────────────────────────────────────────
  if (action === "login") {
    const { email, password } = body;
    if (!email || !password) return json({ error: "EMAIL_PASSWORD_REQUIRED" }, 400);

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, account_status, password_status, avatar_url, employee_code, department, position, failed_login_count, locked_until, notes")
      .eq("email", String(email).trim().toLowerCase())
      .single();

    if (profileErr || !profile) {
      auditLater(supabase, request, {
        actorType: "anonymous",
        action: "auth.login_failed",
        status: "failed",
        entityType: "profile",
        metadata: { reason: "PROFILE_NOT_FOUND", email_normalized: String(email).trim().toLowerCase() },
      });
      return json({ error: "INVALID_CREDENTIALS", message: "Tên đăng nhập hoặc mật khẩu không chính xác." }, 401);
    }

    const status = profile.account_status || "active";
    if (["disabled", "inactive", "suspended"].includes(status)) {
      return json({ error: "ACCOUNT_INACTIVE", status: "disabled", message: "Tài khoản hiện đã bị vô hiệu hóa. Vui lòng liên hệ HR nếu bạn cho rằng đây là nhầm lẫn." }, 403);
    }

    let profileNotes = {};
    try { profileNotes = profile.notes ? JSON.parse(profile.notes) : {}; } catch {}
    const lockExempt = ["hr", "admin"].includes(profile.role)
      || profileNotes.is_demo === true
      || ["acc-hr-demo", "acc-hr-001"].includes(profile.id);

    // Check temporary lock via locked_until column. HR/admin/demo accounts are never blocked by this guard.
    if (!lockExempt && profile.locked_until && new Date(profile.locked_until) > new Date()) {
      return json({
        error: "ACCOUNT_LOCKED",
        status: "locked",
        lockedUntil: profile.locked_until,
        message: "Tài khoản đang tạm khóa do đăng nhập sai quá nhiều lần. Vui lòng thử lại sau hoặc gửi yêu cầu hỗ trợ đến HR.",
      }, 403);
    }

    const storedHash = readStoredHash(profile);
    if (!storedHash) {
      return json({ error: "ACCOUNT_NEEDS_RESET", message: "Tài khoản chưa được kích hoạt. Vui lòng liên hệ HR để đặt lại mật khẩu." }, 403);
    }

    const valid = await verifyPassword(String(password), storedHash);
    if (!valid) {
      if (lockExempt) {
        auditLater(supabase, request, {
          actor: { accountId: profile.id, role: profile.role, fullName: profile.full_name },
          action: "auth.login_failed",
          status: "failed",
          entityType: "profile",
          entityId: profile.id,
          entityDisplayName: profile.full_name,
          metadata: { reason: "WRONG_PASSWORD", lock_exempt: true },
        });
        return json({
          error: "INVALID_CREDENTIALS",
          attemptsLeft: null,
          message: "Tên đăng nhập hoặc mật khẩu không chính xác.",
        }, 401);
      }
      // Increment failed login count and auto-lock after threshold
      const MAX_ATTEMPTS = 5;
      const LOCK_MINUTES = 30;
      const currentCount = profile.failed_login_count || 0;
      const newCount = currentCount + 1;
      const profilePatch = { failed_login_count: newCount, updated_at: new Date().toISOString() };

      let autoLocked = false;
      if (newCount >= MAX_ATTEMPTS) {
        profilePatch.locked_until = new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString();
        autoLocked = true;
      }

      // Await counter update so next request sees the incremented value
      await supabase.from("profiles").update(profilePatch).eq("id", profile.id);

      auditLater(supabase, request, {
        actor: { accountId: profile.id, role: profile.role, fullName: profile.full_name },
        action: autoLocked ? "account.locked" : "auth.login_failed",
        status: "failed",
        entityType: "profile",
        entityId: profile.id,
        entityDisplayName: profile.full_name,
        beforeData: { failed_login_count: currentCount, locked_until: profile.locked_until || null },
        afterData: { failed_login_count: newCount, locked_until: profilePatch.locked_until || null },
        metadata: { reason: "WRONG_PASSWORD", attempt: newCount, auto_locked: autoLocked },
      });

      if (autoLocked) {
        return json({
          error: "ACCOUNT_LOCKED",
          status: "locked",
          lockedUntil: profilePatch.locked_until,
          message: `Tài khoản đã bị tạm khóa do đăng nhập sai ${MAX_ATTEMPTS} lần. Tự động mở khóa sau ${LOCK_MINUTES} phút hoặc liên hệ HR.`,
        }, 403);
      }

      const remaining = MAX_ATTEMPTS - newCount;
      return json({
        error: "INVALID_CREDENTIALS",
        attemptsLeft: remaining > 0 ? remaining : 0,
        message: "Tên đăng nhập hoặc mật khẩu không chính xác.",
      }, 401);
    }

    const mustChange = isMustChange(storedHash);
    const expSecs = Math.floor(Date.now() / 1000) + 24 * 3600;
    const token = await signToken({ sub: profile.id, role: profile.role || "employee", exp: expSecs }, jwtSecret(env));

    auditLater(supabase, request, {
      actor: { accountId: profile.id, role: profile.role, fullName: profile.full_name },
      action: "auth.login_succeeded",
      entityType: "profile",
      entityId: profile.id,
      entityDisplayName: profile.full_name,
      metadata: { must_change_password: mustChange },
    });
    // Reset failed count and lock on successful login
    Promise.resolve(supabase.from("profiles").update({
      last_login_at: new Date().toISOString(),
      failed_login_count: 0,
      locked_until: null,
    }).eq("id", profile.id)).then(null, () => {});

    return json({
      access_token: token,
      expires_at: expSecs,
      profile: {
        id: profile.id,
        email: profile.email,
        fullName: profile.full_name,
        role: profile.role || "employee",
        accountStatus: profile.account_status || "active",
        passwordStatus: mustChange ? "resetRequired" : "normal",
        employeeCode: profile.employee_code || "",
        department: profile.department || "",
        position: profile.position || "",
      },
    });
  }

  if (action === "request-password-reset") {
    const email = String(body.email || "").trim().toLowerCase();
    if (!email) return json({ error: "EMAIL_REQUIRED" }, 400);
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, account_status, role")
      .eq("email", email)
      .single();

    if (profile && profile.role === "employee" && !["disabled", "inactive"].includes(profile.account_status || "active")) {
      const { data: existing } = await supabase.from("hr_tasks")
        .select("id")
        .eq("task_type", "password_reset")
        .eq("reference_type", "profile")
        .eq("reference_id", profile.id)
        .in("status", ["new", "in_progress"])
        .maybeSingle();
      const payload = {
        task_type: "password_reset",
        requester_account_id: profile.id,
        reference_type: "profile",
        reference_id: profile.id,
        title: "Yêu cầu reset mật khẩu",
        description: `${profile.full_name || email} yêu cầu HR hỗ trợ đặt lại mật khẩu.`,
        priority: "high",
        status: "new",
        updated_at: new Date().toISOString(),
      };
      const write = existing?.id
        ? supabase.from("hr_tasks").update(payload).eq("id", existing.id)
        : supabase.from("hr_tasks").insert(payload);
      await write.then(null, () => {});
    }

    return json({ ok: true });
  }

  // ── RESET PASSWORD (HR action) ───────────────────────────────────────────
  if (action === "reset-password") {
    const { error, caller } = await requireHrSession(request, env);
    if (error) return error;

    const { targetUserId, targetEmail, newPassword, requireChange = true, unlock = true } = body;
    if (!newPassword) return json({ error: "newPassword required" }, 400);
    if (!targetUserId && !targetEmail) return json({ error: "ACCOUNT_NOT_FOUND — provide targetUserId or targetEmail" }, 400);

    let query = supabase.from("profiles").select("id, full_name, account_status");
    if (targetUserId) query = query.eq("id", String(targetUserId));
    else query = query.eq("email", String(targetEmail).trim().toLowerCase());
    const { data: target, error: lookupErr } = await query.single();

    if (lookupErr || !target) return json({ error: "ACCOUNT_NOT_FOUND" }, 404);
    if (target.account_status === "disabled") return json({ error: "ACCOUNT_INACTIVE" }, 403);

    const rawHash = await hashPassword(String(newPassword));
    const storedHash = requireChange ? markMustChange(rawHash) : rawHash;

    const writeResult = await writeHash(supabase, target.id, storedHash);
    if (writeResult.error) return json({ error: "PASSWORD_UPDATE_FAILED", message: writeResult.error }, 500);

    if (unlock) {
      await supabase.from("profiles").update({ account_status: "active" }).eq("id", target.id);
    }

    await writeAuditLog(supabase, request, {
      actor: caller,
      action: "account.password_reset_completed",
      entityType: "profile",
      entityId: target.id,
      entityDisplayName: target.full_name,
      beforeData: { password_status: "existing", account_status: target.account_status },
      afterData: { password_status: requireChange ? "resetRequired" : "normal", account_status: unlock ? "active" : target.account_status },
      metadata: { require_change: requireChange, unlock, target: target.full_name },
    }, { critical: true });

    await supabase.from("hr_tasks").update({
      status: taskStatusForResolution("done"),
      resolved_at: new Date().toISOString(),
      resolved_by: caller.accountId,
      updated_at: new Date().toISOString(),
    }).eq("task_type", "password_reset").eq("reference_type", "profile").eq("reference_id", target.id).in("status", ["new", "in_progress"]);

    return json({ ok: true, targetId: target.id, targetName: target.full_name });
  }

  // ── CHANGE PASSWORD (user action) ────────────────────────────────────────
  if (action === "change-password") {
    const acct = await verifySession(request, env);
    if (!acct) return json({ error: "Unauthorized" }, 401);

    const { currentPassword, newPassword } = body;
    if (!currentPassword || !newPassword) return json({ error: "currentPassword and newPassword required" }, 400);

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, password_status, avatar_url")
      .eq("id", acct.accountId)
      .single();

    if (!profile) return json({ error: "PROFILE_NOT_FOUND" }, 404);

    const storedHash = readStoredHash(profile);
    if (!storedHash) return json({ error: "ACCOUNT_NEEDS_RESET" }, 403);

    const valid = await verifyPassword(String(currentPassword), storedHash);
    if (!valid) return json({ error: "WRONG_CURRENT_PASSWORD", message: "Mật khẩu hiện tại không đúng." }, 401);

    const newHash = await hashPassword(String(newPassword));
    const writeResult = await writeHash(supabase, acct.accountId, newHash);
    if (writeResult.error) return json({ error: "PASSWORD_UPDATE_FAILED", message: writeResult.error }, 500);

    // Clear avatar_url fallback if password_status now holds the hash
    if (writeResult.column === "password_status") {
      const { data: cur } = await supabase.from("profiles").select("avatar_url").eq("id", acct.accountId).single();
      if (cur?.avatar_url?.startsWith(HASH_PREFIX)) {
        await supabase.from("profiles").update({ avatar_url: null }).eq("id", acct.accountId);
      }
    }

    auditLater(supabase, request, {
      actor: acct,
      action: "account.password_reset_completed",
      entityType: "profile",
      entityId: acct.accountId,
      metadata: { self_service: true },
    });

    return json({ ok: true });
  }

  // ── SETUP ADMIN PASSWORD (bootstrap, requires X-Setup-Key) ───────────────
  if (action === "setup-admin-password") {
    const setupKey = request.headers.get("x-setup-key") || "";
    const expectedKey = env.SETUP_KEY || env.SUPABASE_SERVICE_ROLE_KEY?.slice(-16) || "";
    if (!setupKey || setupKey !== expectedKey) return json({ error: "Invalid setup key" }, 401);

    const { email, password } = body;
    if (!email || !password) return json({ error: "email and password required" }, 400);

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, password_status, avatar_url")
      .eq("email", String(email).trim().toLowerCase())
      .single();

    if (!profile) return json({ error: "Profile not found" }, 404);

    const { force = false } = body;
    const existing = readStoredHash(profile);
    if (existing && !force) return json({ error: "Password already set. Use reset-password or pass force:true to override." }, 409);

    const hash = await hashPassword(String(password));
    const writeResult = await writeHash(supabase, profile.id, hash);
    if (writeResult.error) return json({ error: "WRITE_FAILED", message: writeResult.error }, 500);

    // Reset account_status, failed_login_count and locked_until when force-setting password
    if (force) await supabase.from("profiles").update({ account_status: "active", failed_login_count: 0, locked_until: null }).eq("id", profile.id);

    return json({ ok: true, id: profile.id, role: profile.role, storageColumn: writeResult.column });
  }

  // ── CREATE USER ───────────────────────────────────────────────────────────
  if (action === "create-user") {
    const { error, caller } = await requireHrSession(request, env);
    if (error) return error;

    const { email, password, fullName, employeeCode, role, department, position } = body;
    if (!email || !password || !fullName) return json({ error: "email, password, fullName are required" }, 400);

    const tempHash = markMustChange(await hashPassword(String(password)));
    const newId = `emp-${crypto.randomUUID()}`;

    const { error: profileErr } = await supabase.from("profiles").insert({
      id: newId,
      full_name: fullName.trim(),
      email: String(email).trim().toLowerCase(),
      employee_code: employeeCode || null,
      role: role || "employee",
      department: department || null,
      position: position || null,
      account_status: "active",
      avatar_url: HASH_PREFIX + tempHash,
    });

    if (profileErr) return json({ error: profileErr.message }, 400);

    auditLog(supabase, {
      actor_id: caller.accountId, action: "create_user", target_type: "profile",
      target_id: newId, result: "success", details: { email, role: role || "employee" },
    });

    return json({ userId: newId }, 201);
  }

  return json({ error: "Missing or invalid action" }, 400);
}
