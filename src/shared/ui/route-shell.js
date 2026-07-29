import { getNavigationGroups, matchRoute } from "../../app/route-registry.js";

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

export const escapeAttribute = escapeHtml;

function activeNavigationPath(groups, pathname) {
  return groups.flatMap((group) => group.items).reduce((best, item) => {
    const active = pathname === item.path || pathname.startsWith(`${item.path}/`);
    return active && item.path.length > best.length ? item.path : best;
  }, "");
}

function roleLabel(role, i18n) {
  if (role === "employee") return i18n.pick({ vi: "Nhân viên", en: "Employee", kr: "직원" });
  if (role === "hr") return i18n.pick({ vi: "Nhân sự", en: "HR", kr: "HR" });
  return i18n.pick({ vi: "HR / L&D", en: "HR / L&D", kr: "HR / L&D" });
}

function initials(value) {
  return String(value || "KIS").split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join("").toUpperCase();
}

export function createRouteShell({ account, i18n, title, eyebrow = "MyKIS Learning", entry }) {
  const app = document.getElementById("app");
  const role = account.role === "employee" ? "employee" : account.role;
  const groups = getNavigationGroups(role, i18n.language);
  const activePath = activeNavigationPath(groups, location.pathname);
  const currentRoute = matchRoute(location.pathname);
  const notificationPath = role === "employee" ? "/dashboard/notifications" : "/hr/notifications";
  const compactNavigation = matchMedia("(max-width: 1080px)");
  const openMenu = i18n.pick({ vi: "Mở menu", en: "Open menu", kr: "메뉴 열기" });
  const closeMenu = i18n.pick({ vi: "Đóng menu", en: "Close menu", kr: "메뉴 닫기" });
  const mainNav = i18n.pick({ vi: "Điều hướng chính", en: "Main navigation", kr: "주요 탐색" });
  const signOut = i18n.pick({ vi: "Đăng xuất", en: "Sign out", kr: "로그아웃" });
  const skip = i18n.pick({ vi: "Bỏ qua đến nội dung chính", en: "Skip to main content", kr: "본문으로 건너뛰기" });
  const languageLabel = i18n.pick({ vi: "Ngôn ngữ", en: "Language", kr: "언어" });
  const navHtml = groups.map((group) => `
    <section class="route-nav__group" aria-labelledby="route-nav-${escapeAttribute(group.id)}">
      <h2 id="route-nav-${escapeAttribute(group.id)}">${escapeHtml(group.label)}</h2>
      ${group.items.map((item) => `<a href="${escapeAttribute(item.path)}" ${activePath === item.path ? 'class="active" aria-current="page"' : ""}>${escapeHtml(item.labelText)}</a>`).join("")}
    </section>`).join("");
  const displayName = account.fullName || roleLabel(role, i18n);

  document.title = `${title} | MyKIS Learning`;
  document.body.dataset.route = location.pathname;
  document.body.dataset.routeEntry = entry;
  app.innerHTML = `
    <a class="route-skip-link" href="#route-main-title">${escapeHtml(skip)}</a>
    <div class="route-shell">
      <div class="route-drawer-backdrop" data-close-route-nav hidden></div>
      <aside class="route-sidebar" id="route-navigation" aria-label="${escapeAttribute(mainNav)}" aria-hidden="${compactNavigation.matches ? "true" : "false"}" ${compactNavigation.matches ? "inert" : ""}>
        <header class="route-sidebar__header">
          <a href="/" class="route-brand" aria-label="MyKIS Learning"><img src="/assets/kis-logo-white.png" alt="KIS Vietnam" width="118" height="39"><span>MyKIS Learning</span></a>
          <button type="button" class="route-icon-button route-sidebar__close" data-close-route-nav aria-label="${escapeAttribute(closeMenu)}">×</button>
        </header>
        <nav class="route-nav" aria-label="${escapeAttribute(mainNav)}">${navHtml}</nav>
        <button type="button" class="route-signout" data-route-logout>${escapeHtml(signOut)}</button>
      </aside>
      <main class="route-main" id="route-main">
        <header class="route-topbar">
          <button type="button" class="route-icon-button route-menu-button" data-open-route-nav aria-controls="route-navigation" aria-expanded="false" aria-label="${escapeAttribute(openMenu)}"><span></span><span></span><span></span></button>
          <div class="route-topbar__heading"><p>${escapeHtml(eyebrow)}</p><h1 id="route-main-title" tabindex="-1">${escapeHtml(title || currentRoute?.label?.[i18n.language] || "MyKIS Learning")}</h1></div>
          <div class="route-topbar__actions">
            <label class="route-language" for="route-language-select"><span>${escapeHtml(languageLabel)}</span><select id="route-language-select" name="language" data-route-language aria-label="${escapeAttribute(languageLabel)}"><option value="vi" ${i18n.language === "vi" ? "selected" : ""}>VI</option><option value="en" ${i18n.language === "en" ? "selected" : ""}>EN</option><option value="kr" ${i18n.language === "kr" ? "selected" : ""}>KR</option></select></label>
            <a class="route-notification" href="${notificationPath}" aria-label="${escapeAttribute(i18n.pick({ vi: "Thông báo", en: "Notifications", kr: "알림" }))}">●</a>
            <a class="route-account" href="/account/security" aria-label="${escapeAttribute(i18n.pick({ vi: "Bảo mật tài khoản", en: "Account security", kr: "계정 보안" }))}"><span aria-hidden="true">${escapeHtml(initials(displayName))}</span><div><strong>${escapeHtml(displayName)}</strong><small>${escapeHtml(roleLabel(role, i18n))}</small></div></a>
          </div>
        </header>
        <div class="route-live-region" role="status" aria-live="polite" aria-atomic="true"></div>
        <div class="route-content" data-route-content><div class="route-loading" aria-label="Loading"><span></span><span></span><span></span></div></div>
      </main>
    </div>`;

  const drawer = app.querySelector(".route-sidebar");
  const backdrop = app.querySelector(".route-drawer-backdrop");
  const menuButton = app.querySelector("[data-open-route-nav]");
  let drawerOpen = false;

  const focusableDrawer = () => [...drawer.querySelectorAll('a[href], button:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')];
  const closeDrawer = ({ restoreFocus = true } = {}) => {
    if (!drawerOpen && compactNavigation.matches) return;
    drawerOpen = false;
    document.body.classList.remove("route-nav-open");
    drawer.setAttribute("aria-hidden", compactNavigation.matches ? "true" : "false");
    drawer.inert = compactNavigation.matches;
    menuButton.setAttribute("aria-expanded", "false");
    backdrop.hidden = true;
    if (restoreFocus) menuButton.focus();
  };
  const openDrawer = () => {
    drawerOpen = true;
    document.body.classList.add("route-nav-open");
    drawer.setAttribute("aria-hidden", "false");
    drawer.inert = false;
    menuButton.setAttribute("aria-expanded", "true");
    backdrop.hidden = false;
    focusableDrawer()[0]?.focus();
  };

  menuButton.addEventListener("click", openDrawer);
  compactNavigation.addEventListener("change", () => {
    drawerOpen = false;
    document.body.classList.remove("route-nav-open");
    drawer.setAttribute("aria-hidden", compactNavigation.matches ? "true" : "false");
    drawer.inert = compactNavigation.matches;
    menuButton.setAttribute("aria-expanded", "false");
    backdrop.hidden = true;
  });
  app.querySelectorAll("[data-close-route-nav]").forEach((element) => element.addEventListener("click", () => closeDrawer()));
  app.addEventListener("keydown", (event) => {
    if (!drawerOpen) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeDrawer();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = focusableDrawer();
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  app.querySelector("[data-route-language]").addEventListener("change", (event) => i18n.setLanguage(event.currentTarget.value));
  app.querySelector("[data-route-logout]").addEventListener("click", async () => {
    await fetch("/api/auth?action=logout", { method: "POST", credentials: "same-origin" }).catch(() => {});
    localStorage.removeItem("mykis.session.v1");
    localStorage.removeItem("mykis.postLoginRedirect.v1");
    location.replace("/login");
  });

  const content = app.querySelector("[data-route-content]");
  const liveRegion = app.querySelector(".route-live-region");
  return {
    account,
    i18n,
    content,
    announce(message) {
      liveRegion.textContent = "";
      requestAnimationFrame(() => { liveRegion.textContent = message; });
    },
    setContent(html, { focus = false } = {}) {
      content.innerHTML = html;
      if (focus) content.querySelector("h2, h1, [tabindex='-1']")?.focus();
    },
  };
}
