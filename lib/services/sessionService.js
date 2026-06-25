import { clearSession, getAccountById, getSession as readSession, setSession as writeSession, syncSupabaseProfile } from "../mockDatabase.js";

const POST_LOGIN_REDIRECT_KEY = "mykis.postLoginRedirect.v1";
// NOTE: "/login" is intentionally excluded — a post-login redirect must never
// strand an authenticated user back on the login page.
const ALLOWED_PREFIXES = ["/", "/dashboard", "/admin", "/attendance/scan", "/change-password", "/about-kis"];

function nowIso() {
  return new Date().toISOString();
}

function isAllowedInternalRoute(route) {
  if (typeof route !== "string" || !route.startsWith("/")) return false;
  if (route.startsWith("//")) return false;
  return ALLOWED_PREFIXES.some((prefix) => route === prefix || route.startsWith(`${prefix}/`) || route.startsWith(`${prefix}?`));
}

function buildExpiry(rememberMe = false) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (rememberMe ? 7 : 1));
  return expiresAt.toISOString();
}

export const sessionService = {
  getValidSession() {
    const session = readSession();
    if (!session?.accountId) return null;

    const expiresAt = session.expiresAt || buildExpiry(Boolean(session.rememberMe));
    if (new Date(expiresAt).getTime() <= Date.now()) {
      clearSession();
      return null;
    }

    // Supabase-authenticated sessions: the JWT token is the source of truth.
    // The mock DB may not have the account (different browser, cleared localStorage,
    // syncSupabaseProfile failure) — do NOT clear the session in those cases.
    if (session.supabaseAccessToken) {
      const role = session.role;
      if (!role || !["employee", "hr", "admin"].includes(role)) {
        clearSession();
        return null;
      }
      const normalized = {
        sessionId: session.sessionId || crypto.randomUUID(),
        accountId: session.accountId,
        role,
        fullName: session.fullName || "",
        createdAt: session.createdAt || nowIso(),
        lastActiveAt: nowIso(),
        expiresAt,
        rememberMe: Boolean(session.rememberMe),
        supabaseAccessToken: session.supabaseAccessToken,
        supabaseRefreshToken: session.supabaseRefreshToken || null,
      };
      writeSession(normalized);
      // Best-effort re-sync to mock DB so getAccountById() works for UI lookups,
      // but never block or invalidate the session if this fails.
      if (!getAccountById(session.accountId)) {
        try {
          syncSupabaseProfile({
            id: session.accountId,
            role,
            fullName: session.fullName || "",
            accountStatus: "active",
            email: session.email || "",
          });
        } catch { /* non-blocking */ }
      }
      return normalized;
    }

    // Legacy sessions (no Supabase token): validate against the mock DB.
    const account = getAccountById(session.accountId);
    if (!account || account.accountStatus !== "active" || !["employee", "hr", "admin"].includes(account.role)) {
      clearSession();
      return null;
    }
    const normalized = {
      sessionId: session.sessionId || crypto.randomUUID(),
      accountId: account.id,
      role: account.role,
      fullName: account.fullName,
      createdAt: session.createdAt || nowIso(),
      lastActiveAt: nowIso(),
      expiresAt,
      rememberMe: Boolean(session.rememberMe),
    };
    writeSession(normalized);
    return normalized;
  },
  startSession(account, { rememberMe = false, supabaseAccessToken = null, supabaseRefreshToken = null } = {}) {
    const session = {
      sessionId: crypto.randomUUID(),
      accountId: account.id,
      role: account.role,
      fullName: account.fullName,
      createdAt: nowIso(),
      lastActiveAt: nowIso(),
      expiresAt: buildExpiry(rememberMe),
      rememberMe: Boolean(rememberMe),
      ...(supabaseAccessToken ? { supabaseAccessToken, supabaseRefreshToken } : {}),
    };
    writeSession(session);
    return session;
  },
  endSession() {
    clearSession();
    localStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
  },
  setPostLoginRedirect(route) {
    if (!isAllowedInternalRoute(route)) return false;
    localStorage.setItem(POST_LOGIN_REDIRECT_KEY, route);
    return true;
  },
  getPostLoginRedirect() {
    const route = localStorage.getItem(POST_LOGIN_REDIRECT_KEY) || "";
    return isAllowedInternalRoute(route) ? route : "";
  },
  consumePostLoginRedirect(fallback = "/dashboard") {
    const route = this.getPostLoginRedirect() || fallback;
    localStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
    return route;
  },
  canRedirectTo(route) {
    return isAllowedInternalRoute(route);
  },
};
