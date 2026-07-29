import { clearSession, getAccountById, getAccounts, getSession as readSession, setSession as writeSession, syncSupabaseProfile } from "../mockDatabase.js";

const POST_LOGIN_REDIRECT_KEY = "mykis.postLoginRedirect.v1";
// NOTE: "/login" is intentionally excluded — a post-login redirect must never
// strand an authenticated user back on the login page.
const ALLOWED_PREFIXES = ["/", "/dashboard", "/hr", "/attendance/scan", "/change-password", "/about-kis"];

function nowIso() {
  return new Date().toISOString();
}

function isAllowedInternalRoute(route) {
  if (typeof route !== "string" || !route.startsWith("/")) return false;
  if (route.startsWith("//")) return false;
  return ALLOWED_PREFIXES.some((prefix) => route === prefix || route.startsWith(`${prefix}/`) || route.startsWith(`${prefix}?`));
}

function buildExpiry(rememberMe = false) {
  return new Date(Date.now() + (rememberMe ? 7 * 24 : 8) * 60 * 60 * 1000).toISOString();
}

function normalizedExpiry(value, rememberMe) {
  const parsed = new Date(value || "");
  return Number.isFinite(parsed.getTime()) && parsed.getTime() > Date.now()
    ? parsed.toISOString()
    : buildExpiry(rememberMe);
}

export const sessionService = {
  getValidSession() {
    getAccounts();
    const session = readSession();
    if (!session?.accountId) return null;

    // SEC-005 migration: discard legacy browser-readable bearer tokens and
    // require a fresh HttpOnly-cookie login.
    if (session.supabaseAccessToken || session.supabaseRefreshToken) {
      clearSession();
      return null;
    }

    const expiresAt = session.expiresAt || buildExpiry(Boolean(session.rememberMe));
    if (new Date(expiresAt).getTime() <= Date.now()) {
      clearSession();
      return null;
    }

    // The browser stores only non-secret UI session metadata. The Worker cookie
    // remains the source of truth for every private API request.
    let account = getAccountById(session.accountId);
    if (!account && ["employee", "hr"].includes(session.role)) {
      try {
        syncSupabaseProfile({
          id: session.accountId,
          role: session.role,
          fullName: session.fullName || "",
          accountStatus: "active",
          email: session.email || "",
        });
        account = getAccountById(session.accountId);
      } catch { /* non-blocking */ }
    }
    if (!account || account.accountStatus !== "active" || !["employee", "hr"].includes(account.role)) {
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
  startSession(account, { rememberMe = false, expiresAt = "" } = {}) {
    const session = {
      sessionId: crypto.randomUUID(),
      accountId: account.id,
      role: account.role,
      fullName: account.fullName,
      createdAt: nowIso(),
      lastActiveAt: nowIso(),
      expiresAt: normalizedExpiry(expiresAt, rememberMe),
      rememberMe: Boolean(rememberMe),
    };
    writeSession(session);
    return session;
  },
  endSession() {
    fetch("/api/auth?action=logout", { method: "POST", credentials: "same-origin", keepalive: true }).catch(() => {});
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
