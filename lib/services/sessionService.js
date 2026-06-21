import { clearSession, getAccountById, getSession as readSession, setSession as writeSession } from "../mockDatabase.js";

const POST_LOGIN_REDIRECT_KEY = "mykis.postLoginRedirect.v1";
const ALLOWED_PREFIXES = ["/", "/dashboard", "/admin", "/attendance/scan", "/change-password", "/about-kis", "/login"];

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
    const account = getAccountById(session.accountId);
    if (!account || account.accountStatus !== "active" || !["employee", "hr"].includes(account.role)) {
      clearSession();
      return null;
    }
    const expiresAt = session.expiresAt || buildExpiry(Boolean(session.rememberMe));
    if (new Date(expiresAt).getTime() <= Date.now()) {
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
  startSession(account, { rememberMe = false } = {}) {
    const session = {
      sessionId: crypto.randomUUID(),
      accountId: account.id,
      role: account.role,
      fullName: account.fullName,
      createdAt: nowIso(),
      lastActiveAt: nowIso(),
      expiresAt: buildExpiry(rememberMe),
      rememberMe: Boolean(rememberMe),
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
