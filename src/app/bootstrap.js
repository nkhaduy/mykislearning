const path = location.pathname.replace(/\/+$/, "") || "/";

async function requirePrivateSession() {
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

    return body;
  } catch {
    const returnTo = `${location.pathname}${location.search}`;
    localStorage.setItem("mykis.postLoginRedirect.v1", returnTo);
    location.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
    return null;
  }
}

function homeForRole(role) {
  return role === "hr" ? "/hr" : "/dashboard";
}

const splitEntries = {
  about: () => import("../features/public/about.js"),
  learner: () => import("../features/learner/dashboard.js"),
  learnerCourses: () => import("../features/learner/courses.js"),
  admin: () => import("../features/admin/dashboard.js"),
  employees: () => import("../features/employees/employees.js?v=20260729-hr-create1"),
  courseManagement: () => import("../features/courses/admin-courses.js?v=20260729-hr-create1"),
  coursePlayer: () => import("../features/courses/course-player.js"),
  liveTraining: () => import("../features/training/live-training.js"),
  quizzes: () => import("../features/quizzes/quizzes.js"),
  learningRecords: () => import("../features/records/records.js"),
  attendance: () => import("../features/attendance/scanner.js"),
  reporting: () => import("../features/reporting/reports.js"),
  security: () => import("../features/auth/security.js"),
  changePassword: () => import("../features/auth/change-password.js"),
  publicTraining: () => import("../features/public/training.js"),
  learnerSecondary: () => import("../features/secondary/learner.js"),
  adminSecondary: () => import("../features/secondary/admin.js"),
};

if (/^\/admin(?:\/|$)/.test(path)) {
  // Preserve old bookmarks while exposing only the canonical HR workspace.
  const target = `/hr${path.slice("/admin".length)}${location.search}${location.hash}`;
  location.replace(target || "/hr");
} else if (path === "/") {
  await import("../features/public/home.js");
} else if (path === "/login") {
  await import("../features/auth/login.js");
} else if (path === "/about-kis") {
  await splitEntries.about();
} else {
  const { isPrivateRoute, matchRoute } = await import("./route-registry.js");
  const routeDefinition = matchRoute(path);
  const renderBootstrapError = (message) => {
    document.getElementById("app").innerHTML = `<main class="route-error-page"><h1>${message}</h1></main>`;
  };
  if (!routeDefinition) {
    let robots = document.querySelector('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement("meta");
      robots.name = "robots";
      document.head.append(robots);
    }
    robots.content = "noindex, nofollow";
    document.title = "Không tìm thấy trang | MyKIS Learning";
    document.getElementById("app").innerHTML = `<main class="route-error-page"><h1>Không tìm thấy trang</h1><p>Đường dẫn này không tồn tại hoặc đã được chuyển.</p><a href="/">Về trang chủ</a><a href="/login">Đăng nhập</a></main>`;
  } else if (routeDefinition.redirectTo) {
    const target = String(routeDefinition.redirectTo);
    if (target.startsWith("/") && !target.startsWith("//")) location.replace(target);
    else renderBootstrapError("Invalid redirect");
  } else if (isPrivateRoute(path)) {
    const privateSession = await requirePrivateSession();
    if (privateSession && !routeDefinition.roles.includes(privateSession.account.role)) {
      // Keep authenticated users inside the workspace their role can access.
      location.replace(homeForRole(privateSession.account.role));
    } else if (privateSession && routeDefinition.splitEntry && splitEntries[routeDefinition.splitEntry]) {
      const feature = await splitEntries[routeDefinition.splitEntry]();
      await feature.mount({ account: privateSession.account, expiresAt: privateSession.expires_at, route: routeDefinition });
    } else if (privateSession) {
      renderBootstrapError("Route entry is not configured");
    }
  } else if (routeDefinition.splitEntry && splitEntries[routeDefinition.splitEntry]) {
    const feature = await splitEntries[routeDefinition.splitEntry]();
    await feature.mount({ route: routeDefinition });
  } else {
    renderBootstrapError("Route entry is not configured");
  }
}
