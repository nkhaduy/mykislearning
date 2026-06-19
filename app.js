import { dictionaries, getInitialLanguage, saveLanguage } from "./lib/i18n/index.js";
import {
  addSecurityAuditLog,
  assignCourse,
  changePassword,
  clearSession,
  createAccount,
  createCourse,
  deleteCourse,
  disableAccount,
  findAccount,
  forcePasswordChange,
  generateTemporaryPassword,
  getAccountById,
  getAccounts,
  getCourseById,
  getCourses,
  getEmployeeByAccountId,
  getEmployees,
  getEnrollments,
  getEnrollmentsByAccountId,
  getEnrollmentsByCourseId,
  getImportSummary,
  getNotifications,
  getUnreadCount,
  getSecurityAuditLog,
  getSession,
  initMockDatabase,
  login,
  markAsRead,
  DEMO_HR_EMAIL,
  DEMO_HR_PASSWORD,
  resendActivationEmail,
  resetDemoHrAccount,
  resetPassword,
  removeEnrollment,
  unlockAccount,
  updateAccount,
  updateCourse,
  updateEmployeeProfile,
  verifyPassword,
  getQuizzes, getQuizById, createQuiz, updateQuiz, deleteQuiz,
  getQuizAttempts, getQuizAttemptsByAccountId, startQuizAttempt, submitQuizAttempt,
  saveQuizAttemptProgress, canStartQuiz, gradeQuizEssay,
  getCourseContent, getContentProgress, getLearningActivity, logLearningActivity,
  saveContentProgress, calculateCourseProgress, resetLearningProgress,
  createCourseContent, updateCourseContent, deleteCourseContent, reorderCourseContent,
  getQuizzesByCourseId,
} from "./lib/mockDatabase.js";
import { validatePassword } from "./lib/auth/passwordPolicy.js";

const app = document.getElementById("app");

let language = getInitialLanguage();
let route = location.pathname;
let session = getSession();
let selectedLoginRole = new URLSearchParams(location.search).get("role") || "employee";
let accountSearch = "";
let accountFilters = { department: "", role: "", accountStatus: "", passwordStatus: "" };
let selectedAccountId = "";
let accountDrawerOpen = false;
let resetModalOpen = false;
let resetTargetId = "";
let temporaryPasswordResult = "";
let employeeDirectorySearch = "";
let employeeDirectoryFilters = { department: "", position: "", accountStatus: "", cchn: "" };
let employeeDirectoryPage = 1;
let employeeDirectorySortAsc = true;
let employeeDirectoryReviewIssues = false;
let cchnSearch = "";
let cchnSortAsc = true;
let cchnPage = 1;
let cchnFilters = { department: "", certificate: "", year: "", status: "" };
let activeTimelineYear = "2015";
let courseSearch = "";
let courseFilterCategory = "";
let courseFilterStatus = "";
let courseDrawerOpen = false;
let selectedCourseId = "";
let courseFormMode = "";
let contentBuilderMode = "";
let selectedContentId = "";
let contentBuilderType = "slide";
let assignCourseId = "";
let assignSearch = "";
let assignFilterDept = "";
let assignFilterStatus = "";
let assignModalOpen = false;
let assignTargetAccountId = "";
let assignTargetCourseId = "";
let assignRouteSearch = null;
let myCourseFilter = "";
let employeeNotificationPanelOpen = false;
let assignMethod = "individual";
let bulkSelectedAccountIds = [];
let bulkEmployeeSearch = "";
let bulkDepartmentFilter = "";
let excelPreviewRows = [];
let activeQuizAttempt = null;
let quizFormOpen = false;
let selectedQuizId = "";
let quizBuilderQuestions = [];
let quizSearch = "";
let quizCourseFilter = "";
let quizStatusFilter = "";
let quizAdminView = "list";
let quizCurrentQuestion = 0;
let quizAnswers = {};
let quizBookmarks = [];
let quizSecondsRemaining = 0;
let quizTimerId = null;
let quizLastResult = null;
let learningTimerId = null;
let activeContentId = "";
let activeSlideIndex = 0;
let lastTickAt = 0;
let blurStartedAt = 0;
let youtubePlayer = null;

initMockDatabase();

const hrContact = "Nguyễn Thị Cẩm Thanh";

const courses = [
  ["users", "Leadership Training Course", "Chương trình phát triển năng lực lãnh đạo, quản lý đội ngũ, ra quyết định và thúc đẩy hiệu suất làm việc.", 1, ["Khóa đào tạo Kỹ năng Lãnh đạo", "리더십 교육 과정", "Đã diễn ra"], "/images/leadership-training-course.png"],
  ["message", "Communication Training Course", "Chương trình thực hành kỹ năng giao tiếp, lắng nghe, phản hồi, phối hợp nội bộ và trao đổi với khách hàng.", 1, ["Khóa đào tạo Kỹ năng Giao tiếp", "커뮤니케이션 교육 과정", "Đã diễn ra"], "/images/communication-training-course.png"],
  ["chart", "Kiến thức chứng khoán cơ bản", "Củng cố kiến thức nền tảng về thị trường chứng khoán, sản phẩm dịch vụ và vận hành trong ngành.", 8, ["Nghiệp vụ", "Nền tảng"]],
  ["award", "Chứng chỉ hành nghề Môi giới chứng khoán", "Lộ trình ôn tập, tài liệu chuyên đề, bộ câu hỏi luyện tập và nội dung trọng tâm hỗ trợ nhân viên chuẩn bị cho kỳ thi chứng chỉ hành nghề.", 5, ["Tài liệu ôn tập trọng tâm", "Bộ đề luyện tập", "Theo dõi tiến độ ôn thi", "Chuẩn bị cho kỳ thi UBCKNN"]],
  ["message", "Kỹ năng mềm", "Phát triển các kỹ năng thực chiến như giao tiếp, phối hợp nội bộ, phản hồi, trình bày và chăm sóc khách hàng.", 7, ["Communication", "FAB"]],
  ["grid", "Báo cáo & trình bày công việc", "Chuẩn hóa kỹ năng báo cáo, sắp xếp vấn đề, trình bày mạch lạc và phối hợp với cấp quản lý.", 6, ["Báo cáo", "Quản trị"]],
];

const allTrainingCourses = [
  ...courses,
  ...Array.from({ length: 26 }, (_, index) => [`file`, `KIS Training Archive ${index + 1}`, "Khóa đào tạo nội bộ đã ghi nhận trên hệ thống.", 1, ["Internal"]]),
];

const trainingEnrollments = [
  { employeeId: "E001", courseId: "leadership", trainingHours: 16 },
  { employeeId: "E002", courseId: "communication", trainingHours: 12 },
  { employeeId: "E003", courseId: "communication", trainingHours: 12 },
  { employeeId: "E004", courseId: "leadership", trainingHours: 16 },
  { employeeId: "E001", courseId: "communication", trainingHours: 12 },
  ...Array.from({ length: 424 }, (_, index) => ({
    employeeId: `ED${String(index + 1).padStart(3, "0")}`,
    courseId: index % 2 ? "communication" : "leadership",
    trainingHours: index < 54 ? 2 : 3,
  })),
];

const upcomingCourses = [
  ["chart", "Kiến thức chứng khoán cơ bản", "Chuyên môn", "Trực tuyến", "Sắp mở đăng ký"],
  ["award", "Ôn tập Chứng chỉ hành nghề Môi giới chứng khoán", "Chứng chỉ chuyên môn", "Kết hợp", "Sắp diễn ra"],
  ["grid", "Excel nâng cao cho báo cáo", "Công cụ làm việc", "Trực tiếp", "Đang lên kế hoạch"],
  ["message", "Kỹ năng báo cáo và trình bày vấn đề", "Kỹ năng mềm", "Trực tuyến", "Sắp mở đăng ký"],
];

const hrAnnouncements = [
  ["Onboarding", "Lịch đào tạo hội nhập dành cho nhân viên mới", "Nhân viên mới vui lòng hoàn thành các nội dung đào tạo hội nhập bắt buộc theo thời hạn được giao."],
  ["Chứng chỉ chuyên môn", "Kế hoạch ôn tập Chứng chỉ hành nghề Môi giới chứng khoán", "HR sẽ cập nhật tài liệu, lịch ôn tập và danh sách nhân viên tham gia trong thời gian tới."],
  ["Kỹ năng mềm", "Cập nhật tài liệu Communication Training", "Tài liệu đào tạo và nội dung thực hành đã được cập nhật trên MyKIS Learning."],
  ["Đánh giá", "Nhắc hoàn thành bài kiểm tra sau đào tạo", "Nhân viên vui lòng kiểm tra deadline và hoàn thành bài đánh giá đúng thời hạn."],
];

const timelineData = {
  2015: { image: "/assets/timeline/2015.jpeg", events: ["01/06/2015: Thành lập Phòng giao dịch Bà Triệu, Hà Nội.", "08/07/2015: Thành lập Phòng giao dịch Nguyễn Tri Phương, TP. Hồ Chí Minh.", "09/01/2015: KIS Việt Nam tăng vốn điều lệ từ 264 tỷ đồng lên 1.113 tỷ đồng."] },
  2016: { image: "/assets/timeline/2016.jpeg", events: ["06/07/2016: Thành lập Phòng giao dịch Láng Hạ, Hà Nội.", "06/09/2016: Thành lập Phòng giao dịch Phạm Ngọc Thạch, TP. Hồ Chí Minh.", "2016: KIS được vinh danh Top 10 công ty chứng khoán dẫn đầu về thị phần môi giới tại HOSE và HNX."] },
  2018: { image: "/assets/timeline/2018.png", events: ["11/06/2018: KIS trở thành thành viên giao dịch thị trường chứng khoán phái sinh.", "14/05/2018: KIS tăng vốn điều lệ từ 1.113 tỷ đồng thành 1.897 tỷ đồng."] },
  2019: { image: "/assets/timeline/2019.jpeg", events: ["07/06/2019: KIS là 1 trong 7 công ty chứng khoán đầu tiên nhận Chứng nhận phát hành chứng quyền.", "03/09/2019: Đổi tên và chuyển trụ sở chi nhánh Nguyễn Tri Phương thành chi nhánh Sài Gòn tại Tòa nhà TNR."] },
  2020: { image: "/assets/timeline/2020.png", events: ["30/06/2020: KIS tăng vốn điều lệ lên 2.596 tỷ VND, nâng tỷ lệ sở hữu của KIS Hàn Quốc lên 99.7%.", "TOP 9 thị phần môi giới năm 2020 sàn HOSE."] },
  2021: { image: "/assets/timeline/2021.png", events: ["30/06/2021: KIS tăng vốn điều lệ lên 3.761 tỷ VND, nâng tỷ lệ sở hữu của KIS Hàn Quốc lên 99.8%.", "TOP 10 thị phần quý 2 năm 2021 sàn HOSE."] },
  2025: { image: "/assets/timeline/2025.jpeg", events: ["Tăng vốn điều lệ lên 4.550 tỷ đồng.", "TOP 9 thị phần môi giới HOSE năm 2025."] },
};

function d() {
  return dictionaries[language] || dictionaries.vi;
}

function t(path) {
  return path.split(".").reduce((obj, key) => obj?.[key], d()) ?? path;
}

function uiText(key) {
  const labels = {
    announcements: { vi: "Thông báo", en: "Announcements", kr: "공지사항" },
    quickLinks: { vi: "Liên kết nhanh", en: "Quick Links", kr: "빠른 링크" },
    support: { vi: "Hỗ trợ", en: "Support", kr: "지원" },
    contactPerson: { vi: "Liên hệ phụ trách", en: "Contact Person", kr: "담당자 연락처" },
    employeeOnly: { vi: "Dành riêng cho nhân viên KIS Việt Nam", en: "Exclusively for KIS Vietnam employees", kr: "KIS 베트남 임직원 전용" },
    internalOnly: { vi: "Chỉ sử dụng nội bộ", en: "Internal Use Only", kr: "내부 전용" },
    cchnTitle: { vi: "Danh sách nhân viên sở hữu Chứng chỉ hành nghề", en: "Employees Holding Professional Certificates", kr: "전문 자격증 보유 임직원 명단" },
    no: { vi: "STT", en: "No.", kr: "번호" },
    fullName: { vi: "Họ và tên", en: "Full Name", kr: "성명" },
    searchName: { vi: "Tìm kiếm theo tên", en: "Search by name", kr: "이름 검색" },
    learner: { vi: "Học viên", en: "Learner", kr: "학습자" }, overview: { vi: "Tổng quan", en: "Overview", kr: "개요" }, myCourses: { vi: "Khóa học của tôi", en: "My Courses", kr: "내 교육 과정" },
    inProgressCourses: { vi: "Khóa đang học", en: "Courses in Progress", kr: "학습 중인 과정" }, completed: { vi: "Hoàn thành", en: "Completed", kr: "완료" }, overdue: { vi: "Quá hạn", en: "Overdue", kr: "기한 초과" }, newNotifications: { vi: "Thông báo mới", en: "New Notifications", kr: "새 알림" },
    viewAllCourses: { vi: "Xem tất cả khóa học", en: "View All Courses", kr: "전체 교육 과정 보기" }, continueLearning: { vi: "Tiếp tục học", en: "Continue Learning", kr: "계속 학습하기" }, startCourse: { vi: "Bắt đầu", en: "Start Course", kr: "시작하기" }, updateProgress: { vi: "Cập nhật tiến độ", en: "Update Progress", kr: "진도 업데이트" },
    notStarted: { vi: "Chưa bắt đầu", en: "Not Started", kr: "시작 전" }, inProgress: { vi: "Đang học", en: "In Progress", kr: "학습 중" }, markRead: { vi: "Đánh dấu đã đọc", en: "Mark as Read", kr: "읽음으로 표시" }, all: { vi: "Tất cả", en: "All", kr: "전체" },
    recentCourses: { vi: "Khóa học cần tiếp tục", en: "Courses to Continue", kr: "계속할 교육 과정" }, recentNotifications: { vi: "Thông báo gần đây", en: "Recent Notifications", kr: "최근 알림" }, deadline: { vi: "Hạn hoàn thành", en: "Deadline", kr: "마감일" }, progressLabel: { vi: "Tiến độ", en: "Progress", kr: "진도" },
    courseIntro: { vi: "Theo dõi các khóa học được giao và tiến độ hoàn thành của bạn.", en: "Track your assigned courses and completion progress.", kr: "배정된 교육 과정과 완료 진도를 확인하세요." }, noCourses: { vi: "Bạn chưa có khóa học", en: "You have no courses yet", kr: "아직 교육 과정이 없습니다" }, noCoursesDesc: { vi: "Các khóa học được HR giao sẽ xuất hiện tại đây.", en: "Courses assigned by HR will appear here.", kr: "HR이 배정한 교육 과정이 여기에 표시됩니다." }, noMatch: { vi: "Không có khóa học phù hợp", en: "No matching courses", kr: "일치하는 교육 과정이 없습니다" }, noMatchDesc: { vi: "Hãy chọn trạng thái khác để xem các khóa học của bạn.", en: "Choose another status to view your courses.", kr: "다른 상태를 선택해 교육 과정을 확인하세요." },
    noRecentCourses: { vi: "Bạn chưa được giao khóa học nào.", en: "You have not been assigned any courses.", kr: "배정된 교육 과정이 없습니다." }, noRecentCoursesDesc: { vi: "Các khóa học được HR giao sẽ xuất hiện tại đây.", en: "Courses assigned by HR will appear here.", kr: "HR이 배정한 교육 과정이 여기에 표시됩니다." }, noNotifications: { vi: "Bạn chưa có thông báo mới.", en: "You have no new notifications.", kr: "새 알림이 없습니다." }, completedOn: { vi: "Hoàn thành ngày", en: "Completed on", kr: "완료일" }, completedText: { vi: "Đã hoàn thành", en: "Completed", kr: "완료" }, viewNotifications: { vi: "Xem tất cả thông báo", en: "View All Notifications", kr: "전체 알림 보기" },
    logout: { vi: "Đăng xuất", en: "Sign out", kr: "로그아웃" }, logoutSuccess: { vi: "Đăng xuất thành công.", en: "Signed out successfully.", kr: "로그아웃되었습니다." },
    forgotPassword: { vi: "Quên mật khẩu", en: "Forgot password", kr: "비밀번호를 잊으셨나요?" }, forgotEmailRequired: { vi: "Vui lòng nhập email trước.", en: "Please enter your email first.", kr: "먼저 이메일을 입력해 주세요." }, forgotNeutral: { vi: "Nếu tài khoản hợp lệ, vui lòng liên hệ HR để được hỗ trợ đặt lại mật khẩu: thanh.ntc@kisvn.vn", en: "If the account is valid, please contact HR for password reset support: thanh.ntc@kisvn.vn", kr: "유효한 계정인 경우 비밀번호 재설정을 위해 HR에 문의해 주세요: thanh.ntc@kisvn.vn" },
    demoEmployeeAccount: { vi: "Tài khoản nhân viên demo", en: "Demo Employee Account", kr: "직원 데모 계정" }, emailLabel: { vi: "Email", en: "Email", kr: "이메일" }, passwordLabel: { vi: "Mật khẩu", en: "Password", kr: "비밀번호" }, useAccount: { vi: "Dùng tài khoản này", en: "Use This Account", kr: "이 계정 사용" },
  };
  return labels[key]?.[language] || labels[key]?.vi || key;
}

function navigate(path) {
  history.pushState({}, "", path);
  route = location.pathname;
  session = getSession();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function scrollToId(id) {
  const target = document.getElementById(id);
  if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  else {
    navigate("/");
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
}

function goAnnouncements() {
  if (location.pathname.replace(/\/$/, "") === "" || location.pathname.replace(/\/$/, "") === "/") {
    scrollToId("hr-announcements");
  } else {
    navigate("/#hr-announcements");
    requestAnimationFrame(() => document.getElementById("hr-announcements")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
}

function icon(name) {
  const icons = {
    building: '<svg viewBox="0 0 24 24"><path d="M4 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/><path d="M8 7h2M8 11h2M8 15h2M14 7h.01M14 11h.01M14 15h.01M3 21h18"/></svg>',
    file: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h6"/></svg>',
    chart: '<svg viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-7"/></svg>',
    award: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="5"/><path d="M8.5 12.5 7 22l5-3 5 3-1.5-9.5"/></svg>',
    message: '<svg viewBox="0 0 24 24"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>',
    grid: '<svg viewBox="0 0 24 24"><path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/></svg>',
    users: '<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    lock: '<svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>',
    target: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/><path d="m15 9 5-5"/></svg>',
    book: '<svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z"/></svg>',
  };
  return `<span class="icon">${icons[name] || icons.file}</span>`;
}

function brand() {
  return `<a class="brand" href="/" data-link><img class="brand-logo" src="/assets/kis-logo-horizontal.png" alt="KIS"><span>${t("brand")}</span></a>`;
}

function languageSwitcher() {
  return `<div class="language-switch">${["vi", "en", "kr"].map((lang, index) => `<button type="button" class="${language === lang ? "active" : ""}" data-language="${lang}">${dictionaries[lang].lang}</button>${index < 2 ? "<span>|</span>" : ""}`).join("")}</div>`;
}

function header() {
  return `
    <header class="header">
      <div class="container header-inner">
        ${brand()}
        <nav class="nav">
          <a href="/" data-link>${t("nav.home")}</a>
          <a href="/about-kis" data-link>${t("nav.about")}</a>
          <button class="nav-button" data-scroll="featured-courses">${t("nav.courses")}</button>
          <button class="nav-button" data-announcements-link>${uiText("announcements")}</button>
          <button class="nav-button" data-scroll="support">${t("nav.support")}</button>
        </nav>
        <div class="header-actions">
          ${languageSwitcher()}
          <a class="btn btn-outline" href="/login" data-link>${t("nav.login")}</a>
          <button class="btn btn-primary" data-hr-link>${t("nav.hr")}</button>
        </div>
      </div>
    </header>
  `;
}

function footer() {
  return `
    <footer class="footer premium-footer">
      <div class="container footer-grid">
        <div class="footer-brand">
          <strong>${t("brand")}</strong>
          <p>Hệ thống Đào tạo Hội nhập và Phát triển chuyên môn KIS Việt Nam</p>
          <span>${uiText("employeeOnly")}</span>
        </div>
        <nav class="footer-column">
          <h3>${uiText("quickLinks")}</h3>
          <a href="/" data-link>${t("nav.home")}</a>
          <a href="/about-kis" data-link>${t("nav.about")}</a>
          <a href="/#featured-courses" data-link>${t("nav.courses")}</a>
          <a href="/#hr-announcements" data-link>${uiText("announcements")}</a>
        </nav>
        <nav class="footer-column">
          <h3>${uiText("support")}</h3>
          <a href="#support" data-scroll="support">Hướng dẫn sử dụng</a>
          <a href="mailto:thanh.ntc@kisvn.vn">Liên hệ HR</a>
          <a href="#">Chính sách bảo mật</a>
          <a href="/change-password" data-link>Đổi mật khẩu</a>
        </nav>
        <div class="footer-column footer-contact">
          <h3>${uiText("contactPerson")}</h3>
          <strong>${hrContact}</strong>
          <p>Assistant Manager</p>
          <p>Human Resources</p>
          <a href="mailto:thanh.ntc@kisvn.vn">thanh.ntc@kisvn.vn</a>
        </div>
      </div>
      <div class="container footer-bottom">
        <span>© 2026 KIS Vietnam. All rights reserved.</span>
        <span>${uiText("internalOnly")}</span>
        ${languageSwitcher()}
      </div>
    </footer>
  `;
}

function badge(key) {
  const cls = { active: "done", completed: "done", inProgress: "learning", notStarted: "new", pendingActivation: "pending", temporarilyLocked: "late", overdue: "late", disabled: "new", pending: "pending", follow: "late" }[key] || "new";
  return `<span class="badge ${cls}">${t(`status.${key}`)}</span>`;
}

function progress(value) {
  return `<div class="progress"><span style="--value:${value}%"></span></div>`;
}

function getTotalParticipatingEmployees() {
  return new Set(trainingEnrollments.map((item) => item.employeeId).filter(Boolean)).size;
}

function getTotalTrainingCourses() {
  return allTrainingCourses.filter((course) => course[1]).length;
}

function getTotalLearningHours() {
  return trainingEnrollments.reduce((total, item) => total + Number(item.trainingHours || item.durationHours || 0), 0);
}

function landingPage() {
  const purposes = [
    ["building", "purpose.onboarding", "Giúp nhân viên mới nắm rõ lịch sử công ty, văn hóa doanh nghiệp, quy trình nội bộ và các chính sách nhân sự bắt buộc."],
    ["message", "purpose.softSkills", "Cung cấp các khóa học thực chiến về kỹ năng giao tiếp, kỹ năng bán hàng (FAB) và quy trình phối hợp liên phòng ban."],
    ["award", "purpose.certificate", "Hệ thống hóa tài liệu, lộ trình học và ôn tập chuyên sâu để chuẩn bị cho các kỳ thi chứng chỉ chuyên môn của UBCKNN."],
    ["check", "purpose.testing", "Tổ chức các bài test định kỳ, sát hạch năng lực và tự động ghi nhận tiến độ, cấp chứng nhận hoàn thành."],
  ];
  return `
    <div class="page">
      ${header()}
      <section class="hero">
        <div class="container hero-grid">
          <div>
            <span class="eyebrow">${language === "kr" ? "Welcome to" : "Welcome to"}</span>
            <h1>MyKIS Learning</h1>
            <h2>Hệ thống Đào tạo Hội nhập và Phát triển chuyên môn KIS Việt Nam</h2>
            <p>Nơi lưu trữ tài liệu, khóa học kỹ năng mềm, chuyên môn và kiểm tra tiến độ; giúp nhân viên nhanh chóng hòa nhập và nâng cao năng lực làm việc.</p>
            <p class="hero-subnote">Dành riêng cho nhân viên KIS Việt Nam</p>
            <div class="hero-actions"><a class="btn btn-primary" href="/login" data-link>${t("landing.cta")}</a><button class="btn btn-outline" data-scroll="featured-courses">Xem các khóa đào tạo</button></div>
            <div class="hero-proof"><div class="proof-item"><strong>${getTotalParticipatingEmployees().toLocaleString("vi-VN")}+</strong><span>Tổng số nhân viên đã tham gia</span></div><div class="proof-item"><strong>${getTotalTrainingCourses()}</strong><span>Số lượng khóa đào tạo</span></div><div class="proof-item"><strong>${getTotalLearningHours().toLocaleString("vi-VN")} giờ</strong><span>Tổng số giờ học</span></div></div>
          </div>
          ${heroMockup()}
        </div>
      </section>
      <section class="section" id="purpose"><div class="container"><h2 class="section-title">${t("landing.purpose")}</h2><p class="section-lead">${t("landing.purposeLead")}</p><div class="grid-4 purpose-grid">${purposes.map(([i, key, desc]) => `<article class="card info-card purpose-card">${icon(i)}<h3>${t(key)}</h3><p>${desc}</p></article>`).join("")}</div></div></section>
      <section class="section" id="featured-courses"><div class="container"><h2 class="section-title">Khóa đào tạo nổi bật</h2><div class="grid-6">${courses.map(courseCard).join("")}</div>${upcomingCoursesSection()}</div></section>
      <section class="section alt" id="support"><div class="container"><div class="support-panel card"><div><h2>${t("nav.support")}</h2><p>Liên hệ hỗ trợ đào tạo, tài khoản và phân quyền nội bộ.</p></div><strong>${hrContact}</strong></div></div></section>
      ${hrAnnouncementsSection()}
      ${footer()}
    </div>
  `;
}

function heroMockup() {
  return `
    <div class="mock-shell hero-learning-image"><img src="/images/mykis-learning-hero.png" alt="Nhân viên tham gia đào tạo nội bộ KIS"></div>
  `;
}

function courseCard(c) {
  const image = c[5];
  return `<article class="card info-card course-category ${c[1].includes("Chứng chỉ") ? "featured-course" : ""}">${image ? `<img class="course-card-image" src="${image}" alt="${c[1]}">` : icon(c[0])}<h3>${c[1]}</h3><p>${c[2]}</p><div class="tag-row">${c[4].map((tag) => `<span>${tag}</span>`).join("")}</div><span class="card-meta">${c[3]} ${t("nav.courses").toLowerCase()}</span></article>`;
}

function upcomingCoursesSection() {
  return `<div class="upcoming-course-block"><div class="section-head"><div><h3>Khóa học sắp diễn ra</h3><p class="section-lead">Cập nhật các chương trình đào tạo dự kiến trong thời gian tới.</p></div></div><div class="grid-4">${upcomingCourses.map(([i, title, category, format, status]) => `<article class="card info-card upcoming-course-card">${icon(i)}<h3>${title}</h3><p>Dự kiến Quý III/2026</p><div class="tag-row"><span>${category}</span><span>${format}</span><span>${status}</span></div><button class="btn btn-outline mini-course-btn">Xem thông tin</button></article>`).join("")}</div></div>`;
}

function hrAnnouncementsSection() {
  return `<section class="section alt" id="hr-announcements"><div class="container"><div class="section-head"><div><h2 class="section-title">Thông báo từ HR</h2><p class="section-lead">Cập nhật các thông tin quan trọng về đào tạo, hội nhập và phát triển nhân sự.</p></div></div><div class="grid-4">${hrAnnouncements.map(([category, title, desc]) => `<article class="card info-card hr-announcement-card">${icon("file")}<span class="badge new">${category}</span><h3>${title}</h3><p>${desc}</p><button class="btn btn-outline mini-course-btn">Xem chi tiết</button></article>`).join("")}</div></div></section>`;
}

function aboutPage() {
  return `
    <div class="page about-page">
      ${header()}
      <section class="about-premium-hero about-image-hero">
        <div class="container about-premium-grid">
          <div><span class="breadcrumb">${t("about.breadcrumb")}</span><span class="eyebrow">${t("about.eyebrow")}</span><h1>${t("about.title")}</h1><p>Hành trình phát triển, nền tảng tài chính, mạng lưới toàn cầu và sức mạnh con người tạo nên KIS Việt Nam.</p><div class="hero-actions"><button class="btn btn-primary" data-scroll="kis-overview">${t("about.financialCta")}</button><button class="btn btn-outline light" data-scroll="kis-history">${t("about.honorCta")}</button></div></div>
          <div class="profile-summary-card">${[["12/2010", "Thành lập"], ["4.550 tỷ VND", "Vốn điều lệ"], ["99.8%", "Sở hữu KIS Korea"], ["15+ năm", "Hoạt động tại Việt Nam"]].map(([v, l]) => `<div><span>${l}</span><strong>${v}</strong></div>`).join("")}</div>
        </div>
      </section>
      <main>
        ${kisOverviewSection()}
        ${globalNetworkSection()}
        ${kisTimelineSection()}
        ${ceoMessageSection()}
        ${corporatePhilosophySection()}
        ${coreValuesMissionSection()}
        ${cchnHonorSection()}
      </main>
      ${footer()}
    </div>
  `;
}

function kisOverviewSection() {
  const stats = [["12/2010", "Thành lập"], ["99.8%", "Sở hữu KIS Korea"], ["4.550 tỷ VND", "Vốn điều lệ"], ["15+ năm", "Hoạt động tại Việt Nam"]];
  return `<section class="section" id="kis-overview"><div class="container overview-split"><div><span class="eyebrow">Overview</span><h2 class="section-title">Tổng quan KIS Việt Nam</h2><div class="overview-copy"><p>Công ty Cổ phần Chứng khoán KIS Vietnam (KIS Vietnam) được thành lập vào tháng 12 năm 2010 bởi Công ty Cổ phần Đầu tư & Chứng khoán Hàn Quốc (KIS Korea), cùng với sự đầu tư của Tập đoàn Dệt may Việt Nam và các cổ đông khác. KIS Korea nắm giữ 48,8% cổ phần tại KIS Vietnam tính đến tháng 11 năm 2010 và đã dần dần tăng cường sở hữu trong những năm qua, với tỷ lệ sở hữu chính thức hiện tại là <strong>99,8%</strong>.</p><p>Trong suốt <strong>15 năm</strong> hoạt động tại thị trường Việt Nam, KIS Vietnam đã liên tục tăng vốn để mở rộng các hoạt động kinh doanh của công ty, với tổng vốn điều lệ đạt <strong>4.550 tỷ VND</strong>, và con số này sẽ tiếp tục tăng trong tương lai.</p><p>KIS Vietnam nhận được sự hỗ trợ mạnh mẽ từ Tập đoàn KIS tại Hàn Quốc, tận dụng kinh nghiệm trong lĩnh vực tài chính và sự hợp tác của các chuyên gia nước ngoài cùng đội ngũ nhân viên xuất sắc có nhiều năm kinh nghiệm trong ngân hàng, kiểm toán và thị trường vốn trong nước.</p><p>KIS Vietnam tập trung phát triển kỹ thuật quản lý hoạt động và quản lý rủi ro để định vị công ty như một nhà lãnh đạo trong các lĩnh vực tài chính tại Việt Nam. Chúng tôi tin rằng nguồn nhân lực là yếu tố then chốt xây dựng danh tiếng và thành công của KIS Vietnam trên thị trường chứng khoán.</p></div></div><aside class="overview-stat-card card">${stats.map(([v,l]) => `<div><span>${l}</span><strong>${v}</strong></div>`).join("")}</aside></div></section>`;
}

function globalNetworkSection() {
  const cards = [
    ["Korea Investment & Securities (KIS)", "8 công ty con", "1 văn phòng đại diện"],
    ["Korea Investment Management (KIM)", "1 công ty con", "1 văn phòng đại diện"],
    ["Korea Investment Partners (KIP)", "1 công ty con", "2 văn phòng đại diện"],
    ["KIARA Advisors", "Global advisory network", ""],
  ];
  return `<section class="section alt global-network-section"><div class="container"><div class="section-head"><div><span class="eyebrow">Global Network</span><h2 class="section-title">${t("about.network")}</h2><p class="section-lead">KIS kết nối năng lực tài chính, đầu tư và quản trị quốc tế nhằm hỗ trợ sự phát triển bền vững tại thị trường Việt Nam.</p></div></div><div class="network-summary-grid">${cards.map(([title, left, right]) => `<article class="card network-summary-card"><h3>${title}</h3><p>${right ? `${left} <span>|</span> ${right}` : left}</p></article>`).join("")}</div><div class="network-reference-map"><img src="/assets/about/global-network.png" alt="Mạng lưới KIS toàn cầu với bản đồ dotted map và các văn phòng quốc tế"></div></div></section>`;
}

function kisTimelineSection() {
  const item = timelineData[activeTimelineYear];
  return `<section class="section" id="kis-history"><div class="container"><h2 class="section-title">Lịch sử phát triển</h2><div class="year-nav">${Object.keys(timelineData).map((year) => `<button class="${activeTimelineYear === year ? "active" : ""}" data-timeline-year="${year}">${year}</button>`).join("")}</div><div class="timeline-detail"><div class="timeline-image-wrap"><img src="${item.image}" alt="Sự kiện KIS năm ${activeTimelineYear}"></div><div class="timeline-content"><span>${activeTimelineYear}</span><h3>KIS Vietnam Milestone</h3><ul>${item.events.map((event) => `<li>${event}</li>`).join("")}</ul></div></div></div></section>`;
}

function ceoMessageSection() {
  const paragraphs = ["Kính gửi Quý Nhà đầu tư và Đối tác,", "Thay mặt Công ty Cổ phần Chứng khoán KIS Việt Nam, tôi xin gửi lời cảm ơn chân thành tới Quý Nhà đầu tư và Đối tác đã luôn tin tưởng, đồng hành và ủng hộ KIS Việt Nam trong suốt chặng đường phát triển hơn 15 năm qua.", "Ngay từ những ngày đầu thành lập, KIS Việt Nam luôn kiên định với định hướng lấy khách hàng làm trung tâm, không ngừng nâng cao chất lượng dịch vụ và ứng dụng công nghệ hiện đại nhằm mang đến các sản phẩm, giải pháp tài chính toàn diện cho nhà đầu tư cá nhân, tổ chức trong nước và quốc tế. Chúng tôi tin rằng sự thành công của khách hàng chính là nền tảng cho sự phát triển bền vững của KIS Việt Nam.", "Với mục tiêu trở thành một trong những định chế tài chính hàng đầu trên thị trường vốn Việt Nam, KIS Việt Nam không chỉ kế thừa nền tảng tài chính vững mạnh, kinh nghiệm quản trị và mạng lưới toàn cầu từ KIS Hàn Quốc, mà còn không ngừng đầu tư vào nguồn nhân lực chất lượng cao, công nghệ và hạ tầng giao dịch hiện đại để nâng cao trải nghiệm khách hàng.", "Sở hữu đội ngũ chuyên gia giàu kinh nghiệm cùng sự hỗ trợ từ các giải pháp công nghệ tiên tiến, chúng tôi cam kết tiếp tục đồng hành cùng Quý khách hàng và đối tác trên hành trình đầu tư, mang đến những giá trị thiết thực, bền vững và hiệu quả.", "Một lần nữa, xin chân thành cảm ơn sự tin tưởng và đồng hành của Quý vị. Kính chúc Quý Nhà đầu tư, Đối tác cùng gia đình sức khỏe, hạnh phúc và thành công.", "Trân trọng."];
  return `<section class="section alt"><div class="container"><h2 class="section-title">Lời Tổng Giám đốc</h2><div class="ceo-message-card card"><div class="ceo-photo"><img src="/assets/about/tgd.jpeg" alt="Shin, Hyun Jae - Tổng Giám đốc"></div><div class="ceo-copy"><span class="eyebrow">${t("about.leadership")}</span><h3>Shin, Hyun Jae</h3><p class="label">Tổng Giám đốc</p><div class="ceo-letter">${paragraphs.map((p) => `<p>${p}</p>`).join("")}</div></div></div></div></section>`;
}

function corporatePhilosophySection() {
  const cards = [["01", "Làm hài lòng khách hàng", ["Khách hàng là lý do mà công ty chứng khoán tồn tại.", "Ra quyết định dựa trên góc nhìn của khách hàng.", "Phát triển cùng với khách hàng bằng cách đảm bảo sự hài lòng của họ."]], ["02", "Kiến tạo giá trị mới", ["Liên tục tạo ra giá trị mới cho xã hội.", "Đổi mới với tinh thần thử thách bằng cách nâng cao năng lực tổ chức.", "Theo đuổi những mục tiêu cao nhất và sự xuất sắc."]], ["03", "Tôn trọng cá nhân", ["Chúng tôi luôn tôn trọng từng cá nhân trong đội ngũ của mình.", "Khuyến khích cá nhân phát triển khả năng của họ tại nơi làm việc.", "Hỗ trợ mỗi cá nhân trở thành những nhân viên xuất sắc."]]];
  return `<section class="section"><div class="container"><h2 class="section-title">Triết lý tập đoàn</h2><div class="grid-3">${cards.map(([no,title,bullets]) => `<article class="card philosophy-premium philosophy-list-card">${icon("check")}<span>${no}</span><h3>${title}</h3><ul>${bullets.map((b) => `<li>${b}</li>`).join("")}</ul></article>`).join("")}</div></div></section>`;
}

function coreValuesMissionSection() {
  const title = language === "kr" ? "핵심 가치 및 미션" : language === "en" ? "Core Values & Mission" : "Giá trị cốt lõi & Sứ mệnh";
  const subtitle = language === "kr"
    ? "KIS가 조직을 구축하고 변화를 추진하며 고객을 위한 지속 가능한 가치를 창출하는 방향을 제시합니다."
    : language === "en"
      ? "Guiding how KIS builds its organization, drives transformation, and creates sustainable value for customers."
      : "Định hướng cách KIS xây dựng tổ chức, thúc đẩy đổi mới và tạo ra giá trị bền vững cho khách hàng.";
  const cards = [
    ["01", "target", { vi: "Tổ chức hướng đến mục tiêu", en: "Goal-Oriented Organization", kr: "목표 지향적 조직" }, { vi: "Xác lập mục tiêu rõ ràng, phối hợp hiệu quả và tập trung nguồn lực để tạo ra kết quả đo lường được.", en: "Setting clear objectives, coordinating effectively, and focusing resources to deliver measurable results.", kr: "명확한 목표를 설정하고 효과적으로 협업하며 자원을 집중하여 측정 가능한 성과를 창출합니다." }],
    ["02", "check", { vi: "Tổ chức thúc đẩy chuyển đổi", en: "A Transformative Organization", kr: "변화를 주도하는 조직" }, { vi: "Không ngừng đổi mới phương thức làm việc, ứng dụng công nghệ và phát triển năng lực để thích ứng với thay đổi.", en: "Continuously improving ways of working, adopting technology, and building capabilities to adapt to change.", kr: "업무 방식을 지속적으로 개선하고 기술을 도입하며 변화에 대응할 수 있는 역량을 강화합니다." }],
    ["03", "users", { vi: "Công ty lấy khách hàng làm trọng tâm", en: "A Customer-Focused Company", kr: "고객 중심 기업" }, { vi: "Thấu hiểu nhu cầu khách hàng, nâng cao trải nghiệm và tạo ra giải pháp tài chính có giá trị lâu dài.", en: "Understanding customer needs, improving experiences, and delivering financial solutions with long-term value.", kr: "고객의 요구를 이해하고 경험을 향상시키며 장기적인 가치를 제공하는 금융 솔루션을 제공합니다." }],
  ];
  return `<section class="section alt"><div class="container"><div class="section-head"><div><h2 class="section-title">${title}</h2><p class="section-lead">${subtitle}</p></div></div><div class="grid-3">${cards.map(([no, i, names, descriptions]) => `<article class="card philosophy-premium philosophy-list-card core-value-card">${icon(i)}<span>${no}</span><h3>${names[language] || names.vi}</h3><p>${descriptions[language] || descriptions.vi}</p></article>`).join("")}</div></div></section>`;
}

function cchnRows() {
  return getEmployees()
    .filter((employee) => employee.certificateType && employee.certificateType.trim() !== "")
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "vi", { sensitivity: "base" }));
}

function filteredCchnRows() {
  return cchnRows().filter((row) => {
    const text = row.fullName.toLowerCase();
    return !cchnSearch || text.includes(cchnSearch.toLowerCase());
  }).sort((a, b) => cchnSortAsc
    ? a.fullName.localeCompare(b.fullName, "vi", { sensitivity: "base" })
    : b.fullName.localeCompare(a.fullName, "vi", { sensitivity: "base" }));
}

function uniqueValues(rows, key) {
  return [...new Set(rows.map((row) => row[key]).filter(Boolean))];
}

function cchnHonorSection() {
  const rows = filteredCchnRows();
  const allRows = cchnRows();
  const totalText = language === "kr"
    ? `${allRows.length}명의 임직원이 전문 자격증을 보유하고 있습니다`
    : language === "en"
      ? `${allRows.length} employees holding professional certificates`
      : `${allRows.length} nhân viên sở hữu Chứng chỉ hành nghề`;
  const pageSize = 24;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  cchnPage = Math.min(cchnPage, totalPages);
  const pageRows = rows.slice((cchnPage - 1) * pageSize, cchnPage * pageSize);
  return `
    <section class="section cchn-section" id="cchn-honor">
      <div class="container">
        <div class="cchn-table-shell card">
          <div class="section-head"><div><span class="eyebrow">CCHN</span><h2 class="section-title">${uiText("cchnTitle")}</h2><p class="section-lead">${totalText}</p></div></div>
        <div class="cchn-filter table-only-filter">
          <input data-cchn-search placeholder="${uiText("searchName")}" value="${cchnSearch}">
          <button class="btn btn-outline" data-cchn-sort type="button">A-Z</button>
        </div>
        ${pageRows.length ? cchnTableView(pageRows, (cchnPage - 1) * pageSize) : emptyCchnState()}
        ${totalPages > 1 ? pagination("cchn", cchnPage, totalPages) : ""}
        </div>
      </div>
    </section>
  `;
}

function selectFilter(name, label, values, selected) {
  return `<select data-cchn-filter="${name}"><option value="">${label}</option>${values.map((value) => `<option value="${value}" ${selected === value ? "selected" : ""}>${value}</option>`).join("")}</select>`;
}

function cchnTableView(rows, offset = 0) {
  return `<div class="table-wrap cchn-table polished-table"><table><thead><tr><th>${uiText("no")}</th><th>${uiText("fullName")}</th></tr></thead><tbody>${rows.map((r, index) => `<tr><td>${offset + index + 1}</td><td><strong>${r.fullName}</strong></td></tr>`).join("")}</tbody></table></div>`;
}

function cchnStatusBadge(status = "Còn hiệu lực") {
  const cls = status.includes("Cần") ? "pending" : status.includes("Hết") ? "late" : "done";
  return `<span class="badge ${cls}">${status}</span>`;
}

function emptyCchnState() {
  return `<div class="empty-cchn">${icon("award")}<h3>${t("about.noData")}</h3><p>${t("about.noDataDesc")}</p></div>`;
}

function pagination(kind, current, total) {
  return `<div class="pagination ${kind}-pagination">${Array.from({ length: total }, (_, index) => index + 1).map((page) => `<button class="${page === current ? "active" : ""}" data-page-kind="${kind}" data-page="${page}">${page}</button>`).join("")}</div>`;
}

function trainingValueLabel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "done") return "Hoàn thành";
  if (normalized === "x") return "Đã tham gia";
  return value ? String(value) : "Chưa có dữ liệu";
}

function trainingValueBadge(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "done") return badge("completed");
  if (normalized === "x") return badge("inProgress");
  return badge("notStarted");
}

function employeeTrainingRows(employee) {
  const specialization = employee.specializationCourses || {};
  return [
    ["Leadership Training", employee.leadershipTraining],
    ["Communication Training", employee.communicationTraining],
    ["Basic of Securities", specialization.basicOfSecurities],
    ["Law of Securities", specialization.lawOfSecurities],
    ["Analysis and Investment Securities", specialization.analysisAndInvestmentSecurities],
    ["Brokerage and Investment Advisory", specialization.brokerageAndInvestmentAdvisory],
    ["Analysis of Financial Statements", specialization.analysisOfFinancialStatements],
    ["Financial Advisory and Underwriting", specialization.financialAdvisoryAndUnderwriting],
    ["Assets and Fund Management", specialization.assetsAndFundManagement],
    ["Derivative Securities", specialization.derivativeSecurities],
  ].filter(([, value]) => value);
}

function localizedStatus(status) {
  const labels = {
    active: t("status.active"),
    pendingActivation: t("status.pendingActivation"),
    temporarilyLocked: t("status.temporarilyLocked"),
    disabled: t("status.disabled"),
    pendingReview: "Cần kiểm tra",
  };
  return labels[status] || status || "-";
}

function filteredEmployeeDirectory() {
  return getEmployees().filter((employee) => {
    const searchText = `${employee.fullName} ${employee.email}`.toLowerCase();
    if (employeeDirectoryReviewIssues && !employee.dataIssue) return false;
    return (!employeeDirectorySearch || searchText.includes(employeeDirectorySearch.toLowerCase()))
      && (!employeeDirectoryFilters.department || employee.department === employeeDirectoryFilters.department)
      && (!employeeDirectoryFilters.position || employee.position === employeeDirectoryFilters.position)
      && (!employeeDirectoryFilters.accountStatus || employee.accountStatus === employeeDirectoryFilters.accountStatus)
      && (!employeeDirectoryFilters.cchn || (employeeDirectoryFilters.cchn === "yes" ? !!employee.certificateType : !employee.certificateType));
  }).sort((a, b) => employeeDirectorySortAsc
    ? a.fullName.localeCompare(b.fullName, "vi", { sensitivity: "base" })
    : b.fullName.localeCompare(a.fullName, "vi", { sensitivity: "base" }));
}

function employeeSelect(name, label, values, selected) {
  return `<select data-employee-filter="${name}"><option value="">${label}</option>${values.map((value) => `<option value="${value}" ${selected === value ? "selected" : ""}>${value}</option>`).join("")}</select>`;
}

function hrEmployeeDirectory() {
  const allEmployees = getEmployees();
  const filtered = filteredEmployeeDirectory();
  const pageSize = 15;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  employeeDirectoryPage = Math.min(employeeDirectoryPage, totalPages);
  const pageRows = filtered.slice((employeeDirectoryPage - 1) * pageSize, employeeDirectoryPage * pageSize);
  return `<section class="card panel hr-employee-directory">
    <div class="section-head"><div><h3>${t("admin.employeeList")}</h3><p class="section-lead">${t("admin.totalEmployees")}: ${allEmployees.length}</p></div><button class="btn btn-outline" data-sort-employees>${t("admin.sortAZ")}</button></div>
    <div class="filter-bar employee-directory-filter">
      <input data-employee-search placeholder="${t("admin.searchEmployee")}" value="${employeeDirectorySearch}">
      ${employeeSelect("department", t("table.department"), uniqueValues(allEmployees, "department"), employeeDirectoryFilters.department)}
      ${employeeSelect("position", t("table.position"), uniqueValues(allEmployees, "position"), employeeDirectoryFilters.position)}
      ${employeeSelect("accountStatus", t("table.accountStatus"), uniqueValues(allEmployees, "accountStatus"), employeeDirectoryFilters.accountStatus)}
      <select data-employee-filter="cchn"><option value="">CCHN</option><option value="yes" ${employeeDirectoryFilters.cchn === "yes" ? "selected" : ""}>${t("admin.hasCchn")}</option><option value="no" ${employeeDirectoryFilters.cchn === "no" ? "selected" : ""}>${t("admin.noCchn")}</option></select>
    </div>
    ${employeeDirectoryTable(pageRows, (employeeDirectoryPage - 1) * pageSize)}
    ${totalPages > 1 ? pagination("employees", employeeDirectoryPage, totalPages) : ""}
  </section>`;
}

function employeeDirectoryTable(rows, offset = 0) {
  return `<div class="table-wrap employee-directory-table"><table><thead><tr><th>STT</th><th>${t("table.fullName")}</th><th>${t("table.department")}</th><th>${t("table.position")}</th><th>${t("table.email")}</th><th>${t("table.role")}</th><th>${t("table.accountStatus")}</th><th>Leadership Training</th><th>Communication Training</th><th>CCHN</th><th>${t("admin.action")}</th></tr></thead><tbody>${rows.map((employee, index) => `<tr>
    <td>${offset + index + 1}</td>
    <td><strong>${employee.fullName}</strong>${employee.dataIssue ? `<small class="data-issue">${employee.dataIssue === "duplicate_email" ? t("admin.duplicateEmail") : t("admin.invalidEmail")}</small>` : ""}</td>
    <td>${employee.department || ""}</td>
    <td>${employee.position || ""}</td>
    <td>${employee.email || `<span class='muted-cell'>${t("admin.needsUpdate")}</span>`}</td>
    <td>${employee.role}</td>
    <td>${localizedStatus(employee.accountStatus)}</td>
    <td>${trainingValueLabel(employee.leadershipTraining)}</td>
    <td>${trainingValueLabel(employee.communicationTraining)}</td>
    <td>${employee.certificateType ? t("admin.hasCchn") : ""}</td>
    <td><div class="row-actions">${employee.dataIssue ? `<button class="btn btn-outline mini-action" data-edit-employee-email="${employee.id}">${t("admin.editEmail")}</button>` : ""}${employee.accountId ? `<button class="btn btn-outline mini-action" data-account-detail="${employee.accountId}">${t("admin.detail")}</button><button class="btn btn-outline mini-action" data-activate-account="${employee.accountId}">${t("admin.activate")}</button><button class="btn btn-outline mini-action" data-reset-account="${employee.accountId}">${t("admin.resetPassword")}</button><button type="button" class="btn btn-outline mini-action" data-quick-assign="${escapeHtmlAttribute(employee.accountId)}">${t("enrollment.assign")}</button>` : `<button class="btn btn-outline mini-action" disabled>${t("admin.needsReview")}</button>`}</div></td>
  </tr>`).join("")}</tbody></table></div>`;
}

function loginPage() {
  const demoEmployee = getDemoEmployee();
  return `
    <main class="auth-page">
      <section class="auth-panel">${brand()}<div class="auth-copy"><h1>${t("login.title")}</h1><p>${t("login.subtitle")}</p></div></section>
      <section class="auth-visual">
        <form class="card login-card" id="loginForm">
          <div class="login-card-head">${brand()}${languageSwitcher()}</div>
          <h2>${t("login.title")}</h2><p>${t("login.note")}</p>
          <div class="role-toggle" role="tablist">${["employee", "hr"].map((role) => `<button type="button" class="${selectedLoginRole === role ? "active" : ""}" data-login-role="${role}" aria-selected="${selectedLoginRole === role}">${t(`roles.${role}`)}</button>`).join("")}</div>
          <div class="field"><label>${t("login.email")}</label><input name="identifier" autocomplete="username" type="email"></div>
          <div class="field"><label>${t("login.password")}</label><input name="password" type="password" autocomplete="current-password"></div>
          <div class="login-tools"><span>${t("login.note")}</span><button class="link-button" type="button" data-forgot-password>${uiText("forgotPassword")}</button></div>
          <button class="btn btn-primary" type="submit" style="width:100%">${t("login.submit")}</button>
          <div class="demo-account-card">
            <div>
              <span class="eyebrow">Tài khoản HR demo</span>
              <h3>Nguyễn Thị Cẩm Thanh</h3>
              <p><strong>Email:</strong> ${DEMO_HR_EMAIL}</p>
              <p><strong>Mật khẩu:</strong> ${DEMO_HR_PASSWORD}</p>
            </div>
            <div class="demo-actions">
              <button class="btn btn-outline" type="button" data-fill-demo-account>Dùng tài khoản này</button>
              <button class="btn btn-ghost" type="button" data-reset-demo-account>Reset demo account</button>
            </div>
          </div>
          ${demoEmployee ? `<div class="demo-account-card"><div><strong>${uiText("demoEmployeeAccount")}</strong><p>${escapeHtml(demoEmployee.fullName || demoEmployee.name || "")}</p><p>${uiText("emailLabel")}: ${escapeHtml(demoEmployee.email || "")}</p><p>${uiText("passwordLabel")}: Training@2026</p></div><button type="button" class="btn btn-outline" data-fill-demo-employee>${uiText("useAccount")}</button></div>` : ""}
        </form>
      </section>
    </main>
  `;
}

function getDemoEmployee() {
  return getAccounts().find((account) => account.role === "employee"
    && account.accountStatus === "active"
    && account.passwordResetRequired === false
    && verifyPassword(account, "Training@2026")) || null;
}

function employeeDashboard(compact = false) {
  if (compact || !hasEmployeeAccess()) return "";
  const { account, employee } = getCurrentEmployeeContext();
  const enrollments = employeeEnrollments();
  const notifications = getNotifications(session.accountId);
  const unread = getUnreadCount(session.accountId);
  const completed = enrollments.filter((item) => item.status === "completed").length;
  const inProgress = enrollments.filter((item) => item.status === "inProgress").length;
  const overdue = enrollments.filter((item) => item.status === "overdue").length;
  const recent = [...enrollments].filter((item) => item.status !== "completed").sort(compareEnrollmentPriority).slice(0, 3);
  const displayName = account?.fullName || account?.name || employee?.fullName || "";
  return `
    <div class="app-layout">${sideNav("employee")}
      <main class="app-main">${topbar(uiText("learner"), displayName, "employee", initials(displayName))}<div class="content">
        <div class="kpi-grid"><div class="card kpi"><span class="label">${uiText("inProgressCourses")}</span><strong>${inProgress}</strong></div><div class="card kpi"><span class="label">${uiText("completed")}</span><strong>${completed}</strong></div><div class="card kpi"><span class="label">${uiText("overdue")}</span><strong>${overdue}</strong></div><div class="card kpi"><span class="label">${uiText("newNotifications")}</span><strong>${unread}</strong></div></div>
        <div class="dashboard-grid"><section class="card panel"><div class="panel-head"><div><h3>${uiText("recentCourses")}</h3></div><a class="btn btn-outline mini-action" href="/dashboard/courses" data-link>${uiText("viewAllCourses")}</a></div>${recent.length ? recent.map(recentCourseRow).join("") : `<div class="empty-state">${icon("book")}<h3>${uiText("noRecentCourses")}</h3><p>${uiText("noRecentCoursesDesc")}</p></div>`}</section><aside class="card panel" id="employee-notifications"><div class="panel-head"><div><h3>${uiText("recentNotifications")}</h3></div><button class="btn btn-outline mini-action" type="button" data-toggle-employee-notifications>${uiText("viewNotifications")}</button></div>${notifications.slice(0, employeeNotificationPanelOpen ? notifications.length : 3).map(notificationRow).join("") || `<div class="empty-state"><p>${uiText("noNotifications")}</p></div>`}</aside></div>
      </div></main>
    </div>
  `;
}

function employeeEnrollments(){return getEnrollmentsByAccountId(session.accountId).map(e=>{const x=calculateCourseProgress({accountId:session.accountId,courseId:e.courseId});const status=x.completed?"completed":x.percent?"inProgress":"notStarted";return {...e,progressPercent:x.percent,status:getDisplayEnrollmentStatus({...e,status}),pendingGrading:x.pendingGrading};});}

function getCurrentEmployeeContext() {
  if (!session?.accountId) return { account: null, employee: null };
  return { account: getAccountById(session.accountId), employee: getEmployeeByAccountId(session.accountId) || null };
}

function hasEmployeeAccess() {
  if (!session?.accountId) return false;
  return getAccountById(session.accountId)?.role === "employee";
}

function compareEnrollmentPriority(a, b) {
  const priority = { overdue: 0, inProgress: 1, notStarted: 2 };
  return (priority[a.status] ?? 9) - (priority[b.status] ?? 9) || String(a.deadline || "9999").localeCompare(String(b.deadline || "9999"));
}

function recentCourseRow(item) {
  const safeProgress = Math.min(100, Math.max(0, Number(item.progressPercent) || 0));
  return `<div class="course-line"><div><strong>${escapeHtml(item.course?.title || "—")}</strong><small>${uiText("deadline")}: ${escapeHtml(item.deadline || "—")}</small>${progress(safeProgress)}</div><div>${badge(item.status)}<br><a href="/dashboard/courses/${escapeHtmlAttribute(item.courseId)}" data-link>${uiText("continueLearning")}</a></div></div>`;
}

function notificationRow(item) {
  return `<div class="task"><strong>${escapeHtml(item.title || "")}</strong><span>${escapeHtml(item.body || "")} · ${escapeHtml(item.createdAt || "")}</span>${item.isRead === false ? `<button type="button" class="btn btn-outline mini-action" data-mark-notification-read="${escapeHtmlAttribute(item.id)}">${uiText("markRead")}</button>` : ""}</div>`;
}

function myCoursesPage() {
  if (!hasEmployeeAccess()) return session ? restrictedPage() : loginPage();
  const account = getAccountById(session.accountId);
  const allEnrollments = employeeEnrollments();
  const filtered = myCourseFilter ? allEnrollments.filter((item) => item.status === myCourseFilter) : allEnrollments;
  const counts = { all: allEnrollments.length };
  ["inProgress", "completed", "notStarted", "overdue"].forEach((status) => { counts[status] = allEnrollments.filter((item) => item.status === status).length; });
  return `<div class="app-layout">${sideNav("employee")}<main class="app-main">${topbar(uiText("learner"), uiText("myCourses"), "employee", initials(account?.fullName || account?.name || ""))}<div class="content"><section class="card panel"><div class="account-toolbar"><div><h2>${uiText("myCourses")}</h2><p>${uiText("courseIntro")}</p></div></div>${myCourseFilterTabs(counts)}${filtered.length ? `<div class="stats-grid">${filtered.map(myCourseCard).join("")}</div>` : myCourseEmptyState()}</section></div></main></div>`;
}

function myCourseFilterTabs(counts) {
  const tabs = [["", "all", counts.all], ["inProgress", "inProgress", counts.inProgress], ["completed", "completed", counts.completed], ["notStarted", "notStarted", counts.notStarted]];
  if (counts.overdue > 0) tabs.push(["overdue", "overdue", counts.overdue]);
  return `<div class="filter-bar">${tabs.map(([value, label, count]) => `<button type="button" class="btn ${myCourseFilter === value ? "btn-primary" : "btn-outline"}" data-my-course-filter="${value}">${uiText(label)} (${count})</button>`).join("")}</div>`;
}

function myCourseCard(enrollment) {
  const course = enrollment.course || {};
  const safeProgress = Math.min(100, Math.max(0, Number(enrollment.progressPercent) || 0));
  const tags = [course.category, course.format, Number.isFinite(Number(course.durationHours)) ? `${Number(course.durationHours)}h` : ""].filter(Boolean);
  const media = course.imageUrl ? `<img class="course-card-image" src="${escapeHtmlAttribute(course.imageUrl)}" alt="${escapeHtmlAttribute(course.title || uiText("myCourses"))}" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden>${icon("book")}</span>` : icon("book");
  let action = `<a class="btn btn-primary" href="/dashboard/courses/${escapeHtmlAttribute(enrollment.courseId)}" data-link>${uiText("startCourse")}</a>`;
  if (enrollment.status === "inProgress" || enrollment.status === "overdue") action = `<a class="btn btn-primary" href="/dashboard/courses/${escapeHtmlAttribute(enrollment.courseId)}" data-link>${uiText("continueLearning")}</a>`;
  if (enrollment.status === "completed") action = `<span>${icon("check")} ${uiText("completedText")}${enrollment.completedAt ? ` · ${uiText("completedOn")} ${escapeHtml(enrollment.completedAt)}` : ""}</span>`;
  return `<article class="card panel">${media}<div class="panel-head"><div><h3>${escapeHtml(course.title || "—")}</h3><p>${tags.map(escapeHtml).join(" · ")}</p></div>${badge(enrollment.status)}</div><p>${uiText("progressLabel")}: <strong>${safeProgress}%</strong></p>${progress(safeProgress)}${enrollment.status !== "completed" && enrollment.deadline ? `<p>${uiText("deadline")}: <strong>${escapeHtml(enrollment.deadline)}</strong></p>` : ""}<div class="security-actions">${action}</div></article>`;
}

function myCourseEmptyState() {
  return `<div class="card empty-state">${icon("book")}<h3>${uiText(myCourseFilter ? "noMatch" : "noCourses")}</h3><p>${uiText(myCourseFilter ? "noMatchDesc" : "noCoursesDesc")}</p></div>`;
}

function coursePlayerPage(courseId){
  if(!hasEmployeeAccess())return session?restrictedPage():loginPage(); const enrollment=employeeEnrollments().find(e=>e.courseId===courseId); if(!enrollment)return restrictedPage(); if(activeQuizAttempt)return quizAttemptPage();
  const course=getCourseById(courseId); const outline=getCourseContent(courseId); const states=getContentProgress(session.accountId,courseId); const attempts=getQuizAttemptsByAccountId(session.accountId); if(!outline.length)return `<div class="app-layout">${sideNav("employee")}<main class="app-main">${topbar(uiText("learner"),course?.title||"","employee")}<div class="content"><div class="empty-state"><h2>${lt("noContent")}</h2></div></div></main></div>`;
  const unlocked=(item,index)=>index===0||outline.slice(0,index).every(prev=>prev.required===false||isContentComplete(prev,states,attempts)); let index=Math.max(0,outline.findIndex(x=>x.id===(activeContentId||states.find(s=>!s.completed)?.contentId))); if(!unlocked(outline[index],index))index=outline.findIndex((x,i)=>unlocked(x,i)&&!isContentComplete(x,states,attempts)); if(index<0)index=outline.length-1; const item=outline[index]; activeContentId=item.id;
  const percent=calculateCourseProgress({accountId:session.accountId,courseId}).percent;
  return `<div class="app-layout learning-shell">${sideNav("employee")}<main class="app-main">${topbar(lt("learning"),course?.title||"","employee")}<div class="learning-notice" role="note">${lt("trackingNotice")}</div><div class="course-player"><aside class="course-outline"><div class="outline-progress"><strong>${percent}%</strong>${progress(percent)}<span>${lt("courseProgress")}</span></div><ol>${outline.map((x,i)=>{const done=isContentComplete(x,states,attempts);const lock=!unlocked(x,i);return `<li><button type="button" data-open-content="${x.id}" ${lock?"disabled":""} class="${x.id===item.id?"active":""}"><span aria-hidden="true">${lock?"🔒":done?"✓":x.type==="slide"?"▤":x.type==="video"?"▶":"?"}</span><span><strong>${escapeHtml(x.title)}</strong><small>${lock?lt("locked"):done?lt("completedLesson"):contentTypeLabel(x.type)}</small></span></button></li>`}).join("")}</ol></aside><section class="lesson-stage" data-course-id="${courseId}" data-content-id="${item.id}"><div class="lesson-heading"><div><span class="badge new">${contentTypeLabel(item.type)}</span><h1>${escapeHtml(item.title)}</h1></div><span>${index+1}/${outline.length}</span></div><div id="learning-warning" class="learning-warning" aria-live="polite"></div>${renderLearningContent(item,states.find(x=>x.contentId===item.id),attempts)}<nav class="lesson-nav" aria-label="${lt("lessonNavigation")}"><button class="btn btn-outline" data-course-content-nav="${index-1}" ${index===0?"disabled":""}>${lt("previousLesson")}</button><span id="lesson-requirement">${lessonRequirement(item,states.find(x=>x.contentId===item.id),attempts)}</span><button class="btn btn-primary" data-course-content-nav="${index+1}" ${index===outline.length-1||!isContentComplete(item,states,attempts)?"disabled":""}>${lt("nextLesson")}</button></nav></section></div></main></div>`;
}
function isContentComplete(item,states,attempts){return item.type==="quiz"?attempts.some(a=>a.quizId===item.quizId&&a.submittedAt&&(item.completionRule?.requirePass?a.passed===true:a.gradingStatus!=="pendingManual")):states.some(x=>x.contentId===item.id&&x.completed);}
function contentTypeLabel(type){return lt(type==="slide"?"slideLesson":type==="video"?"videoLesson":"quickQuiz");}
function renderLearningContent(item,state,attempts){if(item.type==="slide"){const slides=item.slides||[];activeSlideIndex=Math.min(activeSlideIndex,Math.max(0,slides.length-1));const slide=slides[activeSlideIndex]||{};const viewed=Number(state?.metadata?.slides?.[slide.id]?.viewedSeconds||0);return `<article class="slide-viewer" data-slide-id="${slide.id}" data-minimum="${slide.minimumViewSeconds||item.minimumDurationSeconds||8}"><div class="slide-canvas" role="img" aria-label="${escapeHtmlAttribute(slide.alt||slide.title||"")}"><span>${activeSlideIndex+1}/${slides.length}</span><h2>${escapeHtml(slide.title||"")}</h2><p>${escapeHtml(slide.content||"")}</p></div><div class="slide-controls"><button class="btn btn-outline" data-slide-nav="${activeSlideIndex-1}" ${activeSlideIndex===0?"disabled":""}>${lt("previous")}</button><span data-slide-timer>${Math.max(0,(slide.minimumViewSeconds||8)-viewed)}s</span><button class="btn btn-primary" data-slide-nav="${activeSlideIndex+1}" ${viewed<(slide.minimumViewSeconds||8)||activeSlideIndex===slides.length-1?"disabled":""}>${lt("next")}</button></div></article>`;}if(item.type==="video"){const m=state?.metadata||{};const transcript=`<details class="transcript"><summary>${lt("transcript")}</summary><p>${escapeHtml(item.transcript||"")}</p>${item.transcriptAlternativeAllowed&&!state?.completed?`<button class="btn btn-outline" data-complete-transcript>${lt("completeViaTranscript")}</button>`:""}</details>`;if(item.sourceType==="youtube")return `<div class="video-frame"><iframe id="youtube-player" src="https://www.youtube.com/embed/${escapeHtmlAttribute(item.youtubeVideoId)}?enablejsapi=1&playsinline=1" title="${escapeHtmlAttribute(item.title)}" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe></div><p class="media-policy">${lt("videoPolicy")}</p>${transcript}`;return `${item.sourceUrl?`<video id="course-video" controls preload="metadata" src="${escapeHtmlAttribute(item.sourceUrl)}"></video>`:`<div class="video-placeholder"><strong>${lt("videoUnavailable")}</strong><p>${lt("useTranscript")}</p></div>`}<p class="media-policy">${lt("videoPolicy")}</p>${transcript}`;}const quiz=getQuizById(item.quizId);const last=attempts.filter(a=>a.quizId===item.quizId&&a.submittedAt).at(-1);return `<div class="integrated-quiz"><h2>${escapeHtml(quiz?.title||item.title)}</h2><p>${escapeHtml(quiz?.description||"")}</p>${last?`<p>${t("quiz.score")}: <strong>${last.scorePercent}%</strong> · ${last.gradingStatus==="pendingManual"?lt("pendingGrading"):t(last.passed?"quiz.passed":"quiz.failed")}</p>`:""}<button class="btn btn-primary" data-quiz-start="${item.quizId}" ${!canStartQuiz({quizId:item.quizId,accountId:session.accountId}).ok?"disabled":""}>${last?t("quiz.retake"):t("quiz.start")}</button></div>`;}
function lessonRequirement(item,state,attempts){if(isContentComplete(item,getContentProgress(session.accountId,item.courseId),attempts))return lt("completedLesson");if(item.type==="slide")return lt("minimumViewing");if(item.type==="video")return lt("videoCompletionRule");return lt("passQuizToContinue");}
function lt(key){return (d().learning||{})[key]||key;}

function adminDashboard(compact = false) {
  const employees = getEmployees();
  const summary = getImportSummary();
  return `
    <div class="${compact ? "dashboard-preview" : "app-layout"}">${sideNav("hr")}<main class="app-main">${topbar("HR Admin Dashboard", "Quản trị đào tạo nội bộ", "hr")}<div class="content">
      <div class="kpi-grid"><div class="card kpi"><span class="label">${t("admin.totalEmployees")}</span><strong>${employees.length}</strong></div><div class="card kpi"><span class="label">${t("admin.hasCert")}</span><strong>${summary.certificateHolders}</strong></div><div class="card kpi"><span class="label">${t("admin.invalidEmails")}</span><strong>${summary.invalidEmails}</strong></div><div class="card kpi"><span class="label">${t("admin.duplicateEmails")}</span><strong>${summary.duplicateEmails}</strong></div></div>
      <section class="card panel data-quality-alert"><h3>${t("admin.dataReviewTitle")}</h3><p>${t("admin.invalidEmails")}: <strong>${summary.invalidEmails}</strong> · ${t("admin.duplicateEmails")}: <strong>${summary.duplicateEmails}</strong></p><button class="btn btn-outline" data-review-issues>${t("admin.reviewIssues")}</button></section>
      ${hrEmployeeDirectory()}
    </div></main></div>
  `;
}

function sideNav(role) {
  const items = role === "hr"
    ? [["/admin", "overview"], ["/admin/employees", "employees"], ["/admin/accounts", "accounts"], ["/admin/courses", "courses"], ["/admin/assign", "assign"], ["/admin/quizzes", "quizzes"], ["/admin/reports", "reports"]]
    : [["/dashboard", "overview"], ["/dashboard/courses", "courses"]];
  const activeIndex = items.reduce((bestIndex, [href], index) => {
    const isActive = route === href || (href !== "/" && route.startsWith(`${href}/`));
    if (!isActive) return bestIndex;
    return bestIndex < 0 || href.length > items[bestIndex][0].length ? index : bestIndex;
  }, -1);
  return `<aside class="app-sidebar">${brand()}<nav class="side-nav" aria-label="${t("nav.dashboard")}">${items.map(([href, key], index) => `<a class="${index === activeIndex ? "active" : ""}" ${index === activeIndex ? 'aria-current="page"' : ""} href="${href}" data-link>${key === "quizzes" ? t("quiz.quizzes") : t(`admin.${key}`)}</a>`).join("")}</nav></aside>`;
}

function topbar(label, title, role, avatarText = "") {
  const currentAccount = session?.accountId ? getAccountById(session.accountId) : null;
  const currentAvatarText = initials(currentAccount?.fullName || currentAccount?.name || session?.fullName || "");
  return `<div class="topbar"><div><span class="label">${label}</span><h2>${title}</h2></div><div class="topbar-actions">${languageSwitcher()}<div class="user-chip"><span class="avatar">${avatarText || currentAvatarText || (role === "hr" ? "HR" : "?")}</span>${session?.fullName || t(`roles.${role}`)}</div><button type="button" class="btn btn-outline" data-logout>${uiText("logout")}</button></div></div>`;
}

function accountsPage() {
  if (!hasAdminAccess()) return restrictedPage();
  const accounts = filteredAccounts();
  return `<div class="app-layout">${sideNav("hr")}<main class="app-main">${topbar("Admin", t("admin.accountTitle"), "hr")}<div class="content">
    <section class="card panel account-toolbar"><h3>${t("admin.accountTitle")}</h3><div class="filter-bar account-filter"><input data-account-search placeholder="${t("admin.search")}" value="${accountSearch}">${accountSelect("department", t("table.department"), uniqueValues(getAccounts(), "department"))}${accountSelect("role", t("table.role"), uniqueValues(getAccounts(), "role"))}${accountSelect("accountStatus", t("table.accountStatus"), uniqueValues(getAccounts(), "accountStatus"))}${accountSelect("passwordStatus", t("table.passwordStatus"), ["required", "normal"])}</div></section>
    <section class="card panel">${accountTable(accounts)}</section>
    <section class="card panel"><h3>${t("admin.auditLog")}</h3>${auditTable()}</section>
  </div></main>${accountDrawer()}${resetPasswordModal()}</div>`;
}

function filteredAccounts() {
  return getAccounts().filter((account) => {
    const text = `${account.fullName} ${account.email} ${account.employeeCode}`.toLowerCase();
    const passStatus = account.passwordResetRequired ? "required" : "normal";
    return (!accountSearch || text.includes(accountSearch.toLowerCase()))
      && (!accountFilters.department || account.department === accountFilters.department)
      && (!accountFilters.role || account.role === accountFilters.role)
      && (!accountFilters.accountStatus || account.accountStatus === accountFilters.accountStatus)
      && (!accountFilters.passwordStatus || passStatus === accountFilters.passwordStatus);
  });
}

function accountSelect(name, label, values) {
  return `<select data-account-filter="${name}"><option value="">${label}</option>${values.map((v) => `<option value="${v}" ${accountFilters[name] === v ? "selected" : ""}>${v.startsWith?.("required") || v === "normal" ? t(`status.${v}`) : v}</option>`).join("")}</select>`;
}

function accountTable(accounts) {
  const headers = ["fullName", "code", "email", "department", "role", "accountStatus", "passwordStatus", "failed", "lastLogin", "createdAt", "createdBy", "action"];
  return `<div class="table-wrap account-table"><table><thead><tr>${headers.map((h) => `<th>${h === "action" ? t("admin.action") : t(`table.${h}`)}</th>`).join("")}</tr></thead><tbody>${accounts.map((a) => `<tr><td><button class="row-link" data-account-detail="${a.id}">${a.fullName}</button></td><td>${a.employeeCode}</td><td>${a.email}</td><td>${a.department}</td><td>${a.role}</td><td>${badge(a.accountStatus)}</td><td>${badge(a.passwordResetRequired ? "required" : "normal")}</td><td>${a.failedLoginAttempts}</td><td>${a.lastLoginAt || "-"}</td><td>${a.createdAt}</td><td>${a.createdBy}</td><td><div class="row-actions"><button class="btn btn-outline mini-action" data-account-detail="${a.id}">${t("admin.detail")}</button><button class="btn btn-outline mini-action" data-reset-account="${a.id}">${t("admin.resetPassword")}</button><button class="btn btn-outline mini-action" data-force-account="${a.id}">${t("admin.forcePassword")}</button></div></td></tr>`).join("")}</tbody></table></div>`;
}

function accountDrawer() {
  if (!accountDrawerOpen || !selectedAccountId) return "";
  const a = getAccountById(selectedAccountId);
  if (!a) return "";
  const logs = getSecurityAuditLog().filter((log) => !log.targetAccountId || log.targetAccountId === a.id || log.targetEmployeeName === a.fullName).slice(0, 5);
  const rows = [["fullName", a.fullName], ["code", a.employeeCode], ["email", a.email], ["role", a.role], ["department", a.department], ["position", a.position], ["accountStatus", badge(a.accountStatus)], ["passwordStatus", badge(a.passwordResetRequired ? "required" : "normal")], ["failed", a.failedLoginAttempts], ["lastLogin", a.lastLoginAt || "-"], ["lastFailedLogin", a.lastFailedLoginAt || "-"], ["lockedUntil", a.lockedUntil || "-"], ["createdBy", a.createdBy], ["updatedBy", a.updatedBy || "-"]];
  return `<aside class="account-drawer open"><div class="drawer-head"><div><span class="eyebrow">${t("admin.accounts")}</span><h2>${a.fullName}</h2></div><button class="icon-btn" data-close-drawer>x</button></div><div class="profile-grid">${rows.map(([k, v]) => `<div class="profile-item"><span>${t(`table.${k}`)}</span><strong>${v}</strong></div>`).join("")}</div><div class="security-actions"><button class="btn btn-primary" data-reset-account="${a.id}">${t("admin.resetPassword")}</button><button class="btn btn-outline" data-force-account="${a.id}">${t("admin.forcePassword")}</button><button class="btn btn-outline" data-unlock-account="${a.id}">${t("admin.unlock")}</button><button class="btn btn-outline" data-disable-account="${a.id}">${t("admin.disable")}</button><button class="btn btn-outline" data-resend-account="${a.id}">${t("admin.resend")}</button></div><h3>${t("admin.auditLog")}</h3><div class="audit-list">${logs.map((l) => `<div><strong>${l.action}</strong><span>${l.createdAt} · ${l.description}</span></div>`).join("")}</div></aside>`;
}

function resetPasswordModal() {
  if (!resetModalOpen || !resetTargetId) return "";
  const a = getAccountById(resetTargetId);
  if (!a) return "";
  return `<div class="modal-backdrop open"><form class="card modal" id="resetPasswordForm"><div class="modal-head"><div><span class="eyebrow">${t("admin.resetPassword")}</span><h2>${t("modal.resetTitle")}</h2></div><button type="button" class="icon-btn" data-close-reset>x</button></div><div class="profile-grid"><div class="profile-item"><span>${t("table.fullName")}</span><strong>${a.fullName}</strong></div><div class="profile-item"><span>${t("table.code")}</span><strong>${a.employeeCode}</strong></div><div class="profile-item"><span>${t("table.email")}</span><strong>${a.email}</strong></div></div><div class="option-stack"><label><input type="radio" name="mode" value="auto" checked> ${t("modal.auto")}</label><label><input type="radio" name="mode" value="manual"> ${t("modal.manual")}</label><div class="field"><label>${t("admin.tempPassword")}</label><input name="manualPassword" placeholder="KIS@Temp2026"></div><label><input type="checkbox" name="notify" checked> ${t("modal.notify")}</label><label><input type="checkbox" name="require" checked> ${t("modal.require")}</label><label><input type="checkbox" name="unlock" checked> ${t("modal.unlock")}</label><div class="field"><label>${t("modal.note")}</label><textarea name="note" rows="3"></textarea></div></div>${temporaryPasswordResult ? `<div class="temp-password-box"><div><strong>${temporaryPasswordResult}</strong><p>${t("modal.oneTime")}</p></div><button class="btn btn-outline" type="button" data-copy-temp>${t("modal.copy")}</button></div>` : ""}<button class="btn btn-primary" type="submit" style="width:100%">${t("modal.confirm")}</button></form></div>`;
}

function auditTable() {
  return `<div class="table-wrap"><table><thead><tr><th>${t("admin.auditTime")}</th><th>${t("admin.auditActor")}</th><th>${t("admin.auditAction")}</th><th>${t("admin.auditTarget")}</th><th>${t("admin.auditResult")}</th></tr></thead><tbody>${getSecurityAuditLog().slice(0, 8).map((l) => `<tr><td>${l.createdAt}</td><td>${l.actorName}</td><td>${l.action}</td><td>${l.targetEmployeeName}</td><td>${l.result}</td></tr>`).join("")}</tbody></table></div>`;
}

function employeesPage() {
  if (!hasAdminAccess()) return restrictedPage();
  return `<div class="app-layout">${sideNav("hr")}<main class="app-main">${topbar("Admin", t("admin.employees"), "hr")}<div class="content">${hrEmployeeDirectory()}</div></main></div>`;
}

function employeeTable() {
  return employeeDirectoryTable(filteredEmployeeDirectory().slice(0, 15));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
}

function escapeHtmlAttribute(value) {
  return escapeHtml(value);
}

function filteredCourses() {
  const searchValue = String(courseSearch || "").trim().toLocaleLowerCase("vi");
  return getCourses().filter((course) => {
    const title = String(course.title || "").toLocaleLowerCase("vi");
    const description = String(course.description || "").toLocaleLowerCase("vi");
    return (!searchValue || title.includes(searchValue) || description.includes(searchValue))
      && (!courseFilterCategory || course.category === courseFilterCategory)
      && (!courseFilterStatus || course.status === courseFilterStatus);
  });
}

function courseStatusBadge(status) {
  if (status === "published") return badge("active");
  if (status === "archived") return badge("disabled");
  return badge("notStarted");
}

function courseTable(courseItems) {
  if (!courseItems.length) return `<div class="card"><p>${t("course.searchPlaceholder")}</p></div>`;
  return `<div class="table-wrap"><table><thead><tr><th>STT</th><th>${t("course.title")}</th><th>${t("course.category")}</th><th>${t("course.format")}</th><th>${t("course.duration")}</th><th>${t("course.status")}</th><th>${t("table.createdAt")}</th><th>${t("admin.action")}</th></tr></thead><tbody>${courseItems.map((course, index) => {
    const canDelete = getEnrollmentsByCourseId(course.id).length === 0;
    const duration = Number(course.durationHours);
    return `<tr><td>${index + 1}</td><td><strong>${escapeHtml(course.title || "—")}</strong></td><td>${escapeHtml(course.category || "—")}</td><td>${escapeHtml(course.format || "—")}</td><td>${Number.isFinite(duration) ? `${duration}h` : "—"}</td><td>${courseStatusBadge(course.status)}</td><td>${escapeHtml(course.createdAt || "—")}</td><td><div class="row-actions"><button type="button" class="btn btn-outline mini-action" data-course-detail="${escapeHtmlAttribute(course.id)}">${t("admin.detail")}</button><button type="button" class="btn btn-outline mini-action" data-course-edit="${escapeHtmlAttribute(course.id)}">${t("course.edit")}</button>${canDelete ? `<button type="button" class="btn btn-outline mini-action" data-course-delete="${escapeHtmlAttribute(course.id)}">${t("course.delete")}</button>` : ""}</div></td></tr>`;
  }).join("")}</tbody></table></div>`;
}

function courseDrawer() {
  const course = getCourseById(selectedCourseId);
  if (!course) return "";
  const enrollments = getEnrollmentsByCourseId(course.id);
  const content = getCourseContent(course.id);
  const contentTypeIcon = {slide:"▤",video:"▶",quiz:"?"};
  const contentRows = content.map((item,i) => `<div class="course-line" style="gap:8px;align-items:center"><span class="badge new" style="min-width:36px;text-align:center">${contentTypeIcon[item.type]||"?"}</span><div style="flex:1;min-width:0"><strong>${escapeHtml(item.title)}</strong><small>${item.type==="quiz"?t("content.quizType"):item.type==="video"?t("content.videoType"):t("content.slideType")} · ${item.required?t("content.required"):t("content.optional")} · ${item.minimumDurationSeconds||0}s min</small></div><div style="display:flex;gap:4px"><button type="button" class="btn btn-outline mini-action" data-content-move-up="${escapeHtmlAttribute(item.id)}" ${i===0?"disabled":""}>↑</button><button type="button" class="btn btn-outline mini-action" data-content-move-down="${escapeHtmlAttribute(item.id)}" ${i===content.length-1?"disabled":""}>↓</button><button type="button" class="btn btn-outline mini-action" data-content-edit="${escapeHtmlAttribute(item.id)}">${t("course.edit")}</button><button type="button" class="btn btn-outline mini-action" data-content-delete="${escapeHtmlAttribute(item.id)}">${t("course.delete")}</button></div></div>`).join("");
  const rows = [[t("course.category"), course.category], [t("course.format"), course.format], [t("course.duration"), Number.isFinite(Number(course.durationHours)) ? `${Number(course.durationHours)}h` : "—"], [t("course.status"), courseStatusBadge(course.status)], [t("table.createdAt"), course.createdAt], [t("table.createdBy"), course.createdBy]];
  return `<aside class="account-drawer open" style="width:480px;max-width:95vw"><div class="drawer-head"><div><span class="eyebrow">${t("content.courseTitle")}</span><h2>${escapeHtml(course.title)}</h2></div><button type="button" class="icon-btn" data-close-course-drawer>×</button></div><div class="profile-grid">${rows.map(([label, value]) => `<div class="profile-item"><span>${label}</span><strong>${value}</strong></div>`).join("")}</div><div class="card"><h3>${t("course.description")}</h3><p>${escapeHtml(course.description || "—")}</p></div><div class="security-actions"><button type="button" class="btn btn-primary" data-course-edit="${escapeHtmlAttribute(course.id)}">${t("content.editInfo")}</button><a class="btn btn-outline" href="/admin/assign?courseId=${encodeURIComponent(course.id)}&open=1" data-link>${t("enrollment.assign")}</a></div>
<div class="panel-head" style="margin-top:16px"><h3>${t("content.title")} (${content.length})</h3><button type="button" class="btn btn-primary" data-content-add>${t("content.add")}</button></div>${content.length ? `<div style="display:flex;flex-direction:column;gap:8px">${contentRows}</div>` : `<p style="color:var(--color-muted)">${t("content.noContent")}</p>`}
<h3 style="margin-top:16px">${t("content.enrolledEmployees")} (${enrollments.length})</h3>${enrollments.length ? `<div class="table-wrap"><table><thead><tr><th>${t("table.fullName")}</th><th>${t("table.status")}</th><th>${t("enrollment.progress")}</th></tr></thead><tbody>${enrollments.map((enrollment) => { const account = getAccountById(enrollment.accountId); const prog = calculateCourseProgress({accountId:enrollment.accountId,courseId:course.id}); return `<tr><td>${escapeHtml(account?.fullName || enrollment.accountId)}</td><td>${badge(enrollment.status)}</td><td>${prog.percent}%</td></tr>`; }).join("")}</tbody></table></div>` : `<p>${t("content.noEnrolled")}</p>`}</aside>`;
}

function contentItemForm() {
  const isEdit = contentBuilderMode === "edit";
  const item = isEdit ? getCourseContent(selectedCourseId).find(x => x.id === selectedContentId) : null;
  const type = item?.type || contentBuilderType;
  const quizzes = getQuizzes().filter(q => !q.courseId || q.courseId === selectedCourseId);
  const slideFields = `<div class="field"><label>${t("content.slideTitle")}</label><input name="slideTitle" value="${escapeHtmlAttribute(item?.slides?.[0]?.title || item?.title || "")}" required></div><div class="field"><label>${t("content.slideContent")}</label><textarea name="slideContent" rows="4">${escapeHtml(item?.slides?.[0]?.content || "")}</textarea></div><div class="field"><label>${t("content.minDuration")}</label><input name="minimumDurationSeconds" type="number" min="0" value="${item?.minimumDurationSeconds || item?.slides?.[0]?.minimumViewSeconds || 8}"></div>`;
  const videoFields = `<div class="field"><label>${t("content.sourceType")}</label><select name="sourceType" id="sourceTypeSelect"><option value="youtube" ${(item?.sourceType||"youtube")==="youtube"?"selected":""}>YouTube</option><option value="uploaded" ${item?.sourceType==="uploaded"?"selected":""}>${t("content.sourceUrl")}</option></select></div><div class="field"><label>${t("content.youtubeId")} <small>(e.g. dQw4w9WgXcQ)</small></label><input name="youtubeVideoId" value="${escapeHtmlAttribute(item?.youtubeVideoId || "")}" placeholder="Video ID"></div><div class="field"><label>${t("content.sourceUrl")}</label><input name="sourceUrl" value="${escapeHtmlAttribute(item?.sourceUrl || "")}" placeholder="https://..."></div><div class="field"><label>${t("content.transcript")}</label><textarea name="transcript" rows="3">${escapeHtml(item?.transcript || "")}</textarea></div><div class="field"><label><input type="checkbox" name="transcriptAlternativeAllowed" ${item?.transcriptAlternativeAllowed!==false?"checked":""}> ${t("content.transcriptAllowed")}</label></div><div class="field"><label>${t("content.requiredPercent")}</label><input name="requiredPercent" type="number" min="0" max="100" value="${item?.completionRule?.requiredPercent ?? 90}"></div>`;
  const quizFields = `<div class="field"><label>${t("content.selectQuiz")}</label><select name="quizId" required><option value="">—</option>${getQuizzes().map(q=>`<option value="${q.id}" ${item?.quizId===q.id?"selected":""}>${escapeHtml(q.title)}${q.courseId&&q.courseId!==selectedCourseId?" "+t("content.otherCourse"):""}</option>`).join("")}</select></div><div class="field"><label><input type="checkbox" name="requirePass" ${item?.completionRule?.requirePass!==false?"checked":""}> ${t("content.requirePass")}</label></div>`;
  return `<div class="modal-backdrop open"><form class="card modal" id="contentItemForm"><div class="modal-head"><div><span class="eyebrow">${t("content.title")}</span><h2>${isEdit?t("content.edit"):t("content.addTitle")}</h2></div><button type="button" class="icon-btn" data-content-form-close>×</button></div><div class="field"><label>${t("course.title")}</label><input name="title" value="${escapeHtmlAttribute(item?.title || "")}" required></div>${!isEdit?`<div class="field"><label>${t("content.type")}</label><select name="type"><option value="slide" ${type==="slide"?"selected":""}>${t("content.slideType")}</option><option value="video" ${type==="video"?"selected":""}>${t("content.videoType")}</option><option value="quiz" ${type==="quiz"?"selected":""}>${t("content.quizType")}</option></select></div>`:`<input type="hidden" name="type" value="${type}">`}<div class="field"><label><input type="checkbox" name="required" ${item?.required!==false?"checked":""}> ${t("content.requiredCheck")}</label></div><div class="field"><label>${t("content.weight")}</label><input name="completionWeight" type="number" min="0.1" step="0.1" value="${item?.completionWeight ?? 1}"></div><hr style="margin:12px 0;border:none;border-top:1px solid var(--color-border)"><div id="typeSpecificFields">${type==="slide"?slideFields:type==="video"?videoFields:quizFields}</div><div class="security-actions"><button type="button" class="btn btn-outline" data-content-form-close>${t("content.cancel")}</button><button type="submit" class="btn btn-primary">${t("content.save")}</button></div></form></div>`;
}

function courseFormModal() {
  const course = courseFormMode === "edit" ? getCourseById(selectedCourseId) : null;
  if (courseFormMode === "edit" && !course) return "";
  const value = (field, fallback = "") => escapeHtmlAttribute(course?.[field] ?? fallback);
  const option = (field, optionValue, fallback = "") => (course?.[field] ?? fallback) === optionValue ? "selected" : "";
  return `<div class="modal-backdrop open"><form class="card modal" id="courseForm"><div class="modal-head"><div><span class="eyebrow">Quản lý khóa học</span><h2>${courseFormMode === "edit" ? "Chỉnh sửa khóa học" : "Tạo khóa học"}</h2></div><button type="button" class="icon-btn" data-close-course-form>x</button></div><div class="field"><label>Tên khóa học</label><input name="title" type="text" value="${value("title")}" required></div><div class="field"><label>Mô tả</label><textarea name="description" rows="3">${escapeHtml(course?.description || "")}</textarea></div><div class="field"><label>Danh mục</label><select name="category">${["Kỹ năng mềm", "Chuyên môn", "Chứng chỉ", "Onboarding"].map((item) => `<option value="${escapeHtmlAttribute(item)}" ${option("category", item, "Kỹ năng mềm")}>${item}</option>`).join("")}</select></div><div class="field"><label>Hình thức</label><select name="format">${["Online", "Offline", "Hybrid"].map((item) => `<option value="${item}" ${option("format", item, "Online")}>${item}</option>`).join("")}</select></div><div class="field"><label>Thời lượng (giờ)</label><input name="durationHours" type="number" min="0" step="0.5" value="${value("durationHours", 0)}" required></div><div class="field"><label>Trạng thái</label><select name="status"><option value="draft" ${option("status", "draft", "draft")}>Bản nháp</option><option value="published" ${option("status", "published")}>Đã xuất bản</option></select></div><div class="security-actions"><button type="button" class="btn btn-outline" data-close-course-form>Hủy</button><button type="submit" class="btn btn-primary">Lưu</button></div></form></div>`;
}

function coursesPage() {
  if (!hasAdminAccess()) return restrictedPage();
  const allCourses = getCourses();
  const categories = [...new Set(allCourses.map((course) => course.category).filter(Boolean))];
  return `<div class="app-layout">${sideNav("hr")}<main class="app-main">${topbar("HR / L&D", t("course.manage"), "hr")}<div class="content"><section class="card panel"><div class="account-toolbar"><div><h2>${t("course.manage")}</h2><p>${t("course.manageDesc")}</p></div><button type="button" class="btn btn-primary" data-course-create>${t("course.create")}</button></div><div class="filter-bar"><input type="search" placeholder="${t("course.searchPlaceholder")}" value="${escapeHtmlAttribute(courseSearch)}" data-course-search><select data-course-filter-category><option value="">${t("course.allCategories")}</option>${categories.map((category) => `<option value="${escapeHtmlAttribute(category)}" ${courseFilterCategory === category ? "selected" : ""}>${escapeHtml(category)}</option>`).join("")}</select><select data-course-filter-status><option value="">${t("enrollment.allStatuses")}</option><option value="published" ${courseFilterStatus === "published" ? "selected" : ""}>${t("course.published")}</option><option value="draft" ${courseFilterStatus === "draft" ? "selected" : ""}>${t("course.draft")}</option><option value="archived" ${courseFilterStatus === "archived" ? "selected" : ""}>${t("course.archived")}</option></select></div>${courseTable(filteredCourses())}</section></div>${courseDrawerOpen ? courseDrawer() : ""}${courseFormMode ? courseFormModal() : ""}${contentBuilderMode ? contentItemForm() : ""}</main></div>`;
}

function getTodayDateString() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function getDisplayEnrollmentStatus(enrollment) {
  return enrollment.status !== "completed" && enrollment.deadline && enrollment.deadline < getTodayDateString()
    ? "overdue"
    : enrollment.status;
}

function enrichedEnrollments() {
  return getEnrollments().map((enrollment) => { const computed=calculateCourseProgress({accountId:enrollment.accountId,courseId:enrollment.courseId}); const derived={...enrollment,progressPercent:computed.percent,status:computed.completed?"completed":computed.percent?"inProgress":"notStarted"}; return ({
    ...derived,
    displayStatus: computed.pendingGrading ? "pending" : getDisplayEnrollmentStatus(derived),
    course: getCourseById(enrollment.courseId),
    account: getAccountById(enrollment.accountId),
  });});
}

function filteredAssignments() {
  const searchValue = String(assignSearch || "").trim().toLocaleLowerCase("vi");
  return enrichedEnrollments().filter((row) => {
    const employeeName = String(row.account?.fullName || row.account?.name || "").toLocaleLowerCase("vi");
    const email = String(row.account?.email || "").toLocaleLowerCase("vi");
    const courseTitle = String(row.course?.title || "").toLocaleLowerCase("vi");
    return (!searchValue || employeeName.includes(searchValue) || email.includes(searchValue) || courseTitle.includes(searchValue))
      && (!assignCourseId || row.courseId === assignCourseId)
      && (!assignFilterDept || row.account?.department === assignFilterDept)
      && (!assignFilterStatus || row.displayStatus === assignFilterStatus);
  });
}

function enrollmentTable(rows) {
  if (!rows.length) return `<div class="card"><p>${t("enrollment.noResults")}</p></div>`;
  return `<div class="table-wrap"><table><thead><tr><th>STT</th><th>${t("enrollment.employee")}</th><th>${t("table.department")}</th><th>${t("enrollment.course")}</th><th>${t("enrollment.assignedDate")}</th><th>${t("enrollment.deadline")}</th><th>${t("table.status")}</th><th>${t("enrollment.progress")}</th><th>${t("admin.action")}</th></tr></thead><tbody>${rows.map((row, index) => {
    const progressValue = Number(row.progressPercent);
    const safeProgress = Number.isFinite(progressValue) ? Math.min(100, Math.max(0, progressValue)) : 0;
    const signals=getLearningActivity({accountId:row.accountId,courseId:row.courseId}).filter(x=>["rapid_advance_attempt","tab_hidden","invalid_seek"].includes(x.eventType)).length;
    return `<tr><td>${index + 1}</td><td><strong>${escapeHtml(row.account?.fullName || row.account?.name || row.accountId)}</strong><br>${escapeHtml(row.account?.email || "")}</td><td>${escapeHtml(row.account?.department || "—")}</td><td>${escapeHtml(row.course?.title || t("enrollment.courseDeleted"))}</td><td>${escapeHtml(row.assignedAt || "—")}</td><td>${escapeHtml(row.deadline || "—")}</td><td>${badge(signals>2?"follow":row.displayStatus)}${signals?`<small>${signals} ${t("enrollment.signals")}</small>`:""}</td><td>${safeProgress}%${progress(safeProgress)}</td><td><div class="row-actions"><button type="button" class="btn btn-outline mini-action" data-view-learning-log="${escapeHtmlAttribute(row.id)}">${t("enrollment.learningLog")}</button><button type="button" class="btn btn-outline mini-action" data-reset-learning="${escapeHtmlAttribute(row.id)}">${t("enrollment.resetProgress")}</button><button type="button" class="btn btn-outline mini-action" data-remove-enrollment="${escapeHtmlAttribute(row.id)}">${t("enrollment.cancel")}</button></div></td></tr>`;
  }).join("")}</tbody></table></div>`;
}

function getDefaultAssignmentDeadline() {
  const date = new Date();
  date.setDate(date.getDate() + 60);
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function assignModal() {
  const accounts = getAccounts()
    .filter((account) => account.role === "employee" && account.accountStatus !== "disabled")
    .sort((a, b) => String(a.fullName || "").localeCompare(String(b.fullName || ""), "vi", { sensitivity: "base" }));
  const publishedCourses = getCourses()
    .filter((course) => course.status === "published")
    .sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""), "vi", { sensitivity: "base" }));
  const selectedCourseId = assignTargetCourseId || assignCourseId;
  const departments = [...new Set(accounts.map((a) => a.department).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"vi"));
  const visible = accounts.filter((a) => (!bulkEmployeeSearch || `${a.fullName} ${a.email}`.toLowerCase().includes(bulkEmployeeSearch.toLowerCase())) && (!bulkDepartmentFilter || a.department === bulkDepartmentFilter));
  const picker = assignMethod === "excel" ? `<div class="field"><label>${t("bulkAssign.uploadFile")}</label><input type="file" accept=".xls,.xlsx" data-bulk-excel></div>${excelPreviewRows.length ? bulkPreviewTable(excelPreviewRows) : ""}` : `<div class="filter-bar"><input type="search" value="${escapeHtmlAttribute(bulkEmployeeSearch)}" placeholder="${t("admin.search")}" data-bulk-search><select data-bulk-department><option value="">${t("bulkAssign.selectDepartments")}</option>${departments.map(d=>`<option ${bulkDepartmentFilter===d?"selected":""}>${escapeHtml(d)} (${accounts.filter(a=>a.department===d).length})</option>`).join("")}</select></div><div class="security-actions"><button type="button" class="btn btn-outline mini-action" data-select-visible>${t("bulkAssign.selectEmployees")}</button><button type="button" class="btn btn-outline mini-action" data-clear-bulk>${t("bulkAssign.noSelection")}</button></div><div class="table-wrap"><table><thead><tr><th></th><th>${t("table.fullName")}</th><th>${t("table.email")}</th><th>${t("table.department")}</th></tr></thead><tbody>${visible.map(a=>`<tr><td><input type="checkbox" aria-label="${escapeHtmlAttribute(a.fullName)}" data-bulk-account="${a.id}" ${bulkSelectedAccountIds.includes(a.id)?"checked":""}></td><td>${escapeHtml(a.fullName)}</td><td>${escapeHtml(a.email)}</td><td>${escapeHtml(a.department||"")}</td></tr>`).join("")}</tbody></table></div>`;
  return `<div class="modal-backdrop open"><form class="card modal" id="assignForm"><div class="modal-head"><div><span class="eyebrow">HR / L&D</span><h2>${t("bulkAssign.title")}</h2></div><button type="button" class="icon-btn" aria-label="Close" data-close-assign-modal>×</button></div><div class="detail-tabs" role="tablist">${[["individual","individual"],["department","department"],["excel","excel"]].map(([v,k])=>`<button type="button" class="${assignMethod===v?"active":""}" data-assign-method="${v}" aria-selected="${assignMethod===v}">${t(`bulkAssign.${k}`)}</button>`).join("")}</div><div class="field"><label>${t("bulkAssign.selectCourse")}</label><select name="courseId" required><option value="">${t("bulkAssign.selectCourse")}</option>${publishedCourses.map(c=>`<option value="${c.id}" ${selectedCourseId===c.id?"selected":""}>${escapeHtml(c.title)}</option>`).join("")}</select></div>${picker}<p><strong>${t("bulkAssign.selectedCount")}: ${bulkSelectedAccountIds.length}</strong></p><div class="field"><label>${t("enrollment.deadline")}</label><input name="deadline" type="date" value="${getDefaultAssignmentDeadline()}" required></div><div class="field"><label>${t("table.note")}</label><textarea name="note" rows="3"></textarea></div><div class="security-actions"><button type="button" class="btn btn-outline" data-close-assign-modal>Hủy</button><button type="submit" class="btn btn-primary">${t("bulkAssign.confirm")}</button></div></form></div>`;
}

function bulkPreviewTable(rows) { return `<div class="table-wrap"><table><thead><tr><th>STT</th><th>${t("table.email")}</th><th>${t("table.fullName")}</th><th>${t("table.department")}</th><th>${t("table.status")}</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${i+1}</td><td>${escapeHtml(r.email||r.employeeCode||"")}</td><td>${escapeHtml(r.account?.fullName||r.name||"")}</td><td>${escapeHtml(r.account?.department||r.department||"")}</td><td>${r.valid?t("bulkAssign.validRows"):t(`bulkAssign.${r.reason||"unmatched"}`)}</td></tr>`).join("")}</tbody></table></div>`; }

function assignCourseToAccounts({ courseId, accountIds, assignedBy, deadline, note }) {
  const summary = { totalSelected: new Set(accountIds).size, assigned: 0, duplicates: 0, invalid: 0, failed: 0 };
  if (!getCourseById(courseId) || !deadline || deadline < getTodayDateString()) { summary.invalid = summary.totalSelected; return summary; }
  [...new Set(accountIds)].forEach((accountId) => { const a=getAccountById(accountId); if(a?.role!=="employee"||a.accountStatus==="disabled") return summary.invalid++; const r=assignCourse({courseId,accountId,assignedBy,deadline,note}); if(r.ok) summary.assigned++; else if(r.reason==="duplicate") summary.duplicates++; else summary.failed++; });
  return summary;
}

function quizStatusBadge(value) { return `<span class="badge ${value === "published" ? "learning" : value === "archived" ? "new" : "pending"}">${t(`course.${value}`)}</span>`; }

function adminQuizzesPage() {
  if (!hasAdminAccess()) return restrictedPage();
  const quizzes=getQuizzes().filter(q=>(!quizSearch||q.title.toLowerCase().includes(quizSearch.toLowerCase()))&&(!quizCourseFilter||q.courseId===quizCourseFilter)&&(!quizStatusFilter||q.status===quizStatusFilter)); const attempts=getQuizAttempts().filter(a=>a.submittedAt);
  const avg=attempts.length?Math.round(attempts.reduce((s,a)=>s+(a.scorePercent||0),0)/attempts.length):0; const pass=attempts.length?Math.round(attempts.filter(a=>a.passed).length/attempts.length*100):0;
  return `<div class="app-layout">${sideNav("hr")}<main class="app-main">${topbar("HR / L&D",t("quiz.quizzes"),"hr")}<div class="content"><div class="kpi-grid"><div class="card kpi"><span>${t("quiz.quizzes")}</span><strong>${quizzes.length}</strong></div><div class="card kpi"><span>${t("quiz.employeesCompleted")}</span><strong>${new Set(attempts.map(a=>a.accountId)).size}</strong></div><div class="card kpi"><span>${t("quiz.averageScore")}</span><strong>${avg}%</strong></div><div class="card kpi"><span>${t("quiz.passRate")}</span><strong>${pass}%</strong></div></div><div class="detail-tabs"><button class="${quizAdminView==="list"?"active":""}" data-quiz-admin-view="list">${t("quiz.quizzes")}</button><button class="${quizAdminView==="results"?"active":""}" data-quiz-admin-view="results">${t("quiz.result")}</button><button class="${quizAdminView==="leaderboard"?"active":""}" data-quiz-admin-view="leaderboard">${t("quiz.leaderboard")}</button><button class="${quizAdminView==="analytics"?"active":""}" data-quiz-admin-view="analytics">${t("quiz.analytics")}</button></div>${quizAdminView==="list"?`<section class="card panel"><div class="panel-head"><h3>${t("quiz.quizzes")}</h3><button class="btn btn-primary" data-quiz-create>${t("quiz.create")}</button></div><div class="filter-bar"><input data-quiz-search placeholder="${t("admin.search")}" value="${escapeHtmlAttribute(quizSearch)}"><select data-quiz-course-filter><option value="">${t("nav.courses")}</option>${getCourses().map(c=>`<option value="${c.id}" ${quizCourseFilter===c.id?"selected":""}>${escapeHtml(c.title)}</option>`).join("")}</select><select data-quiz-status-filter><option value="">${t("course.status")}</option>${["draft","published","archived"].map(s=>`<option value="${s}" ${quizStatusFilter===s?"selected":""}>${t(`course.${s}`)}</option>`).join("")}</select></div>${quizzes.length?`<div class="table-wrap"><table><thead><tr><th>${t("quiz.title")}</th><th>${t("nav.courses")}</th><th>${t("course.status")}</th><th>${t("quiz.questions")}</th><th>${t("admin.action")}</th></tr></thead><tbody>${quizzes.map(q=>`<tr><td><strong>${escapeHtml(q.title)}</strong></td><td>${escapeHtml(getCourseById(q.courseId)?.title||"")}</td><td>${quizStatusBadge(q.status)}</td><td>${q.questions.length}</td><td><button class="btn btn-outline mini-action" data-quiz-edit="${q.id}">${t("quiz.edit")}</button><button class="btn btn-outline mini-action" data-quiz-delete="${q.id}">${t("quiz.delete")}</button></td></tr>`).join("")}</tbody></table></div>`:`<div class="empty-state"><h3>${t("quiz.noQuiz")}</h3></div>`}</section>`:quizAdminView==="results"?quizResultsPanel(attempts):quizAdminView==="leaderboard"?quizLeaderboard(attempts):quizAnalytics(attempts)}</div>${quizFormOpen?quizForm():""}</main></div>`;
}

function quizResultsPanel(attempts){return `<section class="card panel"><div class="panel-head"><h3>${t("quiz.result")}</h3><button class="btn btn-outline" data-quiz-export>${t("quiz.exportCsv")}</button></div><div class="table-wrap"><table><thead><tr><th>${t("table.fullName")}</th><th>${t("quiz.title")}</th><th>${t("quiz.score")}</th><th>${t("quiz.result")}</th><th>${t("admin.action")}</th></tr></thead><tbody>${attempts.map(a=>`<tr><td>${escapeHtml(getAccountById(a.accountId)?.fullName||"")}</td><td>${escapeHtml(getQuizById(a.quizId)?.title||"")}</td><td>${a.scorePercent}%</td><td>${t(a.gradingStatus==="pendingManual"?"quiz.pendingGrading":a.passed?"quiz.passed":"quiz.failed")}</td><td>${a.gradingStatus==="pendingManual"?`<button class="btn btn-outline mini-action" data-grade-attempt="${a.id}">${t("quiz.manualGrade")}</button>`:""}</td></tr>`).join("")}</tbody></table></div></section>`;}
function quizLeaderboard(attempts){const best=new Map();attempts.filter(a=>a.gradingStatus==="graded").forEach(a=>{const old=best.get(a.accountId);if(!old||a.scorePercent>old.scorePercent||(a.scorePercent===old.scorePercent&&a.durationSeconds<old.durationSeconds))best.set(a.accountId,a)});const rows=[...best.values()].sort((a,b)=>b.scorePercent-a.scorePercent||a.durationSeconds-b.durationSeconds);return `<section class="card panel"><h3>${t("quiz.leaderboard")}</h3><div class="table-wrap"><table><thead><tr><th>#</th><th>${t("table.fullName")}</th><th>${t("quiz.score")}</th><th>${t("quiz.duration")}</th></tr></thead><tbody>${rows.map((a,i)=>`<tr><td>${i+1}</td><td>${escapeHtml(getAccountById(a.accountId)?.fullName||"")}</td><td>${a.scorePercent}%</td><td>${a.durationSeconds}s</td></tr>`).join("")}</tbody></table></div></section>`;}
function quizAnalytics(attempts){const rows=[];getQuizzes().forEach(q=>q.questions.forEach(question=>{const answers=attempts.filter(a=>a.quizId===q.id).map(a=>a.answers.find(x=>x.questionId===question.id)).filter(Boolean);const graded=answers.filter(a=>typeof a.isCorrect==="boolean");rows.push({text:question.text,total:answers.length,rate:graded.length?Math.round(graded.filter(a=>a.isCorrect).length/graded.length*100):0});}));const ranked=rows.filter(r=>r.total).sort((a,b)=>a.rate-b.rate);return `<section class="card panel"><h3>${t("quiz.analytics")}</h3>${ranked.length?`<p><strong>${t("quiz.hardestQuestion")}:</strong> ${escapeHtml(ranked[0].text)} · <strong>${t("quiz.easiestQuestion")}:</strong> ${escapeHtml(ranked[ranked.length-1].text)}</p>`:""}<div class="table-wrap"><table><thead><tr><th>${t("quiz.question")}</th><th>${t("quiz.responses")}</th><th>${t("quiz.correctRate")}</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${escapeHtml(r.text)}</td><td>${r.total}</td><td>${r.rate}%</td></tr>`).join("")}</tbody></table></div></section>`;}

function quizForm() {
  const q=selectedQuizId?getQuizById(selectedQuizId):null;
  return `<div class="modal-backdrop open"><form class="card modal" id="quizForm"><div class="modal-head"><h2>${q?t("quiz.edit"):t("quiz.create")}</h2><button type="button" class="icon-btn" aria-label="${t("quiz.close")}" data-quiz-close>×</button></div><div class="field"><label>${t("quiz.title")}</label><input name="title" required value="${escapeHtmlAttribute(q?.title||"")}"></div><div class="field"><label>${t("nav.courses")}</label><select name="courseId" required>${getCourses().map(c=>`<option value="${c.id}" ${q?.courseId===c.id?"selected":""}>${escapeHtml(c.title)}</option>`).join("")}</select></div><div class="field"><label>${t("course.description")}</label><textarea name="description">${escapeHtml(q?.description||"")}</textarea></div><div class="profile-grid"><div class="field"><label>${t("quiz.passingScore")}</label><input name="passingScore" type="number" min="0" max="100" value="${q?.passingScore??70}" required></div><div class="field"><label>${t("quiz.timeLimit")}</label><input name="timeLimitMinutes" type="number" min="1" value="${q?.timeLimitMinutes??20}" required></div><div class="field"><label>${t("quiz.attemptsAllowed")}</label><input name="attemptsAllowed" type="number" min="1" value="${q?.attemptsAllowed??2}" required></div><div class="field"><label>${t("course.status")}</label><select name="status"><option value="draft">${t("course.draft")}</option><option value="published" ${q?.status==="published"?"selected":""}>${t("course.published")}</option><option value="archived" ${q?.status==="archived"?"selected":""}>${t("course.archived")}</option></select></div></div><label><input type="checkbox" name="requireCourseCompletion" ${q?.requireCourseCompletion?"checked":""}> ${t("quiz.requireCourseCompletion")}</label><div class="field"><label>${t("quiz.prerequisite")}</label><select name="prerequisiteQuizId"><option value="">—</option>${getQuizzes().filter(x=>x.id!==q?.id).map(x=>`<option value="${x.id}" ${q?.prerequisiteQuizId===x.id?"selected":""}>${escapeHtml(x.title)}</option>`).join("")}</select></div><div class="panel-head"><h3>${t("quiz.questions")}</h3><button type="button" class="btn btn-outline" data-add-question>${t("quiz.addQuestion")}</button></div>${quizBuilderQuestions.map(questionEditor).join("")}<details class="card"><summary>${t("quiz.importJson")}</summary><div class="field"><label>${t("quiz.jsonData")}</label><textarea rows="6" data-quiz-json></textarea></div><button type="button" class="btn btn-outline" data-import-quiz-json>${t("quiz.validateImport")}</button></details><button class="btn btn-primary" type="submit">${t("changePassword.submit")}</button></form></div>`;
}

function questionEditor(question,index){const options=question.options||[];return `<fieldset class="card" data-question-index="${index}"><legend>${index+1}. ${t("quiz.question")}</legend><div class="field"><label>${t("quiz.question")}</label><input data-q-field="text" value="${escapeHtmlAttribute(question.text||"")}" required></div><div class="profile-grid"><div class="field"><label>${t("quiz.questionType")}</label><select data-q-field="type">${[["singleChoice","quiz.singleChoice"],["multipleChoice","quiz.multipleChoice"],["trueFalse","quiz.trueFalse"],["text","quiz.essay"]].map(([v,k])=>`<option value="${v}" ${question.type===v?"selected":""}>${t(k)}</option>`).join("")}</select></div><div class="field"><label>${t("quiz.points")}</label><input data-q-field="points" type="number" min="0.1" step="0.1" value="${question.points||1}"></div></div>${question.type==="text"?"":`<div class="field"><label>${t("quiz.options")}</label><textarea data-q-field="options" rows="3">${escapeHtml(options.map(o=>o.text).join("\n"))}</textarea></div><div class="field"><label>${t("quiz.correctAnswer")}</label><input data-q-field="correct" value="${escapeHtmlAttribute(question.type==="multipleChoice"?(question.correctOptionIds||[]).map(id=>options.findIndex(o=>o.id===id)+1).join(","):String(Math.max(1,options.findIndex(o=>o.id===question.correctOptionId)+1)))}" placeholder="1${question.type==="multipleChoice"?",2":""}"></div>`}<div class="field"><label>${t("quiz.explanation")}</label><textarea data-q-field="explanation">${escapeHtml(question.explanation||"")}</textarea></div><button type="button" class="btn btn-outline mini-action" data-remove-question="${index}">${t("quiz.delete")}</button></fieldset>`;}

function readQuestionEditors(){return [...document.querySelectorAll("[data-question-index]")].map((el,index)=>{const get=n=>el.querySelector(`[data-q-field="${n}"]`)?.value||"";const type=get("type");const id=quizBuilderQuestions[index]?.id||`question-${Date.now()}-${index}`;const texts=type==="text"?[]:type==="trueFalse"?[t("quiz.trueLabel"),t("quiz.falseLabel")]:get("options").split("\n").map(x=>x.trim()).filter(Boolean);const options=texts.map((text,i)=>({id:`${id}-option-${i+1}`,text}));const correct=get("correct").split(",").map(x=>Number(x.trim())-1).filter(i=>i>=0&&i<options.length).map(i=>options[i].id);return{id,text:get("text").trim(),type,options,correctOptionId:type==="multipleChoice"||type==="text"?undefined:correct[0],correctOptionIds:type==="multipleChoice"?correct:undefined,explanation:get("explanation").trim(),points:Number(get("points"))};});}

function employeeQuizzesPage() {
  if (!hasEmployeeAccess()) return session?restrictedPage():loginPage();
  if(activeQuizAttempt) return quizAttemptPage(); if(quizLastResult)return quizResultPage(); const enrollments=getEnrollmentsByAccountId(session.accountId); const courseIds=new Set(enrollments.map(e=>e.courseId)); const quizzes=getQuizzes().filter(q=>q.status==="published"&&courseIds.has(q.courseId)); const attempts=getQuizAttemptsByAccountId(session.accountId);
  return `<div class="app-layout">${sideNav("employee")}<main class="app-main">${topbar(t("roles.employee"),t("quiz.title"),"employee")}<div class="content"><section class="card panel"><h2>${t("quiz.title")}</h2>${quizzes.length?`<div class="stats-grid">${quizzes.map(q=>{const own=attempts.filter(a=>a.quizId===q.id&&a.submittedAt);const best=Math.max(0,...own.map(a=>a.scorePercent||0));const allowed=canStartQuiz({quizId:q.id,accountId:session.accountId});return `<article class="card panel"><h3>${escapeHtml(q.title)}</h3><p>${escapeHtml(q.description||"")}</p><p>${t("quiz.timeLimit")}: ${q.timeLimitMinutes} min · ${t("quiz.passingScore")}: ${q.passingScore}%</p><p>${t("quiz.attemptHistory")}: ${own.length}/${q.attemptsAllowed} · ${t("quiz.remainingAttempts")}: ${Math.max(0,q.attemptsAllowed-own.length)} · ${t("quiz.score")}: ${best}%</p>${!allowed.ok?`<p class="badge pending">${t(`quiz.${allowed.reason}`)}</p>`:""}<button class="btn btn-primary" data-quiz-start="${q.id}" ${!allowed.ok?"disabled":""}>${own.length?t("quiz.retake"):t("quiz.start")}</button></article>`;}).join("")}</div>`:`<div class="empty-state"><h3>${t("quiz.noQuiz")}</h3></div>`}</section></div></main></div>`;
}

function quizAttemptPage() { const quiz=activeQuizAttempt.quiz;const q=quiz.questions[quizCurrentQuestion];const answered=new Set(Object.keys(quizAnswers).filter(k=>quizAnswers[k]&&(!Array.isArray(quizAnswers[k])||quizAnswers[k].length)));return `<div class="app-layout">${sideNav("employee")}<main class="app-main">${topbar(t("quiz.title"),escapeHtml(quiz.title),"employee")}<div class="content"><form class="card panel" id="quizAttemptForm"><div class="panel-head"><strong class="${quizSecondsRemaining<=60?"badge pending":""}" data-quiz-timer>${formatQuizTime(quizSecondsRemaining)}</strong><button type="button" class="btn btn-outline" data-bookmark-question>${quizBookmarks.includes(q.id)?"★":"☆"} ${t("quiz.bookmark")}</button></div><div class="detail-tabs" aria-label="${t("quiz.questionNavigation")}">${quiz.questions.map((x,i)=>`<button type="button" class="${i===quizCurrentQuestion?"active":""}" data-question-nav="${i}" aria-label="${t("quiz.question")} ${i+1}">${quizBookmarks.includes(x.id)?"★ ":""}${i+1}${answered.has(x.id)?" ✓":""}</button>`).join("")}</div>${renderAttemptQuestion(q,quizCurrentQuestion)}<div class="security-actions"><button type="button" class="btn btn-outline" data-question-prev ${quizCurrentQuestion===0?"disabled":""}>${t("quiz.previous")}</button><button type="button" class="btn btn-outline" data-question-next ${quizCurrentQuestion===quiz.questions.length-1?"disabled":""}>${t("quiz.next")}</button><button class="btn btn-primary" type="submit">${t("quiz.submit")}</button></div></form></div></main></div>`; }
function renderAttemptQuestion(q,index){const value=quizAnswers[q.id];if(q.type==="text")return `<fieldset class="card"><legend>${index+1}. ${escapeHtml(q.text)}</legend><textarea rows="6" data-answer-text="${q.id}">${escapeHtml(value||"")}</textarea></fieldset>`;return `<fieldset class="card"><legend>${index+1}. ${escapeHtml(q.text)}</legend>${q.options.map(o=>`<label class="task"><input type="${q.type==="multipleChoice"?"checkbox":"radio"}" name="${q.id}" value="${o.id}" data-answer-option="${q.id}" ${Array.isArray(value)?value.includes(o.id)?"checked":"":value===o.id?"checked":""}> ${escapeHtml(o.text)}</label>`).join("")}</fieldset>`;}
function formatQuizTime(seconds){const safe=Math.max(0,seconds);return `${String(Math.floor(safe/60)).padStart(2,"0")}:${String(safe%60).padStart(2,"0")}`;}
function quizResultPage(){const result=quizLastResult;const quiz=getQuizById(result.quizId);const optionText=(q,id)=>q.options?.find(o=>o.id===id)?.text||id||"";return `<div class="app-layout">${sideNav("employee")}<main class="app-main">${topbar(t("quiz.result"),escapeHtml(quiz?.title||""),"employee")}<div class="content"><section class="card panel"><h2>${t(result.gradingStatus==="pendingManual"?"quiz.pendingGrading":result.passed?"quiz.passed":"quiz.failed")}</h2><div class="kpi-grid"><div class="card kpi"><span>${t("quiz.score")}</span><strong>${result.scorePercent}%</strong></div><div class="card kpi"><span>${t("quiz.correctCount")}</span><strong>${result.correctCount}/${result.totalQuestions}</strong></div></div>${quiz?.questions.map(q=>{const a=result.answers.find(x=>x.questionId===q.id);const given=a?.textAnswer||optionText(q,a?.selectedOptionId)||(a?.selectedOptionIds||[]).map(id=>optionText(q,id)).join(", ")||"—";const correct=q.type==="multipleChoice"?(q.correctOptionIds||[]).map(id=>optionText(q,id)).join(", "):optionText(q,q.correctOptionId);return `<article class="card"><h3>${escapeHtml(q.text)}</h3><p>${t("quiz.answer")}: ${escapeHtml(given)}</p>${q.type!=="text"?`<p>${t("quiz.correctAnswer")}: ${escapeHtml(correct)}</p><p>${escapeHtml(q.explanation||"")}</p>`:""}</article>`;}).join("")||""}<button class="btn btn-primary" data-quiz-result-close>${t("quiz.quizzes")}</button></section></div></main></div>`;}
function captureQuizAnswer(){if(!activeQuizAttempt)return;const q=activeQuizAttempt.quiz.questions[quizCurrentQuestion];if(q.type==="text")quizAnswers[q.id]=document.querySelector(`[data-answer-text="${q.id}"]`)?.value||"";else{const selected=[...document.querySelectorAll(`[data-answer-option="${q.id}"]:checked`)].map(el=>el.value);quizAnswers[q.id]=q.type==="multipleChoice"?selected:selected[0]||"";}persistQuizDraft();}
function persistQuizDraft(){if(!activeQuizAttempt||!session?.accountId)return;saveQuizAttemptProgress({attemptId:activeQuizAttempt.id,accountId:session.accountId,answers:activeQuizAttempt.quiz.questions.map(q=>({questionId:q.id,...(q.type==="text"?{textAnswer:String(quizAnswers[q.id]||"")} : q.type==="multipleChoice"?{selectedOptionIds:quizAnswers[q.id]||[]}:{selectedOptionId:String(quizAnswers[q.id]||"")})})),bookmarks:quizBookmarks});}
function finishQuizAttempt(){if(!activeQuizAttempt||!hasEmployeeAccess())return;clearInterval(quizTimerId);quizTimerId=null;const answers=activeQuizAttempt.quiz.questions.map(q=>({questionId:q.id,...(q.type==="text"?{textAnswer:String(quizAnswers[q.id]||"")} : q.type==="multipleChoice"?{selectedOptionIds:quizAnswers[q.id]||[]}:{selectedOptionId:String(quizAnswers[q.id]||"")})}));const result=submitQuizAttempt({attemptId:activeQuizAttempt.id,accountId:session.accountId,answers});if(!result)return toast("error");const item=getCourseContent(result.courseId).find(x=>x.quizId===result.quizId);if(item)saveContentProgress({accountId:session.accountId,courseId:result.courseId,contentId:item.id,contentType:"quiz",completionPercent:result.passed?100:0,completed:result.passed===true,metadata:{attemptId:result.id,gradingStatus:result.gradingStatus}});activeQuizAttempt=null;quizLastResult=result;render();}
function startQuizCountdown(){if(!activeQuizAttempt||quizTimerId)return;quizTimerId=setInterval(()=>{quizSecondsRemaining--;const el=document.querySelector("[data-quiz-timer]");if(el){el.textContent=formatQuizTime(quizSecondsRemaining);if(quizSecondsRemaining<=60)el.classList.add("badge","pending");}if(quizSecondsRemaining===60)toast(t("quiz.timerWarning"));if(quizSecondsRemaining<=0)finishQuizAttempt();},1000);}
function exportQuizCsv(){const rows=getQuizAttempts().filter(a=>a.submittedAt).map(a=>[getAccountById(a.accountId)?.fullName||"",getAccountById(a.accountId)?.email||"",getQuizById(a.quizId)?.title||"",a.attemptNumber,a.scorePercent,a.gradingStatus,a.passed===null?t("quiz.pendingGrading"):t(a.passed?"quiz.passed":"quiz.failed"),a.submittedAt]);const csv="\uFEFF"+[[t("table.fullName"),t("table.email"),t("quiz.title"),t("quiz.attemptHistory"),t("quiz.score"),t("quiz.result"),t("table.status"),t("table.createdAt")],...rows].map(row=>row.map(value=>`"${String(value??"").replaceAll('"','""')}"`).join(",")).join("\r\n");const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));const link=document.createElement("a");link.href=url;link.download="quiz-results.csv";link.click();URL.revokeObjectURL(url);}

function assignPage() {
  if (!hasAdminAccess()) return restrictedPage();
  const allEnrollments = enrichedEnrollments();
  const allCourses = getCourses();
  const allAccounts = getAccounts().filter((account) => account.role === "employee");
  const departments = [...new Set(allAccounts.map((account) => account.department).filter(Boolean))].sort((a, b) => a.localeCompare(b, "vi", { sensitivity: "base" }));
  const selectedCourse = assignCourseId ? getCourseById(assignCourseId) : null;
  const completed = allEnrollments.filter((item) => item.displayStatus === "completed").length;
  const inProgress = allEnrollments.filter((item) => item.displayStatus === "inProgress").length;
  const overdue = allEnrollments.filter((item) => item.displayStatus === "overdue").length;
  const completionRate = allEnrollments.length ? Math.round((completed / allEnrollments.length) * 100) : 0;
  return `<div class="app-layout">${sideNav("hr")}<main class="app-main">${topbar("HR / L&D", t("enrollment.assign"), "hr")}<div class="content"><section class="card panel"><div class="account-toolbar"><div><h2>${t("enrollment.assign")}</h2><p>${t("enrollment.description")}</p></div><button type="button" class="btn btn-primary" data-assign-new>${t("enrollment.assign")}</button></div>${selectedCourse ? `<div class="card"><strong>${t("enrollment.filteringByCourse")}:</strong> ${escapeHtml(selectedCourse.title)} <button type="button" class="btn btn-outline mini-action" data-clear-assign-course>${t("enrollment.clearFilter")}</button></div>` : ""}<div class="kpi-grid"><div class="card kpi"><span>${t("enrollment.totalAssigned")}</span><strong>${allEnrollments.length}</strong></div><div class="card kpi"><span>${t("status.completed")}</span><strong>${completed}</strong>${progress(completionRate)}</div><div class="card kpi"><span>${t("status.inProgress")}</span><strong>${inProgress}</strong></div><div class="card kpi"><span>${t("status.overdue")}</span><strong>${overdue}</strong></div></div><div class="filter-bar"><input type="search" placeholder="${t("enrollment.searchPlaceholder")}" value="${escapeHtmlAttribute(assignSearch)}" data-assign-search><select data-assign-filter-course><option value="">${t("enrollment.allCourses")}</option>${allCourses.map((course) => `<option value="${escapeHtmlAttribute(course.id)}" ${assignCourseId === course.id ? "selected" : ""}>${escapeHtml(course.title || course.id)}</option>`).join("")}</select><select data-assign-filter-dept><option value="">${t("enrollment.allDepts")}</option>${departments.map((department) => `<option value="${escapeHtmlAttribute(department)}" ${assignFilterDept === department ? "selected" : ""}>${escapeHtml(department)}</option>`).join("")}</select><select data-assign-filter-status><option value="">${t("enrollment.allStatuses")}</option><option value="notStarted" ${assignFilterStatus === "notStarted" ? "selected" : ""}>${t("status.notStarted")}</option><option value="inProgress" ${assignFilterStatus === "inProgress" ? "selected" : ""}>${t("status.inProgress")}</option><option value="completed" ${assignFilterStatus === "completed" ? "selected" : ""}>${t("status.completed")}</option><option value="overdue" ${assignFilterStatus === "overdue" ? "selected" : ""}>${t("status.overdue")}</option></select></div>${enrollmentTable(filteredAssignments())}</section></div>${assignModalOpen ? assignModal() : ""}</main></div>`;
}

function reportsPage() {
  if (!hasAdminAccess()) return restrictedPage();
  const enrollments=enrichedEnrollments().filter(e=>e.account?.role==="employee"); const attempts=getQuizAttempts(); const completed=enrollments.filter(e=>e.status==="completed").length; const overdue=enrollments.filter(e=>e.displayStatus==="overdue").length; const completion=enrollments.length?Math.round(completed/enrollments.length*100):0; const pass=attempts.length?Math.round(attempts.filter(a=>a.passed).length/attempts.length*100):0;
  return `<div class="app-layout">${sideNav("hr")}<main class="app-main">${topbar("HR/L&D Analytics", t("admin.reports"), "hr")}<div class="content"><div class="kpi-grid"><div class="card kpi"><span>${t("bulkAssign.selectedCount")}</span><strong>${new Set(enrollments.map(e=>e.accountId)).size}</strong></div><div class="card kpi"><span>${t("status.completed")}</span><strong>${completion}%</strong></div><div class="card kpi"><span>${t("status.overdue")}</span><strong>${overdue}</strong></div><div class="card kpi"><span>${t("quiz.passRate")}</span><strong>${pass}%</strong></div></div><section class="card panel"><h3>${t("quiz.attemptHistory")}</h3>${attempts.length?`<div class="table-wrap"><table><thead><tr><th>${t("table.fullName")}</th><th>${t("nav.courses")}</th><th>${t("quiz.score")}</th><th>${t("quiz.result")}</th><th>${t("table.createdAt")}</th></tr></thead><tbody>${attempts.map(a=>`<tr><td>${escapeHtml(getAccountById(a.accountId)?.fullName||"")}</td><td>${escapeHtml(getCourseById(a.courseId)?.title||"")}</td><td>${a.scorePercent??"—"}%</td><td>${a.submittedAt?t(a.passed?"quiz.passed":"quiz.failed"):"—"}</td><td>${escapeHtml(a.submittedAt||a.startedAt)}</td></tr>`).join("")}</tbody></table></div>`:`<div class="empty-state"><p>${t("quiz.noQuiz")}</p></div>`}</section></div></main></div>`;
}

function changePasswordPage() {
  const account = session?.accountId ? getAccountById(session.accountId) : null;
  const passwordPolicyText = {
    vi: "Tối thiểu 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt. Không được trùng mật khẩu cũ.",
    en: "At least 8 characters with uppercase, lowercase, number and special character. Cannot be the same as the old password.",
    kr: "대문자, 소문자, 숫자, 특수문자를 포함하여 최소 8자. 이전 비밀번호와 동일할 수 없습니다.",
  }[language] || "Tối thiểu 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt. Không được trùng mật khẩu cũ.";
  return `<main class="auth-page"><section class="auth-panel">${brand()}<div class="auth-copy"><h1>${t("changePassword.title")}</h1><p>${account?.fullName || ""}</p></div></section><section class="auth-visual"><form class="card login-card" id="changePasswordForm"><div class="login-card-head">${brand()}${languageSwitcher()}</div><h2>${t("changePassword.title")}</h2><div class="field"><label>${t("changePassword.current")}</label><input name="current" type="password"></div><div class="field"><label>${t("changePassword.next")}</label><input name="next" type="password"></div><div class="field"><label>${t("changePassword.confirm")}</label><input name="confirm" type="password"></div><div class="policy-card"><strong>${t("changePassword.title")}</strong><p>${passwordPolicyText}</p></div><button class="btn btn-primary" type="submit" style="width:100%">${t("changePassword.submit")}</button></form></section></main>`;
}

function restrictedPage() {
  return `<div class="page">${header()}<section class="section"><div class="container"><div class="card empty-state">${icon("lock")}<h2>${t("toast.restricted")}</h2><a class="btn btn-primary" href="/login" data-link>${t("nav.login")}</a></div></div></section>${footer()}</div>`;
}

function hasAdminAccess() {
  return session?.role === "hr";
}

function setupLearningTracking(){clearInterval(learningTimerId);learningTimerId=null;const stage=document.querySelector(".lesson-stage");if(!stage||!hasEmployeeAccess())return;const item=getCourseContent(stage.dataset.courseId).find(x=>x.id===stage.dataset.contentId);if(!item)return;lastTickAt=Date.now();
  if(item.type==="slide")learningTimerId=setInterval(()=>{if(document.hidden||!document.hasFocus())return;const viewer=document.querySelector(".slide-viewer");const slide=item.slides?.[activeSlideIndex];if(!viewer||!slide)return;const state=getContentProgress(session.accountId,item.courseId).find(x=>x.contentId===item.id);const slides={...(state?.metadata?.slides||{})};const prior=slides[slide.id]||{viewedSeconds:0,completed:false,rapidAdvanceAttempts:0};prior.viewedSeconds=Math.min(slide.minimumViewSeconds,prior.viewedSeconds+1);prior.completed=prior.viewedSeconds>=slide.minimumViewSeconds;prior.lastViewedAt=new Date().toISOString();slides[slide.id]=prior;const complete=item.slides.every(s=>slides[s.id]?.completed);saveContentProgress({accountId:session.accountId,courseId:item.courseId,contentId:item.id,contentType:"slide",activeSeconds:Number(state?.activeSeconds||0)+1,completionPercent:Math.round(Object.values(slides).filter(s=>s.completed).length/item.slides.length*100),completed:complete,metadata:{slides}});const remaining=Math.max(0,slide.minimumViewSeconds-prior.viewedSeconds);const timer=document.querySelector("[data-slide-timer]");if(timer)timer.textContent=`${remaining}s`;const next=document.querySelector(`[data-slide-nav="${activeSlideIndex+1}"]`);if(next&&remaining===0){next.disabled=false;next.removeAttribute("aria-disabled");}if(complete){clearInterval(learningTimerId);render();}},1000);
  const video=document.getElementById("course-video");if(video){let last=video.currentTime||0;video.playbackRate=Math.min(video.playbackRate,item.completionRule?.maxPlaybackRate||1.25);video.addEventListener("ratechange",()=>{if(video.playbackRate>(item.completionRule?.maxPlaybackRate||1.25))video.playbackRate=item.completionRule?.maxPlaybackRate||1.25;});video.addEventListener("seeking",()=>{const state=getContentProgress(session.accountId,item.courseId).find(x=>x.contentId===item.id);const allowed=Number(state?.metadata?.furthestAllowedTime||0)+2;if(video.currentTime>allowed){video.currentTime=Math.max(0,allowed-1);logLearningActivity({eventType:"invalid_seek",accountId:session.accountId,courseId:item.courseId,contentId:item.id});showLearningWarning(lt("invalidSeek"));}});video.addEventListener("timeupdate",()=>{if(document.hidden||video.paused||video.seeking||video.readyState<3)return;if(video.muted||video.volume<(item.completionRule?.minimumVolume||.1)){video.pause();showLearningWarning(lt("enableSound"));return;}const delta=Math.max(0,Math.min(1.5,video.currentTime-last));last=video.currentTime;if(!delta)return;const state=getContentProgress(session.accountId,item.courseId).find(x=>x.contentId===item.id);const watched=Number(state?.activeSeconds||0)+delta;const duration=video.duration||item.minimumDurationSeconds||1;const pct=Math.min(100,Math.round(watched/duration*100));saveContentProgress({accountId:session.accountId,courseId:item.courseId,contentId:item.id,contentType:"video",activeSeconds:watched,completionPercent:pct,completed:pct>=(item.completionRule?.requiredPercent||90),metadata:{furthestAllowedTime:Math.max(Number(state?.metadata?.furthestAllowedTime||0),video.currentTime),durationSeconds:duration}});});}
}
function recordRapidAdvance(viewer){if(!viewer)return;const stage=document.querySelector(".lesson-stage");const item=getCourseContent(stage.dataset.courseId).find(x=>x.id===stage.dataset.contentId);const state=getContentProgress(session.accountId,item.courseId).find(x=>x.contentId===item.id);const slide=item.slides[activeSlideIndex];const slides={...(state?.metadata?.slides||{})};const prior=slides[slide.id]||{viewedSeconds:0,completed:false,rapidAdvanceAttempts:0};prior.rapidAdvanceAttempts=(prior.rapidAdvanceAttempts||0)+1;slides[slide.id]=prior;saveContentProgress({accountId:session.accountId,courseId:item.courseId,contentId:item.id,contentType:"slide",metadata:{slides}});logLearningActivity({eventType:"rapid_advance_attempt",accountId:session.accountId,courseId:item.courseId,contentId:item.id,metadata:{slideId:slide.id,count:prior.rapidAdvanceAttempts}});showLearningWarning(prior.rapidAdvanceAttempts>=3?lt("rapidWarningLogged"):lt("rapidWarning"));}
function showLearningWarning(message){const el=document.getElementById("learning-warning");if(el)el.textContent=message;else toast(message);}
document.addEventListener("visibilitychange",()=>{const stage=document.querySelector(".lesson-stage");if(!stage)return;if(document.hidden){blurStartedAt=Date.now();document.getElementById("course-video")?.pause();logLearningActivity({eventType:"tab_hidden",accountId:session.accountId,courseId:stage.dataset.courseId,contentId:stage.dataset.contentId,metadata:{durationSeconds:0}});}else{showLearningWarning(lt("pausedOnLeave"));}});
window.addEventListener("blur",()=>{blurStartedAt=Date.now();document.getElementById("course-video")?.pause();});

function render() {
  route = location.pathname.replace(/\/$/, "") || "/";
  session = getSession();
  const routeParams = new URLSearchParams(location.search);
  selectedLoginRole = routeParams.get("role") || selectedLoginRole;
  if (route === "/admin/assign" && assignRouteSearch !== location.search) {
    assignRouteSearch = location.search;
    assignCourseId = routeParams.get("courseId") || "";
    assignTargetCourseId = routeParams.get("courseId") || "";
    assignTargetAccountId = routeParams.get("accountId") || "";
    assignModalOpen = routeParams.get("open") === "1";
  }
  if (route !== "/admin/assign") assignRouteSearch = null;
  document.documentElement.lang = language;
  if (route === "/") app.innerHTML = landingPage();
  else if (route === "/about-kis") app.innerHTML = aboutPage();
  else if (route === "/login") app.innerHTML = loginPage();
  else if (route === "/dashboard") app.innerHTML = hasEmployeeAccess() ? employeeDashboard(false) : session ? restrictedPage() : loginPage();
  else if (route === "/dashboard/courses") app.innerHTML = hasEmployeeAccess() ? myCoursesPage() : session ? restrictedPage() : loginPage();
  else if (route.startsWith("/dashboard/courses/")) app.innerHTML = coursePlayerPage(decodeURIComponent(route.split("/").pop()));
  else if (route === "/dashboard/quizzes") app.innerHTML = hasEmployeeAccess() ? employeeQuizzesPage() : session ? restrictedPage() : loginPage();
  else if (route === "/admin") app.innerHTML = hasAdminAccess() ? adminDashboard(false) : session ? restrictedPage() : loginPage();
  else if (route === "/admin/employees") app.innerHTML = employeesPage();
  else if (route === "/admin/accounts") app.innerHTML = accountsPage();
  else if (route === "/admin/courses") app.innerHTML = hasAdminAccess() ? coursesPage() : session ? restrictedPage() : loginPage();
  else if (route === "/admin/assign") app.innerHTML = hasAdminAccess() ? assignPage() : session ? restrictedPage() : loginPage();
  else if (route === "/admin/quizzes") app.innerHTML = hasAdminAccess() ? adminQuizzesPage() : session ? restrictedPage() : loginPage();
  else if (route === "/admin/reports") app.innerHTML = hasAdminAccess() ? reportsPage() : session ? restrictedPage() : loginPage();
  else if (route === "/change-password") app.innerHTML = changePasswordPage();
  else app.innerHTML = landingPage();
  bindEvents();
  setupLearningTracking();
  if (activeQuizAttempt) startQuizCountdown();
  if (location.hash) requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" }));
}

function bindEvents() {
  document.querySelectorAll("[data-link]").forEach((el) => el.addEventListener("click", (event) => { event.preventDefault(); navigate(el.getAttribute("href")); }));
  document.querySelector("[data-logout]")?.addEventListener("click", () => {
    clearSession();
    session = null;
    navigate("/login");
    toast(uiText("logoutSuccess"));
  });
  document.querySelectorAll("[data-language]").forEach((el) => el.addEventListener("click", () => { language = el.dataset.language; saveLanguage(language); render(); }));
  document.querySelector("[data-quiz-create]")?.addEventListener("click",()=>{quizFormOpen=true;selectedQuizId="";quizBuilderQuestions=[];render();});
  document.querySelectorAll("[data-quiz-edit]").forEach(el=>el.addEventListener("click",()=>{quizFormOpen=true;selectedQuizId=el.dataset.quizEdit;quizBuilderQuestions=structuredClone(getQuizById(selectedQuizId)?.questions||[]);render();}));
  document.querySelector("[data-quiz-close]")?.addEventListener("click",()=>{quizFormOpen=false;selectedQuizId="";render();});
  document.querySelectorAll("[data-quiz-delete]").forEach(el=>el.addEventListener("click",()=>{if(deleteQuiz(el.dataset.quizDelete,session?.accountId)){toast("success");render();}else toast("error");}));
  document.querySelectorAll("[data-quiz-admin-view]").forEach(el=>el.addEventListener("click",()=>{quizAdminView=el.dataset.quizAdminView;render();}));
  document.querySelector("[data-quiz-search]")?.addEventListener("input",e=>{quizSearch=e.target.value;render();});
  document.querySelector("[data-quiz-course-filter]")?.addEventListener("change",e=>{quizCourseFilter=e.target.value;render();});
  document.querySelector("[data-quiz-status-filter]")?.addEventListener("change",e=>{quizStatusFilter=e.target.value;render();});
  document.querySelector("[data-add-question]")?.addEventListener("click",()=>{quizBuilderQuestions=readQuestionEditors();quizBuilderQuestions.push({id:`question-${Date.now()}`,text:"",type:"singleChoice",options:[{id:`option-${Date.now()}-1`,text:""},{id:`option-${Date.now()}-2`,text:""}],correctOptionId:"",explanation:"",points:1});render();});
  document.querySelectorAll("[data-remove-question]").forEach(el=>el.addEventListener("click",()=>{quizBuilderQuestions=readQuestionEditors().filter((_,i)=>i!==Number(el.dataset.removeQuestion));render();}));
  document.querySelectorAll("[data-q-field=type]").forEach(el=>el.addEventListener("change",()=>{quizBuilderQuestions=readQuestionEditors();render();}));
  document.querySelector("[data-import-quiz-json]")?.addEventListener("click",()=>{try{const value=JSON.parse(document.querySelector("[data-quiz-json]")?.value||"");if(!Array.isArray(value))throw new Error();const valid=value.every(q=>q&&typeof q.text==="string"&&["singleChoice","multipleChoice","trueFalse","text"].includes(q.type)&&Number(q.points)>0&&(q.type==="text"||(Array.isArray(q.options)&&q.options.length>=2&&q.options.every(o=>typeof o==="string"||typeof o?.text==="string")&&(q.type==="multipleChoice"?Array.isArray(q.correctOptionIds)&&q.correctOptionIds.length>0:Boolean(q.correctOptionId)))));if(!valid)throw new Error();quizBuilderQuestions=value.map((q,i)=>({...q,id:q.id||`import-q-${Date.now()}-${i}`,options:(q.options||[]).map((o,j)=>typeof o==="string"?{id:`import-q-${Date.now()}-${i}-o${j+1}`,text:o}:o)}));toast("success");render();}catch{toast(t("quiz.invalidJson"));}});
  document.getElementById("quizForm")?.addEventListener("submit",(event)=>{event.preventDefault();if(!hasAdminAccess())return toast("error");quizBuilderQuestions=readQuestionEditors();const d=new FormData(event.currentTarget);const payload={courseId:String(d.get("courseId")),title:String(d.get("title")).trim(),description:String(d.get("description")||""),status:String(d.get("status")),passingScore:Number(d.get("passingScore")),timeLimitMinutes:Number(d.get("timeLimitMinutes")),attemptsAllowed:Number(d.get("attemptsAllowed")),shuffleQuestions:false,requireCourseCompletion:d.get("requireCourseCompletion")==="on",prerequisiteQuizId:String(d.get("prerequisiteQuizId")||""),createdBy:session.accountId,updatedBy:session.accountId,questions:quizBuilderQuestions};const result=selectedQuizId?updateQuiz(selectedQuizId,payload):createQuiz(payload);if(!result)return toast(t("quiz.invalidQuiz"));quizFormOpen=false;selectedQuizId="";quizBuilderQuestions=[];toast("success");render();});
  document.querySelectorAll("[data-grade-attempt]").forEach(el=>el.addEventListener("click",()=>{const attempt=getQuizAttempts().find(a=>a.id===el.dataset.gradeAttempt);const quiz=getQuizById(attempt?.quizId);const question=quiz?.questions.find(q=>q.type==="text"&&!attempt.answers.find(a=>a.questionId===q.id&&Number.isFinite(a.awardedPoints)));if(!question)return;const answer=attempt.answers.find(a=>a.questionId===question.id)?.textAnswer||"";const value=window.prompt(`${t("quiz.manualGrade")}: ${answer}\n0-${question.points}`);if(value===null)return;const result=gradeQuizEssay({attemptId:attempt.id,questionId:question.id,points:Number(value),gradedBy:session.accountId});toast(result?"success":"error");render();}));
  document.querySelector("[data-quiz-export]")?.addEventListener("click",exportQuizCsv);
  document.querySelectorAll("[data-quiz-start]").forEach(el=>el.addEventListener("click",()=>{if(!hasEmployeeAccess())return toast("error");activeQuizAttempt=startQuizAttempt({quizId:el.dataset.quizStart,accountId:session.accountId});if(!activeQuizAttempt)return toast("error");quizCurrentQuestion=0;quizAnswers=Object.fromEntries((activeQuizAttempt.answers||[]).map(a=>[a.questionId,a.textAnswer??a.selectedOptionIds??a.selectedOptionId]));quizBookmarks=activeQuizAttempt.bookmarks||[];const started=new Date(activeQuizAttempt.startedAt.replace(" ","T")).getTime();quizSecondsRemaining=Math.max(0,activeQuizAttempt.quiz.timeLimitMinutes*60-Math.floor((Date.now()-started)/1000));render();}));
  document.querySelectorAll("[data-question-nav]").forEach(el=>el.addEventListener("click",()=>{captureQuizAnswer();quizCurrentQuestion=Number(el.dataset.questionNav);render();}));
  document.querySelector("[data-question-prev]")?.addEventListener("click",()=>{captureQuizAnswer();quizCurrentQuestion=Math.max(0,quizCurrentQuestion-1);render();});
  document.querySelector("[data-question-next]")?.addEventListener("click",()=>{captureQuizAnswer();quizCurrentQuestion=Math.min(activeQuizAttempt.quiz.questions.length-1,quizCurrentQuestion+1);render();});
  document.querySelector("[data-bookmark-question]")?.addEventListener("click",()=>{captureQuizAnswer();const id=activeQuizAttempt.quiz.questions[quizCurrentQuestion].id;quizBookmarks=quizBookmarks.includes(id)?quizBookmarks.filter(x=>x!==id):[...quizBookmarks,id];persistQuizDraft();render();});
  document.querySelectorAll("[data-answer-option]").forEach(el=>el.addEventListener("change",captureQuizAnswer));document.querySelector("[data-answer-text]")?.addEventListener("input",captureQuizAnswer);
  document.getElementById("quizAttemptForm")?.addEventListener("submit",(event)=>{event.preventDefault();captureQuizAnswer();if(!window.confirm(t("quiz.confirmSubmit")))return;finishQuizAttempt();});
  document.querySelector("[data-quiz-result-close]")?.addEventListener("click",()=>{quizLastResult=null;render();});
  document.querySelectorAll("[data-my-course-filter]").forEach((el) => el.addEventListener("click", () => { myCourseFilter = el.dataset.myCourseFilter || ""; render(); }));
  document.querySelector("[data-toggle-employee-notifications]")?.addEventListener("click", () => { employeeNotificationPanelOpen = !employeeNotificationPanelOpen; render(); });
  document.querySelectorAll("[data-open-content]").forEach(el=>el.addEventListener("click",()=>{activeContentId=el.dataset.openContent;activeSlideIndex=0;render();}));
  document.querySelectorAll("[data-course-content-nav]").forEach(el=>el.addEventListener("click",()=>{const stage=document.querySelector(".lesson-stage");const outline=getCourseContent(stage?.dataset.courseId);const next=outline[Number(el.dataset.courseContentNav)];if(next){activeContentId=next.id;activeSlideIndex=0;render();}}));
  document.querySelectorAll("[data-slide-nav]").forEach(el=>el.addEventListener("click",()=>{const target=Number(el.dataset.slideNav);const viewer=document.querySelector(".slide-viewer");const remaining=Number(document.querySelector("[data-slide-timer]")?.textContent?.replace("s","")||0);if(target>activeSlideIndex&&remaining>0){recordRapidAdvance(viewer);return;}activeSlideIndex=target;render();}));
  document.querySelector("[data-complete-transcript]")?.addEventListener("click",()=>{const stage=document.querySelector(".lesson-stage");saveContentProgress({accountId:session.accountId,courseId:stage.dataset.courseId,contentId:stage.dataset.contentId,contentType:"video",completed:true,completionPercent:100,metadata:{completedViaTranscript:true}});logLearningActivity({eventType:"transcript_completed",accountId:session.accountId,courseId:stage.dataset.courseId,contentId:stage.dataset.contentId});render();});
  document.querySelectorAll("[data-mark-notification-read]").forEach((el) => el.addEventListener("click", () => {
    if (!hasEmployeeAccess()) return toast("error");
    const own = getNotifications(session.accountId).find((item) => item.id === el.dataset.markNotificationRead);
    if (!own || !markAsRead(own.id)) return toast("error");
    toast("success"); render();
  }));
  document.querySelectorAll("[data-scroll]").forEach((el) => el.addEventListener("click", () => scrollToId(el.dataset.scroll)));
  document.querySelector("[data-announcements-link]")?.addEventListener("click", goAnnouncements);
  document.querySelector("[data-hr-link]")?.addEventListener("click", () => navigate(session?.role === "hr" ? "/admin" : "/login?role=hr"));
  document.querySelectorAll("[data-login-role]").forEach((el) => el.addEventListener("click", () => { selectedLoginRole = el.dataset.loginRole; render(); }));
  document.querySelector("[data-forgot-password]")?.addEventListener("click", () => {
    const identifier = document.querySelector("input[name='identifier']")?.value?.trim();
    if (!identifier) return toast(uiText("forgotEmailRequired"));
    findAccount(identifier);
    toast(uiText("forgotNeutral"));
  });
  document.querySelector("[data-fill-demo-account]")?.addEventListener("click", () => {
    const form = document.getElementById("loginForm");
    if (!form) return;
    selectedLoginRole = "hr";
    form.elements.identifier.value = DEMO_HR_EMAIL;
    form.elements.password.value = DEMO_HR_PASSWORD;
    document.querySelectorAll("[data-login-role]").forEach((el) => {
      const isHr = el.dataset.loginRole === "hr";
      el.classList.toggle("active", isHr);
      el.setAttribute("aria-selected", isHr ? "true" : "false");
    });
  });
  document.querySelector("[data-fill-demo-employee]")?.addEventListener("click", () => {
    const form = document.getElementById("loginForm");
    if (!form) return;
    const demoEmployee = getDemoEmployee();
    if (!demoEmployee) return toast("error");
    selectedLoginRole = "employee";
    form.elements.identifier.value = demoEmployee.email || "";
    form.elements.password.value = "Training@2026";
    document.querySelectorAll("[data-login-role]").forEach((element) => {
      const isEmployee = element.dataset.loginRole === "employee";
      element.classList.toggle("active", isEmployee);
      element.setAttribute("aria-selected", isEmployee ? "true" : "false");
    });
    form.elements.identifier.focus();
  });
  document.querySelector("[data-reset-demo-account]")?.addEventListener("click", () => {
    resetDemoHrAccount();
    session = getSession();
    selectedLoginRole = "hr";
    render();
    requestAnimationFrame(() => {
      const form = document.getElementById("loginForm");
      if (!form) return;
      form.elements.identifier.value = DEMO_HR_EMAIL;
      form.elements.password.value = DEMO_HR_PASSWORD;
      toast("success");
    });
  });
  document.getElementById("loginForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const result = login(data.get("identifier"), data.get("password"));
    if (!result.ok) return toast(result.reason === "locked" ? "locked" : "loginFailed");
    session = getSession();
    if (result.reason === "passwordResetRequired") navigate("/change-password");
    else navigate(result.account.role === "hr" ? "/admin" : "/dashboard");
  });
  document.getElementById("changePasswordForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next = String(data.get("next") || "");
    if (next !== data.get("confirm") || !validatePassword(next, String(data.get("current") || "")).passed) return toast("loginFailed");
    const result = changePassword(session?.accountId, String(data.get("current") || ""), next);
    if (!result.ok) return toast("loginFailed");
    toast("changed");
    navigate(session.role === "hr" ? "/admin" : "/dashboard");
  });
  document.querySelectorAll("[data-account-search]").forEach((el) => el.addEventListener("input", () => { accountSearch = el.value; render(); }));
  document.querySelectorAll("[data-account-filter]").forEach((el) => el.addEventListener("change", () => { accountFilters[el.dataset.accountFilter] = el.value; render(); }));
  document.querySelectorAll("[data-employee-search]").forEach((el) => el.addEventListener("input", () => { employeeDirectorySearch = el.value; employeeDirectoryReviewIssues = false; employeeDirectoryPage = 1; render(); }));
  document.querySelectorAll("[data-employee-filter]").forEach((el) => el.addEventListener("change", () => { employeeDirectoryFilters[el.dataset.employeeFilter] = el.value; employeeDirectoryReviewIssues = false; employeeDirectoryPage = 1; render(); }));
  document.querySelector("[data-sort-employees]")?.addEventListener("click", () => { employeeDirectorySortAsc = !employeeDirectorySortAsc; render(); });
  document.querySelector("[data-review-issues]")?.addEventListener("click", () => { employeeDirectoryFilters = { department: "", position: "", accountStatus: "", cchn: "" }; employeeDirectorySearch = ""; employeeDirectoryReviewIssues = true; employeeDirectoryPage = 1; render(); requestAnimationFrame(() => document.querySelector(".hr-employee-directory")?.scrollIntoView({ behavior: "smooth" })); });
  document.querySelectorAll("[data-page-kind]").forEach((el) => el.addEventListener("click", () => { if (el.dataset.pageKind === "employees") employeeDirectoryPage = Number(el.dataset.page); if (el.dataset.pageKind === "cchn") cchnPage = Number(el.dataset.page); render(); }));
  document.querySelectorAll("[data-account-detail]").forEach((el) => el.addEventListener("click", () => { selectedAccountId = el.dataset.accountDetail; accountDrawerOpen = true; render(); }));
  document.querySelector("[data-close-drawer]")?.addEventListener("click", () => { accountDrawerOpen = false; render(); });
  document.querySelectorAll("[data-reset-account]").forEach((el) => el.addEventListener("click", () => { resetTargetId = el.dataset.resetAccount; resetModalOpen = true; temporaryPasswordResult = ""; render(); }));
  document.querySelectorAll("[data-force-account]").forEach((el) => el.addEventListener("click", () => { forcePasswordChange(el.dataset.forceAccount); toast("success"); render(); }));
  document.querySelectorAll("[data-activate-account]").forEach((el) => el.addEventListener("click", () => { updateAccount(el.dataset.activateAccount, { accountStatus: "active" }); toast("success"); render(); }));
  document.querySelectorAll("[data-edit-employee-email]").forEach((el) => el.addEventListener("click", () => {
    const employee = getEmployees().find((item) => item.id === el.dataset.editEmployeeEmail);
    const nextEmail = prompt(`Email mới cho ${employee?.fullName || "nhân viên"}`, employee?.email || "");
    if (nextEmail === null) return;
    updateEmployeeProfile(el.dataset.editEmployeeEmail, { email: nextEmail });
    toast("success");
    render();
  }));
  document.querySelectorAll("[data-unlock-account]").forEach((el) => el.addEventListener("click", () => { if (confirm(t("admin.unlock"))) { unlockAccount(el.dataset.unlockAccount); toast("success"); render(); } }));
  document.querySelectorAll("[data-disable-account]").forEach((el) => el.addEventListener("click", () => { if (confirm(t("admin.disable"))) { disableAccount(el.dataset.disableAccount, "HR action"); toast("success"); render(); } }));
  document.querySelectorAll("[data-resend-account]").forEach((el) => el.addEventListener("click", () => { resendActivationEmail(el.dataset.resendAccount); toast("success"); render(); }));
  document.querySelector("[data-close-reset]")?.addEventListener("click", () => { resetModalOpen = false; temporaryPasswordResult = ""; render(); });
  document.getElementById("resetPasswordForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const temp = data.get("mode") === "manual" && data.get("manualPassword") ? String(data.get("manualPassword")) : generateTemporaryPassword();
    const result = resetPassword(resetTargetId, temp, { requireChange: data.get("require") === "on", unlock: data.get("unlock") === "on" });
    temporaryPasswordResult = result.temporaryPassword;
    toast("passwordReset");
    render();
  });
  document.querySelector("[data-copy-temp]")?.addEventListener("click", async () => { await navigator.clipboard?.writeText(temporaryPasswordResult); toast("copied"); });
  document.querySelectorAll("[data-timeline-year]").forEach((el) => el.addEventListener("click", () => { activeTimelineYear = el.dataset.timelineYear; render(); document.getElementById("kis-history")?.scrollIntoView({ behavior: "smooth", block: "start" }); }));
  document.querySelector("[data-cchn-search]")?.addEventListener("input", (event) => { cchnSearch = event.target.value; cchnPage = 1; render(); });
  document.querySelector("[data-cchn-sort]")?.addEventListener("click", () => { cchnSortAsc = !cchnSortAsc; cchnPage = 1; render(); });
  document.querySelectorAll("[data-cchn-filter]").forEach((el) => el.addEventListener("change", () => { cchnFilters[el.dataset.cchnFilter] = el.value; render(); }));
  document.querySelector("[data-course-search]")?.addEventListener("input", (event) => {
    courseSearch = event.target.value;
    const caret = event.target.selectionStart;
    render();
    requestAnimationFrame(() => {
      const input = document.querySelector("[data-course-search]");
      input?.focus();
      input?.setSelectionRange(caret, caret);
    });
  });
  document.querySelector("[data-course-filter-category]")?.addEventListener("change", (event) => { courseFilterCategory = event.target.value; render(); });
  document.querySelector("[data-course-filter-status]")?.addEventListener("change", (event) => { courseFilterStatus = event.target.value; render(); });
  document.querySelector("[data-course-create]")?.addEventListener("click", () => { courseFormMode = "create"; selectedCourseId = ""; courseDrawerOpen = false; render(); });
  document.querySelectorAll("[data-course-detail]").forEach((el) => el.addEventListener("click", () => { selectedCourseId = el.dataset.courseDetail; courseDrawerOpen = true; courseFormMode = ""; render(); }));
  document.querySelectorAll("[data-course-edit]").forEach((el) => el.addEventListener("click", () => { selectedCourseId = el.dataset.courseEdit; courseFormMode = "edit"; courseDrawerOpen = false; render(); }));
  document.querySelectorAll("[data-course-delete]").forEach((el) => el.addEventListener("click", () => {
    const courseId = el.dataset.courseDelete;
    if (getEnrollmentsByCourseId(courseId).length > 0) return toast("error");
    if (!window.confirm("Xóa khóa học này?")) return;
    const deleted = deleteCourse(courseId);
    if (deleted && selectedCourseId === courseId) { selectedCourseId = ""; courseDrawerOpen = false; courseFormMode = ""; }
    toast(deleted ? "success" : "error");
    render();
  }));
  document.querySelector("[data-close-course-drawer]")?.addEventListener("click", () => { courseDrawerOpen = false; contentBuilderMode = ""; selectedContentId = ""; render(); });
  document.querySelectorAll("[data-close-course-form]").forEach((el) => el.addEventListener("click", () => { courseFormMode = ""; render(); }));
  document.querySelector("[data-content-add]")?.addEventListener("click", () => { contentBuilderMode = "add"; selectedContentId = ""; contentBuilderType = "slide"; render(); });
  document.querySelectorAll("[data-content-edit]").forEach(el => el.addEventListener("click", () => { const item = getCourseContent(selectedCourseId).find(x=>x.id===el.dataset.contentEdit); if(!item)return; contentBuilderMode = "edit"; selectedContentId = item.id; contentBuilderType = item.type; render(); }));
  document.querySelectorAll("[data-content-delete]").forEach(el => el.addEventListener("click", () => { if(!window.confirm("Xóa nội dung này? Tiến trình học liên quan sẽ không bị xóa."))return; deleteCourseContent(el.dataset.contentDelete); toast("success"); render(); }));
  document.querySelectorAll("[data-content-move-up]").forEach(el => el.addEventListener("click", () => { const items = getCourseContent(selectedCourseId); const i = items.findIndex(x=>x.id===el.dataset.contentMoveUp); if(i<=0)return; const ids=items.map(x=>x.id); [ids[i-1],ids[i]]=[ids[i],ids[i-1]]; reorderCourseContent(selectedCourseId,ids); render(); }));
  document.querySelectorAll("[data-content-move-down]").forEach(el => el.addEventListener("click", () => { const items = getCourseContent(selectedCourseId); const i = items.findIndex(x=>x.id===el.dataset.contentMoveDown); if(i<0||i>=items.length-1)return; const ids=items.map(x=>x.id); [ids[i],ids[i+1]]=[ids[i+1],ids[i]]; reorderCourseContent(selectedCourseId,ids); render(); }));
  document.querySelectorAll("[data-content-form-close]").forEach(el => el.addEventListener("click", () => { contentBuilderMode = ""; selectedContentId = ""; render(); }));
  document.getElementById("contentItemForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    if(!hasAdminAccess())return toast("error");
    const fd = new FormData(event.currentTarget);
    const type = String(fd.get("type")||"slide");
    const payload = { title: String(fd.get("title")||"").trim(), type, required: fd.get("required")==="on", completionWeight: Number(fd.get("completionWeight"))||1, minimumDurationSeconds: Number(fd.get("minimumDurationSeconds"))||8, slideTitle: String(fd.get("slideTitle")||"").trim(), slideContent: String(fd.get("slideContent")||"").trim(), sourceType: String(fd.get("sourceType")||"youtube"), youtubeVideoId: String(fd.get("youtubeVideoId")||"").trim(), sourceUrl: String(fd.get("sourceUrl")||"").trim(), transcript: String(fd.get("transcript")||""), transcriptAlternativeAllowed: fd.get("transcriptAlternativeAllowed")==="on", requiredPercent: Number(fd.get("requiredPercent"))||90, quizId: String(fd.get("quizId")||""), requirePass: fd.get("requirePass")==="on" };
    if(!payload.title)return toast("error");
    if(type==="quiz"&&!payload.quizId)return toast("error");
    if(type==="video"&&payload.sourceType==="youtube"&&payload.youtubeVideoId&&!/^[a-zA-Z0-9_-]{11}$/.test(payload.youtubeVideoId))return toast("invalidYoutubeId");
    let result;
    if(contentBuilderMode==="edit"&&selectedContentId){ result=updateCourseContent(selectedContentId,payload); }
    else{ result=createCourseContent({...payload,courseId:selectedCourseId}); }
    if(!result)return toast("error");
    contentBuilderMode=""; selectedContentId="";
    toast("success"); render();
  });
  document.getElementById("courseForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const account = session?.accountId ? getAccountById(session.accountId) : null;
    const payload = {
      title: String(formData.get("title") || "").trim(),
      description: String(formData.get("description") || "").trim(),
      category: String(formData.get("category") || "").trim(),
      format: String(formData.get("format") || "").trim(),
      durationHours: Number(formData.get("durationHours")),
      status: String(formData.get("status") || "draft"),
      updatedBy: account?.fullName || "HR / L&D",
    };
    if (!payload.title || !Number.isFinite(payload.durationHours) || payload.durationHours < 0) return toast("error");
    const result = courseFormMode === "edit"
      ? updateCourse(selectedCourseId, payload)
      : createCourse({ ...payload, createdBy: account?.fullName || "Nguyễn Thị Cẩm Thanh" });
    if (!result) return toast("error");
    courseFormMode = "";
    selectedCourseId = result.id || selectedCourseId;
    courseDrawerOpen = false;
    toast("success");
    render();
  });
  document.querySelector("[data-assign-search]")?.addEventListener("input", (event) => {
    assignSearch = event.target.value;
    const caret = event.target.selectionStart;
    render();
    requestAnimationFrame(() => {
      const input = document.querySelector("[data-assign-search]");
      input?.focus();
      input?.setSelectionRange(caret, caret);
    });
  });
  document.querySelector("[data-assign-filter-course]")?.addEventListener("change", (event) => { assignCourseId = event.target.value; assignTargetCourseId = event.target.value; render(); });
  document.querySelector("[data-assign-filter-dept]")?.addEventListener("change", (event) => { assignFilterDept = event.target.value; render(); });
  document.querySelector("[data-assign-filter-status]")?.addEventListener("change", (event) => { assignFilterStatus = event.target.value; render(); });
  document.querySelector("[data-clear-assign-course]")?.addEventListener("click", () => {
    assignCourseId = "";
    assignTargetCourseId = "";
    history.replaceState({}, "", "/admin/assign");
    assignRouteSearch = location.search;
    render();
  });
  document.querySelector("[data-assign-new]")?.addEventListener("click", () => { assignModalOpen = true; assignTargetAccountId = ""; assignTargetCourseId = assignCourseId || ""; render(); });
  document.querySelectorAll("[data-assign-method]").forEach((el)=>el.addEventListener("click",()=>{assignMethod=el.dataset.assignMethod; bulkSelectedAccountIds=[]; excelPreviewRows=[]; render();}));
  document.querySelector("[data-bulk-search]")?.addEventListener("input",(e)=>{bulkEmployeeSearch=e.target.value; render();});
  document.querySelector("[data-bulk-department]")?.addEventListener("change",(e)=>{bulkDepartmentFilter=e.target.value; if(assignMethod==="department") bulkSelectedAccountIds=getAccounts().filter(a=>a.role==="employee"&&a.accountStatus!=="disabled"&&a.department===bulkDepartmentFilter).map(a=>a.id); render();});
  document.querySelectorAll("[data-bulk-account]").forEach((el)=>el.addEventListener("change",()=>{bulkSelectedAccountIds=el.checked?[...new Set([...bulkSelectedAccountIds,el.dataset.bulkAccount])]:bulkSelectedAccountIds.filter(id=>id!==el.dataset.bulkAccount); render();}));
  document.querySelector("[data-select-visible]")?.addEventListener("click",()=>{bulkSelectedAccountIds=getAccounts().filter(a=>a.role==="employee"&&a.accountStatus!=="disabled"&&(!bulkEmployeeSearch||`${a.fullName} ${a.email}`.toLowerCase().includes(bulkEmployeeSearch.toLowerCase()))&&(!bulkDepartmentFilter||a.department===bulkDepartmentFilter)).map(a=>a.id);render();});
  document.querySelector("[data-clear-bulk]")?.addEventListener("click",()=>{bulkSelectedAccountIds=[];render();});
  document.querySelector("[data-bulk-excel]")?.addEventListener("change", async (event)=>{
    const file=event.target.files?.[0]; if(!file) return; try { const XLSX=await import("https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs"); const workbook=XLSX.read(await file.arrayBuffer()); const sheet=workbook.Sheets[workbook.SheetNames[0]]; const rows=XLSX.utils.sheet_to_json(sheet,{defval:""}); const seen=new Set(); excelPreviewRows=rows.map(row=>{const email=String(row.Email||row.email||"").replace(/\u00a0/g," ").trim().toLowerCase(); const employeeCode=String(row["Mã nhân viên"]||row.employeeCode||"").trim(); const account=getAccounts().find(a=>(email&&a.email?.toLowerCase()===email)||(employeeCode&&a.employeeCode===employeeCode)); let reason="unmatched"; if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) reason="invalidRows"; else if(seen.has(email||employeeCode)) reason="duplicates"; else if(account?.accountStatus==="disabled") reason="invalidRows"; else if(account?.role==="employee") reason=""; seen.add(email||employeeCode); return {email,employeeCode,name:row["Họ tên"]||row.fullName||"",department:row.Department||row.department||"",account,valid:!reason,reason};}); bulkSelectedAccountIds=excelPreviewRows.filter(r=>r.valid).map(r=>r.account.id); render(); } catch { toast("error"); }
  });
  document.querySelectorAll("[data-close-assign-modal]").forEach((el) => el.addEventListener("click", () => {
    assignModalOpen = false;
    assignTargetAccountId = "";
    assignTargetCourseId = "";
    history.replaceState({}, "", "/admin/assign");
    assignRouteSearch = location.search;
    render();
  }));
  document.getElementById("assignForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const courseId = String(formData.get("courseId") || "").trim();
    const deadline = String(formData.get("deadline") || "").trim();
    const note = String(formData.get("note") || "").trim();
    if (!bulkSelectedAccountIds.length || !courseId || !deadline || deadline < getTodayDateString()) return toast("error");
    const currentSession = getSession();
    const result = assignCourseToAccounts({ courseId, accountIds: bulkSelectedAccountIds, assignedBy: currentSession?.accountId || "acc-hr-demo", deadline, note });
    assignModalOpen = false;
    assignTargetAccountId = "";
    assignTargetCourseId = "";
    history.replaceState({}, "", "/admin/assign");
    assignRouteSearch = location.search;
    bulkSelectedAccountIds=[]; excelPreviewRows=[];
    toast(result.assigned ? t(result.invalid || result.duplicates ? "bulkAssign.partialSuccess" : "bulkAssign.assignSuccess") : "error");
    render();
  });
  document.querySelectorAll("[data-reset-learning]").forEach(el=>el.addEventListener("click",()=>{const row=getEnrollments().find(x=>x.id===el.dataset.resetLearning);const reason=window.prompt(lt("resetReason"));if(!reason?.trim())return toast("learning.resetReasonRequired");if(!window.confirm(lt("resetConfirm")))return;const result=resetLearningProgress({performedBy:session.accountId,targetAccountId:row.accountId,courseId:row.courseId,reason:reason.trim()});toast(result?"success":"error");if(result)render();}));
  document.querySelectorAll("[data-view-learning-log]").forEach(el=>el.addEventListener("click",()=>{const row=getEnrollments().find(x=>x.id===el.dataset.viewLearningLog);const logs=getLearningActivity({accountId:row.accountId,courseId:row.courseId}).slice(0,20);window.alert(logs.length?logs.map(x=>`${x.occurredAt} · ${x.eventType}`).join("\n"):lt("noActivity"));}));
  document.querySelectorAll("[data-remove-enrollment]").forEach((el) => el.addEventListener("click", () => {
    if (!window.confirm("Bạn có chắc muốn hủy giao khóa học này?")) return;
    const removed = removeEnrollment(el.dataset.removeEnrollment);
    toast(removed ? "success" : "error");
    if (removed) render();
  }));
  document.querySelectorAll("[data-quick-assign]").forEach((el) => el.addEventListener("click", () => {
    const accountId = el.dataset.quickAssign;
    if (!accountId) return toast("error");
    assignTargetAccountId = accountId;
    assignTargetCourseId = "";
    assignModalOpen = true;
    navigate(`/admin/assign?accountId=${encodeURIComponent(accountId)}&open=1`);
  }));
}

function toast(key) {
  let el = document.querySelector(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    document.body.appendChild(el);
  }
  const translated = t(`toast.${key}`);
  el.textContent = key === "error"
    ? t("toast.error")
    : translated === `toast.${key}`
      ? (key.includes(".") ? t(key) : key)
      : translated;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2600);
}

function initials(name = "") {
  return name.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join("").toUpperCase();
}

function mostCommon(values) {
  const counts = values.filter(Boolean).reduce((acc, item) => ((acc[item] = (acc[item] || 0) + 1), acc), {});
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
}

window.addEventListener("popstate", render);
render();
