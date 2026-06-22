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
  DEMO_EMPLOYEE_EMAIL,
  DEMO_EMPLOYEE_PASSWORD,
  HR_SUPPORT_NAME,
  HR_SUPPORT_EMAIL,
  resendActivationEmail,
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
  getLmsOverviewStats,
  getNotificationHistory, sendNotificationCampaign,
} from "./lib/mockDatabase.js";
import { validatePassword } from "./lib/auth/passwordPolicy.js";
import { saveCourseImage, getCourseImage, saveEmployeePhoto, getEmployeePhoto, deleteEmployeePhoto, getGalleryMedia } from "./lib/blobStore.js";
import {employeeService} from "./lib/services/employeeService.js";
import {notificationService} from "./lib/services/notificationService.js";
import {galleryService} from "./lib/services/galleryService.js";
import {offlineTrainingService} from "./lib/services/offlineTrainingService.js";
import {calculateEmployeeTrainingTime,getCompanyTrainingAnalytics,getTrainingOverviewStats,formatTrainingDuration} from "./lib/services/trainingAnalyticsService.js";
import {sessionService} from "./lib/services/sessionService.js";
import {qrAttendanceService} from "./lib/services/qrAttendanceService.js";
import {calendarService} from "./lib/services/calendarService.js";
import {excelImportService} from "./lib/services/excelImportService.js";

const app = document.getElementById("app");
const SHOW_DEMO_CREDENTIALS = ["localhost", "127.0.0.1", ""].includes(location.hostname);

let language = getInitialLanguage();
let route = location.pathname;
let session = sessionService.getValidSession();
let selectedLoginRole = new URLSearchParams(location.search).get("role") || "employee";
let dialogState = null;
let pendingNavigation = "";
let bypassNavigationGuard = false;
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
let activeTimelineYear = "2025";
let courseSearch = "";
let courseFilterCategory = "";
let courseFilterStatus = "";
let courseDrawerOpen = false;
let selectedCourseId = "";
let courseFormMode = "";
let contentBuilderMode = "";
let selectedContentId = "";
let contentBuilderType = "slide";
let contentPickerStep = "type"; // "type"|"slide"|"youtube"|"quiz-pick"|"text"
let slideDraft = null;
let youtubeDraft = null;
let quizPickSearch = "";
let assignCourseId = "";
let assignSearch = "";
let assignFilterDept = "";
let assignFilterStatus = "";
let assignModalOpen = false;
let assignTargetAccountId = "";
let assignTargetCourseId = "";
let assignRouteSearch = null;
let myCourseFilter = "";
let reportDateRange = "all";
let reportDateFrom = "";
let reportDateTo = "";
let reportDeptFilter = "";
let reportCourseFilter = "";
let employeeNotificationPanelOpen = false;
let assignMethod = "individual";
let bulkSelectedAccountIds = [];
let bulkEmployeeSearch = "";
let bulkDepartmentFilter = "";
let bulkEmployeePage = 1;
let excelPreviewRows = [];
let importWizardOpen = false;
let importWizardMode = "employees";
let importWizardTarget = "";
let importWorkbookState = null;
let importSheetName = "";
let importHeaderRowIndex = 0;
let importColumnMapping = {};
let importPreviewRows = [];
let calendarSelectedDay = 0;
let activeQuizAttempt = null;
let quizFormOpen = false;
let selectedQuizId = "";
let quizBuilderQuestions = [];
let quizBuilderCollapsed = {};
let quizAddingQType = false;
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
let _ytWatchStart = null;
let _ytWatchRanges = [];
let _ytPersistTimer = null;
let _ytCourseId = "";
let _ytContentId = "";
let _ytAccountId = "";

function mergeWatchedRanges(ranges) {
  if (!ranges.length) return [];
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i].start <= last.end) {
      last.end = Math.max(last.end, sorted[i].end);
    } else {
      merged.push({ ...sorted[i] });
    }
  }
  return merged;
}

function uniqueWatchedSeconds(ranges) {
  return mergeWatchedRanges(ranges).reduce((sum, r) => sum + (r.end - r.start), 0);
}

function ytFlushRanges(final = false) {
  if (!_ytCourseId || !_ytContentId || !_ytAccountId) return;
  if (_ytWatchStart !== null && youtubePlayer) {
    try {
      const cur = youtubePlayer.getCurrentTime();
      if (cur > _ytWatchStart) _ytWatchRanges.push({ start: _ytWatchStart, end: cur });
    } catch {}
    if (!final) _ytWatchStart = (() => { try { return youtubePlayer.getCurrentTime(); } catch { return null; } })();
  }
  const state = getContentProgress(_ytAccountId, _ytCourseId).find(x => x.contentId === _ytContentId);
  const prev = state?.metadata?.watchedRanges || [];
  const merged = mergeWatchedRanges([...prev, ..._ytWatchRanges]);
  const duration = (() => { try { return youtubePlayer?.getDuration() || 0; } catch { return 0; } })();
  const watched = uniqueWatchedSeconds(merged);
  const requiredPercent = (() => {
    try { const content = getCourseContent(_ytCourseId).find(x => x.id === _ytContentId); return content?.completionRule?.requiredPercent ?? 90; } catch { return 90; }
  })();
  const pct = duration > 0 ? Math.min(100, Math.round(watched / duration * 100)) : 0;
  const completed = pct >= requiredPercent;
  saveContentProgress({ accountId: _ytAccountId, courseId: _ytCourseId, contentId: _ytContentId, contentType: "video", activeSeconds: watched, completionPercent: pct, completed, metadata: { watchedRanges: merged, durationSeconds: duration } });
  if (final) { _ytWatchRanges = []; _ytWatchStart = null; }
  else { _ytWatchRanges = []; }
  if (completed) render();
}

let _qrCameraStream = null;
let _qrScanRafId = null;

function stopQrCameraScanner() {
  if (_qrScanRafId) { cancelAnimationFrame(_qrScanRafId); _qrScanRafId = null; }
  if (_qrCameraStream) { _qrCameraStream.getTracks().forEach(t => t.stop()); _qrCameraStream = null; }
}

async function initQrCameraScanner() {
  const video = document.getElementById("qrCameraVideo");
  const canvas = document.getElementById("qrCameraCanvas");
  const status = document.getElementById("qrCameraStatus");
  const stopBtn = document.getElementById("qrCameraStop");
  if (!video || !canvas || !status) return;

  stopBtn?.addEventListener("click", () => { stopQrCameraScanner(); render(); });

  // Load jsQR if not already loaded
  if (!window.jsQR) {
    const script = document.createElement("script");
    script.src = "/vendor/jsqr.min.js";
    document.head.appendChild(script);
    await new Promise((res, rej) => { script.onload = res; script.onerror = rej; });
  }

  // Check if camera is available
  if (!navigator.mediaDevices?.getUserMedia) {
    status.textContent = "Thiết bị không hỗ trợ camera. Vui lòng dùng link QR.";
    return;
  }

  status.textContent = "Đang yêu cầu quyền truy cập camera...";

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    _qrCameraStream = stream;
    video.srcObject = stream;
    if (stopBtn) stopBtn.style.display = "";
    status.textContent = "Đang quét... Hướng camera vào mã QR.";

    function scanFrame() {
      if (!_qrCameraStream || video.readyState < 2) { _qrScanRafId = requestAnimationFrame(scanFrame); return; }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = window.jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
      if (code?.data) {
        stopQrCameraScanner();
        const url = code.data;
        // Extract token from URL or use raw value
        let token = url;
        try { const u = new URL(url); token = u.searchParams.get("token") || u.pathname.split("/").pop() || url; } catch {}
        status.textContent = "Đã nhận mã. Đang xác nhận điểm danh...";
        navigate(`/attendance/scan?token=${encodeURIComponent(token)}`);
        return;
      }
      _qrScanRafId = requestAnimationFrame(scanFrame);
    }
    scanFrame();
  } catch (err) {
    if (err.name === "NotAllowedError") {
      status.textContent = "Camera bị từ chối. Vui lòng cấp quyền trong cài đặt trình duyệt.";
    } else if (err.name === "NotFoundError") {
      status.textContent = "Không tìm thấy camera. Vui lòng dùng link QR.";
    } else {
      status.textContent = "Không thể khởi động camera: " + err.message;
    }
  }
}

function destroyYoutubePlayer() {
  if (_ytPersistTimer) { clearInterval(_ytPersistTimer); _ytPersistTimer = null; }
  if (_ytWatchStart !== null) ytFlushRanges(true);
  if (youtubePlayer) { try { youtubePlayer.destroy(); } catch {} youtubePlayer = null; }
  _ytCourseId = ""; _ytContentId = ""; _ytAccountId = "";
}

function initYoutubeTracking(courseId, contentId, accountId, videoId, requiredPercent = 90) {
  destroyYoutubePlayer();
  _ytCourseId = courseId; _ytContentId = contentId; _ytAccountId = accountId;
  const state = getContentProgress(accountId, courseId).find(x => x.contentId === contentId);
  _ytWatchRanges = state?.metadata?.watchedRanges ? [] : [];

  function setupPlayer() {
    if (!window.YT?.Player) return;
    const iframe = document.getElementById("youtube-player");
    if (!iframe) return;
    youtubePlayer = new window.YT.Player(iframe, {
      events: {
        onStateChange(e) {
          const YT = window.YT;
          if (e.data === YT.PlayerState.PLAYING) {
            if (!document.hidden) {
              try { _ytWatchStart = youtubePlayer.getCurrentTime(); } catch {}
            }
          } else if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED || e.data === YT.PlayerState.BUFFERING) {
            if (_ytWatchStart !== null) {
              try { _ytWatchRanges.push({ start: _ytWatchStart, end: youtubePlayer.getCurrentTime() }); } catch {}
              _ytWatchStart = null;
            }
            ytFlushRanges(false);
            if (e.data === YT.PlayerState.ENDED) ytFlushRanges(true);
          }
        },
      },
    });
    _ytPersistTimer = setInterval(() => {
      if (document.hidden || _ytWatchStart === null) return;
      ytFlushRanges(false);
    }, 8000);
  }

  if (window.YT?.Player) {
    setupPlayer();
  } else {
    window._ytReadyCallbacks = window._ytReadyCallbacks || [];
    window._ytReadyCallbacks.push(setupPlayer);
    if (!document.getElementById("yt-api-script")) {
      const s = document.createElement("script");
      s.id = "yt-api-script";
      s.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(s);
      window.onYouTubeIframeAPIReady = () => {
        (window._ytReadyCallbacks || []).forEach(fn => fn());
        window._ytReadyCallbacks = [];
      };
    }
  }
}
let courseDetailTab = "overview";
let notificationSearch = "";
let notificationComposerOpen = false;
let gallerySearch = "";
let galleryYear = "";
let resourceSearch = "";
let employeeFormOpen=false;
let employeeCreateResult=null;
let notificationModalOpen=false;
let notificationFilter="all";
let notificationPage=1;
let selectedNotificationId="";
let galleryEditorOpen=false;
let selectedAlbumId="";
let mediaViewerIndex=-1;
let galleryMediaFilter="all";
let calendarView="upcoming";
let calendarMonthOffset=0;
let sessionFormOpen=false;
let selectedOfflineSessionId="";
let busySessionId="";
let selectedQrSlotId="";
let selectedQrAction="check_in";
let currentQrTokenId="";
let qrProjectorOpen=false;
let qrScanInput="";
let _qrScanLocationData = null;
let _qrScanLocationStatus = "pending";
let _qrCameraConsentGiven = false;
let selectedSessionDepartments = [];
let sessionEmployeeSearch = "";
let sessionEmployeeDepartment = "";
let sessionEmployeePage = 1;
let sessionParticipantDraft = null;
let participantSyncState = { saving: false, error: "" };
// Tracks which sessions have been auto-synced to Supabase in this browser session
const _participantSyncedSessions = new Set();

// Async calendar state — populated by fetchCalendarEvents(), read by learningCalendarPageV3()
let _calendarEvents = null;       // null = not yet loaded
let _calendarLoading = false;
let _calendarError = null;
let _calendarSource = "";         // "api" | "local"
let _calendarAccountId = "";      // detect account switch
let sessionImportPreviewRows = [];

const GALLERY_KEY = "mykis.galleryAlbums.v1";
const RESOURCES_KEY = "mykis.courseResources.v1";
const REPORT_SNAPSHOTS_KEY = "mykis.reportSnapshots.v1";
const readLocalRows = (key) => { try { const value=JSON.parse(localStorage.getItem(key)||"[]"); return Array.isArray(value)?value:[]; } catch { return []; } };
const writeLocalRows = (key, rows) => localStorage.setItem(key, JSON.stringify(rows));

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
  if(path==="admin.sessions")return {vi:"Lớp trực tiếp",en:"Live sessions",kr:"오프라인 수업"}[language];
  const resolve = (dict) => path.split(".").reduce((obj, key) => obj?.[key], dict);
  return resolve(d()) ?? resolve(vi) ?? path;
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
    logout: { vi: "Đăng xuất", en: "Sign out", kr: "로그아웃" }, logoutSuccess: { vi: "Đăng xuất thành công.", en: "Signed out successfully.", kr: "로그아웃되었습니다." }, rememberMe: { vi: "Ghi nhớ đăng nhập trên thiết bị này", en: "Remember me on this device", kr: "이 기기에서 로그인 유지" }, rememberMeNote: { vi: "Không nên bật trên máy dùng chung.", en: "Do not enable on shared devices.", kr: "공용 기기에서는 사용하지 마세요." }, loginHeading: { vi: "Đăng nhập", en: "Sign in", kr: "로그인" },
    forgotPassword: { vi: "Quên mật khẩu", en: "Forgot password", kr: "비밀번호를 잊으셨나요?" }, forgotEmailRequired: { vi: "Vui lòng nhập email trước.", en: "Please enter your email first.", kr: "먼저 이메일을 입력해 주세요." }, forgotNeutral: { vi: "Nếu tài khoản hợp lệ, vui lòng liên hệ HR để được hỗ trợ đặt lại mật khẩu: thanh.ntc@kisvn.vn", en: "If the account is valid, please contact HR for password reset support: thanh.ntc@kisvn.vn", kr: "유효한 계정인 경우 비밀번호 재설정을 위해 HR에 문의해 주세요: thanh.ntc@kisvn.vn" },
    demoEmployeeAccount: { vi: "Tài khoản nhân viên demo", en: "Demo Employee Account", kr: "직원 데모 계정" }, emailLabel: { vi: "Email", en: "Email", kr: "이메일" }, passwordLabel: { vi: "Mật khẩu", en: "Password", kr: "비밀번호" }, useAccount: { vi: "Dùng tài khoản này", en: "Use This Account", kr: "이 계정 사용" },
    greeting: { vi: "Xin chào, {name}", en: "Hello, {name}", kr: "{name}님, 안녕하세요" }, learningJourney: { vi: "Tiếp tục hành trình học tập của bạn hôm nay.", en: "Continue your learning journey today.", kr: "오늘도 학습 여정을 이어가세요." }, employeeFallback: { vi: "Nhân viên", en: "Employee", kr: "직원" },
    totalTrainingHours: { vi: "Tổng giờ đào tạo", en: "Total training time", kr: "총 교육 시간" }, exploreCourses: { vi: "Khám phá khóa học", en: "Explore courses", kr: "교육 과정 보기" }, goToLearning: { vi: "Vào trang học tập", en: "Go to Learning", kr: "학습 공간으로" }, calendar: { vi: "Lịch học", en: "Calendar", kr: "학습 일정" }, qrAttendance: { vi: "Điểm danh QR", en: "QR attendance", kr: "QR 출석" },
    checkIn: { vi: "Check-in", en: "Check-in", kr: "체크인" }, checkOut: { vi: "Check-out", en: "Check-out", kr: "체크아웃" }, morning: { vi: "Buổi sáng", en: "Morning", kr: "오전" }, afternoon: { vi: "Buổi chiều", en: "Afternoon", kr: "오후" },
    manualAttendance: { vi: "Điểm danh thủ công", en: "Manual attendance", kr: "수동 출석" }, qrExpired: { vi: "QR đã hết hạn", en: "QR has expired", kr: "QR이 만료되었습니다" }, qrNotOpen: { vi: "QR chưa mở", en: "QR is not open yet", kr: "QR이 아직 열리지 않았습니다" },
    attendanceSuccess: { vi: "Điểm danh thành công", en: "Attendance recorded", kr: "출석이 기록되었습니다" }, alreadyScanned: { vi: "Bạn đã điểm danh rồi", en: "You already scanned this code", kr: "이미 출석 처리되었습니다" }, notInvited: { vi: "Bạn không thuộc danh sách tham dự", en: "You are not on the attendee list", kr: "참석 대상이 아닙니다" },
    projector: { vi: "Trình chiếu QR", en: "Project QR", kr: "QR 표시" }, closeAttendance: { vi: "Đóng điểm danh", en: "Close attendance", kr: "출석 종료" }, privacy: { vi: "Chính sách bảo mật", en: "Privacy notice", kr: "개인정보 안내" },
  };
  return labels[key]?.[language] || labels[key]?.vi || key;
}

async function fetchCalendarEvents(accountId) {
  if (_calendarLoading) return;
  _calendarLoading = true;
  _calendarError = null;
  _calendarAccountId = accountId;
  render(); // show spinner
  try {
    const result = await calendarService.getEventsForAccountAsync(accountId, { includeCancelled: true });
    _calendarEvents = result.events;
    _calendarSource = result.source;
  } catch (err) {
    _calendarError = String(err);
    _calendarEvents = [];
    _calendarSource = "local";
  } finally {
    _calendarLoading = false;
  }
  render(); // show data
}

function navigate(path) {
  stopQrCameraScanner();
  _qrScanLocationData = null;
  _qrScanLocationStatus = "pending";
  if (!path.startsWith("/attendance/scan")) _qrCameraConsentGiven = false;
  if (!bypassNavigationGuard && shouldWarnBeforeLeaving(path)) {
    pendingNavigation = path;
    openDialog({ type: "unsaved", important: true });
    return;
  }
  bypassNavigationGuard = false;
  history.pushState({}, "", path);
  route = location.pathname;
  session = sessionService.getValidSession();
  render();
  document.querySelector(".app-main .content")?.classList.add("route-enter");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function hasUnsavedLearningState() {
  const video = document.getElementById("course-video");
  const videoActive = Boolean(video && !video.paused && !video.ended);
  const quizDirty = Boolean(activeQuizAttempt && Object.keys(quizAnswers || {}).length);
  return videoActive || _ytWatchStart !== null || quizDirty;
}

function shouldWarnBeforeLeaving(path) {
  if (!hasUnsavedLearningState()) return false;
  const nextPath = String(path || "").split("?")[0];
  return nextPath !== route;
}

function openDialog(state) {
  dialogState = state;
  render();
  requestAnimationFrame(() => document.querySelector("[data-dialog-primary], [data-dialog-close]")?.focus());
}

function closeDialog() {
  dialogState = null;
  pendingNavigation = "";
  render();
}

function sharedDialog() {
  if (!dialogState) return "";
  const ICON_SYMBOLS = { "?": "💬", "!": "⚠", "i": "ℹ", "✓": "✓", "×": "✕" };
  const ICON_CLASSES = {
    support: "info", invalidCredentials: "warning", locked: "warning",
    inactive: "warning", pending: "info", system: "error",
    unsaved: "warning", alert: "info", confirm: "warning", gradeInput: "info",
  };
  const configs = {
    support: { title: "Hỗ trợ đặt lại mật khẩu", body: `Vui lòng liên hệ ${HR_SUPPORT_NAME} để được hỗ trợ đặt lại mật khẩu.`, icon: "?" },
    invalidCredentials: { title: "Đăng nhập không thành công", body: "Email hoặc mật khẩu chưa chính xác. Vui lòng kiểm tra và thử lại.", icon: "!" },
    locked: { title: "Tài khoản đã bị khóa", body: "Tài khoản của bạn hiện không thể đăng nhập. Vui lòng liên hệ Phòng Nhân sự để được hỗ trợ.", icon: "!" },
    inactive: { title: "Không thể đăng nhập", body: "Tài khoản này hiện không còn quyền truy cập hệ thống. Vui lòng liên hệ Phòng Nhân sự để được hỗ trợ.", icon: "!" },
    pending: { title: "Tài khoản chưa được kích hoạt", body: "Vui lòng liên hệ Phòng Nhân sự để được hỗ trợ kích hoạt tài khoản.", icon: "i" },
    system: { title: "Không thể kết nối", body: "Hệ thống đang tạm thời gián đoạn. Vui lòng thử lại sau.", icon: "!" },
    unsaved: { title: activeQuizAttempt ? "Rời khỏi bài kiểm tra?" : "Rời khỏi bài học?", body: activeQuizAttempt ? "Các câu trả lời chưa gửi có thể không được ghi nhận." : "Tiến độ hoặc nội dung chưa lưu có thể bị mất.", icon: "!" },
    alert: { title: dialogState.title || "Thông báo", body: dialogState.body || "", icon: "i" },
    confirm: { title: dialogState.title || "Xác nhận thao tác", body: dialogState.body || "", icon: "!" },
    gradeInput: { title: dialogState.title || "Chấm điểm câu hỏi tự luận", body: dialogState.body || "", icon: "i" },
  };
  const config = configs[dialogState.type] || configs.alert;
  const iconClass = ICON_CLASSES[dialogState.type] || "info";
  const isUnsaved = dialogState.type === "unsaved";
  const isConfirm = dialogState.type === "confirm";
  const isGradeInput = dialogState.type === "gradeInput";
  const isSupport = dialogState.type === "support";

  const inputHtml = isGradeInput ? `
    ${dialogState.answer ? `<p class="shared-dialog__answer-label">Câu trả lời của nhân viên</p><div class="shared-dialog__answer-box">${escapeHtml(dialogState.answer)}</div>` : ""}
    <div class="shared-dialog__input-wrap">
      <label for="sdGradeInput">Điểm (0 – ${dialogState.maxPoints ?? "?"})</label>
      <input type="number" id="sdGradeInput" min="0" max="${dialogState.maxPoints ?? 9999}" step="0.5" placeholder="Nhập điểm..." autocomplete="off">
      <span class="input-error" id="sdGradeError" aria-live="polite"></span>
    </div>` : "";

  const actionsHtml = isUnsaved
    ? `<button class="btn btn-outline" data-dialog-close>Tiếp tục học</button><button class="btn btn-primary" data-dialog-leave>Rời khỏi</button>`
    : isConfirm
    ? `<button class="btn btn-outline" data-dialog-close>Hủy</button><button class="btn btn-primary" data-dialog-confirm>Xác nhận</button>`
    : isGradeInput
    ? `<button class="btn btn-outline" data-dialog-close>Hủy</button><button class="btn btn-primary" data-dialog-grade-submit>Lưu điểm</button>`
    : isSupport
    ? `<a class="btn btn-outline" href="mailto:${escapeHtmlAttribute(HR_SUPPORT_EMAIL)}">Gửi email</a><button class="btn btn-primary" data-dialog-close data-dialog-primary>Đóng</button>`
    : `<button class="btn btn-primary" data-dialog-close data-dialog-primary>Đóng</button>`;

  return `<div class="modal-backdrop open shared-dialog-backdrop" data-shared-dialog-backdrop>
  <section class="shared-dialog" role="dialog" aria-modal="true" aria-labelledby="shared-dialog-title" aria-describedby="shared-dialog-description" data-shared-dialog>
    <div class="shared-dialog__header">
      <div class="shared-dialog__icon shared-dialog__icon--${iconClass}" aria-hidden="true">${ICON_SYMBOLS[config.icon] || config.icon}</div>
      <div class="shared-dialog__content">
        <h2 id="shared-dialog-title">${escapeHtml(config.title)}</h2>
        <p id="shared-dialog-description">${escapeHtml(config.body)}</p>
        ${isSupport ? `<a class="support-mail" href="mailto:${escapeHtmlAttribute(HR_SUPPORT_EMAIL)}">${escapeHtml(HR_SUPPORT_EMAIL)}</a>` : ""}
        ${inputHtml}
      </div>
    </div>
    <div class="shared-dialog__actions">${actionsHtml}</div>
  </section></div>`;
}

function currentPathWithQuery() {
  return `${location.pathname}${location.search}${location.hash || ""}`;
}

function navigateWithAuth(targetRoute, requiredRole = "employee") {
  const activeSession = sessionService.getValidSession();
  if (!activeSession) {
    sessionService.setPostLoginRedirect(targetRoute);
    navigate(requiredRole === "hr" ? "/login?role=hr" : "/login");
    return false;
  }
  if (requiredRole === "hr" && activeSession.role !== "hr") {
    navigate("/dashboard");
    return false;
  }
  if (requiredRole === "employee" && activeSession.role !== "employee") {
    navigate("/admin");
    return false;
  }
  navigate(targetRoute);
  return true;
}

function protectedRoute(path, role = "employee") {
  return `href="${role === "hr" ? "/login?role=hr" : "/login"}" data-auth-target="${escapeHtmlAttribute(path)}" data-auth-role="${role}"`;
}

function availableEmployeeAccounts() {
  return getAccounts()
    .filter((account) => account.role === "employee" && account.accountStatus === "active")
    .sort((a, b) => String(a.fullName || "").localeCompare(String(b.fullName || ""), "vi", { sensitivity: "base" }));
}

function sessionParticipantAccounts(sessionId) {
  return offlineTrainingService.getParticipantAccountIds(sessionId).map((accountId) => getAccountById(accountId)).filter(Boolean);
}

function sessionParticipantSummaryLabel(sessionId) {
  const summary = offlineTrainingService.participantSummary(sessionId);
  return summary.overBy
    ? `Đã chọn ${summary.selected} / ${summary.capacity} · Vượt sức chứa ${summary.overBy}`
    : `${summary.selected} người đã chọn · Còn ${summary.remaining} chỗ`;
}

function formatLocalDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(+date)) return "—";
  return date.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function resetImportWizard() {
  importWizardOpen = false;
  importWizardTarget = "";
  importWorkbookState = null;
  importSheetName = "";
  importHeaderRowIndex = 0;
  importColumnMapping = {};
  importPreviewRows = [];
}

function openImportWizard(mode, target = "") {
  importWizardMode = mode;
  importWizardTarget = target;
  importWizardOpen = true;
  importWorkbookState = null;
  importSheetName = "";
  importHeaderRowIndex = 0;
  importColumnMapping = {};
  importPreviewRows = [];
}

function importFieldList(mode) {
  const fields = {
    employees: [
      ["employeeCode", "Mã nhân viên"],
      ["fullName", "Họ và tên"],
      ["email", "Email"],
      ["department", "Phòng ban"],
      ["position", "Chức danh"],
      ["joinDate", "Ngày vào làm"],
      ["location", "Địa điểm"],
      ["defaultLanguage", "Ngôn ngữ"],
      ["accountStatus", "Trạng thái"],
    ],
    participants: [
      ["employeeCode", "Mã nhân viên"],
      ["email", "Email"],
      ["fullName", "Họ và tên"],
      ["department", "Phòng ban"],
      ["responseStatus", "Trạng thái đăng ký"],
    ],
    attendance: [
      ["employeeCode", "Mã nhân viên"],
      ["email", "Email"],
      ["slot", "Buổi sáng/chiều"],
      ["checkIn", "Check-in"],
      ["checkOut", "Check-out"],
      ["attendanceStatus", "Trạng thái"],
      ["note", "Ghi chú"],
    ],
  };
  return fields[mode] || [];
}

function normalizeAttendanceSlotLabel(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return "";
  if (["morning", "am", "buổi sáng", "sáng"].includes(text)) return "Buổi sáng";
  if (["afternoon", "pm", "buổi chiều", "chiều"].includes(text)) return "Buổi chiều";
  return text;
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
  const activeSession = sessionService.getValidSession();
  const activeAccount = activeSession?.accountId ? getAccountById(activeSession.accountId) : null;
  const activeEmployee = activeAccount?.role === "employee" ? getEmployeeByAccountId(activeAccount.id) : null;
  const destinationLabel = activeAccount?.role === "hr" ? "Vào trang quản trị" : "Vào trang học tập";
  const destinationRoute = activeAccount?.role === "hr" ? "/admin" : "/dashboard";
  return `
    <header class="header">
      <div class="container header-inner">
        ${brand()}
        <nav class="nav">
          <a href="/" data-link>${t("nav.home")}</a>
          <a href="/about-kis" data-link>${t("nav.about")}</a>
          <button class="nav-button" ${activeSession ? 'data-auth-target="/dashboard/courses" data-auth-role="employee"' : 'data-scroll="featured-courses"'}>${activeSession ? uiText("exploreCourses") : t("nav.courses")}</button>
          ${activeSession ? `<button class="nav-button" data-open-notifications>${uiText("announcements")}</button>` : `<button class="nav-button" data-announcements-link>${uiText("announcements")}</button>`}
          ${activeAccount?.role === "employee" ? `<button class="nav-button" data-auth-target="/dashboard/calendar" data-auth-role="employee">${uiText("calendar")}</button>` : ""}
          ${activeAccount?.role === "hr" ? `<button class="nav-button" data-auth-target="/admin/reports" data-auth-role="hr">${t("admin.reports")}</button>` : ""}
          <button class="nav-button" data-scroll="support">${t("nav.support")}</button>
        </nav>
        <div class="header-actions">
          ${languageSwitcher()}
          ${activeSession
            ? `<details class="topbar-user"><summary aria-label="${escapeHtmlAttribute(activeAccount?.fullName || "")}"><span class="topbar-user__name">${escapeHtml(activeAccount?.fullName || "")}</span><svg class="topbar-user__chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></summary><div class="topbar-user__menu"><strong>${escapeHtml(activeAccount?.fullName || "")}</strong>${activeEmployee?.position || activeAccount?.position ? `<span>${escapeHtml(activeEmployee?.position || activeAccount?.position || "")}</span>` : ""}${activeEmployee?.department || activeAccount?.department ? `<span>${escapeHtml(activeEmployee?.department || activeAccount?.department || "")}</span>` : ""}<a class="btn btn-primary" href="${destinationRoute}" data-link>${destinationLabel}</a><button class="btn btn-outline" data-logout>${uiText("logout")}</button></div></details>`
            : `<a class="btn btn-primary btn--hero" href="/login" data-link>${t("nav.login")}</a>`}
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
          <a href="/about-kis" data-link>${uiText("privacy")}</a>
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

function activeSessionForLandingModal() {
  if (location.pathname !== "/" || hasEmployeeAccess() || hasAdminAccess() || !selectedNotificationId) return "";
  const announcement = hrAnnouncements[Number(selectedNotificationId)];
  if (!announcement) return "";
  return `<div class="modal-backdrop open" data-close-landing-detail><section class="modal modal--medium modal--structured"><header class="modal__header"><div><span class="eyebrow">${escapeHtml(announcement[0])}</span><h2>${escapeHtml(announcement[1])}</h2></div><button class="icon-btn" data-close-landing-detail aria-label="Đóng">×</button></header><div class="modal__body"><p>${escapeHtml(announcement[2])}</p></div><footer class="modal__footer"><button class="btn btn-outline" data-close-landing-detail>Đóng</button><button class="btn btn-primary" data-auth-target="/dashboard" data-auth-role="employee">Đăng nhập để xem đầy đủ</button></footer></section></div>`;
}

function badge(key) {
  const cls = { active: "done", completed: "done", inProgress: "learning", notStarted: "new", pendingActivation: "pending", temporarilyLocked: "late", overdue: "late", disabled: "new", pending: "pending", follow: "late" }[key] || "new";
  return `<span class="badge ${cls}">${t(`status.${key}`)}</span>`;
}

function progress(value) {
  return `<div class="progress"><span style="--value:${value}%"></span></div>`;
}

function landingPage() {
  const stats = getLmsOverviewStats();
  const training = getTrainingOverviewStats();
  const publishedCourses = getCourses().filter((course) => course.status === "published" && course.showOnLanding !== false);
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
            <div class="hero-actions">${session ? `<button class="btn btn-primary btn--hero" data-auth-target="${session.role === "hr" ? "/admin" : "/dashboard"}" data-auth-role="${session.role}">${uiText("goToLearning")}</button>` : `<a class="btn btn-primary btn--hero" href="/login" data-link>Đăng nhập</a>`}<button class="btn btn-outline" data-scroll="featured-courses">${uiText("exploreCourses")}</button></div>
            <div class="hero-proof hero-proof--refined"><button class="proof-item" data-auth-target="/dashboard/courses" data-auth-role="employee"><strong>${stats.totalActiveEmployees.toLocaleString()}</strong><span>${overviewText("learnersCount")}</span></button><button class="proof-item" data-auth-target="/dashboard/courses" data-auth-role="employee"><strong>${stats.totalPublishedCourses}</strong><span>${overviewText("openCoursesCount")}</span></button><button class="proof-item" data-auth-target="/admin/reports" data-auth-role="hr"><strong>${formatTrainingDuration(training.totalTrainingSeconds,language,true)}</strong><span>${overviewText("totalHoursCount")}</span></button></div>
          </div>
          ${heroMockup()}
        </div>
      </section>
      <section class="section" id="purpose"><div class="container"><h2 class="section-title">${t("landing.purpose")}</h2><p class="section-lead">${t("landing.purposeLead")}</p><div class="grid-4 purpose-grid">${purposes.map(([i, key, desc]) => `<article class="card info-card purpose-card">${icon(i)}<h3>${t(key)}</h3><p>${desc}</p></article>`).join("")}</div></div></section>
      <section class="section" id="featured-courses"><div class="container"><h2 class="section-title">${overviewText("openCourses")}</h2>${publishedCourses.length ? `<div class="landing-course-grid">${publishedCourses.map(realCourseCard).join("")}</div>` : `<div class="empty-state">${icon("book")}<h3>${overviewText("noOpenCourses")}</h3></div>`}</div></section>
      <section class="section alt" id="support"><div class="container"><div class="support-panel card"><div><h2>${t("nav.support")}</h2><p>Liên hệ hỗ trợ đào tạo, tài khoản và phân quyền nội bộ.</p><div class="hero-actions"><button class="btn btn-outline" data-auth-target="/dashboard/gallery" data-auth-role="employee">Xem thư viện ảnh</button><button class="btn btn-outline" data-auth-target="/dashboard/resources" data-auth-role="employee">Xem tài liệu</button></div></div><strong>${hrContact}</strong></div></div></section>
      ${hrAnnouncementsSection()}
      ${footer()}
      ${activeSessionForLandingModal()}
      ${hasEmployeeAccess()?notificationModal():""}
    </div>
  `;
}

function overviewText(key) {
  const copy = {
    activeEmployees: { vi: "Nhân viên đang hoạt động", en: "Active employees", kr: "활성 직원" },
    publishedCourses: { vi: "Khóa học đang mở", en: "Open courses", kr: "공개 교육 과정" },
    completionRate: { vi: "Tỷ lệ hoàn thành", en: "Completion rate", kr: "완료율" },
    openCourses: { vi: "Khóa học đang mở", en: "Open courses", kr: "공개 교육 과정" },
    noOpenCourses: { vi: "Chưa có khóa học đang mở", en: "No open courses yet", kr: "현재 공개된 교육 과정이 없습니다" },
    learnersCount: { vi: "Số nhân viên học", en: "Employees learning", kr: "학습 직원 수" },
    openCoursesCount: { vi: "Số khóa đào tạo đang mở", en: "Open training courses", kr: "공개 교육 과정 수" },
    totalHoursCount: { vi: "Tổng số giờ học", en: "Total learning hours", kr: "총 학습 시간" },
  };
  return copy[key]?.[language] || copy[key]?.vi || key;
}

function realCourseCard(course) {
  const image = course.imageUrl ? `<img class="course-card-image" src="${escapeHtmlAttribute(course.imageUrl)}" alt="${escapeHtmlAttribute(course.title)}" loading="lazy">` : icon("book");
  return `<article class="card info-card course-category" data-auth-target="/dashboard/courses" data-auth-role="employee" tabindex="0" role="button" aria-label="${escapeHtmlAttribute(course.title)}">${image}<div class="course-card-body"><span class="badge new">${escapeHtml(course.category || t("nav.courses"))}</span><h3>${escapeHtml(course.title)}</h3><p>${escapeHtml(course.description || "")}</p><span class="card-meta">${Number(course.durationHours) || 0}h</span><span class="btn btn-outline mini-action">Xem khóa học</span></div></article>`;
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
  return `<section class="section alt" id="hr-announcements"><div class="container"><div class="section-head"><div><h2 class="section-title">Thông báo từ HR</h2><p class="section-lead">Cập nhật các thông tin quan trọng về đào tạo, hội nhập và phát triển nhân sự.</p></div></div><div class="grid-4">${hrAnnouncements.map(([category, title, desc],index) => `<article class="card info-card hr-announcement-card" data-open-landing-announcement="${index}" tabindex="0" role="button">${icon("file")}<span class="badge new">${category}</span><h3>${title}</h3><p>${desc}</p><button class="btn btn-outline mini-course-btn">Xem chi tiết</button></article>`).join("")}</div></div></section>`;
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
        ${leadershipSection()}
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

function leadershipSection() {
  const leaders = [
    {
      img: "/assets/about/leader-shin-hyun-jae.jpg",
      name: "Shin Hyun Jae",
      title: "Tổng Giám đốc kiêm Chủ tịch Hội đồng Quản trị",
    },
    {
      img: "/assets/about/leader-cho-hun-hee.jpg",
      name: "Cho Hun Hee",
      title: "Giám đốc cấp cao Khối Hoạt động & KHCN, Thành viên HĐQT",
    },
    {
      img: "/assets/about/leader-choi-eun-suk.jpg",
      name: "Choi Eun Suk",
      title: "Thành viên Hội đồng Quản trị",
    },
  ];
  return `<section class="section alt" id="kis-leadership">
    <div class="container">
      <div class="section-head">
        <div>
          <span class="eyebrow">Leadership</span>
          <h2 class="section-title">Ban Lãnh đạo</h2>
          <p class="section-lead">Đội ngũ lãnh đạo dẫn dắt KIS Việt Nam trên hành trình phát triển bền vững.</p>
        </div>
      </div>
      <div class="leadership-grid">
        ${leaders.map((l, i) => `
          <article class="leader-card" style="animation-delay: ${i * 80}ms">
            <div class="leader-card__photo-wrap">
              <img class="leader-card__photo" src="${l.img}" alt="Ảnh ${l.name}" loading="lazy">
            </div>
            <div class="leader-card__info">
              <h3 class="leader-card__name">Ông ${l.name}</h3>
              <p class="leader-card__title">${l.title}</p>
            </div>
          </article>
        `).join("")}
      </div>
    </div>
  </section>`;
}

function kisTimelineSection() {
  const item = timelineData[activeTimelineYear];
  const years = Object.keys(timelineData);
  return `<section class="section" id="kis-history">
    <div class="container">
      <h2 class="section-title">Lịch sử phát triển</h2>
      <div class="tl-nav" role="tablist" aria-label="Chọn năm">
        ${years.map((year) => `<button
          class="tl-nav__pill${activeTimelineYear === year ? " active" : ""}"
          data-timeline-year="${year}"
          role="tab"
          aria-selected="${activeTimelineYear === year}"
          id="tl-tab-${year}"
          aria-controls="tl-panel"
        >${year}</button>`).join("")}
      </div>
      <div class="tl-panel" id="tl-panel" role="tabpanel" aria-labelledby="tl-tab-${activeTimelineYear}">
        <div class="tl-panel__inner">
          <div class="tl-panel__photo">
            <img src="${item.image}" alt="KIS Vietnam ${activeTimelineYear}" loading="lazy">
          </div>
          <div class="tl-panel__body">
            <span class="tl-panel__year">${activeTimelineYear}</span>
            <ul class="tl-panel__events">
              ${item.events.map((ev) => `<li>${ev}</li>`).join("")}
            </ul>
          </div>
        </div>
      </div>
    </div>
  </section>`;
}

function ceoMessageSection() {
  const paragraphs = ["Kính gửi Quý Nhà đầu tư và Đối tác,", "Thay mặt Công ty Cổ phần Chứng khoán KIS Việt Nam, tôi xin gửi lời cảm ơn chân thành tới Quý Nhà đầu tư và Đối tác đã luôn tin tưởng, đồng hành và ủng hộ KIS Việt Nam trong suốt chặng đường phát triển hơn 15 năm qua.", "Ngay từ những ngày đầu thành lập, KIS Việt Nam luôn kiên định với định hướng lấy khách hàng làm trung tâm, không ngừng nâng cao chất lượng dịch vụ và ứng dụng công nghệ hiện đại nhằm mang đến các sản phẩm, giải pháp tài chính toàn diện cho nhà đầu tư cá nhân, tổ chức trong nước và quốc tế. Chúng tôi tin rằng sự thành công của khách hàng chính là nền tảng cho sự phát triển bền vững của KIS Việt Nam.", "Với mục tiêu trở thành một trong những định chế tài chính hàng đầu trên thị trường vốn Việt Nam, KIS Việt Nam không chỉ kế thừa nền tảng tài chính vững mạnh, kinh nghiệm quản trị và mạng lưới toàn cầu từ KIS Hàn Quốc, mà còn không ngừng đầu tư vào nguồn nhân lực chất lượng cao, công nghệ và hạ tầng giao dịch hiện đại để nâng cao trải nghiệm khách hàng.", "Sở hữu đội ngũ chuyên gia giàu kinh nghiệm cùng sự hỗ trợ từ các giải pháp công nghệ tiên tiến, chúng tôi cam kết tiếp tục đồng hành cùng Quý khách hàng và đối tác trên hành trình đầu tư, mang đến những giá trị thiết thực, bền vững và hiệu quả.", "Một lần nữa, xin chân thành cảm ơn sự tin tưởng và đồng hành của Quý vị. Kính chúc Quý Nhà đầu tư, Đối tác cùng gia đình sức khỏe, hạnh phúc và thành công.", "Trân trọng."];
  return `<section class="section alt"><div class="container"><h2 class="section-title">Lời Tổng Giám đốc</h2><div class="ceo-message-card card"><div class="ceo-photo"><img src="/assets/about/tgd.jpeg" alt="Shin, Hyun Jae - Tổng Giám đốc"></div><div class="ceo-copy"><span class="eyebrow">${t("about.leadership")}</span><h3>Shin, Hyun Jae</h3><p class="label">Tổng Giám đốc</p><div class="ceo-letter">${paragraphs.map((p) => `<p>${p}</p>`).join("")}</div></div></div></div></section>`;
}

function corporatePhilosophySection() {
  const cards = [["01", "Làm hài lòng khách hàng", ["Khách hàng là lý do mà công ty chứng khoán tồn tại.", "Ra quyết định dựa trên góc nhìn của khách hàng.", "Phát triển cùng với khách hàng bằng cách đảm bảo sự hài lòng của họ."]], ["02", "Kiến tạo giá trị mới", ["Liên tục tạo ra giá trị mới cho xã hội.", "Đổi mới với tinh thần thử thách bằng cách nâng cao năng lực tổ chức.", "Theo đuổi những mục tiêu cao nhất và sự xuất sắc."]], ["03", "Tôn trọng cá nhân", ["Chúng tôi luôn tôn trọng từng cá nhân trong đội ngũ của mình.", "Khuyến khích cá nhân phát triển khả năng của họ tại nơi làm việc.", "Hỗ trợ mỗi cá nhân trở thành những nhân viên xuất sắc."]]];
  return `<section class="section"><div class="container"><h2 class="section-title">Triết lý tập đoàn</h2><div class="grid-3">${cards.map(([no,title,bullets]) => `<article class="card philosophy-premium philosophy-list-card"><header class="phil-card-head"><div class="phil-icon-wrap" aria-hidden="true">${icon("check")}</div><span class="phil-no" aria-hidden="true">${no}</span></header><h3>${title}</h3><ul>${bullets.map((b) => `<li>${b}</li>`).join("")}</ul></article>`).join("")}</div></div></section>`;
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
  return `<section class="section alt"><div class="container"><div class="section-head"><div><h2 class="section-title">${title}</h2><p class="section-lead">${subtitle}</p></div></div><div class="grid-3">${cards.map(([no, i, names, descriptions]) => `<article class="card philosophy-premium philosophy-list-card core-value-card"><header class="phil-card-head"><div class="phil-icon-wrap" aria-hidden="true">${icon(i)}</div><span class="phil-no" aria-hidden="true">${no}</span></header><h3>${names[language] || names.vi}</h3><p>${descriptions[language] || descriptions.vi}</p></article>`).join("")}</div></div></section>`;
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
  const previous = language === "vi" ? "Trang trước" : language === "kr" ? "이전 페이지" : "Previous page";
  const next = language === "vi" ? "Trang sau" : language === "kr" ? "다음 페이지" : "Next page";
  const label = language === "vi" ? `Trang ${current} / ${total}` : language === "kr" ? `${current} / ${total} 페이지` : `Page ${current} of ${total}`;
  return `<nav class="pagination ${kind}-pagination" aria-label="${label}"><button aria-label="${previous}" data-page-kind="${kind}" data-page="${current - 1}" ${current <= 1 ? "disabled" : ""}>‹</button><span>${label}</span><button aria-label="${next}" data-page-kind="${kind}" data-page="${current + 1}" ${current >= total ? "disabled" : ""}>›</button></nav>`;
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
    <div class="section-head"><div><h3>${t("admin.employeeList")}</h3><p class="section-lead">${t("admin.totalEmployees")}: ${allEmployees.length}</p></div><div class="security-actions"><button class="btn btn-primary" data-add-employee>+ Thêm nhân viên</button><label class="btn btn-outline" for="employeeImportFile">Import Excel</label><input id="employeeImportFile" type="file" accept=".xls,.xlsx,.csv" hidden><label class="btn btn-outline" for="employeePhotoFolder">Import folder ảnh</label><input id="employeePhotoFolder" type="file" accept="image/jpeg,image/png,image/webp" webkitdirectory multiple hidden><button class="btn btn-outline" data-sort-employees>${t("admin.sortAZ")}</button></div></div>
    <div class="filter-bar employee-directory-filter">
      <input id="employeeDirSearch" data-focus-key="employee-dir-search" data-employee-search placeholder="${t("admin.searchEmployee")}" value="${employeeDirectorySearch}">
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
    <main class="auth-page" role="main">
      <div class="auth-background" aria-hidden="true"></div>
      <div class="auth-overlay" aria-hidden="true"></div>
      <div class="auth-header" aria-hidden="false">
        <a href="/" data-link class="auth-home-btn" aria-label="Quay về trang chủ">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="16" height="16"><path d="M12 4L6 10l6 6"/></svg>
          Về trang chủ
        </a>
      </div>
      <section class="auth-context" aria-hidden="true">
        <div class="auth-context-copy">
          <h1>Đăng nhập MyKIS Learning</h1>
          <p>Hệ thống Đào tạo Nội bộ dành riêng cho Nhân viên KIS Việt Nam</p>
        </div>
      </section>
      <section class="auth-visual">
        <form class="card login-card" id="loginForm" novalidate autocomplete="on">
          <div class="login-card-head">
            <div class="login-brand-group">
              <a href="/" data-link class="login-logo-link" aria-label="Quay về trang chủ">
                <img src="/assets/kis-logo-horizontal.png" alt="KIS Vietnam" class="login-brand-logo">
              </a>
              <div class="login-language-switcher">${languageSwitcher()}</div>
            </div>
          </div>
          <div class="login-heading">
            <h2>${uiText("loginHeading") || "Đăng nhập"}</h2>
          </div>
          <div class="field">
            <label for="loginEmail">${t("login.email") || "Email"}</label>
            <input
              id="loginEmail"
              name="identifier"
              autocomplete="email"
              type="email"
              inputmode="email"
              placeholder="${t("login.emailPlaceholder") || "Nhập email công ty"}"
              aria-describedby="loginEmailError"
              aria-required="true"
            >
            <span class="field-error" id="loginEmailError" data-login-email-error aria-live="polite"></span>
          </div>
          <div class="field field--password">
            <label for="loginPassword">${t("login.password") || "Mật khẩu"}</label>
            <div class="input-password-wrap">
              <input
                id="loginPassword"
                name="password"
                type="password"
                autocomplete="current-password"
                placeholder="${t("login.passwordPlaceholder") || "Nhập mật khẩu"}"
                aria-required="true"
              >
              <button type="button" class="password-toggle" data-toggle-password aria-label="Hiện mật khẩu" aria-pressed="false">
                <svg class="eye-icon eye-icon--show" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                <svg class="eye-icon eye-icon--hide" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:none"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              </button>
            </div>
          </div>
          <div class="login-options">
            <label class="remember-me-row">
              <input type="checkbox" name="rememberMe" class="remember-me-check" id="loginRememberMe">
              <span>${uiText("rememberMe") || "Ghi nhớ đăng nhập"}</span>
            </label>
            <button class="link-button" type="button" data-forgot-password>${uiText("forgotPassword") || "Quên mật khẩu"}</button>
          </div>
          <button class="btn btn-primary login-submit" type="submit" id="loginSubmitBtn">
            <span class="login-submit-text">${t("login.submit") || "Đăng nhập"}</span>
            <span class="login-submit-spinner" aria-hidden="true" style="display:none">
              <svg class="spinner-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-dasharray="31.4 62.8"/></svg>
            </span>
          </button>
          <p class="login-security-note">${t("login.note") || "Tài khoản được cấp bởi Phòng Nhân sự."}</p>
          ${SHOW_DEMO_CREDENTIALS ? `<details class="demo-accounts">
            <summary class="demo-accounts__toggle">
              <span class="demo-accounts__label">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                Tài khoản dùng thử
              </span>
              <svg class="demo-accounts__chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
            </summary>
            <div class="demo-accounts__body">
              <div class="demo-slot">
                <p class="demo-slot__title">Tài khoản dùng thử cho HR</p>
                <div class="demo-slot__creds">
                  <span><span class="demo-slot__label">Email</span><span class="demo-slot__val">${DEMO_HR_EMAIL}</span></span>
                  <span><span class="demo-slot__label">Mật khẩu</span><span class="demo-slot__val">${DEMO_HR_PASSWORD}</span></span>
                </div>
                <button type="button" class="demo-slot__use" data-fill-demo-account>Dùng tài khoản này</button>
              </div>
              <div class="demo-slot">
                <p class="demo-slot__title">Tài khoản dùng thử cho Nhân viên</p>
                <div class="demo-slot__creds">
                  <span><span class="demo-slot__label">Email</span><span class="demo-slot__val">${DEMO_EMPLOYEE_EMAIL}</span></span>
                  <span><span class="demo-slot__label">Mật khẩu</span><span class="demo-slot__val">${DEMO_EMPLOYEE_PASSWORD}</span></span>
                </div>
                <button type="button" class="demo-slot__use" data-fill-demo-employee>Dùng tài khoản này</button>
              </div>
            </div>
          </details>` : ""}
        </form>
      </section>
    </main>
  `;
}

function getDemoEmployee() {
  return getAccounts().find((account) => account.role === "employee"
    && account.email?.toLowerCase() === DEMO_EMPLOYEE_EMAIL
    && account.accountStatus === "active"
    && verifyPassword(account, DEMO_EMPLOYEE_PASSWORD)) || null;
}

function employeeDashboard(compact = false) {
  if (compact || !hasEmployeeAccess()) return "";
  const { account, employee } = getCurrentEmployeeContext();
  const enrollments = employeeEnrollments();
  const notifications = getNotifications(session.accountId);
  const unread = getUnreadCount(session.accountId);
  const yearStart=`${new Date().getFullYear()}-01-01T00:00:00+07:00`;const trainingTime=calculateEmployeeTrainingTime(session.accountId,{dateFrom:yearStart});
  const completed = enrollments.filter((item) => item.status === "completed").length;
  const inProgress = enrollments.filter((item) => item.status === "inProgress").length;
  const overdue = enrollments.filter((item) => item.status === "overdue").length;
  const recent = [...enrollments].filter((item) => item.status !== "completed").sort(compareEnrollmentPriority).slice(0, 3);
  const activities=getLearningActivity({accountId:session.accountId});
  const primary = [...recent].sort((a,b)=>{
    const aa=activities.find(x=>x.courseId===a.courseId)?.occurredAt||"";
    const bb=activities.find(x=>x.courseId===b.courseId)?.occurredAt||"";
    return bb.localeCompare(aa)||compareEnrollmentPriority(a,b);
  })[0];
  const displayName = employee?.fullName || account?.fullName || account?.email?.split("@")[0] || uiText("employeeFallback");
  const jobTitle=employee?.jobTitle||employee?.position||employee?.title||account?.position||uiText("employeeFallback");
  const department=employee?.department||employee?.departmentName||employee?.division||account?.department||"";
  return `
    <div class="app-layout">${sideNav("employee")}
      <main class="app-main">${topbar(uiText("learner"), displayName, "employee", initials(displayName))}<div class="content">
        <header class="dashboard-welcome employee-greeting">${employeeAvatar(account,employee,"employee-greeting__avatar")}<div class="employee-greeting__identity"><span class="eyebrow">${uiText("overview")}</span><h1>${escapeHtml(greeting(displayName))}</h1><div class="employee-meta-line">${jobTitle!==uiText("employeeFallback")?`<span class="employee-meta-line__title">${escapeHtml(jobTitle)}</span>`:""}${jobTitle!==uiText("employeeFallback")&&department?`<span class="employee-meta-line__divider" aria-hidden="true"></span>`:""}${department?`<span class="employee-meta-line__department">${escapeHtml(department)}</span>`:""}</div><p>${uiText("learningJourney")}</p></div></header>
        ${primary ? continueLearningHero(primary) : `<section class="card continue-empty"><div>${icon("book")}<h2>${uiText("noRecentCourses")}</h2><p>${uiText("noRecentCoursesDesc")}</p></div><a class="btn btn-primary" href="/dashboard/courses" data-link>${uiText("myCourses")}</a></section>`}
        <div class="progress-overview"><div><span>${uiText("inProgressCourses")}</span><strong>${inProgress}</strong></div><a href="/dashboard/history" data-link class="training-hours-kpi"><span>Tổng giờ đào tạo<small>Online ${formatTrainingDuration(trainingTime.onlineSeconds,language,true)} · Offline ${formatTrainingDuration(trainingTime.offlineSeconds,language,true)}</small></span><strong>${formatTrainingDuration(trainingTime.totalSeconds,language,true)}</strong></a><div><span>${uiText("overdue")}</span><strong>${overdue}</strong></div><div><span>${uiText("newNotifications")}</span><strong>${unread}</strong></div></div>
        <div class="dashboard-grid"><section class="card panel"><div class="panel-head"><div><h3>${uiText("recentCourses")}</h3></div><a class="btn btn-outline mini-action" href="/dashboard/courses" data-link>${uiText("viewAllCourses")}</a></div>${recent.length ? recent.map(recentCourseRow).join("") : `<div class="empty-state">${icon("book")}<h3>${uiText("noRecentCourses")}</h3><p>${uiText("noRecentCoursesDesc")}</p></div>`}</section><aside class="card panel" id="employee-notifications"><div class="panel-head"><div><h3>${uiText("recentNotifications")}</h3></div><button class="btn btn-outline mini-action" type="button" data-open-notifications>${uiText("viewNotifications")}</button></div>${notifications.slice(0,3).map(notificationRow).join("") || `<div class="empty-state"><p>${uiText("noNotifications")}</p></div>`}</aside></div>
      </div></main>${notificationModal()}
    </div>
  `;
}

function continueLearningHero(enrollment){
  const course=enrollment.course||getCourseById(enrollment.courseId)||{};
  const outline=getCourseContent(enrollment.courseId); const states=getContentProgress(session.accountId,enrollment.courseId);
  const current=outline.find(x=>!states.some(s=>s.contentId===x.id&&s.completed))||outline.at(-1);
  const activeSeconds=states.reduce((sum,x)=>sum+Number(x.activeSeconds||0),0);
  const estimated=Math.max(5,Math.round((Number(course.durationHours||1)*3600*(100-enrollment.progressPercent)/100)/60));
  const image=course.imageUrl?`<img src="${escapeHtmlAttribute(course.imageUrl)}" alt="${escapeHtmlAttribute(course.imageAlt||course.title||"")}">`:`<span class="continue-hero__placeholder">${icon("book")}</span>`;
  return `<section class="card continue-hero"><div class="continue-hero__media">${image}</div><div class="continue-hero__body"><span class="eyebrow">${uiText("continueLearning")}</span><h2>${escapeHtml(course.title||"—")}</h2><p class="continue-hero__lesson">${current?escapeHtml(current.title):uiText("courseIntro")}</p><div class="continue-hero__progress"><span>${uiText("progressLabel")}</span><strong>${enrollment.progressPercent}%</strong>${progress(enrollment.progressPercent)}</div><p class="continue-hero__meta">Còn khoảng ${estimated} phút${enrollment.deadline?` · ${uiText("deadline")} ${escapeHtml(enrollment.deadline)}`:""}</p><div class="continue-hero__actions"><a class="btn btn-primary" href="/dashboard/courses/${escapeHtmlAttribute(enrollment.courseId)}${current?`?content=${encodeURIComponent(current.id)}`:""}" data-link>${uiText("continueLearning")} →</a><a class="btn btn-outline" href="/dashboard/courses/${escapeHtmlAttribute(enrollment.courseId)}" data-link>Xem nội dung</a></div></div></section>`;
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
function notificationModal(){if(!notificationModalOpen||!hasEmployeeAccess())return "";const all=notificationService.list(session.accountId);const typed=all.filter(n=>notificationFilter==="all"||(notificationFilter==="unread"?!n.isRead:String(n.type||"").includes(notificationFilter)));const pages=Math.max(1,Math.ceil(typed.length/8));notificationPage=Math.min(notificationPage,pages);const rows=typed.slice((notificationPage-1)*8,notificationPage*8);const selected=notificationService.get(selectedNotificationId,session.accountId);const selectedIndex=typed.findIndex(n=>n.id===selectedNotificationId);return `<div class="modal-backdrop open notification-overlay" data-close-notifications><section class="modal modal--xlarge modal--structured notification-modal" role="dialog" aria-modal="true" aria-labelledby="notification-title"><header class="modal__header"><div><span class="eyebrow">${all.filter(n=>!n.isRead).length} chưa đọc</span><h2 id="notification-title">Thông báo của bạn</h2></div><div class="notification-head-actions"><button class="btn btn-outline" data-mark-all-read ${all.every(n=>n.isRead)?"disabled":""}>Đánh dấu tất cả đã đọc</button><button class="icon-btn" data-close-notifications aria-label="Đóng">×</button></div></header><div class="modal__body"><div class="notification-filters" role="tablist">${[["all","Tất cả"],["unread","Chưa đọc"],["course","Khóa học"],["deadline","Deadline"],["quiz","Quiz"],["result","Kết quả"],["system","Hệ thống"]].map(([v,l])=>`<button role="tab" aria-selected="${notificationFilter===v}" class="${notificationFilter===v?"active":""}" data-notification-filter="${v}">${l}</button>`).join("")}</div>${selected?`<article class="notification-detail"><div class="notification-detail__top"><button class="btn btn-ghost" data-notification-back>← Danh sách</button><div class="notification-detail__pager"><button class="btn btn-outline mini-action" data-notification-prev ${selectedIndex<=0?"disabled":""}>‹</button><button class="btn btn-outline mini-action" data-notification-next ${selectedIndex>=typed.length-1?"disabled":""}>›</button></div></div><span class="badge ${selected.isRead?"active":"pending"}">${selected.isRead?"Đã đọc":"Chưa đọc"}</span><h3>${escapeHtml(selected.title)}</h3><time>${escapeHtml(selected.createdAt)}</time>${selected.senderName?`<p><strong>Người gửi:</strong> ${escapeHtml(selected.senderName)}</p>`:""}<p>${escapeHtml(selected.body)}</p>${selected.attachmentLabel?`<p><strong>Tệp đính kèm:</strong> ${escapeHtml(selected.attachmentLabel)}</p>`:""}${selected.actionUrl?`<div class="hero-actions"><a class="btn btn-primary" href="${escapeHtmlAttribute(selected.actionUrl)}" data-link>Mở nội dung</a></div>`:""}</article>`:`<div class="notification-list">${rows.map(n=>`<button class="notification-item ${n.isRead?"":"unread"}" data-notification-detail="${n.id}"><span class="notification-dot" aria-label="${n.isRead?"Đã đọc":"Chưa đọc"}"></span><span><strong>${escapeHtml(n.title)}</strong><span>${escapeHtml(n.body)}</span><time>${escapeHtml(n.createdAt)}</time></span></button>`).join("")||`<div class="empty-state">Không có thông báo phù hợp.</div>`}</div>`}</div>${!selected?`<footer class="modal__footer"><nav class="pagination"><button data-notification-page="${notificationPage-1}" ${notificationPage<=1?"disabled":""}>‹</button><span>Trang ${notificationPage} / ${pages}</span><button data-notification-page="${notificationPage+1}" ${notificationPage>=pages?"disabled":""}>›</button></nav></footer>`:""}</section></div>`;}

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
  const stats = getLmsOverviewStats();
  const summary = getImportSummary();
  const allAccounts = getAccounts();
  const allEmployees = getEmployees();
  const allCourses = getCourses();
  const allAttempts = getQuizAttempts ? getQuizAttempts() : [];

  // Recent employees (last 5 by createdAt)
  const recentAccounts = [...allAccounts]
    .filter(a => a.role === "employee")
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    .slice(0, 5);

  // Recent published courses (last 6)
  const recentCourses = [...allCourses]
    .filter(c => c.status === "published")
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    .slice(0, 6);

  // Pending grading items
  const pendingAttempts = allAttempts.filter(a => a.submittedAt && a.gradingStatus === "pendingManual").slice(0, 5);

  // Overdue enrollments count
  const overdueCount = stats.overdueEnrollments || 0;
  const pendingGradingCount = stats.pendingGrading || 0;
  const draftCourses = allCourses.filter(c => c.status === "draft");

  const actionItems = [
    ...pendingAttempts.map(a => ({ icon: "✏️", label: `Chấm bài tự luận`, sub: `Quiz chờ chấm điểm`, href: "/admin/quizzes" })),
    ...(overdueCount > 0 ? [{ icon: "⚠️", label: `${overdueCount} lượt học quá hạn`, sub: "Nhân viên chưa hoàn thành đúng deadline", href: "/admin/assign" }] : []),
    ...(draftCourses.length > 0 ? [{ icon: "📝", label: `${draftCourses.length} khóa học bản nháp`, sub: "Chưa publish cho nhân viên", href: "/admin/courses" }] : []),
    ...((summary.invalidEmails + summary.duplicateEmails) > 0 ? [{ icon: "🔍", label: "Dữ liệu cần kiểm tra", sub: `${summary.invalidEmails} email không hợp lệ · ${summary.duplicateEmails} email trùng`, href: "/admin/employees" }] : []),
  ].slice(0, 7);

  const actionHtml = actionItems.length
    ? actionItems.map(item => `<a class="action-item-row" href="${item.href}" data-link><span class="action-item-row__icon">${item.icon}</span><span><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.sub)}</small></span><span class="action-item-row__arrow">›</span></a>`).join("")
    : `<div class="empty-state" style="padding:16px"><p>Không có việc cần xử lý.</p></div>`;

  const recentCourseHtml = recentCourses.length
    ? recentCourses.map(c => `<div class="overview-course-row"><span class="badge ${c.status==="published"?"active":"draft"}">${c.status==="published"?"Đang mở":"Nháp"}</span><span class="overview-course-row__title">${escapeHtml(c.title)}</span><a class="btn btn-outline mini-action" href="/admin/courses" data-link>Xem</a></div>`).join("")
    : `<p style="color:var(--muted);padding:12px">Chưa có khóa học.</p>`;

  const recentEmpHtml = recentAccounts.length
    ? recentAccounts.map(a => { const emp = allEmployees.find(e => e.id === a.employeeId); return `<div class="overview-emp-row">${employeeAvatar(a, emp, "avatar avatar--sm")}<div><strong>${escapeHtml(a.fullName)}</strong><small>${escapeHtml(emp?.position||emp?.jobTitle||"")}${emp?.department?` · ${escapeHtml(emp.department)}`:""}</small></div></div>`; }).join("")
    : `<p style="color:var(--muted);padding:12px">Chưa có nhân viên.</p>`;

  return `
    <div class="${compact ? "dashboard-preview" : "app-layout"}">${sideNav("hr")}<main class="app-main">${topbar("HR Admin Dashboard", "Quản trị đào tạo nội bộ", "hr")}<div class="content">
      <div class="kpi-grid">
        <div class="card kpi"><span class="label">${overviewText("activeEmployees")}</span><strong>${stats.totalActiveEmployees}</strong><small>${allEmployees.length - stats.totalActiveEmployees > 0 ? `${stats.totalActiveEmployees} đang hoạt động · ${allEmployees.length - stats.totalActiveEmployees} tạm khóa` : "Sẵn sàng tham gia đào tạo"}</small></div>
        <div class="card kpi"><span class="label">${overviewText("publishedCourses")}</span><strong>${stats.totalPublishedCourses}</strong></div>
        <div class="card kpi"><span class="label">${overviewText("completionRate")}</span><strong>${stats.completionRate}%</strong></div>
        <div class="card kpi"><span class="label">${t("quiz.passRate")}</span><strong>${stats.quizPassRate}%</strong></div>
        <div class="card kpi"><span class="label">Quá hạn</span><strong>${overdueCount}</strong></div>
        <div class="card kpi"><span class="label">${t("quiz.pendingGrading")}</span><strong>${pendingGradingCount}</strong></div>
      </div>
      <div class="overview-grid">
        <section class="card panel"><div class="panel-head"><h3>Việc cần xử lý</h3></div>${actionHtml}</section>
        <section class="card panel"><div class="panel-head"><h3>Khóa học gần đây</h3><a class="btn btn-outline mini-action" href="/admin/courses" data-link>Xem tất cả</a></div>${recentCourseHtml}</section>
      </div>
      <div class="overview-grid">
        <section class="card panel"><div class="panel-head"><h3>Nhân viên mới gần đây</h3><a class="btn btn-outline mini-action" href="/admin/employees" data-link>Xem tất cả nhân viên</a></div>${recentEmpHtml}</section>
        <section class="card panel data-quality-alert"><div class="panel-head"><h3>${t("admin.dataReviewTitle")}</h3></div><p>${t("admin.invalidEmails")}: <strong>${summary.invalidEmails}</strong> · ${t("admin.duplicateEmails")}: <strong>${summary.duplicateEmails}</strong></p><button class="btn btn-outline" data-review-issues>${t("admin.reviewIssues")}</button></section>
      </div>
    </div></main>${employeeFormModal()}</div>
  `;
}

function sideNav(role) {
  const groups = role === "hr"
    ? [["Tổng quan",[["/admin","overview"],["/admin/reports","reports"]]],["Đào tạo",[["/admin/courses","courses"],["/admin/sessions","sessions"],["/admin/assign","assign"],["/admin/quizzes","quizzes"],["/admin/gallery","gallery"],["/admin/notifications","notifications"]]],["Nhân sự",[["/admin/employees","employees"],["/admin/accounts","accounts"]]]]
    : [["Học tập",[["/dashboard","overview"],["/dashboard/courses","courses"],["/dashboard/quizzes","quizzes"],["/dashboard/calendar","calendar"],["/dashboard/history","history"]]],["Thư viện",[["/dashboard/resources","resources"],["/dashboard/gallery","gallery"]]]];
  const items=groups.flatMap(x=>x[1]);
  const activeIndex = items.reduce((bestIndex, [href], index) => {
    const isActive = route === href || (href !== "/" && route.startsWith(`${href}/`));
    if (!isActive) return bestIndex;
    return bestIndex < 0 || href.length > items[bestIndex][0].length ? index : bestIndex;
  }, -1);
  let cursor=0; return `<aside class="app-sidebar">${sidebarBrand()}<nav class="side-nav" aria-label="${t("nav.dashboard")}">${groups.map(([label,links])=>`<span class="side-nav__group">${label}</span>${links.map(([href,key])=>{const index=cursor++; const labels={gallery:"Ảnh",resources:"Tài liệu",history:"Lịch sử học tập",calendar:"Lịch học"};return `<a class="${index===activeIndex?"active":""}" ${index===activeIndex?'aria-current="page"':""} href="${href}" data-link>${labels[key]|| (key==="quizzes"?t("quiz.quizzes"):key==="notifications"?notificationText("title"):t(`admin.${key}`))}</a>`}).join("")}`).join("")}</nav></aside>`;
}

function sidebarBrand() { return `<div class="sidebar-brand"><a href="/" data-link class="sidebar-brand__link" aria-label="MyKIS Learning"><img src="/assets/kis-logo-white.png" alt="KIS Vietnam" class="sidebar-brand__logo"><span class="sidebar-brand__name">MyKIS Learning</span></a></div>`; }

function employeeAvatar(account, employee, className="avatar") { const name=employee?.fullName||account?.fullName||account?.email?.split("@")[0]||uiText("employeeFallback"); return `<span class="${className} employee-avatar" data-photo-blob-id="${escapeHtmlAttribute(employee?.photoBlobId||"")}" data-photo-url="${escapeHtmlAttribute(employee?.photoUrl||"")}" data-photo-key="${escapeHtmlAttribute(account?.employeeCode||account?.email?.split("@")[0]||"")}" aria-label="${escapeHtmlAttribute(name)}"><span>${initials(name)}</span></span>`; }
function greeting(name){return uiText("greeting").replace("{name}",name);}

function topbar(label, title, role, avatarText = "") {
  const currentAccount = session?.accountId ? getAccountById(session.accountId) : null;
  const currentEmployee = currentAccount?.role === "employee" ? getEmployeeByAccountId(currentAccount.id) : null;
  const currentAvatarText = initials(currentAccount?.fullName || currentAccount?.name || session?.fullName || "");
  const fullName=currentAccount?.fullName||session?.fullName||t(`roles.${role}`);
  const jobTitle=currentEmployee?.jobTitle||currentEmployee?.position||currentEmployee?.title||currentAccount?.position||"";
  const dept=currentEmployee?.department||currentAccount?.department||"";
  const meta = role==="employee" ? (jobTitle||dept||t("roles.employee")) : (dept||t(`roles.${role}`));
  return `<div class="topbar"><div class="topbar__title"><span class="label">${label}</span><h2>${title}</h2></div><div class="topbar-actions">${languageSwitcher()}<div class="topbar-user-identity">${role === "employee" ? employeeAvatar(currentAccount,currentEmployee,"topbar-user__avatar") : `<span class="avatar">${avatarText||currentAvatarText||"HR"}</span>`}<span class="topbar-user__identity"><strong>${escapeHtml(fullName)}</strong><small>${escapeHtml(meta)}</small></span></div><button type="button" class="topbar-logout-btn" data-logout aria-label="${uiText("logout")}" title="${uiText("logout")}"><span class="topbar-logout-btn__icon" aria-hidden="true">↪</span><span class="topbar-logout-btn__text">${uiText("logout")}</span></button></div></div>`;
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
  return `<div class="modal-backdrop open"><div class="card modal modal--large" role="dialog" aria-modal="true"><div class="modal-head"><div><span class="eyebrow">${t("admin.accounts")}</span><h2>${escapeHtml(a.fullName)}</h2></div><button class="icon-btn" data-close-drawer>×</button></div><div class="profile-grid">${rows.map(([k, v]) => `<div class="profile-item"><span>${t(`table.${k}`)}</span><strong>${v}</strong></div>`).join("")}</div><div class="security-actions" style="margin-top:16px"><button class="btn btn-primary" data-reset-account="${a.id}">${t("admin.resetPassword")}</button><button class="btn btn-outline" data-force-account="${a.id}">${t("admin.forcePassword")}</button><button class="btn btn-outline" data-unlock-account="${a.id}">${t("admin.unlock")}</button><button class="btn btn-outline" data-disable-account="${a.id}">${t("admin.disable")}</button><button class="btn btn-outline" data-resend-account="${a.id}">${t("admin.resend")}</button></div><h3 style="margin-top:20px">${t("admin.auditLog")}</h3><div class="audit-list">${logs.map((l) => `<div><strong>${l.action}</strong><span>${l.createdAt} · ${l.description}</span></div>`).join("")}</div></div></div>`;
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
  return `<div class="app-layout">${sideNav("hr")}<main class="app-main">${topbar("Admin", t("admin.employees"), "hr")}<div class="content">${hrEmployeeDirectory()}</div></main>${accountDrawer()}${employeeFormModal()}</div>`;
}
function employeeFormModal(){if(!employeeFormOpen)return "";if(employeeCreateResult)return `<div class="modal-backdrop open"><section class="modal modal--large modal--structured" role="dialog" aria-modal="true"><header class="modal__header"><div><span class="eyebrow">Hoàn tất</span><h2>Tài khoản đã được tạo</h2></div><button class="icon-btn" data-close-employee-form>×</button></header><div class="modal__body"><div class="creation-success"><p><strong>${escapeHtml(employeeCreateResult.account.fullName)}</strong></p><p>Email: ${escapeHtml(employeeCreateResult.account.email)}</p><div class="temp-password-box"><div><span>Mật khẩu tạm thời</span><strong>${escapeHtml(employeeCreateResult.temporaryPassword)}</strong></div><button class="btn btn-outline" data-copy-created-account>Sao chép thông tin</button></div><p>Nhân viên phải đổi mật khẩu trong lần đăng nhập đầu tiên. Hệ thống chưa gửi email tự động.</p></div></div><footer class="modal__footer"><button class="btn btn-primary" data-close-employee-form>Đóng</button><a class="btn btn-outline" href="/admin/assign?accountId=${employeeCreateResult.account.id}&open=1" data-link>Giao khóa onboarding</a></footer></section></div>`;return `<div class="modal-backdrop open"><form id="employeeCreateForm" class="modal modal--xlarge modal--structured" role="dialog" aria-modal="true" aria-labelledby="employee-form-title"><header class="modal__header"><div><span class="eyebrow">Hồ sơ & tài khoản</span><h2 id="employee-form-title">Thêm nhân viên</h2></div><button type="button" class="icon-btn" data-close-employee-form>×</button></header><div class="modal__body"><div class="employee-form-grid"><section><h3>Thông tin bắt buộc</h3><div class="form-2col"><div class="field"><label>Mã nhân viên *</label><input name="employeeCode" required autocomplete="off"><span class="field-error" data-error-for="employeeCode"></span></div><div class="field"><label>Họ và tên *</label><input name="fullName" required></div><div class="field"><label>Email công ty *</label><input name="email" type="email" required></div><div class="field"><label>Ngày vào làm</label><input name="joinDate" type="date"></div><div class="field"><label>Phòng ban *</label><input name="department" list="departments" required><datalist id="departments">${uniqueValues(getEmployees(),"department").map(x=>`<option value="${escapeHtmlAttribute(x)}">`).join("")}</datalist></div><div class="field"><label>Chức danh *</label><input name="position" list="positions" required><datalist id="positions">${uniqueValues(getEmployees(),"position").map(x=>`<option value="${escapeHtmlAttribute(x)}">`).join("")}</datalist></div><div class="field"><label>Ngôn ngữ mặc định</label><select name="defaultLanguage"><option value="vi">VI</option><option value="en">EN</option><option value="kr">KR</option></select></div><div class="field"><label>Trạng thái</label><select name="accountStatus"><option value="active">Kích hoạt</option><option value="pendingActivation">Chờ kích hoạt</option></select></div></div></section><aside><h3>Ảnh đại diện</h3><label class="employee-photo-drop" for="newEmployeePhoto"><span class="employee-photo-preview">Ảnh</span><strong>Chọn hoặc thả ảnh vào đây</strong><small>JPG, PNG, WebP · tối đa 5 MB</small></label><input id="newEmployeePhoto" name="photo" type="file" accept="image/jpeg,image/png,image/webp" hidden><div class="field"><label>Quản lý trực tiếp</label><input name="managerName"></div><div class="field"><label>Địa điểm làm việc</label><input name="location"></div><div class="field"><label>Ghi chú</label><textarea name="notes" rows="3"></textarea></div></aside></div><p class="form-note">Role được cố định là Employee. Mật khẩu tạm thời chỉ hiển thị một lần sau khi tạo.</p><div class="field-error" data-employee-form-error role="alert"></div></div><footer class="modal__footer"><button type="button" class="btn btn-outline" data-close-employee-form>Hủy</button><button type="submit" class="btn btn-primary">Tạo hồ sơ & tài khoản</button></footer></form></div>`;}

function employeeTable() {
  return employeeDirectoryTable(filteredEmployeeDirectory().slice(0, 15));
}

function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

function normalizeYoutubeId(input) {
  if (!input) return "";
  const s = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : s;
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
  return `<div class="modal-backdrop open"><div class="card modal modal--large" role="dialog" aria-modal="true"><div class="modal-head"><div><span class="eyebrow">${t("content.courseTitle")}</span><h2>${escapeHtml(course.title)}</h2></div><button type="button" class="icon-btn" data-close-course-drawer>×</button></div><div class="modal-col-layout"><div class="modal-col"><div class="profile-grid">${rows.map(([label, value]) => `<div class="profile-item"><span>${label}</span><strong>${value}</strong></div>`).join("")}</div><div class="card" style="margin-top:16px"><h3>${t("course.description")}</h3><p>${escapeHtml(course.description || "—")}</p></div><div class="security-actions" style="margin-top:16px"><button type="button" class="btn btn-primary" data-course-edit="${escapeHtmlAttribute(course.id)}">${t("content.editInfo")}</button><a class="btn btn-outline" href="/admin/assign?courseId=${encodeURIComponent(course.id)}&open=1" data-link>${t("enrollment.assign")}</a></div></div><div class="modal-col"><div class="panel-head"><h3>${t("content.title")} (${content.length})</h3><button type="button" class="btn btn-primary" data-content-add>${t("content.add")}</button></div><div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">${content.length ? contentRows : `<p style="color:var(--color-muted)">${t("content.noContent")}</p>`}</div><h3 style="margin-top:20px">${t("content.enrolledEmployees")} (${enrollments.length})</h3>${enrollments.length ? `<div class="table-wrap"><table><thead><tr><th>${t("table.fullName")}</th><th>${t("table.status")}</th><th>${t("enrollment.progress")}</th></tr></thead><tbody>${enrollments.map((enrollment) => { const account = getAccountById(enrollment.accountId); const prog = calculateCourseProgress({accountId:enrollment.accountId,courseId:course.id}); return `<tr><td>${escapeHtml(account?.fullName || enrollment.accountId)}</td><td>${badge(enrollment.status)}</td><td>${prog.percent}%</td></tr>`; }).join("")}</tbody></table></div>` : `<p>${t("content.noEnrolled")}</p>`}</div></div></div></div>`;
}

function contentItemForm() {
  if (!contentBuilderMode) return "";
  const isEdit = contentBuilderMode === "edit";
  const item = isEdit ? getCourseContent(selectedCourseId).find(x => x.id === selectedContentId) : null;
  if (isEdit && item) {
    if (item.type === "video") return contentYoutubeForm(item);
    if (item.type === "quiz") return contentQuizPickForm();
    return contentSlideOrTextForm(item);
  }
  if (contentPickerStep === "type") return contentTypePicker();
  if (contentPickerStep === "slide") return contentSlideOrTextForm(null);
  if (contentPickerStep === "youtube") return contentYoutubeForm(null);
  if (contentPickerStep === "quiz-pick") return contentQuizPickForm();
  if (contentPickerStep === "text") return contentSlideOrTextForm(null, true);
  return contentTypePicker();
}

function updateYtPreview(rawUrl) {
  const vid = normalizeYoutubeId(rawUrl || "");
  const errEl = document.getElementById("ytUrlError");
  const previewWrap = document.getElementById("ytPreviewWrap");
  const vidIdEl = document.getElementById("ytVideoIdDisplay");
  if (!rawUrl || !rawUrl.trim()) {
    if (errEl) { errEl.textContent=""; errEl.classList.remove("show"); }
    if (previewWrap) previewWrap.innerHTML = `<p style="color:var(--muted);text-align:center;padding:20px;font-size:13px">${t("contentType.preview")}</p>`;
    if (vidIdEl) vidIdEl.textContent = "";
    return;
  }
  if (!vid || !/^[a-zA-Z0-9_-]{11}$/.test(vid)) {
    if (errEl) { errEl.textContent = "URL YouTube không hợp lệ"; errEl.classList.add("show"); }
    if (previewWrap) previewWrap.innerHTML = "";
    if (vidIdEl) vidIdEl.textContent = "";
    return;
  }
  if (errEl) { errEl.textContent=""; errEl.classList.remove("show"); }
  if (vidIdEl) vidIdEl.innerHTML = `Video ID: <code style="background:#e8edf3;padding:2px 6px;border-radius:4px">${escapeHtml(vid)}</code>`;
  if (previewWrap) previewWrap.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${escapeHtml(vid)}" loading="lazy" allowfullscreen></iframe>`;
}

function renderQuizPickResults() {
  const container = document.getElementById("quizPickResults");
  if (!container) return;
  const allQ = getQuizzes();
  const q = quizPickSearch.trim().toLowerCase();
  const filtered = (q ? allQ.filter(x => (x.title||"").toLowerCase().includes(q) || (x.description||"").toLowerCase().includes(q)) : allQ).slice(0, 60);
  if (!filtered.length) { container.innerHTML = `<p style="color:var(--muted);text-align:center;padding:16px">${t("contentType.noResults")}</p>`; return; }
  container.innerHTML = filtered.map(quiz => `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)"><div style="flex:1;min-width:0"><strong style="font-size:13px">${escapeHtml(quiz.title)}</strong><div style="font-size:11px;color:var(--muted);margin-top:2px">${(quiz.questions||[]).length} câu · Điểm đạt: ${quiz.passingScore||70}% · ${quiz.timeLimitMinutes||20} phút</div></div><button type="button" class="btn btn-primary mini-action" data-select-quiz-for-content="${escapeHtmlAttribute(quiz.id)}">${t("contentType.select")}</button></div>`).join("");
  container.querySelectorAll("[data-select-quiz-for-content]").forEach(el => el.addEventListener("click", () => {
    const quiz = getQuizById(el.dataset.selectQuizForContent);
    if (!quiz) return toast("error");
    const payload = { courseId: selectedCourseId, title: quiz.title, type: "quiz", quizId: quiz.id, required: true, completionWeight: 1, completionRule: { requirePass: true } };
    const result = createCourseContent(payload);
    if (!result) return toast("error");
    contentBuilderMode=""; selectedContentId=""; contentPickerStep="type"; quizPickSearch="";
    toast("success"); render();
  }));
}

function contentTypePicker() {
  const types = [
    { key:"slide", icon:"📄", label:t("contentType.slide"), desc:t("contentType.slideDesc") },
    { key:"youtube", icon:"▶️", label:t("contentType.youtube"), desc:t("contentType.youtubeDesc") },
    { key:"quiz-pick", icon:"❓", label:t("contentType.quiz"), desc:t("contentType.quizDesc") },
    { key:"text", icon:"📝", label:t("contentType.text"), desc:t("contentType.textDesc") },
  ];
  return `<div class="modal-backdrop open"><section class="modal modal--medium modal--structured" role="dialog" aria-modal="true" aria-labelledby="ct-title"><header class="modal__header"><div><span class="eyebrow">${t("content.title")}</span><h2 id="ct-title">${t("contentType.selectType")}</h2></div><button type="button" class="icon-btn" data-content-form-close>×</button></header><div class="modal__body"><div class="content-type-grid">${types.map(tp=>`<button type="button" class="ct-card" data-pick-content-type="${tp.key}"><span class="ct-icon">${tp.icon}</span><span class="ct-label">${tp.label}</span><span class="ct-desc">${tp.desc}</span></button>`).join("")}</div></div></section></div>`;
}

function contentYoutubeForm(item) {
  const vid = item?.youtubeVideoId || youtubeDraft?.videoId || "";
  const titleVal = escapeHtmlAttribute(item?.title || youtubeDraft?.title || "");
  const urlVal = escapeHtmlAttribute(vid ? `https://youtu.be/${vid}` : youtubeDraft?.url || "");
  return `<div class="modal-backdrop open"><form class="modal modal--large modal--structured" id="contentYoutubeForm" role="dialog" aria-modal="true" aria-labelledby="yt-title" novalidate><header class="modal__header"><div><span class="eyebrow">${t("content.title")}</span><h2 id="yt-title">${t("contentType.youtube")}</h2></div><button type="button" class="icon-btn" data-content-form-close>×</button></header><div class="modal__body"><div class="field"><label>${t("course.title")} <span style="color:#c0392b">*</span></label><input id="ytTitleInput" name="title" value="${titleVal}" required autocomplete="off" data-focus-key="yt-title" placeholder="Tên bài học..."></div><div class="field"><label>URL YouTube <span style="color:#c0392b">*</span></label><input id="ytUrlInput" name="youtubeUrl" value="${urlVal}" placeholder="https://www.youtube.com/watch?v=... hoặc youtu.be/..." autocomplete="off" data-focus-key="yt-url"><div id="ytUrlError" class="field-error"></div><div id="ytVideoIdDisplay" style="font-size:12px;color:var(--muted);margin-top:4px"></div></div><div id="ytPreviewWrap" class="yt-preview-wrap" style="max-width:480px"><p style="color:var(--muted);text-align:center;padding:20px;font-size:13px">Nhập URL để xem preview</p></div><div class="form-2col" style="margin-top:14px"><div class="field"><label><input type="checkbox" name="required" ${item?.required!==false?"checked":""}> ${t("content.requiredCheck")}</label></div><div class="field"><label>${t("content.weight")}</label><input name="completionWeight" type="number" min="0.1" step="0.1" value="${item?.completionWeight??1}"></div></div><div class="form-2col"><div class="field"><label>${t("content.requiredPercent")} (%)</label><input name="requiredPercent" type="number" min="0" max="100" value="${item?.completionRule?.requiredPercent??90}"></div><div class="field"><label>${t("content.minDuration")} (s)</label><input name="minimumDurationSeconds" type="number" min="0" value="${item?.minimumDurationSeconds||0}"></div></div><div class="field"><label>${t("content.transcript")}</label><textarea name="transcript" rows="2" data-focus-key="yt-transcript">${escapeHtml(item?.transcript||"")}</textarea></div><div class="field"><label><input type="checkbox" name="transcriptAlternativeAllowed" ${item?.transcriptAlternativeAllowed!==false?"checked":""}> ${t("content.transcriptAllowed")}</label></div></div><footer class="modal__footer"><button type="button" class="btn btn-outline" data-content-form-close>${t("content.cancel")}</button><button type="button" class="btn btn-outline" id="ytUseSample">${t("contentType.useSampleVideo")}</button><button type="submit" class="btn btn-primary">${t("content.save")}</button></footer></form></div>`;
}

function contentSlideOrTextForm(item, isText) {
  const sd = slideDraft;
  const thumbs = sd?.thumbs || [];
  const showText = isText || (item && !item.blobId && item.slideContent);

  const thumbHtml = thumbs.length ? `<div class="slide-thumb-grid">${thumbs.map((u,i)=>`<div class="slide-thumb"><img src="${escapeHtmlAttribute(u)}" alt="${i+1}"><span class="sn">${i+1}</span></div>`).join("")}</div>` : "";

  const fileSection = !showText ? `<div class="drop-zone" id="slideDropZone" tabindex="0"><span class="drop-zone-icon">📂</span><strong>${t("contentType.dropOrBrowse")}</strong><br><small style="color:var(--muted)">${t("contentType.slideAccept")}</small><input type="file" id="slideFileInput" accept=".pdf,.pptx,.png,.jpg,.jpeg,.webp" multiple style="display:none"></div>${sd?.fileName?`<div class="file-info-box"><span class="fi-icon">📄</span><div><div class="fi-name">${escapeHtml(sd.fileName)}</div><div class="fi-meta">${sd.fileSize} · ${sd.fileType}${sd.pageCount&&sd.pageCount!=="?"?` · ${sd.pageCount} ${t("contentType.pages")}`:""}</div>${sd.pptxWarning?`<div style="color:#e67e22;font-size:12px;margin-top:4px">${t("contentType.pptxNote")}</div>`:""}</div></div>${thumbHtml}`:""}` : "";

  const textSection = showText ? `<div class="field"><label>Nội dung bài đọc</label><textarea name="slideContent" rows="10" data-focus-key="slide-text">${escapeHtml(item?.slideContent||"")}</textarea></div>` : "";

  return `<div class="modal-backdrop open"><form class="modal modal--large modal--structured" id="contentSlideForm" role="dialog" aria-modal="true" aria-labelledby="slide-title" novalidate><header class="modal__header"><div><span class="eyebrow">${t("content.title")}</span><h2 id="slide-title">${showText?t("contentType.text"):t("contentType.slide")}</h2></div><button type="button" class="icon-btn" data-content-form-close>×</button></header><div class="modal__body"><div class="field"><label>${t("course.title")} <span style="color:#c0392b">*</span></label><input id="slideTitleInput" name="title" value="${escapeHtmlAttribute(item?.title||sd?.title||"")}" required autocomplete="off" data-focus-key="slide-title-inp" placeholder="Tên bài học..."><input type="hidden" name="type" value="slide"><input type="hidden" name="isText" value="${showText?'1':'0'}"></div><div class="field"><label>${t("course.description")}</label><textarea name="description" rows="2" data-focus-key="slide-desc">${escapeHtml(item?.slideContent&&!showText?item.slideContent:"")}</textarea></div>${fileSection}${textSection}<div id="slideError" class="field-error"></div><div class="form-2col" style="margin-top:12px"><div class="field"><label>${t("content.minDuration")} (s)</label><input name="minimumDurationSeconds" type="number" min="0" value="${item?.minimumDurationSeconds||sd?.minDuration||8}"></div><div class="field"><label>${t("content.weight")}</label><input name="completionWeight" type="number" min="0.1" step="0.1" value="${item?.completionWeight||1}"></div></div><div class="field"><label><input type="checkbox" name="required" ${item?.required!==false?"checked":""}> ${t("content.requiredCheck")}</label></div></div><footer class="modal__footer"><button type="button" class="btn btn-outline" data-content-form-close>${t("content.cancel")}</button><button type="submit" class="btn btn-primary">${t("content.save")}</button></footer></form></div>`;
}

function contentQuizPickForm() {
  const allQ = getQuizzes();
  const filtered = quizPickSearch.trim() ? allQ.filter(x=>(x.title||"").toLowerCase().includes(quizPickSearch.toLowerCase())) : allQ.slice(0,60);
  return `<div class="modal-backdrop open"><section class="modal modal--large modal--structured" role="dialog" aria-modal="true" aria-labelledby="qpick-title"><header class="modal__header"><div><span class="eyebrow">${t("content.title")}</span><h2 id="qpick-title">${t("contentType.quiz")}</h2></div><button type="button" class="icon-btn" data-content-form-close>×</button></header><div class="modal__body"><div class="quiz-pick-tabs"><button type="button" class="quiz-pick-tab active">${t("contentType.pickExisting")}</button><a href="/admin/quizzes" data-link class="quiz-pick-tab" style="text-decoration:none">${t("contentType.createNew")} →</a></div><div class="field"><input id="quizPickSearchInput" data-focus-key="quiz-pick-search" placeholder="${t("admin.search")}" value="${escapeHtmlAttribute(quizPickSearch)}" autocomplete="off"></div><div id="quizPickResults">${filtered.length?filtered.map(quiz=>`<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)"><div style="flex:1;min-width:0"><strong style="font-size:13px">${escapeHtml(quiz.title)}</strong><div style="font-size:11px;color:var(--muted);margin-top:2px">${(quiz.questions||[]).length} câu · ${quiz.passingScore||70}% · ${quiz.timeLimitMinutes||20} phút</div></div><button type="button" class="btn btn-primary mini-action" data-select-quiz-for-content="${escapeHtmlAttribute(quiz.id)}">${t("contentType.select")}</button></div>`).join("") : `<p style="color:var(--muted);text-align:center;padding:16px">${t("contentType.noResults")}</p>`}</div></div><footer class="modal__footer"><button type="button" class="btn btn-outline" data-content-form-close>${t("content.cancel")}</button></footer></section></div>`;
}

async function handleSlideFiles(files) {
  if (!files || !files.length) return;
  const errEl = document.getElementById("slideError");
  const LIMIT = 50 * 1024 * 1024;
  const file = files[0];
  const ext = file.name.split(".").pop().toLowerCase();

  if (!["pdf","pptx","png","jpg","jpeg","webp"].includes(ext)) {
    if (errEl) { errEl.textContent = t("contentType.fileInvalid"); errEl.classList.add("show"); } return;
  }
  if (file.size > LIMIT) {
    if (errEl) { errEl.textContent = t("contentType.fileTooLarge"); errEl.classList.add("show"); } return;
  }
  if (errEl) { errEl.textContent=""; errEl.classList.remove("show"); }

  slideDraft = {
    file, fileName: file.name,
    fileSize: `${(file.size/1024/1024).toFixed(1)} MB`,
    fileType: ext.toUpperCase(),
    pageCount: 1, thumbs: [],
    title: file.name.replace(/\.[^.]+$/, ""),
    minDuration: 8, weight: 1,
  };

  const titleInput = document.getElementById("slideTitleInput");
  if (titleInput && !titleInput.value) titleInput.value = slideDraft.title;

  if (["png","jpg","jpeg","webp"].includes(ext)) {
    for (const f of Array.from(files)) {
      const fext = f.name.split(".").pop().toLowerCase();
      if (!["png","jpg","jpeg","webp"].includes(fext)) continue;
      slideDraft.thumbs.push(URL.createObjectURL(f));
    }
    slideDraft.pageCount = slideDraft.thumbs.length;
    if (files.length > 1) slideDraft.fileName = `${files.length} ảnh`;
    render();
    return;
  }

  if (ext === "pptx") {
    slideDraft.pageCount = "?";
    slideDraft.pptxWarning = true;
    render();
    return;
  }

  if (ext === "pdf") {
    render();
    await renderPdfThumbs(file);
  }
}

async function renderPdfThumbs(file) {
  try {
    if (!window.pdfjsLib) {
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js";
        s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
      });
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
    }
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    if (slideDraft) { slideDraft.pageCount = pdf.numPages; slideDraft.thumbs = []; }
    const maxThumbs = Math.min(pdf.numPages, 12);
    for (let i = 1; i <= maxThumbs; i++) {
      const page = await pdf.getPage(i);
      const vp = page.getViewport({ scale: 0.3 });
      const canvas = document.createElement("canvas");
      canvas.width = vp.width; canvas.height = vp.height;
      await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
      if (slideDraft) slideDraft.thumbs.push(canvas.toDataURL("image/jpeg", 0.7));
    }
    render();
  } catch (err) {
    const errEl = document.getElementById("slideError");
    if (errEl) { errEl.textContent = t("contentType.fileReadError"); errEl.classList.add("show"); }
  }
}

function courseFormModal() {
  const course = courseFormMode === "edit" ? getCourseById(selectedCourseId) : null;
  if (courseFormMode === "edit" && !course) return "";
  const value = (field, fallback = "") => escapeHtmlAttribute(course?.[field] ?? fallback);
  const option = (field, optionValue, fallback = "") => (course?.[field] ?? fallback) === optionValue ? "selected" : "";
  return `<div class="modal-backdrop open"><form class="modal modal--medium modal--structured" id="courseForm" role="dialog" aria-modal="true" aria-labelledby="course-form-title"><header class="modal__header"><div><span class="eyebrow">Quản lý khóa học</span><h2 id="course-form-title">${courseFormMode === "edit" ? "Chỉnh sửa khóa học" : "Tạo khóa học"}</h2></div><button type="button" class="icon-btn" data-close-course-form>×</button></header><div class="modal__body"><div class="field"><label>Tên khóa học</label><input name="title" type="text" value="${value("title")}" required></div><div class="field"><label>Mô tả</label><textarea name="description" rows="3">${escapeHtml(course?.description || "")}</textarea></div><div class="field"><label>Danh mục</label><select name="category">${["Kỹ năng mềm", "Chuyên môn", "Chứng chỉ", "Onboarding"].map((item) => `<option value="${escapeHtmlAttribute(item)}" ${option("category", item, "Kỹ năng mềm")}>${item}</option>`).join("")}</select></div><div class="field"><label>Hình thức</label><select name="format">${["Online", "Offline", "Hybrid"].map((item) => `<option value="${item}" ${option("format", item, "Online")}>${item}</option>`).join("")}</select></div><div class="field"><label>Thời lượng (giờ)</label><input name="durationHours" type="number" min="0" step="0.5" value="${value("durationHours", 0)}" required></div><div class="field"><label>Trạng thái</label><select name="status"><option value="draft" ${option("status", "draft", "draft")}>Bản nháp</option><option value="published" ${option("status", "published")}>Đã xuất bản</option></select></div></div><footer class="modal__footer"><button type="button" class="btn btn-outline" data-close-course-form>Hủy</button><button type="submit" class="btn btn-primary">Lưu</button></footer></form></div>`;
}

function coursesPage() {
  if (!hasAdminAccess()) return restrictedPage();
  const allCourses = getCourses();
  const categories = [...new Set(allCourses.map((course) => course.category).filter(Boolean))];
  return `<div class="app-layout">${sideNav("hr")}<main class="app-main">${topbar("HR / L&D", t("course.manage"), "hr")}<div class="content"><section class="card panel"><div class="account-toolbar"><div><h2>${t("course.manage")}</h2><p>${t("course.manageDesc")}</p></div><button type="button" class="btn btn-primary" data-course-create>${t("course.create")}</button></div><div class="filter-bar"><input id="courseSearchInput" data-focus-key="course-search" type="search" placeholder="${t("course.searchPlaceholder")}" value="${escapeHtmlAttribute(courseSearch)}" data-course-search><select data-course-filter-category><option value="">${t("course.allCategories")}</option>${categories.map((category) => `<option value="${escapeHtmlAttribute(category)}" ${courseFilterCategory === category ? "selected" : ""}>${escapeHtml(category)}</option>`).join("")}</select><select data-course-filter-status><option value="">${t("enrollment.allStatuses")}</option><option value="published" ${courseFilterStatus === "published" ? "selected" : ""}>${t("course.published")}</option><option value="draft" ${courseFilterStatus === "draft" ? "selected" : ""}>${t("course.draft")}</option><option value="archived" ${courseFilterStatus === "archived" ? "selected" : ""}>${t("course.archived")}</option></select></div>${courseTable(filteredCourses())}</section></div>${courseDrawerOpen ? courseDrawer() : ""}${courseFormMode ? courseFormModal() : ""}${contentBuilderMode ? contentItemForm() : ""}</main></div>`;
}

function notificationText(key) {
  const values = {
    title:{vi:"Thông báo",en:"Notifications",kr:"알림"}, create:{vi:"Tạo thông báo",en:"Create notification",kr:"알림 만들기"},
    history:{vi:"Lịch sử gửi",en:"Delivery history",kr:"발송 내역"}, recipients:{vi:"Đối tượng nhận",en:"Recipients",kr:"수신자"},
    all:{vi:"Toàn bộ nhân viên",en:"All employees",kr:"전체 직원"}, department:{vi:"Theo phòng ban",en:"By department",kr:"부서별"},
    course:{vi:"Theo khóa học",en:"By course",kr:"교육 과정별"}, send:{vi:"Gửi ngay",en:"Send now",kr:"지금 보내기"},
    preview:{vi:"Xem trước",en:"Preview",kr:"미리보기"}, noData:{vi:"Chưa có thông báo",en:"No notifications yet",kr:"아직 알림이 없습니다"},
    emailUnavailable:{vi:"Chưa cấu hình dịch vụ email",en:"Email service is not configured",kr:"이메일 서비스가 구성되지 않았습니다"}
  }; return values[key]?.[language] || values[key]?.vi || key;
}

function notificationRecipients(type, value) {
  const accounts = getAccounts().filter(a=>a.role==="employee"&&a.accountStatus==="active");
  if(type==="department") return accounts.filter(a=>a.department===value).map(a=>a.id);
  if(type==="course") return getEnrollmentsByCourseId(value).map(e=>e.accountId).filter(id=>accounts.some(a=>a.id===id));
  return accounts.map(a=>a.id);
}

function notificationsPage() {
  if (!hasAdminAccess()) return restrictedPage();
  const history=getNotificationHistory().filter(n=>!notificationSearch||`${n.title} ${n.body}`.toLowerCase().includes(notificationSearch.toLowerCase()));
  return `<div class="app-layout">${sideNav("hr")}<main class="app-main">${topbar("HR / L&D",notificationText("title"),"hr")}<div class="content"><section class="card panel"><div class="account-toolbar"><div><h1>${notificationText("title")}</h1><p>${notificationText("history")}</p></div><button class="btn btn-primary" data-notification-create>${notificationText("create")}</button></div><div class="filter-bar"><input id="notificationSearch" data-focus-key="notification-search" type="search" value="${escapeHtmlAttribute(notificationSearch)}" placeholder="${t("admin.search")}" data-notification-search></div>${history.length?`<div class="table-wrap"><table><thead><tr><th>${t("course.title")}</th><th>${notificationText("recipients")}</th><th>${t("status.read")}</th><th>${t("table.createdAt")}</th><th>${t("course.status")}</th></tr></thead><tbody>${history.map(n=>`<tr><td><strong>${escapeHtml(n.title)}</strong><small class="table-subtext">${escapeHtml(n.body)}</small></td><td>${n.recipientCount}</td><td>${n.readCount} / ${n.recipientCount}</td><td>${escapeHtml(n.sentAt||n.createdAt)}</td><td><span class="badge active">${escapeHtml(n.status||"sent")}</span></td></tr>`).join("")}</tbody></table></div>`:`<div class="empty-state">${icon("message")}<h3>${notificationText("noData")}</h3></div>`}</section></div>${notificationComposerOpen?notificationComposer():""}</main></div>`;
}

function notificationComposer(){const departments=[...new Set(getAccounts().filter(a=>a.role==="employee").map(a=>a.department).filter(Boolean))];return `<div class="modal-backdrop open"><form id="notificationForm" class="modal modal--large modal--structured" role="dialog" aria-modal="true" aria-labelledby="notification-title"><header class="modal__header"><div><span class="eyebrow">HR / L&D</span><h2 id="notification-title">${notificationText("create")}</h2></div><button type="button" class="icon-btn" aria-label="Close" data-notification-close>×</button></header><div class="modal__body"><div class="form-2col"><div class="field"><label>${t("course.title")}</label><input name="title" required maxlength="160"></div><div class="field"><label>${t("course.category")}</label><select name="type"><option value="hr_announcement">HR</option><option value="deadline">Deadline</option><option value="course_updated">Course</option><option value="system">System</option></select></div></div><div class="field"><label>${t("course.description")}</label><textarea name="body" rows="6" required></textarea></div><fieldset class="recipient-fieldset"><legend>${notificationText("recipients")}</legend><div class="form-2col"><div class="field"><label>Type</label><select name="recipientType" data-recipient-type><option value="all">${notificationText("all")}</option><option value="department">${notificationText("department")}</option><option value="course">${notificationText("course")}</option></select></div><div class="field"><label>Department / Course</label><select name="recipientValue"><option value="">—</option><optgroup label="Department">${departments.map(d=>`<option value="${escapeHtmlAttribute(d)}">${escapeHtml(d)}</option>`).join("")}</optgroup><optgroup label="Course">${getCourses().filter(c=>c.status==="published").map(c=>`<option value="${c.id}">${escapeHtml(c.title)}</option>`).join("")}</optgroup></select></div></div></fieldset><div class="field"><label>CTA URL</label><input name="actionUrl" placeholder="/dashboard/courses"></div><div class="setting-row"><div><strong>Email</strong><small>${notificationText("emailUnavailable")}</small></div><button type="button" class="switch" role="switch" aria-checked="false" disabled><span></span></button></div></div><footer class="modal__footer"><button type="button" class="btn btn-outline" data-notification-close>${t("content.cancel")}</button><button class="btn btn-primary" type="submit">${notificationText("send")}</button></footer></form></div>`;}

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
  const deptEmployees = bulkDepartmentFilter ? accounts.filter(a=>a.department===bulkDepartmentFilter) : [];
  const deptPicker = `<div class="field"><label>${t("bulkAssign.selectDepartments")}</label><select data-bulk-department><option value="">— ${t("bulkAssign.selectDepartments")} —</option>${departments.map(d=>`<option value="${escapeHtmlAttribute(d)}" ${bulkDepartmentFilter===d?"selected":""}>${escapeHtml(d)} (${accounts.filter(a=>a.department===d).length})</option>`).join("")}</select></div>${bulkDepartmentFilter ? `<div style="background:#f0f7ff;border:1px solid var(--border);border-radius:8px;padding:14px;margin-top:8px"><p style="margin:0 0 10px"><strong>${deptEmployees.length}</strong> ${t("table.department")}: <strong>${escapeHtml(bulkDepartmentFilter)}</strong></p><div class="table-wrap" style="max-height:220px;overflow:auto"><table><thead><tr><th>${t("table.fullName")}</th><th>${t("table.email")}</th></tr></thead><tbody>${deptEmployees.map(a=>`<tr><td>${escapeHtml(a.fullName)}</td><td>${escapeHtml(a.email)}</td></tr>`).join("")}</tbody></table></div></div>` : `<p style="color:var(--muted);font-size:14px;margin-top:8px">Chọn phòng ban để xem danh sách nhân viên.</p>`}`;
  const indivPicker = `<div class="filter-bar"><input id="bulkSearchInput" data-focus-key="bulk-search" type="search" value="${escapeHtmlAttribute(bulkEmployeeSearch)}" placeholder="${t("admin.search")}" data-bulk-search><select data-bulk-department><option value="">${t("bulkAssign.selectDepartments")}</option>${departments.map(d=>`<option value="${escapeHtmlAttribute(d)}" ${bulkDepartmentFilter===d?"selected":""}>${escapeHtml(d)} (${accounts.filter(a=>a.department===d).length})</option>`).join("")}</select></div><div class="security-actions"><button type="button" class="btn btn-outline mini-action" data-select-visible>${t("bulkAssign.selectEmployees")}</button><button type="button" class="btn btn-outline mini-action" data-clear-bulk>${t("bulkAssign.noSelection")}</button></div><div class="table-wrap"><table><thead><tr><th></th><th>${t("table.fullName")}</th><th>${t("table.email")}</th><th>${t("table.department")}</th></tr></thead><tbody>${visible.map(a=>`<tr><td><input type="checkbox" aria-label="${escapeHtmlAttribute(a.fullName)}" data-bulk-account="${a.id}" ${bulkSelectedAccountIds.includes(a.id)?"checked":""}></td><td>${escapeHtml(a.fullName)}</td><td>${escapeHtml(a.email)}</td><td>${escapeHtml(a.department||"")}</td></tr>`).join("")}</tbody></table></div>`;
  const picker = assignMethod === "excel" ? `<div class="field"><label>${t("bulkAssign.uploadFile")}</label><input type="file" accept=".xls,.xlsx" data-bulk-excel></div>${excelPreviewRows.length ? bulkPreviewTable(excelPreviewRows) : ""}` : assignMethod === "department" ? deptPicker : indivPicker;
  return `<div class="modal-backdrop open"><form class="modal modal--large modal--structured" id="assignForm" role="dialog" aria-modal="true" aria-labelledby="assign-form-title"><header class="modal__header"><div><span class="eyebrow">HR / L&D</span><h2 id="assign-form-title">${t("bulkAssign.title")}</h2></div><button type="button" class="icon-btn" aria-label="Close" data-close-assign-modal>×</button></header><div class="modal__body"><div class="detail-tabs" role="tablist">${[["individual","individual"],["department","department"],["excel","excel"]].map(([v,k])=>`<button type="button" class="${assignMethod===v?"active":""}" data-assign-method="${v}" aria-selected="${assignMethod===v}">${t(`bulkAssign.${k}`)}</button>`).join("")}</div><div class="field"><label>${t("bulkAssign.selectCourse")}</label><select name="courseId" required><option value="">${t("bulkAssign.selectCourse")}</option>${publishedCourses.map(c=>`<option value="${c.id}" ${selectedCourseId===c.id?"selected":""}>${escapeHtml(c.title)}</option>`).join("")}</select></div>${picker}<p><strong>${t("bulkAssign.selectedCount")}: ${bulkSelectedAccountIds.length}</strong></p><div class="field"><label>${t("enrollment.deadline")}</label><input name="deadline" type="date" value="${getDefaultAssignmentDeadline()}" required></div><div class="field"><label>${t("table.note")}</label><textarea name="note" rows="3"></textarea></div></div><footer class="modal__footer"><button type="button" class="btn btn-outline" data-close-assign-modal>Hủy</button><button type="submit" class="btn btn-primary">${t("bulkAssign.confirm")}</button></footer></form></div>`;
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
  return `<div class="app-layout">${sideNav("hr")}<main class="app-main">${topbar("HR / L&D",t("quiz.quizzes"),"hr")}<div class="content"><div class="kpi-grid"><div class="card kpi"><span>${t("quiz.quizzes")}</span><strong>${quizzes.length}</strong></div><div class="card kpi"><span>${t("quiz.employeesCompleted")}</span><strong>${new Set(attempts.map(a=>a.accountId)).size}</strong></div><div class="card kpi"><span>${t("quiz.averageScore")}</span><strong>${avg}%</strong></div><div class="card kpi"><span>${t("quiz.passRate")}</span><strong>${pass}%</strong></div></div><div class="detail-tabs"><button class="${quizAdminView==="list"?"active":""}" data-quiz-admin-view="list">${t("quiz.quizzes")}</button><button class="${quizAdminView==="results"?"active":""}" data-quiz-admin-view="results">${t("quiz.result")}</button><button class="${quizAdminView==="leaderboard"?"active":""}" data-quiz-admin-view="leaderboard">${t("quiz.leaderboard")}</button><button class="${quizAdminView==="analytics"?"active":""}" data-quiz-admin-view="analytics">${t("quiz.analytics")}</button></div>${quizAdminView==="list"?`<section class="card panel"><div class="panel-head"><h3>${t("quiz.quizzes")}</h3><button class="btn btn-primary" data-quiz-create>${t("quiz.create")}</button></div><div class="filter-bar"><input id="quizSearchInput" data-focus-key="quiz-search" data-quiz-search placeholder="${t("admin.search")}" value="${escapeHtmlAttribute(quizSearch)}"><select data-quiz-course-filter><option value="">${t("nav.courses")}</option>${getCourses().map(c=>`<option value="${c.id}" ${quizCourseFilter===c.id?"selected":""}>${escapeHtml(c.title)}</option>`).join("")}</select><select data-quiz-status-filter><option value="">${t("course.status")}</option>${["draft","published","archived"].map(s=>`<option value="${s}" ${quizStatusFilter===s?"selected":""}>${t(`course.${s}`)}</option>`).join("")}</select></div>${quizzes.length?`<div class="table-wrap"><table><thead><tr><th>${t("quiz.title")}</th><th>${t("nav.courses")}</th><th>${t("course.status")}</th><th>${t("quiz.questions")}</th><th>${t("admin.action")}</th></tr></thead><tbody>${quizzes.map(q=>`<tr><td><strong>${escapeHtml(q.title)}</strong></td><td>${escapeHtml(getCourseById(q.courseId)?.title||"")}</td><td>${quizStatusBadge(q.status)}</td><td>${q.questions.length}</td><td><button class="btn btn-outline mini-action" data-quiz-edit="${q.id}">${t("quiz.edit")}</button><button class="btn btn-outline mini-action" data-quiz-delete="${q.id}">${t("quiz.delete")}</button></td></tr>`).join("")}</tbody></table></div>`:`<div class="empty-state"><h3>${t("quiz.noQuiz")}</h3></div>`}</section>`:quizAdminView==="results"?quizResultsPanel(attempts):quizAdminView==="leaderboard"?quizLeaderboard(attempts):quizAnalytics(attempts)}</div>${quizFormOpen?quizForm():""}</main></div>`;
}

function quizResultsPanel(attempts){return `<section class="card panel"><div class="panel-head"><h3>${t("quiz.result")}</h3><button class="btn btn-outline" data-quiz-export>${t("quiz.exportCsv")}</button></div><div class="table-wrap"><table><thead><tr><th>${t("table.fullName")}</th><th>${t("quiz.title")}</th><th>${t("quiz.score")}</th><th>${t("quiz.result")}</th><th>${t("admin.action")}</th></tr></thead><tbody>${attempts.map(a=>`<tr><td>${escapeHtml(getAccountById(a.accountId)?.fullName||"")}</td><td>${escapeHtml(getQuizById(a.quizId)?.title||"")}</td><td>${a.scorePercent}%</td><td>${t(a.gradingStatus==="pendingManual"?"quiz.pendingGrading":a.passed?"quiz.passed":"quiz.failed")}</td><td>${a.gradingStatus==="pendingManual"?`<button class="btn btn-outline mini-action" data-grade-attempt="${a.id}">${t("quiz.manualGrade")}</button>`:""}</td></tr>`).join("")}</tbody></table></div></section>`;}
function quizLeaderboard(attempts){const best=new Map();attempts.filter(a=>a.gradingStatus==="graded").forEach(a=>{const old=best.get(a.accountId);if(!old||a.scorePercent>old.scorePercent||(a.scorePercent===old.scorePercent&&a.durationSeconds<old.durationSeconds))best.set(a.accountId,a)});const rows=[...best.values()].sort((a,b)=>b.scorePercent-a.scorePercent||a.durationSeconds-b.durationSeconds);return `<section class="card panel"><h3>${t("quiz.leaderboard")}</h3><div class="table-wrap"><table><thead><tr><th>#</th><th>${t("table.fullName")}</th><th>${t("quiz.score")}</th><th>${t("quiz.duration")}</th></tr></thead><tbody>${rows.map((a,i)=>`<tr><td>${i+1}</td><td>${escapeHtml(getAccountById(a.accountId)?.fullName||"")}</td><td>${a.scorePercent}%</td><td>${a.durationSeconds}s</td></tr>`).join("")}</tbody></table></div></section>`;}
function quizAnalytics(attempts){const rows=[];getQuizzes().forEach(q=>q.questions.forEach(question=>{const answers=attempts.filter(a=>a.quizId===q.id).map(a=>a.answers.find(x=>x.questionId===question.id)).filter(Boolean);const graded=answers.filter(a=>typeof a.isCorrect==="boolean");rows.push({text:question.text,total:answers.length,rate:graded.length?Math.round(graded.filter(a=>a.isCorrect).length/graded.length*100):0});}));const ranked=rows.filter(r=>r.total).sort((a,b)=>a.rate-b.rate);return `<section class="card panel"><h3>${t("quiz.analytics")}</h3>${ranked.length?`<p><strong>${t("quiz.hardestQuestion")}:</strong> ${escapeHtml(ranked[0].text)} · <strong>${t("quiz.easiestQuestion")}:</strong> ${escapeHtml(ranked[ranked.length-1].text)}</p>`:""}<div class="table-wrap"><table><thead><tr><th>${t("quiz.question")}</th><th>${t("quiz.responses")}</th><th>${t("quiz.correctRate")}</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${escapeHtml(r.text)}</td><td>${r.total}</td><td>${r.rate}%</td></tr>`).join("")}</tbody></table></div></section>`;}

function quizForm() {
  const q=selectedQuizId?getQuizById(selectedQuizId):null;
  const addQuestionUi = quizAddingQType ? `<div class="q-type-grid">${[
    ["singleChoice","Single Choice"],["multipleChoice","Multiple Choice"],["trueFalse","True / False"],
    ["shortAnswer","Short Answer"],["text","Essay"],["fillBlank","Fill in Blank"],
    ["matching","Matching"],["ordering","Ordering"],["numeric","Numeric"],
  ].map(([k,l])=>`<button type="button" class="q-type-btn" data-add-q-type="${k}">${l}</button>`).join("")}</div>` : `<button type="button" class="btn btn-outline" data-add-question>${t("contentType.addQuestion")}</button>`;
  return `<div class="modal-backdrop open"><form class="modal modal--xlarge modal--structured" id="quizForm" role="dialog" aria-modal="true" aria-labelledby="quiz-form-title"><header class="modal__header"><div><span class="eyebrow">${t("quiz.quizzes")}</span><h2 id="quiz-form-title">${q?t("quiz.edit"):t("quiz.create")}</h2></div><button type="button" class="icon-btn" aria-label="${t("quiz.close")}" data-quiz-close>×</button></header><div class="modal__body"><div class="field"><label>${t("quiz.title")}</label><input name="title" required value="${escapeHtmlAttribute(q?.title||"")}"></div><div class="field"><label>${t("nav.courses")}</label><select name="courseId" required>${getCourses().map(c=>`<option value="${c.id}" ${q?.courseId===c.id?"selected":""}>${escapeHtml(c.title)}</option>`).join("")}</select></div><div class="field"><label>${t("course.description")}</label><textarea name="description">${escapeHtml(q?.description||"")}</textarea></div><div class="profile-grid"><div class="field"><label>${t("quiz.passingScore")}</label><input name="passingScore" type="number" min="0" max="100" value="${q?.passingScore??70}" required></div><div class="field"><label>${t("quiz.timeLimit")}</label><input name="timeLimitMinutes" type="number" min="1" value="${q?.timeLimitMinutes??20}" required></div><div class="field"><label>${t("quiz.attemptsAllowed")}</label><input name="attemptsAllowed" type="number" min="1" value="${q?.attemptsAllowed??2}" required></div><div class="field"><label>${t("course.status")}</label><select name="status"><option value="draft">${t("course.draft")}</option><option value="published" ${q?.status==="published"?"selected":""}>${t("course.published")}</option><option value="archived" ${q?.status==="archived"?"selected":""}>${t("course.archived")}</option></select></div></div><label><input type="checkbox" name="requireCourseCompletion" ${q?.requireCourseCompletion?"checked":""}> ${t("quiz.requireCourseCompletion")}</label><div class="field"><label>${t("quiz.prerequisite")}</label><select name="prerequisiteQuizId"><option value="">—</option>${getQuizzes().filter(x=>x.id!==q?.id).map(x=>`<option value="${x.id}" ${q?.prerequisiteQuizId===x.id?"selected":""}>${escapeHtml(x.title)}</option>`).join("")}</select></div><div class="panel-head"><h3>${t("quiz.questions")}</h3></div>${quizBuilderQuestions.map((qq,i)=>questionEditor(qq,i)).join("")}${addQuestionUi}<details class="card" style="margin-top:12px"><summary>${t("quiz.importJson")}</summary><div class="field"><label>${t("quiz.jsonData")}</label><textarea rows="6" data-quiz-json></textarea></div><button type="button" class="btn btn-outline" data-import-quiz-json>${t("quiz.validateImport")}</button></details></div><footer class="modal__footer"><button type="button" class="btn btn-outline" data-quiz-close>${t("content.cancel")}</button><button class="btn btn-primary" type="submit">${t("changePassword.submit")}</button></footer></form></div>`;
}

const _QTYPES = {
  singleChoice:"Single Choice",multipleChoice:"Multiple Choice",trueFalse:"True / False",
  text:"Essay",single_choice:"Single Choice",multiple_choice:"Multiple Choice",true_false:"True / False",
  essay:"Essay",shortAnswer:"Short Answer",short_answer:"Short Answer",
  fillBlank:"Fill in the Blank",fill_blank:"Fill in the Blank",
  matching:"Matching",ordering:"Ordering",numeric:"Numeric",
};

function questionEditor(question, index) {
  const collapsed = quizBuilderCollapsed[index] === true;
  const type = question.type || "singleChoice";
  const typeLabel = _QTYPES[type] || type;
  const preview = (question.text || "").replace(/<[^>]*>/g,"").substring(0,55) || "(Chưa nhập)";
  const pts = question.points || 1;

  const opts = question.options || [];
  const isChoice = ["singleChoice","single_choice","multipleChoice","multiple_choice"].includes(type);
  const isMulti = ["multipleChoice","multiple_choice"].includes(type);
  const isTF = ["trueFalse","true_false"].includes(type);
  const isEssay = ["text","essay"].includes(type);
  const isSA = ["shortAnswer","short_answer"].includes(type);
  const isFB = ["fillBlank","fill_blank"].includes(type);
  const isMatch = type === "matching";
  const isOrder = type === "ordering";
  const isNum = type === "numeric";

  const headHtml = `<div class="question-card__head" data-q-toggle="${index}"><span class="question-card__num">Câu ${index+1}</span><span class="question-card__typebadge">${typeLabel}</span><span class="question-card__preview">${escapeHtml(preview)}</span><span style="font-size:12px;color:var(--muted);margin-left:4px">${pts} điểm</span><div class="question-card__acts" onclick="event.stopPropagation()"><button type="button" class="btn btn-outline mini-action" data-q-move-up="${index}" ${index===0?"disabled":""} title="Lên">↑</button><button type="button" class="btn btn-outline mini-action" data-q-move-down="${index}" title="Xuống">↓</button><button type="button" class="btn btn-outline mini-action" data-q-duplicate="${index}" title="Nhân bản">⊕</button><button type="button" class="btn btn-outline mini-action" data-q-delete="${index}" title="Xóa">🗑</button></div><span style="color:var(--muted);margin-left:4px;font-size:14px">${collapsed?"▾":"▴"}</span></div>`;

  if (collapsed) return `<div class="question-card" data-q-idx="${index}">${headHtml}</div>`;

  const baseTextArea = `<div class="field"><label>Nội dung câu hỏi <span style="color:#c0392b">*</span></label><textarea name="q_${index}_text" rows="3" data-focus-key="q-${index}-text">${escapeHtml(question.text||"")}</textarea></div>`;
  const baseScoreExp = `<div class="form-2col"><div class="field"><label>Điểm</label><input type="number" name="q_${index}_points" min="0" step="0.5" value="${pts}"></div><div class="field"><label>Giải thích</label><input type="text" name="q_${index}_explanation" value="${escapeHtmlAttribute(question.explanation||"")}" data-focus-key="q-${index}-exp"></div></div>`;

  let bodyHtml = "";

  if (isChoice) {
    const optHtml = opts.map((opt, oi) => {
      const checked = isMulti ? (question.correctOptionIds||[]).includes(opt.id) : question.correctOptionId === opt.id;
      return `<div class="q-option-row"><input type="${isMulti?"checkbox":"radio"}" name="${isMulti?`q_${index}_correct[]`:`q_${index}_correct`}" value="${escapeHtmlAttribute(opt.id)}" ${checked?"checked":""}><input type="text" name="q_${index}_opt_${oi}_text" value="${escapeHtmlAttribute(opt.text||"")}" placeholder="Lựa chọn ${oi+1}" data-focus-key="q-${index}-opt-${oi}"><input type="hidden" name="q_${index}_opt_${oi}_id" value="${escapeHtmlAttribute(opt.id)}"><button type="button" class="btn btn-outline mini-action" data-q-del-opt="${index}-${oi}" ${opts.length<=2?"disabled":""}>×</button></div>`;
    }).join("");
    bodyHtml = `${baseTextArea}<div class="field"><label>${isMulti?"Đáp án đúng (chọn nhiều)":"Đáp án đúng (chọn một)"}</label><div class="q-option-list" id="q-opts-${index}">${optHtml}</div><button type="button" class="btn btn-outline mini-action" style="margin-top:6px" data-q-add-opt="${index}">+ Thêm lựa chọn</button></div>${baseScoreExp}`;
  } else if (isTF) {
    const tfVal = question.correctAnswer;
    bodyHtml = `${baseTextArea}<div class="field"><label>Đáp án</label><div style="display:flex;gap:20px"><label><input type="radio" name="q_${index}_correct" value="true" ${tfVal===true?"checked":""}> Đúng</label><label><input type="radio" name="q_${index}_correct" value="false" ${tfVal===false?"checked":""}> Sai</label></div></div>${baseScoreExp}`;
  } else if (isEssay) {
    bodyHtml = `${baseTextArea}<div class="form-2col"><div class="field"><label>Ký tự tối thiểu</label><input type="number" name="q_${index}_minChars" min="0" value="${question.minChars||0}"></div><div class="field"><label>Ký tự tối đa (0=không giới hạn)</label><input type="number" name="q_${index}_maxChars" min="0" value="${question.maxChars||0}"></div></div><div class="field"><label>Rubric chấm điểm</label><textarea name="q_${index}_rubric" rows="2" data-focus-key="q-${index}-rubric">${escapeHtml(question.rubric||"")}</textarea></div>${baseScoreExp}`;
  } else if (isSA) {
    const accepted = question.acceptedAnswers || [""];
    const accHtml = accepted.map((a,ai)=>`<div class="q-option-row"><input type="text" name="q_${index}_acc_${ai}" value="${escapeHtmlAttribute(a)}" placeholder="Đáp án ${ai+1}" data-focus-key="q-${index}-acc-${ai}"><button type="button" class="btn btn-outline mini-action" data-q-del-acc="${index}-${ai}" ${accepted.length<=1?"disabled":""}>×</button></div>`).join("");
    bodyHtml = `${baseTextArea}<div class="field"><label>Đáp án chấp nhận</label><div class="q-option-list" id="q-acc-${index}">${accHtml}</div><button type="button" class="btn btn-outline mini-action" style="margin-top:6px" data-q-add-acc="${index}">+ Thêm đáp án</button></div><div class="field"><label><input type="checkbox" name="q_${index}_ignoreCase" ${question.ignoreCase!==false?"checked":""}> Không phân biệt hoa thường</label></div>${baseScoreExp}`;
  } else if (isFB) {
    bodyHtml = `<div class="field"><label>Câu hỏi (dùng ____ cho chỗ trống) <span style="color:#c0392b">*</span></label><textarea name="q_${index}_text" rows="2" data-focus-key="q-${index}-text">${escapeHtml(question.text||"")}</textarea><small style="color:var(--muted)">Ví dụ: KIS được thành lập năm ____.</small></div><div class="field"><label>Đáp án chấp nhận (cách nhau bằng |)</label><input type="text" name="q_${index}_blanks" value="${escapeHtmlAttribute((question.blanks||[""]).join("|"))}" data-focus-key="q-${index}-blanks" placeholder="2012|hai nghìn mười hai"></div><div class="field"><label><input type="checkbox" name="q_${index}_ignoreCase" ${question.ignoreCase!==false?"checked":""}> Không phân biệt hoa thường</label></div>${baseScoreExp}`;
  } else if (isMatch) {
    const pairs = question.pairs || [{ left:"", right:"" }];
    const pairHtml = pairs.map((p,pi)=>`<div class="q-pair-row"><input type="text" name="q_${index}_left_${pi}" value="${escapeHtmlAttribute(p.left||"")}" placeholder="Cột A" data-focus-key="q-${index}-l-${pi}"><span style="color:var(--muted)">→</span><input type="text" name="q_${index}_right_${pi}" value="${escapeHtmlAttribute(p.right||"")}" placeholder="Cột B" data-focus-key="q-${index}-r-${pi}"><button type="button" class="btn btn-outline mini-action" data-q-del-pair="${index}-${pi}" ${pairs.length<=1?"disabled":""}>×</button></div>`).join("");
    bodyHtml = `${baseTextArea}<div class="field"><label>Các cặp ghép</label><div id="q-pairs-${index}">${pairHtml}</div><button type="button" class="btn btn-outline mini-action" style="margin-top:6px" data-q-add-pair="${index}">+ Thêm cặp</button></div>${baseScoreExp}`;
  } else if (isOrder) {
    const items = question.items || [""];
    const itemHtml = items.map((it,ii)=>`<div class="q-order-row"><span style="font-weight:700;color:var(--muted);min-width:20px">${ii+1}.</span><input type="text" name="q_${index}_item_${ii}" value="${escapeHtmlAttribute(it||"")}" placeholder="Bước ${ii+1}" data-focus-key="q-${index}-item-${ii}"><button type="button" class="btn btn-outline mini-action" data-q-del-item="${index}-${ii}" ${items.length<=2?"disabled":""}>×</button></div>`).join("");
    bodyHtml = `${baseTextArea}<div class="field"><label>Các bước (thứ tự đúng)</label><div id="q-items-${index}">${itemHtml}</div><button type="button" class="btn btn-outline mini-action" style="margin-top:6px" data-q-add-item="${index}">+ Thêm bước</button></div>${baseScoreExp}`;
  } else if (isNum) {
    bodyHtml = `${baseTextArea}<div class="form-2col"><div class="field"><label>Đáp án số <span style="color:#c0392b">*</span></label><input type="number" step="any" name="q_${index}_numAnswer" value="${question.numericAnswer??""}" data-focus-key="q-${index}-num"></div><div class="field"><label>Sai số cho phép (±)</label><input type="number" step="any" min="0" name="q_${index}_tolerance" value="${question.tolerance||0}"></div></div><div class="field"><label>Đơn vị</label><input type="text" name="q_${index}_unit" value="${escapeHtmlAttribute(question.unit||"")}"></div>${baseScoreExp}`;
  }

  return `<div class="question-card" data-q-idx="${index}">${headHtml}<div class="question-card__body">${bodyHtml}</div></div>`;
}

function readQuestionEditors() {
  return [...document.querySelectorAll("[data-q-idx]")].map((el, index) => {
    const g = n => el.querySelector(`[name="q_${index}_${n}"]`)?.value ?? "";
    const type = quizBuilderQuestions[index]?.type || "singleChoice";
    const id = quizBuilderQuestions[index]?.id || `q-${Date.now()}-${index}`;
    const text = g("text").trim();
    const points = Number(g("points")) || 1;
    const explanation = g("explanation").trim();

    const isChoice = ["singleChoice","single_choice","multipleChoice","multiple_choice"].includes(type);
    const isMulti = ["multipleChoice","multiple_choice"].includes(type);
    const isTF = ["trueFalse","true_false"].includes(type);

    let extra = {};

    if (isChoice) {
      const optEls = [...el.querySelectorAll(`[name^="q_${index}_opt_"][name$="_text"]`)];
      const options = optEls.map((inp, oi) => ({
        id: el.querySelector(`[name="q_${index}_opt_${oi}_id"]`)?.value || `${id}-o${oi+1}`,
        text: inp.value.trim(),
      }));
      if (isMulti) {
        const checked = [...el.querySelectorAll(`[name="q_${index}_correct[]"]:checked`)].map(x=>x.value);
        extra = { options, correctOptionIds: checked };
      } else {
        const checked = el.querySelector(`[name="q_${index}_correct"]:checked`)?.value || "";
        extra = { options, correctOptionId: checked };
      }
    } else if (isTF) {
      const val = el.querySelector(`[name="q_${index}_correct"]:checked`)?.value;
      extra = { correctAnswer: val === "true" ? true : val === "false" ? false : null };
    } else if (["text","essay"].includes(type)) {
      extra = { minChars: Number(g("minChars"))||0, maxChars: Number(g("maxChars"))||0, rubric: g("rubric") };
    } else if (["shortAnswer","short_answer"].includes(type)) {
      const accEls = [...el.querySelectorAll(`[name^="q_${index}_acc_"]`)];
      extra = { acceptedAnswers: accEls.map(x=>x.value.trim()).filter(Boolean), ignoreCase: el.querySelector(`[name="q_${index}_ignoreCase"]`)?.checked !== false };
    } else if (["fillBlank","fill_blank"].includes(type)) {
      extra = { blanks: g("blanks").split("|").map(x=>x.trim()).filter(Boolean), ignoreCase: el.querySelector(`[name="q_${index}_ignoreCase"]`)?.checked !== false };
    } else if (type === "matching") {
      const leftEls = [...el.querySelectorAll(`[name^="q_${index}_left_"]`)];
      const rightEls = [...el.querySelectorAll(`[name^="q_${index}_right_"]`)];
      extra = { pairs: leftEls.map((l,i) => ({ left: l.value.trim(), right: rightEls[i]?.value.trim()||"" })) };
    } else if (type === "ordering") {
      const itemEls = [...el.querySelectorAll(`[name^="q_${index}_item_"]`)];
      extra = { items: itemEls.map(x=>x.value.trim()) };
    } else if (type === "numeric") {
      extra = { numericAnswer: Number(g("numAnswer")), tolerance: Number(g("tolerance"))||0, unit: g("unit") };
    }

    return { id, type, text, points, explanation, ...extra };
  });
}

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
  return `<div class="app-layout">${sideNav("hr")}<main class="app-main">${topbar("HR / L&D", t("enrollment.assign"), "hr")}<div class="content"><section class="card panel"><div class="account-toolbar"><div><h2>${t("enrollment.assign")}</h2><p>${t("enrollment.description")}</p></div><button type="button" class="btn btn-primary" data-assign-new>${t("enrollment.assign")}</button></div>${selectedCourse ? `<div class="card"><strong>${t("enrollment.filteringByCourse")}:</strong> ${escapeHtml(selectedCourse.title)} <button type="button" class="btn btn-outline mini-action" data-clear-assign-course>${t("enrollment.clearFilter")}</button></div>` : ""}<div class="kpi-grid"><div class="card kpi"><span>${t("enrollment.totalAssigned")}</span><strong>${allEnrollments.length}</strong></div><div class="card kpi"><span>${t("status.completed")}</span><strong>${completed}</strong>${progress(completionRate)}</div><div class="card kpi"><span>${t("status.inProgress")}</span><strong>${inProgress}</strong></div><div class="card kpi"><span>${t("status.overdue")}</span><strong>${overdue}</strong></div></div><div class="filter-bar"><input id="assignSearchInput" data-focus-key="assign-search" type="search" placeholder="${t("enrollment.searchPlaceholder")}" value="${escapeHtmlAttribute(assignSearch)}" data-assign-search><select data-assign-filter-course><option value="">${t("enrollment.allCourses")}</option>${allCourses.map((course) => `<option value="${escapeHtmlAttribute(course.id)}" ${assignCourseId === course.id ? "selected" : ""}>${escapeHtml(course.title || course.id)}</option>`).join("")}</select><select data-assign-filter-dept><option value="">${t("enrollment.allDepts")}</option>${departments.map((department) => `<option value="${escapeHtmlAttribute(department)}" ${assignFilterDept === department ? "selected" : ""}>${escapeHtml(department)}</option>`).join("")}</select><select data-assign-filter-status><option value="">${t("enrollment.allStatuses")}</option><option value="notStarted" ${assignFilterStatus === "notStarted" ? "selected" : ""}>${t("status.notStarted")}</option><option value="inProgress" ${assignFilterStatus === "inProgress" ? "selected" : ""}>${t("status.inProgress")}</option><option value="completed" ${assignFilterStatus === "completed" ? "selected" : ""}>${t("status.completed")}</option><option value="overdue" ${assignFilterStatus === "overdue" ? "selected" : ""}>${t("status.overdue")}</option></select></div>${enrollmentTable(filteredAssignments())}</section></div>${assignModalOpen ? assignModal() : ""}</main></div>`;
}

function getReportDateBounds() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  if (reportDateRange === "today") return { from: today, to: today };
  if (reportDateRange === "7d") { const d = new Date(now); d.setDate(d.getDate() - 6); return { from: d.toISOString().slice(0, 10), to: today }; }
  if (reportDateRange === "month") return { from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`, to: today };
  if (reportDateRange === "quarter") { const q = Math.floor(now.getMonth() / 3); return { from: `${now.getFullYear()}-${String(q * 3 + 1).padStart(2, "0")}-01`, to: today }; }
  if (reportDateRange === "year") return { from: `${now.getFullYear()}-01-01`, to: today };
  if (reportDateRange === "custom") { const f = reportDateFrom, t2 = reportDateTo; if (f && t2 && f <= t2) return { from: f, to: t2 }; }
  return { from: "", to: "" };
}

function reportsPage() {
  if (!hasAdminAccess()) return restrictedPage();
  const { from, to } = getReportDateBounds();
  const allEnrollments = enrichedEnrollments().filter(e => e.account?.role === "employee");
  const enrollments = allEnrollments.filter(e => {
    if (reportDeptFilter && e.account?.department !== reportDeptFilter) return false;
    if (reportCourseFilter && e.courseId !== reportCourseFilter) return false;
    if (from && e.assignedAt && e.assignedAt < from) return false;
    if (to && e.assignedAt && e.assignedAt > to + "T23:59:59") return false;
    return true;
  });
  const allAttempts = getQuizAttempts();
  const attempts = allAttempts.filter(a => {
    const at = a.submittedAt || a.startedAt || "";
    if (from && at && at < from) return false;
    if (to && at && at > to + "T23:59:59") return false;
    return true;
  });
  const completed = enrollments.filter(e => e.status === "completed").length;
  const overdue = enrollments.filter(e => e.displayStatus === "overdue").length;
  const completion = enrollments.length ? Math.round(completed / enrollments.length * 100) : 0;
  const pass = attempts.filter(a => a.submittedAt).length ? Math.round(attempts.filter(a => a.passed).length / attempts.filter(a => a.submittedAt).length * 100) : 0;
  const a = getCompanyTrainingAnalytics(from ? { dateFrom: `${from}T00:00:00+07:00`, dateTo: `${to}T23:59:59+07:00` } : {});
  const depts = [...new Set(allEnrollments.map(e => e.account?.department).filter(Boolean))].sort();
  const dateRangeLabel = from && to ? `${from} – ${to}` : "Toàn bộ thời gian";
  const periodHtml = `<p class="report-period">Kỳ báo cáo: <strong>${escapeHtml(dateRangeLabel)}</strong></p>`;
  return `<div class="app-layout">${sideNav("hr")}<main class="app-main">${topbar("HR/L&D Analytics", t("admin.reports"), "hr")}<div class="content">
    <section class="card panel report-head"><div><h1>${t("admin.reports")}</h1>${periodHtml}</div><div class="report-actions"><button class="btn btn-outline" data-export-csv>Xuất CSV</button></div></section>
    <section class="card panel report-filter-bar">
      <div class="filter-bar" style="flex-wrap:wrap;gap:10px">
        <select data-report-range>
          ${[["all","Toàn bộ thời gian"],["today","Hôm nay"],["7d","7 ngày gần nhất"],["month","Tháng này"],["quarter","Quý này"],["year","Năm nay"],["custom","Khoảng tùy chọn"]].map(([v,l])=>`<option value="${v}" ${reportDateRange===v?"selected":""}>${l}</option>`).join("")}
        </select>
        ${reportDateRange==="custom"?`<input type="date" id="reportFrom" value="${escapeHtmlAttribute(reportDateFrom)}" style="padding:7px 10px;border:1px solid var(--border);border-radius:8px"><span style="align-self:center">–</span><input type="date" id="reportTo" value="${escapeHtmlAttribute(reportDateTo)}" style="padding:7px 10px;border:1px solid var(--border);border-radius:8px"><button class="btn btn-primary" id="reportApply">Áp dụng</button><button class="btn btn-outline" id="reportReset">Đặt lại</button>`:""}
        <select data-report-dept><option value="">Tất cả phòng ban</option>${depts.map(d=>`<option value="${escapeHtmlAttribute(d)}" ${reportDeptFilter===d?"selected":""}>${escapeHtml(d)}</option>`).join("")}</select>
        <select data-report-course><option value="">Tất cả khóa học</option>${getCourses().filter(c=>c.status==="published").map(c=>`<option value="${c.id}" ${reportCourseFilter===c.id?"selected":""}>${escapeHtml(c.title)}</option>`).join("")}</select>
      </div>
    </section>
    <div class="kpi-grid">
      <div class="card kpi"><span>Tổng giờ đào tạo</span><strong>${formatTrainingDuration(a.totalSeconds,language,true)}</strong></div>
      <div class="card kpi"><span>Giờ online</span><strong>${formatTrainingDuration(a.onlineSeconds,language,true)}</strong></div>
      <div class="card kpi"><span>Giờ offline</span><strong>${formatTrainingDuration(a.offlineSeconds,language,true)}</strong></div>
      <div class="card kpi"><span>Trung bình/người</span><strong>${formatTrainingDuration(a.averageSeconds,language,true)}</strong></div>
      <div class="card kpi"><span>Tỷ lệ hoàn thành</span><strong>${completion}%</strong></div>
      <div class="card kpi"><span>Quá hạn</span><strong>${overdue}</strong></div>
      <div class="card kpi"><span>${t("quiz.passRate")}</span><strong>${pass}%</strong></div>
      <div class="card kpi"><span>Tỷ lệ tham dự</span><strong>${a.attendanceRate}%</strong></div>
    </div>
    <section class="card panel"><h3>${t("quiz.attemptHistory")}</h3>${attempts.filter(at=>at.submittedAt).length?`<div class="table-wrap"><table><thead><tr><th>${t("table.fullName")}</th><th>${t("nav.courses")}</th><th>${t("quiz.score")}</th><th>${t("quiz.result")}</th><th>${t("table.createdAt")}</th></tr></thead><tbody>${attempts.filter(at=>at.submittedAt).map(at=>`<tr><td>${escapeHtml(getAccountById(at.accountId)?.fullName||"")}</td><td>${escapeHtml(getCourseById(at.courseId)?.title||"")}</td><td>${at.scorePercent??"—"}%</td><td>${t(at.passed?"quiz.passed":"quiz.failed")}</td><td>${escapeHtml(at.submittedAt||"")}</td></tr>`).join("")}</tbody></table></div>`:`<div class="empty-state"><p>${t("quiz.noQuiz")}</p></div>`}</section>
  </div></main></div>`;
}

function employeeGalleryPage(){
  if(!hasEmployeeAccess())return restrictedPage(); const ctx=getCurrentEmployeeContext(); const courseIds=new Set(employeeEnrollments().map(e=>e.courseId));
  const rows=readLocalRows(GALLERY_KEY).filter(a=>a.status==="published"&&(a.visibility==="all_employees"||(a.courseId&&courseIds.has(a.courseId))||(a.visibility==="departments"&&(a.departmentNames||[]).includes(ctx.employee?.department))));
  const filtered=rows.filter(a=>(!gallerySearch||`${a.title} ${a.description}`.toLowerCase().includes(gallerySearch.toLowerCase()))&&(!galleryYear||String(a.eventDate||"").startsWith(galleryYear)));
  return `<div class="app-layout">${sideNav("employee")}<main class="app-main">${topbar("Thư viện","Ảnh","employee")}<div class="content"><section class="library-head"><div><span class="eyebrow">Kỷ niệm đào tạo</span><h1>Thư viện ảnh</h1><p>Album được HR chia sẻ theo khóa học và phòng ban của bạn.</p></div><div class="filter-bar"><input type="search" data-gallery-search value="${escapeHtmlAttribute(gallerySearch)}" placeholder="Tìm album"><select data-gallery-year><option value="">Tất cả năm</option>${[...new Set(rows.map(x=>String(x.eventDate||"").slice(0,4)).filter(Boolean))].map(y=>`<option ${galleryYear===y?"selected":""}>${y}</option>`).join("")}</select></div></section>${filtered.length?`<div class="gallery-grid">${filtered.map(a=>`<article class="card album-card"><img src="${escapeHtmlAttribute(a.coverUrl||"/images/communication-training-course.png")}" alt="${escapeHtmlAttribute(a.coverAlt||a.title)}" loading="lazy"><div><time>${escapeHtml(a.eventDate||"")}</time><h2>${escapeHtml(a.title)}</h2><p>${escapeHtml(a.description||"")}</p><span>${Number(a.imageCount||a.images?.length||1)} ảnh${a.courseId?` · ${escapeHtml(getCourseById(a.courseId)?.title||"")}`:""}</span></div></article>`).join("")}</div>`:`<div class="empty-state"><h2>Chưa có album phù hợp</h2><p>Album được xuất bản và cấp quyền sẽ xuất hiện tại đây.</p></div>`}</div></main></div>`;
}
function adminGalleryPage(){if(!hasAdminAccess())return restrictedPage();const rows=readLocalRows(GALLERY_KEY);return `<div class="app-layout">${sideNav("hr")}<main class="app-main">${topbar("HR / L&D","Quản lý ảnh","hr")}<div class="content"><section class="card panel"><div class="panel-head"><div><h1>Album đào tạo</h1><p>Chỉ album Published mới hiển thị cho nhân viên đúng quyền.</p></div></div><form id="galleryForm" class="form-2col"><div class="field"><label>Tên album</label><input name="title" required></div><div class="field"><label>Ngày sự kiện</label><input name="eventDate" type="date" required></div><div class="field"><label>Quyền xem</label><select name="visibility"><option value="all_employees">Tất cả nhân viên</option><option value="course_assignees">Người được giao khóa học</option><option value="departments">Theo phòng ban</option></select></div><div class="field"><label>Khóa học liên quan</label><select name="courseId"><option value="">Không liên kết</option>${getCourses().map(c=>`<option value="${c.id}">${escapeHtml(c.title)}</option>`).join("")}</select></div><div class="field"><label>URL ảnh bìa</label><input name="coverUrl" type="url" placeholder="https://..."></div><div class="field"><label>Mô tả / alt text</label><input name="description"></div><button class="btn btn-primary" type="submit">Tạo và xuất bản album</button></form></section><section class="gallery-grid">${rows.map(a=>`<article class="card album-card"><img src="${escapeHtmlAttribute(a.coverUrl||"/images/leadership-training-course.png")}" alt="${escapeHtmlAttribute(a.title)}"><div><span class="badge ${a.status}">${a.status}</span><h2>${escapeHtml(a.title)}</h2><p>${escapeHtml(a.visibility)}</p><button class="btn btn-outline" data-gallery-toggle="${a.id}">${a.status==="published"?"Archive":"Publish"}</button></div></article>`).join("")||`<div class="empty-state">Chưa có album.</div>`}</section></div></main></div>`;}
function galleryContext(){const {account,employee}=getCurrentEmployeeContext();return {account,employee,enrollments:employeeEnrollments()};}
function galleryPageV2(albumId=""){if(!hasEmployeeAccess())return restrictedPage();if(albumId)return albumDetailPage(albumId);const rows=galleryService.visibleFor(galleryContext()).filter(a=>(!gallerySearch||`${a.title} ${a.description}`.toLowerCase().includes(gallerySearch.toLowerCase()))&&(!galleryYear||String(a.eventDate).startsWith(galleryYear)));return `<div class="app-layout">${sideNav("employee")}<main class="app-main">${topbar("Thư viện","Album đào tạo","employee")}<div class="content route-content"><section class="library-head"><div><span class="eyebrow">Ảnh & video</span><h1>Thư viện album đào tạo</h1><p>Xem lại các hoạt động đào tạo được chia sẻ với bạn.</p></div><div class="filter-bar"><input data-gallery-search type="search" value="${escapeHtmlAttribute(gallerySearch)}" placeholder="Tìm album"><select data-gallery-year><option value="">Tất cả năm</option>${[...new Set(rows.map(a=>a.eventDate?.slice(0,4)).filter(Boolean))].map(y=>`<option ${galleryYear===y?"selected":""}>${y}</option>`).join("")}</select></div></section><div class="gallery-grid">${rows.map(albumCard).join("")||`<div class="empty-state"><h2>Chưa có album phù hợp</h2><p>Album được xuất bản đúng quyền sẽ xuất hiện tại đây.</p></div>`}</div></div></main></div>`;}
function albumCard(a){const images=a.mediaItems.filter(x=>x.type==="image").length,videos=a.mediaItems.length-images,cover=a.mediaItems.find(x=>x.id===a.coverMediaId)||a.mediaItems[0];const coverHtml=cover?.type==="youtube"?`<img src="https://i.ytimg.com/vi/${cover.youtubeVideoId}/hqdefault.jpg" alt="${escapeHtmlAttribute(a.title)}" loading="lazy">`:cover?.blobId?`<div class="album-blob-cover" data-media-blob="${cover.blobId}" data-media-kind="${cover.type}"><span>MyKIS Learning</span></div>`:`<div class="album-fallback">MyKIS Learning</div>`;return `<article class="card album-card">${coverHtml}<div><time>${escapeHtml(a.eventDate||"")}</time><h2>${escapeHtml(a.title)}</h2><p>${images} ảnh · ${videos} video</p><span>${escapeHtml(getCourseById(a.courseId)?.title||"")}</span><a class="btn btn-primary" href="/dashboard/gallery/${a.id}" data-link>Xem album</a></div></article>`;}
function albumDetailPage(id){const album=galleryService.get(id);if(!galleryService.canView(album,galleryContext()))return `<div class="app-layout">${sideNav("employee")}<main class="app-main">${topbar("Thư viện","Không có quyền xem","employee")}<div class="content"><div class="empty-state"><h1>Không có quyền xem album</h1><a href="/dashboard/gallery" data-link class="btn btn-primary">Quay lại thư viện</a></div></div></main></div>`;const media=album.mediaItems.filter(x=>galleryMediaFilter==="all"||x.type===galleryMediaFilter||(galleryMediaFilter==="video"&&x.type==="youtube"));return `<div class="app-layout">${sideNav("employee")}<main class="app-main">${topbar("Thư viện",album.title,"employee")}<div class="content route-content"><a href="/dashboard/gallery" data-link class="back-link">← Quay lại album</a><header class="album-detail-head"><div><span class="eyebrow">${album.mediaItems.filter(x=>x.type==="image").length} ảnh · ${album.mediaItems.filter(x=>x.type!=="image").length} video</span><h1>${escapeHtml(album.title)}</h1><p>${escapeHtml(album.description||"")}</p><div>${escapeHtml(album.eventDate||"")}${album.location?` · ${escapeHtml(album.location)}`:""}${album.courseId?` · ${escapeHtml(getCourseById(album.courseId)?.title||"")}`:""}</div></div></header><div class="media-filter" role="tablist">${[["all","Tất cả"],["image","Ảnh"],["video","Video"]].map(([v,l])=>`<button class="${galleryMediaFilter===v?"active":""}" data-media-filter="${v}" role="tab" aria-selected="${galleryMediaFilter===v}">${l}</button>`).join("")}</div><div class="media-grid">${media.slice(0,50).map((m,i)=>mediaCard(m,i)).join("")||`<div class="empty-state">Album chưa có media.</div>`}</div></div></main>${mediaViewer(album,media)}</div>`;}
function mediaCard(m,i){const visual=m.type==="youtube"?`<img src="https://i.ytimg.com/vi/${m.youtubeVideoId}/hqdefault.jpg" alt="${escapeHtmlAttribute(m.alt||m.caption||"Video")}" loading="lazy"><span class="play-badge">▶</span>`:`<div class="media-blob-placeholder" data-media-blob="${m.blobId}" data-media-kind="${m.type}"><span>${m.type==="video"?"▶ Video":"Ảnh"}</span></div>`;return `<button class="media-card" data-open-media="${i}" aria-label="Mở ${escapeHtmlAttribute(m.caption||m.fileName||"media")}">${visual}<span>${escapeHtml(m.caption||m.fileName||"")}</span></button>`;}
function mediaViewer(album,media){if(mediaViewerIndex<0||!media[mediaViewerIndex])return "";const m=media[mediaViewerIndex];const body=m.type==="youtube"?`<iframe src="https://www.youtube.com/embed/${m.youtubeVideoId}" title="${escapeHtmlAttribute(m.caption||album.title)}" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe>`:m.type==="video"?`<video controls preload="metadata" data-viewer-blob="${m.blobId}"></video>`:`<img data-viewer-blob="${m.blobId}" alt="${escapeHtmlAttribute(m.alt||m.caption||album.title)}">`;return `<div class="media-viewer open" role="dialog" aria-modal="true" aria-label="Media viewer"><button class="media-viewer__close" data-close-media aria-label="Đóng">×</button><button class="media-viewer__nav prev" data-media-index="${mediaViewerIndex-1}" ${mediaViewerIndex===0?"disabled":""} aria-label="Trước">‹</button><figure>${body}<figcaption><strong>${mediaViewerIndex+1} / ${media.length}</strong><span>${escapeHtml(m.caption||"")}</span></figcaption></figure><button class="media-viewer__nav next" data-media-index="${mediaViewerIndex+1}" ${mediaViewerIndex===media.length-1?"disabled":""} aria-label="Sau">›</button></div>`;}
function adminGalleryPageV2(){if(!hasAdminAccess())return restrictedPage();const rows=galleryService.list();return `<div class="app-layout">${sideNav("hr")}<main class="app-main">${topbar("HR / L&D","Album đa phương tiện","hr")}<div class="content route-content"><section class="library-head"><div><span class="eyebrow">Quản trị nội dung</span><h1>Album đào tạo</h1><p>Ảnh và video được lưu trong IndexedDB; chỉ metadata nằm trong prototype storage.</p></div><button class="btn btn-primary" data-create-album>+ Tạo album</button></section><div class="gallery-grid">${rows.map(a=>`<article class="card album-card"><div class="album-fallback">${a.mediaItems.length} media</div><div><span class="badge ${a.status}">${a.status}</span><h2>${escapeHtml(a.title)}</h2><p>${a.mediaItems.filter(x=>x.type==="image").length} ảnh · ${a.mediaItems.filter(x=>x.type!=="image").length} video</p><div class="card-actions"><button class="btn btn-primary" data-edit-album="${a.id}">Quản lý album</button><button class="btn btn-outline" data-gallery-toggle="${a.id}">${a.status==="published"?"Archive":"Publish"}</button></div></div></article>`).join("")||`<div class="empty-state">Chưa có album. Hãy tạo album đầu tiên.</div>`}</div></div></main>${albumEditorModal()}</div>`;}
function albumEditorModal(){if(!galleryEditorOpen)return "";const a=galleryService.get(selectedAlbumId)||{mediaItems:[],status:"draft",visibility:"all_employees"};return `<div class="modal-backdrop open"><form id="albumEditorForm" class="modal modal--xlarge modal--structured" role="dialog" aria-modal="true"><header class="modal__header"><div><span class="eyebrow">Album đa phương tiện</span><h2>${a.id?"Sửa album":"Tạo album"}</h2></div><button type="button" class="icon-btn" data-close-album-editor>×</button></header><div class="modal__body"><input type="hidden" name="id" value="${escapeHtmlAttribute(a.id||"")}"><div class="form-2col"><div class="field"><label>Tên album *</label><input name="title" required value="${escapeHtmlAttribute(a.title||"")}"></div><div class="field"><label>Ngày sự kiện</label><input name="eventDate" type="date" value="${escapeHtmlAttribute(a.eventDate||"")}"></div><div class="field"><label>Địa điểm</label><input name="location" value="${escapeHtmlAttribute(a.location||"")}"></div><div class="field"><label>Course liên quan</label><select name="courseId"><option value="">Không liên kết</option>${getCourses().map(c=>`<option value="${c.id}" ${a.courseId===c.id?"selected":""}>${escapeHtml(c.title)}</option>`).join("")}</select></div><div class="field span-2"><label>Mô tả</label><textarea name="description" rows="3">${escapeHtml(a.description||"")}</textarea></div><div class="field"><label>Quyền xem</label><select name="visibility">${[["all_employees","Toàn bộ nhân viên"],["course_assignees","Người được giao course"],["course_completed","Đã hoàn thành course"],["departments","Theo phòng ban"]].map(([v,l])=>`<option value="${v}" ${a.visibility===v?"selected":""}>${l}</option>`).join("")}</select></div><div class="field"><label>Trạng thái</label><select name="status"><option value="draft" ${a.status==="draft"?"selected":""}>Draft</option><option value="published" ${a.status==="published"?"selected":""}>Published</option><option value="archived" ${a.status==="archived"?"selected":""}>Archived</option></select></div></div>${a.id?`<section class="album-upload-zone"><label for="albumFiles"><strong>Upload ảnh / video</strong><span>Chọn nhiều JPG, PNG, WebP, MP4 hoặc WebM</span></label><input id="albumFiles" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" multiple><div class="youtube-add"><input data-youtube-url placeholder="URL YouTube"><input data-youtube-caption placeholder="Caption"><button type="button" class="btn btn-outline" data-add-youtube>+ Thêm YouTube</button></div></section><div class="media-admin-list">${a.mediaItems.map(m=>`<div><span>${m.type}</span><strong>${escapeHtml(m.caption||m.fileName||m.youtubeVideoId||"")}</strong><button type="button" class="btn btn-ghost" data-remove-album-media="${m.id}">Xóa</button></div>`).join("")||`<p>Chưa có media. Lưu thông tin album trước, sau đó upload.</p>`}</div>`:`<p class="form-note">Lưu album trước để bắt đầu upload media.</p>`}</div><footer class="modal__footer"><button type="button" class="btn btn-outline" data-close-album-editor>Đóng</button><button class="btn btn-primary" type="submit">Lưu album</button></footer></form></div>`;}
function resourceRows(){const existing=readLocalRows(RESOURCES_KEY);if(existing.length)return existing;const course=getCourses().find(c=>c.status==="published")||getCourses()[0];if(!course)return [];const seed=[{id:"resource-handbook",courseId:course.id,title:"Handbook sau đào tạo",description:"Tài liệu tổng kết và checklist áp dụng.",type:"link",externalUrl:"https://www.kisvn.vn/",unlockRule:"after_completion",downloadable:false,createdAt:new Date().toISOString()}];writeLocalRows(RESOURCES_KEY,seed);return seed;}
function isResourceUnlocked(r,e){if(r.unlockRule==="always")return true;if(r.unlockRule==="after_completion")return e?.status==="completed";if(r.unlockRule==="after_quiz_pass")return getQuizAttemptsByAccountId(session.accountId).some(a=>a.quizId===r.requiredQuizId&&a.passed);return false;}
function employeeResourcesPage(){if(!hasEmployeeAccess())return restrictedPage();const enrollments=employeeEnrollments();const byCourse=new Map(enrollments.map(e=>[e.courseId,e]));const rows=resourceRows().filter(r=>byCourse.has(r.courseId)&&(!resourceSearch||r.title.toLowerCase().includes(resourceSearch.toLowerCase())));return `<div class="app-layout">${sideNav("employee")}<main class="app-main">${topbar("Thư viện","Tài liệu","employee")}<div class="content"><section class="library-head"><div><h1>Thư viện tài liệu</h1><p>Tài liệu từ các khóa học được giao; quyền mở được kiểm tra lại khi truy cập.</p></div><input type="search" data-resource-search value="${escapeHtmlAttribute(resourceSearch)}" placeholder="Tìm tài liệu"></section><div class="resource-list">${rows.map(r=>{const open=isResourceUnlocked(r,byCourse.get(r.courseId));return `<article class="card resource-row"><div><span class="badge ${open?"completed":"pending"}">${open?"Đã mở khóa":"Bị khóa"}</span><h2>${escapeHtml(r.title)}</h2><p>${escapeHtml(getCourseById(r.courseId)?.title||"")} · ${escapeHtml(r.description||"")}</p>${!open?`<small>Hoàn thành khóa học để mở khóa.</small>`:""}</div>${open&&r.externalUrl?`<a class="btn btn-primary" href="${escapeHtmlAttribute(r.externalUrl)}" target="_blank" rel="noopener" data-resource-open="${r.id}">Xem tài liệu</a>`:`<button class="btn btn-outline" disabled>Chưa thể mở</button>`}</article>`}).join("")||`<div class="empty-state">Chưa có tài liệu phù hợp.</div>`}</div></div></main></div>`;}
function learningHistoryPage(){if(!hasEmployeeAccess())return restrictedPage();const rows=employeeEnrollments().filter(e=>e.status==="completed");return `<div class="app-layout">${sideNav("employee")}<main class="app-main">${topbar("Học tập","Lịch sử học tập","employee")}<div class="content"><section class="card panel"><h1>Lịch sử học tập</h1><div class="table-wrap"><table><thead><tr><th>Khóa học</th><th>Ngày bắt đầu</th><th>Ngày hoàn thành</th><th>Tiến độ</th></tr></thead><tbody>${rows.map(e=>`<tr><td>${escapeHtml(e.course?.title||"")}</td><td>${escapeHtml(e.assignedAt||"—")}</td><td>${escapeHtml(e.completedAt||"—")}</td><td>100%</td></tr>`).join("")||`<tr><td colspan="4">Chưa có khóa học đã hoàn thành.</td></tr>`}</tbody></table></div></section></div></main></div>`;}
function learningCalendarPage(){if(!hasEmployeeAccess())return restrictedPage();const rows=employeeEnrollments().filter(e=>e.deadline).sort((a,b)=>a.deadline.localeCompare(b.deadline));return `<div class="app-layout">${sideNav("employee")}<main class="app-main">${topbar("Học tập","Lịch học","employee")}<div class="content"><section class="card panel"><h1>Lịch học & deadline</h1>${rows.map(e=>`<article class="calendar-row"><time>${escapeHtml(e.deadline)}</time><div><h2>${escapeHtml(e.course?.title||"")}</h2><p>${uiText(e.status)} · ${e.progressPercent}%</p></div><a href="/dashboard/courses/${e.courseId}" data-link class="btn btn-outline">Mở khóa học</a></article>`).join("")||`<div class="empty-state">Chưa có deadline.</div>`}</section></div></main></div>`;}
function learningCalendarPageV2(){if(!hasEmployeeAccess())return restrictedPage();const today=new Date();today.setHours(0,0,0,0);const rows=employeeEnrollments().filter(e=>e.deadline).map(e=>{const date=new Date(`${e.deadline}T00:00:00`),days=Math.ceil((date-today)/86400000);return {...e,date,days};}).sort((a,b)=>a.date-b.date);const monthStart=new Date(today.getFullYear(),today.getMonth(),1),daysInMonth=new Date(today.getFullYear(),today.getMonth()+1,0).getDate(),offset=(monthStart.getDay()+6)%7;const monthCells=[...Array(offset).fill(null),...Array.from({length:daysInMonth},(_,i)=>i+1)];return `<div class="app-layout">${sideNav("employee")}<main class="app-main">${topbar("Học tập","Lịch học & deadline","employee")}<div class="content route-content"><section class="calendar-head"><div><span class="eyebrow">Kế hoạch học tập</span><h1>Lịch học & deadline</h1><p>Theo dõi thời hạn từ các khóa học được giao cho bạn.</p></div><div class="view-tabs" role="tablist">${[["upcoming","Sắp tới"],["month","Theo tháng"],["deadline","Deadline"]].map(([v,l])=>`<button role="tab" aria-selected="${calendarView===v}" class="${calendarView===v?"active":""}" data-calendar-view="${v}">${l}</button>`).join("")}</div></section>${calendarView==="month"?`<section class="card month-calendar"><header><h2>${today.toLocaleDateString(language==="vi"?"vi-VN":language==="kr"?"ko-KR":"en-US",{month:"long",year:"numeric"})}</h2></header><div class="month-weekdays">${["T2","T3","T4","T5","T6","T7","CN"].map(x=>`<span>${x}</span>`).join("")}</div><div class="month-grid">${monthCells.map(day=>day?`<button class="month-day ${day===today.getDate()?"today":""}" aria-label="Ngày ${day}"><span>${day}</span>${rows.some(e=>e.date.getMonth()===today.getMonth()&&e.date.getDate()===day)?`<i aria-label="Có deadline"></i>`:""}</button>`:`<span></span>`).join("")}</div></section>`:`<div class="deadline-list">${rows.filter(e=>calendarView==="deadline"||e.days>=0).map(e=>`<article class="card deadline-card ${e.days<0?"overdue":e.days===0?"today":"upcoming"}"><div class="deadline-date"><strong>${e.date.getDate()}</strong><span>${e.date.toLocaleDateString("vi-VN",{month:"short"})}</span></div><div class="deadline-card__body"><div><span class="status-text">${e.status==="completed"?"Hoàn thành":e.days<0?`Quá hạn ${Math.abs(e.days)} ngày`:e.days===0?"Hôm nay":e.days===1?"Ngày mai":`Còn ${e.days} ngày`}</span><h2>${escapeHtml(e.course?.title||"")}</h2><p>${uiText("progressLabel")}: ${e.progressPercent}%</p>${progress(e.progressPercent)}</div><a href="/dashboard/courses/${e.courseId}" data-link class="btn btn-primary">${e.progressPercent?"Tiếp tục học":"Mở khóa học"}</a></div></article>`).join("")||`<div class="empty-state">Không có deadline phù hợp.</div>`}</div>`}</div></main></div>`;}
function exportExecutiveCsv(){if(!hasAdminAccess())return;const {from,to}=getReportDateBounds();const rows=enrichedEnrollments().filter(e=>{if(e.account?.role!=="employee")return false;if(reportDeptFilter&&e.account?.department!==reportDeptFilter)return false;if(reportCourseFilter&&e.courseId!==reportCourseFilter)return false;if(from&&e.assignedAt&&e.assignedAt<from)return false;if(to&&e.assignedAt&&e.assignedAt>to+"T23:59:59")return false;return true;});const data=[["Nhân viên","Phòng ban","Khóa học","Trạng thái","Tiến độ","Deadline"],...rows.map(e=>[e.account?.fullName||"",e.account?.department||"",e.course?.title||"",e.displayStatus||e.status,Number(e.progressPercent)||0,e.deadline||""])];const csv="﻿"+data.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\r\n");const rangeStr=from&&to?`_${from}_${to}`:`_${new Date().toISOString().slice(0,7)}`;const name=`MyKIS_Report${rangeStr}.csv`;const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);const snapshots=readLocalRows(REPORT_SNAPSHOTS_KEY);snapshots.unshift({id:crypto.randomUUID(),reportType:"executive_coo",filters:{from,to,dept:reportDeptFilter,course:reportCourseFilter},generatedAt:new Date().toISOString(),generatedBy:session.accountId,recipient:"COO",fileName:name,recordCount:rows.length});writeLocalRows(REPORT_SNAPSHOTS_KEY,snapshots.slice(0,50));}

function sessionStatusLabel(event){return event.status==="cancelled"?"Đã hủy":event.attendanceStatus==="attended"?"Đã tham dự":event.attendanceStatus==="partial"?"Tham dự một phần":event.responseStatus==="attending"?"Đã xác nhận tham gia":event.responseStatus==="busy"?"Bạn đã báo bận":"Chờ phản hồi";}
function offlineSessionCards() {
  const allEvents = _calendarEvents || [];
  const events = allEvents.filter(event => event.eventType === "offline_session");
  if (!events.length) return `<div class="empty-state"><p>Bạn chưa có lịch đào tạo sắp tới. Các buổi học được giao sẽ xuất hiện tại đây.</p></div>`;
  return events.map(event => {
    const source = offlineTrainingService.getSession(event.sessionId);
    const registration = offlineTrainingService.getRegistration(event.sessionId, session.accountId);
    const start = new Date(event.startAt);
    const closed = source?.registrationDeadline && new Date() > new Date(source.registrationDeadline);
    const slots = qrAttendanceService.listSlots(event.sessionId);
    return `<article class="card offline-session-card">
      <div class="session-date"><strong>${start.getDate()}</strong><span>${start.toLocaleDateString("vi-VN", { month: "short" })}</span></div>
      <div class="session-info">
        <span class="badge ${event.status}">${sessionStatusLabel(event)}</span>
        <h2>${escapeHtml(event.title || "")}</h2>
        <h3>${escapeHtml(event.subtitle || "")}</h3>
        <p>${start.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}–${new Date(event.endAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} · ${escapeHtml(event.location || "")}</p>
        <p>Giảng viên: ${escapeHtml(event.trainerName || "—")}</p>
        ${slots.length ? `<div class="session-slot-list">${slots.map(slot => {
          const openToken = qrAttendanceService.listTokens(slot.id).find(row => row.action === "check_in" && row.status === "open");
          return `<button class="slot-chip" data-auth-target="${openToken ? `/attendance/scan?token=${encodeURIComponent(openToken.opaqueToken)}` : "/dashboard/calendar"}" data-auth-role="employee" ${openToken ? "" : "disabled"}>${escapeHtml(slot.label)} · ${uiText("checkIn")}</button>`;
        }).join("")}</div>` : ""}
      </div>
      <div class="session-actions">
        ${source?.status === "scheduled" && !closed
          ? `<button class="btn btn-primary" data-session-response="${event.sessionId}" data-response="attending">Xác nhận tham gia</button><button class="btn btn-outline" data-session-busy="${event.sessionId}">Tôi bận</button>`
          : `<small>${source?.status === "cancelled" ? "Lịch học đã hủy" : closed ? "Đã hết hạn phản hồi" : ""}</small>`}
        <button class="btn btn-outline" data-open-scan-entry>${uiText("qrAttendance")}</button>
      </div>
    </article>`;
  }).join("");
}
function renderCalendarMonth(events){const base=new Date();base.setMonth(base.getMonth()+calendarMonthOffset,1);base.setHours(0,0,0,0);const today=new Date();const daysInMonth=new Date(base.getFullYear(),base.getMonth()+1,0).getDate(),offset=(base.getDay()+6)%7;const eventByDay=new Map();events.forEach(event=>{const date=new Date(event.startAt);if(date.getMonth()!==base.getMonth()||date.getFullYear()!==base.getFullYear())return;const day=date.getDate();eventByDay.set(day,[...(eventByDay.get(day)||[]),event]);});const effectiveSelectedDay=calendarSelectedDay&&eventByDay.has(calendarSelectedDay)?calendarSelectedDay:0;const selectedEvents=effectiveSelectedDay?(eventByDay.get(effectiveSelectedDay)||[]):[];const cells=[...Array(offset).fill(null),...Array.from({length:daysInMonth},(_,index)=>index+1)];return `<section class="card month-calendar"><header class="calendar-month-head"><button class="btn btn-outline mini-action" data-calendar-month="-1">‹</button><h2>${base.toLocaleDateString("vi-VN",{month:"long",year:"numeric"})}</h2><div class="calendar-month-head__actions"><button class="btn btn-outline mini-action" data-calendar-today>Hôm nay</button><button class="btn btn-outline mini-action" data-calendar-month="1">›</button></div></header><div class="month-weekdays">${["T2","T3","T4","T5","T6","T7","CN"].map(label=>`<span>${label}</span>`).join("")}</div><div class="month-grid">${cells.map(day=>day?`<button class="month-day ${day===today.getDate()&&calendarMonthOffset===0?"today":""} ${effectiveSelectedDay===day?"active":""}" data-calendar-day="${day}"><span>${day}</span>${eventByDay.get(day)?.length?`<small>${eventByDay.get(day).length} sự kiện</small><i aria-hidden="true"></i>`:""}</button>`:`<span></span>`).join("")}</div>${effectiveSelectedDay?`<section class="calendar-day-detail"><div class="panel-head"><div><h3>Ngày ${effectiveSelectedDay}/${base.getMonth()+1}</h3><p>${selectedEvents.length} sự kiện đã lên lịch</p></div><button class="btn btn-outline mini-action" data-calendar-clear-day>Đóng</button></div><div class="calendar-day-detail__list">${selectedEvents.map(event=>`<article class="calendar-event-row"><div><strong>${escapeHtml(event.title)}</strong><p>${escapeHtml(event.subtitle||"")}</p><small>${formatLocalDateTime(event.startAt)}${event.location?` · ${escapeHtml(event.location)}`:""}</small></div><a class="btn btn-outline mini-action" href="${event.actionUrl}" data-link>Chi tiết</a></article>`).join("")}</div></section>`:""}</section>`;}
function learningCalendarPageV3() {
  if (!hasEmployeeAccess()) return restrictedPage();
  const events = _calendarEvents || [];
  const sessionEvents = events.filter(event => event.eventType === "offline_session");
  const deadlineEvents = events.filter(event => event.eventType !== "offline_session");

  const sourceNote = _calendarSource === "api"
    ? ""
    : _calendarSource === "local" && !_calendarLoading
    ? `<p class="calendar-sync-note">Dữ liệu từ bộ nhớ cục bộ — có thể chưa đồng bộ.</p>`
    : "";

  const contentArea = _calendarLoading
    ? `<div class="calendar-loading"><div class="spinner" aria-label="Đang tải lịch học..."></div><p>Đang tải lịch học...</p></div>`
    : _calendarError
    ? `<div class="empty-state calendar-error">
        <p>Không thể tải lịch học: ${escapeHtml(_calendarError)}</p>
        <button class="btn btn-outline" data-calendar-refresh>Thử lại</button>
      </div>`
    : calendarView === "month"
    ? renderCalendarMonth(events)
    : calendarView === "upcoming"
    ? `<div class="offline-session-list">${offlineSessionCards()}</div>`
    : `<div class="deadline-list">${deadlineEvents.map(event => `
        <article class="card deadline-card ${event.status === "cancelled" ? "overdue" : ""}">
          <div class="deadline-date">
            <strong>${new Date(event.startAt).getDate()}</strong>
            <span>${new Date(event.startAt).toLocaleDateString("vi-VN", { month: "short" })}</span>
          </div>
          <div class="deadline-card__body">
            <div><h2>${escapeHtml(event.title || "")}</h2><p>${escapeHtml(event.subtitle || "")}</p></div>
            <a class="btn btn-primary" href="${escapeHtmlAttribute(event.actionUrl)}" data-link>${event.eventType === "course_deadline" ? "Mở khóa học" : "Xem chi tiết"}</a>
          </div>
        </article>`).join("") || `<div class="empty-state">Bạn chưa có deadline sắp tới.</div>`}
      </div>`;

  return `<div class="app-layout">${sideNav("employee")}<main class="app-main">
    ${topbar("Học tập", "Lịch học & deadline", "employee")}
    <div class="content route-content">
      <section class="calendar-head">
        <div>
          <span class="eyebrow">Online · Offline · Hybrid</span>
          <h1>Lịch học & deadline</h1>
          <p>Phản hồi lớp trực tiếp và theo dõi thời hạn học tập tại một nơi.</p>
          ${sourceNote}
        </div>
        <div class="view-tabs">
          <button class="${calendarView === "upcoming" ? "active" : ""}" data-calendar-view="upcoming">Sắp tới</button>
          <button class="${calendarView === "month" ? "active" : ""}" data-calendar-view="month">Theo tháng</button>
          <button class="${calendarView === "deadline" ? "active" : ""}" data-calendar-view="deadline">Deadline</button>
          <button class="btn-ghost calendar-refresh-btn" data-calendar-refresh title="Làm mới">↻</button>
        </div>
      </section>
      ${contentArea}
    </div>
  </main>${busyResponseModal()}</div>`;
}
function busyResponseModal(){if(!busySessionId)return "";return `<div class="modal-backdrop open"><form id="busyResponseForm" class="modal modal--medium modal--structured"><header class="modal__header"><h2>Lý do không thể tham gia</h2><button type="button" class="icon-btn" data-close-busy>×</button></header><div class="modal__body"><div class="field"><label>Lý do</label><select name="reason"><option>Trùng lịch công việc</option><option>Nghỉ phép/công tác</option><option>Đã tham gia lớp tương đương</option><option value="other">Lý do khác</option></select></div><div class="field"><label>Ghi chú</label><textarea name="note" maxlength="300" rows="3"></textarea></div></div><footer class="modal__footer"><button type="button" class="btn btn-outline" data-close-busy>Hủy</button><button class="btn btn-primary">Gửi phản hồi</button></footer></form></div>`;}

function adminSessionsPage(){if(!hasAdminAccess())return restrictedPage();const sessions=offlineTrainingService.listSessions();return `<div class="app-layout">${sideNav("hr")}<main class="app-main">${topbar("HR / L&D","Lớp trực tiếp & điểm danh","hr")}<div class="content route-content"><section class="library-head"><div><span class="eyebrow">Offline · Hybrid</span><h1>Quản lý buổi học</h1><p>Chọn người tham dự, mở QR theo từng slot và chốt attendance bằng dữ liệu thật.</p></div><button class="btn btn-primary" data-create-session>+ Thêm buổi học</button></section><div class="session-admin-list">${sessions.map(s=>{const regs=offlineTrainingService.ensureInvitations(s.id),attending=regs.filter(row=>row.responseStatus==="attending").length,attended=regs.filter(row=>["attended","partial"].includes(row.attendanceStatus)).length,summary=offlineTrainingService.participantSummary(s.id),slots=qrAttendanceService.getOrCreateDefaultSlots(s.id,session.accountId);return `<article class="card session-admin-card"><div class="session-admin-card__body"><span class="badge ${s.status}">${s.status}</span><h2>${escapeHtml(getCourseById(s.courseId)?.title||"")}</h2><h3>${escapeHtml(s.title)}</h3><p>${formatLocalDateTime(s.startAt)}–${new Date(s.endAt).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"})} · ${escapeHtml(s.locationName||s.meetingUrl||"")}</p><div class="session-admin-summary"><span>${summary.selected} / ${summary.capacity} người</span><span>${attending} xác nhận</span><span>${attended} đã điểm danh</span></div><div class="session-slot-list">${slots.map(slot=>`<span class="slot-chip">${escapeHtml(slot.label)}</span>`).join("")}</div></div><div class="session-admin-card__actions"><button class="btn btn-primary" data-manage-session="${s.id}">Quản lý người tham gia</button><button class="btn btn-outline" data-edit-session="${s.id}">Chỉnh sửa</button></div></article>`;}).join("")||`<div class="empty-state">Chưa có buổi học trực tiếp.</div>`}</div></div></main>${sessionEditorModal()}${attendanceModal()}${qrProjectorModal()}${importWizardModal()}</div>`;}
function sessionEditorModal(){if(!sessionFormOpen)return "";const s=offlineTrainingService.getSession(selectedOfflineSessionId)||{};const summary=s.id?offlineTrainingService.participantSummary(s.id):{selected:0,capacity:Number(s.capacity)||30,remaining:Number(s.capacity)||30,overBy:0};return `<div class="modal-backdrop open"><form id="offlineSessionForm" class="modal modal--large modal--structured"><header class="modal__header"><div><span class="eyebrow">Lịch học trực tiếp</span><h2>${s.id?"Chỉnh sửa buổi học":"Thêm buổi học"}</h2></div><button type="button" class="icon-btn" data-close-session-form>×</button></header><div class="modal__body"><input name="id" type="hidden" value="${s.id||""}"><div class="form-2col"><div class="field"><label>Khóa học *</label><select name="courseId" required>${getCourses().filter(c=>["offline","hybrid"].includes(c.deliveryMode)).map(c=>`<option value="${c.id}" ${s.courseId===c.id?"selected":""}>${escapeHtml(c.title)}</option>`).join("")}</select></div><div class="field"><label>Tên buổi học *</label><input name="title" required value="${escapeHtmlAttribute(s.title||"")}"></div><div class="field"><label>Bắt đầu *</label><input name="startAt" type="datetime-local" required value="${s.startAt?s.startAt.slice(0,16):""}"></div><div class="field"><label>Kết thúc *</label><input name="endAt" type="datetime-local" required value="${s.endAt?s.endAt.slice(0,16):""}"></div><div class="field"><label>Hạn xác nhận</label><input name="registrationDeadline" type="datetime-local" value="${s.registrationDeadline?s.registrationDeadline.slice(0,16):""}"></div><div class="field"><label>Giảng viên</label><input name="trainerName" value="${escapeHtmlAttribute(s.trainerName||"")}"></div><div class="field"><label>Hình thức</label><select name="locationType"><option value="onsite" ${s.locationType==="onsite"?"selected":""}>Trực tiếp</option><option value="online_live" ${s.locationType==="online_live"?"selected":""}>Online live</option><option value="hybrid" ${s.locationType==="hybrid"?"selected":""}>Kết hợp</option></select></div><div class="field"><label>Địa điểm *</label><input name="locationName" value="${escapeHtmlAttribute(s.locationName||"")}"></div><div class="field"><label>Sức chứa</label><input name="capacity" type="number" min="1" value="${s.capacity||30}"></div><div class="field"><label>Trạng thái</label><select name="status"><option value="scheduled" ${s.status==="scheduled"?"selected":""}>Scheduled</option><option value="completed" ${s.status==="completed"?"selected":""}>Completed</option><option value="cancelled" ${s.status==="cancelled"?"selected":""}>Cancelled</option></select></div></div><div class="participant-summary-bar"><strong>${summary.selected} người</strong><span>Sức chứa ${summary.capacity}</span><span>${summary.overBy?`Vượt ${summary.overBy} người`:`Còn ${summary.remaining} chỗ`}</span></div><div class="field-error" data-session-error></div></div><footer class="modal__footer"><button type="button" class="btn btn-outline" data-close-session-form>Hủy</button><button class="btn btn-primary">Lưu buổi học</button></footer></form></div>`;}
function attendanceModal(){if(!selectedOfflineSessionId||sessionFormOpen)return "";const s=offlineTrainingService.getSession(selectedOfflineSessionId);if(!s)return "";const regs=offlineTrainingService.ensureInvitations(s.id);const slots=qrAttendanceService.getOrCreateDefaultSlots(s.id,session.accountId);const summary=offlineTrainingService.participantSummary(s.id);selectedQrSlotId=selectedQrSlotId&&slots.some(slot=>slot.id===selectedQrSlotId)?selectedQrSlotId:(slots[0]?.id||"");const live=selectedQrSlotId?qrAttendanceService.getLiveSummary(selectedQrSlotId):null;const token=selectedQrSlotId?qrAttendanceService.listTokens(selectedQrSlotId).find(row=>row.action===selectedQrAction&&row.status==="open"):null;const participants=sessionParticipantAccounts(s.id);const filtered=availableEmployeeAccounts().filter(account=>(!sessionEmployeeSearch||`${account.fullName} ${account.email} ${account.employeeCode}`.toLowerCase().includes(sessionEmployeeSearch.toLowerCase()))&&(!sessionEmployeeDepartment||account.department===sessionEmployeeDepartment));const pageSize=8,totalPages=Math.max(1,Math.ceil(filtered.length/pageSize));sessionEmployeePage=Math.min(sessionEmployeePage,totalPages);const pageRows=filtered.slice((sessionEmployeePage-1)*pageSize,sessionEmployeePage*pageSize);return `<div class="modal-backdrop open"><section class="modal modal--xlarge modal--structured attendance-modal"><header class="modal__header"><div><span class="eyebrow">${escapeHtml(getCourseById(s.courseId)?.title||"")}</span><h2>Người tham gia & điểm danh</h2><p>${escapeHtml(s.title)} · ${formatLocalDateTime(s.startAt)}</p></div><button class="icon-btn" data-close-attendance>×</button></header><div class="modal__body"><section class="session-overview-strip"><div><strong>${summary.selected}</strong><span>Đã chọn</span></div><div><strong>${summary.capacity}</strong><span>Sức chứa</span></div><div><strong>${summary.overBy?`+${summary.overBy}`:summary.remaining}</strong><span>${summary.overBy?"Vượt chỗ":"Còn chỗ"}</span></div><div><strong>${regs.filter(row=>row.responseStatus==="attending").length}</strong><span>Xác nhận</span></div></section><section class="attendance-layout"><div class="attendance-layout__left"><div class="attendance-section card"><div class="panel-head"><div><h3>Chọn người tham dự</h3><p>${sessionParticipantSummaryLabel(s.id)}</p></div><div class="security-actions"><button class="btn btn-outline mini-action" data-session-add-assigned="${s.id}">Theo người được giao khóa học</button><button class="btn btn-outline mini-action" data-open-import-wizard="participants" data-import-target="${s.id}">Import Excel</button><button class="btn btn-outline mini-action" data-sync-participants>Đồng bộ Supabase</button></div></div><div class="session-picker-toolbar"><input type="search" data-session-employee-search value="${escapeHtmlAttribute(sessionEmployeeSearch)}" placeholder="Tìm tên, mã nhân viên hoặc email"><select data-session-employee-department><option value="">Tất cả phòng ban</option>${[...new Set(availableEmployeeAccounts().map(account=>account.department).filter(Boolean))].map(department=>`<option value="${escapeHtmlAttribute(department)}" ${sessionEmployeeDepartment===department?"selected":""}>${escapeHtml(department)}</option>`).join("")}</select><button class="btn btn-outline mini-action" data-session-select-visible>Chọn trang hiện tại</button></div><div class="department-picker">${[...new Set(availableEmployeeAccounts().map(account=>account.department).filter(Boolean))].map(department=>{const total=availableEmployeeAccounts().filter(account=>account.department===department).length;const chosen=participants.filter(account=>account.department===department).length;const active=selectedSessionDepartments.includes(department);return `<button class="department-chip ${active?"active":""}" data-session-department-chip="${escapeHtmlAttribute(department)}">${escapeHtml(department)} · ${chosen}/${total}</button>`;}).join("")}</div><div class="table-wrap"><table><thead><tr><th></th><th>Nhân viên</th><th>Phòng ban</th><th>Mã / Email</th></tr></thead><tbody>${pageRows.map(account=>`<tr><td><input type="checkbox" data-session-participant="${account.id}" ${participants.some(row=>row.id===account.id)?"checked":""}></td><td><strong>${escapeHtml(account.fullName)}</strong><small>${escapeHtml(account.position||"")}</small></td><td>${escapeHtml(account.department||"")}</td><td>${escapeHtml(account.employeeCode||account.email||"")}</td></tr>`).join("")}</tbody></table></div>${pagination("session-employees",sessionEmployeePage,totalPages)}<div class="selected-summary-card"><strong>${participants.length} nhân viên đã chọn</strong><div class="security-actions"><button class="btn btn-outline mini-action" data-open-selected-participants>Xem danh sách</button><button class="btn btn-outline mini-action" data-session-clear-selection="${s.id}">Xóa lựa chọn</button></div></div></div><div class="attendance-section card"><div class="panel-head"><div><h3>Điểm danh QR</h3><p>Thiết lập nhanh, trình chiếu và chốt attendance sau khi xử lý exception.</p></div><div class="security-actions"><button class="btn btn-outline mini-action" data-quick-setup-slots="${s.id}">Thiết lập nhanh</button><button class="btn btn-outline mini-action" data-open-import-wizard="attendance" data-import-target="${s.id}">Import attendance</button><button class="btn btn-outline mini-action" data-finalize-session="${s.id}">Chốt điểm danh</button></div></div><section class="qr-attendance-head"><div class="media-filter" role="tablist">${slots.map(slot=>`<button class="${selectedQrSlotId===slot.id?"active":""}" data-qr-slot="${slot.id}">${escapeHtml(slot.label)}</button>`).join("")}</div><div class="media-filter" role="tablist"><button class="${selectedQrAction==="check_in"?"active":""}" data-qr-action="check_in">${uiText("checkIn")}</button><button class="${selectedQrAction==="check_out"?"active":""}" data-qr-action="check_out">${uiText("checkOut")}</button></div><div class="qr-toolbar"><button class="btn btn-primary" data-generate-qr ${selectedQrSlotId?"":"disabled"}>${uiText("qrAttendance")}</button><button class="btn btn-outline" data-open-projector ${token?"":"disabled"}>${uiText("projector")}</button><button class="btn btn-outline" data-close-qr-token ${token?"":"disabled"}>${uiText("closeAttendance")}</button></div></section>${live?`<section class="kpi-grid qr-live-kpis"><div class="card kpi"><span>Được mời</span><strong>${live.invited}</strong></div><div class="card kpi"><span>${uiText("checkIn")}</span><strong>${live.checkedIn}</strong></div><div class="card kpi"><span>${uiText("checkOut")}</span><strong>${live.checkedOut}</strong></div><div class="card kpi"><span>Đến trễ</span><strong>${live.late}</strong></div><div class="card kpi"><span>Báo bận</span><strong>${live.busy}</strong></div><div class="card kpi"><span>Cần HR xem xét</span><strong>${live.exceptions}</strong></div></section>`:""}<div class="table-wrap"><table><thead><tr><th>Nhân viên</th><th>RSVP</th><th>${uiText("checkIn")} / ${uiText("checkOut")}</th><th>Attendance</th><th>Phút được tính</th><th>Thao tác</th></tr></thead><tbody>${regs.slice(0,50).map(r=>{const record=selectedQrSlotId?qrAttendanceService.getRecord(selectedQrSlotId,r.accountId):null;const account=getAccountById(r.accountId);return `<tr><td><strong>${escapeHtml(account?.fullName||"")}</strong><small>${escapeHtml(account?.department||"")}</small></td><td>${escapeHtml(r.responseStatus)}</td><td>${record?.checkInAt?`In ${escapeHtml(record.checkInAt.slice(11,16))}`:"—"}${record?.checkOutAt?` · Out ${escapeHtml(record.checkOutAt.slice(11,16))}`:""}</td><td><select data-attendance-status="${r.accountId}"><option value="attended" ${r.attendanceStatus==="attended"?"selected":""}>Đã tham dự</option><option value="partial" ${r.attendanceStatus==="partial"?"selected":""}>Tham dự một phần</option><option value="absent" ${r.attendanceStatus==="absent"?"selected":""}>Vắng mặt</option><option value="excused" ${r.attendanceStatus==="excused"?"selected":""}>Vắng có lý do</option></select></td><td><input data-attendance-minutes="${r.accountId}" type="number" min="0" value="${Math.round(Number(record?.countedSeconds||r.attendedSeconds||0)/60)}"></td><td><button class="btn btn-primary mini-action" data-save-attendance="${r.accountId}">Lưu</button></td></tr>`;}).join("")}</tbody></table></div></div></section></div></div></section></div>`;}

function importWizardModal(){if(!importWizardOpen)return "";const sheetOptions=importWorkbookState?.sheets||[];const preview=importWorkbookState&&importSheetName?excelImportService.getSheetPreview(importWorkbookState.workbook,importSheetName,importHeaderRowIndex,12):{headers:[],rows:[],totalRows:0};const fields=importFieldList(importWizardMode);return `<div class="modal-backdrop open"><section class="modal modal--xlarge modal--structured"><header class="modal__header"><div><span class="eyebrow">Excel Import Wizard</span><h2>${importWizardMode==="employees"?"Import nhân viên":importWizardMode==="participants"?"Import danh sách tham dự":"Import attendance"}</h2></div><button class="icon-btn" data-close-import-wizard>×</button></header><div class="modal__body"><section class="import-wizard-step"><h3>Bước 1 — Chọn file</h3><label class="upload-dropzone"><input type="file" accept=".xlsx,.xls,.csv" data-import-file hidden><strong>${importWorkbookState?escapeHtml(importWorkbookState.fileName):"Tải file Excel"}</strong><span>${importWorkbookState?`${(importWorkbookState.fileSize/1024).toFixed(0)} KB · ${sheetOptions.length} sheet`:"Hỗ trợ .xlsx và .xls"}</span></label></section>${importWorkbookState?`<section class="import-wizard-step"><h3>Bước 2 — Chọn sheet</h3><div class="sheet-chip-list">${sheetOptions.map(sheet=>`<button class="sheet-chip ${importSheetName===sheet.name?"active":""}" data-import-sheet="${escapeHtmlAttribute(sheet.name)}">${escapeHtml(sheet.name)}</button>`).join("")}</div></section><section class="import-wizard-step"><h3>Bước 3 — Chọn hàng tiêu đề</h3><div class="header-row-picker">${[0,1,2,3,4].map(index=>`<button class="sheet-chip ${importHeaderRowIndex===index?"active":""}" data-import-header-row="${index}">Hàng ${index+1}</button>`).join("")}</div><div class="table-wrap"><table><thead><tr>${preview.headers.map(header=>`<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${preview.rows.slice(0,8).map(row=>`<tr>${preview.headers.map(header=>`<td>${escapeHtml(row.values[header]||"")}</td>`).join("")}</tr>`).join("")}</tbody></table></div></section><section class="import-wizard-step"><h3>Bước 4 — Map cột</h3><div class="form-2col">${fields.map(([field,label])=>`<div class="field"><label>${label}</label><select data-import-map="${field}"><option value="">Không map</option>${preview.headers.map(header=>`<option value="${escapeHtmlAttribute(header)}" ${importColumnMapping[field]===header?"selected":""}>${escapeHtml(header)}</option>`).join("")}</select></div>`).join("")}</div><button class="btn btn-outline" data-import-autodetect>Gợi ý tự động</button></section><section class="import-wizard-step"><h3>Bước 5 — Preview & validation</h3>${importPreviewRows.length?`<div class="table-wrap"><table><thead><tr><th>Dòng</th><th>Mã nhân viên</th><th>Họ tên</th><th>Email</th><th>Phòng ban</th><th>Trạng thái</th></tr></thead><tbody>${importPreviewRows.map(row=>`<tr><td>${row.rowNumber}</td><td>${escapeHtml(row.employeeCode||"")}</td><td>${escapeHtml(row.fullName||"")}</td><td>${escapeHtml(row.email||"")}</td><td>${escapeHtml(row.department||"")}</td><td>${row.status==="valid"?"Hợp lệ":escapeHtml(row.message||"Lỗi")}</td></tr>`).join("")}</tbody></table></div>`:`<div class="empty-state"><p>Map ít nhất Mã nhân viên hoặc Email để xem preview.</p></div>`}</section>`:""}</div><footer class="modal__footer"><button class="btn btn-outline" data-close-import-wizard>Hủy</button>${importWorkbookState?`<button class="btn btn-outline" data-build-import-preview>Tạo preview</button><button class="btn btn-primary" data-confirm-import ${importPreviewRows.some(row=>row.status==="valid")?"":"disabled"}>Xác nhận import</button>`:""}</footer></section></div>`;}

function attendanceScanPage(tokenValue) {
  const activeSession = sessionService.getValidSession();
  if (!activeSession) return loginPage();

  // Token provided (from QR link or camera scan) — show confirmation UI
  if (tokenValue) {
    const preview = qrAttendanceService.validateToken(tokenValue);
    if (!preview.ok) {
      const errorMap = {
        expired: uiText("qrExpired"),
        not_open_yet: uiText("qrNotOpen"),
        closed: "QR đã đóng",
        session_cancelled: "Buổi học đã hủy",
        not_found: "QR không hợp lệ",
      };
      return `<div class="page">${header()}
        <section class="section"><div class="container">
          <div class="card attendance-result attendance-result--error">
            <div class="attendance-result__icon" aria-hidden="true">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <h2>${errorMap[preview.error] || "Không thể điểm danh"}</h2>
            <p>${preview.error === "expired" ? "Vui lòng quét mã QR mới đang được HR hiển thị." : preview.error === "not_open_yet" ? "Phiên điểm danh chưa mở. Vui lòng quét đúng thời gian." : "Mã QR không hợp lệ hoặc đã hết hiệu lực."}</p>
            <div class="hero-actions">
              <button class="btn btn-primary" data-qr-retry>Quét lại</button>
              <a class="btn btn-outline" href="/dashboard/calendar" data-link>${uiText("calendar")}</a>
            </div>
          </div>
        </div></section>
      </div>`;
    }

    const course = getCourseById(preview.session.courseId);
    const existing = qrAttendanceService.getRecord(preview.slot.id, activeSession.accountId);
    const alreadyDone = existing && ((preview.token.action === "check_in" && existing.checkInAt) || (preview.token.action === "check_out" && existing.checkOutAt));
    const needsCheckInFirst = preview.token.action === "check_out" && !existing?.checkInAt;
    const actionLabel = preview.token.action === "check_in" ? uiText("checkIn") : uiText("checkOut");
    const locationCapture = _qrScanLocationData
      ? `<p class="qr-location-info"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg> Vị trí đã xác định · Độ chính xác ~${Math.round(_qrScanLocationData.accuracy)}m</p>`
      : `<p class="qr-location-info qr-location-info--pending" id="qrLocationStatus"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> <span id="qrLocText">Đang lấy vị trí...</span></p>`;

    return `<div class="page">${header()}
      <section class="section"><div class="container">
        <div class="card panel qr-scan-result">
          <span class="eyebrow">${uiText("qrAttendance")}</span>
          <h1>${escapeHtml(course?.title || preview.session.title)}</h1>
          <p class="qr-session-meta">${escapeHtml(preview.slot.label)} · ${actionLabel}</p>
          ${preview.session.locationName ? `<p class="qr-session-location"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg> ${escapeHtml(preview.session.locationName)}</p>` : ""}
          ${alreadyDone
            ? `<div class="attendance-result attendance-result--already">
                <div class="attendance-result__icon"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
                <h3>${uiText("alreadyScanned")}</h3>
                <p>Hệ thống đã ghi nhận lượt điểm danh của bạn trước đó.${existing.checkInAt ? " Check-in: " + new Date(existing.checkInAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : ""}${existing.checkOutAt ? " · Check-out: " + new Date(existing.checkOutAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : ""}</p>
                <a class="btn btn-outline" href="/dashboard/calendar" data-link>${uiText("calendar")}</a>
              </div>`
            : needsCheckInFirst
            ? `<div class="attendance-result attendance-result--warn">
                <h3>Chưa có check-in</h3>
                <p>Vui lòng quét mã check-in trước khi check-out.</p>
                <button class="btn btn-primary" data-qr-retry>Quét lại</button>
              </div>`
            : `<div class="qr-confirm-actions">
                ${locationCapture}
                <div class="hero-actions">
                  <button class="btn btn-primary btn--hero" data-submit-scan="${escapeHtmlAttribute(tokenValue)}">${actionLabel}</button>
                  <a class="btn btn-outline" href="/dashboard/calendar" data-link>Huỷ</a>
                </div>
              </div>`}
        </div>
      </div></section>
    </div>`;
  }

  // No token — show camera scanner UI with consent gate
  if (!_qrCameraConsentGiven) {
    return `<div class="page">${header()}
      <section class="section"><div class="container">
        <div class="card panel qr-consent-card">
          <div class="qr-consent-icon" aria-hidden="true">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          </div>
          <h2>Cho phép sử dụng camera</h2>
          <p>MyKIS Learning cần truy cập camera để quét mã QR điểm danh do HR cung cấp.</p>
          <ul class="qr-consent-list">
            <li>Camera chỉ dùng để đọc mã QR điểm danh.</li>
            <li>Hệ thống không ghi hình, không lưu video.</li>
            <li>Camera sẽ tắt ngay sau khi quét thành công.</li>
          </ul>
          <div class="hero-actions">
            <button class="btn btn-primary btn--hero" data-qr-consent-accept>Tiếp tục quét QR</button>
            <a class="btn btn-outline" href="/dashboard/calendar" data-link>Huỷ</a>
          </div>
        </div>
      </div></section>
    </div>`;
  }

  return `<div class="page">${header()}
    <section class="section"><div class="container">
      <div class="card panel qr-camera-wrap">
        <span class="eyebrow">${uiText("qrAttendance")}</span>
        <h2>Quét mã QR điểm danh</h2>
        <p class="text-muted">Hướng camera vào mã QR được chiếu bởi HR.</p>
        <div class="qr-camera-viewport" id="qrCameraViewport">
          <video id="qrCameraVideo" autoplay muted playsinline></video>
          <canvas id="qrCameraCanvas" style="display:none"></canvas>
          <div class="qr-camera-corner qr-camera-corner--tl"></div>
          <div class="qr-camera-corner qr-camera-corner--tr"></div>
          <div class="qr-camera-corner qr-camera-corner--bl"></div>
          <div class="qr-camera-corner qr-camera-corner--br"></div>
          <div class="qr-scan-line"></div>
        </div>
        <p class="qr-camera-status" id="qrCameraStatus">Đang khởi động camera...</p>
        <div class="qr-camera-actions">
          <button class="btn btn-outline" id="qrCameraStop" style="display:none">Dừng camera</button>
          <a class="btn btn-ghost" href="/dashboard/calendar" data-link>Huỷ</a>
        </div>
      </div>
    </div></section>
  </div>`;
}

function qrProjectorModal(){if(!qrProjectorOpen||!currentQrTokenId)return "";const token=qrAttendanceService.listTokens().find(row=>row.id===currentQrTokenId);const slot=token?qrAttendanceService.getSlot(token.slotId):null;const sessionRow=slot?offlineTrainingService.getSession(slot.sessionId):null;const live=slot?qrAttendanceService.getLiveSummary(slot.id):null;if(!token||!slot||!sessionRow)return "";return `<div class="modal-backdrop open"><section class="modal modal--large modal--structured qr-projector"><header class="modal__header"><div><span class="eyebrow">${escapeHtml(slot.label)}</span><h2>${uiText("projector")}</h2></div><button class="icon-btn" data-close-projector>×</button></header><div class="modal__body"><div class="qr-projector__code" data-qr-render="${escapeHtmlAttribute(qrAttendanceService.attendanceLink(token))}"></div><div class="qr-projector__meta"><h3>${escapeHtml(sessionRow.title)}</h3><p>${escapeHtml(slot.label)} · ${token.action==="check_in"?uiText("checkIn"):uiText("checkOut")}</p><p>${new Date(token.opensAt).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"})}–${new Date(token.closesAt).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"})}</p><div class="kpi-grid"><div class="card kpi"><span>Đã quét</span><strong>${token.action==="check_in"?live?.checkedIn||0:live?.checkedOut||0}</strong></div><div class="card kpi"><span>Chưa quét</span><strong>${live?.pending||0}</strong></div></div><a class="btn btn-outline" href="${escapeHtmlAttribute(qrAttendanceService.attendanceLink(token))}" target="_blank" rel="noopener">Mở link scan</a></div></div><footer class="modal__footer"><button class="btn btn-outline" data-close-projector>Đóng</button><button class="btn btn-primary" data-close-qr-token>${uiText("closeAttendance")}</button></footer></section></div>`;}

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

function setupLearningTracking(){clearInterval(learningTimerId);learningTimerId=null;destroyYoutubePlayer();const stage=document.querySelector(".lesson-stage");if(!stage||!hasEmployeeAccess())return;const item=getCourseContent(stage.dataset.courseId).find(x=>x.id===stage.dataset.contentId);if(!item)return;lastTickAt=Date.now();
  if(item.type==="slide")learningTimerId=setInterval(()=>{if(document.hidden||!document.hasFocus())return;const viewer=document.querySelector(".slide-viewer");const slide=item.slides?.[activeSlideIndex];if(!viewer||!slide)return;const state=getContentProgress(session.accountId,item.courseId).find(x=>x.contentId===item.id);const slides={...(state?.metadata?.slides||{})};const prior=slides[slide.id]||{viewedSeconds:0,completed:false,rapidAdvanceAttempts:0};prior.viewedSeconds=Math.min(slide.minimumViewSeconds,prior.viewedSeconds+1);prior.completed=prior.viewedSeconds>=slide.minimumViewSeconds;prior.lastViewedAt=new Date().toISOString();slides[slide.id]=prior;const complete=item.slides.every(s=>slides[s.id]?.completed);saveContentProgress({accountId:session.accountId,courseId:item.courseId,contentId:item.id,contentType:"slide",activeSeconds:Number(state?.activeSeconds||0)+1,completionPercent:Math.round(Object.values(slides).filter(s=>s.completed).length/item.slides.length*100),completed:complete,metadata:{slides}});const remaining=Math.max(0,slide.minimumViewSeconds-prior.viewedSeconds);const timer=document.querySelector("[data-slide-timer]");if(timer)timer.textContent=`${remaining}s`;const next=document.querySelector(`[data-slide-nav="${activeSlideIndex+1}"]`);if(next&&remaining===0){next.disabled=false;next.removeAttribute("aria-disabled");}if(complete){clearInterval(learningTimerId);render();}},1000);
  const video=document.getElementById("course-video");if(video){let last=video.currentTime||0;video.playbackRate=Math.min(video.playbackRate,item.completionRule?.maxPlaybackRate||1.25);video.addEventListener("ratechange",()=>{if(video.playbackRate>(item.completionRule?.maxPlaybackRate||1.25))video.playbackRate=item.completionRule?.maxPlaybackRate||1.25;});video.addEventListener("seeking",()=>{const state=getContentProgress(session.accountId,item.courseId).find(x=>x.contentId===item.id);const allowed=Number(state?.metadata?.furthestAllowedTime||0)+2;if(video.currentTime>allowed){video.currentTime=Math.max(0,allowed-1);logLearningActivity({eventType:"invalid_seek",accountId:session.accountId,courseId:item.courseId,contentId:item.id});showLearningWarning(lt("invalidSeek"));}});video.addEventListener("timeupdate",()=>{if(document.hidden||video.paused||video.seeking||video.readyState<3)return;if(video.muted||video.volume<(item.completionRule?.minimumVolume||.1)){video.pause();showLearningWarning(lt("enableSound"));return;}const delta=Math.max(0,Math.min(1.5,video.currentTime-last));last=video.currentTime;if(!delta)return;const state=getContentProgress(session.accountId,item.courseId).find(x=>x.contentId===item.id);const watched=Number(state?.activeSeconds||0)+delta;const duration=video.duration||item.minimumDurationSeconds||1;const pct=Math.min(100,Math.round(watched/duration*100));saveContentProgress({accountId:session.accountId,courseId:item.courseId,contentId:item.id,contentType:"video",activeSeconds:watched,completionPercent:pct,completed:pct>=(item.completionRule?.requiredPercent||90),metadata:{furthestAllowedTime:Math.max(Number(state?.metadata?.furthestAllowedTime||0),video.currentTime),durationSeconds:duration}});});}
  if(item.sourceType==="youtube"&&item.youtubeVideoId){initYoutubeTracking(item.courseId,item.id,session.accountId,item.youtubeVideoId,item.completionRule?.requiredPercent??90);}
}
function recordRapidAdvance(viewer){if(!viewer)return;const stage=document.querySelector(".lesson-stage");const item=getCourseContent(stage.dataset.courseId).find(x=>x.id===stage.dataset.contentId);const state=getContentProgress(session.accountId,item.courseId).find(x=>x.contentId===item.id);const slide=item.slides[activeSlideIndex];const slides={...(state?.metadata?.slides||{})};const prior=slides[slide.id]||{viewedSeconds:0,completed:false,rapidAdvanceAttempts:0};prior.rapidAdvanceAttempts=(prior.rapidAdvanceAttempts||0)+1;slides[slide.id]=prior;saveContentProgress({accountId:session.accountId,courseId:item.courseId,contentId:item.id,contentType:"slide",metadata:{slides}});logLearningActivity({eventType:"rapid_advance_attempt",accountId:session.accountId,courseId:item.courseId,contentId:item.id,metadata:{slideId:slide.id,count:prior.rapidAdvanceAttempts}});showLearningWarning(prior.rapidAdvanceAttempts>=3?lt("rapidWarningLogged"):lt("rapidWarning"));}
function showLearningWarning(message){const el=document.getElementById("learning-warning");if(el)el.textContent=message;else toast(message);}
document.addEventListener("visibilitychange",()=>{const stage=document.querySelector(".lesson-stage");if(!stage)return;if(document.hidden){blurStartedAt=Date.now();document.getElementById("course-video")?.pause();if(_ytWatchStart!==null){try{_ytWatchRanges.push({start:_ytWatchStart,end:youtubePlayer?.getCurrentTime()||_ytWatchStart});}catch{}  _ytWatchStart=null;ytFlushRanges(false);}logLearningActivity({eventType:"tab_hidden",accountId:session.accountId,courseId:stage.dataset.courseId,contentId:stage.dataset.contentId,metadata:{durationSeconds:0}});}else{showLearningWarning(lt("pausedOnLeave"));}});
window.addEventListener("blur",()=>{blurStartedAt=Date.now();document.getElementById("course-video")?.pause();});

function render() {
  const _af = document.activeElement;
  const _afId = _af?.id || "";
  const _afKey = _af?.dataset?.focusKey || "";
  const _afSel = [_af?.selectionStart ?? null, _af?.selectionEnd ?? null];

  route = location.pathname.replace(/\/$/, "") || "/";
  document.body.dataset.route = route;
  session = sessionService.getValidSession();
  const routeParams = new URLSearchParams(location.search);
  selectedLoginRole = routeParams.get("role") || selectedLoginRole;
  const returnTo = routeParams.get("returnTo") || "";
  if (route === "/login" && returnTo && sessionService.canRedirectTo(returnTo)) {
    sessionService.setPostLoginRedirect(returnTo);
  }
  if ((route.startsWith("/dashboard") || route.startsWith("/attendance/scan")) && !session) {
    sessionService.setPostLoginRedirect(currentPathWithQuery());
  }
  if (route.startsWith("/admin") && !session) {
    sessionService.setPostLoginRedirect(currentPathWithQuery());
  }
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
  else if (route === "/attendance/scan") app.innerHTML = attendanceScanPage(routeParams.get("token") || "");
  else if (route === "/dashboard") app.innerHTML = hasEmployeeAccess() ? employeeDashboard(false) : session ? restrictedPage() : loginPage();
  else if (route === "/dashboard/courses") app.innerHTML = hasEmployeeAccess() ? myCoursesPage() : session ? restrictedPage() : loginPage();
  else if (route.startsWith("/dashboard/courses/")) app.innerHTML = coursePlayerPage(decodeURIComponent(route.split("/").pop()));
  else if (route === "/dashboard/quizzes") app.innerHTML = hasEmployeeAccess() ? employeeQuizzesPage() : session ? restrictedPage() : loginPage();
  else if (route === "/dashboard/gallery") app.innerHTML = galleryPageV2();
  else if (route.startsWith("/dashboard/gallery/")) app.innerHTML = galleryPageV2(decodeURIComponent(route.split("/").pop()));
  else if (route === "/dashboard/resources") app.innerHTML = employeeResourcesPage();
  else if (route === "/dashboard/history") app.innerHTML = learningHistoryPage();
  else if (route === "/dashboard/calendar") {
    // Trigger async fetch if: no data yet, not currently loading, or account changed
    if (session && (!_calendarEvents || _calendarAccountId !== session.accountId) && !_calendarLoading) {
      fetchCalendarEvents(session.accountId); // async, triggers re-render on completion
    }
    app.innerHTML = learningCalendarPageV3();
  }
  else if (route === "/admin") app.innerHTML = hasAdminAccess() ? adminDashboard(false) : session ? restrictedPage() : loginPage();
  else if (route === "/admin/employees") app.innerHTML = employeesPage();
  else if (route === "/admin/accounts") app.innerHTML = accountsPage();
  else if (route === "/admin/courses") app.innerHTML = hasAdminAccess() ? coursesPage() : session ? restrictedPage() : loginPage();
  else if (route === "/admin/assign") app.innerHTML = hasAdminAccess() ? assignPage() : session ? restrictedPage() : loginPage();
  else if (route === "/admin/quizzes") app.innerHTML = hasAdminAccess() ? adminQuizzesPage() : session ? restrictedPage() : loginPage();
  else if (route === "/admin/notifications") app.innerHTML = hasAdminAccess() ? notificationsPage() : session ? restrictedPage() : loginPage();
  else if (route === "/admin/reports") app.innerHTML = hasAdminAccess() ? reportsPage() : session ? restrictedPage() : loginPage();
  else if (route === "/admin/gallery") app.innerHTML = adminGalleryPageV2();
  else if (route === "/admin/sessions") app.innerHTML = adminSessionsPage();
  else if (route === "/change-password") app.innerHTML = changePasswordPage();
  else app.innerHTML = landingPage();
  app.insertAdjacentHTML("beforeend", sharedDialog());
  bindEvents();
  enhanceCourseImageForm();
  enhanceEmployeePhotoManager();
  hydrateEmployeePhotos();
  hydrateGalleryMedia();
  hydrateQrCanvases();
  enhanceReportsPage();
  enhanceTrainingReport();
  document.body.classList.toggle("modal-open", !!(contentBuilderMode || quizFormOpen || courseDrawerOpen || accountDrawerOpen || assignModalOpen || resetModalOpen || courseFormMode));
  setupLearningTracking();
  if (activeQuizAttempt) startQuizCountdown();
  if (location.hash) requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" }));
  // Restore focus after re-render so search/form inputs keep cursor position
  if (_afId || _afKey) requestAnimationFrame(() => {
    const el = (_afId && document.getElementById(_afId)) || (_afKey && document.querySelector(`[data-focus-key="${_afKey}"]`));
    if (!el) return;
    el.focus({ preventScroll: true });
    if (_afSel[0] != null && el.setSelectionRange) try { el.setSelectionRange(_afSel[0], _afSel[1]); } catch {}
  });
}

async function enhanceCourseImageForm(){const form=document.getElementById("courseForm");if(!form||form.querySelector(".course-image-upload"))return;const course=courseFormMode==="edit"?getCourseById(selectedCourseId):null;const body=form.querySelector(".modal__body");if(!body)return;const section=document.createElement("section");section.className="course-image-upload";section.innerHTML=`<img data-course-image-preview alt="${escapeHtmlAttribute(course?.imageAlt||course?.title||"")}"><div><label class="btn btn-outline" for="courseCoverInput">Cover image</label><input id="courseCoverInput" name="coverImage" type="file" accept="image/jpeg,image/png,image/webp" hidden><input name="coverImageId" type="hidden" value="${escapeHtmlAttribute(course?.coverImageId||"")}"><div class="field"><label>Alt text</label><input name="imageAlt" value="${escapeHtmlAttribute(course?.imageAlt||course?.title||"")}"></div><small>JPG, PNG, WebP · max 5 MB · 1200×675 recommended</small></div>`;body.prepend(section);if(course?.coverImageId){try{const blob=await getCourseImage(course.coverImageId);if(blob){const image=section.querySelector("img"),url=URL.createObjectURL(blob);image.src=url;image.dataset.objectUrl=url;}}catch{}}
  const input=section.querySelector("#courseCoverInput");input.addEventListener("change",async event=>{const file=event.target.files?.[0];if(!file)return;try{const id=await saveCourseImage(file);section.querySelector('[name="coverImageId"]').value=id;const image=section.querySelector("img");if(image.dataset.objectUrl)URL.revokeObjectURL(image.dataset.objectUrl);const url=URL.createObjectURL(file);image.src=url;image.dataset.objectUrl=url;}catch{toast("error");}});
}

function enhanceReportsPage(){if(route!=="/admin/reports")return;const content=document.querySelector(".app-main .content");if(!content||content.querySelector(".report-head"))return;const head=document.createElement("section");head.className="report-head";head.innerHTML=`<div><span class="eyebrow">Báo cáo điều hành COO</span><h1>Trung tâm báo cáo đào tạo</h1><p>Dữ liệu trực tiếp từ enrollment, tiến độ và kết quả kiểm tra hiện tại.</p></div><div class="report-actions"><button class="btn btn-primary" data-report-export>Xuất CSV</button><button class="btn btn-outline" data-report-print>Xuất PDF / In</button></div>`;content.prepend(head);head.querySelector("[data-report-export]").addEventListener("click",exportExecutiveCsv);head.querySelector("[data-report-print]").addEventListener("click",()=>window.print());}
function enhanceTrainingReport(){if(route!=="/admin/reports")return;const content=document.querySelector(".app-main .content"),head=content?.querySelector(".report-head");if(!content||!head||content.querySelector(".training-report-kpis"))return;const a=getCompanyTrainingAnalytics();const section=document.createElement("section");section.className="kpi-grid training-report-kpis";section.innerHTML=`<div class="card kpi"><span>Tổng giờ đào tạo</span><strong>${formatTrainingDuration(a.totalSeconds,language,true)}</strong></div><div class="card kpi"><span>Giờ online</span><strong>${formatTrainingDuration(a.onlineSeconds,language,true)}</strong></div><div class="card kpi"><span>Giờ offline</span><strong>${formatTrainingDuration(a.offlineSeconds,language,true)}</strong></div><div class="card kpi"><span>Trung bình giờ/người</span><strong>${formatTrainingDuration(a.averageSeconds,language,true)}</strong></div><div class="card kpi"><span>Tỷ lệ tham dự</span><strong>${a.attendanceRate}%</strong></div><div class="card kpi"><span>No-show</span><strong>${a.noShowRate}%</strong></div><div class="card kpi"><span>Báo bận</span><strong>${a.busyCount}</strong></div><div class="card kpi"><span>Tổng buổi / Đã hủy</span><strong>${a.totalSessions} / ${a.cancelledSessions}</strong></div>`;head.after(section);}
const employeePhotoUrls=new Map();
window.addEventListener("beforeunload",()=>{employeePhotoUrls.forEach(url=>URL.revokeObjectURL(url));employeePhotoUrls.clear();},{once:true});
window.addEventListener("beforeunload", (event) => {
  if (!hasUnsavedLearningState()) return;
  event.preventDefault();
  event.returnValue = "";
});
async function hydrateEmployeePhotos(){for(const el of document.querySelectorAll("[data-photo-blob-id],[data-photo-url]")){const id=el.dataset.photoBlobId,url=el.dataset.photoUrl;if(!id&&!url)continue;try{let src=url;if(id){if(!employeePhotoUrls.has(id)){const blob=await getEmployeePhoto(id);if(blob)employeePhotoUrls.set(id,URL.createObjectURL(blob));}src=employeePhotoUrls.get(id);}if(!src)continue;let img=el.querySelector("img");if(!img){img=document.createElement("img");img.alt=el.getAttribute("aria-label")||"";img.loading="lazy";img.addEventListener("error",()=>img.remove(),{once:true});el.append(img);}img.src=src;}catch{}}}
function enhanceEmployeePhotoManager(){if(!accountDrawerOpen||!selectedAccountId)return;const modal=document.querySelector(".modal-backdrop .modal");if(!modal||modal.querySelector(".employee-photo-manager"))return;const account=getAccountById(selectedAccountId),employee=getEmployeeByAccountId(selectedAccountId);if(!account||!employee)return;const section=document.createElement("section");section.className="employee-photo-manager";section.innerHTML=`<div>${employeeAvatar(account,employee,"employee-photo-manager__preview")}<div><h3>Ảnh đại diện</h3><p>JPG, PNG hoặc WebP · tối đa 5 MB</p></div></div><div class="employee-photo-manager__actions"><label class="btn btn-outline" for="employeePhotoInput">Thay ảnh</label><input id="employeePhotoInput" type="file" accept="image/jpeg,image/png,image/webp" hidden><button type="button" class="btn btn-ghost" data-remove-employee-photo ${employee.photoBlobId?"":"disabled"}>Xóa ảnh</button></div>`;modal.querySelector(".modal-head")?.after(section);hydrateEmployeePhotos();section.querySelector("#employeePhotoInput")?.addEventListener("change",async event=>{const file=event.target.files?.[0];if(!file)return;try{const photoBlobId=await saveEmployeePhoto(file);if(employee.photoBlobId)await deleteEmployeePhoto(employee.photoBlobId);updateEmployeeProfile(employee.id,{photoBlobId,photoFileName:file.name,photoUpdatedAt:new Date().toISOString(),photoUpdatedBy:session.accountId});accountDrawerOpen=false;toast("success");render();}catch{toast("error");}});section.querySelector("[data-remove-employee-photo]")?.addEventListener("click",async()=>{if(employee.photoBlobId)await deleteEmployeePhoto(employee.photoBlobId);updateEmployeeProfile(employee.id,{photoBlobId:null,photoFileName:"",photoUpdatedAt:new Date().toISOString(),photoUpdatedBy:session.accountId});accountDrawerOpen=false;render();});}

async function hydrateGalleryMedia(){for(const el of document.querySelectorAll("[data-media-blob]")){if(el.dataset.hydrated)return;try{const blob=await getGalleryMedia(el.dataset.mediaBlob);if(!blob)continue;const url=URL.createObjectURL(blob),node=el.dataset.mediaKind==="video"?document.createElement("video"):document.createElement("img");node.src=url;node.dataset.objectUrl=url;if(node.tagName==="VIDEO"){node.preload="metadata";node.muted=true;}else{node.loading="lazy";node.alt="";}el.replaceChildren(node);el.dataset.hydrated="1";}catch{}}const viewer=document.querySelector("[data-viewer-blob]");if(viewer){try{const blob=await getGalleryMedia(viewer.dataset.viewerBlob);if(blob){const url=URL.createObjectURL(blob);viewer.src=url;viewer.dataset.objectUrl=url;}}catch{}}}
async function hydrateQrCanvases(){const targets=[...document.querySelectorAll("[data-qr-render]")];if(!targets.length)return;try{if(!window.QRCode){await new Promise((resolve,reject)=>{const s=document.createElement("script");s.src="/vendor/qrcode.min.js";s.onload=resolve;s.onerror=reject;document.head.appendChild(s);});}for(const el of targets){if(el.dataset.hydratedQr==="1")continue;const canvas=document.createElement("canvas");await window.QRCode.toCanvas(canvas,el.dataset.qrRender,{width:280,margin:1,color:{dark:"#0b1f3a",light:"#ffffff"}});el.replaceChildren(canvas);el.dataset.hydratedQr="1";}}catch{targets.forEach(el=>{el.innerHTML=`<div class="empty-state"><p>Không thể tạo QR lúc này.</p><small>${escapeHtml(el.dataset.qrRender||"")}</small></div>`;});}}
function revokeGalleryUrls(){document.querySelectorAll("[data-object-url]").forEach(el=>{URL.revokeObjectURL(el.dataset.objectUrl);delete el.dataset.objectUrl;});}
async function saveSessionParticipants(accountIds,{mode="replace",source="manual"}={}){
  if(participantSyncState.saving)return {ok:false,error:"saving"};
  participantSyncState={saving:true,error:""};
  document.querySelectorAll("[data-session-participant],[data-session-select-visible],[data-session-clear-selection],[data-session-add-assigned]").forEach(el=>{el.disabled=true;});
  toast("Đang lưu danh sách học viên...");
  const result=await offlineTrainingService.setParticipantsAsync(selectedOfflineSessionId,accountIds,session.accountId,{mode,source});
  participantSyncState={saving:false,error:result.ok?"":result.message||"Không thể lưu học viên vào lớp trực tiếp."};
  if(!result.ok){openDialog({type:"alert",title:"Không thể lưu danh sách học viên",body:participantSyncState.error});return result;}
  _participantSyncedSessions.add(selectedOfflineSessionId);
  toast(`Đã đồng bộ ${result.remoteCount??result.participants.length} học viên vào lớp.`);
  render();
  return result;
}
// Silently pushes any existing localStorage participants to Supabase when HR opens a session.
// Runs once per session ID per page load to backfill data from before the async sync was deployed.
async function autoSyncParticipantsIfNeeded(sessionId){
  if(!sessionId||!session||_participantSyncedSessions.has(sessionId))return;
  const ids=offlineTrainingService.getParticipantAccountIds(sessionId);
  if(!ids.length)return;
  _participantSyncedSessions.add(sessionId);
  const result=await offlineTrainingService.setParticipantsAsync(sessionId,ids,session.accountId,{mode:"merge",source:"auto-sync"});
  if(result.ok)console.info("[participant-sync] backfilled",result.remoteCount,"participants for session",sessionId);
  else console.warn("[participant-sync] backfill failed for session",sessionId,":",result.message);
}
function bindEvents() {
  document.querySelector("[data-create-session]")?.addEventListener("click",()=>{selectedOfflineSessionId="";sessionFormOpen=true;render();});
  document.querySelectorAll("[data-edit-session]").forEach(el=>el.addEventListener("click",()=>{selectedOfflineSessionId=el.dataset.editSession;sessionFormOpen=true;render();}));
  document.querySelectorAll("[data-manage-session]").forEach(el=>el.addEventListener("click",()=>{selectedOfflineSessionId=el.dataset.manageSession;sessionFormOpen=false;render();autoSyncParticipantsIfNeeded(el.dataset.manageSession);}));
  document.querySelectorAll("[data-close-session-form]").forEach(el=>el.addEventListener("click",()=>{sessionFormOpen=false;selectedOfflineSessionId="";render();}));
  document.querySelector("[data-close-attendance]")?.addEventListener("click",()=>{selectedOfflineSessionId="";sessionEmployeeSearch="";sessionEmployeeDepartment="";render();});
  document.getElementById("offlineSessionForm")?.addEventListener("submit",event=>{event.preventDefault();const data=Object.fromEntries(new FormData(event.currentTarget));data.attendanceRequired=true;const result=offlineTrainingService.saveSession(data,session.accountId);if(!result.ok){event.currentTarget.querySelector("[data-session-error]").textContent=result.error==="invalid_time"?"Giờ kết thúc phải sau giờ bắt đầu.":result.error==="invalid_deadline"?"Hạn xác nhận phải trước giờ bắt đầu.":"Vui lòng kiểm tra thông tin buổi học.";return;}qrAttendanceService.getOrCreateDefaultSlots(result.session.id,session.accountId);sessionFormOpen=false;selectedOfflineSessionId=result.session.id;toast("success");render();});
  document.querySelectorAll("[data-save-attendance]").forEach(el=>el.addEventListener("click",()=>{const accountId=el.dataset.saveAttendance,status=document.querySelector(`[data-attendance-status="${accountId}"]`)?.value,minutes=document.querySelector(`[data-attendance-minutes="${accountId}"]`)?.value;el.disabled=true;const result=offlineTrainingService.markAttendance(selectedOfflineSessionId,accountId,{attendanceStatus:status,attendedMinutes:Number(minutes)},session.accountId);toast(result.ok?"success":"error");render();}));
  document.querySelectorAll("[data-session-response]").forEach(el=>el.addEventListener("click",()=>{el.disabled=true;el.textContent="Đang lưu...";const result=offlineTrainingService.respond(el.dataset.sessionResponse,session.accountId,el.dataset.response);toast(result.ok?"success":"error");render();}));
  document.querySelectorAll("[data-session-busy]").forEach(el=>el.addEventListener("click",()=>{busySessionId=el.dataset.sessionBusy;render();}));
  document.querySelectorAll("[data-close-busy]").forEach(el=>el.addEventListener("click",()=>{busySessionId="";render();}));
  document.getElementById("busyResponseForm")?.addEventListener("submit",event=>{event.preventDefault();const fd=new FormData(event.currentTarget),reason=fd.get("reason")==="other"?fd.get("note"):fd.get("reason");const result=offlineTrainingService.respond(busySessionId,session.accountId,"busy",reason);busySessionId="";toast(result.ok?"success":"error");render();});
  document.querySelector("[data-session-add-assigned]")?.addEventListener("click",async()=>{const sessionRow=offlineTrainingService.getSession(selectedOfflineSessionId);const ids=sessionRow?getEnrollmentsByCourseId(sessionRow.courseId).map(row=>row.accountId):[];await saveSessionParticipants(ids,{mode:"merge",source:"course_assignment"});});
  document.querySelector("[data-session-clear-selection]")?.addEventListener("click",async()=>{await saveSessionParticipants([],{mode:"replace",source:"manual"});});
  document.querySelector("[data-session-select-visible]")?.addEventListener("click",async()=>{const ids=availableEmployeeAccounts().filter(account=>(!sessionEmployeeSearch||`${account.fullName} ${account.email} ${account.employeeCode}`.toLowerCase().includes(sessionEmployeeSearch.toLowerCase()))&&(!sessionEmployeeDepartment||account.department===sessionEmployeeDepartment)).map(account=>account.id);await saveSessionParticipants(ids,{mode:"merge",source:"manual"});});
  document.querySelectorAll("[data-session-participant]").forEach((el)=>el.addEventListener("change",async()=>{const selected=new Set(offlineTrainingService.listParticipants(selectedOfflineSessionId).map(row=>row.accountId));if(el.checked)selected.add(el.dataset.sessionParticipant);else selected.delete(el.dataset.sessionParticipant);await saveSessionParticipants([...selected],{mode:"replace",source:"manual"});}));
  document.querySelectorAll("[data-session-department-chip]").forEach((el)=>el.addEventListener("click",async()=>{const department=el.dataset.sessionDepartmentChip;selectedSessionDepartments=selectedSessionDepartments.includes(department)?selectedSessionDepartments.filter(value=>value!==department):[...selectedSessionDepartments,department];if(selectedSessionDepartments.length){const ids=availableEmployeeAccounts().filter(account=>selectedSessionDepartments.includes(account.department)).map(account=>account.id);await saveSessionParticipants(ids,{mode:"merge",source:"department"});}else render();}));
  document.querySelector("[data-session-employee-search]")?.addEventListener("input",debounce((event)=>{sessionEmployeeSearch=event.target.value;sessionEmployeePage=1;render();},180));
  document.querySelector("[data-session-employee-department]")?.addEventListener("change",(event)=>{sessionEmployeeDepartment=event.target.value;sessionEmployeePage=1;render();});
  document.querySelector("[data-quick-setup-slots]")?.addEventListener("click",()=>{qrAttendanceService.getOrCreateDefaultSlots(selectedOfflineSessionId,session.accountId);toast("success");render();});
  document.querySelector("[data-finalize-session]")?.addEventListener("click",()=>{const result=qrAttendanceService.finalizeSessionAttendance(selectedOfflineSessionId,session.accountId,{allowExceptions:true,notifyLearners:true});toast(result.ok?"success":"error");render();});
  document.querySelectorAll("[data-open-import-wizard]").forEach((el)=>el.addEventListener("click",()=>{openImportWizard(el.dataset.openImportWizard||"employees",el.dataset.importTarget||"");render();}));
  document.querySelectorAll("[data-close-import-wizard]").forEach((el)=>el.addEventListener("click",()=>{resetImportWizard();render();}));
  document.querySelector("[data-import-file]")?.addEventListener("change",async(event)=>{const file=event.target.files?.[0];if(!file)return;importWorkbookState=await excelImportService.parseWorkbook(file);importSheetName=importWorkbookState.sheets[0]?.name||"";importHeaderRowIndex=0;importColumnMapping=excelImportService.suggestMapping(importWorkbookState.sheets[0]?.preview?.headers||[],importWizardMode);importPreviewRows=[];render();});
  document.querySelectorAll("[data-import-sheet]").forEach((el)=>el.addEventListener("click",()=>{importSheetName=el.dataset.importSheet;importColumnMapping=excelImportService.suggestMapping(excelImportService.getSheetPreview(importWorkbookState.workbook,importSheetName,importHeaderRowIndex,12).headers,importWizardMode);importPreviewRows=[];render();}));
  document.querySelectorAll("[data-import-header-row]").forEach((el)=>el.addEventListener("click",()=>{importHeaderRowIndex=Number(el.dataset.importHeaderRow);importColumnMapping=excelImportService.suggestMapping(excelImportService.getSheetPreview(importWorkbookState.workbook,importSheetName,importHeaderRowIndex,12).headers,importWizardMode);importPreviewRows=[];render();}));
  document.querySelectorAll("[data-import-map]").forEach((el)=>el.addEventListener("change",()=>{importColumnMapping={...importColumnMapping,[el.dataset.importMap]:el.value};}));
  document.querySelector("[data-import-autodetect]")?.addEventListener("click",()=>{const headers=excelImportService.getSheetPreview(importWorkbookState.workbook,importSheetName,importHeaderRowIndex,12).headers;importColumnMapping=excelImportService.suggestMapping(headers,importWizardMode);render();});
  document.querySelector("[data-build-import-preview]")?.addEventListener("click",()=>{const sheetPreview=excelImportService.getSheetPreview(importWorkbookState.workbook,importSheetName,importHeaderRowIndex,500);importPreviewRows=excelImportService.resolveRows(sheetPreview.rows,importColumnMapping,importWizardMode);render();});
  if(importWizardMode==="participants")document.querySelector("[data-confirm-import]")?.addEventListener("click",async(event)=>{event.stopImmediatePropagation();const ids=importPreviewRows.filter(row=>row.status==="valid"&&row.account).map(row=>row.account.id);const before=offlineTrainingService.listParticipants(importWizardTarget).length;selectedOfflineSessionId=importWizardTarget;const result=await saveSessionParticipants(ids,{mode:"merge",source:"excel"});if(!result.ok)return;const after=result.participants.length;resetImportWizard();openDialog({type:"alert",title:"Import người tham dự hoàn tất",body:`Đã đồng bộ ${Math.max(0,after-before)} người mới. Bỏ qua ${Math.max(0,ids.length-(after-before))} dòng trùng hoặc không hợp lệ.`});},{capture:true});
  document.querySelector("[data-confirm-import]")?.addEventListener("click",()=>{if(importWizardMode==="employees"){let created=0,updated=0,failed=0;importPreviewRows.forEach(row=>{if(row.status!=="valid"){failed++;return;}const result=employeeService.create({employeeCode:row.employeeCode,fullName:row.fullName,email:row.email,department:row.department,position:row.position,joinDate:row.joinDate,defaultLanguage:"vi",accountStatus:"active"});if(result.ok)created++;else failed++;});openDialog({type:"alert",title:"Import nhân viên hoàn tất",body:`Đã tạo: ${created} · Lỗi/Bỏ qua: ${failed}`});}else if(importWizardMode==="participants"){const ids=importPreviewRows.filter(row=>row.status==="valid"&&row.account).map(row=>row.account.id);const before=offlineTrainingService.getParticipantAccountIds(importWizardTarget).length;const result=offlineTrainingService.setParticipants(importWizardTarget,ids,session.accountId,{mode:"merge",source:"excel"});if(!result.ok)return toast("error");const after=offlineTrainingService.getParticipantAccountIds(importWizardTarget).length;openDialog({type:"alert",title:"Import người tham dự hoàn tất",body:`Đã thêm ${Math.max(0,after-before)} người mới. Bỏ qua ${Math.max(0,ids.length-(after-before))} dòng trùng hoặc không hợp lệ.`});}else if(importWizardMode==="attendance"){const sessionRow=offlineTrainingService.getSession(importWizardTarget);const slots=qrAttendanceService.getOrCreateDefaultSlots(importWizardTarget,session.accountId);if(!sessionRow||!slots.length)return toast("error");let updated=0,failed=0;importPreviewRows.forEach(row=>{if(row.status!=="valid"||!row.account){failed++;return;}const slot=slots.find(item=>item.label.toLowerCase()===normalizeAttendanceSlotLabel(row.slot).toLowerCase())||slots[0];const statusMap={attended:"manual_attended",present:"manual_attended","đã tham dự":"manual_attended",partial:"manual_partial","tham dự một phần":"manual_partial",absent:"manual_absent","vắng mặt":"manual_absent",excused:"exception","vắng có lý do":"exception"};const attendanceStatus=statusMap[String(row.attendanceStatus||"").trim().toLowerCase()]||"manual_attended";const startAt=row.checkIn?`${String(sessionRow.startAt).slice(0,10)}T${String(row.checkIn).trim()}:00+07:00`:"";const endAt=row.checkOut?`${String(sessionRow.startAt).slice(0,10)}T${String(row.checkOut).trim()}:00+07:00`:"";const result=qrAttendanceService.manualMark(slot.id,row.account.id,{attendanceStatus,checkInAt:startAt,checkOutAt:endAt,adjustmentReason:row.note||"Imported from Excel"},session.accountId);if(result.ok)updated++;else failed++;});openDialog({type:"alert",title:"Import điểm danh hoàn tất",body:`Đã cập nhật: ${updated} · Lỗi/Bỏ qua: ${failed}`});}resetImportWizard();toast("success");render();});
  if(!window.__galleryKeysBound){window.__galleryKeysBound=true;document.addEventListener("keydown",event=>{if(mediaViewerIndex<0)return;if(event.key==="Escape"){revokeGalleryUrls();mediaViewerIndex=-1;render();}if(event.key==="ArrowLeft"&&mediaViewerIndex>0){revokeGalleryUrls();mediaViewerIndex--;render();}if(event.key==="ArrowRight"){const album=galleryService.get(route.split("/").pop()),items=(album?.mediaItems||[]).filter(x=>galleryMediaFilter==="all"||x.type===galleryMediaFilter||(galleryMediaFilter==="video"&&x.type==="youtube"));if(mediaViewerIndex<items.length-1){revokeGalleryUrls();mediaViewerIndex++;render();}}});}
  document.querySelectorAll("[data-calendar-view]").forEach(el=>el.addEventListener("click",()=>{calendarView=el.dataset.calendarView;calendarSelectedDay=0;render();}));
  document.querySelectorAll("[data-calendar-month]").forEach((el)=>el.addEventListener("click",()=>{calendarMonthOffset+=Number(el.dataset.calendarMonth)||0;calendarSelectedDay=0;render();}));
  document.querySelector("[data-calendar-today]")?.addEventListener("click",()=>{calendarMonthOffset=0;calendarSelectedDay=0;render();});
  document.querySelector("[data-calendar-refresh]")?.addEventListener("click",()=>{if(session){_calendarEvents=null;_calendarLoading=false;fetchCalendarEvents(session.accountId);}});
  document.querySelector("[data-add-employee]")?.addEventListener("click",()=>{employeeFormOpen=true;employeeCreateResult=null;render();});
  document.getElementById("employeeImportFile")?.addEventListener("change",async event=>{const file=event.target.files?.[0];if(!file)return;openImportWizard("employees");importWorkbookState=await excelImportService.parseWorkbook(file);importSheetName=importWorkbookState.sheets[0]?.name||"";importColumnMapping=excelImportService.suggestMapping(importWorkbookState.sheets[0]?.preview?.headers||[],importWizardMode);importPreviewRows=[];render();});
  document.querySelector("[data-open-selected-participants]")?.addEventListener("click",()=>{const rows=sessionParticipantAccounts(selectedOfflineSessionId);openDialog({type:"alert",title:`Danh sách người tham dự (${rows.length})`,body:rows.length?rows.map((account,index)=>`${index+1}. ${account.fullName} — ${account.department||"Không rõ phòng ban"}`).join("\n"):"Chưa có nhân viên nào được chọn."});});
  document.querySelectorAll("[data-calendar-day]").forEach((el)=>el.addEventListener("click",()=>{calendarSelectedDay=Number(el.dataset.calendarDay)||0;render();}));
  document.querySelector("[data-calendar-clear-day]")?.addEventListener("click",()=>{calendarSelectedDay=0;render();});
  document.querySelectorAll("[data-timeline-year]").forEach((el) => el.addEventListener("click", () => {
    activeTimelineYear = el.dataset.timelineYear;
    render();
    document.getElementById("kis-history")?.scrollIntoView({ behavior: "smooth", block: "start" });
    requestAnimationFrame(() => {
      const activeNode = document.querySelector(".timeline-node.active");
      activeNode?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    });
  }));
  // Auto-scroll active timeline node into view on page load
  requestAnimationFrame(() => {
    const activeNode = document.querySelector(".timeline-node.active");
    activeNode?.scrollIntoView({ behavior: "auto", block: "nearest", inline: "center" });
  });
  document.querySelectorAll("[data-close-employee-form]").forEach(el=>el.addEventListener("click",()=>{employeeFormOpen=false;employeeCreateResult=null;render();}));
  document.getElementById("newEmployeePhoto")?.addEventListener("change",event=>{const file=event.target.files?.[0],preview=document.querySelector(".employee-photo-preview");if(!file||!preview)return;const url=URL.createObjectURL(file);preview.innerHTML=`<img src="${url}" alt="Xem trước ảnh đại diện">`;preview.querySelector("img").addEventListener("load",()=>URL.revokeObjectURL(url),{once:true});});
  document.getElementById("employeeCreateForm")?.addEventListener("submit",async event=>{event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type="submit"]'),data=Object.fromEntries(new FormData(form));button.disabled=true;button.textContent="Đang tạo...";const result=employeeService.create(data);if(!result.ok){const box=form.querySelector("[data-employee-form-error]");box.textContent=result.error==="duplicate_email"?"Email này đã được sử dụng bởi tài khoản khác.":result.error==="duplicate_code"?"Mã nhân viên này đã tồn tại.":"Vui lòng kiểm tra các trường bắt buộc.";button.disabled=false;button.textContent="Tạo hồ sơ & tài khoản";return;}const file=form.querySelector('[name="photo"]')?.files?.[0];if(file)try{await employeeService.uploadPhoto(result.employee.id,file);}catch{}employeeCreateResult=result;render();});
  document.querySelector("[data-copy-created-account]")?.addEventListener("click",()=>navigator.clipboard.writeText(`${employeeCreateResult.account.email}\n${employeeCreateResult.temporaryPassword}`).then(()=>toast("copied")));
  document.querySelector("[data-open-notifications]")?.addEventListener("click",()=>{notificationModalOpen=true;notificationPage=1;render();});
  document.querySelectorAll("[data-open-landing-announcement]").forEach(el=>el.addEventListener("click",()=>{selectedNotificationId=el.dataset.openLandingAnnouncement;render();}));
  document.querySelectorAll("[data-close-landing-detail]").forEach(el=>el.addEventListener("click",()=>{selectedNotificationId="";render();}));
  document.querySelectorAll("[data-close-notifications]").forEach(el=>el.addEventListener("click",event=>{if(event.target!==el&&el.classList.contains("notification-overlay"))return;notificationModalOpen=false;selectedNotificationId="";render();}));
  document.querySelectorAll("[data-notification-filter]").forEach(el=>el.addEventListener("click",()=>{notificationFilter=el.dataset.notificationFilter;notificationPage=1;selectedNotificationId="";render();}));
  document.querySelectorAll("[data-notification-detail]").forEach(el=>el.addEventListener("click",()=>{selectedNotificationId=el.dataset.notificationDetail;notificationService.markRead(selectedNotificationId,session.accountId);render();}));
  document.querySelector("[data-notification-back]")?.addEventListener("click",()=>{selectedNotificationId="";render();});
  document.querySelector("[data-mark-all-read]")?.addEventListener("click",()=>{notificationService.markAllRead(session.accountId);render();});
  document.querySelectorAll("[data-notification-page]").forEach(el=>el.addEventListener("click",()=>{notificationPage=Number(el.dataset.notificationPage);render();}));
  document.querySelector("[data-notification-prev]")?.addEventListener("click",()=>{const typed=notificationService.list(session.accountId).filter(n=>notificationFilter==="all"||(notificationFilter==="unread"?!n.isRead:String(n.type||"").includes(notificationFilter)));const index=typed.findIndex(n=>n.id===selectedNotificationId);if(index>0){selectedNotificationId=typed[index-1].id;notificationService.markRead(selectedNotificationId,session.accountId);render();}});
  document.querySelector("[data-notification-next]")?.addEventListener("click",()=>{const typed=notificationService.list(session.accountId).filter(n=>notificationFilter==="all"||(notificationFilter==="unread"?!n.isRead:String(n.type||"").includes(notificationFilter)));const index=typed.findIndex(n=>n.id===selectedNotificationId);if(index>=0&&index<typed.length-1){selectedNotificationId=typed[index+1].id;notificationService.markRead(selectedNotificationId,session.accountId);render();}});
  document.querySelectorAll("[data-auth-target]").forEach(el=>el.addEventListener("click",event=>{event.preventDefault();const target=el.dataset.authTarget||"/dashboard";navigateWithAuth(target,el.dataset.authRole||"employee");}));
  document.querySelector("[data-create-album]")?.addEventListener("click",()=>{selectedAlbumId="";galleryEditorOpen=true;render();});
  document.querySelectorAll("[data-edit-album]").forEach(el=>el.addEventListener("click",()=>{selectedAlbumId=el.dataset.editAlbum;galleryEditorOpen=true;render();}));
  document.querySelectorAll("[data-close-album-editor]").forEach(el=>el.addEventListener("click",()=>{galleryEditorOpen=false;selectedAlbumId="";render();}));
  document.getElementById("albumEditorForm")?.addEventListener("submit",event=>{event.preventDefault();const data=Object.fromEntries(new FormData(event.currentTarget));data.createdBy=session.accountId;data.allowDownload=new FormData(event.currentTarget).get("allowDownload")==="on";const result=galleryService.save(data);if(!result.ok)return toast("error");selectedAlbumId=result.album.id;galleryEditorOpen=true;toast("success");render();});
  document.getElementById("albumFiles")?.addEventListener("change",async event=>{const button=document.querySelector('#albumEditorForm [type="submit"]');if(button){button.disabled=true;button.textContent="Đang lưu media...";}const result=await galleryService.addFiles(selectedAlbumId,[...event.target.files]);toast(result.ok?"success":"error");render();});
  document.querySelector("[data-add-youtube]")?.addEventListener("click",()=>{const result=galleryService.addYoutube(selectedAlbumId,document.querySelector("[data-youtube-url]")?.value,document.querySelector("[data-youtube-caption]")?.value);toast(result.ok?"success":"error");if(result.ok)render();});
  document.querySelectorAll("[data-remove-album-media]").forEach(el=>el.addEventListener("click",async()=>{await galleryService.removeMedia(selectedAlbumId,el.dataset.removeAlbumMedia);render();}));
  document.querySelectorAll("[data-media-filter]").forEach(el=>el.addEventListener("click",()=>{galleryMediaFilter=el.dataset.mediaFilter;mediaViewerIndex=-1;render();}));
  document.querySelectorAll("[data-open-media]").forEach(el=>el.addEventListener("click",()=>{mediaViewerIndex=Number(el.dataset.openMedia);render();}));
  document.querySelector("[data-close-media]")?.addEventListener("click",()=>{revokeGalleryUrls();mediaViewerIndex=-1;render();});
  document.querySelectorAll("[data-media-index]").forEach(el=>el.addEventListener("click",()=>{revokeGalleryUrls();mediaViewerIndex=Number(el.dataset.mediaIndex);render();}));
  document.getElementById("galleryForm")?.addEventListener("submit",event=>{event.preventDefault();const f=new FormData(event.currentTarget),rows=readLocalRows(GALLERY_KEY);rows.unshift({id:crypto.randomUUID(),title:String(f.get("title")).trim(),description:String(f.get("description")||""),coverUrl:String(f.get("coverUrl")||""),coverAlt:String(f.get("description")||f.get("title")),courseId:String(f.get("courseId")||""),departmentNames:[],visibility:String(f.get("visibility")),status:"published",eventDate:String(f.get("eventDate")),createdBy:session.accountId,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),images:[]});writeLocalRows(GALLERY_KEY,rows);toast("success");render();});
  document.querySelectorAll("[data-gallery-toggle]").forEach(el=>el.addEventListener("click",()=>{const row=galleryService.get(el.dataset.galleryToggle);if(row){galleryService.save({...row,status:row.status==="published"?"archived":"published"});render();}}));
  document.querySelector("[data-gallery-search]")?.addEventListener("input",debounce(e=>{gallerySearch=e.target.value;render();},180));
  document.querySelector("[data-gallery-year]")?.addEventListener("change",e=>{galleryYear=e.target.value;render();});
  document.querySelector("[data-resource-search]")?.addEventListener("input",debounce(e=>{resourceSearch=e.target.value;render();},180));
  document.querySelectorAll("[data-resource-open]").forEach(el=>el.addEventListener("click",event=>{const r=resourceRows().find(x=>x.id===el.dataset.resourceOpen),e=employeeEnrollments().find(x=>x.courseId===r?.courseId);if(!r||!e||!isResourceUnlocked(r,e)){event.preventDefault();toast("error");return;}logLearningActivity({actorAccountId:session.accountId,accountId:session.accountId,courseId:r.courseId,eventType:"resource_downloaded",metadata:{resourceId:r.id}});}));
  document.querySelector("[data-report-export]")?.addEventListener("click",exportExecutiveCsv);
  document.querySelector("[data-report-print]")?.addEventListener("click",()=>window.print());
  document.querySelector("[data-export-csv]")?.addEventListener("click",exportExecutiveCsv);
  document.querySelector("[data-report-range]")?.addEventListener("change",e=>{reportDateRange=e.target.value;if(reportDateRange!=="custom"){reportDateFrom="";reportDateTo="";}render();});
  document.querySelector("[data-report-dept]")?.addEventListener("change",e=>{reportDeptFilter=e.target.value;render();});
  document.querySelector("[data-report-course]")?.addEventListener("change",e=>{reportCourseFilter=e.target.value;render();});
  document.getElementById("reportApply")?.addEventListener("click",()=>{reportDateFrom=document.getElementById("reportFrom")?.value||"";reportDateTo=document.getElementById("reportTo")?.value||"";render();});
  document.getElementById("reportReset")?.addEventListener("click",()=>{reportDateRange="all";reportDateFrom="";reportDateTo="";reportDeptFilter="";reportCourseFilter="";render();});
  document.getElementById("employeePhotoFolder")?.addEventListener("change",async event=>{const files=[...(event.target.files||[])].filter(file=>["image/jpeg","image/png","image/webp"].includes(file.type));const employees=getEmployees(),byCode=new Map(employees.map(employee=>{const account=employee.accountId?getAccountById(employee.accountId):null;return [String(account?.employeeCode||"").toLowerCase(),employee];}).filter(([code])=>code));const matched=[],unmatched=[];for(const file of files){const stem=file.name.replace(/\.[^.]+$/,"").toLowerCase();const employee=byCode.get(stem);if(employee)matched.push({file,employee});else unmatched.push(file.name);}if(!matched.length)return toast("error");const doPhotoImport=async()=>{for(const {file,employee} of matched){try{const photoBlobId=await saveEmployeePhoto(file);if(employee.photoBlobId)await deleteEmployeePhoto(employee.photoBlobId);updateEmployeeProfile(employee.id,{photoBlobId,photoFileName:file.name,photoUpdatedAt:new Date().toISOString(),photoUpdatedBy:session.accountId});}catch{}}}; openDialog({type:"confirm",title:"Xác nhận import ảnh",body:`${matched.length} file khớp thành công · ${unmatched.length} không tìm thấy nhân viên.`,onConfirm:()=>doPhotoImport().then(()=>{toast("success");render();})});});
  document.querySelector("[data-notification-create]")?.addEventListener("click",()=>{notificationComposerOpen=true;render();});
  document.querySelectorAll("[data-notification-close]").forEach(el=>el.addEventListener("click",()=>{notificationComposerOpen=false;render();}));
  { let composing=false; const el=document.querySelector("[data-notification-search]"); el?.addEventListener("compositionstart",()=>composing=true); el?.addEventListener("compositionend",e=>{composing=false;notificationSearch=e.target.value;render();}); el?.addEventListener("input",debounce(e=>{if(!composing){notificationSearch=e.target.value;render();}},180)); }
  document.getElementById("notificationForm")?.addEventListener("submit",event=>{event.preventDefault();const form=new FormData(event.currentTarget);const type=form.get("recipientType"),value=form.get("recipientValue");const result=sendNotificationCampaign({title:form.get("title"),body:form.get("body"),type:form.get("type"),recipientType:type,recipientIds:notificationRecipients(type,value),actionUrl:form.get("actionUrl"),createdBy:session.accountId});if(result.ok){notificationComposerOpen=false;toast("success");render();}else toast("error");});
  document.getElementById("courseCoverInput")?.addEventListener("change",async event=>{const file=event.target.files?.[0];if(!file)return;try{const id=await saveCourseImage(file);const hidden=document.querySelector('[name="coverImageId"]');if(hidden)hidden.value=id;const image=document.querySelector("[data-course-image-preview]");if(image){if(image.dataset.objectUrl)URL.revokeObjectURL(image.dataset.objectUrl);const url=URL.createObjectURL(file);image.src=url;image.dataset.objectUrl=url;}}catch{toast("error");}});
  document.querySelectorAll("[data-link]").forEach((el) => el.addEventListener("click", (event) => { event.preventDefault(); navigate(el.getAttribute("href")); }));
  document.querySelector("[data-logout]")?.addEventListener("click", () => {
    sessionService.endSession();
    session = null;
    _calendarEvents = null;
    _calendarLoading = false;
    _calendarError = null;
    _calendarAccountId = "";
    navigate("/login");
    toast(uiText("logoutSuccess"));
  });
  document.querySelectorAll("[data-language]").forEach((el) => el.addEventListener("click", () => {if(language===el.dataset.language)return;const main=document.querySelector(".app-main,.landing-page,.auth-page");main?.classList.add("i18n-transition");setTimeout(()=>{language=el.dataset.language;saveLanguage(language);render();requestAnimationFrame(()=>document.querySelector(".app-main,.landing-page,.auth-page")?.classList.add("i18n-enter"));},120);}));
  document.querySelector("[data-quiz-create]")?.addEventListener("click",()=>{quizFormOpen=true;selectedQuizId="";quizBuilderQuestions=[];quizBuilderCollapsed={};quizAddingQType=false;render();});
  document.querySelectorAll("[data-quiz-edit]").forEach(el=>el.addEventListener("click",()=>{quizFormOpen=true;selectedQuizId=el.dataset.quizEdit;quizBuilderQuestions=structuredClone(getQuizById(selectedQuizId)?.questions||[]);quizBuilderCollapsed={};quizAddingQType=false;render();}));
  document.querySelectorAll("[data-quiz-close]").forEach(el=>el.addEventListener("click",()=>{quizFormOpen=false;selectedQuizId="";quizAddingQType=false;render();}));
  document.querySelectorAll("[data-quiz-delete]").forEach(el=>el.addEventListener("click",()=>{if(deleteQuiz(el.dataset.quizDelete,session?.accountId)){toast("success");render();}else toast("error");}));
  document.querySelectorAll("[data-quiz-admin-view]").forEach(el=>el.addEventListener("click",()=>{quizAdminView=el.dataset.quizAdminView;render();}));
  { let _qsc = false;
    const el = document.getElementById("quizSearchInput");
    el?.addEventListener("compositionstart", () => { _qsc = true; });
    el?.addEventListener("compositionend", debounce((e) => { _qsc = false; quizSearch = e.target.value; render(); }, 30));
    el?.addEventListener("input", debounce((e) => { if (_qsc) return; quizSearch = e.target.value; render(); }, 180));
  }
  document.querySelector("[data-quiz-course-filter]")?.addEventListener("change",e=>{quizCourseFilter=e.target.value;render();});
  document.querySelector("[data-quiz-status-filter]")?.addEventListener("change",e=>{quizStatusFilter=e.target.value;render();});
  document.querySelector("[data-add-question]")?.addEventListener("click",()=>{quizBuilderQuestions=readQuestionEditors();quizAddingQType=true;render();});
  document.querySelector("[data-import-quiz-json]")?.addEventListener("click",()=>{try{const value=JSON.parse(document.querySelector("[data-quiz-json]")?.value||"");if(!Array.isArray(value))throw new Error();const valid=value.every(q=>q&&typeof q.text==="string"&&["singleChoice","multipleChoice","trueFalse","text"].includes(q.type)&&Number(q.points)>0&&(q.type==="text"||(Array.isArray(q.options)&&q.options.length>=2&&q.options.every(o=>typeof o==="string"||typeof o?.text==="string")&&(q.type==="multipleChoice"?Array.isArray(q.correctOptionIds)&&q.correctOptionIds.length>0:Boolean(q.correctOptionId)))));if(!valid)throw new Error();quizBuilderQuestions=value.map((q,i)=>({...q,id:q.id||`import-q-${Date.now()}-${i}`,options:(q.options||[]).map((o,j)=>typeof o==="string"?{id:`import-q-${Date.now()}-${i}-o${j+1}`,text:o}:o)}));toast("success");render();}catch{toast(t("quiz.invalidJson"));}});
  document.getElementById("quizForm")?.addEventListener("submit",(event)=>{event.preventDefault();if(!hasAdminAccess())return toast("error");quizBuilderQuestions=readQuestionEditors();const d=new FormData(event.currentTarget);const payload={courseId:String(d.get("courseId")),title:String(d.get("title")).trim(),description:String(d.get("description")||""),status:String(d.get("status")),passingScore:Number(d.get("passingScore")),timeLimitMinutes:Number(d.get("timeLimitMinutes")),attemptsAllowed:Number(d.get("attemptsAllowed")),shuffleQuestions:false,requireCourseCompletion:d.get("requireCourseCompletion")==="on",prerequisiteQuizId:String(d.get("prerequisiteQuizId")||""),createdBy:session.accountId,updatedBy:session.accountId,questions:quizBuilderQuestions};const result=selectedQuizId?updateQuiz(selectedQuizId,payload):createQuiz(payload);if(!result)return toast(t("quiz.invalidQuiz"));quizFormOpen=false;selectedQuizId="";quizBuilderQuestions=[];quizBuilderCollapsed={};quizAddingQType=false;toast("success");render();});
  document.querySelectorAll("[data-grade-attempt]").forEach(el=>el.addEventListener("click",()=>{const attempt=getQuizAttempts().find(a=>a.id===el.dataset.gradeAttempt);const quiz=getQuizById(attempt?.quizId);const question=quiz?.questions.find(q=>q.type==="text"&&!attempt.answers.find(a=>a.questionId===q.id&&Number.isFinite(a.awardedPoints)));if(!question)return;const answer=attempt.answers.find(a=>a.questionId===question.id)?.textAnswer||"";openDialog({type:"gradeInput",title:t("quiz.manualGrade"),body:`Câu hỏi: ${escapeHtml(question.text||"")}`,answer,maxPoints:question.points,onGrade:(pts)=>{const result=gradeQuizEssay({attemptId:attempt.id,questionId:question.id,points:pts,gradedBy:session.accountId});toast(result?"success":"error");render();}});}));
  document.querySelector("[data-quiz-export]")?.addEventListener("click",exportQuizCsv);
  document.querySelectorAll("[data-quiz-start]").forEach(el=>el.addEventListener("click",()=>{if(!hasEmployeeAccess())return toast("error");activeQuizAttempt=startQuizAttempt({quizId:el.dataset.quizStart,accountId:session.accountId});if(!activeQuizAttempt)return toast("error");quizCurrentQuestion=0;quizAnswers=Object.fromEntries((activeQuizAttempt.answers||[]).map(a=>[a.questionId,a.textAnswer??a.selectedOptionIds??a.selectedOptionId]));quizBookmarks=activeQuizAttempt.bookmarks||[];const started=new Date(activeQuizAttempt.startedAt.replace(" ","T")).getTime();quizSecondsRemaining=Math.max(0,activeQuizAttempt.quiz.timeLimitMinutes*60-Math.floor((Date.now()-started)/1000));render();}));
  document.querySelectorAll("[data-question-nav]").forEach(el=>el.addEventListener("click",()=>{captureQuizAnswer();quizCurrentQuestion=Number(el.dataset.questionNav);render();}));
  document.querySelector("[data-question-prev]")?.addEventListener("click",()=>{captureQuizAnswer();quizCurrentQuestion=Math.max(0,quizCurrentQuestion-1);render();});
  document.querySelector("[data-question-next]")?.addEventListener("click",()=>{captureQuizAnswer();quizCurrentQuestion=Math.min(activeQuizAttempt.quiz.questions.length-1,quizCurrentQuestion+1);render();});
  document.querySelector("[data-bookmark-question]")?.addEventListener("click",()=>{captureQuizAnswer();const id=activeQuizAttempt.quiz.questions[quizCurrentQuestion].id;quizBookmarks=quizBookmarks.includes(id)?quizBookmarks.filter(x=>x!==id):[...quizBookmarks,id];persistQuizDraft();render();});
  document.querySelectorAll("[data-answer-option]").forEach(el=>el.addEventListener("change",captureQuizAnswer));document.querySelector("[data-answer-text]")?.addEventListener("input",captureQuizAnswer);
  document.getElementById("quizAttemptForm")?.addEventListener("submit",(event)=>{event.preventDefault();captureQuizAnswer();openDialog({type:"confirm",title:t("quiz.confirmSubmit"),body:"Bạn sẽ không thể thay đổi câu trả lời sau khi nộp.",onConfirm:()=>finishQuizAttempt()});return;});
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
  // Password show/hide toggle
  document.querySelector("[data-toggle-password]")?.addEventListener("click", (e) => {
    const btn = e.currentTarget;
    const input = document.getElementById("loginPassword");
    if (!input) return;
    const isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";
    btn.setAttribute("aria-pressed", String(isPassword));
    btn.setAttribute("aria-label", isPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu");
    btn.querySelector(".eye-icon--show").style.display = isPassword ? "none" : "";
    btn.querySelector(".eye-icon--hide").style.display = isPassword ? "" : "none";
  });
  // role-toggle removed from login UI
  document.querySelector("[data-forgot-password]")?.addEventListener("click", () => {
    openDialog({ type: "support" });
  });
  function demoFillEffect(form) {
    const card = form.closest(".login-card") || form;
    card.classList.add("demo-filled");
    setTimeout(() => card.classList.remove("demo-filled"), 700);
    form.elements.identifier?.focus();
  }
  document.querySelector("[data-fill-demo-account]")?.addEventListener("click", () => {
    const form = document.getElementById("loginForm");
    if (!form) return;
    form.elements.identifier.value = DEMO_HR_EMAIL;
    form.elements.password.value = DEMO_HR_PASSWORD;
    demoFillEffect(form);
  });
  document.querySelector("[data-fill-demo-employee]")?.addEventListener("click", () => {
    const form = document.getElementById("loginForm");
    if (!form) return;
    form.elements.identifier.value = DEMO_EMPLOYEE_EMAIL;
    form.elements.password.value = DEMO_EMPLOYEE_PASSWORD;
    demoFillEffect(form);
  });
  document.getElementById("loginForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submitBtn = document.getElementById("loginSubmitBtn");
    const submitText = submitBtn?.querySelector(".login-submit-text");
    const submitSpinner = submitBtn?.querySelector(".login-submit-spinner");

    const data = new FormData(form);
    const email = String(data.get("identifier") || "").trim().toLowerCase();
    const emailError = form.querySelector("[data-login-email-error]");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      if (emailError) emailError.textContent = "Vui lòng nhập email công ty hợp lệ.";
      form.elements.identifier?.setAttribute("aria-invalid", "true");
      form.elements.identifier?.focus();
      return;
    }
    if (emailError) emailError.textContent = "";
    form.elements.identifier?.removeAttribute("aria-invalid");

    // Show loading state
    if (submitBtn) submitBtn.disabled = true;
    if (submitText) submitText.style.display = "none";
    if (submitSpinner) submitSpinner.style.display = "";

    // Simulate async to allow spinner to paint, then process
    requestAnimationFrame(() => setTimeout(() => {
      let result;
      try { result = login(email, data.get("password")); } catch {
        if (submitBtn) submitBtn.disabled = false;
        if (submitText) submitText.style.display = "";
        if (submitSpinner) submitSpinner.style.display = "none";
        return openDialog({ type: "system" });
      }
      if (!result.ok) {
        if (submitBtn) submitBtn.disabled = false;
        if (submitText) submitText.style.display = "";
        if (submitSpinner) submitSpinner.style.display = "none";
        return openDialog({ type: result.reason === "invalidEmail" ? "invalidCredentials" : result.reason });
      }
      session = sessionService.startSession(result.account, { rememberMe: data.get("rememberMe") === "on" });
      if (result.reason === "passwordResetRequired") navigate("/change-password");
      else navigate(sessionService.consumePostLoginRedirect(result.account.role === "hr" ? "/admin" : "/dashboard"));
    }, 280));
  });
  document.querySelectorAll("[data-dialog-close]").forEach((el) => el.addEventListener("click", closeDialog));
  document.querySelector("[data-dialog-leave]")?.addEventListener("click", () => {
    const target = pendingNavigation || "/dashboard";
    dialogState = null;
    pendingNavigation = "";
    bypassNavigationGuard = true;
    destroyYoutubePlayer();
    navigate(target);
  });
  document.querySelector("[data-dialog-confirm]")?.addEventListener("click", () => {
    const action = dialogState?.onConfirm;
    dialogState = null;
    if (typeof action === "function") action();
    render();
  });
  document.querySelector("[data-dialog-grade-submit]")?.addEventListener("click", () => {
    const input = document.getElementById("sdGradeInput");
    const errEl = document.getElementById("sdGradeError");
    const val = parseFloat(input?.value);
    const max = parseFloat(input?.max ?? "9999");
    if (!input || isNaN(val) || val < 0 || val > max) {
      if (errEl) errEl.textContent = `Vui lòng nhập điểm từ 0 đến ${max}.`;
      input?.focus();
      return;
    }
    const action = dialogState?.onGrade;
    dialogState = null;
    if (typeof action === "function") action(val);
    render();
  });
  // QR camera consent
  document.querySelector("[data-qr-consent-accept]")?.addEventListener("click", () => {
    _qrCameraConsentGiven = true;
    render();
  });

  // QR retry — back to camera scanner
  document.querySelector("[data-qr-retry]")?.addEventListener("click", () => {
    navigate("/attendance/scan");
  });

  // QR submit — geolocation then scan
  const submitScanBtn = document.querySelector("[data-submit-scan]");
  if (submitScanBtn) {
    submitScanBtn.addEventListener("click", () => {
      const tokenVal = submitScanBtn.dataset.submitScan || "";

      function doScan(locData) {
        const result = qrAttendanceService.scan(tokenVal, session.accountId, locData);
        if (!result.ok) {
          const msgMap = {
            already_checked_in: uiText("alreadyScanned"),
            already_checked_out: uiText("alreadyScanned"),
            not_invited: uiText("notInvited"),
            missing_check_in: "Vui lòng quét mã check-in trước khi check-out.",
            expired: uiText("qrExpired"),
          };
          openDialog({ type: "alert", title: "Không thể điểm danh", body: msgMap[result.error] || uiText("qrNotOpen") });
          return;
        }
        const now = new Date();
        const timeStr = now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
        const locNote = locData
          ? locData.insideGeofence === false
            ? "\n\nVị trí hiện tại nằm ngoài khu vực tổ chức. HR sẽ kiểm tra và xác nhận."
            : "\nVị trí đã được xác minh."
          : "";
        openDialog({
          type: "alert",
          title: "Điểm danh thành công",
          body: `Bạn đã được ghi nhận tham gia buổi học lúc ${timeStr}.${locNote}`,
        });
        render();
      }

      // Request geolocation with user-facing status update
      if (navigator.geolocation) {
        const locText = document.getElementById("qrLocText");
        if (locText) locText.textContent = "Đang xác định vị trí...";
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            _qrScanLocationData = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy };
            _qrScanLocationStatus = "acquired";
            doScan(_qrScanLocationData);
          },
          () => {
            _qrScanLocationStatus = "unavailable";
            doScan(null);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      } else {
        doScan(null);
      }
    });
  }

  // Start background geolocation for scan page (non-blocking)
  if (route === "/attendance/scan" && routeParams.get("token") && !_qrScanLocationData && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        _qrScanLocationData = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy };
        _qrScanLocationStatus = "acquired";
        const statusEl = document.getElementById("qrLocationStatus");
        const textEl = document.getElementById("qrLocText");
        if (statusEl) statusEl.className = "qr-location-info qr-location-info--ok";
        if (textEl) textEl.textContent = `Vị trí đã xác định · Độ chính xác ~${Math.round(pos.coords.accuracy)}m`;
      },
      () => { _qrScanLocationStatus = "unavailable"; },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }
  // Camera QR scanner init (only on /attendance/scan without token)
  if (document.getElementById("qrCameraViewport")) { initQrCameraScanner(); }
  document.querySelectorAll("[data-qr-slot]").forEach(el=>el.addEventListener("click",()=>{selectedQrSlotId=el.dataset.qrSlot;render();}));
  document.querySelectorAll("[data-qr-action]").forEach(el=>el.addEventListener("click",()=>{selectedQrAction=el.dataset.qrAction;render();}));
  document.querySelector("[data-generate-qr]")?.addEventListener("click",()=>{const result=qrAttendanceService.createToken({slotId:selectedQrSlotId,action:selectedQrAction},session.accountId);if(!result.ok)return toast("error");currentQrTokenId=result.token.id;qrProjectorOpen=true;render();});
  document.querySelector("[data-open-projector]")?.addEventListener("click",()=>{const token=qrAttendanceService.listTokens(selectedQrSlotId).find(row=>row.action===selectedQrAction&&row.status==="open");if(!token)return toast("error");currentQrTokenId=token.id;qrProjectorOpen=true;render();});
  document.querySelectorAll("[data-close-projector]").forEach(el=>el.addEventListener("click",()=>{qrProjectorOpen=false;render();}));
  document.querySelectorAll("[data-close-qr-token]").forEach(el=>el.addEventListener("click",()=>{const token=qrAttendanceService.listTokens(selectedQrSlotId).find(row=>row.action===selectedQrAction&&row.status==="open");if(token)qrAttendanceService.closeToken(token.id,session.accountId);qrProjectorOpen=false;render();}));
  document.querySelectorAll("[data-open-scan-entry]").forEach(el=>el.addEventListener("click",()=>{openDialog({type:"confirm",title:"Nhập token QR",body:"Tính năng nhập thủ công token QR hiện chỉ hỗ trợ bằng cách quét mã trực tiếp. Vui lòng quét mã QR bằng camera.",onConfirm:()=>{}});}));
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
  { let _esc = false;
    const el = document.getElementById("employeeDirSearch");
    el?.addEventListener("compositionstart", () => { _esc = true; });
    el?.addEventListener("compositionend", debounce((e) => { _esc = false; employeeDirectorySearch = e.target.value; employeeDirectoryPage = 1; render(); }, 30));
    el?.addEventListener("input", debounce((e) => { if (_esc) return; employeeDirectorySearch = e.target.value; employeeDirectoryPage = 1; render(); }, 180));
  }
  document.querySelectorAll("[data-employee-filter]").forEach((el) => el.addEventListener("change", () => { employeeDirectoryFilters[el.dataset.employeeFilter] = el.value; employeeDirectoryReviewIssues = false; employeeDirectoryPage = 1; render(); }));
  document.querySelector("[data-sort-employees]")?.addEventListener("click", () => { employeeDirectorySortAsc = !employeeDirectorySortAsc; render(); });
  document.querySelector("[data-review-issues]")?.addEventListener("click", () => { employeeDirectoryFilters = { department: "", position: "", accountStatus: "", cchn: "" }; employeeDirectorySearch = ""; employeeDirectoryReviewIssues = true; employeeDirectoryPage = 1; navigate("/admin/employees"); });
  document.querySelectorAll("[data-page-kind]").forEach((el) => el.addEventListener("click", () => { if (el.dataset.pageKind === "employees") employeeDirectoryPage = Number(el.dataset.page); if (el.dataset.pageKind === "cchn") cchnPage = Number(el.dataset.page); if (el.dataset.pageKind === "session-employees") sessionEmployeePage = Number(el.dataset.page); render(); }));
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
  document.querySelectorAll("[data-unlock-account]").forEach((el) => el.addEventListener("click", () => { openDialog({type:"confirm",title:t("admin.unlock"),body:"Tài khoản sẽ được mở khóa và nhân viên có thể đăng nhập lại.",onConfirm:()=>{unlockAccount(el.dataset.unlockAccount);toast("success");render();}}); }));
  document.querySelectorAll("[data-disable-account]").forEach((el) => el.addEventListener("click", () => { openDialog({type:"confirm",title:t("admin.disable"),body:"Tài khoản sẽ bị vô hiệu hóa. Nhân viên sẽ không thể đăng nhập.",onConfirm:()=>{disableAccount(el.dataset.disableAccount,"HR action");toast("success");render();}}); }));
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
  document.querySelector("[data-cchn-search]")?.addEventListener("input", (event) => { cchnSearch = event.target.value; cchnPage = 1; render(); });
  document.querySelector("[data-cchn-sort]")?.addEventListener("click", () => { cchnSortAsc = !cchnSortAsc; cchnPage = 1; render(); });
  document.querySelectorAll("[data-cchn-filter]").forEach((el) => el.addEventListener("change", () => { cchnFilters[el.dataset.cchnFilter] = el.value; render(); }));
  { let _csc = false;
    const el = document.getElementById("courseSearchInput");
    el?.addEventListener("compositionstart", () => { _csc = true; });
    el?.addEventListener("compositionend", debounce((e) => { _csc = false; courseSearch = e.target.value; render(); }, 30));
    el?.addEventListener("input", debounce((e) => { if (_csc) return; courseSearch = e.target.value; render(); }, 180));
  }
  document.querySelector("[data-course-filter-category]")?.addEventListener("change", (event) => { courseFilterCategory = event.target.value; render(); });
  document.querySelector("[data-course-filter-status]")?.addEventListener("change", (event) => { courseFilterStatus = event.target.value; render(); });
  document.querySelector("[data-course-create]")?.addEventListener("click", () => { courseFormMode = "create"; selectedCourseId = ""; courseDrawerOpen = false; render(); });
  document.querySelectorAll("[data-course-detail]").forEach((el) => el.addEventListener("click", () => { selectedCourseId = el.dataset.courseDetail; courseDrawerOpen = true; courseFormMode = ""; render(); }));
  document.querySelectorAll("[data-course-edit]").forEach((el) => el.addEventListener("click", () => { selectedCourseId = el.dataset.courseEdit; courseFormMode = "edit"; courseDrawerOpen = false; render(); }));
  document.querySelectorAll("[data-course-delete]").forEach((el) => el.addEventListener("click", () => {
    const courseId = el.dataset.courseDelete;
    if (getEnrollmentsByCourseId(courseId).length > 0) return toast("error");
    openDialog({type:"confirm",title:"Xóa khóa học",body:"Khóa học sẽ bị xóa vĩnh viễn. Tiến trình học liên quan sẽ không bị xóa.",onConfirm:()=>{
      const deleted = deleteCourse(courseId);
      if (deleted && selectedCourseId === courseId) { selectedCourseId = ""; courseDrawerOpen = false; courseFormMode = ""; }
      toast(deleted ? "success" : "error");
      render();
    }});
  }));
  document.querySelector("[data-close-course-drawer]")?.addEventListener("click", () => { courseDrawerOpen = false; contentBuilderMode = ""; selectedContentId = ""; render(); });
  document.querySelectorAll("[data-close-course-form]").forEach((el) => el.addEventListener("click", () => { courseFormMode = ""; render(); }));
  document.querySelector("[data-content-add]")?.addEventListener("click", () => { contentBuilderMode = "add"; selectedContentId = ""; contentPickerStep = "type"; slideDraft = null; youtubeDraft = null; render(); });
  document.querySelectorAll("[data-content-edit]").forEach(el => el.addEventListener("click", () => { const item = getCourseContent(selectedCourseId).find(x=>x.id===el.dataset.contentEdit); if(!item)return; contentBuilderMode = "edit"; selectedContentId = item.id; contentBuilderType = item.type; render(); }));
  document.querySelectorAll("[data-content-delete]").forEach(el => el.addEventListener("click", () => { const cid=el.dataset.contentDelete;openDialog({type:"confirm",title:"Xóa nội dung bài học",body:"Nội dung sẽ bị xóa. Tiến trình học liên quan sẽ không bị xóa.",onConfirm:()=>{deleteCourseContent(cid);toast("success");render();}}); }));
  document.querySelectorAll("[data-content-move-up]").forEach(el => el.addEventListener("click", () => { const items = getCourseContent(selectedCourseId); const i = items.findIndex(x=>x.id===el.dataset.contentMoveUp); if(i<=0)return; const ids=items.map(x=>x.id); [ids[i-1],ids[i]]=[ids[i],ids[i-1]]; reorderCourseContent(selectedCourseId,ids); render(); }));
  document.querySelectorAll("[data-content-move-down]").forEach(el => el.addEventListener("click", () => { const items = getCourseContent(selectedCourseId); const i = items.findIndex(x=>x.id===el.dataset.contentMoveDown); if(i<0||i>=items.length-1)return; const ids=items.map(x=>x.id); [ids[i],ids[i+1]]=[ids[i+1],ids[i]]; reorderCourseContent(selectedCourseId,ids); render(); }));
  document.querySelectorAll("[data-content-form-close]").forEach(el => el.addEventListener("click", () => { contentBuilderMode = ""; selectedContentId = ""; contentPickerStep = "type"; slideDraft = null; youtubeDraft = null; quizPickSearch = ""; render(); }));
  // Content type picker
  document.querySelectorAll("[data-pick-content-type]").forEach(el => el.addEventListener("click", () => { contentPickerStep = el.dataset.pickContentType; render(); }));
  // YouTube form submit
  document.getElementById("contentYoutubeForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!hasAdminAccess()) return toast("error");
    const fd = new FormData(e.currentTarget);
    const rawUrl = String(fd.get("youtubeUrl")||"").trim();
    const vid = normalizeYoutubeId(rawUrl);
    if (!vid || !/^[a-zA-Z0-9_-]{11}$/.test(vid)) { const errEl = document.getElementById("ytUrlError"); if (errEl) { errEl.style.display=""; errEl.textContent="URL YouTube không hợp lệ"; } return; }
    const title = String(fd.get("title")||"").trim();
    if (!title) return toast("error");
    const payload = { courseId: selectedCourseId, title, type: "video", sourceType: "youtube", youtubeVideoId: vid, required: fd.get("required")==="on", completionWeight: Number(fd.get("completionWeight"))||1, minimumDurationSeconds: Number(fd.get("minimumDurationSeconds"))||0, transcript: String(fd.get("transcript")||""), transcriptAlternativeAllowed: fd.get("transcriptAlternativeAllowed")==="on", completionRule: { requiredPercent: Number(fd.get("requiredPercent"))||90 } };
    const result = contentBuilderMode==="edit"&&selectedContentId ? updateCourseContent(selectedContentId,payload) : createCourseContent(payload);
    if (!result) return toast("error");
    contentBuilderMode=""; selectedContentId=""; contentPickerStep="type"; youtubeDraft=null;
    toast("success"); render();
  });
  // YouTube URL live preview (no full render)
  { const ytInput = document.getElementById("ytUrlInput");
    if (ytInput) { let _ytc = false;
      ytInput.addEventListener("compositionstart", () => { _ytc = true; });
      ytInput.addEventListener("compositionend", debounce((e) => { _ytc=false; updateYtPreview(e.target.value); }, 30));
      ytInput.addEventListener("input", debounce((e) => { if (_ytc) return; updateYtPreview(e.target.value); }, 500));
    }
  }
  // Quiz pick search (no full render)
  { let _qps = false;
    const el = document.getElementById("quizPickSearchInput");
    el?.addEventListener("compositionstart", () => { _qps = true; });
    el?.addEventListener("compositionend", debounce((e) => { _qps=false; quizPickSearch=e.target.value; renderQuizPickResults(); }, 30));
    el?.addEventListener("input", debounce((e) => { if (_qps) return; quizPickSearch=e.target.value; renderQuizPickResults(); }, 180));
  }
  // Select existing quiz for content
  document.querySelectorAll("[data-select-quiz-for-content]").forEach(el => el.addEventListener("click", () => {
    const quiz = getQuizById(el.dataset.selectQuizForContent);
    if (!quiz) return toast("error");
    const payload = { courseId: selectedCourseId, title: quiz.title, type: "quiz", quizId: quiz.id, required: true, completionWeight: 1, completionRule: { requirePass: true } };
    const result = createCourseContent(payload);
    if (!result) return toast("error");
    contentBuilderMode=""; selectedContentId=""; contentPickerStep="type"; quizPickSearch="";
    toast("success"); render();
  }));
  // Slide form submit
  document.getElementById("contentSlideForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!hasAdminAccess()) return toast("error");
    const fd = new FormData(e.currentTarget);
    const title = String(fd.get("title")||"").trim();
    const isText = fd.get("isText") === "1";
    if (!title) { const errEl = document.getElementById("slideError"); if(errEl){errEl.textContent="Vui lòng nhập tên bài học";errEl.classList.add("show");} return; }
    if (!isText && !slideDraft?.fileName && contentBuilderMode !== "edit") { const errEl = document.getElementById("slideError"); if(errEl){errEl.textContent="Vui lòng chọn file";errEl.classList.add("show");} return; }
    const payload = {
      courseId: selectedCourseId, title, type: "slide",
      slideContent: isText ? String(fd.get("slideContent")||"") : String(fd.get("description")||""),
      required: fd.get("required")==="on", completionWeight: Number(fd.get("completionWeight"))||1,
      minimumDurationSeconds: Number(fd.get("minimumDurationSeconds"))||8,
      blobId: slideDraft?.blobId||null, pageCount: slideDraft?.pageCount||1,
    };
    const result = contentBuilderMode==="edit"&&selectedContentId ? updateCourseContent(selectedContentId,payload) : createCourseContent(payload);
    if (!result) return toast("error");
    if (slideDraft?.thumbs) slideDraft.thumbs.forEach(u => { try { URL.revokeObjectURL(u); } catch {} });
    contentBuilderMode=""; selectedContentId=""; contentPickerStep="type"; slideDraft=null;
    toast("success"); render();
  });
  // Drop zone and file input
  { const dropZone = document.getElementById("slideDropZone");
    const fileInput = document.getElementById("slideFileInput");
    if (dropZone && fileInput) {
      dropZone.addEventListener("click", () => fileInput.click());
      dropZone.addEventListener("keydown", (e) => { if(e.key==="Enter"||e.key===" ") fileInput.click(); });
      dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.classList.add("drag-over"); });
      dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
      dropZone.addEventListener("drop", (e) => { e.preventDefault(); dropZone.classList.remove("drag-over"); handleSlideFiles(e.dataTransfer.files); });
      fileInput.addEventListener("change", (e) => handleSlideFiles(e.target.files));
    }
  }
  // "Use sample video" button
  document.getElementById("ytUseSample")?.addEventListener("click", () => {
    const sampleId = "dQw4w9WgXcQ";
    const ytInput = document.getElementById("ytUrlInput");
    if (ytInput) { ytInput.value = `https://youtu.be/${sampleId}`; updateYtPreview(ytInput.value); }
  });
  // Auto-show YouTube preview when editing
  { const ytInputEl = document.getElementById("ytUrlInput");
    if (ytInputEl?.value) updateYtPreview(ytInputEl.value);
  }
  // Add-question type picker
  document.querySelectorAll("[data-add-q-type]").forEach(el => el.addEventListener("click", () => {
    quizBuilderQuestions = readQuestionEditors();
    const qtype = el.dataset.addQType;
    const newQ = { id:`q-${Date.now()}`, type: qtype, text:"", points:1, explanation:"", options: ["singleChoice","single_choice","multipleChoice","multiple_choice"].includes(qtype)?[{id:`o${Date.now()}1`,text:""},{id:`o${Date.now()}2`,text:""}]:[] };
    quizBuilderQuestions.push(newQ);
    quizAddingQType = false;
    render();
    requestAnimationFrame(() => {
      const lastCard = document.querySelector(`[data-q-idx="${quizBuilderQuestions.length-1}"] textarea`);
      lastCard?.focus();
      lastCard?.scrollIntoView({ behavior:"smooth", block:"nearest" });
    });
  }));
  // Question card toggle / move / duplicate / delete
  document.querySelectorAll("[data-q-toggle]").forEach(el => el.addEventListener("click", () => {
    quizBuilderQuestions = readQuestionEditors();
    const idx = Number(el.dataset.qToggle);
    quizBuilderCollapsed[idx] = !quizBuilderCollapsed[idx];
    render();
  }));
  document.querySelectorAll("[data-q-move-up]").forEach(el => el.addEventListener("click", () => {
    quizBuilderQuestions = readQuestionEditors();
    const i = Number(el.dataset.qMoveUp);
    if (i<=0) return;
    [quizBuilderQuestions[i-1],quizBuilderQuestions[i]] = [quizBuilderQuestions[i],quizBuilderQuestions[i-1]];
    render();
  }));
  document.querySelectorAll("[data-q-move-down]").forEach(el => el.addEventListener("click", () => {
    quizBuilderQuestions = readQuestionEditors();
    const i = Number(el.dataset.qMoveDown);
    if (i>=quizBuilderQuestions.length-1) return;
    [quizBuilderQuestions[i],quizBuilderQuestions[i+1]] = [quizBuilderQuestions[i+1],quizBuilderQuestions[i]];
    render();
  }));
  document.querySelectorAll("[data-q-duplicate]").forEach(el => el.addEventListener("click", () => {
    quizBuilderQuestions = readQuestionEditors();
    const i = Number(el.dataset.qDuplicate);
    const clone = structuredClone(quizBuilderQuestions[i]);
    clone.id = `q-dup-${Date.now()}`;
    quizBuilderQuestions.splice(i+1, 0, clone);
    render();
  }));
  document.querySelectorAll("[data-q-delete]").forEach(el => el.addEventListener("click", () => {
    quizBuilderQuestions = readQuestionEditors().filter((_,i)=>i!==Number(el.dataset.qDelete));
    delete quizBuilderCollapsed[Number(el.dataset.qDelete)];
    render();
  }));
  // Dynamic option/acc/pair/item add+delete
  document.querySelectorAll("[data-q-add-opt]").forEach(el => el.addEventListener("click", () => {
    const idx = Number(el.dataset.qAddOpt);
    quizBuilderQuestions = readQuestionEditors();
    const q = quizBuilderQuestions[idx];
    if (!q.options) q.options = [];
    const newOpt = { id:`o${Date.now()}`, text:"" };
    q.options.push(newOpt);
    const container = document.getElementById(`q-opts-${idx}`);
    const isMulti = ["multipleChoice","multiple_choice"].includes(q.type);
    const oi = q.options.length - 1;
    const row = document.createElement("div");
    row.className = "q-option-row";
    row.innerHTML = `<input type="${isMulti?"checkbox":"radio"}" name="${isMulti?`q_${idx}_correct[]`:`q_${idx}_correct`}" value="${escapeHtmlAttribute(newOpt.id)}"><input type="text" name="q_${idx}_opt_${oi}_text" value="" placeholder="Lựa chọn ${oi+1}" data-focus-key="q-${idx}-opt-${oi}"><input type="hidden" name="q_${idx}_opt_${oi}_id" value="${escapeHtmlAttribute(newOpt.id)}"><button type="button" class="btn btn-outline mini-action" data-q-del-opt="${idx}-${oi}">×</button>`;
    container?.appendChild(row);
    row.querySelector("input[type=text]")?.focus();
  }));
  document.querySelectorAll("[data-q-del-opt]").forEach(el => el.addEventListener("click", () => {
    const [idx, oi] = el.dataset.qDelOpt.split("-").map(Number);
    quizBuilderQuestions = readQuestionEditors();
    const q = quizBuilderQuestions[idx];
    if (!q.options || q.options.length <= 2) return;
    q.options.splice(oi, 1);
    render();
  }));
  document.querySelectorAll("[data-q-add-acc]").forEach(el => el.addEventListener("click", () => {
    const idx = Number(el.dataset.qAddAcc);
    quizBuilderQuestions = readQuestionEditors();
    const q = quizBuilderQuestions[idx];
    if (!q.acceptedAnswers) q.acceptedAnswers = [];
    q.acceptedAnswers.push("");
    const ai = q.acceptedAnswers.length - 1;
    const container = document.getElementById(`q-acc-${idx}`);
    const row = document.createElement("div");
    row.className = "q-option-row";
    row.innerHTML = `<input type="text" name="q_${idx}_acc_${ai}" placeholder="Đáp án ${ai+1}" data-focus-key="q-${idx}-acc-${ai}"><button type="button" class="btn btn-outline mini-action" data-q-del-acc="${idx}-${ai}">×</button>`;
    container?.appendChild(row);
    row.querySelector("input")?.focus();
  }));
  document.querySelectorAll("[data-q-del-acc]").forEach(el => el.addEventListener("click", () => {
    const [idx, ai] = el.dataset.qDelAcc.split("-").map(Number);
    quizBuilderQuestions = readQuestionEditors();
    const q = quizBuilderQuestions[idx];
    if (!q.acceptedAnswers || q.acceptedAnswers.length <= 1) return;
    q.acceptedAnswers.splice(ai, 1);
    render();
  }));
  document.querySelectorAll("[data-q-add-pair]").forEach(el => el.addEventListener("click", () => {
    const idx = Number(el.dataset.qAddPair);
    quizBuilderQuestions = readQuestionEditors();
    const q = quizBuilderQuestions[idx];
    if (!q.pairs) q.pairs = [];
    q.pairs.push({ left:"", right:"" });
    const pi = q.pairs.length - 1;
    const container = document.getElementById(`q-pairs-${idx}`);
    const row = document.createElement("div");
    row.className = "q-pair-row";
    row.innerHTML = `<input type="text" name="q_${idx}_left_${pi}" placeholder="Cột A" data-focus-key="q-${idx}-l-${pi}"><span style="color:var(--muted)">→</span><input type="text" name="q_${idx}_right_${pi}" placeholder="Cột B" data-focus-key="q-${idx}-r-${pi}"><button type="button" class="btn btn-outline mini-action" data-q-del-pair="${idx}-${pi}">×</button>`;
    container?.appendChild(row);
    row.querySelector("input")?.focus();
  }));
  document.querySelectorAll("[data-q-del-pair]").forEach(el => el.addEventListener("click", () => {
    const [idx, pi] = el.dataset.qDelPair.split("-").map(Number);
    quizBuilderQuestions = readQuestionEditors();
    const q = quizBuilderQuestions[idx];
    if (!q.pairs || q.pairs.length <= 1) return;
    q.pairs.splice(pi, 1);
    render();
  }));
  document.querySelectorAll("[data-q-add-item]").forEach(el => el.addEventListener("click", () => {
    const idx = Number(el.dataset.qAddItem);
    quizBuilderQuestions = readQuestionEditors();
    const q = quizBuilderQuestions[idx];
    if (!q.items) q.items = [];
    q.items.push("");
    const ii = q.items.length - 1;
    const container = document.getElementById(`q-items-${idx}`);
    const row = document.createElement("div");
    row.className = "q-order-row";
    row.innerHTML = `<span style="font-weight:700;color:var(--muted);min-width:20px">${ii+1}.</span><input type="text" name="q_${idx}_item_${ii}" placeholder="Bước ${ii+1}" data-focus-key="q-${idx}-item-${ii}"><button type="button" class="btn btn-outline mini-action" data-q-del-item="${idx}-${ii}">×</button>`;
    container?.appendChild(row);
    row.querySelector("input")?.focus();
  }));
  document.querySelectorAll("[data-q-del-item]").forEach(el => el.addEventListener("click", () => {
    const [idx, ii] = el.dataset.qDelItem.split("-").map(Number);
    quizBuilderQuestions = readQuestionEditors();
    const q = quizBuilderQuestions[idx];
    if (!q.items || q.items.length <= 2) return;
    q.items.splice(ii, 1);
    render();
  }));
  document.getElementById("contentItemForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    if(!hasAdminAccess())return toast("error");
    const fd = new FormData(event.currentTarget);
    const type = String(fd.get("type")||"slide");
    const payload = { title: String(fd.get("title")||"").trim(), type, required: fd.get("required")==="on", completionWeight: Number(fd.get("completionWeight"))||1, minimumDurationSeconds: Number(fd.get("minimumDurationSeconds"))||8, slideTitle: String(fd.get("slideTitle")||"").trim(), slideContent: String(fd.get("slideContent")||"").trim(), sourceType: String(fd.get("sourceType")||"youtube"), youtubeVideoId: normalizeYoutubeId(String(fd.get("youtubeVideoId")||"")), sourceUrl: String(fd.get("sourceUrl")||"").trim(), transcript: String(fd.get("transcript")||""), transcriptAlternativeAllowed: fd.get("transcriptAlternativeAllowed")==="on", requiredPercent: Number(fd.get("requiredPercent"))||90, quizId: String(fd.get("quizId")||""), requirePass: fd.get("requirePass")==="on" };
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
      deliveryMode: String(formData.get("format") || "online").toLowerCase(),
      durationHours: Number(formData.get("durationHours")),
      status: String(formData.get("status") || "draft"),
      coverImageId: String(formData.get("coverImageId") || ""),
      thumbnailImageId: String(formData.get("coverImageId") || ""),
      imageAlt: String(formData.get("imageAlt") || formData.get("title") || "").trim(),
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
  { let _asc = false;
    const el = document.getElementById("assignSearchInput");
    el?.addEventListener("compositionstart", () => { _asc = true; });
    el?.addEventListener("compositionend", debounce((e) => { _asc = false; assignSearch = e.target.value; render(); }, 30));
    el?.addEventListener("input", debounce((e) => { if (_asc) return; assignSearch = e.target.value; render(); }, 180));
  }
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
  { let _bsc = false;
    const el = document.getElementById("bulkSearchInput");
    el?.addEventListener("compositionstart", () => { _bsc = true; });
    el?.addEventListener("compositionend", debounce((e) => { _bsc = false; bulkEmployeeSearch = e.target.value; render(); }, 30));
    el?.addEventListener("input", debounce((e) => { if (_bsc) return; bulkEmployeeSearch = e.target.value; render(); }, 180));
  }
  document.querySelector("[data-bulk-department]")?.addEventListener("change",(e)=>{bulkDepartmentFilter=e.target.value; if(assignMethod==="department") bulkSelectedAccountIds=getAccounts().filter(a=>a.role==="employee"&&a.accountStatus!=="disabled"&&a.department===bulkDepartmentFilter).map(a=>a.id); render();});
  document.querySelectorAll("[data-bulk-account]").forEach((el)=>el.addEventListener("change",()=>{bulkSelectedAccountIds=el.checked?[...new Set([...bulkSelectedAccountIds,el.dataset.bulkAccount])]:bulkSelectedAccountIds.filter(id=>id!==el.dataset.bulkAccount); render();}));
  document.querySelector("[data-select-visible]")?.addEventListener("click",()=>{bulkSelectedAccountIds=getAccounts().filter(a=>a.role==="employee"&&a.accountStatus!=="disabled"&&(!bulkEmployeeSearch||`${a.fullName} ${a.email}`.toLowerCase().includes(bulkEmployeeSearch.toLowerCase()))&&(!bulkDepartmentFilter||a.department===bulkDepartmentFilter)).map(a=>a.id);render();});
  document.querySelector("[data-clear-bulk]")?.addEventListener("click",()=>{bulkSelectedAccountIds=[];render();});
  document.querySelector("[data-bulk-excel]")?.addEventListener("change", async ()=>{openImportWizard("participants",selectedOfflineSessionId);render();});
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
    const currentSession = sessionService.getValidSession();
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
  document.querySelectorAll("[data-reset-learning]").forEach(el=>el.addEventListener("click",()=>{const row=getEnrollments().find(x=>x.id===el.dataset.resetLearning);openDialog({type:"confirm",title:lt("resetConfirm"),body:lt("resetReason"),onConfirm:()=>{const result=resetLearningProgress({performedBy:session.accountId,targetAccountId:row.accountId,courseId:row.courseId,reason:"HR đặt lại tiến trình"});toast(result?"success":"error");if(result)render();}});}));
  document.querySelectorAll("[data-view-learning-log]").forEach(el=>el.addEventListener("click",()=>{const row=getEnrollments().find(x=>x.id===el.dataset.viewLearningLog);const logs=getLearningActivity({accountId:row.accountId,courseId:row.courseId}).slice(0,20);openDialog({type:"alert",title:"Nhật ký học tập",body:logs.length?logs.map(x=>`${x.occurredAt} · ${x.eventType}`).join("\n"):lt("noActivity")});}));
  document.querySelectorAll("[data-remove-enrollment]").forEach((el) => el.addEventListener("click", () => {
    const enrollmentId = el.dataset.removeEnrollment;
    openDialog({type:"confirm",title:"Hủy giao khóa học",body:"Nhân viên sẽ bị xóa khỏi khóa học này. Tiến trình học sẽ không bị xóa.",onConfirm:()=>{
      const removed = removeEnrollment(enrollmentId);
      toast(removed ? "success" : "error");
      if (removed) render();
    }});
  }));
  document.querySelectorAll("[data-quick-assign]").forEach((el) => el.addEventListener("click", () => {
    const accountId = el.dataset.quickAssign;
    if (!accountId) return toast("error");
    assignTargetAccountId = accountId;
    assignTargetCourseId = "";
    assignModalOpen = true;
    navigate(`/admin/assign?accountId=${encodeURIComponent(accountId)}&open=1`);
  }));
  if (!window.__kisEscBound) {
    window.__kisEscBound = true;
    document.addEventListener("keydown", (e) => {
      if (dialogState) {
        if (e.key === "Tab") {
          const focusable = [...document.querySelectorAll("[data-shared-dialog] button, [data-shared-dialog] a")].filter((item) => !item.disabled);
          if (focusable.length) {
            const first = focusable[0], last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
          }
          return;
        }
        if (e.key === "Escape" && !dialogState.important) { e.preventDefault(); closeDialog(); }
        return;
      }
      if (e.key !== "Escape") return;
      if (contentBuilderMode) { contentBuilderMode=""; contentPickerStep="type"; slideDraft=null; youtubeDraft=null; render(); return; }
      if (quizFormOpen) { quizFormOpen=false; quizBuilderQuestions=[]; quizAddingQType=false; render(); return; }
      if (courseDrawerOpen) { courseDrawerOpen=false; render(); return; }
      if (accountDrawerOpen) { accountDrawerOpen=false; render(); return; }
      if (assignModalOpen) { assignModalOpen=false; render(); return; }
      if (resetModalOpen) { resetModalOpen=false; render(); return; }
    }, { capture: true });
  }
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
