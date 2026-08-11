import { isPrivateRoute, matchRoute } from "./route-registry.js";
import { ensureRouteStyles, loadRouteModule, prefetchPrimaryRoutes, prefetchRoute } from "./route-assets.js";
import { prepareRouteTransition } from "../shared/ui/route-shell.js";

let privateSession = null;
let navigationGeneration = 0;
let started = false;
const navigationGuards = new Set();

function normalizedPathname() {
  return location.pathname.replace(/\/+$/, "") || "/";
}

function homeForRole(role) {
  return role === "hr" ? "/hr" : "/dashboard";
}

function redirectToLogin() {
  const returnTo = `${location.pathname}${location.search}`;
  localStorage.setItem("mykis.postLoginRedirect.v1", returnTo);
  location.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
}

async function requirePrivateSession() {
  if (privateSession) return privateSession;
  try {
    let response = await fetch("/api/auth?action=session", {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (response.status === 401) {
      const refreshed = await fetch("/api/auth?action=refresh", {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (refreshed.ok) {
        response = await fetch("/api/auth?action=session", {
          method: "GET",
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        });
      }
    }
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !/\bjson\b/i.test(contentType)) throw new Error("unauthenticated");
    const body = await response.json();
    if (!body.authenticated || !body.account?.id || !["employee", "hr"].includes(body.account.role)) throw new Error("unauthenticated");
    privateSession = body;
    return body;
  } catch {
    redirectToLogin();
    return null;
  }
}

function renderRouterError(message) {
  const content = document.querySelector("[data-route-content]");
  if (content) {
    content.innerHTML = `<section class="route-card route-error"><h2 tabindex="-1">${message}</h2></section>`;
    content.removeAttribute("aria-busy");
    document.querySelector(".route-main")?.classList.remove("route-main--pending");
    return;
  }
  const app = document.getElementById("app");
  if (app) app.innerHTML = `<main class="route-error-page"><h1>${message}</h1></main>`;
}

function saveScrollPosition() {
  const state = history.state && typeof history.state === "object" ? history.state : {};
  history.replaceState({ ...state, mykisScroll: { x: scrollX, y: scrollY } }, "", location.href);
}

function restoreScroll(state, fallbackTop = true) {
  requestAnimationFrame(() => {
    const position = state?.mykisScroll;
    if (position) scrollTo(position.x || 0, position.y || 0);
    else if (fallbackTop) scrollTo(0, 0);
  });
}

function canNavigate(url) {
  if (url.origin !== location.origin) return false;
  const route = matchRoute(url.pathname);
  if (!route || !isPrivateRoute(url.pathname) || !privateSession) return false;
  return route.roles.includes(privateSession.account.role);
}

function guardsAllowNavigation(url) {
  return [...navigationGuards].every((guard) => guard(url) !== false);
}

async function renderLocation({ historyState = null, restore = false } = {}) {
  const generation = ++navigationGeneration;
  window.__mykisRouteGeneration = generation;
  const path = normalizedPathname();
  const route = matchRoute(path);
  if (!route) {
    let robots = document.querySelector('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement("meta");
      robots.name = "robots";
      document.head.append(robots);
    }
    robots.content = "noindex, nofollow";
    document.title = "Không tìm thấy trang | MyKIS Learning";
    renderRouterError("Không tìm thấy trang");
    return;
  }
  if (route.redirectTo) {
    await navigate(route.redirectTo, { replace: true });
    return;
  }

  const session = isPrivateRoute(path) ? await requirePrivateSession() : null;
  if (generation !== navigationGeneration || (isPrivateRoute(path) && !session)) return;
  if (session && !route.roles.includes(session.account.role)) {
    await navigate(homeForRole(session.account.role), { replace: true });
    return;
  }

  prepareRouteTransition({ route, generation });
  try {
    const [feature] = await Promise.all([loadRouteModule(route), ensureRouteStyles(route)]);
    if (generation !== navigationGeneration) return;
    await feature.mount(session
      ? { account: session.account, expiresAt: session.expires_at, route, navigationGeneration: generation }
      : { route, navigationGeneration: generation });
    if (generation !== navigationGeneration) return;
    restoreScroll(historyState, !restore);
  } catch (error) {
    if (generation === navigationGeneration) {
      console.error("Route navigation failed", error);
      renderRouterError("Không thể tải trang");
    }
  }
}

export async function navigate(target, { replace = false, historyState = null } = {}) {
  const url = new URL(target, location.href);
  if (!canNavigate(url)) {
    location.assign(url.href);
    return false;
  }
  if (!guardsAllowNavigation(url)) return false;
  saveScrollPosition();
  const nextState = historyState || {};
  history[replace ? "replaceState" : "pushState"](nextState, "", `${url.pathname}${url.search}${url.hash}`);
  prepareRouteTransition({ route: matchRoute(url.pathname), generation: navigationGeneration + 1 });
  await renderLocation({ historyState: nextState });
  return true;
}

export function rerenderCurrentRoute() {
  return renderLocation({ historyState: history.state, restore: true });
}

export function registerNavigationGuard(guard) {
  navigationGuards.add(guard);
  return () => navigationGuards.delete(guard);
}

function anchorForEvent(event) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const anchor = event.target.closest?.("a[href]");
  if (!anchor || anchor.target && anchor.target !== "_self" || anchor.hasAttribute("download")) return null;
  const url = new URL(anchor.href, location.href);
  if (url.pathname === location.pathname && url.search === location.search && url.hash) return null;
  return { anchor, url };
}

function bindNavigationEvents() {
  document.addEventListener("click", (event) => {
    const match = anchorForEvent(event);
    if (!match || !canNavigate(match.url)) return;
    event.preventDefault();
    navigate(match.url.href);
  });
  document.addEventListener("pointerover", (event) => {
    const anchor = event.target.closest?.("a[href]");
    if (!anchor) return;
    const url = new URL(anchor.href, location.href);
    if (canNavigate(url)) prefetchRoute(url.pathname);
  }, { passive: true });
  document.addEventListener("focusin", (event) => {
    const anchor = event.target.closest?.("a[href]");
    if (!anchor) return;
    const url = new URL(anchor.href, location.href);
    if (canNavigate(url)) prefetchRoute(url.pathname);
  });
  addEventListener("popstate", (event) => {
    const url = new URL(location.href);
    if (!canNavigate(url)) {
      location.reload();
      return;
    }
    renderLocation({ historyState: event.state, restore: true });
  });
  addEventListener("mykis:language-change", () => rerenderCurrentRoute());
}

export async function startRouter() {
  if (started) return;
  started = true;
  history.scrollRestoration = "manual";
  bindNavigationEvents();
  await renderLocation({ historyState: history.state, restore: true });
  if (privateSession) {
    setTimeout(() => {
      const idle = window.requestIdleCallback || ((callback) => setTimeout(callback, 0));
      idle(() => prefetchPrimaryRoutes(privateSession.account.role));
    }, 1_200);
  }
}
