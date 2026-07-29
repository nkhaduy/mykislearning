const learnerRoles = ["employee"];
const adminRoles = ["hr"];
const privateRoles = [...learnerRoles, ...adminRoles];

const labels = (vi, en, kr) => ({ vi, en, kr });

const groupLabels = {
  overview: labels("Tổng quan", "Overview", "개요"),
  learning: labels("Học tập", "Learning", "학습"),
  library: labels("Thư viện & lịch", "Library & calendar", "라이브러리 및 일정"),
  compliance: labels("Tuân thủ & chứng chỉ", "Compliance & certificates", "컴플라이언스 및 자격증"),
  capability: labels("Năng lực cá nhân", "Personal capability", "개인 역량"),
  training: labels("Đào tạo", "Training", "교육"),
  people: labels("Nhân sự", "People", "인사"),
  development: labels("Năng lực & phát triển", "Capability & development", "역량 및 개발"),
  reports: labels("Báo cáo & hệ thống", "Reports & system", "보고서 및 시스템"),
};

export const ROUTE_DEFINITIONS = [
  { path: "/", roles: ["public"], classification: "nav", label: labels("Trang chủ", "Home", "홈") },
  { path: "/about-kis", roles: ["public"], classification: "nav", label: labels("Về KIS", "About KIS", "KIS 소개") },
  { path: "/login", roles: ["public"], classification: "hidden", label: labels("Đăng nhập", "Sign in", "로그인") },
  { path: "/training", roles: ["public"], classification: "hidden", label: labels("Buổi học trực tiếp", "Live session", "실시간 교육"), splitEntry: "publicTraining" },
  { pattern: "/join/:token", roles: ["public"], classification: "hidden", label: labels("Tham gia buổi học", "Join session", "세션 참여"), splitEntry: "publicTraining" },
  { path: "/attendance/scan", roles: privateRoles, classification: "hidden", label: labels("Quét QR điểm danh", "Scan attendance QR", "출석 QR 스캔"), splitEntry: "attendance" },
  { path: "/change-password", roles: privateRoles, classification: "hidden", label: labels("Đổi mật khẩu", "Change password", "비밀번호 변경"), splitEntry: "changePassword" },
  { path: "/account/security", roles: privateRoles, classification: "hidden", label: labels("Bảo mật tài khoản", "Account security", "계정 보안"), splitEntry: "security" },

  { path: "/dashboard", roles: learnerRoles, classification: "nav", navGroup: "overview", label: labels("Tổng quan", "Overview", "개요"), splitEntry: "learner" },
  { path: "/dashboard/courses", roles: learnerRoles, classification: "nav", navGroup: "learning", label: labels("Khóa học của tôi", "My courses", "내 과정"), splitEntry: "learnerCourses" },
  { pattern: "/dashboard/courses/:id", roles: learnerRoles, classification: "detail", parent: "/dashboard/courses", label: labels("Nội dung khóa học", "Course content", "과정 콘텐츠"), splitEntry: "coursePlayer" },
  { path: "/dashboard/quizzes", roles: learnerRoles, classification: "nav", navGroup: "learning", label: labels("Bài kiểm tra", "Quizzes", "퀴즈"), splitEntry: "quizzes" },
  { path: "/dashboard/learning-paths", roles: learnerRoles, classification: "nav", navGroup: "learning", label: labels("Lộ trình học", "Learning paths", "학습 경로"), splitEntry: "learnerSecondary" },
  { pattern: "/dashboard/learning-paths/:id", roles: learnerRoles, classification: "detail", parent: "/dashboard/learning-paths", label: labels("Chi tiết lộ trình", "Learning path detail", "학습 경로 상세"), splitEntry: "learnerSecondary" },
  { path: "/dashboard/gallery", roles: learnerRoles, classification: "nav", navGroup: "library", label: labels("Thư viện ảnh", "Gallery", "갤러리"), splitEntry: "learnerSecondary" },
  { pattern: "/dashboard/gallery/:id", roles: learnerRoles, classification: "detail", parent: "/dashboard/gallery", label: labels("Album đào tạo", "Training album", "교육 앨범"), splitEntry: "learnerSecondary" },
  { path: "/dashboard/resources", roles: learnerRoles, classification: "nav", navGroup: "library", label: labels("Tài nguyên", "Resources", "자료"), splitEntry: "learnerSecondary" },
  { path: "/dashboard/calendar", roles: learnerRoles, classification: "nav", navGroup: "library", label: labels("Lịch học", "Calendar", "학습 일정"), splitEntry: "learnerSecondary" },
  { path: "/dashboard/learning-history", roles: learnerRoles, classification: "nav", navGroup: "library", label: labels("Lịch sử học tập", "Learning history", "학습 기록"), splitEntry: "learnerSecondary" },
  { path: "/dashboard/history", roles: learnerRoles, classification: "redirect", parent: "/dashboard/learning-history", redirectTo: "/dashboard/learning-history", label: labels("Lịch sử học tập", "Learning history", "학습 기록"), splitEntry: "learnerSecondary" },
  { path: "/dashboard/compliance", roles: learnerRoles, classification: "nav", navGroup: "compliance", label: labels("Đào tạo tuân thủ", "Compliance", "컴플라이언스 교육"), splitEntry: "learnerSecondary" },
  { pattern: "/dashboard/compliance/:id", roles: learnerRoles, classification: "detail", parent: "/dashboard/compliance", label: labels("Chi tiết tuân thủ", "Compliance detail", "컴플라이언스 상세"), splitEntry: "learnerSecondary" },
  { path: "/dashboard/certificates", roles: learnerRoles, classification: "nav", navGroup: "compliance", label: labels("Chứng chỉ", "Certificates", "자격증"), splitEntry: "learningRecords" },
  { path: "/dashboard/skills", roles: learnerRoles, classification: "nav", navGroup: "capability", label: labels("Kỹ năng của tôi", "My skills", "내 역량"), splitEntry: "learnerSecondary" },
  { path: "/dashboard/development-plan", roles: learnerRoles, classification: "nav", navGroup: "capability", label: labels("Kế hoạch phát triển", "Development plan", "개발 계획"), splitEntry: "learnerSecondary" },
  { pattern: "/dashboard/development-plan/:id", roles: learnerRoles, classification: "detail", parent: "/dashboard/development-plan", label: labels("Chi tiết kế hoạch", "Plan detail", "계획 상세"), splitEntry: "learnerSecondary" },
  { path: "/dashboard/notifications", roles: learnerRoles, classification: "nav", navGroup: "capability", label: labels("Thông báo", "Notifications", "알림"), splitEntry: "learnerSecondary" },

  { path: "/hr", roles: adminRoles, classification: "nav", navGroup: "overview", label: labels("Tổng quan", "Overview", "개요"), splitEntry: "admin" },
  { path: "/hr/courses", roles: adminRoles, classification: "nav", navGroup: "training", label: labels("Khóa học", "Courses", "과정"), splitEntry: "courseManagement" },
  { pattern: "/hr/courses/:id", roles: adminRoles, classification: "detail", parent: "/hr/courses", label: labels("Chi tiết khóa học", "Course detail", "과정 상세"), splitEntry: "courseManagement" },
  { path: "/hr/assign", roles: adminRoles, classification: "nav", navGroup: "training", label: labels("Giao khóa học", "Assignments", "과정 배정"), splitEntry: "adminSecondary" },
  { path: "/hr/quizzes", roles: adminRoles, classification: "nav", navGroup: "training", label: labels("Bài kiểm tra", "Quizzes", "퀴즈"), splitEntry: "quizzes" },
  { path: "/hr/learning-paths", roles: adminRoles, classification: "nav", navGroup: "training", label: labels("Lộ trình học", "Learning paths", "학습 경로"), splitEntry: "adminSecondary" },
  { pattern: "/hr/learning-paths/:id", roles: adminRoles, classification: "detail", parent: "/hr/learning-paths", label: labels("Chi tiết lộ trình", "Learning path detail", "학습 경로 상세"), splitEntry: "adminSecondary" },
  { path: "/hr/live-training", roles: adminRoles, classification: "nav", navGroup: "training", label: labels("Hành trình buổi học", "Live training", "실시간 교육"), splitEntry: "liveTraining" },
  { pattern: "/hr/live-training/:id", roles: adminRoles, classification: "detail", parent: "/hr/live-training", label: labels("Chi tiết buổi học", "Live session detail", "실시간 세션 상세"), splitEntry: "liveTraining" },
  { path: "/hr/sessions", roles: adminRoles, classification: "nav", navGroup: "training", label: labels("Lớp offline", "Offline classes", "오프라인 교육"), splitEntry: "adminSecondary" },
  { path: "/hr/training-tracking", roles: adminRoles, classification: "nav", navGroup: "training", label: labels("Theo dõi đào tạo", "Training tracking", "교육 추적"), splitEntry: "adminSecondary" },
  { path: "/hr/cchn-registrations", roles: adminRoles, classification: "nav", navGroup: "training", label: labels("Đăng ký học CCHN", "Certification registration", "자격 교육 등록"), splitEntry: "adminSecondary" },
  { path: "/hr/employees", roles: adminRoles, classification: "nav", navGroup: "people", label: labels("Nhân viên", "Employees", "직원"), splitEntry: "employees" },
  { path: "/hr/accounts", roles: adminRoles, classification: "nav", navGroup: "people", label: labels("Tài khoản", "Accounts", "계정"), splitEntry: "adminSecondary" },
  { path: "/hr/competencies", roles: adminRoles, classification: "nav", navGroup: "development", label: labels("Khung năng lực", "Competencies", "역량 체계"), splitEntry: "adminSecondary" },
  { path: "/hr/skills-matrix", roles: adminRoles, classification: "nav", navGroup: "development", label: labels("Ma trận kỹ năng", "Skills matrix", "역량 매트릭스"), splitEntry: "adminSecondary" },
  { path: "/hr/development-plans", roles: adminRoles, classification: "nav", navGroup: "development", label: labels("Kế hoạch phát triển", "Development plans", "개발 계획"), splitEntry: "adminSecondary" },
  { path: "/hr/retraining", roles: adminRoles, classification: "nav", navGroup: "development", label: labels("Tái đào tạo", "Retraining", "재교육"), splitEntry: "adminSecondary" },
  { path: "/hr/compliance", roles: adminRoles, classification: "nav", navGroup: "compliance", label: labels("Tuân thủ", "Compliance", "컴플라이언스"), splitEntry: "adminSecondary" },
  { pattern: "/hr/compliance/cycles/:id", roles: adminRoles, classification: "detail", parent: "/hr/compliance", label: labels("Chu kỳ tuân thủ", "Compliance cycle", "컴플라이언스 주기"), splitEntry: "adminSecondary" },
  { path: "/hr/certificates", roles: adminRoles, classification: "nav", navGroup: "compliance", label: labels("Chứng chỉ", "Certificates", "자격증"), splitEntry: "adminSecondary" },
  { path: "/hr/certifications", roles: adminRoles, classification: "redirect", parent: "/hr/certificates", redirectTo: "/hr/certificates", label: labels("Chứng chỉ", "Certificates", "자격증"), splitEntry: "adminSecondary" },
  { path: "/hr/learning-records", roles: adminRoles, classification: "nav", navGroup: "compliance", label: labels("Hồ sơ học tập", "Learning records", "학습 기록"), splitEntry: "learningRecords" },
  { path: "/hr/gallery", roles: adminRoles, classification: "nav", navGroup: "compliance", label: labels("Thư viện ảnh", "Gallery", "갤러리"), splitEntry: "adminSecondary" },
  { path: "/hr/reports", roles: adminRoles, classification: "nav", navGroup: "reports", label: labels("Báo cáo", "Reports", "보고서"), splitEntry: "reporting" },
  { path: "/hr/notifications", roles: adminRoles, classification: "nav", navGroup: "reports", label: labels("Thông báo", "Notifications", "알림"), splitEntry: "adminSecondary" },
  { path: "/hr/audit-log", roles: adminRoles, classification: "nav", navGroup: "reports", label: labels("Nhật ký kiểm toán", "Audit log", "감사 로그"), splitEntry: "adminSecondary" },
];

function hasUnsafeControl(value) {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
}

export function normalizeRoute(pathname) {
  const value = String(pathname || "/");
  if (!value.startsWith("/") || value.includes("\\") || hasUnsafeControl(value)) return null;
  return value.replace(/\/{2,}/g, "/").replace(/\/+$/, "") || "/";
}

function decodeSegment(value) {
  try {
    const decoded = decodeURIComponent(value);
    if (!decoded || decoded === "." || decoded === ".." || decoded.includes("/") || decoded.includes("\\") || hasUnsafeControl(decoded)) return null;
    if (!/^[\p{L}\p{N}._~-]{1,128}$/u.test(decoded)) return null;
    return decoded;
  } catch {
    return null;
  }
}

function matchPattern(pattern, path) {
  const routeSegments = pattern.split("/").filter(Boolean);
  const pathSegments = path.split("/").filter(Boolean);
  if (routeSegments.length !== pathSegments.length) return null;
  const params = {};
  for (let index = 0; index < routeSegments.length; index += 1) {
    const routeSegment = routeSegments[index];
    const pathSegment = pathSegments[index];
    if (!routeSegment.startsWith(":")) {
      if (routeSegment !== pathSegment) return null;
      continue;
    }
    const decoded = decodeSegment(pathSegment);
    if (!decoded) return null;
    params[routeSegment.slice(1)] = decoded;
  }
  return params;
}

export function matchRoute(pathname) {
  const path = normalizeRoute(pathname);
  if (!path) return null;
  const exact = ROUTE_DEFINITIONS.find((route) => route.path === path);
  if (exact) return { ...exact, params: {} };
  const dynamicRoutes = ROUTE_DEFINITIONS
    .filter((route) => route.pattern)
    .sort((a, b) => b.pattern.split("/").filter((part) => !part.startsWith(":")).length - a.pattern.split("/").filter((part) => !part.startsWith(":")).length);
  for (const route of dynamicRoutes) {
    const params = matchPattern(route.pattern, path);
    if (params) return { ...route, params };
  }
  return null;
}

export function isKnownRoute(pathname) {
  return Boolean(matchRoute(pathname));
}

export function isPrivateRoute(pathname) {
  const route = matchRoute(pathname);
  return Boolean(route && !route.roles.includes("public"));
}

export function localizedRouteLabel(route, language = "vi") {
  return route?.label?.[language] || route?.label?.vi || route?.path || route?.pattern || "";
}

export function getNavigationGroups(role, language = "vi") {
  const orderedGroups = role === "employee"
    ? ["overview", "learning", "library", "compliance", "capability"]
    : ["overview", "training", "people", "development", "compliance", "reports"];
  return orderedGroups.map((group) => ({
    id: group,
    label: groupLabels[group]?.[language] || groupLabels[group]?.vi || group,
    items: ROUTE_DEFINITIONS
      .filter((route) => route.classification === "nav" && route.navGroup === group && route.roles.includes(role))
      .map((route) => ({ ...route, labelText: localizedRouteLabel(route, language) })),
  })).filter((group) => group.items.length);
}
