const isHome = (location.pathname.replace(/\/+$/, "") || "/") === "/";
const sharedFontPreloads = () => {
  for (const weight of [400, 800]) {
    for (const subset of ["latin", "vietnamese"]) {
      document.write(`<link rel="preload" as="font" type="font/woff2" crossorigin href="/assets/fonts/be-vietnam-pro-${subset}-${weight}.woff2">`);
    }
  }
};

document.write('<link rel="stylesheet" href="/src/shared/ui/font.css?v=20260727-shared-type2">');
sharedFontPreloads();

if (isHome) {
  document.write('<link rel="preload" as="image" type="image/webp" href="/public/images/mykis-learning-banner-mobile.webp" media="(max-width: 767px)" fetchpriority="high">');
  document.write('<link rel="preload" as="image" type="image/webp" href="/public/images/mykis-learning-banner-desktop.webp" media="(min-width: 768px)" fetchpriority="high">');
  document.write('<link rel="stylesheet" href="/src/features/public/home.css?v=20260727-shared-type2">');
} else if ((location.pathname.replace(/\/+$/, "") || "/") === "/login") {
  document.write('<link rel="stylesheet" href="/src/features/auth/auth.css?v=20260727-shared-type2">');
  document.write('<link rel="stylesheet" href="/src/features/auth/auth-visual.css?v=20260727-login-restore1">');
} else if ((location.pathname.replace(/\/+$/, "") || "/") === "/about-kis") {
  document.write('<link rel="stylesheet" href="/src/features/public/about.css?v=20260727-shared-type2">');
} else if (/^\/(?:training|join)(?:\/|$)/.test(location.pathname)) {
  document.write('<link rel="stylesheet" href="/src/features/public/public-secondary.css?v=20260728-secondary1">');
} else if ((location.pathname.replace(/\/+$/, "") || "/") === "/change-password") {
  document.write('<link rel="stylesheet" href="/src/features/auth/auth.css?v=20260727-shared-type2">');
  document.write('<link rel="stylesheet" href="/src/features/auth/auth-visual.css?v=20260727-login-restore1">');
} else if (["/dashboard", "/dashboard/courses", "/account/security"].includes(location.pathname.replace(/\/+$/, "") || "/")) {
  document.write('<link rel="stylesheet" href="/src/shared/ui/route-shell.css?v=20260727-shared-type2">');
  document.write('<link rel="stylesheet" href="/src/features/learner/learner.css?v=20260727-route-split1">');
} else if ((location.pathname.replace(/\/+$/, "") || "/") === "/hr") {
  document.write('<link rel="stylesheet" href="/src/shared/ui/route-shell.css?v=20260727-shared-type2">');
  document.write('<link rel="stylesheet" href="/src/features/admin/admin.css?v=20260727-route-split1">');
} else if ((location.pathname.replace(/\/+$/, "") || "/") === "/hr/employees") {
  document.write('<link rel="stylesheet" href="/src/shared/ui/route-shell.css?v=20260727-shared-type2">');
  document.write('<link rel="stylesheet" href="/src/features/employees/employees.css?v=20260728-employee-split1">');
} else if (/^\/hr\/courses(?:\/[^/]+)?$/.test(location.pathname.replace(/\/+$/, "") || "/") || /^\/dashboard\/courses\/[^/]+$/.test(location.pathname.replace(/\/+$/, "") || "/")) {
  document.write('<link rel="stylesheet" href="/src/shared/ui/route-shell.css?v=20260727-shared-type2">');
  document.write('<link rel="stylesheet" href="/src/features/courses/courses.css?v=20260728-course-split1">');
} else if (["/hr/quizzes", "/dashboard/quizzes", "/hr/learning-records", "/dashboard/certificates"].includes(location.pathname.replace(/\/+$/, "") || "/") || /^\/hr\/live-training(?:\/[^/]+)?$/.test(location.pathname.replace(/\/+$/, "") || "/")) {
  document.write('<link rel="stylesheet" href="/src/shared/ui/route-shell.css?v=20260727-shared-type2">');
  document.write('<link rel="stylesheet" href="/src/features/operations/operations.css?v=20260728-operations-split1">');
} else if ((location.pathname.replace(/\/+$/, "") || "/") === "/attendance/scan") {
  document.write('<link rel="stylesheet" href="/src/shared/ui/route-shell.css?v=20260727-shared-type2">');
  document.write('<link rel="stylesheet" href="/src/features/attendance/attendance.css?v=20260728-attendance-split1">');
} else if ((location.pathname.replace(/\/+$/, "") || "/") === "/hr/reports") {
  document.write('<link rel="stylesheet" href="/src/shared/ui/route-shell.css?v=20260727-shared-type2">');
  document.write('<link rel="stylesheet" href="/src/features/reporting/reporting.css?v=20260727-route-split1">');
} else {
  document.write('<link rel="stylesheet" href="/src/shared/ui/route-shell.css?v=20260727-shared-type2">');
  document.write('<link rel="stylesheet" href="/src/features/secondary/secondary.css?v=20260728-secondary1">');
}
