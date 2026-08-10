/**
 * Auth routes: login, reset-password, change-password, setup-admin-password, create-user.
 *
 * Sessions: HMAC-signed compact tokens (sub=profileId, role, exp).
 * Password hashes are stored only in private.account_credentials.
 */

import { json, readJson, methodNotAllowed } from "../services/responses.js";
import { getSupabase } from "../services/supabase.js";
import {
  hashPassword, verifyPassword, isMustChange,
  verifyToken,
} from "../services/crypto.js";
import { auditLater, writeAuditLog } from "../services/audit-service.js";
import { readCredential, writeCredential } from "../services/credentials.js";
import { enforceRateLimit } from "../services/rate-limit.js";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  accessAndRefreshCookies,
  clearSessionCookies,
  cookieValue,
  createAuthSession,
  jwtSecret,
  rotateAuthSession,
  validateAuthSecurityConfig,
  withAuthCookies,
} from "../services/auth-sessions.js";
import {
  ensureLocalDevelopmentAdmin,
  isReservedLocalAdminProfile,
  localDevelopmentAdminCredentials,
  localDevelopmentAdminEnabled,
  LOCAL_ADMIN_EMAIL,
} from "../services/local-development.js";
import {
  deploymentTestAccountForLogin,
  ensureDeploymentTestAccount,
  isReservedDeploymentTestProfile,
} from "../services/deployment-test-account.js";

const CANONICAL_ROLES = new Set(["hr", "employee"]);
const EMPLOYEE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function boundedText(value, field, { required = false, max = 200 } = {}) {
  const normalized = String(value ?? "").trim().replace(/\s+/g, " ");
  if (required && !normalized) {
    throw Object.assign(new Error(`${field} is required`), { status: 422, code: "INVALID_INPUT" });
  }
  if (normalized.length > max) {
    throw Object.assign(new Error(`${field} is too long`), { status: 422, code: "INVALID_INPUT" });
  }
  return normalized || null;
}

export function validateEmployeeCreationInput(body = {}) {
  const email = boundedText(body.email, "email", { required: true, max: 320 }).toLowerCase();
  if (!EMPLOYEE_EMAIL_PATTERN.test(email)) {
    throw Object.assign(new Error("email is invalid"), { status: 422, code: "INVALID_EMAIL" });
  }
  const password = validatePasswordInput(body.password);
  const fullName = boundedText(body.fullName, "fullName", { required: true, max: 200 });
  const employeeCode = boundedText(body.employeeCode, "employeeCode", { required: true, max: 80 });
  const department = boundedText(body.department, "department", { required: true, max: 200 });
  const position = boundedText(body.position, "position", { max: 200 });
  if (body.role !== undefined && body.role !== "employee") {
    throw Object.assign(new Error("new employees must use the employee role"), { status: 422, code: "INVALID_ROLE" });
  }
  return { email, password, fullName, employeeCode, department, position, role: "employee" };
}

export function validatePasswordInput(password, { currentPassword = null } = {}) {
  const value = String(password ?? "");
  if (value.length < 6 || value.length > 256) {
    throw Object.assign(new Error("INVALID_PASSWORD"), { status: 422, code: "INVALID_PASSWORD" });
  }
  if (currentPassword !== null && value === String(currentPassword)) {
    throw Object.assign(new Error("PASSWORD_REUSED"), { status: 422, code: "PASSWORD_REUSED" });
  }
  return value;
}

export function selectEffectiveRole(allowedRoles, requestedRole) {
  const allowed = [...new Set((allowedRoles || []).filter((role) => CANONICAL_ROLES.has(role)))];
  const requested = String(requestedRole || "").trim().toLowerCase();
  if (requested) {
    if (!allowed.includes(requested)) {
      throw Object.assign(new Error("INVALID_CREDENTIALS"), { status: 401, code: "INVALID_CREDENTIALS" });
    }
    return requested;
  }
  if (allowed.length === 1) return allowed[0];
  throw Object.assign(new Error("ROLE_SELECTION_REQUIRED"), { status: 422, code: "ROLE_SELECTION_REQUIRED" });
}

function taskStatusForResolution(status) {
  return status === "rejected" ? "rejected" : "done";
}

async function constantTimeSecretEqual(actual, expected) {
  const encodedActual = new TextEncoder().encode(String(actual || ""));
  const encodedExpected = new TextEncoder().encode(String(expected || ""));
  const [actualDigest, expectedDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encodedActual),
    crypto.subtle.digest("SHA-256", encodedExpected),
  ]);
  const actualBytes = new Uint8Array(actualDigest);
  const expectedBytes = new Uint8Array(expectedDigest);
  let difference = 0;
  for (let index = 0; index < actualBytes.length; index += 1) {
    difference |= actualBytes[index] ^ expectedBytes[index];
  }
  return difference === 0;
}

/** Verify a Bearer token and return { accountId, role } or null. */
export async function verifySession(request, env) {
  const header = request.headers.get("authorization") || "";
  const token = header
    ? (header.startsWith("Bearer ") ? header.slice(7).trim() : "")
    : cookieValue(request, ACCESS_COOKIE);
  if (!token) return null;
  const payload = await verifyToken(token, jwtSecret(env));
  if (!payload?.sub || !payload?.sid) return null;
  const supabase = getSupabase(env);
  const { data, error } = await supabase.rpc("service_get_auth_session", {
    p_session_id: payload.sid,
    p_profile_id: payload.sub,
  });
  if (error) throw Object.assign(new Error("Session validation failed"), { status: 503, code: "SESSION_STORE_UNAVAILABLE" });
  if (!data?.valid) return null;
  if (!CANONICAL_ROLES.has(data.role) || payload.role !== data.role) {
    await supabase.rpc("service_revoke_auth_session", {
      p_session_id: payload.sid,
      p_profile_id: payload.sub,
      p_reason: "role_mismatch",
    });
    return null;
  }
  return {
    accountId: data.profile_id,
    role: data.role,
    sessionId: data.session_id,
    familyId: data.family_id,
    exp: payload.exp || null,
    sessionExpiresAt: data.expires_at,
  };
}

export async function requirePrivilegedSession(request, env) {
  const session = await verifySession(request, env);
  if (!session) return { error: json({ error: "UNAUTHORIZED" }, 401) };
  if (!["hr"].includes(session.role)) return { error: json({ error: "INSUFFICIENT_PERMISSIONS" }, 403) };
  return { caller: session };
}

async function requireHrSession(request, env) {
  const acct = await verifySession(request, env);
  if (!acct) return { error: json({ error: "Unauthorized" }, 401) };
  if (!["hr"].includes(acct.role)) return { error: json({ error: "Insufficient permissions" }, 403) };
  return { caller: acct };
}

function publicProfile(profile, mustChange = false) {
  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.role,
    accountStatus: profile.account_status || "active",
    passwordStatus: mustChange ? "resetRequired" : "normal",
    employeeCode: profile.employee_code || "",
    department: profile.department || "",
    position: profile.position || "",
  };
}

function sessionResponse(request, session, profile, mustChange = false, extra = {}) {
  return withAuthCookies(json({
    expires_at: Math.floor(new Date(session.sessionExpiresAt).getTime() / 1000),
    access_expires_at: session.accessExpiresAt,
    profile: publicProfile(profile, mustChange),
    ...extra,
  }), accessAndRefreshCookies(request, session));
}

export async function handleAuth(request, env) {
  validateAuthSecurityConfig(env);
  const method = request.method.toUpperCase();
  const url = new URL(request.url);
  const queryAction = url.searchParams.get("action") || "";
  if (method !== "POST" && !(method === "GET" && queryAction === "session")) return methodNotAllowed();

  const body = method === "POST" ? await readJson(request) : {};
  const action = queryAction || body.action;
  const supabase = getSupabase(env);

  if (action === "session") {
    const session = await verifySession(request, env);
    if (!session) return json({ authenticated: false, error: "UNAUTHORIZED" }, 401);
    return json({
      authenticated: true,
      expires_at: session.sessionExpiresAt ? Math.floor(new Date(session.sessionExpiresAt).getTime() / 1000) : null,
      account: { id: session.accountId, role: session.role },
    });
  }

  if (action === "refresh") {
    const limit = await enforceRateLimit(request, env, "refresh-session", cookieValue(request, REFRESH_COOKIE).slice(0, 48), { limit: 20, windowSeconds: 300, critical: true });
    if (limit) return limit;
    const rotated = await rotateAuthSession(request, env);
    if (!rotated.ok) {
      if (rotated.reason === "reuse_detected") {
        auditLater(supabase, request, {
          actorType: "anonymous",
          action: "auth.refresh_reuse_detected",
          status: "failed",
          entityType: "session",
          entityId: rotated.audit?.session_id || null,
          metadata: { family_id: rotated.audit?.family_id || null },
        });
      }
      return withAuthCookies(json({ error: "SESSION_INVALID", code: "REAUTHENTICATION_REQUIRED" }, 401), clearSessionCookies(request));
    }
    return withAuthCookies(json({ ok: true, expires_at: rotated.accessExpiresAt }), accessAndRefreshCookies(request, rotated));
  }

  if (action === "logout") {
    const session = await verifySession(request, env);
    if (session?.sessionId) {
      const { error: revokeError } = await supabase.rpc("service_revoke_auth_session", {
        p_session_id: session.sessionId,
        p_profile_id: session.accountId,
        p_reason: "logout",
      });
      if (revokeError) throw Object.assign(new Error("Session revocation write failed"), { status: 503, code: "SESSION_STORE_UNAVAILABLE" });
      auditLater(supabase, request, {
        actor: session,
        action: "auth.logout",
        entityType: "session",
        entityId: session.sessionId,
      });
    }
    return withAuthCookies(json({ ok: true }), clearSessionCookies(request));
  }

  if (action === "logout-all") {
    const session = await verifySession(request, env);
    if (!session) return json({ error: "UNAUTHORIZED" }, 401);
    const { error } = await supabase.rpc("service_revoke_all_auth_sessions", {
      p_profile_id: session.accountId,
      p_reason: "logout_all",
      p_except_session_id: null,
    });
    if (error) throw Object.assign(new Error("Session revocation failed"), { status: 503, code: "SESSION_STORE_UNAVAILABLE" });
    auditLater(supabase, request, { actor: session, action: "auth.logout_all", entityType: "profile", entityId: session.accountId });
    return withAuthCookies(json({ ok: true }), clearSessionCookies(request));
  }

  if (action === "sessions") {
    const session = await verifySession(request, env);
    if (!session) return json({ error: "UNAUTHORIZED" }, 401);
    const { data, error } = await supabase.rpc("service_list_auth_sessions", {
      p_profile_id: session.accountId,
      p_current_session_id: session.sessionId,
    });
    if (error) throw Object.assign(new Error("Session list unavailable"), { status: 503, code: "SESSION_STORE_UNAVAILABLE" });
    return json({ sessions: data || [] });
  }

  if (action === "revoke-session") {
    const session = await verifySession(request, env);
    if (!session) return json({ error: "UNAUTHORIZED" }, 401);
    const targetSessionId = String(body.sessionId || "");
    if (!/^[0-9a-f-]{36}$/.test(targetSessionId)) return json({ error: "INVALID_SESSION" }, 400);
    const { error } = await supabase.rpc("service_revoke_auth_session", {
      p_session_id: targetSessionId,
      p_profile_id: session.accountId,
      p_reason: "user_revoked",
    });
    if (error) throw Object.assign(new Error("Session revocation failed"), { status: 503, code: "SESSION_STORE_UNAVAILABLE" });
    return json({ ok: true, currentRevoked: targetSessionId === session.sessionId });
  }

  if (action === "admin-revoke-sessions") {
    const { caller, error } = await requirePrivilegedSession(request, env);
    if (error) return error;
    const targetAccountId = String(body.targetAccountId || "").slice(0, 160);
    if (!targetAccountId || targetAccountId === caller.accountId) return json({ error: "INVALID_TARGET" }, 400);
    const { error: revokeError } = await supabase.rpc("service_revoke_all_auth_sessions", {
      p_profile_id: targetAccountId,
      p_reason: "admin_revoked",
      p_except_session_id: null,
    });
    if (revokeError) throw Object.assign(new Error("Session revocation failed"), { status: 503, code: "SESSION_STORE_UNAVAILABLE" });
    await writeAuditLog(supabase, request, {
      actor: caller,
      action: "auth.sessions_revoked_by_admin",
      entityType: "profile",
      entityId: targetAccountId,
    }, { critical: true });
    return json({ ok: true });
  }

  // ── LOGIN ────────────────────────────────────────────────────────────────
  if (action === "login") {
    const identifier = String(body.identifier || body.email || "").trim();
    const { password } = body;
    if (!identifier || !password) return json({ error: "IDENTIFIER_PASSWORD_REQUIRED" }, 400);
    const normalizedIdentifier = identifier.toLowerCase();
    const loginLimit = await enforceRateLimit(request, env, "login-account", normalizedIdentifier, { limit: 5, windowSeconds: 900 });
    if (loginLimit) return loginLimit;

    const localCredentials = localDevelopmentAdminCredentials(env);
    const isLocalAdminLogin = localDevelopmentAdminEnabled(request, env)
      && identifier === localCredentials.username;
    if (isLocalAdminLogin) await ensureLocalDevelopmentAdmin(supabase, request, env);
    const deploymentAccount = deploymentTestAccountForLogin(request, env, normalizedIdentifier);
    const isDeploymentTestLogin = Boolean(deploymentAccount);
    if (deploymentAccount) await ensureDeploymentTestAccount(supabase, deploymentAccount);
    const lookupEmail = isLocalAdminLogin
      ? LOCAL_ADMIN_EMAIL
      : isDeploymentTestLogin
        ? `${deploymentAccount.username}@deployment.invalid`
        : normalizedIdentifier;

    let profile = null;
    let profileErr = null;
    if (isLocalAdminLogin || isDeploymentTestLogin) {
      const result = await supabase
        .from("profiles")
        .select("id, full_name, email, role, account_status, employee_code, department, position, failed_login_count, locked_until")
        .eq("email", lookupEmail)
        .single();
      profile = result.data ? { ...result.data, allowed_roles: [result.data.role] } : null;
      profileErr = result.error;
    } else {
      const result = await supabase.rpc("service_resolve_login_identity", {
        p_identifier: normalizedIdentifier,
      });
      profile = result.data?.status === "found" ? result.data : null;
      profileErr = result.error || (result.data?.status !== "found" ? { code: result.data?.status || "not_found" } : null);
    }

    if (profileErr || !profile
      || (isReservedLocalAdminProfile(profile) && !isLocalAdminLogin)
      || (isReservedDeploymentTestProfile(profile) && !isDeploymentTestLogin)) {
      auditLater(supabase, request, {
        actorType: "anonymous",
        action: "auth.login_failed",
        status: "failed",
        entityType: "profile",
        metadata: { reason: "PROFILE_NOT_FOUND" },
      });
      return json({ error: "INVALID_CREDENTIALS", message: "Tên đăng nhập hoặc mật khẩu không chính xác." }, 401);
    }

    const allowedRoles = Array.isArray(profile.allowed_roles) ? profile.allowed_roles : [profile.role];
    if (!allowedRoles.some((role) => CANONICAL_ROLES.has(role))) {
      await supabase.rpc("service_revoke_all_auth_sessions", {
        p_profile_id: profile.id,
        p_reason: "invalid_role",
        p_except_session_id: null,
      });
      auditLater(supabase, request, {
        actor: { accountId: profile.id, role: profile.role || "employee" }, action: "auth.login_failed", status: "failed",
        entityType: "profile", entityId: profile.id, metadata: { reason: "INVALID_ROLE" },
      });
      return json({ error: "INVALID_ROLE", code: "REAUTHENTICATION_REQUIRED" }, 403);
    }

    const status = profile.account_status || "active";
    if (["disabled", "inactive", "suspended"].includes(status)) {
      auditLater(supabase, request, {
        actor: { accountId: profile.id, role: profile.role || allowedRoles[0] }, action: "auth.login_failed", status: "failed",
        entityType: "profile", entityId: profile.id, metadata: { reason: "ACCOUNT_INACTIVE" },
      });
      return json({ error: "INVALID_CREDENTIALS", message: "Tên đăng nhập hoặc mật khẩu không chính xác." }, 401);
    }

    // Privileged accounts use the same bounded lockout policy as employees.
    if (profile.locked_until && new Date(profile.locked_until) > new Date()) {
      auditLater(supabase, request, {
        actor: { accountId: profile.id, role: profile.role || allowedRoles[0] }, action: "auth.login_failed", status: "failed",
        entityType: "profile", entityId: profile.id, metadata: { reason: "ACCOUNT_LOCKED" },
      });
      return json({ error: "INVALID_CREDENTIALS", message: "Tên đăng nhập hoặc mật khẩu không chính xác." }, 401);
    }

    const credential = await readCredential(supabase, profile.id);
    const storedHash = credential?.password_hash;
    if (!storedHash) {
      return json({ error: "ACCOUNT_NEEDS_RESET", message: "Tài khoản chưa được kích hoạt. Vui lòng liên hệ HR để đặt lại mật khẩu." }, 403);
    }

    const valid = await verifyPassword(String(password), storedHash);
    if (!valid) {
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
        actor: { accountId: profile.id, role: profile.role || allowedRoles[0], fullName: profile.full_name },
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
        return json({ error: "INVALID_CREDENTIALS", message: "Tên đăng nhập hoặc mật khẩu không chính xác." }, 401);
      }

      return json({ error: "INVALID_CREDENTIALS", message: "Tên đăng nhập hoặc mật khẩu không chính xác." }, 401);
    }

    const mustChange = credential?.must_change === true || isMustChange(storedHash);
    if (storedHash.startsWith("pbkdf2$")) {
      await writeCredential(supabase, profile.id, await hashPassword(String(password)), { mustChange });
    }
    const rememberMe = body.rememberMe === true;
    let effectiveRole;
    try {
      effectiveRole = selectEffectiveRole(allowedRoles, body.requestedRole);
    } catch (error) {
      if (error.code === "ROLE_SELECTION_REQUIRED") {
        return json({ error: error.code, allowedRoles }, error.status);
      }
      throw error;
    }
    profile = { ...profile, role: effectiveRole };

    auditLater(supabase, request, {
      actor: { accountId: profile.id, role: effectiveRole, fullName: profile.full_name },
      action: "auth.login_succeeded",
      entityType: "profile",
      entityId: profile.id,
      entityDisplayName: profile.full_name,
      metadata: { must_change_password: mustChange, effective_role: effectiveRole },
    });
    // Reset failed count and lock on successful login
    Promise.resolve(supabase.from("profiles").update({
      last_login_at: new Date().toISOString(),
      failed_login_count: 0,
      locked_until: null,
    }).eq("id", profile.id)).then(null, () => {});

    const session = await createAuthSession(request, env, profile, { rememberMe });
    return sessionResponse(request, session, profile, mustChange);
  }

  if (action === "request-password-reset") {
    const email = String(body.email || "").trim().toLowerCase();
    if (!email) return json({ error: "EMAIL_REQUIRED" }, 400);
    const resetLimit = await enforceRateLimit(request, env, "password-reset-account", email, { limit: 3, windowSeconds: 900 });
    if (resetLimit) return resetLimit;
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
    const { error, caller } = await requirePrivilegedSession(request, env);
    if (error) return error;

    const { targetUserId, targetEmail, newPassword, requireChange = true, unlock = true } = body;
    if (!newPassword) return json({ error: "newPassword required" }, 400);
    const passwordValue = validatePasswordInput(newPassword);
    if (!targetUserId && !targetEmail) return json({ error: "ACCOUNT_NOT_FOUND — provide targetUserId or targetEmail" }, 400);

    let query = supabase.from("profiles").select("id, full_name, account_status");
    if (targetUserId) query = query.eq("id", String(targetUserId));
    else query = query.eq("email", String(targetEmail).trim().toLowerCase());
    const { data: target, error: lookupErr } = await query.single();

    if (lookupErr || !target) return json({ error: "ACCOUNT_NOT_FOUND" }, 404);
    if (target.account_status === "disabled") return json({ error: "ACCOUNT_INACTIVE" }, 403);

    const rawHash = await hashPassword(passwordValue);
    await writeCredential(supabase, target.id, rawHash, { mustChange: requireChange });
    await supabase.rpc("service_revoke_all_auth_sessions", {
      p_profile_id: target.id,
      p_reason: "password_reset",
      p_except_session_id: null,
    });

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
      .select("id")
      .eq("id", acct.accountId)
      .single();

    if (!profile) return json({ error: "PROFILE_NOT_FOUND" }, 404);

    const credential = await readCredential(supabase, profile.id);
    const storedHash = credential?.password_hash;
    if (!storedHash) return json({ error: "ACCOUNT_NEEDS_RESET" }, 403);

    const valid = await verifyPassword(String(currentPassword), storedHash);
    if (!valid) return json({ error: "WRONG_CURRENT_PASSWORD", message: "Mật khẩu hiện tại không đúng." }, 401);

    const passwordValue = validatePasswordInput(newPassword, { currentPassword });
    const newHash = await hashPassword(passwordValue);
    await writeCredential(supabase, acct.accountId, newHash, { mustChange: false });
    const { error: revokeError } = await supabase.rpc("service_revoke_all_auth_sessions", {
      p_profile_id: acct.accountId,
      p_reason: "password_changed",
      p_except_session_id: null,
    });
    if (revokeError) throw Object.assign(new Error("Session revocation failed"), { status: 503, code: "SESSION_STORE_UNAVAILABLE" });

    auditLater(supabase, request, {
      actor: acct,
      action: "account.password_reset_completed",
      entityType: "profile",
      entityId: acct.accountId,
      metadata: { self_service: true },
    });

    return withAuthCookies(json({ ok: true, reauthenticationRequired: true }), clearSessionCookies(request));
  }

  // ── SETUP ADMIN PASSWORD (bootstrap, requires X-Setup-Key) ───────────────
  if (action === "setup-admin-password") {
    if (env.SETUP_ADMIN_ENABLED !== "true") return json({ error: "NOT_FOUND" }, 404);
    const setupLimit = await enforceRateLimit(request, env, "setup-admin", "", { limit: 3, windowSeconds: 3600 });
    if (setupLimit) return setupLimit;
    if (env.SETUP_ADMIN_CONSUMED === "true") return json({ error: "SETUP_ALREADY_CONSUMED" }, 410);
    const { data: bootstrapState, error: bootstrapStateError } = await supabase.rpc("service_bootstrap_status");
    if (bootstrapStateError) return json({ error: "BOOTSTRAP_STATE_UNAVAILABLE" }, 503);
    if (bootstrapState?.consumed_at) return json({ error: "SETUP_ALREADY_CONSUMED" }, 410);
    const setupKey = request.headers.get("x-setup-key") || "";
    const expectedKey = String(env.SETUP_ADMIN_ONE_TIME_KEY || "");
    if (expectedKey.length < 32 || !setupKey || !(await constantTimeSecretEqual(setupKey, expectedKey))) {
      return json({ error: "Invalid setup key" }, 401);
    }

    const { email, password } = body;
    if (!email || !password) return json({ error: "email and password required" }, 400);
    const passwordValue = validatePasswordInput(password);

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("email", String(email).trim().toLowerCase())
      .single();

    if (!profile) return json({ error: "Profile not found" }, 404);
    if (profile.role !== "hr") return json({ error: "HR_PROFILE_REQUIRED" }, 403);

    // Claim the one-time bootstrap before writing credentials so concurrent
    // requests cannot initialize a second admin. A failed write stays consumed
    // and must be recovered with a password reset, preserving fail-closed state.
    const { data: claimed, error: claimError } = await supabase.rpc("service_claim_bootstrap", {
      p_profile_id: profile.id,
    });
    if (claimError) {
      return json({ error: "BOOTSTRAP_CLAIM_FAILED" }, 503);
    }
    if (!claimed) return json({ error: "SETUP_ALREADY_CONSUMED" }, 410);

    const existing = await readCredential(supabase, profile.id);
    if (existing) return json({ error: "Password already set. Use reset-password." }, 409);

    const hash = await hashPassword(passwordValue);
    await writeCredential(supabase, profile.id, hash, { mustChange: true });
    await writeAuditLog(supabase, request, {
      actorType: "service",
      actorRole: "bootstrap",
      action: "auth.setup_admin_completed",
      entityType: "profile",
      entityId: profile.id,
      status: "success",
    }, { critical: true });

    return json({ ok: true, id: profile.id, role: profile.role });
  }

  // ── CREATE EMPLOYEE ───────────────────────────────────────────────────────
  if (action === "create-user") {
    const { error, caller } = await requireHrSession(request, env);
    if (error) return error;

    const rateLimitResponse = await enforceRateLimit(request, env, "create-employee", caller.accountId, { limit: 20, windowSeconds: 300, critical: true });
    if (rateLimitResponse) return rateLimitResponse;

    const input = validateEmployeeCreationInput(body);
    const { data: duplicateEmail } = await supabase.from("profiles").select("id").eq("email", input.email).maybeSingle();
    if (duplicateEmail) return json({ error: "DUPLICATE_EMAIL", message: "Email đã tồn tại." }, 409);
    const { data: duplicateCode } = await supabase.from("profiles").select("id").eq("employee_code", input.employeeCode).maybeSingle();
    if (duplicateCode) return json({ error: "DUPLICATE_EMPLOYEE_CODE", message: "Mã nhân viên đã tồn tại." }, 409);

    const tempHash = await hashPassword(input.password);
    const newId = `emp-${crypto.randomUUID()}`;
    const authResult = await supabase.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      app_metadata: { application_role: "employee" },
      user_metadata: { full_name: input.fullName, employee_code: input.employeeCode },
    });
    if (authResult.error || !authResult.data?.user?.id) {
      const duplicate = /already|exists|registered/i.test(`${authResult.error?.code || ""} ${authResult.error?.message || ""}`);
      return json({
        error: duplicate ? "DUPLICATE_EMAIL" : "AUTH_USER_CREATE_FAILED",
        ...(duplicate ? { message: "Email đã tồn tại." } : {}),
      }, duplicate ? 409 : 502);
    }
    const authUserId = authResult.data.user.id;

    const { data: createdProfile, error: profileErr } = await supabase.from("profiles").insert({
      id: newId,
      auth_user_id: authUserId,
      full_name: input.fullName,
      email: input.email,
      employee_code: input.employeeCode,
      role: input.role,
      department: input.department,
      position: input.position,
      account_status: "active",
    }).select("id, full_name, email, employee_code, department, position, role, account_status").maybeSingle();

    if (profileErr) {
      await supabase.auth.admin.deleteUser(authUserId).catch(() => {});
      if (profileErr.code === "23505") {
        const duplicate = /employee_code/i.test(profileErr.message || "") ? "DUPLICATE_EMPLOYEE_CODE" : "DUPLICATE_EMAIL";
        return json({ error: duplicate, message: duplicate === "DUPLICATE_EMAIL" ? "Email đã tồn tại." : "Mã nhân viên đã tồn tại." }, 409);
      }
      return json({ error: "EMPLOYEE_CREATE_FAILED" }, 500);
    }

    try {
      await writeCredential(supabase, newId, tempHash, { mustChange: true });
    } catch (error) {
      const cleanup = await supabase.from("profiles").delete().eq("id", newId);
      const authCleanup = await supabase.auth.admin.deleteUser(authUserId).catch(() => ({ error: true }));
      await writeAuditLog(supabase, request, {
        actor: caller,
        action: "employee.create_failed",
        status: "failed",
        entityType: "profile",
        entityId: newId,
        errorCode: error.code || "CREDENTIAL_STORE_UNAVAILABLE",
        metadata: { profile_cleanup: cleanup.error ? "failed" : "pass", auth_cleanup: authCleanup?.error ? "failed" : "pass" },
      }).catch(() => {});
      throw Object.assign(new Error("Employee creation failed"), { status: 503, code: "EMPLOYEE_CREATE_FAILED" });
    }

    await writeAuditLog(supabase, request, {
      actor: caller,
      action: "employee.created",
      entityType: "profile",
      entityId: newId,
      entityDisplayName: input.fullName,
      afterData: { role: input.role, department: input.department, employee_code: input.employeeCode, account_status: "active" },
      metadata: { credential_status: "must_change", auth_user_linked: true },
    }).catch(() => {});

    return json({ ok: true, employee: {
      id: createdProfile?.id || newId,
      fullName: createdProfile?.full_name || input.fullName,
      email: createdProfile?.email || input.email,
      employeeCode: createdProfile?.employee_code || input.employeeCode,
      department: createdProfile?.department || input.department,
      position: createdProfile?.position || input.position || "",
      role: "employee",
      accountStatus: createdProfile?.account_status || "active",
      passwordStatus: "resetRequired",
    } }, 201);
  }

  return json({ error: "Missing or invalid action" }, 400);
}
