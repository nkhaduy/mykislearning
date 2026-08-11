const path = location.pathname.replace(/\/+$/, "") || "/";

if (/^\/admin(?:\/|$)/.test(path)) {
  // Preserve old bookmarks while exposing only the canonical HR workspace.
  const target = `/hr${path.slice("/admin".length)}${location.search}${location.hash}`;
  location.replace(target || "/hr");
} else if (path === "/") {
  await import("../features/public/home.js");
} else if (path === "/login") {
  await import("../features/auth/login.js");
} else if (path === "/about-kis") {
  await import("../features/public/about.js");
} else {
  const { startRouter } = await import("./router.js");
  await startRouter();
}
