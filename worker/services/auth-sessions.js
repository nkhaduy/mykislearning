import { getRequestContext } from "../middleware/request-context.js";
import { isProductionLike, trustedClientIp } from "./client-ip.js";
import { hmacHash, randomOpaqueToken, signToken } from "./crypto.js";
import { getSupabase } from "./supabase.js";

export const ACCESS_COOKIE = "mykis_session";
export const REFRESH_COOKIE = "mykis_refresh";
export const ACCESS_TTL_SECONDS = 15 * 60;

function requiredSecret(env, name, fallback = "") {
  const value = String(env?.[name] || fallback || "");
  if (value.length >= 32) return value;
  throw Object.assign(new Error(`${name} is not configured`), { status: 503, code: "AUTH_SECRET_MISSING" });
}

export function jwtSecret(env) {
  return requiredSecret(env, "JWT_SECRET");
}

export function refreshHashSecret(env) {
  return requiredSecret(env, "REFRESH_TOKEN_HASH_SECRET", env?.JWT_SECRET);
}

export function validateAuthSecurityConfig(env = {}) {
  if (!isProductionLike(env)) return true;
  for (const name of ["JWT_SECRET", "REFRESH_TOKEN_HASH_SECRET"]) {
    if (String(env[name] || "").length < 32) {
      throw Object.assign(new Error(`${name} is not configured`), { status: 503, code: "AUTH_SECURITY_CONFIG_MISSING" });
    }
  }
  return true;
}

export function cookieValue(request, name) {
  const cookie = request.headers.get("cookie") || "";
  for (const part of cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return "";
}

function cookieSecurity(request) {
  return new URL(request.url).protocol === "https:" ? "; Secure" : "";
}

export function authCookie(request, name, value, maxAge, path = "/") {
  return `${name}=${encodeURIComponent(value)}; HttpOnly${cookieSecurity(request)}; SameSite=Strict; Path=${path}; Max-Age=${maxAge}`;
}

export function clearAuthCookie(request, name, path = "/") {
  return authCookie(request, name, "", 0, path);
}

export function withAuthCookies(response, cookies) {
  const headers = new Headers(response.headers);
  for (const cookie of cookies.filter(Boolean)) headers.append("Set-Cookie", cookie);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function boundedUserAgent(request) {
  return String(request.headers.get("user-agent") || "").slice(0, 256);
}

async function requestIpHash(request, env) {
  const contextHash = getRequestContext(request).ipAddressHash;
  if (contextHash) return contextHash;
  return hmacHash(trustedClientIp(request, env), refreshHashSecret(env));
}

function sessionLifetime(rememberMe) {
  return rememberMe ? 30 * 24 * 60 * 60 : 8 * 60 * 60;
}

function rawRefreshToken(tokenId) {
  return `rt_${tokenId}.${randomOpaqueToken(32)}`;
}

async function accessToken(env, { profileId, role, sessionId }) {
  const now = Math.floor(Date.now() / 1000);
  return {
    token: await signToken({
      sub: profileId,
      role,
      sid: sessionId,
      jti: crypto.randomUUID(),
      iat: now,
      exp: now + ACCESS_TTL_SECONDS,
      amr: ["pwd"],
    }, jwtSecret(env)),
    expiresAt: now + ACCESS_TTL_SECONDS,
  };
}

export async function createAuthSession(request, env, profile, {
  rememberMe = false,
} = {}) {
  const supabase = getSupabase(env);
  const sessionId = crypto.randomUUID();
  const familyId = crypto.randomUUID();
  const refreshTokenId = crypto.randomUUID();
  const refreshToken = rawRefreshToken(refreshTokenId);
  const refreshHash = await hmacHash(refreshToken, refreshHashSecret(env));
  const lifetime = sessionLifetime(rememberMe);
  const sessionExpiresAt = new Date(Date.now() + lifetime * 1000).toISOString();
  const refreshExpiresAt = sessionExpiresAt;
  const ipHash = await requestIpHash(request, env);
  const { data, error } = await supabase.rpc("service_create_auth_session", {
    p_session_id: sessionId,
    p_family_id: familyId,
    p_refresh_token_id: refreshTokenId,
    p_refresh_token_hash: refreshHash,
    p_profile_id: profile.id,
    p_session_expires_at: sessionExpiresAt,
    p_refresh_expires_at: refreshExpiresAt,
    p_ip_hash: ipHash,
    p_user_agent: boundedUserAgent(request),
    p_max_sessions: Number(env.MAX_CONCURRENT_SESSIONS || 10),
  });
  if (error || data?.status !== "created") {
    throw Object.assign(new Error("Session creation failed"), { status: 503, code: "SESSION_STORE_UNAVAILABLE" });
  }
  const access = await accessToken(env, {
    profileId: profile.id,
    role: data.role || profile.role || "employee",
    sessionId,
  });
  return {
    sessionId,
    accessToken: access.token,
    accessExpiresAt: access.expiresAt,
    refreshToken,
    refreshMaxAge: lifetime,
    sessionExpiresAt,
  };
}

export async function rotateAuthSession(request, env) {
  const refreshToken = cookieValue(request, REFRESH_COOKIE);
  if (!refreshToken || !/^rt_[0-9a-f-]{36}\.[A-Za-z0-9_-]{32,}$/.test(refreshToken)) {
    return { ok: false, reason: "invalid" };
  }
  const newTokenId = crypto.randomUUID();
  const newRefreshToken = rawRefreshToken(newTokenId);
  const [tokenHash, newTokenHash, ipHash] = await Promise.all([
    hmacHash(refreshToken, refreshHashSecret(env)),
    hmacHash(newRefreshToken, refreshHashSecret(env)),
    requestIpHash(request, env),
  ]);
  const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const supabase = getSupabase(env);
  const { data, error } = await supabase.rpc("service_rotate_refresh_token", {
    p_token_hash: tokenHash,
    p_new_token_id: newTokenId,
    p_new_token_hash: newTokenHash,
    p_new_expires_at: refreshExpiresAt,
    p_ip_hash: ipHash,
    p_user_agent: boundedUserAgent(request),
  });
  if (error) throw Object.assign(new Error("Refresh rotation failed"), { status: 503, code: "SESSION_STORE_UNAVAILABLE" });
  if (data?.status !== "rotated") return { ok: false, reason: data?.status || "invalid", audit: data || null };
  const access = await accessToken(env, {
    profileId: data.profile_id,
    role: data.role,
    sessionId: data.session_id,
  });
  const remainingSeconds = Math.max(1, Math.floor((new Date(data.session_expires_at).getTime() - Date.now()) / 1000));
  return {
    ok: true,
    accountId: data.profile_id,
    role: data.role,
    sessionId: data.session_id,
    accessToken: access.token,
    accessExpiresAt: access.expiresAt,
    refreshToken: newRefreshToken,
    refreshMaxAge: remainingSeconds,
  };
}

export function accessAndRefreshCookies(request, session) {
  return [
    authCookie(request, ACCESS_COOKIE, session.accessToken, ACCESS_TTL_SECONDS),
    authCookie(request, REFRESH_COOKIE, session.refreshToken, session.refreshMaxAge, "/api/auth"),
  ];
}

export function clearSessionCookies(request) {
  return [
    clearAuthCookie(request, ACCESS_COOKIE),
    clearAuthCookie(request, REFRESH_COOKIE, "/api/auth"),
  ];
}
