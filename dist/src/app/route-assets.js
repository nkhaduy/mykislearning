import { matchRoute } from "./route-registry.js";

const routeModules = {
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
  accounts: () => import("../features/accounts/accounts.js?v=20260810-account-auth1"),
  security: () => import("../features/auth/security.js"),
  changePassword: () => import("../features/auth/change-password.js"),
  publicTraining: () => import("../features/public/training.js"),
  learnerSecondary: () => import("../features/secondary/learner.js"),
  adminSecondary: () => import("../features/secondary/admin.js"),
};

const stylesByEntry = {
  learner: ["/src/features/learner/learner.css?v=20260727-route-split1"],
  learnerCourses: ["/src/features/learner/learner.css?v=20260727-route-split1"],
  admin: ["/src/features/admin/admin.css?v=20260727-route-split1"],
  employees: ["/src/features/employees/employees.css?v=20260729-hr-create1"],
  accounts: ["/src/features/accounts/accounts.css?v=20260810-account-auth1"],
  courseManagement: ["/src/features/courses/courses.css?v=20260729-hr-create1"],
  coursePlayer: ["/src/features/courses/courses.css?v=20260729-hr-create1"],
  liveTraining: ["/src/features/operations/operations.css?v=20260728-operations-split1"],
  quizzes: ["/src/features/operations/operations.css?v=20260728-operations-split1"],
  learningRecords: ["/src/features/operations/operations.css?v=20260728-operations-split1"],
  attendance: ["/src/features/attendance/attendance.css?v=20260728-attendance-split1"],
  reporting: ["/src/features/reporting/reporting.css?v=20260727-route-split1"],
  security: ["/src/features/learner/learner.css?v=20260727-route-split1"],
  changePassword: ["/src/features/auth/auth.css?v=20260727-shared-type2", "/src/features/auth/auth-visual.css?v=20260727-login-restore1"],
  publicTraining: ["/src/features/public/public-secondary.css?v=20260728-secondary1"],
  learnerSecondary: ["/src/features/secondary/secondary.css?v=20260728-secondary1"],
  adminSecondary: ["/src/features/secondary/secondary.css?v=20260728-secondary1"],
};

const modulePromises = new Map();
const stylePromises = new Map();
const shellStyle = "/src/shared/ui/route-shell.css?v=20260727-shared-type2";

function hasStylesheet(href) {
  const expected = new URL(href, location.href).href;
  return [...document.querySelectorAll('link[rel="stylesheet"]')].some((link) => link.href === expected);
}

function ensureStyle(href) {
  if (hasStylesheet(href)) return Promise.resolve();
  if (stylePromises.has(href)) return stylePromises.get(href);
  const promise = new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.mykisRouteStyle = "true";
    link.addEventListener("load", resolve, { once: true });
    link.addEventListener("error", () => reject(new Error(`ROUTE_STYLE_LOAD_FAILED:${href}`)), { once: true });
    document.head.append(link);
  });
  stylePromises.set(href, promise);
  return promise;
}

export function loadRouteModule(route) {
  const entry = route?.splitEntry;
  const loader = routeModules[entry];
  if (!loader) return Promise.reject(new Error("ROUTE_ENTRY_NOT_CONFIGURED"));
  if (!modulePromises.has(entry)) modulePromises.set(entry, loader());
  return modulePromises.get(entry);
}

export async function ensureRouteStyles(route) {
  const privateRoute = route && !route.roles.includes("public");
  const styles = [...(privateRoute ? [shellStyle] : []), ...(stylesByEntry[route?.splitEntry] || [])];
  await Promise.all(styles.map(ensureStyle));
}

export function prefetchRoute(pathname) {
  const route = matchRoute(pathname);
  if (!route?.splitEntry) return Promise.resolve(false);
  return Promise.all([ensureRouteStyles(route), loadRouteModule(route)]).then(() => true).catch(() => false);
}

export function prefetchPrimaryRoutes(role) {
  const paths = role === "hr"
    ? ["/hr/employees", "/hr/courses", "/hr/reports"]
    : ["/dashboard/courses", "/dashboard/calendar", "/dashboard/compliance"];
  return Promise.all(paths.map((path) => prefetchRoute(path)));
}
